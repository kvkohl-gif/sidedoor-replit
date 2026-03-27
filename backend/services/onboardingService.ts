import { supabaseAdmin } from "../lib/supabaseClient";

interface OnboardingChecklist {
  account_created?: boolean;
  first_search?: boolean;
  first_contact_viewed?: boolean;
  bio_added?: boolean;
  resume_uploaded?: boolean;
  first_message_generated?: boolean;
}

const CHECKLIST_KEYS: (keyof OnboardingChecklist)[] = [
  "account_created",
  "first_search",
  "first_contact_viewed",
  "bio_added",
  "resume_uploaded",
  "first_message_generated",
];

const TIPS: Record<keyof OnboardingChecklist, string> = {
  account_created: "Create your account to get started.",
  first_search: "Run your first search to find contacts at target companies.",
  first_contact_viewed: "View a contact to see their details and email.",
  bio_added: "Add a bio to personalize your outreach messages.",
  resume_uploaded: "Upload your resume so AI can tailor messages for you.",
  first_message_generated: "Generate your first AI outreach message.",
};

function computeCompletionPercent(checklist: OnboardingChecklist): number {
  const completed = CHECKLIST_KEYS.filter((key) => checklist[key] === true).length;
  return Math.round((completed / CHECKLIST_KEYS.length) * 100 * 10) / 10;
}

function getNextTip(checklist: OnboardingChecklist): string | null {
  for (const key of CHECKLIST_KEYS) {
    if (!checklist[key]) {
      return TIPS[key];
    }
  }
  return null;
}

function allItemsComplete(checklist: OnboardingChecklist): boolean {
  return CHECKLIST_KEYS.every((key) => checklist[key] === true);
}

export async function getOnboardingState(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("users")
    .select("onboarding_checklist, onboarding_completed_at")
    .eq("id", userId)
    .single();

  if (error) {
    throw new Error(`Failed to fetch onboarding state: ${error.message}`);
  }

  const checklist: OnboardingChecklist = (data.onboarding_checklist as OnboardingChecklist) || {};
  const completedAt: string | null = data.onboarding_completed_at;

  return {
    checklist,
    completedAt,
    completionPercent: computeCompletionPercent(checklist),
    nextTip: getNextTip(checklist),
  };
}

export async function markChecklistItem(
  userId: string,
  item: keyof OnboardingChecklist
) {
  // Fetch current checklist
  const { data: current, error: fetchError } = await supabaseAdmin
    .from("users")
    .select("onboarding_checklist")
    .eq("id", userId)
    .single();

  if (fetchError) {
    throw new Error(`Failed to fetch checklist: ${fetchError.message}`);
  }

  const checklist: OnboardingChecklist = {
    ...((current.onboarding_checklist as OnboardingChecklist) || {}),
    [item]: true,
  };

  const updatePayload: Record<string, unknown> = {
    onboarding_checklist: checklist,
  };

  if (allItemsComplete(checklist)) {
    updatePayload.onboarding_completed_at = new Date().toISOString();
  }

  const { error: updateError } = await supabaseAdmin
    .from("users")
    .update(updatePayload)
    .eq("id", userId);

  if (updateError) {
    throw new Error(`Failed to update checklist: ${updateError.message}`);
  }

  return {
    checklist,
    completedAt: updatePayload.onboarding_completed_at as string | null ?? null,
    completionPercent: computeCompletionPercent(checklist),
    nextTip: getNextTip(checklist),
  };
}

export async function isOnboardingComplete(userId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("users")
    .select("onboarding_completed_at")
    .eq("id", userId)
    .single();

  if (error) {
    throw new Error(`Failed to check onboarding status: ${error.message}`);
  }

  return data.onboarding_completed_at !== null;
}

export async function initializeOnboarding(userId: string): Promise<void> {
  const checklist: OnboardingChecklist = { account_created: true };

  const { error } = await supabaseAdmin
    .from("users")
    .update({ onboarding_checklist: checklist })
    .eq("id", userId);

  if (error) {
    throw new Error(`Failed to initialize onboarding: ${error.message}`);
  }
}
