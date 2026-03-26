import { Home, Search, Clock, Users, Settings, CreditCard, User, Menu, X, ChevronRight, Plus, UserCircle, Key, LogOut } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

interface LayoutProps {
  children: React.ReactNode;
  currentPage: string;
  onNavigate: (page: string) => void;
  onLogout?: () => void;
  userName?: string;
}

export function Layout({ children, currentPage, onNavigate, onLogout, userName }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showLogoutMenu, setShowLogoutMenu] = useState(false);

  const { data: subscription } = useQuery<{
    plan_type: string;
    status: string;
    credits_remaining: number;
    credits_total: number;
    free_tier_expires_at: string | null;
  }>({
    queryKey: ["/api/billing/subscription"],
  });

  const navItems = [
    { icon: Home, label: "Dashboard", id: "dashboard" },
    { icon: Search, label: "New Search", id: "search" },
    { icon: Clock, label: "Job History", id: "job-history" },
    { icon: Users, label: "Contacts", id: "contacts" },
    { icon: UserCircle, label: "Outreach Profile", id: "outreach-profile" },
  ];

  const bottomNavItems = [
    { icon: Settings, label: "Settings", id: "settings" },
    { icon: CreditCard, label: "Plan and Billing", id: "billing" },
  ];

  return (
    <div className="flex h-screen bg-[#FAFBFC]">
      {/* Mobile Menu Button */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-white rounded-lg shadow-sm border border-[#E2E8F0]"
      >
        {sidebarOpen ? <X className="w-5 h-5 text-[#718096]" /> : <Menu className="w-5 h-5 text-[#718096]" />}
      </button>

      {/* Sidebar */}
      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-40
          w-64 bg-white border-r border-[#E2E8F0] shadow-[2px_0_8px_rgba(0,0,0,0.03)]
          transform transition-transform duration-200 ease-in-out
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="h-16 flex items-center px-6 border-b border-[#E2E8F0]">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 bg-gradient-to-br from-[#6B46C1] to-[#9F7AEA] rounded-md flex items-center justify-center">
                <Key className="w-4 h-4 text-white" />
              </div>
              <span className="font-semibold text-[#1A202C] text-[15px]">The Side Door</span>
            </div>
          </div>

          {/* New Search CTA */}
          <div className="px-3 pt-4 pb-3">
            <button
              onClick={() => {
                onNavigate("search");
                setSidebarOpen(false);
              }}
              className="w-full bg-[#6B46C1] hover:bg-[#5a3ba1] text-white px-4 py-2.5 rounded-lg transition-all font-medium text-[14px] flex items-center justify-center gap-2 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              New Search
            </button>
          </div>

          {/* Main Navigation */}
          <nav className="flex-1 px-3 py-4 space-y-0.5 border-t border-[#E2E8F0]">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentPage === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onNavigate(item.id);
                    setSidebarOpen(false);
                  }}
                  className={`
                    w-full flex items-center gap-3 px-3 py-2 rounded-md text-[14px]
                    transition-all duration-150 relative group
                    ${
                      isActive
                        ? "bg-[#F7F5FF] text-[#6B46C1] font-medium"
                        : "text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#1A202C]"
                    }
                  `}
                >
                  <Icon className={`w-[18px] h-[18px] ${isActive ? "text-[#6B46C1]" : "text-[#94A3B8]"}`} />
                  <span>{item.label}</span>
                  {isActive && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-[#6B46C1] rounded-r-full" />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Credits Display */}
          <div className="px-3 pb-4">
            {(() => {
              const creditsRemaining = subscription?.credits_remaining ?? 0;
              const creditsTotal = subscription?.credits_total ?? 50;
              const pct = creditsTotal > 0 ? (creditsRemaining / creditsTotal) * 100 : 0;
              const barGradient = pct > 50
                ? "from-[#059669] to-[#10b981]"
                : pct >= 20
                  ? "from-[#d97706] to-[#f59e0b]"
                  : "from-[#dc2626] to-[#ef4444]";
              const borderColor = pct > 50 ? "#a7f3d0" : pct >= 20 ? "#fde68a" : "#fecaca";
              const planLabel = subscription?.plan_type === "free" ? "Free Trial" : (subscription?.plan_type || "free").charAt(0).toUpperCase() + (subscription?.plan_type || "free").slice(1);

              // Calculate trial days remaining
              const trialDaysLeft = subscription?.plan_type === "free" && subscription?.free_tier_expires_at
                ? Math.max(0, Math.ceil((new Date(subscription.free_tier_expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
                : null;

              return (
                <button
                  onClick={() => {
                    onNavigate("billing");
                    setSidebarOpen(false);
                  }}
                  className={`w-full bg-gradient-to-br from-[#F7F5FF] to-[#FAF9FC] rounded-lg p-4 hover:border-[#D4C5FF] transition-all group`}
                  style={{ border: `1px solid ${borderColor}` }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[#64748B] text-[13px] font-medium">Credits remaining</span>
                    <span className="text-[11px] font-medium text-[#6B46C1] bg-purple-100 px-2 py-0.5 rounded-full">{planLabel}</span>
                  </div>
                  <div className="flex items-baseline gap-2 mb-3">
                    <div className="text-2xl font-bold text-[#1A202C]">{creditsRemaining}</div>
                    <div className="text-[13px] text-[#94A3B8]">of {creditsTotal}</div>
                  </div>
                  <div className="w-full bg-white rounded-full h-1.5 overflow-hidden">
                    <div className={`bg-gradient-to-r ${barGradient} h-1.5 rounded-full transition-all`} style={{ width: `${pct}%` }}></div>
                  </div>
                  {trialDaysLeft !== null && (
                    <div className="mt-2 text-[11px] text-[#94A3B8]">
                      {trialDaysLeft > 0 ? `Trial ends in ${trialDaysLeft} day${trialDaysLeft !== 1 ? "s" : ""}` : "Trial expired"}
                    </div>
                  )}
                </button>
              );
            })()}
          </div>

          {/* Bottom Navigation */}
          <div className="px-3 py-3 border-t border-[#E2E8F0] space-y-0.5">
            {bottomNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentPage === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onNavigate(item.id);
                    setSidebarOpen(false);
                  }}
                  className={`
                    w-full flex items-center gap-3 px-3 py-2 rounded-md text-[14px]
                    transition-all duration-150 relative
                    ${
                      isActive
                        ? "bg-[#F7F5FF] text-[#6B46C1] font-medium"
                        : "text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#1A202C]"
                    }
                  `}
                >
                  <Icon className={`w-[18px] h-[18px] ${isActive ? "text-[#6B46C1]" : "text-[#94A3B8]"}`} />
                  <span className="truncate">{item.label}</span>
                  {isActive && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-[#6B46C1] rounded-r-full" />
                  )}
                </button>
              );
            })}
          </div>

          {/* User Profile */}
          <div className="px-3 pb-4 pt-3 border-t border-[#E2E8F0]">
            <div className="space-y-2">
              <button className="w-full flex items-center gap-3 px-2 py-2 rounded-md hover:bg-[#F8FAFC] transition-colors group">
                <div className="w-8 h-8 bg-gradient-to-br from-[#6B46C1] to-[#9F7AEA] rounded-full flex items-center justify-center flex-shrink-0">
                  <User className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <div className="font-medium text-[#1A202C] text-[13px] truncate">{userName || "User"}</div>
                  <div className="text-[12px] text-[#94A3B8]">Beta</div>
                </div>
              </button>
              {onLogout && (
                <button
                  onClick={() => {
                    if (confirm('Are you sure you want to log out?')) {
                      onLogout();
                    }
                  }}
                  className="w-full flex items-center gap-3 px-2 py-2 rounded-md hover:bg-red-50 transition-colors group text-[#64748B] hover:text-red-600"
                >
                  <LogOut className="w-[18px] h-[18px]" />
                  <span className="text-[14px]">Log out</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-30 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}