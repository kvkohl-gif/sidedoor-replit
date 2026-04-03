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
import OnboardingWizard from "./components/OnboardingWizard";
import { OutreachHub } from "./components/OutreachHub";
import { TrialExpiredModal } from "./components/TrialExpiredModal";
import { usePlanAccess } from "./hooks/usePlanAccess";
import { TermsOfService } from "./components/TermsOfService";
import { PrivacyPolicy } from "./components/PrivacyPolicy";
import { LoginScreen } from "../components/Login";
import { SignupScreen } from "../components/Signup";
import { ForgotPasswordScreen } from "../components/ForgotPassword";
import { ResetPasswordScreen } from "../components/ResetPassword";

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
  "outreach-hub": "/outreach",
  billing: "/billing",
  settings: "/settings",
  terms: "/terms",
  privacy: "/privacy",
  "forgot-password": "/forgot-password",
  "reset-password": "/reset-password",
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
  "/outreach": "outreach-hub",
  "/billing": "billing",
  "/settings": "settings",
  "/terms": "terms",
  "/privacy": "privacy",
  "/forgot-password": "forgot-password",
  "/reset-password": "reset-password",
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

// TrialGate: renders TrialExpiredModal when trial is expired and user is on free plan
function TrialGate({ onLogout }: { onLogout: () => void }) {
  const { trialExpired, isFreeTier, isLoading } = usePlanAccess();
  if (isLoading || !trialExpired || !isFreeTier) return null;
  return <TrialExpiredModal onLogout={onLogout} />;
}

const APP_ENV = import.meta.env.VITE_APP_ENV || "production";

function StagingBanner() {
  if (APP_ENV !== "staging") return null;
  return (
    <div
      className="bg-amber-500 text-black text-center py-1 px-4 text-xs font-bold tracking-wide fixed top-0 left-0 right-0 z-[9999]"
    >
      STAGING ENVIRONMENT
    </div>
  );
}

export default function App() {
  const [location, setLocation] = useLocation();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState<boolean>(true);
  const [userName, setUserName] = useState<string>("");

  // Check authentication status on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/auth/user', {
          credentials: 'include',
        });

        if (response.ok) {
          const userData = await response.json();
          setIsAuthenticated(true);
          if (userData.first_name) {
            setUserName(`${userData.first_name} ${userData.last_name || ''}`.trim());
          }
          // If authenticated and on login/signup page, redirect to dashboard
          if (location === "/login" || location === "/signup" || location === "/") {
            setLocation("/dashboard");
          }
        } else {
          setIsAuthenticated(false);
          // If not authenticated and not on public pages, redirect to login
          const publicPaths = ["/login", "/signup", "/terms", "/privacy", "/forgot-password", "/reset-password"];
          if (!publicPaths.some(p => location === p || location.startsWith(p + "?"))) {
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

  const stagingOffset = APP_ENV === "staging" ? "pt-7" : "";

  // Show loading state while checking auth
  if (isCheckingAuth) {
    return (
      <div className={`min-h-screen flex items-center justify-center bg-gradient-to-br from-[#F7F5FF] to-[#FAFBFC] ${stagingOffset}`}>
        <StagingBanner />
        <div className="text-lg text-[#718096]">Loading...</div>
      </div>
    );
  }

  // Public pages — no Layout wrapper, no auth required
  const publicPages = ["/login", "/signup", "/terms", "/privacy", "/forgot-password", "/reset-password"];
  if (publicPages.some(p => location === p || location.startsWith(p + "?"))) {
    return (
      <><StagingBanner /><div className={stagingOffset}><Switch>
        <Route path="/login">
          <div style={{ maxWidth: '28rem', margin: '0 auto' }}>
            <LoginScreen
              onNavigate={handleNavigate}
              onLogin={() => setIsAuthenticated(true)}
            />
          </div>
        </Route>
        <Route path="/signup">
          <div style={{ maxWidth: '28rem', margin: '0 auto' }}>
            <SignupScreen
              onNavigate={handleNavigate}
              onSignup={() => setIsAuthenticated(true)}
            />
          </div>
        </Route>
        <Route path="/terms">
          <TermsOfService onNavigate={handleNavigate} />
        </Route>
        <Route path="/privacy">
          <PrivacyPolicy onNavigate={handleNavigate} />
        </Route>
        <Route path="/forgot-password">
          <ForgotPasswordScreen onNavigate={handleNavigate} />
        </Route>
        <Route path="/reset-password">
          {() => {
            const token = new URLSearchParams(window.location.search).get("token") || "";
            return <ResetPasswordScreen onNavigate={handleNavigate} token={token} />;
          }}
        </Route>
      </Switch></div></>
    );
  }

  // Protected pages — redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }

  const currentPage = getCurrentPage(location);

  return (
    <>
    <StagingBanner />
    <div className={stagingOffset}>
    <TrialGate onLogout={handleLogout} />
    <OnboardingWizard onNavigate={handleNavigate} />
    <Layout
      currentPage={currentPage}
      onNavigate={handleNavigate}
      onLogout={handleLogout}
      userName={userName}
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
          <OutreachProfile onNavigate={handleNavigate} />
        </Route>
        <Route path="/outreach">
          <OutreachHub onNavigate={handleNavigate} />
        </Route>
        <Route path="/billing">
          <Subscription />
        </Route>
        <Route path="/settings">
          <Settings />
        </Route>
        <Route path="/terms">
          <TermsOfService onNavigate={handleNavigate} />
        </Route>
        <Route path="/privacy">
          <PrivacyPolicy onNavigate={handleNavigate} />
        </Route>
        <Route path="/">
          <Redirect to="/dashboard" />
        </Route>
        <Route>
          <Redirect to="/dashboard" />
        </Route>
      </Switch>
    </Layout>
    </div>
    </>
  );
}
