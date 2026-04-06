#!/usr/bin/env bash
# ============================================================================
# Message Generation Test Runner
#
# Tests every template, field population, quality scoring, and edge case
# for the AI email generation framework against staging.
#
# Prerequisites:
#   1. Run scripts/seed-test-personas.sql against staging Supabase
#   2. jq installed (brew install jq)
#   3. STAGING_URL env var set (defaults to staging Railway URL)
#
# Usage:
#   bash scripts/test-message-generation.sh
#
# Output:
#   test-results/<timestamp>/ — full JSON responses + assertion log
#   PASS/FAIL summary printed to stdout
# ============================================================================

set -uo pipefail

STAGING_URL="${STAGING_URL:-https://sidedoor-replit-staging.up.railway.app}"
PASSWORD="TestPass123!"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
RESULTS_DIR="test-results/$TIMESTAMP"
mkdir -p "$RESULTS_DIR"

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PASS_COUNT=0
FAIL_COUNT=0
declare -a FAILURES

log_pass() { echo -e "${GREEN}✓${NC} $1"; PASS_COUNT=$((PASS_COUNT+1)); }
log_fail() { echo -e "${RED}✗${NC} $1"; FAIL_COUNT=$((FAIL_COUNT+1)); FAILURES+=("$1"); }
log_info() { echo -e "${BLUE}ℹ${NC} $1"; }
log_section() { echo -e "\n${YELLOW}━━━ $1 ━━━${NC}"; }

# ─── Test Fixtures (from seed-test-personas.sql output) ────────────────────

declare -A USER_EMAIL
USER_EMAIL[kate]="kate-test@sidedoor-test.com"
USER_EMAIL[marco]="marco-test@sidedoor-test.com"
USER_EMAIL[avery]="avery-test@sidedoor-test.com"
USER_EMAIL[sam]="sam-test@sidedoor-test.com"

# Contact IDs from seed (verified in DB)
ARI_FOUNDER=89          # Kate's Farmhand HM (origin story → A1)
JEN_RECRUITER=90        # Kate's Farmhand recruiter (B)
EMILY_HM=91             # Marco's Petvisor HM (lived experience → A2)
KOLBI_RECRUITER=92      # Marco's Petvisor recruiter (B)
TED_FOUNDER=93          # Avery's Prosprous HM (portfolio → C)
PAT_SOURCER=94          # Avery's Prosprous recruiter (portfolio overrides → C)
HOLLY_HM=95             # Sam's Aha! HM (mutual → D)
SARA_RECRUITER=96       # Sam's Aha! recruiter (mutual overrides → D)
DANA_RECRUITER=97       # Kate's Knack recruiter (B default)
QUINN_HM=98             # Kate's Knack HM (origin story → A1)

# ─── Helpers ────────────────────────────────────────────────────────────────

login_as() {
  local persona="$1"
  local email="${USER_EMAIL[$persona]}"
  local cookie_file="$RESULTS_DIR/cookies-$persona.txt"

  curl -s -c "$cookie_file" \
    -X POST "$STAGING_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$email\",\"password\":\"$PASSWORD\"}" \
    > "$RESULTS_DIR/login-$persona.json"

  if grep -q '"success":true\|"id"' "$RESULTS_DIR/login-$persona.json" 2>/dev/null; then
    return 0
  fi
  log_fail "Login failed for $persona ($email)"
  cat "$RESULTS_DIR/login-$persona.json"
  return 1
}

generate_message() {
  local persona="$1"
  local contact_id="$2"
  local label="$3"
  local override="${4:-}"

  local body='{}'
  if [[ -n "$override" ]]; then
    body="{\"templateOverride\":\"$override\"}"
  fi

  local out_file="$RESULTS_DIR/${label}.json"
  curl -s -b "$RESULTS_DIR/cookies-$persona.txt" \
    -X POST "$STAGING_URL/api/contacts/$contact_id/generate-message" \
    -H "Content-Type: application/json" \
    -d "$body" \
    > "$out_file"

  echo "$out_file"
}

generate_followup() {
  local persona="$1"
  local contact_id="$2"
  local label="$3"
  local recent_news="${4:-}"

  local body='{}'
  if [[ -n "$recent_news" ]]; then
    body=$(jq -nc --arg news "$recent_news" '{recentNews: $news}')
  fi

  local out_file="$RESULTS_DIR/${label}.json"
  curl -s -b "$RESULTS_DIR/cookies-$persona.txt" \
    -X POST "$STAGING_URL/api/contacts/$contact_id/generate-followup" \
    -H "Content-Type: application/json" \
    -d "$body" \
    > "$out_file"
  echo "$out_file"
}

generate_thankyou() {
  local persona="$1"
  local contact_id="$2"
  local label="$3"
  local body=$(jq -nc \
    --arg topic "the team's PLG approach" \
    --arg detail "the way you described the activation funnel" \
    --arg thought "I sketched a quick idea for cutting time-to-value in onboarding" \
    '{interviewTopic: $topic, interviewDetail: $detail, followUpThought: $thought}')

  local out_file="$RESULTS_DIR/${label}.json"
  curl -s -b "$RESULTS_DIR/cookies-$persona.txt" \
    -X POST "$STAGING_URL/api/contacts/$contact_id/generate-thankyou" \
    -H "Content-Type: application/json" \
    -d "$body" \
    > "$out_file"
  echo "$out_file"
}

generate_grace() {
  local persona="$1"
  local contact_id="$2"
  local label="$3"
  local out_file="$RESULTS_DIR/${label}.json"
  curl -s -b "$RESULTS_DIR/cookies-$persona.txt" \
    -X POST "$STAGING_URL/api/contacts/$contact_id/generate-rejection-grace" \
    -H "Content-Type: application/json" -d '{}' \
    > "$out_file"
  echo "$out_file"
}

# ─── Assertions ─────────────────────────────────────────────────────────────

assert_template() {
  local file="$1"
  local expected="$2"
  local label="$3"
  local actual=$(jq -r '.templateUsed // "ERROR"' "$file")
  if [[ "$actual" == "$expected" ]]; then
    log_pass "[$label] template = $actual"
  else
    log_fail "[$label] template = $actual (expected $expected)"
  fi
}

assert_no_placeholders() {
  local file="$1"
  local label="$2"
  local body=$(jq -r '.emailContent // ""' "$file")
  if echo "$body" | grep -qiE '\[your name\]|\{\{|\[first name\]'; then
    log_fail "[$label] PLACEHOLDER LEAK in body"
    return
  fi
  log_pass "[$label] no placeholders"
}

assert_signature_first_name() {
  local file="$1"
  local first_name="$2"
  local label="$3"
  local body=$(jq -r '.emailContent // ""' "$file")
  if echo "$body" | grep -q "$first_name"; then
    log_pass "[$label] signature includes '$first_name'"
  else
    log_fail "[$label] signature missing '$first_name'"
  fi
}

assert_company_present() {
  local file="$1"
  local company="$2"
  local label="$3"
  local subject=$(jq -r '.emailSubject // ""' "$file")
  local body=$(jq -r '.emailContent // ""' "$file")
  if echo "$subject $body" | grep -qi "$company"; then
    log_pass "[$label] company '$company' referenced"
  else
    log_fail "[$label] company '$company' MISSING"
  fi
}

assert_contains_text() {
  local file="$1"
  local needle="$2"
  local label="$3"
  local body=$(jq -r '.emailContent // ""' "$file")
  if echo "$body" | grep -qi "$needle"; then
    log_pass "[$label] body contains '$needle'"
  else
    log_fail "[$label] body MISSING '$needle'"
  fi
}

assert_no_banned_phrases() {
  local file="$1"
  local label="$2"
  local body=$(jq -r '.emailContent // ""' "$file" | tr '[:upper:]' '[:lower:]')
  local banned=("i hope this finds you well" "passionate about" "i'm thrilled" "exciting opportunity" "i believe i would be a great fit" "to whom it may concern")
  local found=""
  for phrase in "${banned[@]}"; do
    if echo "$body" | grep -q "$phrase"; then
      found="$found '$phrase'"
    fi
  done
  if [[ -z "$found" ]]; then
    log_pass "[$label] no banned phrases"
  else
    log_fail "[$label] banned phrase(s) found:$found"
  fi
}

assert_word_count() {
  local file="$1"
  local label="$2"
  local body=$(jq -r '.emailContent // ""' "$file")
  local words=$(echo "$body" | wc -w | tr -d ' ')
  if [[ $words -ge 60 && $words -le 180 ]]; then
    log_pass "[$label] word count = $words"
  else
    log_fail "[$label] word count = $words (expected 60-180)"
  fi
}

assert_quality_score() {
  local file="$1"
  local min="$2"
  local label="$3"
  local score=$(jq -r '.qualityScore // 0' "$file")
  if (( score >= min )); then
    log_pass "[$label] qualityScore = $score (≥ $min)"
  else
    local warnings=$(jq -r '.qualityWarnings // [] | join("; ")' "$file")
    log_fail "[$label] qualityScore = $score (expected ≥ $min). Warnings: $warnings"
  fi
}

print_email_preview() {
  local file="$1"
  local label="$2"
  echo -e "\n${BLUE}── $label ──${NC}"
  echo "Template: $(jq -r '.templateUsed // "?"' "$file")"
  echo "Score:    $(jq -r '.qualityScore // "?"' "$file")/12"
  echo "Subject:  $(jq -r '.emailSubject // ""' "$file")"
  echo ""
  jq -r '.emailContent // ""' "$file" | sed 's/^/  /'
  echo ""
  local warnings=$(jq -r '.qualityWarnings // [] | join("; ")' "$file")
  if [[ -n "$warnings" ]]; then
    echo "Warnings: $warnings"
  fi
}

# ═══════════════════════════════════════════════════════════════════════════
# RUN TESTS
# ═══════════════════════════════════════════════════════════════════════════

echo -e "${BLUE}━━━ Message Generation Test Suite ━━━${NC}"
echo "Staging URL: $STAGING_URL"
echo "Results:     $RESULTS_DIR"

# ─── Login all 4 personas ───
log_section "Login"
for p in kate marco avery sam; do
  if login_as "$p"; then
    log_pass "Login as $p"
  fi
done

# ─── Template Selection Tests ───
log_section "Template Selection Logic"

# Test 1: Sam → Aha! HM → mutual connection wins → D
F=$(generate_message sam $HOLLY_HM "01-sam-aha-hm")
assert_template "$F" "D_mutual_connection" "Sam→Holly (mutual)"

# Test 2: Sam → Aha! Recruiter → mutual still wins even with recruiter → D
F=$(generate_message sam $SARA_RECRUITER "02-sam-aha-recruiter")
assert_template "$F" "D_mutual_connection" "Sam→Sara (mutual beats recruiter)"

# Test 3: Avery → Prosprous HM → portfolio match → C
F=$(generate_message avery $TED_FOUNDER "03-avery-prosprous-hm")
assert_template "$F" "C_prototype" "Avery→Ted (portfolio)"

# Test 4: Avery → Prosprous Recruiter → portfolio still wins → C
F=$(generate_message avery $PAT_SOURCER "04-avery-prosprous-recruiter")
assert_template "$F" "C_prototype" "Avery→Pat (portfolio beats recruiter)"

# Test 5: Kate → Farmhand HM → origin story hook + matching domain → A1
F=$(generate_message kate $ARI_FOUNDER "05-kate-farmhand-hm")
assert_template "$F" "A1_origin_story" "Kate→Ari (origin story)"

# Test 6: Marco → Petvisor HM → lived experience hook → A2
F=$(generate_message marco $EMILY_HM "06-marco-petvisor-hm")
assert_template "$F" "A2_lived_experience" "Marco→Emily (lived experience)"

# Test 7: Kate → Farmhand Recruiter → recruiter beats hook → B
F=$(generate_message kate $JEN_RECRUITER "07-kate-farmhand-recruiter")
assert_template "$F" "B_recruiter" "Kate→Jen (recruiter beats origin)"

# Test 8: Marco → Petvisor Recruiter → recruiter beats hook → B
F=$(generate_message marco $KOLBI_RECRUITER "08-marco-petvisor-recruiter")
assert_template "$F" "B_recruiter" "Marco→Kolbi (recruiter beats lived)"

# Test 9: Kate → Knack Recruiter → no domain match → B
F=$(generate_message kate $DANA_RECRUITER "09-kate-knack-recruiter")
assert_template "$F" "B_recruiter" "Kate→Dana (default recruiter)"

# Test 10: Override test — force C even though no portfolio match
F=$(generate_message kate $QUINN_HM "10-kate-knack-override-A1" "A1_origin_story")
assert_template "$F" "A1_origin_story" "Kate→Quinn (override A1)"

# ─── Field Population Tests ───
log_section "Field Population (no placeholders, real names)"

for f in "$RESULTS_DIR"/{01,02,03,04,05,06,07,08,09,10}-*.json; do
  base=$(basename "$f" .json)
  assert_no_placeholders "$f" "$base"
done

# Verify each persona's first name shows up in their emails
for f in "$RESULTS_DIR"/0{1,2}-sam-*.json;    do assert_signature_first_name "$f" "Sam" "$(basename $f .json)"; done
for f in "$RESULTS_DIR"/0{3,4}-avery-*.json;  do assert_signature_first_name "$f" "Avery" "$(basename $f .json)"; done
for f in "$RESULTS_DIR"/{05,07,09,10}-kate-*.json; do assert_signature_first_name "$f" "Kate" "$(basename $f .json)"; done
for f in "$RESULTS_DIR"/0{6,8}-marco-*.json;  do assert_signature_first_name "$f" "Marco" "$(basename $f .json)"; done

# Verify company names appear
assert_company_present "$RESULTS_DIR/01-sam-aha-hm.json" "aha" "Sam→Holly company"
assert_company_present "$RESULTS_DIR/03-avery-prosprous-hm.json" "prosprous" "Avery→Ted company"
assert_company_present "$RESULTS_DIR/05-kate-farmhand-hm.json" "farmhand" "Kate→Ari company"
assert_company_present "$RESULTS_DIR/06-marco-petvisor-hm.json" "petvisor" "Marco→Emily company"
assert_company_present "$RESULTS_DIR/09-kate-knack-recruiter.json" "knack" "Kate→Dana company"

# Template-specific content checks
assert_contains_text "$RESULTS_DIR/01-sam-aha-hm.json" "stephanie" "Sam→Holly mutual name"
assert_contains_text "$RESULTS_DIR/03-avery-prosprous-hm.json" "pigebank\|prototype\|figma" "Avery→Ted prototype reference"
assert_contains_text "$RESULTS_DIR/05-kate-farmhand-hm.json" "farm\|grew up\|cattle\|hay" "Kate→Ari origin hook"
assert_contains_text "$RESULTS_DIR/06-marco-petvisor-hm.json" "pet\|dog\|customer\|user" "Marco→Emily lived hook"

# ─── Anti-pattern detection ───
log_section "Anti-pattern Detection"
for f in "$RESULTS_DIR"/{01,02,03,04,05,06,07,08,09,10}-*.json; do
  assert_no_banned_phrases "$f" "$(basename $f .json)"
done

# ─── Word count ───
log_section "Word Count (60-180)"
for f in "$RESULTS_DIR"/{01,02,03,04,05,06,07,08,09,10}-*.json; do
  assert_word_count "$f" "$(basename $f .json)"
done

# ─── Quality scoring ───
log_section "Quality Scoring (≥ 6/12)"
for f in "$RESULTS_DIR"/{01,02,03,04,05,06,07,08,09,10}-*.json; do
  assert_quality_score "$f" 6 "$(basename $f .json)"
done

# ─── New endpoints ───
log_section "Follow-up / Thank-you / Grace endpoints"

F=$(generate_followup kate $JEN_RECRUITER "11-kate-followup-no-news")
assert_template "$F" "E_followup" "Followup (no news)"
assert_no_placeholders "$F" "11-followup-no-news"

F=$(generate_followup kate $JEN_RECRUITER "12-kate-followup-with-news" "Farmhand just announced their Series B funding round.")
assert_template "$F" "E_followup" "Followup (with news)"
assert_contains_text "$F" "series b\|announced\|funding" "Followup recent news reference"

F=$(generate_thankyou marco $EMILY_HM "13-marco-thankyou")
assert_template "$F" "F_thank_you" "Thank-you"
assert_no_placeholders "$F" "13-marco-thankyou"

F=$(generate_grace sam $HOLLY_HM "14-sam-grace")
assert_template "$F" "G_rejection_grace" "Rejection grace"
assert_no_placeholders "$F" "14-sam-grace"

# ─── Persona Differentiation Test ───
log_section "Persona Differentiation (same job, 4 personas)"
# All 4 personas generate for the same Knack recruiter contact (Dana)
# We check that the bodies are visibly different (no two are >70% similar)

# Note: Knack contacts belong to Kate's submission, so only Kate can hit Dana directly
# without ownership errors. We use Quinn (HM) override path instead.
# For a true differentiation test, we'd seed cross-user contacts or test in UI.
log_info "Persona differentiation requires manual review of files 01-10"

# ─── Print previews ───
log_section "Generated Email Previews"
for label in 01-sam-aha-hm 03-avery-prosprous-hm 05-kate-farmhand-hm 06-marco-petvisor-hm 09-kate-knack-recruiter; do
  if [[ -f "$RESULTS_DIR/$label.json" ]]; then
    print_email_preview "$RESULTS_DIR/$label.json" "$label"
  fi
done

# ─── Summary ───
log_section "Summary"
TOTAL=$((PASS_COUNT + FAIL_COUNT))
echo -e "Total: $TOTAL  ${GREEN}Passed: $PASS_COUNT${NC}  ${RED}Failed: $FAIL_COUNT${NC}"
if [[ $FAIL_COUNT -gt 0 ]]; then
  echo -e "\n${RED}Failures:${NC}"
  for f in "${FAILURES[@]}"; do
    echo "  - $f"
  done
fi
echo -e "\nResults saved to: ${BLUE}$RESULTS_DIR${NC}"

[[ $FAIL_COUNT -eq 0 ]]
