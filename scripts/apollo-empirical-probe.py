#!/usr/bin/env python3
"""
Apollo API empirical probe.

Captures actual behavior of /organizations/enrich and /mixed_companies/search
for a defined test matrix, so we can make data-driven decisions about which
endpoint to use in resolveCompanyViaApollo() instead of guessing.

USAGE:
    # Pull the Apollo key from Railway staging:
    export APOLLO_API_KEY=$(cd /Users/katelinkohl/Downloads/TheSideDoorFERework && \
        railway environment staging >/dev/null 2>&1 && \
        railway service sidedoor-replit >/dev/null 2>&1 && \
        railway run -- printenv APOLLO_API_KEY 2>/dev/null | tail -1)

    python3 scripts/apollo-empirical-probe.py

OUTPUT:
    scripts/apollo-empirical-probe-results-<timestamp>.json  (full request/response capture)
    Human-readable summary printed to stdout

The script runs a 4-group test matrix (see Plan file) totaling ~19 Apollo calls.
At Apollo's standard credit cost (~1 credit per org enrich, lower for search),
this is a cheap investment to nail down the actual behavior.
"""
import json
import os
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

try:
    import requests
except ImportError:
    print("Missing dependency: pip3 install requests")
    sys.exit(1)

APOLLO_API_KEY = os.environ.get("APOLLO_API_KEY", "").strip()
if not APOLLO_API_KEY:
    print("❌ APOLLO_API_KEY env var is not set.")
    print("   Pull it from Railway staging:")
    print("     railway environment staging && railway service sidedoor-replit && \\")
    print("     APOLLO_API_KEY=$(railway run -- printenv APOLLO_API_KEY) python3 scripts/apollo-empirical-probe.py")
    sys.exit(1)

BASE_URL = "https://api.apollo.io/api/v1"
TIMESTAMP = datetime.now().strftime("%Y%m%d-%H%M%S")
RESULTS_PATH = Path(f"scripts/apollo-empirical-probe-results-{TIMESTAMP}.json")

# ANSI colors
GREEN = "\033[0;32m"
RED = "\033[0;31m"
YELLOW = "\033[0;33m"
BLUE = "\033[0;34m"
DIM = "\033[2m"
NC = "\033[0m"


def call_enrich(domain: Optional[str] = None, name: Optional[str] = None) -> Dict[str, Any]:
    """Call /organizations/enrich. Domain is the only documented input but we test name too."""
    params: Dict[str, str] = {}
    if domain:
        params["domain"] = domain
    if name:
        params["name"] = name  # per docs, ignored — but we test anyway

    t0 = time.time()
    try:
        r = requests.get(
            f"{BASE_URL}/organizations/enrich",
            params=params,
            headers={"Cache-Control": "no-cache", "x-api-key": APOLLO_API_KEY},
            timeout=15,
        )
        elapsed_ms = int((time.time() - t0) * 1000)
        try:
            body = r.json()
        except Exception:
            body = {"_raw": r.text[:500]}
        return {
            "_endpoint": "GET /organizations/enrich",
            "_inputs": {k: v for k, v in params.items()},
            "_status": r.status_code,
            "_elapsed_ms": elapsed_ms,
            "response": body,
        }
    except Exception as e:
        return {
            "_endpoint": "GET /organizations/enrich",
            "_inputs": params,
            "_error": str(e),
        }


def call_search(body: Dict[str, Any]) -> Dict[str, Any]:
    """Call /mixed_companies/search with a POST body of filters."""
    full_body = {"page": 1, "per_page": 10, **body}
    t0 = time.time()
    try:
        r = requests.post(
            f"{BASE_URL}/mixed_companies/search",
            json=full_body,
            headers={
                "Content-Type": "application/json",
                "Cache-Control": "no-cache",
                "x-api-key": APOLLO_API_KEY,
            },
            timeout=20,
        )
        elapsed_ms = int((time.time() - t0) * 1000)
        try:
            data = r.json()
        except Exception:
            data = {"_raw": r.text[:500]}
        return {
            "_endpoint": "POST /mixed_companies/search",
            "_inputs": body,
            "_status": r.status_code,
            "_elapsed_ms": elapsed_ms,
            "response": data,
        }
    except Exception as e:
        return {
            "_endpoint": "POST /mixed_companies/search",
            "_inputs": body,
            "_error": str(e),
        }


def summarize_enrich(r: Dict[str, Any]) -> str:
    status = r.get("_status", "?")
    resp = r.get("response", {}) or {}
    org = resp.get("organization") if isinstance(resp, dict) else None
    if not org:
        err = resp.get("error") or resp.get("message") or "no organization in response"
        return f"{RED}status={status}{NC} — {err}"
    name = org.get("name", "?")
    dom = org.get("primary_domain") or org.get("website_url", "?")
    emp = org.get("estimated_num_employees") or org.get("employees", "?")
    loc = org.get("city") or org.get("state") or org.get("country") or "?"
    return (
        f"{GREEN}status={status}{NC} · {name} ({dom}) · emp={emp} · loc={loc}"
    )


def summarize_search(r: Dict[str, Any]) -> str:
    status = r.get("_status", "?")
    resp = r.get("response", {}) or {}
    orgs = resp.get("organizations") or resp.get("accounts") or []
    count = len(orgs) if isinstance(orgs, list) else 0
    pagination = resp.get("pagination", {}) if isinstance(resp, dict) else {}
    total = pagination.get("total_entries") or pagination.get("total") or count
    if count == 0:
        return f"{YELLOW}status={status}{NC} · 0 results"
    lines = [f"{GREEN}status={status}{NC} · {count} shown / {total} total"]
    for i, org in enumerate(orgs[:3], 1):
        name = org.get("name", "?")
        dom = org.get("primary_domain") or org.get("website_url", "?")
        emp = org.get("estimated_num_employees") or org.get("employees", "?")
        city = org.get("city")
        state = org.get("state")
        country = org.get("country")
        loc = ", ".join([x for x in [city, state, country] if x]) or "?"
        lines.append(f"      {DIM}#{i}{NC} {name} ({dom}) · emp={emp} · {loc}")
    return "\n".join(lines)


# ─── Test matrix ─────────────────────────────────────────────────────────────

def run_matrix() -> Dict[str, Any]:
    results: Dict[str, Any] = {}

    def log_header(label: str):
        print(f"\n{BLUE}━━━ {label} ━━━{NC}")

    # Group A — Town of Andover (the smoking gun)
    log_header("Group A — Town of Andover")

    print(f"{DIM}A1{NC} enrich(domain=andoverma.gov)")
    r = call_enrich(domain="andoverma.gov")
    print(f"     → {summarize_enrich(r)}")
    results["A1_enrich_andoverma_gov"] = r

    print(f"{DIM}A2{NC} enrich(domain=andoverma.us)")
    r = call_enrich(domain="andoverma.us")
    print(f"     → {summarize_enrich(r)}")
    results["A2_enrich_andoverma_us"] = r

    print(f"{DIM}A3{NC} enrich(domain=townofandover.com)")
    r = call_enrich(domain="townofandover.com")
    print(f"     → {summarize_enrich(r)}")
    results["A3_enrich_townofandover_com"] = r

    print(f"{DIM}A4{NC} search(q_organization_domains_list=['andoverma.gov'])")
    r = call_search({"q_organization_domains_list": ["andoverma.gov"]})
    print(f"     → {summarize_search(r)}")
    results["A4_search_domains_gov"] = r

    print(f"{DIM}A5{NC} search(q_organization_domains_list=['andoverma.us'])")
    r = call_search({"q_organization_domains_list": ["andoverma.us"]})
    print(f"     → {summarize_search(r)}")
    results["A5_search_domains_us"] = r

    print(f"{DIM}A6{NC} search(q_organization_name='Town of Andover')")
    r = call_search({"q_organization_name": "Town of Andover"})
    print(f"     → {summarize_search(r)}")
    results["A6_search_name_only"] = r

    print(f"{DIM}A7{NC} search(name + locations=['Andover, Massachusetts'])")
    r = call_search({
        "q_organization_name": "Town of Andover",
        "organization_locations": ["Andover, Massachusetts"],
    })
    print(f"     → {summarize_search(r)}")
    results["A7_search_name_plus_location"] = r

    print(f"{DIM}A8{NC} search(name + domain=andoverma.gov)  [AND/OR test]")
    r = call_search({
        "q_organization_name": "Town of Andover",
        "q_organization_domains_list": ["andoverma.gov"],
    })
    print(f"     → {summarize_search(r)}")
    results["A8_search_name_plus_domain_gov"] = r

    print(f"{DIM}A9{NC} search(name + domain=andoverma.us)")
    r = call_search({
        "q_organization_name": "Town of Andover",
        "q_organization_domains_list": ["andoverma.us"],
    })
    print(f"     → {summarize_search(r)}")
    results["A9_search_name_plus_domain_us"] = r

    # Group B — Known good baseline
    log_header("Group B — Apollo itself")

    print(f"{DIM}B1{NC} enrich(domain=apollo.io)")
    r = call_enrich(domain="apollo.io")
    print(f"     → {summarize_enrich(r)}")
    results["B1_enrich_apollo_io"] = r

    print(f"{DIM}B2{NC} search(q_organization_domains_list=['apollo.io'])")
    r = call_search({"q_organization_domains_list": ["apollo.io"]})
    print(f"     → {summarize_search(r)}")
    results["B2_search_apollo_io"] = r

    print(f"{DIM}B3{NC} search(q_organization_name='Apollo')  [no location]")
    r = call_search({"q_organization_name": "Apollo"})
    print(f"     → {summarize_search(r)}")
    results["B3_search_apollo_ambiguous"] = r

    print(f"{DIM}B4{NC} search(name='Apollo', locations=['San Francisco'])")
    r = call_search({
        "q_organization_name": "Apollo",
        "organization_locations": ["San Francisco"],
    })
    print(f"     → {summarize_search(r)}")
    results["B4_search_apollo_narrowed"] = r

    # Group C — Aliases and subsidiaries
    log_header("Group C — Aliases & subsidiaries")

    print(f"{DIM}C1{NC} enrich(domain=google.com)")
    r = call_enrich(domain="google.com")
    print(f"     → {summarize_enrich(r)}")
    results["C1_enrich_google_com"] = r

    print(f"{DIM}C2{NC} search(q_organization_name='Alphabet')")
    r = call_search({"q_organization_name": "Alphabet"})
    print(f"     → {summarize_search(r)}")
    results["C2_search_alphabet"] = r

    print(f"{DIM}C3{NC} enrich(domain=youtube.com)")
    r = call_enrich(domain="youtube.com")
    print(f"     → {summarize_enrich(r)}")
    results["C3_enrich_youtube_com"] = r

    print(f"{DIM}C4{NC} search(q_organization_name='YouTube')")
    r = call_search({"q_organization_name": "YouTube"})
    print(f"     → {summarize_search(r)}")
    results["C4_search_youtube"] = r

    # Group D — TLD robustness
    log_header("Group D — TLD robustness (MIT)")

    print(f"{DIM}D1{NC} enrich(domain=mit.edu)")
    r = call_enrich(domain="mit.edu")
    print(f"     → {summarize_enrich(r)}")
    results["D1_enrich_mit_edu"] = r

    print(f"{DIM}D2{NC} enrich(domain=mit.org)  [expected: 404 / not found]")
    r = call_enrich(domain="mit.org")
    print(f"     → {summarize_enrich(r)}")
    results["D2_enrich_mit_org"] = r

    print(f"{DIM}D3{NC} search(q_organization_domains_list=['mit.edu'])")
    r = call_search({"q_organization_domains_list": ["mit.edu"]})
    print(f"     → {summarize_search(r)}")
    results["D3_search_mit_edu"] = r

    return results


def write_results(results: Dict[str, Any]) -> None:
    RESULTS_PATH.parent.mkdir(parents=True, exist_ok=True)
    RESULTS_PATH.write_text(json.dumps(results, indent=2, default=str))
    print(f"\n{GREEN}✓{NC} Full results written to: {RESULTS_PATH}")


def print_analysis_hints(results: Dict[str, Any]) -> None:
    """Print the specific cross-checks needed to answer the plan's Analysis Questions."""
    print(f"\n{BLUE}━━━ Analysis hints ━━━{NC}")

    # Q2: filter composition AND vs OR
    a4_count = len((results.get("A4_search_domains_gov", {}).get("response") or {}).get("organizations") or [])
    a8_count = len((results.get("A8_search_name_plus_domain_gov", {}).get("response") or {}).get("organizations") or [])
    a6_count = len((results.get("A6_search_name_only", {}).get("response") or {}).get("organizations") or [])

    print(f"Q2 (filter AND vs OR):")
    print(f"   A4 (domain only, gov):       {a4_count} results")
    print(f"   A6 (name only):              {a6_count} results")
    print(f"   A8 (name + domain):          {a8_count} results")
    if a4_count == 0 and a8_count == 0:
        print(f"   → {GREEN}AND semantics confirmed{NC} (domain filter zeros out the name hits)")
    elif a8_count >= a6_count:
        print(f"   → {YELLOW}OR-like: filter adds rather than restricts{NC}")
    elif a4_count < a8_count < a6_count:
        print(f"   → {YELLOW}Mixed/reranking: inconclusive{NC}")
    else:
        print(f"   → {GREEN}Looks like AND: combined is smaller than both individual results{NC}")

    # Q3: enrich proprietary value
    c1 = (results.get("C1_enrich_google_com", {}).get("response") or {}).get("organization") or {}
    c1_name = c1.get("name", "?")
    print(f"\nQ3 (enrich alias resolution):")
    print(f"   C1 enrich(google.com) → {c1_name}")
    if "alphabet" in c1_name.lower():
        print(f"   → {GREEN}Enrich DOES resolve to parent company{NC}")
    elif "google" in c1_name.lower():
        print(f"   → {YELLOW}Enrich returns Google directly, no parent resolution{NC}")

    # Q4: TLD robustness
    d2 = (results.get("D2_enrich_mit_org", {}).get("response") or {}).get("organization")
    print(f"\nQ4 (TLD robustness):")
    if d2:
        print(f"   D2 enrich(mit.org) → {d2.get('name', '?')} {YELLOW}(unexpected: Apollo returned something){NC}")
    else:
        print(f"   D2 enrich(mit.org) → no match → {GREEN}TLD retry IS necessary{NC}")

    # Q1: Town of Andover bug cause
    print(f"\nQ1 (Town of Andover root cause):")
    for key in [
        "A1_enrich_andoverma_gov",
        "A2_enrich_andoverma_us",
        "A4_search_domains_gov",
        "A5_search_domains_us",
        "A7_search_name_plus_location",
    ]:
        r = results.get(key, {})
        endpoint = r.get("_endpoint", "?").split("/")[-1]
        status = r.get("_status", "?")
        if "enrich" in endpoint.lower():
            s = summarize_enrich(r)
        else:
            s = summarize_search(r)
        s = s.split("\n")[0]  # first line only
        print(f"   {key}: {s}")


if __name__ == "__main__":
    print(f"{BLUE}━━━ Apollo empirical probe ━━━{NC}")
    print(f"API key: {APOLLO_API_KEY[:8]}…{APOLLO_API_KEY[-4:]}  ({len(APOLLO_API_KEY)} chars)")
    print(f"Running {19} probes across 4 test groups…")

    results = run_matrix()
    write_results(results)
    print_analysis_hints(results)
