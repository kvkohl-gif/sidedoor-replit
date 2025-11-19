import { useState } from "react";
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

interface NavigationState {
  page: string;
  params?: Record<string, any>;
}

export default function App() {
  const [navigationState, setNavigationState] = useState<NavigationState>({ 
    page: "dashboard" 
  });

  const handleNavigate = (page: string, params?: Record<string, any>) => {
    setNavigationState({ page, params });
  };

  const renderPage = () => {
    const { page, params } = navigationState;
    
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

  return (
    <Layout currentPage={navigationState.page} onNavigate={handleNavigate}>
      {renderPage()}
    </Layout>
  );
}