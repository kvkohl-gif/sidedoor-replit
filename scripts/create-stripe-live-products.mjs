#!/usr/bin/env node
// Bulk-create the 12 SideDoor subscription products + prices in Stripe.
//
// USAGE:
//   STRIPE_SECRET_KEY=sk_live_xxx node scripts/create-stripe-live-products.mjs
//
//   To dry-run against test mode first:
//   STRIPE_SECRET_KEY=sk_test_xxx node scripts/create-stripe-live-products.mjs
//
// Behavior:
//   - Idempotent: if a product with the same name already exists, reuses it.
//   - Creates a price under each product if no matching price exists.
//   - Prints all 12 price IDs at the end in env-var format ready to paste into Railway.

import Stripe from "stripe";

const secret = process.env.STRIPE_SECRET_KEY;
if (!secret) {
  console.error("❌ STRIPE_SECRET_KEY env var is required.");
  console.error("   Usage: STRIPE_SECRET_KEY=sk_live_xxx node scripts/create-stripe-live-products.mjs");
  process.exit(1);
}
if (!secret.startsWith("sk_live_") && !secret.startsWith("sk_test_")) {
  console.error("❌ STRIPE_SECRET_KEY doesn't look like a Stripe key (expected sk_live_ or sk_test_).");
  process.exit(1);
}

const mode = secret.startsWith("sk_live_") ? "LIVE" : "TEST";
console.log(`\n🔑 Connected to Stripe in ${mode} mode.\n`);

const stripe = new Stripe(secret);

// ─── Plan catalog (mirrors backend/constants/credits.ts) ───
// Base prices: starter=$15, pro=$29, max=$49
// Discounts: 3mo=10%, 6mo=15%, annual=20%
// Periods: monthly (1mo interval), 3month (3mo), 6month (6mo), annual (12mo)
//
// Each price is in CENTS (Stripe's unit).

const PLANS = [
  // Starter
  { envVar: "STRIPE_STARTER_MONTHLY_PRICE_ID",  name: "SideDoor Starter — Monthly",  amount: 1500,  interval: "month", count: 1 },
  { envVar: "STRIPE_STARTER_3MONTH_PRICE_ID",   name: "SideDoor Starter — 3-Month",  amount: 4050,  interval: "month", count: 3 },
  { envVar: "STRIPE_STARTER_6MONTH_PRICE_ID",   name: "SideDoor Starter — 6-Month",  amount: 7650,  interval: "month", count: 6 },
  { envVar: "STRIPE_STARTER_ANNUAL_PRICE_ID",   name: "SideDoor Starter — Annual",   amount: 14400, interval: "year",  count: 1 },
  // Pro
  { envVar: "STRIPE_PRO_MONTHLY_PRICE_ID",      name: "SideDoor Pro — Monthly",      amount: 2900,  interval: "month", count: 1 },
  { envVar: "STRIPE_PRO_3MONTH_PRICE_ID",       name: "SideDoor Pro — 3-Month",      amount: 7830,  interval: "month", count: 3 },
  { envVar: "STRIPE_PRO_6MONTH_PRICE_ID",       name: "SideDoor Pro — 6-Month",      amount: 14790, interval: "month", count: 6 },
  { envVar: "STRIPE_PRO_ANNUAL_PRICE_ID",       name: "SideDoor Pro — Annual",       amount: 27840, interval: "year",  count: 1 },
  // Max
  { envVar: "STRIPE_MAX_MONTHLY_PRICE_ID",      name: "SideDoor Max — Monthly",      amount: 4900,  interval: "month", count: 1 },
  { envVar: "STRIPE_MAX_3MONTH_PRICE_ID",       name: "SideDoor Max — 3-Month",      amount: 13230, interval: "month", count: 3 },
  { envVar: "STRIPE_MAX_6MONTH_PRICE_ID",       name: "SideDoor Max — 6-Month",      amount: 24990, interval: "month", count: 6 },
  { envVar: "STRIPE_MAX_ANNUAL_PRICE_ID",       name: "SideDoor Max — Annual",       amount: 47040, interval: "year",  count: 1 },
];

// ─── Idempotent lookup: find product by exact name match ───
async function findOrCreateProduct(name) {
  // Stripe doesn't have a "search by name" so we list and filter.
  // 100 results is plenty for 12 products.
  const products = await stripe.products.list({ limit: 100, active: true });
  const existing = products.data.find((p) => p.name === name);
  if (existing) {
    console.log(`  ↻ Product exists: ${name} (${existing.id})`);
    return existing;
  }
  const created = await stripe.products.create({ name });
  console.log(`  ✚ Created product: ${name} (${created.id})`);
  return created;
}

// ─── Idempotent: find a recurring price with matching amount+interval for this product ───
async function findOrCreatePrice(productId, amountCents, interval, intervalCount) {
  const prices = await stripe.prices.list({ product: productId, limit: 100, active: true });
  const existing = prices.data.find(
    (p) =>
      p.unit_amount === amountCents &&
      p.currency === "usd" &&
      p.recurring?.interval === interval &&
      (p.recurring?.interval_count ?? 1) === intervalCount,
  );
  if (existing) {
    console.log(`    ↻ Price exists: $${(amountCents / 100).toFixed(2)} / ${intervalCount} ${interval} (${existing.id})`);
    return existing;
  }
  const created = await stripe.prices.create({
    product: productId,
    unit_amount: amountCents,
    currency: "usd",
    recurring: { interval, interval_count: intervalCount },
  });
  console.log(`    ✚ Created price: $${(amountCents / 100).toFixed(2)} / ${intervalCount} ${interval} (${created.id})`);
  return created;
}

// ─── Main ───
const results = {};
for (const plan of PLANS) {
  console.log(`\n→ ${plan.name}`);
  const product = await findOrCreateProduct(plan.name);
  const price = await findOrCreatePrice(product.id, plan.amount, plan.interval, plan.count);
  results[plan.envVar] = price.id;
}

console.log("\n\n═══════════════════════════════════════════════════════════════");
console.log("✅ All 12 products + prices ready.");
console.log("═══════════════════════════════════════════════════════════════");
console.log("\nPaste these into Railway production env (raw editor):\n");
for (const [k, v] of Object.entries(results)) {
  console.log(`${k}=${v}`);
}
console.log("\nDon't forget to also set (from Stripe Dashboard → Developers):");
console.log("  STRIPE_SECRET_KEY=<your sk_live_ key>");
console.log("  STRIPE_WEBHOOK_SECRET=<whsec_... from your webhook endpoint>");
console.log("");
