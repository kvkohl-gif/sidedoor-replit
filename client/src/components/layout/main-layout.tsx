import { useState, useEffect } from "react";
import Sidebar from "./sidebar";
import { Plus } from "lucide-react";
import { Link } from "wouter";

interface MainLayoutProps {
  children: React.ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("navCollapsed") === "true";
    }
    return false;
  });

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar 
        collapsed={sidebarCollapsed}
        onCollapsedChange={setSidebarCollapsed}
      />
      <div className="flex-1 flex flex-col">
        {/* Top bar with new search button */}
        <header className="bg-white border-b border-gray-200 px-4 py-3 sm:px-6">
          <div className="flex items-center justify-between">
            <div className="flex-1" />
            {/* Global New Search Button */}
            <Link href="/search">
              <button className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">New Search</span>
              </button>
            </Link>
          </div>
        </header>
        
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}