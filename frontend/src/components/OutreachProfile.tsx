import { User, FileText, Target, Trophy, Heart, Sparkles, Save, Plus, X } from "lucide-react";
import { useState } from "react";

export function OutreachProfile() {
  const [bio, setBio] = useState("");
  const [resume, setResume] = useState("");
  const [coverLetter, setCoverLetter] = useState("");
  const [achievements, setAchievements] = useState<string[]>([
    "Led team of 5 engineers to deliver product 2 months ahead of schedule",
    "Increased conversion rate by 45% through A/B testing"
  ]);
  const [careerGoals, setCareerGoals] = useState("");
  const [hobbies, setHobbies] = useState<string[]>(["Rock climbing", "Photography", "Cooking"]);
  const [storyHooks, setStoryHooks] = useState<string[]>([
    "My family has been in construction for 3 generations",
    "I'm a real estate investor with 4 rental properties"
  ]);
  
  const [newAchievement, setNewAchievement] = useState("");
  const [newHobby, setNewHobby] = useState("");
  const [newStoryHook, setNewStoryHook] = useState("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");

  const handleSave = () => {
    setSaveStatus("saving");
    setTimeout(() => {
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    }, 800);
  };

  const addAchievement = () => {
    if (newAchievement.trim()) {
      setAchievements([...achievements, newAchievement.trim()]);
      setNewAchievement("");
    }
  };

  const removeAchievement = (index: number) => {
    setAchievements(achievements.filter((_, i) => i !== index));
  };

  const addHobby = () => {
    if (newHobby.trim()) {
      setHobbies([...hobbies, newHobby.trim()]);
      setNewHobby("");
    }
  };

  const removeHobby = (index: number) => {
    setHobbies(hobbies.filter((_, i) => i !== index));
  };

  const addStoryHook = () => {
    if (newStoryHook.trim()) {
      setStoryHooks([...storyHooks, newStoryHook.trim()]);
      setNewStoryHook("");
    }
  };

  const removeStoryHook = (index: number) => {
    setStoryHooks(storyHooks.filter((_, i) => i !== index));
  };

  return (
    <div className="min-h-screen bg-[#FAFBFC]">
      {/* Header */}
      <div className="bg-white border-b border-[#E2E8F0] sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h1 className="text-[#1A202C] mb-2">Outreach Profile</h1>
              <p className="text-[15px] text-[#718096] leading-relaxed">
                The more detail you provide, the better our AI can craft personalized, compelling outreach emails that resonate with recruiters and hiring managers.
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

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          {/* Bio */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
                <User className="w-5 h-5 text-[#6B46C1]" />
              </div>
              <div className="flex-1">
                <h3 className="text-[#1A202C] font-semibold mb-1">Professional Bio</h3>
                <p className="text-[14px] text-[#718096]">
                  A brief overview of your professional background, expertise, and what makes you unique.
                </p>
              </div>
            </div>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="e.g., I'm a Senior Product Designer with 8 years of experience building user-centric SaaS products. I specialize in design systems and have led design teams at both early-stage startups and Fortune 500 companies..."
              className="w-full px-4 py-3 border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6B46C1] focus:border-transparent resize-none text-[14px] text-[#1A202C] placeholder:text-[#A0AEC0]"
              rows={5}
            />
          </div>

          {/* Resume */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                <FileText className="w-5 h-5 text-blue-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-[#1A202C] font-semibold mb-1">Resume / CV</h3>
                <p className="text-[14px] text-[#718096]">
                  Paste your resume text here. Include work experience, education, skills, and certifications.
                </p>
              </div>
            </div>
            <textarea
              value={resume}
              onChange={(e) => setResume(e.target.value)}
              placeholder="Paste your full resume here..."
              className="w-full px-4 py-3 border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6B46C1] focus:border-transparent resize-none text-[14px] text-[#1A202C] placeholder:text-[#A0AEC0] font-mono"
              rows={10}
            />
          </div>

          {/* Cover Letter */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
                <FileText className="w-5 h-5 text-green-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-[#1A202C] font-semibold mb-1">Master Cover Letter</h3>
                <p className="text-[14px] text-[#718096]">
                  A template or example cover letter that showcases your writing style and key selling points.
                </p>
              </div>
            </div>
            <textarea
              value={coverLetter}
              onChange={(e) => setCoverLetter(e.target.value)}
              placeholder="Paste your cover letter template here..."
              className="w-full px-4 py-3 border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6B46C1] focus:border-transparent resize-none text-[14px] text-[#1A202C] placeholder:text-[#A0AEC0]"
              rows={8}
            />
          </div>

          {/* Achievements */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-yellow-100 flex items-center justify-center flex-shrink-0">
                <Trophy className="w-5 h-5 text-yellow-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-[#1A202C] font-semibold mb-1">Key Achievements</h3>
                <p className="text-[14px] text-[#718096]">
                  Quantifiable wins, awards, and accomplishments that demonstrate your impact.
                </p>
              </div>
            </div>
            
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={newAchievement}
                onChange={(e) => setNewAchievement(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && addAchievement()}
                placeholder="e.g., Increased revenue by 150% in first quarter"
                className="flex-1 px-4 py-2.5 border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6B46C1] focus:border-transparent text-[14px] text-[#1A202C] placeholder:text-[#A0AEC0]"
              />
              <button
                onClick={addAchievement}
                className="px-4 py-2.5 bg-[#6B46C1] hover:bg-[#5a3ba1] text-white rounded-lg transition-colors flex items-center gap-2 font-medium text-[14px]"
              >
                <Plus className="w-4 h-4" />
                Add
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {achievements.map((achievement, index) => (
                <div
                  key={index}
                  className="bg-[#F7F5FF] border border-[#E9E3FF] text-[#6B46C1] px-3 py-2 rounded-lg text-[14px] flex items-center gap-2 group hover:border-[#6B46C1] transition-colors"
                >
                  <span>{achievement}</span>
                  <button
                    onClick={() => removeAchievement(index)}
                    className="opacity-60 hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Career Goals */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
                <Target className="w-5 h-5 text-indigo-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-[#1A202C] font-semibold mb-1">Career Goals</h3>
                <p className="text-[14px] text-[#718096]">
                  What you're looking for in your next role and where you want to take your career.
                </p>
              </div>
            </div>
            <textarea
              value={careerGoals}
              onChange={(e) => setCareerGoals(e.target.value)}
              placeholder="e.g., I'm looking to transition into a leadership role where I can mentor junior designers while still staying hands-on with product design. Ideally at a high-growth B2B SaaS company that values design excellence..."
              className="w-full px-4 py-3 border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6B46C1] focus:border-transparent resize-none text-[14px] text-[#1A202C] placeholder:text-[#A0AEC0]"
              rows={5}
            />
          </div>

          {/* Hobbies & Interests */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-pink-100 flex items-center justify-center flex-shrink-0">
                <Heart className="w-5 h-5 text-pink-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-[#1A202C] font-semibold mb-1">Hobbies & Interests</h3>
                <p className="text-[14px] text-[#718096]">
                  Personal interests that help you connect with people and show your personality.
                </p>
              </div>
            </div>
            
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={newHobby}
                onChange={(e) => setNewHobby(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && addHobby()}
                placeholder="e.g., Hiking, Playing guitar, Volunteering"
                className="flex-1 px-4 py-2.5 border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6B46C1] focus:border-transparent text-[14px] text-[#1A202C] placeholder:text-[#A0AEC0]"
              />
              <button
                onClick={addHobby}
                className="px-4 py-2.5 bg-[#6B46C1] hover:bg-[#5a3ba1] text-white rounded-lg transition-colors flex items-center gap-2 font-medium text-[14px]"
              >
                <Plus className="w-4 h-4" />
                Add
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {hobbies.map((hobby, index) => (
                <div
                  key={index}
                  className="bg-pink-50 border border-pink-200 text-pink-700 px-3 py-2 rounded-lg text-[14px] flex items-center gap-2 group hover:border-pink-400 transition-colors"
                >
                  <span>{hobby}</span>
                  <button
                    onClick={() => removeHobby(index)}
                    className="opacity-60 hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Story Hooks */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-5 h-5 text-orange-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-[#1A202C] font-semibold mb-1">Personal Story Hooks</h3>
                <p className="text-[14px] text-[#718096] mb-3">
                  Unique personal facts, experiences, or connections that can create instant rapport with companies in specific industries.
                </p>
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                  <p className="text-[13px] text-orange-900 mb-2 font-medium">Examples:</p>
                  <ul className="text-[13px] text-orange-800 space-y-1 ml-4 list-disc">
                    <li>"My family has been in construction for 3 generations"</li>
                    <li>"I'm a real estate investor with 4 rental properties"</li>
                    <li>"I grew up working in my parents' restaurant"</li>
                    <li>"I'm an avid woodworker and built my own home office"</li>
                  </ul>
                </div>
              </div>
            </div>
            
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={newStoryHook}
                onChange={(e) => setNewStoryHook(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && addStoryHook()}
                placeholder="Add a personal story hook..."
                className="flex-1 px-4 py-2.5 border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6B46C1] focus:border-transparent text-[14px] text-[#1A202C] placeholder:text-[#A0AEC0]"
              />
              <button
                onClick={addStoryHook}
                className="px-4 py-2.5 bg-[#6B46C1] hover:bg-[#5a3ba1] text-white rounded-lg transition-colors flex items-center gap-2 font-medium text-[14px]"
              >
                <Plus className="w-4 h-4" />
                Add
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {storyHooks.map((hook, index) => (
                <div
                  key={index}
                  className="bg-orange-50 border border-orange-200 text-orange-700 px-3 py-2 rounded-lg text-[14px] flex items-center gap-2 group hover:border-orange-400 transition-colors"
                >
                  <span>{hook}</span>
                  <button
                    onClick={() => removeStoryHook(index)}
                    className="opacity-60 hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
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
  );
}
