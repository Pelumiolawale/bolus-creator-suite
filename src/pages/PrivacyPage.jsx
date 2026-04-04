import { Link } from "react-router-dom";

const T = {
  bg: "#1A1A1A", card: "#1C1C1A", border: "#2A2A28",
  gold: "#C9A84C", text: "#F0EDE6", muted: "#8A8780",
};

export default function PrivacyPage() {
  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.text, fontFamily: "'DM Sans',sans-serif" }}>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "48px 24px 80px" }}>

        <Link to="/" style={{ display: "inline-flex", alignItems: "center", gap: 8, color: T.gold, textDecoration: "none", fontSize: 14, marginBottom: 32 }}>
          <span style={{ fontSize: 20 }}>&larr;</span> Back to Dashboard
        </Link>

        <h1 style={{ fontFamily: "'Playfair Display',serif", fontSize: 32, color: T.gold, fontWeight: 700, margin: "0 0 8px" }}>
          Privacy Policy
        </h1>
        <p style={{ color: T.muted, fontSize: 13, margin: "0 0 12px" }}>Bolus Creator Suite</p>
        <p style={{ color: T.muted, fontSize: 13, margin: "0 0 40px" }}>Last updated: April 2026</p>

        <Section title="1. What We Do">
          Bolus Creator Suite connects to the Instagram Graph API and TikTok API solely to retrieve your own analytics, audience insights, and content performance data. This information is displayed back to you within your personal dashboard.
        </Section>

        <Section title="2. Data Collection">
          We only access data that you explicitly authorize through the Instagram and TikTok OAuth flows. This includes your profile information, post metrics, audience demographics, and engagement data. We do not collect data from other users' accounts.
        </Section>

        <Section title="3. Data Storage">
          Your data is stored locally in your browser using localStorage. We do not maintain server-side databases of your personal analytics data. Clearing your browser data will remove all locally stored information.
        </Section>

        <Section title="4. No Data Sales">
          We do not sell, rent, trade, or otherwise share your personal data with any third parties. Your analytics data is yours alone.
        </Section>

        <Section title="5. No Third-Party Tracking">
          We do not use third-party analytics, advertising pixels, tracking cookies, or any other user-tracking mechanisms. There are no Google Analytics, Facebook Pixel, or similar services embedded in the application.
        </Section>

        <Section title="6. API Permissions">
          When you connect your Instagram or TikTok account, you grant the Service read-only access to your analytics data. We do not post, modify, or delete any content on your behalf. You can revoke access at any time through your Instagram or TikTok account settings.
        </Section>

        <Section title="7. Data Retention">
          Since data is stored in your browser's localStorage, you have full control over retention. You may clear your data at any time by clearing your browser storage or using any in-app data management features.
        </Section>

        <Section title="8. Security">
          API tokens are handled through secure server-side proxy endpoints and are never exposed in client-side code. All connections to third-party APIs use HTTPS encryption.
        </Section>

        <Section title="9. Changes to This Policy">
          We may update this Privacy Policy from time to time. Any changes will be reflected on this page with an updated "Last updated" date. Continued use of the Service constitutes acceptance of the revised policy.
        </Section>

        <Section title="10. Contact">
          If you have questions about this Privacy Policy or how your data is handled, please reach out through the contact information provided within the application.
        </Section>

      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, color: T.gold, fontWeight: 600, margin: "0 0 12px" }}>
        {title}
      </h2>
      <p style={{ color: T.text, fontSize: 15, lineHeight: 1.75, margin: 0, opacity: 0.9 }}>
        {children}
      </p>
    </div>
  );
}
