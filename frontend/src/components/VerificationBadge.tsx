import { CheckCircle, XCircle, HelpCircle } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "./ui/tooltip";
import { getVerificationStyle } from "../lib/statusColors";

interface VerificationBadgeProps {
  status: string | null | undefined;
  size?: "sm" | "md";
  showLabel?: boolean;
}

const STATUS_ICONS: Record<string, typeof CheckCircle> = {
  valid: CheckCircle,
  risky: CheckCircle,
  invalid: XCircle,
  unknown: HelpCircle,
};

export function VerificationBadge({ status, size = "sm", showLabel = true }: VerificationBadgeProps) {
  const key = status || "unknown";
  const style = getVerificationStyle(key);
  const Icon = STATUS_ICONS[key] || HelpCircle;
  const iconSize = size === "sm" ? 12 : 14;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className="inline-flex items-center gap-1 cursor-default"
          style={{ color: style.dot }}
        >
          <Icon size={iconSize} style={{ color: style.color, flexShrink: 0 }} />
          {showLabel && (
            <span style={{ fontSize: size === "sm" ? 11 : 12, fontWeight: 500, color: style.color }}>
              {style.label}
            </span>
          )}
        </span>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        className="bg-gray-900 text-white text-xs px-3 py-2 rounded-lg max-w-[240px] leading-relaxed shadow-lg"
      >
        {style.tooltip}
      </TooltipContent>
    </Tooltip>
  );
}
