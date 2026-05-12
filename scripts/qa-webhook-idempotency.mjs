// QA: exercise claimWebhookEvent branches by mocking supabaseAdmin.
// Re-imports an inline copy of the function and statically diffs against
// the source so we know we're testing the same code.

import { readFileSync } from "node:fs";

const src = readFileSync("backend/routes/billing.ts", "utf8");
const fnMatch = src.match(/async function claimWebhookEvent[\s\S]*?\n\}/);
if (!fnMatch) {
  console.error("❌ could not locate claimWebhookEvent in billing.ts");
  process.exit(1);
}
const sourceFn = fnMatch[0];

// ─── Inline copy under test ───
const inlineFn = `async function claimWebhookEvent(eventId, eventType) {
  const { error } = await supabaseAdmin
    .from("processed_webhook_events")
    .insert({ event_id: eventId, event_type: eventType });

  if (!error) return false;

  if (error.code === "23505") return true;

  console.error("[Stripe] Idempotency check failed, processing anyway:", error);
  return false;
}`;

const stripTs = (s) =>
  s
    .replace(/: Promise<boolean>/g, "")
    .replace(/: string/g, "")
    .replace(/\(error as any\)/g, "error")
    .replace(/\/\/[^\n]*/g, "") // strip line comments
    .replace(/\s+/g, " ")
    .trim();

if (stripTs(sourceFn) !== stripTs(inlineFn)) {
  console.error("❌ inline copy diverged from source — refresh QA harness");
  console.error("source:", stripTs(sourceFn));
  console.error("inline:", stripTs(inlineFn));
  process.exit(1);
}
console.log("✅ inline copy matches billing.ts source (modulo comments + types)");

// Mock supabaseAdmin: insert(...) returns a promise directly (no .select() chain anymore)
function mockBuilder(insertResult) {
  return {
    from: () => ({
      insert: () => Promise.resolve(insertResult),
    }),
  };
}

const cases = [
  {
    desc: "fresh event: insert succeeds, returns false (process it)",
    insertResult: { data: [{ event_id: "evt_1" }], error: null },
    expected: false,
    expectLog: false,
  },
  {
    desc: "fresh event with no data echoed: still returns false (process)",
    insertResult: { data: null, error: null },
    expected: false,
    expectLog: false,
  },
  {
    desc: "duplicate event (23505): returns true (skip it)",
    insertResult: { data: null, error: { code: "23505", message: "duplicate key" } },
    expected: true,
    expectLog: false,
  },
  {
    desc: "table missing (42P01): logs error, returns false (fail open)",
    insertResult: { data: null, error: { code: "42P01", message: "relation does not exist" } },
    expected: false,
    expectLog: true,
  },
  {
    desc: "network error (no code): logs error, returns false (fail open)",
    insertResult: { data: null, error: { message: "fetch failed" } },
    expected: false,
    expectLog: true,
  },
];

let pass = 0, fail = 0;

for (const c of cases) {
  const supabaseAdmin = mockBuilder(c.insertResult);
  const errorLog = [];
  const fakeConsole = { ...console, error: (...a) => errorLog.push(a) };

  const factory = new Function(
    "supabaseAdmin",
    "console",
    `${inlineFn}\nreturn claimWebhookEvent;`,
  );
  const claimWebhookEvent = factory(supabaseAdmin, fakeConsole);

  const actual = await claimWebhookEvent("evt_1", "checkout.session.completed");
  const ok = actual === c.expected;
  const logOk = c.expectLog ? errorLog.length > 0 : errorLog.length === 0;
  const overall = ok && logOk;

  console.log(
    `${overall ? "✅" : "❌"} ${c.desc}: returned=${actual} expected=${c.expected}` +
      `${c.expectLog ? `, log=${errorLog.length > 0}` : ""}`,
  );
  overall ? pass++ : fail++;
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
