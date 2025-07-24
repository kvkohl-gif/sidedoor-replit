import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, Circle, CheckCircle, Clock, AlertCircle, XCircle, Calendar } from "lucide-react";

export type StatusType = "not_contacted" | "email_sent" | "awaiting_reply" | "follow_up_needed" | "rejected" | "interview_scheduled";

interface StatusConfig {
  label: string;
  color: string;
  bgColor: string;
  icon: React.ReactNode;
}

const statusConfigs: Record<StatusType, StatusConfig> = {
  not_contacted: {
    label: "Not Contacted",
    color: "text-slate-600",
    bgColor: "bg-slate-100",
    icon: <Circle className="w-3 h-3" />
  },
  email_sent: {
    label: "Email Sent",
    color: "text-blue-600",
    bgColor: "bg-blue-100",
    icon: <CheckCircle className="w-3 h-3" />
  },
  awaiting_reply: {
    label: "Awaiting Reply",
    color: "text-yellow-600",
    bgColor: "bg-yellow-100",
    icon: <Clock className="w-3 h-3" />
  },
  follow_up_needed: {
    label: "Follow-Up Needed",
    color: "text-orange-600",
    bgColor: "bg-orange-100",
    icon: <AlertCircle className="w-3 h-3" />
  },
  rejected: {
    label: "Rejected",
    color: "text-red-600",
    bgColor: "bg-red-100",
    icon: <XCircle className="w-3 h-3" />
  },
  interview_scheduled: {
    label: "Interview Scheduled",
    color: "text-emerald-600",
    bgColor: "bg-emerald-100",
    icon: <Calendar className="w-3 h-3" />
  }
};

interface StatusDropdownProps {
  status: StatusType;
  onStatusChange: (status: StatusType) => void;
  disabled?: boolean;
  compact?: boolean;
}

export function StatusDropdown({ status, onStatusChange, disabled = false, compact = false }: StatusDropdownProps) {
  const [open, setOpen] = useState(false);
  const currentConfig = statusConfigs[status];

  if (compact) {
    return (
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" disabled={disabled} className="h-6 px-2">
            <div className={`flex items-center space-x-1 ${currentConfig.color}`}>
              {currentConfig.icon}
              <span className="text-xs">{currentConfig.label}</span>
              <ChevronDown className="w-3 h-3" />
            </div>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          {Object.entries(statusConfigs).map(([key, config]) => (
            <DropdownMenuItem
              key={key}
              onClick={() => {
                onStatusChange(key as StatusType);
                setOpen(false);
              }}
            >
              <div className={`flex items-center space-x-2 ${config.color}`}>
                {config.icon}
                <span>{config.label}</span>
              </div>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled} className="h-8">
          <Badge variant="secondary" className={`${currentConfig.bgColor} ${currentConfig.color} mr-2`}>
            <div className="flex items-center space-x-1">
              {currentConfig.icon}
              <span>{currentConfig.label}</span>
            </div>
          </Badge>
          <ChevronDown className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        {Object.entries(statusConfigs).map(([key, config]) => (
          <DropdownMenuItem
            key={key}
            onClick={() => {
              onStatusChange(key as StatusType);
              setOpen(false);
            }}
          >
            <div className={`flex items-center space-x-2 ${config.color}`}>
              {config.icon}
              <span>{config.label}</span>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function StatusBadge({ status }: { status: StatusType }) {
  const config = statusConfigs[status];
  
  return (
    <Badge variant="secondary" className={`${config.bgColor} ${config.color}`}>
      <div className="flex items-center space-x-1">
        {config.icon}
        <span>{config.label}</span>
      </div>
    </Badge>
  );
}