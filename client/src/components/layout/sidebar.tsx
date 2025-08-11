import { Link, useLocation } from "wouter";
import { useEffect, useState } from "react";
import { 
  Search, 
  Briefcase, 
  Users, 
  BarChart3,
  ChevronLeft,
  History
} from "lucide-react";
import { cn } from "@/lib/utils";

const navigationItems = [
  {
    key: "dashboard",
    title: "Dashboard",
    href: "/",
    icon: BarChart3,
  },
  {
    key: "search", 
    title: "Search",
    href: "/search",
    icon: Search,
  },
  {
    key: "history",
    title: "Job History", 
    href: "/dashboard",
    icon: History,
  },
  {
    key: "contacts",
    title: "Contacts",
    href: "/contacts", 
    icon: Users,
  }
];

interface SidebarProps {
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
}

export default function Sidebar({ collapsed: controlledCollapsed, onCollapsedChange }: SidebarProps) {
  const [location] = useLocation();
  
  // Internal state for collapsed when not controlled
  const [internalCollapsed, setInternalCollapsed] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("navCollapsed") === "true";
    }
    return false;
  });

  const collapsed = controlledCollapsed ?? internalCollapsed;
  
  const handleToggle = () => {
    const newCollapsed = !collapsed;
    if (onCollapsedChange) {
      onCollapsedChange(newCollapsed);
    } else {
      setInternalCollapsed(newCollapsed);
      localStorage.setItem("navCollapsed", String(newCollapsed));
    }
  };

  // Persist state changes to localStorage
  useEffect(() => {
    if (controlledCollapsed === undefined) {
      localStorage.setItem("navCollapsed", String(internalCollapsed));
    }
  }, [internalCollapsed, controlledCollapsed]);

  const sidebarWidth = collapsed ? "w-18" : "w-56"; // 72px vs 224px

  return (
    <nav 
      aria-label="Primary" 
      className={cn(
        sidebarWidth,
        "hidden sm:flex shrink-0 flex-col border-r border-gray-200 bg-white transition-[width] duration-200 ease-in-out relative"
      )}
    >
      {/* Brand */}
      <div className="flex items-center gap-2 px-3 py-3 border-b border-gray-200">
        <Link href="/">
          <div className="flex items-center gap-2 cursor-pointer">
            <div className="grid h-8 w-8 place-items-center rounded-xl bg-blue-600 text-white shrink-0">
              <Users className="h-4 w-4" />
            </div>
            {!collapsed && (
              <span className="text-sm font-semibold text-gray-900 truncate">
                Recruiter Finder
              </span>
            )}
          </div>
        </Link>
      </div>

      {/* Overhanging toggle button */}
      <button
        onClick={handleToggle}
        aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
        aria-pressed={collapsed}
        className="absolute top-[14px] -right-[14px] z-20 flex h-7 w-7 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 shadow-sm hover:bg-gray-50 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
        title={collapsed ? "Expand navigation" : "Collapse navigation"}
      >
        <ChevronLeft 
          className={cn(
            "h-4 w-4 transition-transform duration-200",
            collapsed ? "rotate-180" : ""
          )} 
        />
      </button>

      {/* MAIN header - only show when expanded */}
      {!collapsed && (
        <div className="px-3 pb-2 pt-4 text-[11px] uppercase tracking-wide text-gray-400 font-medium">
          Main
        </div>
      )}

      {/* Navigation Items */}
      <ul className="flex-1 space-y-1 px-2 py-2">
        {navigationItems.map((item) => {
          const isActive = location === item.href || 
            (item.href === "/" && location === "/") ||
            (item.href === "/dashboard" && location.startsWith("/submissions/"));
          
          return (
            <li key={item.key}>
              <Link href={item.href}>
                <div
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "group relative flex items-center rounded-lg px-2 py-2.5 text-sm font-medium transition-colors cursor-pointer",
                    collapsed ? "justify-center" : "gap-2",
                    isActive 
                      ? "bg-blue-50 text-blue-700" 
                      : "text-gray-700 hover:bg-gray-50 hover:text-gray-900",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                  )}
                  style={{ minHeight: "44px" }}
                >
                  {/* Active accent bar */}
                  {isActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-[3px] bg-blue-600 rounded-r" />
                  )}
                  
                  <item.icon 
                    className={cn(
                      "h-5 w-5 shrink-0",
                      collapsed ? "mx-auto" : "",
                      isActive ? "text-blue-600" : "text-gray-500"
                    )} 
                  />
                  
                  {!collapsed && (
                    <span className="truncate">{item.title}</span>
                  )}
                  
                  {/* Tooltip for collapsed state - could be enhanced with a proper tooltip component */}
                  {collapsed && (
                    <span className="sr-only">{item.title}</span>
                  )}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>


    </nav>
  );
}