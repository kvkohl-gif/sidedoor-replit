import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Search, MessageSquare, BarChart3, Loader2, Lock, Users } from "lucide-react";

export default function Landing() {
  // URL input type removed - now always defaults to text
  const [inputType] = useState<"text">("text");
  const [jobInput, setJobInput] = useState("");
  const [isInputLocked, setIsInputLocked] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = () => {
    // For demo purposes on landing page, lock input briefly to show functionality
    if (jobInput.trim().length >= 12) {
      setIsInputLocked(true);
      
      // Simulate brief loading then redirect to login
      setTimeout(() => {
        setIsInputLocked(false);
        window.location.href = "/api/login";
      }, 1500);
    } else {
      // Redirect to login immediately if no sufficient input
      window.location.href = "/api/login";
    }
  };

  // Check if input meets minimum length requirement
  const hasMinimumInput = jobInput.trim().length >= 12;

  // Handle keyboard events to prevent input when locked
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (isInputLocked) {
      e.preventDefault();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    if (isInputLocked) {
      e.preventDefault();
    }
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
            Find Recruiter Contacts
          </h1>
          <p className="text-xl text-slate-600 mb-12 max-w-2xl mx-auto">
            Paste a description and we'll pull the role details, find recruiter/hiring manager contacts, verify emails, and draft personalized outreach.
          </p>
        </div>

        {/* Input Form */}
        <Card className="rounded-xl shadow-sm hover:shadow-md transition-shadow duration-200 border border-slate-200">
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
                <div className="relative">
                  <Textarea
                    ref={textareaRef}
                    placeholder="Paste the complete job description or job link here…"
                    style={{ lineHeight: '1.6', minHeight: '19.2rem' }} // 12 lines * 1.6 line-height
                    className={`resize-none transition-all duration-200 ${
                      isInputLocked 
                        ? "text-gray-500 border-gray-300 cursor-not-allowed bg-gray-50" 
                        : ""
                    }`}
                    value={jobInput}
                    onChange={(e) => !isInputLocked && setJobInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onPaste={handlePaste}
                    disabled={isInputLocked}
                    data-testid="textarea-job-description-landing"
                  />
                  
                  {/* Character counter */}
                  <div className={`absolute bottom-2 right-2 text-xs text-gray-400 bg-white/80 rounded px-1 transition-all duration-200 ${
                    isInputLocked ? 'bottom-12' : 'bottom-2'
                  }`}>
                    {jobInput.length} characters
                  </div>
                  
                  {/* Lock overlay */}
                  {isInputLocked && (
                    <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm border border-gray-300 rounded-md px-2 py-1 flex items-center gap-1.5 text-xs text-gray-600 shadow-sm">
                      <Lock className="h-3 w-3" />
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span>Locked — Analysis in progress</span>
                    </div>
                  )}
                </div>
                <p className="text-sm text-slate-500 mt-2">
                  Tip: Include title, company, and requirements for best results. We support LinkedIn, Greenhouse, Lever, Ashby, and more.
                </p>
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
                  disabled={isInputLocked || !hasMinimumInput}
                  className="bg-primary text-white hover:bg-blue-700 px-8 py-3 disabled:opacity-50"
                  size="lg"
                  data-testid="button-submit-landing"
                >
                  {isInputLocked ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <div className="relative mr-2">
                        <Search className="w-4 h-4" />
                        <Users className="w-2.5 h-2.5 absolute -bottom-0.5 -right-0.5" />
                      </div>
                      Find Contacts & Draft Outreach
                      <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6"></path>
                      </svg>
                    </>
                  )}
                </Button>
                {!hasMinimumInput && !isInputLocked && (
                  <p className="text-sm text-slate-400 mt-2">
                    Enter at least 12 characters to continue
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-8 mt-20">
          <div className="text-center">
            <div className="bg-blue-100 w-12 h-12 rounded-lg flex items-center justify-center mx-auto mb-4 relative">
              <Search className="w-5 h-5 text-primary" />
              <Users className="w-3 h-3 text-primary absolute -bottom-0.5 -right-0.5" />
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
