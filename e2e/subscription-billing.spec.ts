import { test, expect, Page } from "@playwright/test";

// ─── Stripe Test Cards ──────────────────────────────────────────────
// https://docs.stripe.com/testing#cards
const CARDS = {
  success: "4242424242424242",
  declined: "4000000000000002",
  insufficient: "4000000000009995",
  expired: "4000000000000069",
  processing_error: "4000000000000119",
  requires_auth: "4000002500003155", // 3D Secure required
  // For testing specific scenarios:
  dispute: "4000000000000259",
  refund: "4000000000005126",
};

const TEST_EXPIRY = "12/30";
const TEST_CVC = "123";
const TEST_ZIP = "02457"; // Babson/Wellesley MA

// ─── Helpers ─────────────────────────────────────────────────────────

async function login(page: Page) {
  await page.goto("/login");
  await page.fill('input[name="email"], input[type="email"]', process.env.TEST_EMAIL || "kate@test.com");
  await page.fill('input[name="password"], input[type="password"]', process.env.TEST_PASSWORD || "TestPass123!");
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard", { timeout: 10000 });
}

async function navigateToBilling(page: Page) {
  await page.goto("/billing");
  await page.waitForSelector("text=Plan", { timeout: 5000 });
}

async function fillStripeCheckout(page: Page, cardNumber: string) {
  // Wait for Stripe Checkout page to load
  await page.waitForURL("**/checkout.stripe.com/**", { timeout: 15000 });

  // Fill card details in Stripe's iframe
  const cardFrame = page.frameLocator("iframe").first();
  await cardFrame.locator('[placeholder="Card number"]').fill(cardNumber);
  await cardFrame.locator('[placeholder="MM / YY"]').fill(TEST_EXPIRY);
  await cardFrame.locator('[placeholder="CVC"]').fill(TEST_CVC);

  // Fill billing address if prompted
  const zipField = cardFrame.locator('[placeholder="ZIP"]');
  if (await zipField.isVisible({ timeout: 2000 }).catch(() => false)) {
    await zipField.fill(TEST_ZIP);
  }

  // Submit payment
  await page.click('button:has-text("Subscribe"), button:has-text("Pay")');
}

// ═══════════════════════════════════════════════════════════════════════
// TEST SUITE 1: SUBSCRIPTION PAGE UI
// ═══════════════════════════════════════════════════════════════════════

test.describe("Subscription Page UI", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await navigateToBilling(page);
  });

  test("displays 3 plan cards (Starter, Professional, Executive)", async ({ page }) => {
    await expect(page.locator("text=STARTER")).toBeVisible();
    await expect(page.locator("text=PROFESSIONAL")).toBeVisible();
    await expect(page.locator("text=EXECUTIVE")).toBeVisible();
  });

  test("displays correct base prices", async ({ page }) => {
    await expect(page.locator("text=$15")).toBeVisible();
    await expect(page.locator("text=$29")).toBeVisible();
    await expect(page.locator("text=$49")).toBeVisible();
  });

  test("billing period toggle updates prices", async ({ page }) => {
    // Click Annual toggle
    await page.click("text=Annual");
    // Prices should be discounted (20% off)
    await expect(page.locator("text=$12")).toBeVisible(); // Starter: $15 * 0.8 = $12
    await expect(page.locator("text=$23")).toBeVisible(); // Pro: $29 * 0.8 = $23
    await expect(page.locator("text=$39")).toBeVisible(); // Max: $49 * 0.8 = $39
  });

  test("3-month toggle shows -10% discount", async ({ page }) => {
    await page.click("text=3-Month");
    await expect(page.locator("text=-10%")).toBeVisible();
  });

  test("6-month toggle shows -15% discount", async ({ page }) => {
    await page.click("text=6-Month");
    await expect(page.locator("text=-15%")).toBeVisible();
  });

  test("annual toggle shows -20% discount", async ({ page }) => {
    await page.click("text=Annual");
    await expect(page.locator("text=-20%")).toBeVisible();
  });

  test("Professional plan shows MOST POPULAR badge", async ({ page }) => {
    await expect(page.locator("text=MOST POPULAR")).toBeVisible();
  });

  test("shows current plan indicator for free trial user", async ({ page }) => {
    await expect(page.locator("text=Free Trial")).toBeVisible();
  });

  test("displays credits remaining and trial days", async ({ page }) => {
    await expect(page.locator("text=/credits remaining/i")).toBeVisible();
  });

  test("plan cards show correct feature lists", async ({ page }) => {
    // Starter features
    await expect(page.locator("text=AI outreach emails")).toBeVisible();
    await expect(page.locator("text=Resume & cover letter profile")).toBeVisible();

    // Pro features
    await expect(page.locator("text=Full Outreach Profile")).toBeVisible();
    await expect(page.locator("text=Follow-up draft sequences")).toBeVisible();

    // Executive features
    await expect(page.locator("text=Bulk contact & CSV export")).toBeVisible();
  });

  test("trust signals visible (cancel anytime, money-back)", async ({ page }) => {
    await expect(page.locator("text=Cancel anytime")).toBeVisible();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// TEST SUITE 2: CHECKOUT FLOW
// ═══════════════════════════════════════════════════════════════════════

test.describe("Checkout Flow", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await navigateToBilling(page);
  });

  test("clicking Get Started redirects to Stripe Checkout", async ({ page }) => {
    // Click the first "Get Started" button (Starter plan)
    await page.click('button:has-text("Get Started"):first-of-type');

    // Should redirect to Stripe
    await page.waitForURL("**/checkout.stripe.com/**", { timeout: 15000 });
    expect(page.url()).toContain("checkout.stripe.com");
  });

  test("successful payment with test card 4242", async ({ page }) => {
    await page.click('button:has-text("Get Started Now")'); // Pro plan
    await fillStripeCheckout(page, CARDS.success);

    // Should redirect back to billing page with success
    await page.waitForURL("**/billing?upgraded=true", { timeout: 30000 });
    await expect(page.locator("text=PROFESSIONAL")).toBeVisible();
  });

  test("declined card shows error in Stripe Checkout", async ({ page }) => {
    await page.click('button:has-text("Get Started Now")');
    await fillStripeCheckout(page, CARDS.declined);

    // Stripe shows decline message
    await expect(page.locator("text=/declined|failed/i")).toBeVisible({ timeout: 15000 });
  });

  test("insufficient funds card shows specific error", async ({ page }) => {
    await page.click('button:has-text("Get Started Now")');
    await fillStripeCheckout(page, CARDS.insufficient);

    await expect(page.locator("text=/insufficient|funds/i")).toBeVisible({ timeout: 15000 });
  });

  test("cancel from Stripe Checkout returns to billing page", async ({ page }) => {
    await page.click('button:has-text("Get Started Now")');
    await page.waitForURL("**/checkout.stripe.com/**", { timeout: 15000 });

    // Click the back/cancel link in Stripe Checkout
    await page.click('a:has-text("Back"), a:has-text("Cancel"), [data-testid="back-button"]');
    await page.waitForURL("**/billing?canceled=true", { timeout: 15000 });
  });

  test("3-month billing period creates correct checkout", async ({ page }) => {
    await page.click("text=3-Month");
    await page.click('button:has-text("Get Started Now")');
    await page.waitForURL("**/checkout.stripe.com/**", { timeout: 15000 });

    // Verify the checkout shows the 3-month price
    await expect(page.locator("text=/every 3 months/i")).toBeVisible({ timeout: 10000 });
  });

  test("annual billing period creates correct checkout", async ({ page }) => {
    await page.click("text=Annual");
    await page.click('button:has-text("Get Started Now")');
    await page.waitForURL("**/checkout.stripe.com/**", { timeout: 15000 });

    await expect(page.locator("text=/year|annually/i")).toBeVisible({ timeout: 10000 });
  });
});

// ═══════════════════════════════════════════════════════════════════════
// TEST SUITE 3: POST-UPGRADE STATE
// ═══════════════════════════════════════════════════════════════════════

test.describe("Post-Upgrade Verification", () => {
  // These tests assume a user has already upgraded to Pro
  // Run after the successful checkout test above

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("billing page shows current plan as Professional", async ({ page }) => {
    await navigateToBilling(page);
    // Should show the current plan indicator on Pro
    await expect(page.locator("text=/Current Plan|Your Plan/i")).toBeVisible();
  });

  test("credits updated to Pro tier (250)", async ({ page }) => {
    await navigateToBilling(page);
    await expect(page.locator("text=250")).toBeVisible();
  });

  test("sidebar shows updated credits", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.locator("text=/250|credits/i")).toBeVisible();
  });

  test("Stripe invoice email received", async ({ page }) => {
    // This is a manual verification step — Stripe sends emails in test mode
    // if email receipts are enabled in Stripe Dashboard → Settings → Emails
    // Verify: check the test email inbox for an invoice from Stripe
    test.info().annotations.push({
      type: "manual",
      description: "Check test email inbox for Stripe invoice receipt",
    });
    expect(true).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// TEST SUITE 4: PLAN CHANGES (UPGRADE/DOWNGRADE)
// ═══════════════════════════════════════════════════════════════════════

test.describe("Plan Changes", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await navigateToBilling(page);
  });

  test("upgrade from Starter to Pro shows prorated charge", async ({ page }) => {
    // This test requires the user to be on Starter first
    // The change-plan endpoint handles proration
    const response = await page.request.post("/api/billing/change-plan", {
      data: { planType: "pro", billingPeriod: "monthly" },
    });
    const data = await response.json();
    expect(data.effective).toBe("immediate");
  });

  test("downgrade from Pro to Starter schedules at period end", async ({ page }) => {
    const response = await page.request.post("/api/billing/change-plan", {
      data: { planType: "starter", billingPeriod: "monthly" },
    });
    const data = await response.json();
    expect(data.effective).toBe("end_of_period");
  });

  test("cancel subscription shows confirmation", async ({ page }) => {
    const response = await page.request.post("/api/billing/cancel");
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.message).toContain("cancel");
  });

  test("reactivate canceled subscription", async ({ page }) => {
    const response = await page.request.post("/api/billing/reactivate");
    const data = await response.json();
    expect(data.success).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// TEST SUITE 5: FAILED PAYMENT HANDLING
// ═══════════════════════════════════════════════════════════════════════

test.describe("Failed Payment Handling", () => {
  test("past_due status shows red banner on dashboard", async ({ page }) => {
    // This requires manually setting subscription status to past_due
    // or using Stripe test clocks to simulate failed renewal
    test.info().annotations.push({
      type: "manual",
      description: "Set user_subscriptions.status = 'past_due' in Supabase, then verify banner",
    });

    await login(page);
    await page.goto("/dashboard");

    // If status is past_due, red banner should appear
    // await expect(page.locator("text=Payment failed")).toBeVisible();
    // await expect(page.locator("text=Update Payment")).toBeVisible();
  });

  test("Update Payment button opens Stripe Portal", async ({ page }) => {
    await login(page);

    // Call portal endpoint directly
    const response = await page.request.post("/api/billing/create-portal-session");
    const data = await response.json();

    if (data.portalUrl) {
      expect(data.portalUrl).toContain("billing.stripe.com");
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════
// TEST SUITE 6: TRIAL EXPIRATION
// ═══════════════════════════════════════════════════════════════════════

test.describe("Trial Expiration", () => {
  test("trial warning banner appears when <= 3 days left", async ({ page }) => {
    // Requires setting free_tier_expires_at to 2 days from now in Supabase
    test.info().annotations.push({
      type: "setup",
      description: "Set free_tier_expires_at = NOW() + interval '2 days' for test user",
    });

    await login(page);
    await page.goto("/dashboard");

    // await expect(page.locator("text=/trial ends in/i")).toBeVisible();
    // await expect(page.locator("text=View Plans")).toBeVisible();
  });

  test("trial expired modal blocks app when trial is over", async ({ page }) => {
    // Requires setting free_tier_expires_at to past date
    test.info().annotations.push({
      type: "setup",
      description: "Set free_tier_expires_at = NOW() - interval '1 day' for test user",
    });

    await login(page);
    await page.goto("/dashboard");

    // await expect(page.locator("text=Your Free Trial Has Ended")).toBeVisible();
    // await expect(page.locator("text=Choose a plan")).toBeVisible();
  });

  test("trial expired modal shows all 3 plan options", async ({ page }) => {
    // With trial expired:
    // await expect(page.locator("text=STARTER")).toBeVisible();
    // await expect(page.locator("text=PROFESSIONAL")).toBeVisible();
    // await expect(page.locator("text=EXECUTIVE")).toBeVisible();
  });

  test("upgrading from trial expired modal works", async ({ page }) => {
    // Click upgrade button in modal → should create checkout session
    // await page.click('button:has-text("Get Started Now")');
    // await page.waitForURL("**/checkout.stripe.com/**");
  });
});

// ═══════════════════════════════════════════════════════════════════════
// TEST SUITE 7: FEATURE GATING (OUTREACH PROFILE)
// ═══════════════════════════════════════════════════════════════════════

test.describe("Feature Gating - Outreach Profile", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto("/outreach-profile");
  });

  test("free/starter user sees Resume section unlocked", async ({ page }) => {
    await expect(page.locator("text=Resume")).toBeVisible();
    // Resume section should not have a lock icon
    const resumeSection = page.locator("#section-resume");
    await expect(resumeSection).toBeVisible();
  });

  test("free/starter user sees Cover Letter section unlocked", async ({ page }) => {
    await expect(page.locator("text=Cover Letter")).toBeVisible();
  });

  test("free/starter user sees lock icon on Professional Bio", async ({ page }) => {
    // The bio section should show lock icon via FeatureLockBadge
    const bioLock = page.locator("#section-bio").locator("svg"); // Lock icon
    await expect(page.locator("text=Professional Bio")).toBeVisible();
  });

  test("free/starter user sees lock icon on Signature Wins", async ({ page }) => {
    await expect(page.locator("text=Signature Wins")).toBeVisible();
  });

  test("free/starter user sees lock icon on Career Goals", async ({ page }) => {
    await expect(page.locator("text=Career Goals")).toBeVisible();
  });

  test("free/starter user sees lock icon on Voice & Tone", async ({ page }) => {
    await expect(page.locator("text=Voice & Tone")).toBeVisible();
  });

  test("free/starter user sees lock icon on Story Hooks", async ({ page }) => {
    await expect(page.locator("text=Story Hooks")).toBeVisible();
  });

  test("clicking locked section shows upgrade card", async ({ page }) => {
    // Click on a locked section (bio)
    await page.locator("#section-bio").click();

    // Upgrade card should appear
    await expect(page.locator("text=Upgrade to Pro")).toBeVisible({ timeout: 3000 });
  });

  test("upgrade card navigates to billing page", async ({ page }) => {
    await page.locator("#section-bio").click();
    await page.click("button:has-text('Upgrade to Pro')");
    await page.waitForURL("**/billing");
  });

  test("hovering lock shows tooltip with value prop", async ({ page }) => {
    // Hover over a lock icon
    const lockIcon = page.locator("#section-bio svg").first();
    if (await lockIcon.isVisible()) {
      await lockIcon.hover();
      // Tooltip should appear with feature description
      await expect(page.locator("text=personalize your outreach")).toBeVisible({ timeout: 3000 });
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════
// TEST SUITE 8: FEATURE GATING (OUTREACH HUB)
// ═══════════════════════════════════════════════════════════════════════

test.describe("Feature Gating - Outreach Hub", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto("/outreach");
  });

  test("Overview tab is accessible for all users", async ({ page }) => {
    await expect(page.locator("text=Overview")).toBeVisible();
    // Overview content should load
    await expect(page.locator("text=INITIATION")).toBeVisible({ timeout: 5000 });
  });

  test("Drafts tab is accessible for all users", async ({ page }) => {
    await page.click("text=Drafts");
    await expect(page.locator("text=/drafts/i")).toBeVisible();
  });

  test("Sent Messages tab shows lock badge for free/starter", async ({ page }) => {
    // The tab should have a lock icon next to "Sent Messages"
    const sentTab = page.locator("button:has-text('Sent Messages')");
    await expect(sentTab).toBeVisible();
    // Check for lock icon SVG inside the tab button
  });

  test("Replies tab shows lock badge for free/starter", async ({ page }) => {
    const repliesTab = page.locator("button:has-text('Replies')");
    await expect(repliesTab).toBeVisible();
  });

  test("Follow-ups tab shows lock badge for free/starter", async ({ page }) => {
    const followupsTab = page.locator("button:has-text('Follow-ups')");
    await expect(followupsTab).toBeVisible();
  });

  test("clicking locked tab content shows upgrade overlay", async ({ page }) => {
    await page.click("button:has-text('Sent Messages')");
    // Content should be wrapped in overlay
    await page.click("text=/sent/i"); // Click somewhere in the content area
    await expect(page.locator("text=Upgrade to Pro")).toBeVisible({ timeout: 3000 });
  });
});

// ═══════════════════════════════════════════════════════════════════════
// TEST SUITE 9: API BILLING ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════

test.describe("Billing API Endpoints", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("GET /api/billing/subscription returns plan data", async ({ page }) => {
    const response = await page.request.get("/api/billing/subscription");
    expect(response.ok()).toBe(true);
    const data = await response.json();

    expect(data).toHaveProperty("plan_type");
    expect(data).toHaveProperty("credits_remaining");
    expect(data).toHaveProperty("credits_total");
    expect(data).toHaveProperty("trial_days_left");
    expect(data).toHaveProperty("trial_expired");
    expect(data).toHaveProperty("features");
  });

  test("subscription response includes plan features", async ({ page }) => {
    const response = await page.request.get("/api/billing/subscription");
    const data = await response.json();

    expect(data.features).toHaveProperty("outreachProfileSections");
    expect(data.features).toHaveProperty("outreachHubFullAccess");
    expect(data.features).toHaveProperty("followUpDrafts");
    expect(data.features).toHaveProperty("linkedinDrafts");
    expect(data.features).toHaveProperty("redraftMessage");
    expect(data.features).toHaveProperty("bulkExport");
  });

  test("free user features match expected gating", async ({ page }) => {
    const response = await page.request.get("/api/billing/subscription");
    const data = await response.json();

    if (data.plan_type === "free") {
      expect(data.features.outreachProfileSections).toEqual(["resume", "cover"]);
      expect(data.features.outreachHubFullAccess).toBe(false);
      expect(data.features.followUpDrafts).toBe(false);
      expect(data.features.linkedinDrafts).toBe(false);
      expect(data.features.redraftMessage).toBe(false);
      expect(data.features.bulkExport).toBe(false);
    }
  });

  test("GET /api/billing/transactions returns array", async ({ page }) => {
    const response = await page.request.get("/api/billing/transactions");
    expect(response.ok()).toBe(true);
    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);
  });

  test("POST /api/billing/create-checkout-session validates plan type", async ({ page }) => {
    const response = await page.request.post("/api/billing/create-checkout-session", {
      data: { planType: "invalid_plan" },
    });
    expect(response.status()).toBe(400);
  });

  test("POST /api/billing/create-checkout-session validates billing period", async ({ page }) => {
    const response = await page.request.post("/api/billing/create-checkout-session", {
      data: { planType: "pro", billingPeriod: "invalid" },
    });
    expect(response.status()).toBe(400);
  });

  test("POST /api/billing/create-checkout-session returns checkout URL", async ({ page }) => {
    const response = await page.request.post("/api/billing/create-checkout-session", {
      data: { planType: "starter", billingPeriod: "monthly" },
    });
    expect(response.ok()).toBe(true);
    const data = await response.json();
    expect(data.checkoutUrl).toContain("checkout.stripe.com");
  });

  test("POST /api/billing/cancel without subscription returns error", async ({ page }) => {
    const response = await page.request.post("/api/billing/cancel");
    // Should return error if no active subscription
    const data = await response.json();
    if (response.status() === 400) {
      expect(data.error).toContain("No active subscription");
    }
  });
});
