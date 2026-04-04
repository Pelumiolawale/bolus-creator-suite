import { Link } from "react-router-dom";

const T = {
  bg: "#1A1A1A", card: "#1C1C1A", border: "#2A2A28",
  gold: "#C9A84C", text: "#F0EDE6", muted: "#8A8780",
};

export default function TermsPage() {
  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.text, fontFamily: "'DM Sans',sans-serif" }}>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "48px 24px 80px" }}>

        <Link to="/" style={{ display: "inline-flex", alignItems: "center", gap: 8, color: T.gold, textDecoration: "none", fontSize: 14, marginBottom: 32 }}>
          <span style={{ fontSize: 20 }}>&larr;</span> Back to Dashboard
        </Link>

        <h1 style={{ fontFamily: "'Playfair Display',serif", fontSize: 32, color: T.gold, fontWeight: 700, margin: "0 0 8px" }}>
          Terms of Service
        </h1>
        <p style={{ color: T.muted, fontSize: 13, margin: "0 0 12px" }}>Bolus Creator Suite</p>
        <p style={{ color: T.muted, fontSize: 13, margin: "0 0 40px" }}>Last updated: April 2026</p>

        <Section title="1. Acceptance of Terms">
          By accessing or using Bolus Creator Suite ("the Service"), you agree to be bound by these Terms of Service. If you do not agree, you may not use the Service.
        </Section>

        <Section title="2. Personal Use Only">
          The Service is licensed for your personal, non-commercial use only. You may not redistribute, sublicense, or resell the Service or any data derived from it without prior written consent.
        </Section>

        <Section title="3. Your Data &amp; Ownership">
          You retain full ownership of all content, analytics data, and creative materials associated with your account. We do not claim any intellectual property rights over your data. You may export or delete your data at any time.
        </Section>

        <Section title="4. Service Availability">
          We strive to keep the Service available at all times, but we do not guarantee uninterrupted access. The Service may be modified, suspended, or discontinued at any time, with or without notice. We will make reasonable efforts to notify active users before any planned discontinuation.
        </Section>

        <Section title="5. No Warranty">
          The Service is provided "as is" and "as available" without warranties of any kind, whether express or implied, including but not limited to implied warranties of merchantability, fitness for a particular purpose, or non-infringement. We do not warrant that analytics data will be accurate, complete, or current.
        </Section>

        <Section title="6. Limitation of Liability">
          To the maximum extent permitted by law, Bolus Creator Suite and its operators shall not be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of profits or revenue, arising from your use of the Service.
        </Section>

        <Section title="7. Third-Party Integrations">
          The Service integrates with third-party platforms (including Instagram and TikTok). Your use of those platforms is governed by their respective terms and policies. We are not responsible for changes to third-party APIs that may affect Service functionality.
        </Section>

        <Section title="8. Modifications to Terms">
          We reserve the right to update these Terms at any time. Continued use of the Service after changes constitutes acceptance of the revised Terms.
        </Section>

        <Section title="9. Contact">
          If you have questions about these Terms, please reach out through the contact information provided within the application.
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
