export const STATUS_COLORS: Record<string, { color: string; bg: string; dot: string; label?: string }> = {
  not_contacted:       { color: '#6b7280', bg: '#f3f4f6', dot: '#9ca3af', label: 'Not Contacted' },
  email_sent:          { color: '#2563eb', bg: '#eff6ff', dot: '#3b82f6', label: 'Emailed' },
  linkedin_sent:       { color: '#0a66c2', bg: '#f0f7ff', dot: '#0a66c2', label: 'LinkedIn Sent' },
  awaiting_reply:      { color: '#d97706', bg: '#fffbeb', dot: '#f59e0b', label: 'Awaiting Reply' },
  follow_up_needed:    { color: '#ea580c', bg: '#fff7ed', dot: '#f97316', label: 'Follow Up' },
  replied:             { color: '#7c3aed', bg: '#f5f3ff', dot: '#8b5cf6', label: 'Replied' },
  interview_scheduled: { color: '#059669', bg: '#ecfdf5', dot: '#10b981', label: 'Interview' },
  not_interested:      { color: '#dc2626', bg: '#fef2f2', dot: '#ef4444', label: 'Not Interested' },
};

export const JOB_STATUS_COLORS: Record<string, { color: string; bg: string; dot: string; border: string; label: string }> = {
  saved:            { color: '#6b7280', bg: '#f3f4f6', dot: '#9ca3af', border: '#e5e7eb', label: 'Saved' },
  applied:          { color: '#2563eb', bg: '#eff6ff', dot: '#3b82f6', border: '#bfdbfe', label: 'Applied' },
  reaching_out:     { color: '#d97706', bg: '#fffbeb', dot: '#f59e0b', border: '#fde68a', label: 'Reaching Out' },
  in_conversation:  { color: '#7c3aed', bg: '#f5f3ff', dot: '#8b5cf6', border: '#ddd6fe', label: 'In Conversation' },
  interviewing:     { color: '#059669', bg: '#ecfdf5', dot: '#10b981', border: '#a7f3d0', label: 'Interviewing' },
  closed:           { color: '#9ca3af', bg: '#f3f4f6', dot: '#d1d5db', border: '#e5e7eb', label: 'Closed' },
};

export const VERIFICATION_COLORS: Record<string, { color: string; bg: string; dot: string; label: string }> = {
  valid:    { color: '#059669', bg: '#ecfdf5', dot: '#10b981', label: 'Verified' },
  risky:    { color: '#d97706', bg: '#fffbeb', dot: '#f59e0b', label: 'Risky' },
  invalid:  { color: '#dc2626', bg: '#fef2f2', dot: '#ef4444', label: 'Invalid' },
  unknown:  { color: '#6b7280', bg: '#f3f4f6', dot: '#9ca3af', label: 'Unverified' },
};

export const LEGACY_STATUS_MAP: Record<string, string> = {
  not_contacted: 'saved',
  email_sent: 'reaching_out',
  awaiting_reply: 'reaching_out',
  follow_up_needed: 'reaching_out',
  interview_scheduled: 'interviewing',
  rejected: 'closed',
};

export function normalizeJobStatus(raw: string | null | undefined): string {
  const s = raw || 'saved';
  return LEGACY_STATUS_MAP[s] || (JOB_STATUS_COLORS[s] ? s : 'saved');
}

export function getContactStatusStyle(status: string | null | undefined) {
  const key = status || 'not_contacted';
  return STATUS_COLORS[key] || STATUS_COLORS.not_contacted;
}

export function getJobStatusStyle(status: string) {
  return JOB_STATUS_COLORS[status] || JOB_STATUS_COLORS.saved;
}

export function getVerificationStyle(status: string | null | undefined) {
  const key = status || 'unknown';
  return VERIFICATION_COLORS[key] || VERIFICATION_COLORS.unknown;
}
