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

export default function App() {
  const [currentPage, setCurrentPage] = useState("dashboard");

  const renderPage = () => {
    switch (currentPage) {
      case "dashboard":
        return <Dashboard onNavigate={setCurrentPage} />;
      case "search":
        return <SearchPage onNavigate={setCurrentPage} />;
      case "job-history":
        return <JobHistory onNavigate={setCurrentPage} />;
      case "job-details":
        return <JobDetails onNavigate={setCurrentPage} />;
      case "contacts":
        return <AllContacts onNavigate={setCurrentPage} />;
      case "contact-detail":
        return <ContactDetail onNavigate={setCurrentPage} />;
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
        return <Dashboard onNavigate={setCurrentPage} />;
    }
  };

  return (
    <Layout currentPage={currentPage} onNavigate={setCurrentPage}>
      {renderPage()}
    </Layout>
  );
}