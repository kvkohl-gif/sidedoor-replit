import { Link, useLocation } from "wouter";
import { 
  Search, 
  Briefcase, 
  Users, 
  Plus,
  Home
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navigationItems = [
  {
    title: "Search",
    href: "/search",
    icon: Search,
    description: "Find new recruiter contacts"
  },
  {
    title: "Job History", 
    href: "/dashboard",
    icon: Briefcase,
    description: "View your job submissions"
  },
  {
    title: "Contacts",
    href: "/contacts", 
    icon: Users,
    description: "Manage all your contacts"
  }
];

export default function Sidebar() {
  const [location] = useLocation();

  return (
    <div className="w-64 h-screen bg-white border-r border-gray-200 flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <Link href="/dashboard">
          <div className="flex items-center gap-3 cursor-pointer">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Users className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="font-semibold text-gray-900">Recruiter Finder</h1>
              <p className="text-xs text-gray-500">Contact Discovery</p>
            </div>
          </div>
        </Link>
      </div>

      {/* New Search Button */}
      <div className="p-4">
        <Link href="/search">
          <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium">
            <Plus className="h-4 w-4 mr-2" />
            New Search
          </Button>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-2">
        <div className="space-y-1">
          <div className="px-3 py-2">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Main
            </h2>
          </div>
          
          {navigationItems.map((item) => {
            const isActive = location === item.href || 
              (item.href === "/dashboard" && location === "/") ||
              (item.href === "/dashboard" && location.startsWith("/submissions/"));
            
            return (
              <Link key={item.href} href={item.href}>
                <div
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer",
                    isActive
                      ? "bg-blue-50 text-blue-700 border-l-4 border-l-blue-600"
                      : "text-gray-700 hover:bg-gray-50 hover:text-gray-900"
                  )}
                >
                  <item.icon className={cn(
                    "h-5 w-5",
                    isActive ? "text-blue-600" : "text-gray-400"
                  )} />
                  <div className="flex-1">
                    <div>{item.title}</div>
                    <div className="text-xs text-gray-500 font-normal">
                      {item.description}
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-gray-200">
        <div className="text-xs text-gray-500 text-center">
          <p>Recruiter Contact Finder</p>
          <p className="text-gray-400">Powered by AI</p>
        </div>
      </div>
    </div>
  );
}