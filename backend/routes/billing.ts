import { Router, Request, Response } from "express";
import Stripe from "stripe";
import { supabaseAdmin } from "../lib/supabaseClient";
import { STRIPE_PRICE_IDS, PLAN_CREDITS, BILLING_PERIODS, type PlanType, type BillingPeriod } from "../constants/credits";
import { getUserSubscription, resetMonthlyCredits, grantCredits, getTransactionHistory } from "../services/creditService";
import { createNotification } from "../services/notificationService";
import { nanoid } from "nanoid";

const stripeKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeKey ? new Stripe(stripeKey) : null;

// Guard: reject Stripe-dependent routes when key is missing
function requireStripe(_req: Request, res: Response, next: Function) {
  if (!stripe) {
    return res.status(503).json({ error: "Stripe is not configured" });
  }
  next();
}

const router = Router();

// ─── Require Auth helper ───
function requireAuth(req: Request, res: Response, next: Function) {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });
  next();
}

// ─── Gap 4: Webhook Idempotency ───
// Track processed Stripe event IDs to prevent duplicate processing
const processedEvents = new Map<string, number>(); // eventId -> timestamp
const IDEMPOTENCY_TTL = 24 * 60 * 60 * 1000; // 24 hours

function isEventAlreadyProcessed(eventId: string): boolean {
  const processed = processedEvents.get(eventId);
  if (processed) return true;
  processedEvents.set(eventId, Date.now());
  // Cleanup old entries every 100 events
  if (processedEvents.size > 500) {
    const cutoff = Date.now() - IDEMPOTENCY_TTL;
    for (const [id, ts] of processedEvents.entries()) {
      if (ts < cutoff) processedEvents.delete(id);
    }
  }
  return false;
}

// ─── Helper: Resolve price ID to plan type ───
function resolvePlanFromPriceId(priceId: string): PlanType | null {
  for (const [plan, periods] of Object.entries(STRIPE_PRICE_IDS)) {
    for (const [_period, id] of Object.entries(periods)) {
      if (id === priceId) return plan as PlanType;
    }
  }
  return null;
}

// ─── GET /api/billing/subscription ───
// Returns user's current subscription + credits info
router.get("/subscription", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const sub = await getUserSubscription(userId);

    if (!sub) {
      return res.json({
        plan_type: "free",
        status: "active",
        credits_remaining: 0,
        credits_total: 0,
        free_tier_expires_at: null,
      });
    }

    return res.json({
      plan_type: sub.plan_type,
      status: sub.status,
      credits_remaining: sub.credits_remaining,
      credits_total: sub.credits_total,
      free_tier_expires_at: sub.free_tier_expires_at,
      billing_cycle_start: sub.billing_cycle_start,
      billing_cycle_end: sub.billing_cycle_end,
      stripe_customer_id: sub.stripe_customer_id ? true : false, // Don't leak actual ID
    });
  } catch (error) {
    console.error("Subscription fetch error:", error);
    return res.status(500).json({ error: "Failed to fetch subscription" });
  }
});

// ─── GET /api/billing/transactions ───
router.get("/transactions", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const limit = parseInt(req.query.limit as string) || 50;
    const transactions = await getTransactionHistory(userId, limit);
    return res.json(transactions);
  } catch (error) {
    console.error("Transaction history error:", error);
    return res.status(500).json({ error: "Failed to fetch transactions" });
  }
});

// ─── POST /api/billing/create-checkout-session ───
// Creates a Stripe Checkout Session for upgrading to a paid plan
router.post("/create-checkout-session", requireAuth, requireStripe, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { planType, billingPeriod = "monthly" } = req.body as {
      planType: PlanType;
      billingPeriod?: BillingPeriod;
    };

    if (!planType || !["starter", "pro", "max"].includes(planType)) {
      return res.status(400).json({ error: "Invalid plan type" });
    }

    const validPeriods: BillingPeriod[] = ["monthly", "3month", "6month", "annual"];
    if (!validPeriods.includes(billingPeriod)) {
      return res.status(400).json({ error: "Invalid billing period" });
    }

    const priceId = STRIPE_PRICE_IDS[planType as keyof typeof STRIPE_PRICE_IDS]?.[billingPeriod];
    if (!priceId) {
      return res.status(400).json({ error: "Stripe price not configured for this plan/period" });
    }

    // Get or create Stripe customer
    const sub = await getUserSubscription(userId);
    let customerId = sub?.stripe_customer_id;

    if (!customerId) {
      // Fetch user email for Stripe customer creation
      const { data: user } = await supabaseAdmin
        .from("users")
        .select("email, first_name, last_name")
        .eq("id", userId)
        .single();

      const customer = await stripe!.customers.create({
        email: user?.email,
        name: user ? `${user.first_name} ${user.last_name}` : undefined,
        metadata: { user_id: userId },
      });

      customerId = customer.id;

      // Store customer ID
      await supabaseAdmin
        .from("user_subscriptions")
        .update({ stripe_customer_id: customerId })
        .eq("user_id", userId);
    }

    const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get("host")}`;

    const session = await stripe!.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${baseUrl}/billing?upgraded=true`,
      cancel_url: `${baseUrl}/billing?canceled=true`,
      metadata: { user_id: userId, plan_type: planType, billing_period: billingPeriod },
    });

    return res.json({ checkoutUrl: session.url });
  } catch (error) {
    console.error("Checkout session error:", error);
    return res.status(500).json({ error: "Failed to create checkout session" });
  }
});

// ─── POST /api/billing/create-portal-session ───
// Creates a Stripe Customer Portal session for managing subscription
router.post("/create-portal-session", requireAuth, requireStripe, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const sub = await getUserSubscription(userId);
    let customerId = sub?.stripe_customer_id;

    // Create a Stripe customer on-the-fly if none exists (e.g., free trial user)
    if (!customerId) {
      const { data: user } = await supabaseAdmin
        .from("users")
        .select("email, first_name, last_name")
        .eq("id", userId)
        .single();

      const customer = await stripe!.customers.create({
        email: user?.email,
        name: user ? `${user.first_name} ${user.last_name}` : undefined,
        metadata: { user_id: userId },
      });

      customerId = customer.id;

      // Store the customer ID
      await supabaseAdmin
        .from("user_subscriptions")
        .update({ stripe_customer_id: customerId })
        .eq("user_id", userId);
    }

    const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get("host")}`;

    const portalSession = await stripe!.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${baseUrl}/billing`,
    });

    return res.json({ portalUrl: portalSession.url });
  } catch (error) {
    console.error("Portal session error:", error);
    return res.status(500).json({ error: "Failed to create portal session" });
  }
});

// ─── POST /api/billing/change-plan ───
// Gap 5: In-app plan change (upgrade or downgrade) without requiring portal
router.post("/change-plan", requireAuth, requireStripe, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { planType, billingPeriod = "monthly" } = req.body as {
      planType: PlanType;
      billingPeriod?: BillingPeriod;
    };

    if (!planType || !["starter", "pro", "max"].includes(planType)) {
      return res.status(400).json({ error: "Invalid plan type" });
    }

    const sub = await getUserSubscription(userId);
    if (!sub?.stripe_subscription_id || !sub?.stripe_customer_id) {
      return res.status(400).json({ error: "No active subscription to change. Use checkout to subscribe." });
    }

    const priceId = STRIPE_PRICE_IDS[planType as keyof typeof STRIPE_PRICE_IDS]?.[billingPeriod];
    if (!priceId) {
      return res.status(400).json({ error: "Price not configured for this plan/period" });
    }

    // Retrieve current subscription to get the item ID
    const subscription = await stripe!.subscriptions.retrieve(sub.stripe_subscription_id);
    const currentItemId = subscription.items.data[0]?.id;
    if (!currentItemId) {
      return res.status(400).json({ error: "Could not find subscription item" });
    }

    // Determine if upgrade or downgrade
    const planOrder = { free: 0, starter: 1, pro: 2, max: 3 };
    const isDowngrade = planOrder[planType] < planOrder[sub.plan_type as PlanType];

    if (isDowngrade) {
      // Downgrade: schedule at end of period (no proration)
      await stripe!.subscriptions.update(sub.stripe_subscription_id, {
        items: [{ id: currentItemId, price: priceId }],
        proration_behavior: "none",
        billing_cycle_anchor: "unchanged",
      });

      // Create notification about scheduled downgrade
      await createNotification(
        userId,
        "plan_change",
        "Plan downgrade scheduled",
        `Your plan will change to ${planType} at the end of your current billing period.`,
        "/billing"
      );

      return res.json({
        success: true,
        message: `Downgrade to ${planType} scheduled for end of billing period`,
        effective: "end_of_period",
      });
    } else {
      // Upgrade: immediate with proration
      await stripe!.subscriptions.update(sub.stripe_subscription_id, {
        items: [{ id: currentItemId, price: priceId }],
        proration_behavior: "always_invoice",
      });

      return res.json({
        success: true,
        message: `Upgraded to ${planType}`,
        effective: "immediate",
      });
    }
  } catch (error: any) {
    console.error("Plan change error:", error);
    return res.status(500).json({ error: error.message || "Failed to change plan" });
  }
});

// ─── POST /api/billing/cancel ───
// Cancel subscription at end of period
router.post("/cancel", requireAuth, requireStripe, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const sub = await getUserSubscription(userId);

    if (!sub?.stripe_subscription_id) {
      return res.status(400).json({ error: "No active subscription to cancel" });
    }

    // Cancel at period end (not immediately)
    await stripe!.subscriptions.update(sub.stripe_subscription_id, {
      cancel_at_period_end: true,
    });

    await createNotification(
      userId,
      "subscription_canceled",
      "Subscription cancellation scheduled",
      "Your subscription will end at the close of your current billing period. You'll retain access until then.",
      "/billing"
    );

    return res.json({
      success: true,
      message: "Subscription will cancel at end of billing period",
      cancels_at: sub.billing_cycle_end,
    });
  } catch (error: any) {
    console.error("Cancel subscription error:", error);
    return res.status(500).json({ error: error.message || "Failed to cancel subscription" });
  }
});

// ─── POST /api/billing/reactivate ───
// Reactivate a subscription that was scheduled for cancellation
router.post("/reactivate", requireAuth, requireStripe, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const sub = await getUserSubscription(userId);

    if (!sub?.stripe_subscription_id) {
      return res.status(400).json({ error: "No subscription to reactivate" });
    }

    await stripe!.subscriptions.update(sub.stripe_subscription_id, {
      cancel_at_period_end: false,
    });

    return res.json({ success: true, message: "Subscription reactivated" });
  } catch (error: any) {
    console.error("Reactivate error:", error);
    return res.status(500).json({ error: error.message || "Failed to reactivate" });
  }
});

// ─── Webhook Handler (exported separately — needs raw body) ───
export async function handleStripeWebhook(req: Request, res: Response) {
  if (!stripe) {
    return res.status(503).json({ error: "Stripe is not configured" });
  }

  const sig = req.headers["stripe-signature"] as string;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET not configured");
    return res.status(500).json({ error: "Webhook not configured" });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err: any) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).json({ error: "Invalid signature" });
  }

  // Gap 4: Idempotency check — skip if we already processed this event
  if (isEventAlreadyProcessed(event.id)) {
    console.log(`[Stripe] Skipping duplicate event: ${event.id} (${event.type})`);
    return res.json({ received: true, duplicate: true });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case "invoice.paid":
        await handleInvoicePaid(event.data.object as Stripe.Invoice);
        break;

      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case "invoice.payment_failed":
        await handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      default:
        console.log(`Unhandled webhook event: ${event.type}`);
    }

    return res.json({ received: true });
  } catch (error) {
    console.error(`Webhook handler error (${event.type}):`, error);
    return res.status(500).json({ error: "Webhook processing failed" });
  }
}

// ─── Webhook Event Handlers ───

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.user_id;
  const planType = session.metadata?.plan_type as PlanType;
  const subscriptionId = session.subscription as string;
  const customerId = session.customer as string;

  if (!userId || !planType) {
    console.error("Checkout session missing metadata:", session.id);
    return;
  }

  const planCredits = PLAN_CREDITS[planType];
  if (!planCredits) {
    console.error("Unknown plan type in checkout:", planType);
    return;
  }

  // Retrieve subscription dates from Stripe
  const subscription = await stripe!.subscriptions.retrieve(subscriptionId);

  // Update user subscription
  const { error } = await supabaseAdmin
    .from("user_subscriptions")
    .update({
      plan_type: planType,
      status: "active",
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
      credits_remaining: planCredits.total,
      credits_total: planCredits.total,
      billing_cycle_start: new Date(subscription.current_period_start * 1000).toISOString(),
      billing_cycle_end: new Date(subscription.current_period_end * 1000).toISOString(),
      free_tier_expires_at: null, // No longer on free tier
    })
    .eq("user_id", userId);

  if (error) {
    console.error("Failed to activate subscription:", error);
    return;
  }

  // Log the purchase
  await supabaseAdmin.from("credit_transactions").insert({
    id: nanoid(),
    user_id: userId,
    amount: planCredits.total,
    balance_after: planCredits.total,
    transaction_type: "purchase",
    description: `Upgraded to ${planType} plan`,
    created_at: new Date().toISOString(),
  });

  console.log(`[Stripe] User ${userId} upgraded to ${planType}`);
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  // Only process renewals, not the initial payment
  if (invoice.billing_reason !== "subscription_cycle") return;

  const customerId = invoice.customer as string;

  // Find user by Stripe customer ID
  const { data: sub } = await supabaseAdmin
    .from("user_subscriptions")
    .select("user_id, plan_type")
    .eq("stripe_customer_id", customerId)
    .single();

  if (!sub) {
    console.error("No subscription found for customer:", customerId);
    return;
  }

  // Reset monthly credits
  await resetMonthlyCredits(sub.user_id, sub.plan_type as PlanType);

  // Update billing cycle dates
  const subscriptionId = invoice.subscription as string;
  if (subscriptionId) {
    const subscription = await stripe!.subscriptions.retrieve(subscriptionId);
    await supabaseAdmin
      .from("user_subscriptions")
      .update({
        status: "active",
        billing_cycle_start: new Date(subscription.current_period_start * 1000).toISOString(),
        billing_cycle_end: new Date(subscription.current_period_end * 1000).toISOString(),
      })
      .eq("user_id", sub.user_id);
  }

  console.log(`[Stripe] Monthly credits reset for user ${sub.user_id}`);
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;

  const { data: sub } = await supabaseAdmin
    .from("user_subscriptions")
    .select("user_id, plan_type, credits_remaining")
    .eq("stripe_customer_id", customerId)
    .single();

  if (!sub) return;

  // Determine new plan from price ID (search nested structure)
  const priceId = subscription.items.data[0]?.price?.id;
  const newPlanType = resolvePlanFromPriceId(priceId || "");

  if (!newPlanType) {
    console.log(`[Stripe] Could not resolve plan for price ID: ${priceId}`);
    return;
  }

  // Mid-cycle upgrade: grant prorated credits
  const oldCredits = PLAN_CREDITS[sub.plan_type as PlanType]?.total || 0;
  const newCredits = PLAN_CREDITS[newPlanType]?.total || 0;

  if (newCredits > oldCredits) {
    const bonus = newCredits - oldCredits;
    await grantCredits(
      sub.user_id,
      bonus,
      "plan_upgrade",
      `Upgraded from ${sub.plan_type} to ${newPlanType} (+${bonus} credits)`
    );
  }

  await supabaseAdmin
    .from("user_subscriptions")
    .update({
      plan_type: newPlanType,
      status: subscription.status === "active" ? "active" : subscription.status,
      credits_total: newCredits,
    })
    .eq("user_id", sub.user_id);

  console.log(`[Stripe] Subscription updated for user ${sub.user_id}: ${sub.plan_type} → ${newPlanType}`);
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;

  const { data: sub } = await supabaseAdmin
    .from("user_subscriptions")
    .select("user_id")
    .eq("stripe_customer_id", customerId)
    .single();

  if (!sub) return;

  // Downgrade to free tier
  await supabaseAdmin
    .from("user_subscriptions")
    .update({
      plan_type: "free",
      status: "canceled",
      stripe_subscription_id: null,
      credits_remaining: 0,
      credits_total: 0,
    })
    .eq("user_id", sub.user_id);

  await supabaseAdmin.from("credit_transactions").insert({
    id: nanoid(),
    user_id: sub.user_id,
    amount: 0,
    balance_after: 0,
    transaction_type: "subscription_canceled",
    description: "Subscription canceled — downgraded to free",
    created_at: new Date().toISOString(),
  });

  // Gap 2: Notify user about cancellation
  await createNotification(
    sub.user_id,
    "subscription_canceled",
    "Subscription Ended",
    "Your subscription has been canceled and your account has been downgraded to the free tier. Upgrade anytime to regain access to premium features.",
    "/billing"
  );

  console.log(`[Stripe] Subscription canceled for user ${sub.user_id}`);
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;

  const { data: sub } = await supabaseAdmin
    .from("user_subscriptions")
    .select("user_id, plan_type")
    .eq("stripe_customer_id", customerId)
    .single();

  if (!sub) return;

  // Flag account as past_due — Stripe handles retries automatically
  await supabaseAdmin
    .from("user_subscriptions")
    .update({ status: "past_due" })
    .eq("user_id", sub.user_id);

  // Gap 2: Send in-app notification about failed payment
  const attemptCount = invoice.attempt_count || 1;
  const nextAttempt = invoice.next_payment_attempt
    ? new Date(invoice.next_payment_attempt * 1000).toLocaleDateString()
    : null;

  let message = "Your payment failed. Please update your payment method to continue using SideDoor.";
  if (attemptCount > 1 && nextAttempt) {
    message = `Payment attempt #${attemptCount} failed. Next retry on ${nextAttempt}. Update your payment method to avoid service interruption.`;
  } else if (attemptCount > 2) {
    message = `Payment has failed ${attemptCount} times. Your subscription will be canceled soon if not resolved. Please update your payment method immediately.`;
  }

  await createNotification(
    sub.user_id,
    "payment_failed",
    "⚠️ Payment Failed",
    message,
    "/billing",
    { attempt_count: attemptCount, invoice_id: invoice.id }
  );

  console.log(`[Stripe] Payment failed (attempt ${attemptCount}) for user ${sub.user_id} — marked past_due, notification sent`);
}

export default router;
