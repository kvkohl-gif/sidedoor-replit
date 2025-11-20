import { useState, useEffect } from "react";
import { Layout } from "./components/Layout";
import { Dashboard } from "./components/Dashboard";
import { SearchPage } from "./components/SearchPage";
import { JobHistory } from "./components/JobHistory";
import { JobDetails } from "./components/JobDetails";
import { AllContacts } from "./components/AllContacts";
import { ContactDetail } from "./components/ContactDetail";
import { Subscription } from "./components/Subscription";
import { Credits } from "./components/Credits";
import { Settings } from "./components/Settings";
import { BillingHistory } from "./components/BillingHistory";
import { OutreachProfile } from "./components/OutreachProfile";
import { LoginScreen } from "../components/Login";
import { SignupScreen } from "../components/Signup";

interface NavigationState {
  page: string;
  params?: Record<string, any>;
}

export default function App() {
  const [navigationState, setNavigationState] = useState<NavigationState>({ 
    page: "login" 
  });
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
          if (navigationState.page === "login" || navigationState.page === "signup") {
            setNavigationState({ page: "dashboard" });
          }
        } else {
          setIsAuthenticated(false);
          // If not authenticated and not on auth pages, redirect to login
          if (navigationState.page !== "login" && navigationState.page !== "signup") {
            setNavigationState({ page: "login" });
          }
        }
      } catch (error) {
        console.error('Auth check failed:', error);
        setIsAuthenticated(false);
        setNavigationState({ page: "login" });
      } finally {
        setIsCheckingAuth(false);
      }
    };

    checkAuth();
  }, []);

  const handleNavigate = (page: string, params?: Record<string, any>) => {
    setNavigationState({ page, params });
  };

  const handleLogin = async (email: string, password: string) => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });

      if (response.ok) {
        setIsAuthenticated(true);
        setNavigationState({ page: "dashboard" });
      } else {
        const data = await response.json();
        alert(data.message || 'Login failed');
      }
    } catch (error) {
      console.error('Login error:', error);
      alert('Login failed');
    }
  };

  const handleSignup = async (email: string, password: string, firstName: string, lastName: string) => {
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password, firstName, lastName }),
      });

      if (response.ok) {
        setIsAuthenticated(true);
        setNavigationState({ page: "dashboard" });
      } else {
        const data = await response.json();
        alert(data.message || 'Signup failed');
      }
    } catch (error) {
      console.error('Signup error:', error);
      alert('Signup failed');
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
      setIsAuthenticated(false);
      setNavigationState({ page: "login" });
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const renderPage = () => {
    const { page, params } = navigationState;
    
    // Show login/signup without Layout wrapper
    if (page === "login") {
      return (
        <LoginScreen
          onNavigate={handleNavigate}
          onLogin={() => {}} // Will be handled inside component
        />
      );
    }
    
    if (page === "signup") {
      return (
        <SignupScreen
          onNavigate={handleNavigate}
          onSignup={() => {}} // Will be handled inside component
        />
      );
    }
    
    // Protected pages - require authentication
    switch (page) {
      case "dashboard":
        return <Dashboard onNavigate={handleNavigate} />;
      case "search":
        return <SearchPage onNavigate={handleNavigate} />;
      case "job-history":
        return <JobHistory onNavigate={handleNavigate} />;
      case "job-details":
        return <JobDetails submissionId={params?.submissionId} onNavigate={handleNavigate} />;
      case "contacts":
        return <AllContacts onNavigate={handleNavigate} />;
      case "contact-detail":
        return <ContactDetail contactId={params?.contactId} onNavigate={handleNavigate} />;
      case "outreach-profile":
        return <OutreachProfile />;
      case "billing":
        return <Subscription />;
      case "credits":
        return <Credits />;
      case "settings":
        return <Settings />;
      case "billing-history":
        return <BillingHistory />;
      default:
        return <Dashboard onNavigate={handleNavigate} />;
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

  // Render auth pages without Layout, app pages with Layout
  const page = navigationState.page;
  if (page === "login" || page === "signup") {
    return renderPage();
  }

  return (
    <Layout 
      currentPage={navigationState.page} 
      onNavigate={handleNavigate}
      onLogout={handleLogout}
    >
      {renderPage()}
    </Layout>
  );
}