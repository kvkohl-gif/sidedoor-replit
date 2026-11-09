#!/usr/bin/env python3
"""
SideDoor Apollo CLI — the thin data layer behind the sidedoor-* skills.

It only talks to Apollo (and optionally NeverBounce). All judgment — reading the
job posting, choosing who to search for, ranking candidates, drafting email —
is done by the model running the skill, not here.

Standard library only, so it runs anywhere Python 3.9+ does and honors
HTTPS_PROXY / SSL_CERT_FILE without extra setup.

Commands (all print JSON to stdout):
  org     --domain acme.com | --name "Acme" [--location "Boston, MA"]
  people  --org-id ID [--titles a,b] [--seniorities a,b] [--departments a,b]
          [--locations a,b] [--keywords "text"] [--per-page 25] [--page 1]
  enrich  --id APOLLO_PERSON_ID [--id ...]        (spends Apollo credits)
  verify  --email someone@acme.com [--email ...]  (needs NEVERBOUNCE_API_KEY)

Add --raw to any command to print Apollo's full response instead of the
trimmed view.

Auth: APOLLO_API_KEY env var. In a Claude Code cloud session the key is
injected by the network proxy instead, so a placeholder is sent when unset.
"""
import argparse
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request

BASE_URL = "https://api.apollo.io/api/v1"
TIMEOUT_SECONDS = 30


def fail(message, detail=None):
    out = {"error": message}
    if detail:
        out["detail"] = detail
    print(json.dumps(out, indent=2), file=sys.stderr)
    sys.exit(1)


def apollo(method, path, body=None, query=None):
    url = f"{BASE_URL}{path}"
    if query:
        url += "?" + urllib.parse.urlencode(query)
    data = json.dumps(body).encode() if body is not None else None
    request = urllib.request.Request(
        url,
        data=data,
        method=method,
        headers={
            "Content-Type": "application/json",
            "Cache-Control": "no-cache",
            "x-api-key": os.environ.get("APOLLO_API_KEY") or "proxy-injected",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=TIMEOUT_SECONDS) as response:
            return json.loads(response.read().decode() or "{}")
    except urllib.error.HTTPError as error:
        text = error.read().decode(errors="replace")[:1000]
        hint = None
        if error.code in (401, 403):
            hint = "Apollo rejected the key, the key is missing, or the network policy blocks api.apollo.io."
        elif error.code == 422:
            hint = "Apollo rejected the request parameters."
        elif error.code == 429:
            hint = "Apollo rate limit reached. Wait and retry."
        fail(f"Apollo returned HTTP {error.code} for {path}", {"hint": hint, "body": text})
    except urllib.error.URLError as error:
        fail(f"Could not reach Apollo for {path}", str(error.reason))


def split_list(value):
    return [item.strip() for item in value.split(",") if item.strip()] if value else []


# ── Trimmed views ────────────────────────────────────────────────────

def org_view(org):
    return {
        "id": org.get("id"),
        "name": org.get("name"),
        "primary_domain": org.get("primary_domain"),
        "website_url": org.get("website_url"),
        "employees": org.get("estimated_num_employees") or org.get("employees"),
        "industry": org.get("industry"),
        "location": ", ".join(
            part for part in (org.get("city"), org.get("state"), org.get("country")) if part
        ) or None,
        "description": (org.get("short_description") or "")[:300] or None,
    }


def person_view(person):
    last = person.get("last_name") or person.get("last_name_obfuscated") or ""
    name = person.get("name") or f"{person.get('first_name') or ''} {last}".strip()
    organization = person.get("organization") or {}
    return {
        "id": person.get("id"),
        "name": name,
        "title": person.get("title"),
        "headline": person.get("headline"),
        "seniority": person.get("seniority"),
        "departments": person.get("departments"),
        "subdepartments": person.get("subdepartments"),
        "functions": person.get("functions"),
        "location": ", ".join(
            part for part in (person.get("city"), person.get("state"), person.get("country")) if part
        ) or None,
        "linkedin_url": person.get("linkedin_url"),
        "has_email": person.get("has_email"),
        "organization": organization.get("name") or person.get("organization_name"),
    }


def enriched_view(person):
    view = person_view(person)
    organization = person.get("organization") or {}
    view.update({
        "email": person.get("email"),
        "email_status": person.get("email_status"),
        "organization_domain": organization.get("primary_domain"),
        "employment_history": [
            {
                "title": job.get("title"),
                "organization": job.get("organization_name"),
                "start": job.get("start_date"),
                "end": job.get("end_date"),
                "current": job.get("current"),
            }
            for job in (person.get("employment_history") or [])[:5]
        ],
    })
    return view


# ── Commands ─────────────────────────────────────────────────────────

def cmd_org(args):
    if args.domain:
        # Enrich handles alias domains that search misses, so prefer it.
        data = apollo("GET", "/organizations/enrich", query={"domain": args.domain})
        if args.raw:
            return data
        org = data.get("organization")
        return {"matched_by": "domain", "organizations": [org_view(org)] if org else []}
    if not args.name:
        fail("org needs --domain or --name")
    body = {"q_organization_name": args.name, "page": 1, "per_page": 10}
    if args.location:
        body["organization_locations"] = [args.location]
    data = apollo("POST", "/mixed_companies/search", body)
    if args.raw:
        return data
    orgs = data.get("organizations") or data.get("accounts") or []
    return {"matched_by": "name", "organizations": [org_view(org) for org in orgs]}


def cmd_people(args):
    body = {
        "organization_ids": [args.org_id],
        "page": args.page,
        "per_page": args.per_page,
    }
    for flag, field in (
        (args.titles, "person_titles"),
        (args.seniorities, "person_seniorities"),
        (args.departments, "person_departments"),
        (args.locations, "person_locations"),
    ):
        values = split_list(flag)
        if values:
            body[field] = values
    if args.keywords:
        body["q_keywords"] = args.keywords
    data = apollo("POST", "/mixed_people/api_search", body)
    if args.raw:
        return data
    people = (data.get("people") or []) + (data.get("contacts") or [])
    pagination = data.get("pagination") or {}
    return {
        "query": body,
        "total": data.get("total_entries") or pagination.get("total_entries"),
        "returned": len(people),
        "people": [person_view(person) for person in people],
    }


def cmd_enrich(args):
    results = []
    for person_id in args.id:
        # Work email only: personal addresses are never requested.
        data = apollo("POST", "/people/match", {"id": person_id, "reveal_personal_emails": False})
        if args.raw:
            results.append(data)
            continue
        person = data.get("person")
        results.append(enriched_view(person) if person else {"id": person_id, "error": "no match"})
    return {"people": results}


def cmd_verify(args):
    key = os.environ.get("NEVERBOUNCE_API_KEY")
    if not key:
        return {
            "configured": False,
            "note": "NEVERBOUNCE_API_KEY is not set. Rely on Apollo's email_status instead.",
        }
    results = []
    for email in args.email:
        url = "https://api.neverbounce.com/v4/single/check?" + urllib.parse.urlencode(
            {"key": key, "email": email}
        )
        try:
            with urllib.request.urlopen(url, timeout=TIMEOUT_SECONDS) as response:
                data = json.loads(response.read().decode())
            results.append({"email": email, "result": data.get("result"), "flags": data.get("flags")})
        except (urllib.error.HTTPError, urllib.error.URLError) as error:
            results.append({"email": email, "error": str(error)})
    return {"configured": True, "results": results}


def main():
    parser = argparse.ArgumentParser(description="SideDoor Apollo CLI")
    sub = parser.add_subparsers(dest="command", required=True)

    org = sub.add_parser("org", help="Resolve a company to an Apollo organization")
    org.add_argument("--domain")
    org.add_argument("--name")
    org.add_argument("--location")
    org.set_defaults(run=cmd_org)

    people = sub.add_parser("people", help="Search people at an organization")
    people.add_argument("--org-id", required=True)
    people.add_argument("--titles")
    people.add_argument("--seniorities")
    people.add_argument("--departments")
    people.add_argument("--locations")
    people.add_argument("--keywords")
    people.add_argument("--per-page", type=int, default=25)
    people.add_argument("--page", type=int, default=1)
    people.set_defaults(run=cmd_people)

    enrich = sub.add_parser("enrich", help="Reveal work email for chosen people (spends credits)")
    enrich.add_argument("--id", action="append", required=True)
    enrich.set_defaults(run=cmd_enrich)

    verify = sub.add_parser("verify", help="Verify emails with NeverBounce")
    verify.add_argument("--email", action="append", required=True)
    verify.set_defaults(run=cmd_verify)

    for command in (org, people, enrich, verify):
        command.add_argument("--raw", action="store_true", help="Print the full API response")

    args = parser.parse_args()
    print(json.dumps(args.run(args), indent=2))


if __name__ == "__main__":
    main()
