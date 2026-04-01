import { useState } from "react";
import type { FormEventHandler } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase/config";

type FormState = {
  companyName: string;
  contactName: string;
  title: string;
  email: string;
  phone: string;
  officeAddress: string;
  teamSize: string;
  lunchFrequency: string;
  budgetRange: string;
  preferredStartDate: string;
  notes: string;
};

const initialForm: FormState = {
  companyName: "",
  contactName: "",
  title: "",
  email: "",
  phone: "",
  officeAddress: "",
  teamSize: "",
  lunchFrequency: "",
  budgetRange: "",
  preferredStartDate: "",
  notes: "",
};

const BRAND = {
  orange: "#FF6B35",
  navy: "#2D3142",
  teal: "#4ECDC4",
  light: "#F8FAFC",
  text: "#24324A",
  white: "#FFFFFF",
  border: "#E5E7EB",
};

const CorporateOnboardingPage = () => {
  const [form, setForm] = useState<FormState>(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const updateField = (key: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const scrollToForm = () => {
    const el = document.getElementById("corporate-intake-form");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleSubmit: FormEventHandler<HTMLFormElement> = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setSuccess("");
    setError("");

    try {
      await addDoc(collection(db, "corporateOnboardingSubmissions"), {
        ...form,
        source: "website_corporate_onboarding",
        status: "new",
        clientType: "corporate",
        pricingModel: "pay_per_order",
        agreementSent: false,
        agreementSigned: false,
        docusignStatus: "not_sent",
        onboardingStage: "intake_submitted",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setSuccess(
        "Submission received. DinersCrush will follow up with your full onboarding documents."
      );
      setForm(initialForm);
    } catch (err) {
      console.error(err);
      setError("Something went wrong while submitting. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <style>{`
        * {
          box-sizing: border-box;
        }

        .corp-page {
          background: ${BRAND.light};
          color: ${BRAND.text};
        }

        .corp-container {
          max-width: 1180px;
          margin: 0 auto;
          padding: 0 24px;
        }

        .corp-section {
          padding: 48px 0;
        }

        .corp-hero {
          background: linear-gradient(135deg, ${BRAND.navy} 0%, #222838 100%);
          color: ${BRAND.white};
          padding: 36px 0 42px;
        }

        .corp-hero-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.08fr) minmax(320px, 430px);
          gap: 24px;
          align-items: center;
        }

        .corp-kicker {
          display: inline-flex;
          align-items: center;
          padding: 8px 14px;
          border-radius: 999px;
          background: rgba(78, 205, 196, 0.12);
          border: 1px solid rgba(78, 205, 196, 0.24);
          color: ${BRAND.teal};
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.02em;
          margin-bottom: 8px;
        }

        .corp-title {
          margin: 0 0 14px;
          font-size: clamp(2.35rem, 5vw, 4.2rem);
          line-height: 1.04;
          font-weight: 800;
          letter-spacing: -0.03em;
          max-width: 720px;
        }

        .corp-title .accent {
          color: ${BRAND.orange};
        }

        .corp-lead {
          margin: 0 0 24px;
          font-size: 17px;
          line-height: 1.72;
          color: rgba(255,255,255,0.88);
          max-width: 670px;
        }

        .corp-button-row {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
        }

        .corp-btn {
          appearance: none;
          border: none;
          text-decoration: none;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 48px;
          padding: 0 20px;
          border-radius: 12px;
          font-size: 15px;
          font-weight: 700;
          transition: all 0.2s ease;
        }

        .corp-btn-primary {
          background: ${BRAND.orange};
          color: ${BRAND.white};
          box-shadow: 0 8px 20px rgba(255, 107, 53, 0.18);
        }

        .corp-btn-primary:hover {
          transform: translateY(-1px);
          opacity: 0.97;
        }

        .corp-btn-secondary {
          background: transparent;
          color: ${BRAND.white};
          border: 1px solid rgba(255,255,255,0.22);
        }

        .corp-btn-secondary:hover {
          background: rgba(255,255,255,0.06);
        }

        .corp-card {
          background: ${BRAND.white};
          border-radius: 20px;
          box-shadow: 0 14px 36px rgba(17, 24, 39, 0.12);
        }

        .corp-hero-card {
          padding: 24px;
          color: ${BRAND.text};
        }

        .corp-hero-card h3 {
          margin: 0 0 16px;
          font-size: 22px;
          color: ${BRAND.navy};
        }

        .corp-hero-list {
          display: grid;
          gap: 10px;
        }

        .corp-hero-item {
          padding: 13px 14px;
          border-radius: 14px;
          background: #F8FAFC;
          border: 1px solid #EAEFF5;
        }

        .corp-hero-item strong {
          display: block;
          font-size: 15px;
          color: ${BRAND.navy};
          margin-bottom: 4px;
        }

        .corp-hero-item span {
          font-size: 14px;
          line-height: 1.55;
          color: #5F6C80;
        }

        .corp-hero-item.highlight {
          background: rgba(255,107,53,0.08);
          border-color: rgba(255,107,53,0.22);
        }

        .corp-heading-wrap {
          margin-bottom: 20px;
          text-align: center;
        }

        .corp-heading {
          margin: 0 0 10px;
          font-size: clamp(2rem, 4vw, 2.65rem);
          line-height: 1.1;
          font-weight: 800;
          letter-spacing: -0.02em;
          color: ${BRAND.navy};
        }

        .corp-subheading {
          margin: 0 auto;
          max-width: 740px;
          text-align: center;
          font-size: 16px;
          line-height: 1.7;
          color: #5F6C80;
        }

        .corp-grid-3 {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 20px;
        }

        .corp-feature {
          background: ${BRAND.white};
          border: 1px solid ${BRAND.border};
          border-radius: 18px;
          padding: 24px 22px;
          box-shadow: 0 10px 24px rgba(15, 23, 42, 0.04);
          text-align: left;
        }

        .corp-feature-number {
          width: 38px;
          height: 38px;
          border-radius: 12px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: rgba(255,107,53,0.1);
          color: ${BRAND.orange};
          font-weight: 800;
          margin-bottom: 12px;
        }

        .corp-feature h3 {
          margin: 0 0 8px;
          font-size: 20px;
          color: ${BRAND.navy};
        }

        .corp-feature p {
          margin: 0;
          color: #5F6C80;
          font-size: 15px;
          line-height: 1.65;
        }

        .corp-band {
          background: linear-gradient(135deg, ${BRAND.orange} 0%, #f97316 100%);
          color: ${BRAND.white};
        }

        .corp-band .corp-heading,
        .corp-band .corp-subheading {
          color: ${BRAND.white};
        }

        .corp-pricing-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 20px;
        }

        .corp-price-card {
          background: ${BRAND.white};
          color: ${BRAND.text};
          border-radius: 20px;
          padding: 26px 24px;
          box-shadow: 0 12px 30px rgba(17, 24, 39, 0.08);
        }

        .corp-price-card h3 {
          margin: 0 0 10px;
          color: ${BRAND.navy};
          font-size: 24px;
        }

        .corp-price {
          margin: 0 0 14px;
          font-size: 42px;
          line-height: 1;
          font-weight: 800;
          color: ${BRAND.orange};
        }

        .corp-list {
          margin: 0;
          padding-left: 18px;
        }

        .corp-list li {
          margin-bottom: 9px;
          color: #5F6C80;
          line-height: 1.6;
        }

        .corp-faq-grid {
          display: grid;
          gap: 14px;
          max-width: 920px;
          margin: 0 auto;
        }

        .corp-faq-item {
          background: ${BRAND.white};
          border: 1px solid ${BRAND.border};
          border-radius: 18px;
          padding: 20px 22px;
          box-shadow: 0 10px 24px rgba(15, 23, 42, 0.04);
        }

        .corp-faq-item h4 {
          margin: 0 0 7px;
          color: ${BRAND.navy};
          font-size: 18px;
        }

        .corp-faq-item p {
          margin: 0;
          color: #5F6C80;
          line-height: 1.65;
          font-size: 15px;
        }

        .corp-form-section {
          padding-top: 44px;
          padding-bottom: 60px;
        }

        .corp-form-grid {
          display: grid;
          grid-template-columns: minmax(280px, 350px) minmax(0, 1fr);
          gap: 22px;
          align-items: start;
        }

        .corp-side-card,
        .corp-form-card {
          background: ${BRAND.white};
          border: 1px solid ${BRAND.border};
          border-radius: 20px;
          box-shadow: 0 12px 28px rgba(15, 23, 42, 0.05);
        }

        .corp-side-card {
          padding: 24px 22px;
          position: sticky;
          top: 92px;
        }

        .corp-form-card {
          padding: 28px 24px;
        }

        .corp-side-card h3,
        .corp-form-card h3 {
          margin: 0 0 12px;
          color: ${BRAND.navy};
          font-size: 24px;
        }

        .corp-side-card p {
          margin: 0 0 16px;
          color: #5F6C80;
          line-height: 1.65;
        }

        .corp-step-list {
          display: grid;
          gap: 10px;
          margin-top: 18px;
        }

        .corp-step-item {
          padding: 13px 14px;
          border-radius: 14px;
          background: #F8FAFC;
          border: 1px solid ${BRAND.border};
          color: #5F6C80;
          line-height: 1.55;
        }

        .corp-step-item strong {
          display: block;
          margin-bottom: 4px;
          color: ${BRAND.navy};
        }

        .corp-contact {
          margin-top: 22px;
          padding-top: 18px;
          border-top: 1px solid ${BRAND.border};
          color: #5F6C80;
          line-height: 1.75;
          font-size: 15px;
        }

        .corp-fields {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 16px;
        }

        .corp-field {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .corp-field.full {
          grid-column: 1 / -1;
        }

        .corp-label {
          font-size: 14px;
          font-weight: 700;
          color: ${BRAND.navy};
        }

        .corp-input,
        .corp-select,
        .corp-textarea {
          width: 100%;
          padding: 13px 14px;
          border-radius: 12px;
          border: 1px solid ${BRAND.border};
          background: ${BRAND.white};
          color: ${BRAND.text};
          font-size: 15px;
          outline: none;
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }

        .corp-input:focus,
        .corp-select:focus,
        .corp-textarea:focus {
          border-color: ${BRAND.teal};
          box-shadow: 0 0 0 3px rgba(78,205,196,0.14);
        }

        .corp-textarea {
          min-height: 120px;
          resize: vertical;
        }

        .corp-submit-row {
          margin-top: 18px;
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }

        .corp-message {
          margin-top: 14px;
          padding: 14px 16px;
          border-radius: 12px;
          font-size: 14px;
          line-height: 1.6;
        }

        .corp-message.success {
          background: rgba(78,205,196,0.12);
          border: 1px solid rgba(78,205,196,0.22);
          color: #0F5F61;
        }

        .corp-message.error {
          background: rgba(239,68,68,0.08);
          border: 1px solid rgba(239,68,68,0.16);
          color: #991B1B;
        }

        .corp-footer {
          background: ${BRAND.navy};
          color: rgba(255,255,255,0.86);
          padding: 22px 0;
          text-align: center;
        }

        .corp-footer p {
          margin: 0;
          font-size: 14px;
          line-height: 1.7;
        }

        @media (max-width: 1024px) {
          .corp-hero-grid,
          .corp-form-grid {
            grid-template-columns: 1fr;
          }

          .corp-side-card {
            position: static;
          }
        }

        @media (max-width: 768px) {
          .corp-section,
          .corp-form-section {
            padding: 40px 0;
          }

          .corp-hero {
            padding: 30px 0 34px;
          }

          .corp-grid-3,
          .corp-pricing-grid,
          .corp-fields {
            grid-template-columns: 1fr;
          }

          .corp-container {
            padding: 0 18px;
          }

          .corp-title {
            font-size: 2.15rem;
          }

          .corp-button-row {
            flex-direction: column;
            align-items: stretch;
          }

          .corp-btn {
            width: 100%;
          }

          .corp-heading-wrap {
            margin-bottom: 18px;
          }
        }
      `}</style>

      <div className="corp-page">
        <section className="corp-hero">
          <div className="corp-container">
            <div className="corp-hero-grid">
              <div>
                <div className="corp-kicker">Corporate Lunch & Catering</div>

                <h1 className="corp-title">
                  Office meals that feel <span className="accent">organized</span>, local, and easy.
                </h1>

                <p className="corp-lead">
                  DinersCrush helps offices coordinate recurring lunches, team meals, and catering
                  without wasting staff time. We handle local restaurant coordination, delivery flow,
                  and follow-up so your team can focus on work.
                </p>

                <div className="corp-button-row">
                  <button className="corp-btn corp-btn-primary" onClick={scrollToForm}>
                    Start Corporate Onboarding
                  </button>

                  <a
                    href="mailto:dinerscrushteam@gmail.com"
                    className="corp-btn corp-btn-secondary"
                  >
                    Email DinersCrush
                  </a>
                </div>
              </div>

              <div className="corp-card corp-hero-card">
                <h3>Why Companies Use DinersCrush</h3>

                <div className="corp-hero-list">
                  <div className="corp-hero-item">
                    <strong>Local coordination</strong>
                    <span>We help you place group meal orders with local restaurant partners.</span>
                  </div>

                  <div className="corp-hero-item">
                    <strong>Pay-per-order start</strong>
                    <span>No long commitment upfront. Start with a pilot and evaluate from there.</span>
                  </div>

                  <div className="corp-hero-item highlight">
                    <strong>First-month pilot offer</strong>
                    <span>DinersCrush coordination fee waived during the initial pilot period.</span>
                  </div>

                  <div className="corp-hero-item">
                    <strong>Built for repeat office orders</strong>
                    <span>Best for weekly lunches, staff meals, office meetings, and simple catering.</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="corp-section">
          <div className="corp-container">
            <div className="corp-heading-wrap">
              <h2 className="corp-heading">How DinersCrush Works for Offices</h2>
              <p className="corp-subheading">
                DinersCrush is built to help local offices handle team lunches and catering in a
                simpler, more dependable way.
              </p>
            </div>

            <div className="corp-grid-3">
              <div className="corp-feature">
                <div className="corp-feature-number">1</div>
                <h3>Quick Intake</h3>
                <p>
                  Tell us your office address, team size, lunch frequency, preferred budget, and
                  main point of contact.
                </p>
              </div>

              <div className="corp-feature">
                <div className="corp-feature-number">2</div>
                <h3>Pilot Setup</h3>
                <p>
                  We confirm your needs, align on payment and delivery expectations, and prepare
                  your pilot flow.
                </p>
              </div>

              <div className="corp-feature">
                <div className="corp-feature-number">3</div>
                <h3>Order Support</h3>
                <p>
                  DinersCrush stays available for coordination, timing, adjustments, and follow-up
                  throughout the pilot.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="corp-section corp-band">
          <div className="corp-container">
            <div className="corp-heading-wrap">
              <h2 className="corp-heading">Pilot Pricing</h2>
              <p className="corp-subheading">
                Keep the first deal easy. Prove value first, then formalize the recurring process.
              </p>
            </div>

            <div className="corp-pricing-grid">
              <div className="corp-price-card">
                <h3>Month 1 Pilot</h3>
                <div className="corp-price">$0</div>
                <ul className="corp-list">
                  <li>No DinersCrush coordination fee during the initial pilot</li>
                  <li>Client pays for food, delivery, and tip</li>
                  <li>Best for proving service quality and repeat demand</li>
                  <li>Good starting structure for a first corporate crush</li>
                </ul>
              </div>

              <div className="corp-price-card">
                <h3>After Pilot</h3>
                <div className="corp-price">10%</div>
                <ul className="corp-list">
                  <li>Coordination fee per order after the pilot period</li>
                  <li>Recommended for recurring office lunches and catering orders</li>
                  <li>Pay-per-order structure to start</li>
                  <li>Can be reviewed after early order volume is established</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section className="corp-section">
          <div className="corp-container">
            <div className="corp-heading-wrap">
              <h2 className="corp-heading">Frequently Asked Questions</h2>
              <p className="corp-subheading">
                Simple answers for companies considering an office lunch or catering pilot.
              </p>
            </div>

            <div className="corp-faq-grid">
              <div className="corp-faq-item">
                <h4>Do we need a long-term contract to start?</h4>
                <p>
                  No. DinersCrush can start with a simple pilot so your team can test the service
                  before committing to recurring ordering.
                </p>
              </div>

              <div className="corp-faq-item">
                <h4>How do payments work?</h4>
                <p>
                  For the start, payment terms are pay-per-order. We can review broader billing
                  arrangements later if your volume becomes recurring.
                </p>
              </div>

              <div className="corp-faq-item">
                <h4>What happens after we submit the form?</h4>
                <p>
                  DinersCrush reviews your intake, confirms your setup, and then sends the complete
                  onboarding documents for signature and billing setup.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="corp-form-section" id="corporate-intake-form">
          <div className="corp-container">
            <div className="corp-heading-wrap">
              <h2 className="corp-heading">Start Corporate Onboarding</h2>
              <p className="corp-subheading">
                Submit the short intake form and DinersCrush will prepare your next onboarding step.
              </p>
            </div>

            <div className="corp-form-grid">
              <div className="corp-side-card">
                <h3>What Happens Next</h3>
                <p>
                  This short form helps DinersCrush gather the basics before sending your complete
                  onboarding documents.
                </p>

                <div className="corp-step-list">
                  <div className="corp-step-item">
                    <strong>Step 1</strong>
                    We receive your company intake details.
                  </div>
                  <div className="corp-step-item">
                    <strong>Step 2</strong>
                    We review your office lunch or catering needs.
                  </div>
                  <div className="corp-step-item">
                    <strong>Step 3</strong>
                    We send the full onboarding documents for completion.
                  </div>
                </div>

                <div className="corp-contact">
                  <strong style={{ color: BRAND.navy }}>Contact</strong>
                  <br />
                  dinerscrushteam@gmail.com
                  <br />
                  (312) 752 0672
                </div>
              </div>

              <div className="corp-form-card">
                <h3>Corporate Intake Form</h3>

                <form onSubmit={handleSubmit}>
                  <div className="corp-fields">
                    <div className="corp-field full">
                      <label className="corp-label">Company / Office Name</label>
                      <input
                        className="corp-input"
                        type="text"
                        placeholder="Enter company or office name"
                        value={form.companyName}
                        onChange={(e) => updateField("companyName", e.target.value)}
                        required
                      />
                    </div>

                    <div className="corp-field">
                      <label className="corp-label">Main Contact Name</label>
                      <input
                        className="corp-input"
                        type="text"
                        placeholder="Full name"
                        value={form.contactName}
                        onChange={(e) => updateField("contactName", e.target.value)}
                        required
                      />
                    </div>

                    <div className="corp-field">
                      <label className="corp-label">Job Title</label>
                      <input
                        className="corp-input"
                        type="text"
                        placeholder="Office Manager / Practice Manager / Admin"
                        value={form.title}
                        onChange={(e) => updateField("title", e.target.value)}
                      />
                    </div>

                    <div className="corp-field">
                      <label className="corp-label">Email Address</label>
                      <input
                        className="corp-input"
                        type="email"
                        placeholder="name@company.com"
                        value={form.email}
                        onChange={(e) => updateField("email", e.target.value)}
                        required
                      />
                    </div>

                    <div className="corp-field">
                      <label className="corp-label">Phone Number</label>
                      <input
                        className="corp-input"
                        type="tel"
                        placeholder="(000) 000-0000"
                        value={form.phone}
                        onChange={(e) => updateField("phone", e.target.value)}
                        required
                      />
                    </div>

                    <div className="corp-field full">
                      <label className="corp-label">Office Address</label>
                      <input
                        className="corp-input"
                        type="text"
                        placeholder="Street address where lunches/catering will be delivered"
                        value={form.officeAddress}
                        onChange={(e) => updateField("officeAddress", e.target.value)}
                        required
                      />
                    </div>

                    <div className="corp-field">
                      <label className="corp-label">Estimated Team Size</label>
                      <input
                        className="corp-input"
                        type="text"
                        placeholder="e.g. 8, 15, 30"
                        value={form.teamSize}
                        onChange={(e) => updateField("teamSize", e.target.value)}
                      />
                    </div>

                    <div className="corp-field">
                      <label className="corp-label">Lunch Frequency</label>
                      <select
                        className="corp-select"
                        value={form.lunchFrequency}
                        onChange={(e) => updateField("lunchFrequency", e.target.value)}
                      >
                        <option value="">Select frequency</option>
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="biweekly">Bi-weekly</option>
                        <option value="monthly">Monthly</option>
                        <option value="one_time">One-time order</option>
                        <option value="as_needed">As needed</option>
                      </select>
                    </div>

                    <div className="corp-field">
                      <label className="corp-label">Budget Range</label>
                      <select
                        className="corp-select"
                        value={form.budgetRange}
                        onChange={(e) => updateField("budgetRange", e.target.value)}
                      >
                        <option value="">Select budget</option>
                        <option value="under_100">Under $100</option>
                        <option value="100_250">$100 - $250</option>
                        <option value="250_500">$250 - $500</option>
                        <option value="500_1000">$500 - $1,000</option>
                        <option value="1000_plus">$1,000+</option>
                      </select>
                    </div>

                    <div className="corp-field">
                      <label className="corp-label">Preferred Start Date</label>
                      <input
                        className="corp-input"
                        type="date"
                        value={form.preferredStartDate}
                        onChange={(e) => updateField("preferredStartDate", e.target.value)}
                      />
                    </div>

                    <div className="corp-field full">
                      <label className="corp-label">Notes / Dietary / Delivery Preferences</label>
                      <textarea
                        className="corp-textarea"
                        placeholder="Anything we should know about timing, dietary restrictions, recurring meetings, invoicing, or approvals?"
                        value={form.notes}
                        onChange={(e) => updateField("notes", e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="corp-submit-row">
                    <button className="corp-btn corp-btn-primary" type="submit" disabled={submitting}>
                      {submitting ? "Submitting..." : "Submit Corporate Intake"}
                    </button>
                  </div>

                  {success && <div className="corp-message success">{success}</div>}
                  {error && <div className="corp-message error">{error}</div>}
                </form>
              </div>
            </div>
          </div>
        </section>

        <footer className="corp-footer">
          <div className="corp-container">
            <p>
              © 2026 DinersCrush · Corporate Lunch & Catering · dinerscrushteam@gmail.com · (312) 752 0672
            </p>
          </div>
        </footer>
      </div>
    </>
  );
};

export default CorporateOnboardingPage;
