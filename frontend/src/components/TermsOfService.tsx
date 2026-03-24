import { ArrowLeft } from "lucide-react";

interface TermsOfServiceProps {
  onNavigate: (page: string) => void;
}

export function TermsOfService({ onNavigate }: TermsOfServiceProps) {
  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-3xl mx-auto">
      <button
        onClick={() => onNavigate("settings")}
        className="flex items-center gap-1.5 text-sm text-[#6B46C1] hover:text-[#5a3ba1] mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      <h1 className="text-[#1A202C] mb-2">Terms of Service</h1>
      <p className="text-[#94A3B8] text-sm mb-8">Last Updated: March 24, 2026</p>

      <div className="prose prose-sm max-w-none text-[#334155] space-y-6">
        <p>
          Welcome to SideDoor. By creating an account or using our platform, you agree to these
          terms. If you don't agree, please don't use SideDoor.
        </p>

        <section>
          <h2 className="text-[#1A202C] text-lg font-semibold mt-8 mb-3">1. What SideDoor Does</h2>
          <p>
            SideDoor helps job seekers find contact information for recruiters and hiring managers at
            companies they're interested in. We use third-party data providers to look up contacts
            and AI to help you draft outreach messages. SideDoor is a tool — we don't guarantee
            you'll get a job, a response, or that any contact information is accurate.
          </p>
        </section>

        <section>
          <h2 className="text-[#1A202C] text-lg font-semibold mt-8 mb-3">2. Beta Service</h2>
          <p>SideDoor is currently in beta. This means:</p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>Features may change, break, or be removed without notice.</li>
            <li>The service may experience downtime or data loss.</li>
            <li>We're actively improving and your feedback helps.</li>
            <li>We make no guarantees about uptime, reliability, or long-term availability.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-[#1A202C] text-lg font-semibold mt-8 mb-3">3. Your Account</h2>
          <p>
            You must provide accurate information when creating your account. You're responsible for
            keeping your password secure and for all activity under your account. You must be at
            least 18 years old to use SideDoor. One account per person — don't create multiple
            accounts.
          </p>
        </section>

        <section>
          <h2 className="text-[#1A202C] text-lg font-semibold mt-8 mb-3">
            4. Free Tier and Credits
          </h2>
          <p>
            Each account receives credits for contact searches. We reserve the right to change
            credit amounts, introduce paid plans, or modify the credit system at any time.
          </p>
        </section>

        <section>
          <h2 className="text-[#1A202C] text-lg font-semibold mt-8 mb-3">5. Acceptable Use</h2>
          <p>You agree NOT to:</p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>Use SideDoor to spam, harass, or send bulk unsolicited messages.</li>
            <li>
              Scrape, resell, or redistribute contact data obtained through our platform.
            </li>
            <li>
              Use the platform for any purpose that violates applicable laws, including CAN-SPAM,
              GDPR, or other anti-spam and privacy regulations.
            </li>
            <li>Misrepresent your identity or affiliation when reaching out to contacts.</li>
            <li>Attempt to reverse-engineer, hack, or abuse the platform or its APIs.</li>
            <li>Share your account credentials with others.</li>
          </ul>
          <p className="mt-3">
            You are solely responsible for how you use the contact information and outreach messages
            provided by SideDoor. We provide tools — you're responsible for using them ethically and
            legally.
          </p>
        </section>

        <section>
          <h2 className="text-[#1A202C] text-lg font-semibold mt-8 mb-3">
            6. AI-Generated Content
          </h2>
          <p>
            SideDoor uses AI to help draft outreach messages. This content is generated
            automatically and may contain errors, awkward phrasing, or inaccuracies. You should
            always review and edit AI-generated messages before sending them. We are not responsible
            for the content of messages you send to anyone.
          </p>
        </section>

        <section>
          <h2 className="text-[#1A202C] text-lg font-semibold mt-8 mb-3">
            7. Third-Party Services
          </h2>
          <p>
            SideDoor relies on third-party services including Apollo.io for contact data and
            NeverBounce for email verification. We don't control these services and aren't
            responsible for their accuracy, availability, or data practices. Their use is subject to
            their own terms and policies.
          </p>
        </section>

        <section>
          <h2 className="text-[#1A202C] text-lg font-semibold mt-8 mb-3">
            8. Intellectual Property
          </h2>
          <p>
            SideDoor and its original content, features, and functionality are owned by SideDoor.
            You retain ownership of any content you create or submit through the platform. By using
            the platform, you grant us the right to process your inputs as needed to deliver our
            services.
          </p>
        </section>

        <section>
          <h2 className="text-[#1A202C] text-lg font-semibold mt-8 mb-3">
            9. Account Termination
          </h2>
          <p>
            We may suspend or terminate your account at any time, for any reason, including
            violation of these terms. You may delete your account at any time. Upon termination, your
            data will be deleted in accordance with our Privacy Policy.
          </p>
        </section>

        <section>
          <h2 className="text-[#1A202C] text-lg font-semibold mt-8 mb-3">
            10. Limitation of Liability
          </h2>
          <p>
            To the maximum extent permitted by law, SideDoor and its founders, employees, and
            affiliates shall not be liable for any indirect, incidental, special, consequential, or
            punitive damages, including loss of profits, data, job opportunities, or goodwill.
          </p>
          <p className="mt-2">
            SideDoor is provided "as is" and "as available" without warranties of any kind, either
            express or implied. We do not warrant that contact information is accurate, that emails
            are deliverable, or that AI-generated content is appropriate for your use case.
          </p>
        </section>

        <section>
          <h2 className="text-[#1A202C] text-lg font-semibold mt-8 mb-3">
            11. Changes to These Terms
          </h2>
          <p>
            We may update these terms at any time. We'll notify you of significant changes via email
            or an in-app notice. Continued use after changes means you accept the updated terms.
          </p>
        </section>

        <section>
          <h2 className="text-[#1A202C] text-lg font-semibold mt-8 mb-3">12. Governing Law</h2>
          <p>
            These terms are governed by the laws of the United States and the Commonwealth of
            Massachusetts, without regard to conflict of law principles.
          </p>
        </section>

        <section className="pb-8">
          <h2 className="text-[#1A202C] text-lg font-semibold mt-8 mb-3">13. Contact Us</h2>
          <p>
            Questions about these terms? Email us at{" "}
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
