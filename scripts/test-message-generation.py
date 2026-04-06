#!/usr/bin/env python3
"""
Message Generation Test Runner

Runs the full test matrix from MESSAGE_GENERATION_TEST_PLAN.md against staging.
Tests every template, field population, anti-pattern detection, and quality scoring.

Prereqs:
  1. Run scripts/seed-test-personas.sql against staging Supabase
  2. python3 -m pip install requests
  3. (optional) export STAGING_URL=https://...

Usage:
  python3 scripts/test-message-generation.py
"""
import json
import os
import re
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Optional, List, Dict

try:
    import requests
except ImportError:
    print("Missing dependency. Install with: python3 -m pip install requests")
    sys.exit(1)

STAGING_URL = os.environ.get("STAGING_URL", "https://sidedoor-replit-staging.up.railway.app")
PASSWORD = "TestPass123Safe"
TIMESTAMP = datetime.now().strftime("%Y%m%d-%H%M%S")
RESULTS_DIR = Path(f"test-results/{TIMESTAMP}")
RESULTS_DIR.mkdir(parents=True, exist_ok=True)

# ANSI colors
GREEN = "\033[0;32m"
RED = "\033[0;31m"
YELLOW = "\033[0;33m"
BLUE = "\033[0;34m"
NC = "\033[0m"

# Counters
passed = 0
failed = 0
failures: List[str] = []

def log_pass(msg: str) -> None:
    global passed
    passed += 1
    print(f"{GREEN}✓{NC} {msg}")

def log_fail(msg: str) -> None:
    global failed
    failed += 1
    failures.append(msg)
    print(f"{RED}✗{NC} {msg}")

def log_section(title: str) -> None:
    print(f"\n{YELLOW}━━━ {title} ━━━{NC}")

# ─── Test fixtures (from seed-test-personas.sql) ─────────────────────────────

PERSONAS = {
    "kate":  {"email": "kate-test@sidedoor-test.com",  "first_name": "Kate"},
    "marco": {"email": "marco-test@sidedoor-test.com", "first_name": "Marco"},
    "avery": {"email": "avery-test@sidedoor-test.com", "first_name": "Avery"},
    "sam":   {"email": "sam-test@sidedoor-test.com",   "first_name": "Sam"},
}

# Contact IDs from the seed insert (jobs 23-27, contacts 89-98)
CONTACTS = {
    "ari_founder":     {"id": 89, "name": "Ari",   "company": "Farmhand",   "outreach_bucket": "department_lead"},
    "jen_recruiter":   {"id": 90, "name": "Jen",   "company": "Farmhand",   "outreach_bucket": "recruiter"},
    "emily_hm":        {"id": 91, "name": "Emily", "company": "Petvisor",   "outreach_bucket": "department_lead"},
    "kolbi_recruiter": {"id": 92, "name": "Kolbi", "company": "Petvisor",   "outreach_bucket": "recruiter"},
    "ted_founder":     {"id": 93, "name": "Ted",   "company": "Prosprous.ai","outreach_bucket": "department_lead"},
    "pat_sourcer":     {"id": 94, "name": "Pat",   "company": "Prosprous.ai","outreach_bucket": "recruiter"},
    "holly_hm":        {"id": 95, "name": "Holly", "company": "Aha!",       "outreach_bucket": "department_lead"},
    "sara_recruiter":  {"id": 96, "name": "Sara",  "company": "Aha!",       "outreach_bucket": "recruiter"},
    "dana_recruiter":  {"id": 97, "name": "Dana",  "company": "Knack",      "outreach_bucket": "recruiter"},
    "quinn_hm":        {"id": 98, "name": "Quinn", "company": "Knack",      "outreach_bucket": "department_lead"},
}

BANNED_PHRASES = [
    "i hope this finds you well",
    "i'm writing to express my interest",
    "exciting opportunity",
    "passionate about",
    "i believe i would be a great fit",
    "thrilled to",
    "to whom it may concern",
]

PLACEHOLDER_PATTERNS = [
    r"\[your name\]",
    r"\[first name\]",
    r"\{\{",
    r"\[company\]",
    r"\[role\]",
]

# ─── Session management ──────────────────────────────────────────────────────

def login(persona: str) -> requests.Session:
    s = requests.Session()
    payload = {"email": PERSONAS[persona]["email"], "password": PASSWORD}
    r = s.post(f"{STAGING_URL}/api/auth/login", json=payload, timeout=15)
    if r.status_code != 200 or not r.json().get("success", r.json().get("id")):
        raise RuntimeError(f"Login failed for {persona}: {r.status_code} {r.text}")
    return s

# ─── API calls ──────────────────────────────────────────────────────────────

def generate_message(s: requests.Session, contact_id: int, label: str, override: Optional[str] = None) -> dict:
    body = {"templateOverride": override} if override else {}
    r = s.post(f"{STAGING_URL}/api/contacts/{contact_id}/generate-message", json=body, timeout=60)
    out = {"_status": r.status_code}
    try:
        out.update(r.json())
    except Exception:
        out["_raw"] = r.text[:500]
    (RESULTS_DIR / f"{label}.json").write_text(json.dumps(out, indent=2))
    return out

def generate_followup(s: requests.Session, contact_id: int, label: str, recent_news: Optional[str] = None) -> dict:
    body = {"recentNews": recent_news} if recent_news else {}
    r = s.post(f"{STAGING_URL}/api/contacts/{contact_id}/generate-followup", json=body, timeout=60)
    out = {"_status": r.status_code}
    try: out.update(r.json())
    except Exception: out["_raw"] = r.text[:500]
    (RESULTS_DIR / f"{label}.json").write_text(json.dumps(out, indent=2))
    return out

def generate_thankyou(s: requests.Session, contact_id: int, label: str) -> dict:
    body = {
        "interviewTopic": "the team's PLG approach",
        "interviewDetail": "the way you described the activation funnel",
        "followUpThought": "I sketched a quick idea for cutting time-to-value in onboarding",
    }
    r = s.post(f"{STAGING_URL}/api/contacts/{contact_id}/generate-thankyou", json=body, timeout=60)
    out = {"_status": r.status_code}
    try: out.update(r.json())
    except Exception: out["_raw"] = r.text[:500]
    (RESULTS_DIR / f"{label}.json").write_text(json.dumps(out, indent=2))
    return out

def generate_grace(s: requests.Session, contact_id: int, label: str) -> dict:
    r = s.post(f"{STAGING_URL}/api/contacts/{contact_id}/generate-rejection-grace", json={}, timeout=60)
    out = {"_status": r.status_code}
    try: out.update(r.json())
    except Exception: out["_raw"] = r.text[:500]
    (RESULTS_DIR / f"{label}.json").write_text(json.dumps(out, indent=2))
    return out

# ─── Assertions ──────────────────────────────────────────────────────────────

def get_body(d: dict) -> str:
    return d.get("emailContent") or ""

def get_subject(d: dict) -> str:
    return d.get("emailSubject") or ""

def assert_template(d: dict, expected: str, label: str) -> None:
    actual = d.get("templateUsed", "MISSING")
    if actual == expected:
        log_pass(f"[{label}] template = {actual}")
    else:
        # Old code (pre-rewrite) doesn't return templateUsed, fall back to "OLD_CODE"
        if actual == "MISSING":
            log_fail(f"[{label}] templateUsed missing (old deploy still active?)")
        else:
            log_fail(f"[{label}] template = {actual} (expected {expected})")

def assert_no_placeholders(d: dict, label: str) -> None:
    body = get_body(d)
    for pat in PLACEHOLDER_PATTERNS:
        if re.search(pat, body, re.IGNORECASE):
            log_fail(f"[{label}] PLACEHOLDER LEAK: matches /{pat}/")
            return
    log_pass(f"[{label}] no placeholders")

def assert_signature(d: dict, first_name: str, label: str) -> None:
    body = get_body(d)
    if first_name in body:
        log_pass(f"[{label}] signature contains '{first_name}'")
    else:
        log_fail(f"[{label}] signature MISSING '{first_name}'")

def assert_company(d: dict, company: str, label: str) -> None:
    text = (get_subject(d) + " " + get_body(d)).lower()
    if company.lower() in text or company.lower().rstrip("!.").rstrip() in text:
        log_pass(f"[{label}] company '{company}' referenced")
    else:
        log_fail(f"[{label}] company '{company}' MISSING")

def assert_greeting_first_name(d: dict, contact_first: str, label: str) -> None:
    body = get_body(d)
    if re.search(rf"\bHi\s+{re.escape(contact_first)}", body, re.IGNORECASE):
        log_pass(f"[{label}] greeting 'Hi {contact_first},'")
    else:
        log_fail(f"[{label}] greeting MISSING 'Hi {contact_first},'")

def assert_contains(d: dict, needles: List[str], label: str) -> None:
    body = get_body(d).lower()
    found = [n for n in needles if n.lower() in body]
    if found:
        log_pass(f"[{label}] body contains: {found[0]}")
    else:
        log_fail(f"[{label}] body MISSING any of: {needles}")

def assert_no_banned(d: dict, label: str) -> None:
    body = get_body(d).lower()
    found = [p for p in BANNED_PHRASES if p in body]
    if not found:
        log_pass(f"[{label}] no banned phrases")
    else:
        log_fail(f"[{label}] banned phrases: {found}")

def assert_word_count(d: dict, label: str, lo: int = 60, hi: int = 200) -> None:
    body = get_body(d)
    n = len([w for w in body.split() if w.strip()])
    if lo <= n <= hi:
        log_pass(f"[{label}] word count = {n}")
    else:
        log_fail(f"[{label}] word count = {n} (expected {lo}-{hi})")

def assert_quality(d: dict, min_score: int, label: str) -> None:
    score = d.get("qualityScore")
    if score is None:
        # Old code path — skip silently
        return
    warnings = d.get("qualityWarnings", [])
    if score >= min_score:
        log_pass(f"[{label}] quality {score}/12")
    else:
        log_fail(f"[{label}] quality {score}/12 (need {min_score}). Warnings: {warnings}")

def print_preview(d: dict, label: str) -> None:
    print(f"\n{BLUE}── {label} ──{NC}")
    print(f"Template: {d.get('templateUsed', 'OLD_CODE')}")
    if d.get("qualityScore") is not None:
        print(f"Score:    {d['qualityScore']}/12")
    print(f"Subject:  {get_subject(d)}")
    print()
    for line in get_body(d).split("\n"):
        print(f"  {line}")
    if d.get("qualityWarnings"):
        print(f"Warnings: {'; '.join(d['qualityWarnings'])}")

# ─── Main ────────────────────────────────────────────────────────────────────

def main() -> int:
    print(f"{BLUE}━━━ Message Generation Test Suite ━━━{NC}")
    print(f"Staging:  {STAGING_URL}")
    print(f"Results:  {RESULTS_DIR}")

    # Login all 4 personas
    log_section("Login")
    sessions: Dict[str, requests.Session] = {}
    for p in PERSONAS:
        try:
            sessions[p] = login(p)
            log_pass(f"Login as {p}")
        except Exception as e:
            log_fail(f"Login as {p}: {e}")
            return 1

    # ─── Template Selection ───
    log_section("Template Selection Logic")
    test_matrix = [
        # (persona, contact_key, expected_template, label, override)
        ("sam",   "holly_hm",        "D_mutual_connection", "01-sam-aha-hm",            None),
        ("sam",   "sara_recruiter",  "D_mutual_connection", "02-sam-aha-recruiter",     None),
        ("avery", "ted_founder",     "C_prototype",         "03-avery-prosprous-hm",    None),
        ("avery", "pat_sourcer",     "C_prototype",         "04-avery-prosprous-rec",   None),
        ("kate",  "ari_founder",     "A1_origin_story",     "05-kate-farmhand-hm",      None),
        ("marco", "emily_hm",        "A2_lived_experience", "06-marco-petvisor-hm",     None),
        ("kate",  "jen_recruiter",   "B_recruiter",         "07-kate-farmhand-rec",     None),
        ("marco", "kolbi_recruiter", "B_recruiter",         "08-marco-petvisor-rec",    None),
        ("kate",  "dana_recruiter",  "B_recruiter",         "09-kate-knack-rec",        None),
        ("kate",  "quinn_hm",        "A1_origin_story",     "10-kate-knack-override",   "A1_origin_story"),
    ]

    results: Dict[str, dict] = {}
    for persona, ck, expected, label, override in test_matrix:
        cid = CONTACTS[ck]["id"]
        try:
            d = generate_message(sessions[persona], cid, label, override)
            results[label] = d
            assert_template(d, expected, label)
        except Exception as e:
            log_fail(f"[{label}] generation failed: {e}")

    # ─── Field Population ───
    log_section("Field Population")
    for label, d in results.items():
        if d.get("_status") != 200:
            log_fail(f"[{label}] HTTP {d.get('_status')}")
            continue
        assert_no_placeholders(d, label)

    # Signatures (each persona's first name)
    persona_for_label = {
        "01-sam-aha-hm": "Sam", "02-sam-aha-recruiter": "Sam",
        "03-avery-prosprous-hm": "Avery", "04-avery-prosprous-rec": "Avery",
        "05-kate-farmhand-hm": "Kate", "07-kate-farmhand-rec": "Kate",
        "09-kate-knack-rec": "Kate", "10-kate-knack-override": "Kate",
        "06-marco-petvisor-hm": "Marco", "08-marco-petvisor-rec": "Marco",
    }
    for label, fn in persona_for_label.items():
        if label in results:
            assert_signature(results[label], fn, label)

    # Companies
    company_for_label = {
        "01-sam-aha-hm": "Aha", "03-avery-prosprous-hm": "Prosprous",
        "05-kate-farmhand-hm": "Farmhand", "06-marco-petvisor-hm": "Petvisor",
        "09-kate-knack-rec": "Knack",
    }
    for label, co in company_for_label.items():
        if label in results:
            assert_company(results[label], co, label)

    # Greetings
    contact_for_label = {
        "01-sam-aha-hm": "Holly", "03-avery-prosprous-hm": "Ted",
        "05-kate-farmhand-hm": "Ari", "06-marco-petvisor-hm": "Emily",
        "09-kate-knack-rec": "Dana",
    }
    for label, name in contact_for_label.items():
        if label in results:
            assert_greeting_first_name(results[label], name, label)

    # Template-specific content
    if "01-sam-aha-hm" in results:
        assert_contains(results["01-sam-aha-hm"], ["stephanie"], "01 mutual name")
    if "03-avery-prosprous-hm" in results:
        assert_contains(results["03-avery-prosprous-hm"], ["pigebank", "prototype", "figma", "built"], "03 portfolio ref")
    if "05-kate-farmhand-hm" in results:
        assert_contains(results["05-kate-farmhand-hm"], ["farm", "grew up", "hay", "cattle"], "05 origin hook")
    if "06-marco-petvisor-hm" in results:
        assert_contains(results["06-marco-petvisor-hm"], ["pet", "dog", "user", "customer"], "06 lived hook")

    # ─── Anti-pattern detection ───
    log_section("Anti-pattern Detection")
    for label, d in results.items():
        if d.get("_status") == 200:
            assert_no_banned(d, label)

    # ─── Word count ───
    log_section("Word Count")
    for label, d in results.items():
        if d.get("_status") == 200:
            assert_word_count(d, label)

    # ─── Quality scores (only on new deploy) ───
    log_section("Quality Scoring (≥ 6/12)")
    quality_present = any(d.get("qualityScore") is not None for d in results.values())
    if not quality_present:
        print(f"{YELLOW}ℹ Quality scores not returned — old deploy still active{NC}")
    else:
        for label, d in results.items():
            if d.get("_status") == 200:
                assert_quality(d, 6, label)

    # ─── New endpoints ───
    log_section("Follow-up / Thank-you / Grace endpoints")
    try:
        d = generate_followup(sessions["kate"], CONTACTS["jen_recruiter"]["id"], "11-followup-no-news")
        results["11-followup-no-news"] = d
        if d.get("_status") == 200:
            assert_no_placeholders(d, "11-followup-no-news")
            assert_word_count(d, "11-followup-no-news", lo=10, hi=120)
            log_pass("Follow-up (no news) returned 200")
        else:
            log_fail(f"Follow-up (no news) HTTP {d.get('_status')} — endpoint may not be deployed yet")
    except Exception as e:
        log_fail(f"Follow-up (no news): {e}")

    try:
        d = generate_followup(sessions["kate"], CONTACTS["jen_recruiter"]["id"], "12-followup-with-news",
                              recent_news="Farmhand just announced their Series B funding round.")
        results["12-followup-with-news"] = d
        if d.get("_status") == 200:
            assert_contains(d, ["series b", "announced", "funding"], "12 followup news ref")
        else:
            log_fail(f"Follow-up (with news) HTTP {d.get('_status')}")
    except Exception as e:
        log_fail(f"Follow-up (with news): {e}")

    try:
        d = generate_thankyou(sessions["marco"], CONTACTS["emily_hm"]["id"], "13-marco-thankyou")
        results["13-marco-thankyou"] = d
        if d.get("_status") == 200:
            assert_no_placeholders(d, "13-marco-thankyou")
            log_pass("Thank-you returned 200")
        else:
            log_fail(f"Thank-you HTTP {d.get('_status')}")
    except Exception as e:
        log_fail(f"Thank-you: {e}")

    try:
        d = generate_grace(sessions["sam"], CONTACTS["holly_hm"]["id"], "14-sam-grace")
        results["14-sam-grace"] = d
        if d.get("_status") == 200:
            assert_no_placeholders(d, "14-sam-grace")
            log_pass("Grace note returned 200")
        else:
            log_fail(f"Grace note HTTP {d.get('_status')}")
    except Exception as e:
        log_fail(f"Grace note: {e}")

    # ─── Print previews ───
    log_section("Generated Email Previews (one per persona)")
    for label in ["01-sam-aha-hm", "03-avery-prosprous-hm", "05-kate-farmhand-hm",
                  "06-marco-petvisor-hm", "09-kate-knack-rec"]:
        if label in results and results[label].get("_status") == 200:
            print_preview(results[label], label)

    # ─── Summary ───
    log_section("Summary")
    total = passed + failed
    print(f"Total: {total}  {GREEN}Passed: {passed}{NC}  {RED}Failed: {failed}{NC}")
    if failures:
        print(f"\n{RED}Failures:{NC}")
        for f in failures:
            print(f"  - {f}")
    print(f"\nResults: {RESULTS_DIR}")
    return 0 if failed == 0 else 1

if __name__ == "__main__":
    sys.exit(main())
