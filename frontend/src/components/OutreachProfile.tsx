import {
  User, FileText, Target, Trophy, Heart, Sparkles, Save, Plus, X,
  Upload, ChevronDown, ChevronRight, Loader2, Copy, Check, Mic,
  Briefcase, Building2, Zap
} from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "../lib/queryClient";

interface ProfileData {
  resumeText: string;
  resumeFilename: string;
  bio: string;
  coverLetter: string;
  careerGoals: string;
  achievements: string[];
  hobbies: string[];
  storyHooks: string[];
  voiceFormality: number;
  voiceDirectness: number;
  voiceLength: number;
  voiceNotes: string;
  targetRoles: string[];
  targetIndustries: string[];
  targetCompanyStage: string[];
  profileCompleteness: number;
}

const defaultProfile: ProfileData = {
  resumeText: "",
  resumeFilename: "",
  bio: "",
  coverLetter: "",
  careerGoals: "",
  achievements: [],
  hobbies: [],
  storyHooks: [],
  voiceFormality: 0.5,
  voiceDirectness: 0.5,
  voiceLength: 0.3,
  voiceNotes: "",
  targetRoles: [],
  targetIndustries: [],
  targetCompanyStage: [],
  profileCompleteness: 0,
};

function computeCompleteness(p: ProfileData): number {
  let score = 0;
  if (p.resumeText.trim().length > 50) score += 25;
  if (p.bio.trim().length > 20) score += 20;
  if (p.achievements.length >= 2) score += 20;
  if (p.careerGoals.trim().length > 10) score += 15;
  if (p.voiceFormality !== 0.5 || p.voiceDirectness !== 0.5 || p.voiceLength !== 0.3 || p.voiceNotes.trim().length > 0) score += 10;
  if (p.storyHooks.length >= 1) score += 10;
  return Math.min(score, 100);
}

function getNextTip(p: ProfileData): string {
  if (p.resumeText.trim().length <= 50) return "Upload your resume to get started";
  if (p.bio.trim().length <= 20) return "Add a professional bio to improve outreach quality";
  if (p.achievements.length < 2) return "Add your key achievements to improve outreach quality";
  if (p.careerGoals.trim().length <= 10) return "Define your career goals for more targeted messages";
  if (p.storyHooks.length < 1) return "Add personal story hooks to create rapport with recruiters";
  return "Your profile is looking great!";
}

async function extractTextFromFile(file: File): Promise<string> {
  if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
    const pdfjsLib = await import("pdfjs-dist");
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url
    ).toString();
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let text = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map((item: any) => item.str).join(" ") + "\n";
    }
    return text.trim();
  } else if (file.name.endsWith(".docx") || file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    const mammoth = await import("mammoth");
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value.trim();
  }
  throw new Error("Unsupported file type. Please upload a PDF or DOCX file.");
}

type SectionKey = "resume" | "bio" | "achievements" | "goals" | "voice" | "hooks" | "cover" | "hobbies";

interface NavSection {
  key: SectionKey;
  label: string;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  group: string;
}

const NAV_SECTIONS: NavSection[] = [
  { key: "resume", label: "Resume", icon: FileText, iconColor: "text-blue-600", iconBg: "bg-blue-100", group: "ESSENTIALS" },
  { key: "bio", label: "Professional Bio", icon: User, iconColor: "text-[#6B46C1]", iconBg: "bg-purple-100", group: "ESSENTIALS" },
  { key: "achievements", label: "Signature Wins", icon: Trophy, iconColor: "text-yellow-600", iconBg: "bg-yellow-100", group: "ACHIEVEMENTS & GOALS" },
  { key: "goals", label: "Career Goals", icon: Target, iconColor: "text-indigo-600", iconBg: "bg-indigo-100", group: "ACHIEVEMENTS & GOALS" },
  { key: "voice", label: "Voice & Tone", icon: Mic, iconColor: "text-green-600", iconBg: "bg-teal-100", group: "COMMUNICATION STYLE" },
  { key: "hooks", label: "Story Hooks", icon: Heart, iconColor: "text-rose-600", iconBg: "bg-orange-100", group: "COMMUNICATION STYLE" },
  { key: "cover", label: "Cover Letter", icon: FileText, iconColor: "text-gray-500", iconBg: "bg-gray-100", group: "EXTRAS" },
  { key: "hobbies", label: "Hobbies", icon: Heart, iconColor: "text-gray-500", iconBg: "bg-gray-100", group: "EXTRAS" },
];

function getSectionCompletion(key: SectionKey, p: ProfileData): "complete" | "partial" | "empty" {
  switch (key) {
    case "resume":
      if (p.resumeText.trim().length > 50) return "complete";
      if (p.resumeText.trim().length > 0) return "partial";
      return "empty";
    case "bio":
      if (p.bio.trim().length > 20) return "complete";
      if (p.bio.trim().length > 0) return "partial";
      return "empty";
    case "achievements":
      if (p.achievements.length >= 2) return "complete";
      if (p.achievements.length > 0) return "partial";
      return "empty";
    case "goals":
      if (p.careerGoals.trim().length > 10 || p.targetRoles.length > 0) return "complete";
      if (p.careerGoals.trim().length > 0 || p.targetIndustries.length > 0 || p.targetCompanyStage.length > 0) return "partial";
      return "empty";
    case "voice":
      if (p.voiceFormality !== 0.5 || p.voiceDirectness !== 0.5 || p.voiceLength !== 0.3 || p.voiceNotes.trim().length > 0) return "complete";
      return "empty";
    case "hooks":
      if (p.storyHooks.length >= 1) return "complete";
      return "empty";
    case "cover":
      if (p.coverLetter.trim().length > 20) return "complete";
      if (p.coverLetter.trim().length > 0) return "partial";
      return "empty";
    case "hobbies":
      if (p.hobbies.length > 0) return "complete";
      return "empty";
    default:
      return "empty";
  }
}

function CompletionDot({ status }: { status: "complete" | "partial" | "empty" }) {
  if (status === "complete") {
    return (
      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: "#059669" }} />
    );
  }
  if (status === "partial") {
    return (
      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 overflow-hidden" style={{ position: "relative", backgroundColor: "#e5e7eb" }}>
        <span style={{ position: "absolute", top: 0, left: 0, width: "50%", height: "100%", backgroundColor: "#d97706", borderRadius: "2.5px 0 0 2.5px" }} />
      </span>
    );
  }
  return (
    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: "#d1d5db" }} />
  );
}

function ProgressRing({ percentage }: { percentage: number }) {
  const size = 60;
  const strokeWidth = 5;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#6B46C1"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-500"
        />
      </svg>
      <span
        className="text-sm font-bold text-[#1A202C]"
        style={{ marginTop: -(size / 2 + 7), marginBottom: (size / 2 - 7) }}
      >
        {percentage}%
      </span>
    </div>
  );
}

export function OutreachProfile() {
  const [profile, setProfile] = useState<ProfileData>(defaultProfile);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [newAchievement, setNewAchievement] = useState("");
  const [newHobby, setNewHobby] = useState("");
  const [newStoryHook, setNewStoryHook] = useState("");
  const [newRole, setNewRole] = useState("");
  const [newIndustry, setNewIndustry] = useState("");
  const [newStage, setNewStage] = useState("");
  const [coverLetterOpen, setCoverLetterOpen] = useState(false);
  const [hobbiesOpen, setHobbiesOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [aiLoading, setAiLoading] = useState<string | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState<{ bio?: string; achievements?: string[]; storyHooks?: string[] }>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [activeSection, setActiveSection] = useState<SectionKey>("resume");

  const sectionRefs = useRef<Record<SectionKey, HTMLDivElement | null>>({
    resume: null,
    bio: null,
    achievements: null,
    goals: null,
    voice: null,
    hooks: null,
    cover: null,
    hobbies: null,
  });

  // IntersectionObserver for active section tracking
  useEffect(() => {
    const observers: IntersectionObserver[] = [];
    const sectionKeys: SectionKey[] = ["resume", "bio", "achievements", "goals", "voice", "hooks", "cover", "hobbies"];

    sectionKeys.forEach((key) => {
      const el = sectionRefs.current[key];
      if (!el) return;
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              setActiveSection(key);
            }
          });
        },
        { rootMargin: "-100px 0px -60% 0px", threshold: 0.1 }
      );
      observer.observe(el);
      observers.push(observer);
    });

    return () => {
      observers.forEach((o) => o.disconnect());
    };
  }, []);

  const scrollToSection = (key: SectionKey) => {
    const el = sectionRefs.current[key];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    // Open collapsible sections when navigating to them
    if (key === "cover") setCoverLetterOpen(true);
    if (key === "hobbies") setHobbiesOpen(true);
  };

  const { data: fetchedProfile, isLoading } = useQuery<ProfileData>({
    queryKey: ["/api/outreach-profile"],
  });

  useEffect(() => {
    if (fetchedProfile) {
      setProfile(fetchedProfile);
      if (fetchedProfile.coverLetter?.trim()) setCoverLetterOpen(true);
      if (fetchedProfile.hobbies?.length > 0) setHobbiesOpen(true);
    }
  }, [fetchedProfile]);

  const saveMutation = useMutation({
    mutationFn: async (data: ProfileData) => {
      return await apiRequest("PUT", "/api/outreach-profile", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/outreach-profile"] });
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    },
    onError: () => {
      setSaveStatus("idle");
    },
  });

  const handleSave = () => {
    setSaveStatus("saving");
    saveMutation.mutate(profile);
  };

  const updateField = useCallback((field: keyof ProfileData, value: any) => {
    setProfile(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleFileUpload = async (file: File) => {
    setUploading(true);
    setUploadError("");
    try {
      const text = await extractTextFromFile(file);
      setProfile(prev => ({
        ...prev,
        resumeText: text,
        resumeFilename: file.name,
      }));
    } catch (err: any) {
      setUploadError(err.message || "Failed to parse file");
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileUpload(file);
  };

  const aiSuggest = async (section: string) => {
    setAiLoading(section);
    try {
      const resp = await apiRequest("POST", "/api/outreach-profile/ai-suggest", {
        section,
        context: {
          resumeText: profile.resumeText,
          existingBio: profile.bio,
          existingAchievements: profile.achievements,
        },
      });
      const data = await resp.json();

      if (section === "bio") {
        setAiSuggestions(prev => ({ ...prev, bio: data.suggestion }));
      } else if (section === "achievements") {
        const items = Array.isArray(data.suggestion) ? data.suggestion : [];
        setAiSuggestions(prev => ({ ...prev, achievements: items }));
      } else if (section === "story_hooks") {
        const items = Array.isArray(data.suggestion) ? data.suggestion : [];
        setAiSuggestions(prev => ({ ...prev, storyHooks: items }));
      } else if (section === "analyze_resume") {
        const s = data.suggestion;
        if (s.bio) setAiSuggestions(prev => ({ ...prev, bio: s.bio }));
        if (s.achievements) setAiSuggestions(prev => ({ ...prev, achievements: s.achievements }));
        if (s.storyHooks) setAiSuggestions(prev => ({ ...prev, storyHooks: s.storyHooks }));
      }
    } catch (err: any) {
      console.error("AI suggestion error:", err);
    } finally {
      setAiLoading(null);
    }
  };

  const acceptBioSuggestion = () => {
    if (aiSuggestions.bio) {
      updateField("bio", aiSuggestions.bio);
      setAiSuggestions(prev => ({ ...prev, bio: undefined }));
    }
  };

  const acceptAchievementSuggestions = () => {
    if (aiSuggestions.achievements) {
      const combined = [...profile.achievements, ...aiSuggestions.achievements];
      const unique = [...new Set(combined)];
      updateField("achievements", unique);
      setAiSuggestions(prev => ({ ...prev, achievements: undefined }));
    }
  };

  const acceptHookSuggestions = () => {
    if (aiSuggestions.storyHooks) {
      const combined = [...profile.storyHooks, ...aiSuggestions.storyHooks];
      const unique = [...new Set(combined)];
      updateField("storyHooks", unique);
      setAiSuggestions(prev => ({ ...prev, storyHooks: undefined }));
    }
  };

  const addTag = (field: "achievements" | "hobbies" | "storyHooks" | "targetRoles" | "targetIndustries" | "targetCompanyStage", value: string) => {
    if (value.trim()) {
      const current = profile[field] as string[];
      if (!current.includes(value.trim())) {
        updateField(field, [...current, value.trim()]);
      }
    }
  };

  const removeTag = (field: "achievements" | "hobbies" | "storyHooks" | "targetRoles" | "targetIndustries" | "targetCompanyStage", index: number) => {
    const current = profile[field] as string[];
    updateField(field, current.filter((_, i) => i !== index));
  };

  const completeness = computeCompleteness(profile);
  const tip = getNextTip(profile);

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 lg:p-8 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-[#6B46C1] animate-spin mx-auto mb-4" />
          <p className="text-[#718096]">Loading your profile...</p>
        </div>
      </div>
    );
  }

  // Build grouped nav sections
  const groups: { name: string; items: NavSection[] }[] = [];
  NAV_SECTIONS.forEach((s) => {
    const existing = groups.find((g) => g.name === s.group);
    if (existing) {
      existing.items.push(s);
    } else {
      groups.push({ name: s.group, items: [s] });
    }
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header - full width above sidebar and content */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h1 className="text-[#1A202C] mb-2">Outreach Profile</h1>
              <p className="text-[15px] text-[#718096] leading-relaxed">
                The more detail you provide, the better our AI can craft personalized, compelling outreach emails.
              </p>
            </div>
            <button
              onClick={handleSave}
              disabled={saveStatus === "saving"}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#6B46C1] hover:bg-[#5a3ba1] disabled:bg-[#9F7AEA] text-white rounded-lg transition-all font-medium text-[14px] shadow-sm whitespace-nowrap"
            >
              <Save className="w-4 h-4" />
              {saveStatus === "saving" ? "Saving..." : saveStatus === "saved" ? "Saved!" : "Save Profile"}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile horizontal pill nav */}
      <div className="md:hidden bg-white border-b border-gray-200 sticky top-[89px] z-10 overflow-x-auto">
        <div className="flex gap-2 px-4 py-3">
          {NAV_SECTIONS.map((s) => {
            const status = getSectionCompletion(s.key, profile);
            const isActive = activeSection === s.key;
            return (
              <button
                key={s.key}
                onClick={() => scrollToSection(s.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition-colors ${
                  isActive
                    ? "bg-purple-50 border-purple-300 text-purple-700"
                    : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
                }`}
              >
                <CompletionDot status={status} />
                {s.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Two-column layout */}
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-8">
          {/* Sidebar - hidden on mobile, sticky within scroll container */}
          <div className="hidden md:block flex-shrink-0 self-start sticky top-0" style={{ width: 220 }}>
            <div className="py-2">
              {/* Progress Ring */}
              <div className="flex flex-col items-center mb-6 pb-5 border-b border-gray-200">
                <ProgressRing percentage={completeness} />
                <span className="text-xs text-gray-500 mt-2">Profile Completeness</span>
              </div>

              {/* Section Groups */}
              <nav className="space-y-1">
                {groups.map((group, gi) => (
                  <div key={group.name} className={gi > 0 ? "mt-5" : ""}>
                    <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-2 mb-1.5 block">
                      {group.name}
                    </span>
                    {group.items.map((s) => {
                      const isActive = activeSection === s.key;
                      const status = getSectionCompletion(s.key, profile);
                      return (
                        <button
                          key={s.key}
                          onClick={() => scrollToSection(s.key)}
                          className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-[13px] transition-all ${
                            isActive
                              ? "text-purple-700 font-medium bg-purple-50"
                              : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                          }`}
                          style={isActive ? { borderLeft: "2px solid #6B46C1", paddingLeft: 10 } : { borderLeft: "2px solid transparent", paddingLeft: 10 }}
                        >
                          <CompletionDot status={status} />
                          <span className="flex-1 truncate">{s.label}</span>
                        </button>
                      );
                    })}
                  </div>
                ))}
              </nav>
            </div>
          </div>

          {/* Main content area */}
          <div className="flex-1 min-w-0 space-y-6">

            {/* Group: ESSENTIALS */}
            <div>
              <h2 className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-4 px-1">Essentials</h2>
            </div>

            {/* Section 1: Resume Upload */}
            <div
              id="section-resume"
              ref={(el) => { sectionRefs.current.resume = el; }}
              className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm scroll-mt-[130px]"
            >
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <FileText className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-[#1A202C] font-semibold mb-1">Resume</h3>
                  <p className="text-[14px] text-[#718096]">
                    Upload your resume to auto-fill your profile with AI
                  </p>
                </div>
              </div>

              {!profile.resumeText ? (
                <>
                  <div
                    className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                      dragActive ? "border-[#6B46C1] bg-purple-50" : "border-[#E2E8F0] hover:border-[#6B46C1]"
                    }`}
                    onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                    onDragLeave={() => setDragActive(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {uploading ? (
                      <Loader2 className="w-8 h-8 text-[#6B46C1] animate-spin mx-auto mb-2" />
                    ) : (
                      <Upload className="w-8 h-8 text-[#A0AEC0] mx-auto mb-2" />
                    )}
                    <p className="text-sm text-[#718096] mb-1">
                      {uploading ? "Parsing your resume..." : "Drag & drop PDF or DOCX, or click to browse"}
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.docx"
                      className="hidden"
                      onChange={handleFileChange}
                    />
                  </div>
                  {uploadError && (
                    <p className="text-sm text-red-600 mt-2">{uploadError}</p>
                  )}
                  <div className="flex items-center gap-3 my-4">
                    <div className="flex-1 h-px bg-[#E2E8F0]" />
                    <span className="text-xs text-[#A0AEC0]">OR paste your resume text</span>
                    <div className="flex-1 h-px bg-[#E2E8F0]" />
                  </div>
                  <textarea
                    value={profile.resumeText}
                    onChange={(e) => updateField("resumeText", e.target.value)}
                    placeholder="Paste your full resume text here..."
                    className="w-full px-4 py-3 border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6B46C1] focus:border-transparent resize-none text-[14px] text-[#1A202C] placeholder:text-[#A0AEC0] font-mono"
                    rows={8}
                  />
                </>
              ) : (
                <div>
                  <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg mb-4">
                    <Check className="w-5 h-5 text-green-600 flex-shrink-0" />
                    <span className="text-sm text-green-800 flex-1">
                      {profile.resumeFilename ? `Resume uploaded: ${profile.resumeFilename}` : "Resume text added"}
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => aiSuggest("analyze_resume")}
                        disabled={aiLoading === "analyze_resume"}
                        className="px-3 py-1.5 bg-[#6B46C1] hover:bg-[#5a3ba1] text-white rounded-lg text-xs font-medium flex items-center gap-1.5 disabled:opacity-50"
                      >
                        {aiLoading === "analyze_resume" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                        Analyze with AI
                      </button>
                      <button
                        onClick={() => { fileInputRef.current?.click(); }}
                        className="px-3 py-1.5 bg-white border border-[#E2E8F0] text-[#718096] rounded-lg text-xs font-medium hover:border-[#6B46C1]"
                      >
                        Replace
                      </button>
                      <button
                        onClick={() => { updateField("resumeText", ""); updateField("resumeFilename", ""); }}
                        className="px-3 py-1.5 bg-white border border-[#E2E8F0] text-red-500 rounded-lg text-xs font-medium hover:border-red-300"
                      >
                        Remove
                      </button>
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.docx"
                      className="hidden"
                      onChange={handleFileChange}
                    />
                  </div>
                  <details className="group">
                    <summary className="text-xs text-[#A0AEC0] cursor-pointer hover:text-[#718096]">View resume text</summary>
                    <textarea
                      value={profile.resumeText}
                      onChange={(e) => updateField("resumeText", e.target.value)}
                      className="w-full mt-2 px-4 py-3 border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6B46C1] focus:border-transparent resize-none text-[13px] text-[#1A202C] font-mono"
                      rows={8}
                    />
                  </details>
                </div>
              )}
            </div>

            {/* Section 2: Professional Bio */}
            <div
              id="section-bio"
              ref={(el) => { sectionRefs.current.bio = el; }}
              className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm scroll-mt-[130px]"
            >
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
                  <User className="w-5 h-5 text-[#6B46C1]" />
                </div>
                <div className="flex-1">
                  <h3 className="text-[#1A202C] font-semibold mb-1">Professional Bio</h3>
                  <p className="text-[14px] text-[#718096]">
                    A brief overview of your background and what makes you unique
                  </p>
                </div>
                <button
                  onClick={() => aiSuggest("bio")}
                  disabled={!!aiLoading || !profile.resumeText.trim()}
                  className="px-3 py-1.5 bg-purple-50 text-[#6B46C1] border border-purple-200 rounded-lg text-xs font-medium flex items-center gap-1.5 hover:bg-purple-100 disabled:opacity-40"
                >
                  {aiLoading === "bio" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  AI Suggest
                </button>
              </div>

              {aiSuggestions.bio && (
                <div className="mb-3 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-[#6B46C1]">AI Suggestion</span>
                    <div className="flex gap-2">
                      <button
                        onClick={acceptBioSuggestion}
                        className="px-2.5 py-1 bg-[#6B46C1] text-white rounded text-xs font-medium hover:bg-[#5a3ba1]"
                      >
                        Use This
                      </button>
                      <button
                        onClick={() => setAiSuggestions(prev => ({ ...prev, bio: undefined }))}
                        className="px-2.5 py-1 bg-white border border-[#E2E8F0] text-[#718096] rounded text-xs font-medium hover:border-[#6B46C1]"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                  <p className="text-sm text-[#4A5568]">{aiSuggestions.bio}</p>
                </div>
              )}

              <textarea
                value={profile.bio}
                onChange={(e) => updateField("bio", e.target.value)}
                placeholder="e.g., I'm a Senior Product Designer with 8 years of experience building user-centric SaaS products..."
                className="w-full px-4 py-3 border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6B46C1] focus:border-transparent resize-none text-[14px] text-[#1A202C] placeholder:text-[#A0AEC0]"
                rows={4}
              />
              <div className="mt-2 p-2.5 bg-[#FFFBEB] border border-[#FDE68A] rounded-lg">
                <p className="text-xs text-[#92400E]">
                  <span className="font-medium">Tip:</span> Focus on your narrative, not just your job history. What's the thread that connects your career moves?
                </p>
              </div>
            </div>

            {/* Group: ACHIEVEMENTS & GOALS */}
            <div className="pt-4">
              <h2 className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-4 px-1">Achievements & Goals</h2>
            </div>

            {/* Section 3: Signature Wins */}
            <div
              id="section-achievements"
              ref={(el) => { sectionRefs.current.achievements = el; }}
              className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm scroll-mt-[130px]"
            >
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-yellow-100 flex items-center justify-center flex-shrink-0">
                  <Trophy className="w-5 h-5 text-yellow-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-[#1A202C] font-semibold mb-1">Signature Wins</h3>
                  <p className="text-[14px] text-[#718096]">
                    Quantifiable wins that demonstrate your impact
                  </p>
                </div>
                <button
                  onClick={() => aiSuggest("achievements")}
                  disabled={!!aiLoading || !profile.resumeText.trim()}
                  className="px-3 py-1.5 bg-purple-50 text-[#6B46C1] border border-purple-200 rounded-lg text-xs font-medium flex items-center gap-1.5 hover:bg-purple-100 disabled:opacity-40"
                >
                  {aiLoading === "achievements" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  AI Suggest
                </button>
              </div>

              {aiSuggestions.achievements && aiSuggestions.achievements.length > 0 && (
                <div className="mb-3 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-[#6B46C1]">AI Suggestions</span>
                    <div className="flex gap-2">
                      <button
                        onClick={acceptAchievementSuggestions}
                        className="px-2.5 py-1 bg-[#6B46C1] text-white rounded text-xs font-medium hover:bg-[#5a3ba1]"
                      >
                        Add All
                      </button>
                      <button
                        onClick={() => setAiSuggestions(prev => ({ ...prev, achievements: undefined }))}
                        className="px-2.5 py-1 bg-white border border-[#E2E8F0] text-[#718096] rounded text-xs font-medium hover:border-[#6B46C1]"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    {aiSuggestions.achievements.map((a, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            addTag("achievements", a);
                            setAiSuggestions(prev => ({
                              ...prev,
                              achievements: prev.achievements?.filter((_, idx) => idx !== i),
                            }));
                          }}
                          className="text-xs text-[#6B46C1] hover:text-[#5a3ba1]"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-sm text-[#4A5568]">{a}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  value={newAchievement}
                  onChange={(e) => setNewAchievement(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { addTag("achievements", newAchievement); setNewAchievement(""); } }}
                  placeholder="e.g., Increased revenue by 150% in first quarter"
                  className="flex-1 px-4 py-2.5 border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6B46C1] focus:border-transparent text-[14px] text-[#1A202C] placeholder:text-[#A0AEC0]"
                />
                <button
                  onClick={() => { addTag("achievements", newAchievement); setNewAchievement(""); }}
                  className="px-4 py-2.5 bg-[#6B46C1] hover:bg-[#5a3ba1] text-white rounded-lg transition-colors flex items-center gap-2 font-medium text-[14px]"
                >
                  <Plus className="w-4 h-4" />
                  Add
                </button>
              </div>

              {profile.achievements.length > 0 && (
                <div className="space-y-2">
                  {profile.achievements.map((a, i) => (
                    <div key={i} className="flex items-center gap-2 bg-[#F7F5FF] border border-[#E9E3FF] text-[#6B46C1] px-3 py-2 rounded-lg text-[14px] group hover:border-[#6B46C1] transition-colors">
                      <span className="flex-1">{a}</span>
                      <button onClick={() => removeTag("achievements", i)} className="opacity-60 hover:opacity-100 transition-opacity">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-3 p-2.5 bg-[#FFFBEB] border border-[#FDE68A] rounded-lg">
                <p className="text-xs text-[#92400E]">
                  <span className="font-medium">Tip:</span> Include specific numbers: revenue, %, time saved, team size
                </p>
              </div>
            </div>

            {/* Section 4: Career Goals & Targeting */}
            <div
              id="section-goals"
              ref={(el) => { sectionRefs.current.goals = el; }}
              className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm scroll-mt-[130px]"
            >
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
                  <Target className="w-5 h-5 text-indigo-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-[#1A202C] font-semibold mb-1">What You're Looking For</h3>
                  <p className="text-[14px] text-[#718096]">
                    Define your targets so AI can personalize messages based on company fit
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {/* Target Roles */}
                <div>
                  <label className="text-sm font-medium text-[#4A5568] mb-2 block">Target Roles</label>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={newRole}
                      onChange={(e) => setNewRole(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { addTag("targetRoles", newRole); setNewRole(""); } }}
                      placeholder="e.g., Product Manager, Growth Lead"
                      className="flex-1 px-3 py-2 border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6B46C1] text-[14px] text-[#1A202C] placeholder:text-[#A0AEC0]"
                    />
                    <button
                      onClick={() => { addTag("targetRoles", newRole); setNewRole(""); }}
                      className="px-3 py-2 bg-[#6B46C1] text-white rounded-lg text-sm hover:bg-[#5a3ba1]"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {profile.targetRoles.map((r, i) => (
                      <span key={i} className="bg-indigo-50 border border-indigo-200 text-indigo-700 px-2.5 py-1 rounded-lg text-[13px] flex items-center gap-1.5">
                        {r}
                        <button onClick={() => removeTag("targetRoles", i)} className="opacity-60 hover:opacity-100"><X className="w-3 h-3" /></button>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Target Industries */}
                <div>
                  <label className="text-sm font-medium text-[#4A5568] mb-2 block">Target Industries</label>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={newIndustry}
                      onChange={(e) => setNewIndustry(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { addTag("targetIndustries", newIndustry); setNewIndustry(""); } }}
                      placeholder="e.g., B2B SaaS, Fintech"
                      className="flex-1 px-3 py-2 border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6B46C1] text-[14px] text-[#1A202C] placeholder:text-[#A0AEC0]"
                    />
                    <button
                      onClick={() => { addTag("targetIndustries", newIndustry); setNewIndustry(""); }}
                      className="px-3 py-2 bg-[#6B46C1] text-white rounded-lg text-sm hover:bg-[#5a3ba1]"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {profile.targetIndustries.map((ind, i) => (
                      <span key={i} className="bg-blue-50 border border-blue-200 text-blue-700 px-2.5 py-1 rounded-lg text-[13px] flex items-center gap-1.5">
                        {ind}
                        <button onClick={() => removeTag("targetIndustries", i)} className="opacity-60 hover:opacity-100"><X className="w-3 h-3" /></button>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Company Stage */}
                <div>
                  <label className="text-sm font-medium text-[#4A5568] mb-2 block">Company Stage</label>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={newStage}
                      onChange={(e) => setNewStage(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { addTag("targetCompanyStage", newStage); setNewStage(""); } }}
                      placeholder="e.g., Series A-C, Growth Stage"
                      className="flex-1 px-3 py-2 border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6B46C1] text-[14px] text-[#1A202C] placeholder:text-[#A0AEC0]"
                    />
                    <button
                      onClick={() => { addTag("targetCompanyStage", newStage); setNewStage(""); }}
                      className="px-3 py-2 bg-[#6B46C1] text-white rounded-lg text-sm hover:bg-[#5a3ba1]"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {profile.targetCompanyStage.map((s, i) => (
                      <span key={i} className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-2.5 py-1 rounded-lg text-[13px] flex items-center gap-1.5">
                        {s}
                        <button onClick={() => removeTag("targetCompanyStage", i)} className="opacity-60 hover:opacity-100"><X className="w-3 h-3" /></button>
                      </span>
                    ))}
                  </div>
                </div>

                {/* What excites you */}
                <div>
                  <label className="text-sm font-medium text-[#4A5568] mb-2 block">What excites you about your next role</label>
                  <textarea
                    value={profile.careerGoals}
                    onChange={(e) => updateField("careerGoals", e.target.value)}
                    placeholder="e.g., I want to be the first growth PM at a company that's found product-market fit and needs to scale..."
                    className="w-full px-4 py-3 border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6B46C1] focus:border-transparent resize-none text-[14px] text-[#1A202C] placeholder:text-[#A0AEC0]"
                    rows={3}
                  />
                </div>
              </div>
            </div>

            {/* Group: COMMUNICATION STYLE */}
            <div className="pt-4">
              <h2 className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-4 px-1">Communication Style</h2>
            </div>

            {/* Section 5: Voice & Tone */}
            <div
              id="section-voice"
              ref={(el) => { sectionRefs.current.voice = el; }}
              className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm scroll-mt-[130px]"
            >
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-teal-100 flex items-center justify-center flex-shrink-0">
                  <Mic className="w-5 h-5 text-teal-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-[#1A202C] font-semibold mb-1">Your Voice</h3>
                  <p className="text-[14px] text-[#718096]">
                    How do you want your outreach to sound?
                  </p>
                </div>
              </div>

              <div className="space-y-5">
                <div>
                  <div className="flex justify-between text-xs text-[#718096] mb-1.5">
                    <span>Casual</span>
                    <span className="font-medium text-[#4A5568]">Formality</span>
                    <span>Formal</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={profile.voiceFormality}
                    onChange={(e) => updateField("voiceFormality", parseFloat(e.target.value))}
                    className="w-full h-2 bg-[#EDF2F7] rounded-full appearance-none cursor-pointer accent-[#6B46C1]"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs text-[#718096] mb-1.5">
                    <span>Warm</span>
                    <span className="font-medium text-[#4A5568]">Directness</span>
                    <span>Direct</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={profile.voiceDirectness}
                    onChange={(e) => updateField("voiceDirectness", parseFloat(e.target.value))}
                    className="w-full h-2 bg-[#EDF2F7] rounded-full appearance-none cursor-pointer accent-[#6B46C1]"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs text-[#718096] mb-1.5">
                    <span>Brief</span>
                    <span className="font-medium text-[#4A5568]">Length</span>
                    <span>Detailed</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={profile.voiceLength}
                    onChange={(e) => updateField("voiceLength", parseFloat(e.target.value))}
                    className="w-full h-2 bg-[#EDF2F7] rounded-full appearance-none cursor-pointer accent-[#6B46C1]"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-[#4A5568] mb-2 block">Sample phrases you'd naturally use</label>
                  <textarea
                    value={profile.voiceNotes}
                    onChange={(e) => updateField("voiceNotes", e.target.value)}
                    placeholder="e.g., I tend to lead with specific examples rather than credentials. I don't use corporate jargon."
                    className="w-full px-4 py-3 border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6B46C1] focus:border-transparent resize-none text-[14px] text-[#1A202C] placeholder:text-[#A0AEC0]"
                    rows={3}
                  />
                </div>
              </div>
            </div>

            {/* Section 6: Personal Story Hooks */}
            <div
              id="section-hooks"
              ref={(el) => { sectionRefs.current.hooks = el; }}
              className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm scroll-mt-[130px]"
            >
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-5 h-5 text-orange-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-[#1A202C] font-semibold mb-1">Personal Story Hooks</h3>
                  <p className="text-[14px] text-[#718096]">
                    Unique connections that create instant rapport with recruiters
                  </p>
                </div>
                <button
                  onClick={() => aiSuggest("story_hooks")}
                  disabled={!!aiLoading || !profile.resumeText.trim()}
                  className="px-3 py-1.5 bg-purple-50 text-[#6B46C1] border border-purple-200 rounded-lg text-xs font-medium flex items-center gap-1.5 hover:bg-purple-100 disabled:opacity-40"
                >
                  {aiLoading === "story_hooks" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  AI Suggest
                </button>
              </div>

              {aiSuggestions.storyHooks && aiSuggestions.storyHooks.length > 0 && (
                <div className="mb-3 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-[#6B46C1]">AI Suggestions</span>
                    <div className="flex gap-2">
                      <button
                        onClick={acceptHookSuggestions}
                        className="px-2.5 py-1 bg-[#6B46C1] text-white rounded text-xs font-medium hover:bg-[#5a3ba1]"
                      >
                        Add All
                      </button>
                      <button
                        onClick={() => setAiSuggestions(prev => ({ ...prev, storyHooks: undefined }))}
                        className="px-2.5 py-1 bg-white border border-[#E2E8F0] text-[#718096] rounded text-xs font-medium hover:border-[#6B46C1]"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    {aiSuggestions.storyHooks.map((h, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            addTag("storyHooks", h);
                            setAiSuggestions(prev => ({
                              ...prev,
                              storyHooks: prev.storyHooks?.filter((_, idx) => idx !== i),
                            }));
                          }}
                          className="text-xs text-[#6B46C1] hover:text-[#5a3ba1]"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-sm text-[#4A5568]">{h}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  value={newStoryHook}
                  onChange={(e) => setNewStoryHook(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { addTag("storyHooks", newStoryHook); setNewStoryHook(""); } }}
                  placeholder="Add a personal story hook..."
                  className="flex-1 px-4 py-2.5 border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6B46C1] focus:border-transparent text-[14px] text-[#1A202C] placeholder:text-[#A0AEC0]"
                />
                <button
                  onClick={() => { addTag("storyHooks", newStoryHook); setNewStoryHook(""); }}
                  className="px-4 py-2.5 bg-[#6B46C1] hover:bg-[#5a3ba1] text-white rounded-lg transition-colors flex items-center gap-2 font-medium text-[14px]"
                >
                  <Plus className="w-4 h-4" />
                  Add
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                {profile.storyHooks.map((hook, index) => (
                  <div
                    key={index}
                    className="bg-orange-50 border border-orange-200 text-orange-700 px-3 py-2 rounded-lg text-[14px] flex items-center gap-2 group hover:border-orange-400 transition-colors"
                  >
                    <span>{hook}</span>
                    <button onClick={() => removeTag("storyHooks", index)} className="opacity-60 hover:opacity-100 transition-opacity">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="mt-3 p-2.5 bg-orange-50 border border-orange-200 rounded-lg">
                <p className="text-xs text-orange-800">
                  <span className="font-medium">Examples:</span> "My family has been in construction for 3 generations", "I'm a real estate investor with 4 properties"
                </p>
              </div>
            </div>

            {/* Group: EXTRAS */}
            <div className="pt-4">
              <h2 className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-4 px-1">Extras</h2>
            </div>

            {/* Section 7: Cover Letter (Collapsible) */}
            <div
              id="section-cover"
              ref={(el) => { sectionRefs.current.cover = el; }}
              className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm scroll-mt-[130px]"
            >
              <button
                onClick={() => setCoverLetterOpen(!coverLetterOpen)}
                className="w-full flex items-center gap-3 p-6 hover:bg-[#FAFBFC] transition-colors"
              >
                <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
                  <FileText className="w-5 h-5 text-green-600" />
                </div>
                <div className="flex-1 text-left">
                  <h3 className="text-[#1A202C] font-semibold">Cover Letter Template <span className="text-[#A0AEC0] font-normal text-sm">(Optional)</span></h3>
                  <p className="text-[14px] text-[#718096]">A reference template the AI can use for longer-form outreach</p>
                </div>
                {coverLetterOpen ? <ChevronDown className="w-5 h-5 text-[#A0AEC0]" /> : <ChevronRight className="w-5 h-5 text-[#A0AEC0]" />}
              </button>
              {coverLetterOpen && (
                <div className="px-6 pb-6">
                  <textarea
                    value={profile.coverLetter}
                    onChange={(e) => updateField("coverLetter", e.target.value)}
                    placeholder="Paste your cover letter template here..."
                    className="w-full px-4 py-3 border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6B46C1] focus:border-transparent resize-none text-[14px] text-[#1A202C] placeholder:text-[#A0AEC0]"
                    rows={8}
                  />
                </div>
              )}
            </div>

            {/* Section 8: Hobbies (Collapsible) */}
            <div
              id="section-hobbies"
              ref={(el) => { sectionRefs.current.hobbies = el; }}
              className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm scroll-mt-[130px]"
            >
              <button
                onClick={() => setHobbiesOpen(!hobbiesOpen)}
                className="w-full flex items-center gap-3 p-6 hover:bg-[#FAFBFC] transition-colors"
              >
                <div className="w-10 h-10 rounded-lg bg-pink-100 flex items-center justify-center flex-shrink-0">
                  <Heart className="w-5 h-5 text-pink-600" />
                </div>
                <div className="flex-1 text-left">
                  <h3 className="text-[#1A202C] font-semibold">Hobbies & Interests <span className="text-[#A0AEC0] font-normal text-sm">(Optional)</span></h3>
                  <p className="text-[14px] text-[#718096]">Personal interests that help connect with people</p>
                </div>
                {hobbiesOpen ? <ChevronDown className="w-5 h-5 text-[#A0AEC0]" /> : <ChevronRight className="w-5 h-5 text-[#A0AEC0]" />}
              </button>
              {hobbiesOpen && (
                <div className="px-6 pb-6">
                  <div className="flex gap-2 mb-3">
                    <input
                      type="text"
                      value={newHobby}
                      onChange={(e) => setNewHobby(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { addTag("hobbies", newHobby); setNewHobby(""); } }}
                      placeholder="e.g., Hiking, Playing guitar, Volunteering"
                      className="flex-1 px-4 py-2.5 border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6B46C1] focus:border-transparent text-[14px] text-[#1A202C] placeholder:text-[#A0AEC0]"
                    />
                    <button
                      onClick={() => { addTag("hobbies", newHobby); setNewHobby(""); }}
                      className="px-4 py-2.5 bg-[#6B46C1] hover:bg-[#5a3ba1] text-white rounded-lg transition-colors flex items-center gap-2 font-medium text-[14px]"
                    >
                      <Plus className="w-4 h-4" />
                      Add
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {profile.hobbies.map((hobby, index) => (
                      <div
                        key={index}
                        className="bg-pink-50 border border-pink-200 text-pink-700 px-3 py-2 rounded-lg text-[14px] flex items-center gap-2 group hover:border-pink-400 transition-colors"
                      >
                        <span>{hobby}</span>
                        <button onClick={() => removeTag("hobbies", index)} className="opacity-60 hover:opacity-100 transition-opacity">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Save Button */}
            <div className="flex justify-end pt-4">
              <button
                onClick={handleSave}
                disabled={saveStatus === "saving"}
                className="flex items-center gap-2 px-6 py-3 bg-[#6B46C1] hover:bg-[#5a3ba1] disabled:bg-[#9F7AEA] text-white rounded-lg transition-all font-medium text-[14px] shadow-sm"
              >
                <Save className="w-4 h-4" />
                {saveStatus === "saving" ? "Saving..." : saveStatus === "saved" ? "Saved!" : "Save Profile"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
