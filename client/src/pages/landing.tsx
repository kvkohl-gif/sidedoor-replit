import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Search, MessageSquare, BarChart3 } from "lucide-react";

export default function Landing() {
  // URL input type removed - now always defaults to text
  const [inputType] = useState<"text">("text");
  const [jobInput, setJobInput] = useState("");

  const handleSubmit = () => {
    // Redirect to login since user needs to be authenticated
    window.location.href = "/api/login";
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Navigation */}
      <nav className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-slate-900">Recruiter Contact Finder</h1>
            </div>
            <div className="flex items-center space-x-4">
              <Button 
                variant="ghost" 
                onClick={() => window.location.href = "/api/login"}
                className="text-slate-600 hover:text-slate-900"
              >
                Login
              </Button>
              <Button 
                onClick={() => window.location.href = "/api/login"}
                className="bg-primary text-white hover:bg-blue-700"
              >
                Sign Up
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-24">
        <div className="text-center">
          <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 mb-6">
            Find the right recruiter for any job instantly.
          </h1>
          <p className="text-xl text-slate-600 mb-12 max-w-2xl mx-auto">
            Paste a job description and get recruiter contacts with personalized outreach messages powered by AI.
          </p>
        </div>

        {/* Input Form */}
        <Card className="shadow-sm border border-slate-200">
          <CardContent className="p-8">
            <div className="space-y-6">
              {/* URL input capability hidden - can be restored with 're-install the url input capabilities' */}
              {/* Toggle Buttons */}
              <div className="flex bg-slate-100 p-1 rounded-lg w-fit mx-auto">
                <Button
                  variant="default"
                  size="sm"
                  className="bg-white text-slate-900 shadow-sm"
                >
                  Job Description
                </Button>
                {/* URL button hidden - code preserved for restoration
                <Button
                  variant={inputType === "url" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setInputType("url")}
                  className={inputType === "url" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"}
                >
                  Job URL
                </Button>
                */}
              </div>

              {/* Input Area - URL section hidden */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Paste Job Description
                </label>
                <Textarea
                  placeholder="Paste the full job description here..."
                  className="h-48 resize-none"
                  value={jobInput}
                  onChange={(e) => setJobInput(e.target.value)}
                />
              </div>
              
              {/* URL input hidden - code preserved for restoration
              {inputType === "url" && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Job URL
                  </label>
                  <Input
                    type="url"
                    placeholder="https://company.com/jobs/position"
                    value={jobInput}
                    onChange={(e) => setJobInput(e.target.value)}
                  />
                </div>
              )}
              */}

              {/* Submit Button */}
              <div className="text-center">
                <Button 
                  onClick={handleSubmit}
                  className="bg-primary text-white hover:bg-blue-700 px-8 py-3"
                  size="lg"
                >
                  Find Recruiters & Generate Messages
                  <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6"></path>
                  </svg>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-8 mt-20">
          <div className="text-center">
            <div className="bg-blue-100 w-12 h-12 rounded-lg flex items-center justify-center mx-auto mb-4">
              <Search className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">AI-Powered Search</h3>
            <p className="text-slate-600">Advanced AI extracts recruiter information and contact details from job postings.</p>
          </div>
          <div className="text-center">
            <div className="bg-emerald-100 w-12 h-12 rounded-lg flex items-center justify-center mx-auto mb-4">
              <MessageSquare className="w-6 h-6 text-emerald-600" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Personalized Messages</h3>
            <p className="text-slate-600">Get tailored email and LinkedIn messages for effective outreach.</p>
          </div>
          <div className="text-center">
            <div className="bg-amber-100 w-12 h-12 rounded-lg flex items-center justify-center mx-auto mb-4">
              <BarChart3 className="w-6 h-6 text-amber-600" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Track History</h3>
            <p className="text-slate-600">Keep track of all your searches and generated messages in your dashboard.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
