import { Search, Users, MessageSquare, ArrowRight, TrendingUp, Zap, CheckCircle } from "lucide-react";

interface DashboardProps {
  onNavigate: (page: string) => void;
}

export function Dashboard({ onNavigate }: DashboardProps) {
  const recentSearches = [
    {
      id: 1,
      jobTitle: "Senior Product Manager",
      company: "TechCorp Inc.",
      date: "Dec 15, 2024",
      contactsFound: 5,
      contactsValid: 3,
    },
    {
      id: 2,
      jobTitle: "UX Designer",
      company: "Design Studios",
      date: "Dec 10, 2024",
      contactsFound: 8,
      contactsValid: 5,
    },
    {
      id: 3,
      jobTitle: "Software Engineer",
      company: "StartupXYZ",
      date: "Dec 8, 2024",
      contactsFound: 12,
      contactsValid: 7,
    },
    {
      id: 4,
      jobTitle: "Marketing Manager",
      company: "Global Marketing Co.",
      date: "Dec 5, 2024",
      contactsFound: 6,
      contactsValid: 4,
    },
  ];

  return (
    <div className="p-6 md:p-8 lg:p-10 max-w-[1400px]">
      {/* Welcome Section */}
      <div className="mb-8">
        <h1 className="text-[#0F172A] mb-1.5">Welcome back, Sarah</h1>
        <p className="text-[#64748B] text-[15px]">Bypass the application black hole and land directly in hiring managers' inboxes</p>
      </div>

      {/* CTA Banner */}
      <div className="bg-gradient-to-br from-[#6B46C1] to-[#8B5CF6] rounded-xl p-6 md:p-8 mb-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-1/3 w-48 h-48 bg-white/5 rounded-full translate-y-1/2" />
        <div className="relative z-10">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="flex-1">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white/20 rounded-full text-white text-xs font-medium mb-3">
                <Zap className="w-3 h-3" />
                AI-Powered Search
              </div>
              <h2 className="text-white mb-2">Find your next opportunity</h2>
              <p className="text-white/90 text-[15px] max-w-xl">
                Paste any job description and let our AI find the right recruiters and hiring managers to contact
              </p>
            </div>
            <button
              onClick={() => onNavigate("search")}
              className="bg-white text-[#6B46C1] px-6 py-3 rounded-lg hover:bg-gray-50 transition-all font-medium shadow-lg shadow-black/10 flex items-center gap-2 justify-center md:justify-start whitespace-nowrap"
            >
              <Search className="w-4 h-4" />
              Start New Search
            </button>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        {/* Total Contacts */}
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between mb-4">
            <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-[#3B82F6]" />
            </div>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-md text-xs font-medium">
              <TrendingUp className="w-3 h-3" />
              +12%
            </span>
          </div>
          <div className="space-y-1 mb-4">
            <div className="text-3xl font-bold text-[#0F172A]">221</div>
            <div className="text-[13px] text-[#64748B]">Total contacts found</div>
          </div>
          <div className="pt-4 border-t border-[#F1F5F9]">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="text-[#64748B]">Verified emails</span>
              <span className="text-[#0F172A] font-semibold">95 verified</span>
            </div>
            <div className="w-full bg-[#F1F5F9] rounded-full h-1.5 overflow-hidden">
              <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: "43%" }}></div>
            </div>
          </div>
        </div>

        {/* Messages Created */}
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between mb-4">
            <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-[#6B46C1]" />
            </div>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-50 text-[#6B46C1] rounded-md text-xs font-medium">
              This week
            </span>
          </div>
          <div className="space-y-1 mb-4">
            <div className="text-3xl font-bold text-[#0F172A]">8</div>
            <div className="text-[13px] text-[#64748B]">AI messages generated</div>
          </div>
          <div className="pt-4 border-t border-[#F1F5F9]">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="text-[#64748B]">Personalization score</span>
              <span className="text-[#0F172A] font-semibold">94%</span>
            </div>
            <div className="w-full bg-[#F1F5F9] rounded-full h-1.5 overflow-hidden">
              <div className="bg-[#6B46C1] h-1.5 rounded-full" style={{ width: "94%" }}></div>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between mb-4">
            <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-emerald-600" />
            </div>
          </div>
          <div className="space-y-1 mb-6">
            <div className="text-3xl font-bold text-[#0F172A]">12</div>
            <div className="text-[13px] text-[#64748B]">Active job applications</div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#64748B]">Not contacted</span>
              <span className="text-[#0F172A] font-medium">4</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#64748B]">Reached out</span>
              <span className="text-[#0F172A] font-medium">6</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#64748B]">Responded</span>
              <span className="text-[#0F172A] font-medium">2</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Searches */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#E2E8F0]">
          <div>
            <h2 className="text-[#0F172A] mb-0.5">Recent Searches</h2>
            <p className="text-[#64748B] text-sm">Your most recent job searches</p>
          </div>
          <button
            onClick={() => onNavigate("job-history")}
            className="text-[#6B46C1] hover:text-[#5a3ba1] flex items-center gap-1.5 text-sm font-medium transition-colors"
          >
            View all
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* Table - Desktop */}
        <div className="hidden md:block">
          <table className="w-full">
            <thead>
              <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                <th className="text-left text-[#64748B] font-medium text-xs uppercase tracking-wider py-3 px-6">
                  Position
                </th>
                <th className="text-left text-[#64748B] font-medium text-xs uppercase tracking-wider py-3 px-6">
                  Company
                </th>
                <th className="text-left text-[#64748B] font-medium text-xs uppercase tracking-wider py-3 px-6">
                  Date
                </th>
                <th className="text-left text-[#64748B] font-medium text-xs uppercase tracking-wider py-3 px-6">
                  Contacts
                </th>
                <th className="w-12"></th>
              </tr>
            </thead>
            <tbody>
              {recentSearches.map((search, index) => (
                <tr
                  key={search.id}
                  onClick={() => onNavigate("job-details")}
                  className={`hover:bg-[#F8FAFC] cursor-pointer transition-colors group ${
                    index !== recentSearches.length - 1 ? 'border-b border-[#E2E8F0]' : ''
                  }`}
                >
                  <td className="py-4 px-6">
                    <div className="font-medium text-[#0F172A] text-[15px]">{search.jobTitle}</div>
                  </td>
                  <td className="py-4 px-6">
                    <div className="text-[#64748B] text-sm">{search.company}</div>
                  </td>
                  <td className="py-4 px-6">
                    <div className="text-[#64748B] text-sm">{search.date}</div>
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-3">
                      <div className="text-[#64748B] text-sm">
                        {search.contactsFound} found
                      </div>
                      <div className="w-1 h-1 rounded-full bg-[#CBD5E1]" />
                      <div className="text-[#0F172A] text-sm font-medium">
                        {search.contactsValid} verified
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <ArrowRight className="w-5 h-5 text-[#CBD5E1] group-hover:text-[#6B46C1] transition-colors" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Cards - Mobile */}
        <div className="md:hidden divide-y divide-[#E2E8F0]">
          {recentSearches.map((search) => (
            <div
              key={search.id}
              onClick={() => onNavigate("job-details")}
              className="p-4 hover:bg-[#F8FAFC] cursor-pointer transition-colors active:bg-[#F1F5F9]"
            >
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-[#0F172A] mb-1 truncate">{search.jobTitle}</h3>
                  <p className="text-[#64748B] text-sm">{search.company}</p>
                </div>
                <ArrowRight className="w-5 h-5 text-[#CBD5E1] flex-shrink-0 ml-2" />
              </div>
              <div className="flex items-center justify-between text-xs pt-3 border-t border-[#E2E8F0]">
                <span className="text-[#64748B]">{search.date}</span>
                <div className="flex items-center gap-2">
                  <span className="text-[#64748B]">{search.contactsFound} found</span>
                  <span className="text-[#0F172A] font-medium">{search.contactsValid} verified</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}