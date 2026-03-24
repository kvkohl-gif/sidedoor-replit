import { ArrowLeft } from "lucide-react";

interface PrivacyPolicyProps {
  onNavigate: (page: string) => void;
}

export function PrivacyPolicy({ onNavigate }: PrivacyPolicyProps) {
  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-3xl mx-auto">
      <button
        onClick={() => onNavigate("settings")}
        className="flex items-center gap-1.5 text-sm text-[#6B46C1] hover:text-[#5a3ba1] mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      <h1 className="text-[#1A202C] mb-2">Privacy Policy</h1>
      <p className="text-[#94A3B8] text-sm mb-8">Last Updated: March 24, 2026</p>

      <div className="prose prose-sm max-w-none text-[#334155] space-y-6">
        <p>
          SideDoor takes your privacy seriously. This policy explains what data we collect, why, and
          what we do with it.
        </p>

        <section>
          <h2 className="text-[#1A202C] text-lg font-semibold mt-8 mb-3">
            1. Information We Collect
          </h2>

          <h3 className="text-[#1A202C] font-medium mt-4 mb-2">
            Information you provide directly:
          </h3>
          <ul className="list-disc pl-5 space-y-1">
            <li>Name and email address (when you create an account)</li>
            <li>
              Password (stored securely using one-way hashing — we never store or see your actual
              password)
            </li>
            <li>Job postings and URLs you submit for contact searches</li>
          </ul>

          <h3 className="text-[#1A202C] font-medium mt-4 mb-2">
            Information generated through your use of SideDoor:
          </h3>
          <ul className="list-disc pl-5 space-y-1">
            <li>Recruiter and hiring manager contact information returned from searches</li>
            <li>AI-generated outreach message drafts</li>
            <li>Credit usage and search history</li>
          </ul>

          <h3 className="text-[#1A202C] font-medium mt-4 mb-2">
            Information collected automatically:
          </h3>
          <ul className="list-disc pl-5 space-y-1">
            <li>Basic usage data: pages visited, features used, timestamps</li>
            <li>Device and browser type</li>
            <li>IP address</li>
            <li>Cookies (see Section 6)</li>
          </ul>
        </section>

        <section>
          <h2 className="text-[#1A202C] text-lg font-semibold mt-8 mb-3">
            2. How We Use Your Information
          </h2>
          <p>We use your data to:</p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>Provide and operate the SideDoor platform</li>
            <li>
              Look up recruiter and hiring manager contacts relevant to your job searches
            </li>
            <li>Generate personalized outreach message drafts using AI</li>
            <li>Verify email addresses for deliverability</li>
            <li>Track your credit balance and usage</li>
            <li>
              Send you account-related communications (password resets, important updates)
            </li>
            <li>Improve the platform based on usage patterns</li>
          </ul>

          <p className="mt-4 font-medium">We do NOT:</p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>Sell your personal information to anyone.</li>
            <li>Use your data for advertising.</li>
            <li>Share your job search activity with employers or recruiters.</li>
            <li>Train AI models on your personal data.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-[#1A202C] text-lg font-semibold mt-8 mb-3">
            3. Third-Party Services
          </h2>
          <p>SideDoor uses the following third-party services to operate:</p>

          <div className="mt-3 space-y-3">
            <div>
              <strong>Apollo.io</strong> — We send job-related information (company name, job title)
              to Apollo.io to look up relevant recruiter and hiring manager contact details.
            </div>
            <div>
              <strong>NeverBounce</strong> — We send email addresses obtained from searches to
              NeverBounce to verify deliverability.
            </div>
            <div>
              <strong>Anthropic (Claude AI)</strong> — We send job posting details and context to
              Anthropic's AI to generate outreach message drafts.
            </div>
          </div>
          <p className="mt-3">
            We only share the minimum data necessary with each service for them to perform their
            function. Each service's own privacy policy governs their handling of data.
          </p>
        </section>

        <section>
          <h2 className="text-[#1A202C] text-lg font-semibold mt-8 mb-3">4. Data Security</h2>
          <p>We protect your data using:</p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>Password hashing (bcrypt) — we never store plaintext passwords</li>
            <li>HTTPS encryption for all data in transit</li>
            <li>Access controls limiting who can access production data</li>
          </ul>
          <p className="mt-3">
            No system is 100% secure. While we take reasonable measures to protect your data, we
            cannot guarantee absolute security. If we become aware of a data breach affecting your
            personal information, we will notify you promptly.
          </p>
        </section>

        <section>
          <h2 className="text-[#1A202C] text-lg font-semibold mt-8 mb-3">
            5. Data Retention and Deletion
          </h2>
          <p>
            We retain your data for as long as your account is active. If you delete your account, we
            will delete your personal data within 30 days, except where we are required by law to
            retain it.
          </p>
          <p className="mt-2">
            To request deletion of your account and data, email{" "}
            <a href="mailto:support@sidedoor.com" className="text-[#6B46C1] hover:underline">
              support@sidedoor.com
            </a>
            .
          </p>
        </section>

        <section>
          <h2 className="text-[#1A202C] text-lg font-semibold mt-8 mb-3">6. Cookies</h2>
          <p>SideDoor uses cookies for:</p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>
              <strong>Authentication</strong> — keeping you logged in across sessions
            </li>
            <li>
              <strong>Preferences</strong> — remembering your settings
            </li>
          </ul>
          <p className="mt-2">
            We do not use third-party advertising or tracking cookies.
          </p>
        </section>

        <section>
          <h2 className="text-[#1A202C] text-lg font-semibold mt-8 mb-3">7. Your Rights</h2>
          <p>You have the right to:</p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>Access the personal data we hold about you</li>
            <li>Correct inaccurate data</li>
            <li>Delete your account and associated data</li>
            <li>Export your data in a portable format</li>
          </ul>
          <p className="mt-3">
            To exercise any of these rights, email{" "}
            <a href="mailto:support@sidedoor.com" className="text-[#6B46C1] hover:underline">
              support@sidedoor.com
            </a>
            .
          </p>
          <p className="mt-2">
            If you are a California resident, you may have additional rights under the CCPA,
            including the right to know what personal information is collected and the right to opt
            out of the sale of personal information. We do not sell personal information.
          </p>
        </section>

        <section>
          <h2 className="text-[#1A202C] text-lg font-semibold mt-8 mb-3">
            8. Children's Privacy
          </h2>
          <p>
            SideDoor is not intended for anyone under 18 years of age. We do not knowingly collect
            information from minors.
          </p>
        </section>

        <section>
          <h2 className="text-[#1A202C] text-lg font-semibold mt-8 mb-3">
            9. Changes to This Policy
          </h2>
          <p>
            We may update this privacy policy from time to time. We'll notify you of meaningful
            changes via email or in-app notice. The "Last Updated" date at the top indicates when
            this policy was last revised.
          </p>
        </section>

        <section className="pb-8">
          <h2 className="text-[#1A202C] text-lg font-semibold mt-8 mb-3">10. Contact Us</h2>
          <p>
            Questions or concerns about your privacy? Email us at{" "}
            <a href="mailto:support@sidedoor.com" className="text-[#6B46C1] hover:underline">
              support@sidedoor.com
            </a>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
