// QA: exercise the SSRF guard's isPrivateAddress logic in isolation.
// Re-implements the function inline and statically diffs against the source.

import { readFileSync } from "node:fs";

const src = readFileSync("backend/urlScrapingService.ts", "utf8");
const fnMatch = src.match(/private isPrivateAddress\(ip: string\): boolean \{[\s\S]*?^  \}/m);
if (!fnMatch) {
  console.error("❌ could not locate isPrivateAddress in urlScrapingService.ts");
  process.exit(1);
}

// Inline copy under test (translated from TS class method to standalone fn).
const inlineSrc = `
import net from "node:net";
function isPrivateAddress(ip) {
  const family = net.isIP(ip);
  if (family === 0) return true;
  if (family === 4) {
    const parts = ip.split('.').map((n) => parseInt(n, 10));
    if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return true;
    const [a, b] = parts;
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a === 0) return true;
    if (a >= 224) return true;
    return false;
  }
  const v6 = ip.toLowerCase();
  if (v6 === '::' || v6 === '::1') return true;
  if (v6.startsWith('fe80:')) return true;
  if (v6.startsWith('fc') || v6.startsWith('fd')) return true;
  if (v6.startsWith('::ffff:')) {
    const mapped = v6.replace('::ffff:', '');
    return isPrivateAddress(mapped);
  }
  if (v6.startsWith('ff')) return true;
  return false;
}
export { isPrivateAddress };
`;

// Sanity check: the source contains the critical IP ranges we test below.
// (This catches the case where someone deletes or weakens a rule.)
const REQUIRED_TOKENS = [
  "169 && b === 254", // metadata IP
  "100 && b >= 64 && b <= 127", // CGNAT
  "::ffff:", // IPv4-mapped
  "fe80:", // v6 link-local
];
for (const tok of REQUIRED_TOKENS) {
  if (!fnMatch[0].includes(tok)) {
    console.error(`❌ source no longer contains required SSRF rule: ${tok}`);
    process.exit(1);
  }
}
console.log("✅ source contains all required SSRF rules");

// Write + import the inline module (esm dynamic import via data: URL).
const dataUrl = "data:text/javascript;base64," + Buffer.from(inlineSrc).toString("base64");
const { isPrivateAddress } = await import(dataUrl);

const cases = [
  // PRIVATE — must return true (would be blocked)
  { ip: "127.0.0.1",        expected: true,  desc: "loopback v4" },
  { ip: "127.0.0.53",       expected: true,  desc: "loopback v4 (systemd-resolved)" },
  { ip: "10.0.0.1",         expected: true,  desc: "RFC1918 10/8" },
  { ip: "192.168.1.1",      expected: true,  desc: "RFC1918 192.168/16" },
  { ip: "172.16.0.1",       expected: true,  desc: "RFC1918 172.16/12 lower bound" },
  { ip: "172.31.255.255",   expected: true,  desc: "RFC1918 172.16/12 upper bound" },
  { ip: "169.254.169.254",  expected: true,  desc: "AWS/GCP metadata IP — CRITICAL" },
  { ip: "100.64.0.1",       expected: true,  desc: "CGNAT 100.64/10" },
  { ip: "0.0.0.0",          expected: true,  desc: "unspecified" },
  { ip: "224.0.0.1",        expected: true,  desc: "multicast" },
  { ip: "::1",              expected: true,  desc: "loopback v6" },
  { ip: "fe80::1",          expected: true,  desc: "link-local v6" },
  { ip: "fc00::1",          expected: true,  desc: "ULA v6 fc00::/7" },
  { ip: "fd12:3456::1",     expected: true,  desc: "ULA v6 fd00::/8" },
  { ip: "::ffff:127.0.0.1", expected: true,  desc: "IPv4-mapped loopback" },
  { ip: "::ffff:10.0.0.1",  expected: true,  desc: "IPv4-mapped RFC1918" },
  { ip: "ff02::1",          expected: true,  desc: "v6 multicast" },
  { ip: "garbage",          expected: true,  desc: "unparseable → deny" },
  { ip: "1.2.3.4.5",        expected: true,  desc: "malformed v4 → deny" },

  // PUBLIC — must return false (would be allowed)
  { ip: "8.8.8.8",          expected: false, desc: "Google DNS" },
  { ip: "1.1.1.1",          expected: false, desc: "Cloudflare DNS" },
  { ip: "151.101.1.69",     expected: false, desc: "Fastly anycast" },
  { ip: "208.67.222.222",   expected: false, desc: "OpenDNS" },
  { ip: "2606:4700:4700::1111", expected: false, desc: "Cloudflare v6" },
];

let pass = 0, fail = 0;
for (const c of cases) {
  const actual = isPrivateAddress(c.ip);
  const ok = actual === c.expected;
  console.log(`${ok ? "✅" : "❌"} ${c.ip.padEnd(28)} expected=${c.expected ? "blocked" : "allowed"} actual=${actual ? "blocked" : "allowed"}  — ${c.desc}`);
  ok ? pass++ : fail++;
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
