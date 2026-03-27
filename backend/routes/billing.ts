import { Router, Request, Response } from "express";
import Stripe from "stripe";
import { supabaseAdmin } from "../lib/supabaseClient";
import { STRIPE_PRICE_IDS, PLAN_CREDITS, type PlanType } from "../constants/credits";
import { getUserSubscription, resetMonthlyCredits, grantCredits, getTransactionHistory } from "../services/creditService";
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
    const { planType } = req.body as { planType: PlanType };

    if (!planType || !["starter", "pro", "max"].includes(planType)) {
      return res.status(400).json({ error: "Invalid plan type" });
    }

    const priceId = STRIPE_PRICE_IDS[planType as keyof typeof STRIPE_PRICE_IDS];
    if (!priceId) {
      return res.status(400).json({ error: "Stripe price not configured for this plan" });
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
      metadata: { user_id: userId, plan_type: planType },
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

    if (!sub?.stripe_customer_id) {
      return res.status(400).json({ error: "No billing account found" });
    }

    const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get("host")}`;

    const portalSession = await stripe!.billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      return_url: `${baseUrl}/billing`,
    });

    return res.json({ portalUrl: portalSession.url });
  } catch (error) {
    console.error("Portal session error:", error);
    return res.status(500).json({ error: "Failed to create portal session" });
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

  // Determine new plan from price ID
  const priceId = subscription.items.data[0]?.price?.id;
  let newPlanType: PlanType | null = null;

  for (const [plan, id] of Object.entries(STRIPE_PRICE_IDS)) {
    if (id === priceId) {
      newPlanType = plan as PlanType;
      break;
    }
  }

  if (!newPlanType) return;

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

  console.log(`[Stripe] Subscription canceled for user ${sub.user_id}`);
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;

  const { data: sub } = await supabaseAdmin
    .from("user_subscriptions")
    .select("user_id")
    .eq("stripe_customer_id", customerId)
    .single();

  if (!sub) return;

  // Flag account as past_due — Stripe handles retries automatically
  await supabaseAdmin
    .from("user_subscriptions")
    .update({ status: "past_due" })
    .eq("user_id", sub.user_id);

  console.log(`[Stripe] Payment failed for user ${sub.user_id} — marked past_due`);
}

export default router;
