import { useState } from "react";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import { useOnboarding } from "../hooks/useOnboarding";

interface OnboardingChecklistProps {
  onNavigate: (page: string) => void;
}

const CHECKLIST_ITEMS = [
  { key: "account_created", label: "Created your account", page: "" },
  { key: "first_search", label: "Run your first search", page: "search" },
  { key: "first_contact_viewed", label: "View a contact", page: "contacts" },
  { key: "bio_added", label: "Add a short bio", page: "outreach-profile" },
  { key: "resume_uploaded", label: "Upload your resume", page: "outreach-profile" },
  { key: "first_message_generated", label: "Generate your first message", page: "" },
];

export default function OnboardingChecklist({ onNavigate }: OnboardingChecklistProps) {
  const [collapsed, setCollapsed] = useState(false);
  const { checklist, completionPercent, isComplete, isLoading } = useOnboarding();

  if (isLoading || isComplete) {
    return null;
  }

  const completedCount = CHECKLIST_ITEMS.filter((item) => checklist[item.key]).length;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-purple-100 text-purple-600 text-xs font-bold">
            {completedCount}/{CHECKLIST_ITEMS.length}
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-gray-800">Getting Started</p>
            <p className="text-xs text-gray-500">Complete your setup</p>
          </div>
        </div>
        {collapsed ? (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronUp className="w-4 h-4 text-gray-400" />
        )}
      </button>

      {/* Progress bar */}
      <div className="px-4 pb-2">
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-purple-600 rounded-full transition-all duration-500"
            style={{ width: `${completionPercent}%` }}
          />
        </div>
      </div>

      {/* Checklist items */}
      {!collapsed && (
        <div className="px-4 pb-4 space-y-1">
          {CHECKLIST_ITEMS.map((item) => {
            const done = checklist[item.key];
            return (
              <button
                key={item.key}
                onClick={() => {
                  if (!done && item.page) {
                    onNavigate(item.page);
                  }
                }}
                disabled={done || !item.page}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-sm transition-colors ${
                  done
                    ? "text-gray-400 cursor-default"
                    : "text-gray-700 hover:bg-purple-50 hover:text-purple-700"
                }`}
              >
                <div
                  className={`flex items-center justify-center w-5 h-5 rounded-full shrink-0 ${
                    done
                      ? "bg-purple-600 text-white"
                      : "border-2 border-gray-300"
                  }`}
                >
                  {done && <Check className="w-3 h-3" />}
                </div>
                <span className={done ? "line-through" : ""}>{item.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
