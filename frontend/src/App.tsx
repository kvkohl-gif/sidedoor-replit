import { useState, useEffect, useCallback } from "react";
import { useLocation, Route, Switch, Redirect } from "wouter";
import { Layout } from "./components/Layout";
import { Dashboard } from "./components/Dashboard";
import { SearchPage } from "./components/SearchPage";
import { JobHistory } from "./components/JobHistory";
import { JobDetails } from "./components/JobDetails";
import { AllContacts } from "./components/AllContacts";
import { ContactDetail } from "./components/ContactDetail";
import { Subscription } from "./components/Subscription";
import { Settings } from "./components/Settings";
import { OutreachProfile } from "./components/OutreachProfile";
import { LoginScreen } from "../components/Login";
import { SignupScreen } from "../components/Signup";

// Map page names (used by child components) to URL paths
const pageToPath: Record<string, string> = {
  dashboard: "/dashboard",
  search: "/search",
  "job-history": "/jobs",
  "job-details": "/jobs", // needs /:id appended
  contacts: "/contacts",
  "all-contacts": "/contacts",
  "contact-detail": "/contacts", // needs /:id appended
  "outreach-profile": "/outreach-profile",
  billing: "/billing",
  settings: "/settings",
  login: "/login",
  signup: "/signup",
};

// Map URL paths back to page names (for Layout highlighting)
const pathToPage: Record<string, string> = {
  "/dashboard": "dashboard",
  "/search": "search",
  "/jobs": "job-history",
  "/contacts": "contacts",
  "/outreach-profile": "outreach-profile",
  "/billing": "billing",
  "/settings": "settings",
  "/login": "login",
  "/signup": "signup",
};

function getCurrentPage(location: string): string {
  // Exact match first
  if (pathToPage[location]) return pathToPage[location];
  // Check prefix matches for parameterized routes
  if (location.startsWith("/jobs/")) return "job-details";
  if (location.startsWith("/contacts/")) return "contact-detail";
  // Default
  return "dashboard";
}

export default function App() {
  const [location, setLocation] = useLocation();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState<boolean>(true);

  // Check authentication status on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/auth/user', {
          credentials: 'include',
        });

        if (response.ok) {
          setIsAuthenticated(true);
          // If authenticated and on login/signup page, redirect to dashboard
          if (location === "/login" || location === "/signup" || location === "/") {
            setLocation("/dashboard");
          }
        } else {
          setIsAuthenticated(false);
          // If not authenticated and not on auth pages, redirect to login
          if (location !== "/login" && location !== "/signup") {
            setLocation("/login");
          }
        }
      } catch (error) {
        console.error('Auth check failed:', error);
        setIsAuthenticated(false);
        setLocation("/login");
      } finally {
        setIsCheckingAuth(false);
      }
    };

    checkAuth();
  }, []);

  // Translate legacy page-name navigation to URL-based navigation
  // This keeps all child components working without changes
  const handleNavigate = useCallback((page: string, params?: Record<string, any>) => {
    let path = pageToPath[page] || "/dashboard";

    // Append IDs for parameterized routes
    if (page === "job-details" && params?.submissionId) {
      path = `/jobs/${params.submissionId}`;
    } else if (page === "contact-detail" && params?.contactId) {
      path = `/contacts/${params.contactId}`;
    }

    setLocation(path);
  }, [setLocation]);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
      setIsAuthenticated(false);
      setLocation("/login");
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // Show loading state while checking auth
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#F7F5FF] to-[#FAFBFC]">
        <div className="text-lg text-[#718096]">Loading...</div>
      </div>
    );
  }

  // Auth pages — no Layout wrapper
  if (location === "/login" || location === "/signup") {
    return (
      <Switch>
        <Route path="/login">
          <div style={{ maxWidth: '28rem', margin: '0 auto' }}>
            <LoginScreen
              onNavigate={handleNavigate}
              onLogin={() => {}}
            />
          </div>
        </Route>
        <Route path="/signup">
          <div style={{ maxWidth: '28rem', margin: '0 auto' }}>
            <SignupScreen
              onNavigate={handleNavigate}
              onSignup={() => {}}
            />
          </div>
        </Route>
      </Switch>
    );
  }

  // Protected pages — redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }

  const currentPage = getCurrentPage(location);

  return (
    <Layout
      currentPage={currentPage}
      onNavigate={handleNavigate}
      onLogout={handleLogout}
    >
      <Switch>
        <Route path="/dashboard">
          <Dashboard onNavigate={handleNavigate} />
        </Route>
        <Route path="/search">
          <SearchPage onNavigate={handleNavigate} />
        </Route>
        <Route path="/jobs/:id">
          {(params) => <JobDetails submissionId={Number(params.id)} onNavigate={handleNavigate} />}
        </Route>
        <Route path="/jobs">
          <JobHistory onNavigate={handleNavigate} />
        </Route>
        <Route path="/contacts/:id">
          {(params) => <ContactDetail contactId={Number(params.id)} onNavigate={handleNavigate} />}
        </Route>
        <Route path="/contacts">
          <AllContacts onNavigate={handleNavigate} />
        </Route>
        <Route path="/outreach-profile">
          <OutreachProfile />
        </Route>
        <Route path="/billing">
          <Subscription />
        </Route>
        <Route path="/settings">
          <Settings />
        </Route>
        <Route path="/">
          <Redirect to="/dashboard" />
        </Route>
        <Route>
          <Redirect to="/dashboard" />
        </Route>
      </Switch>
    </Layout>
  );
}
