import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Mail, Phone, MapPin, Facebook, Twitter, Linkedin, Send } from "lucide-react";
import { Header } from "../components/Header";
import type { AuthUser } from "../services/auth";
import "../styles/contact.css";

type ContactForm = {
  name: string;
  email: string;
  subject: string;
  message: string;
};

const initialForm: ContactForm = {
  name: "",
  email: "",
  subject: "",
  message: "",
};

export default function Contact({ currentUser, onLogout }: { currentUser?: AuthUser | null; onLogout?: () => void }) {
  const [form, setForm] = useState<ContactForm>(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  const handleChange = (key: keyof ContactForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm((prev) => ({ ...prev, [key]: e.target.value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      setForm(initialForm);
    }, 800);
  };

  return (
    <>
      <Header
        onChatOpen={() => navigate("/chat")}
        onLoginOpen={() => navigate("/login")}
        onSignUpOpen={() => navigate("/register")}
        onProfileOpen={() => navigate("/profile")}
        onSettingsOpen={() => navigate("/settings")}
        onManageDash={() => navigate("/managedash")}
        currentUser={currentUser}
        onLogout={onLogout}
      />
      <div className="contactPage">
        <div className="contactBg" />
        <div className="contactContainer">
          <div className="contactHeader">
            <h1 className="contactTitle">Contact Us</h1>
            <p className="contactSubtitle">Have questions or need assistance? Fill out the form and our team will get back to you soon.</p>
          </div>

          <div className="contactGrid">
            <div className="glassCard">
              <div className="contactInfoHeader">
                <p className="contactInfoTitle">Contact Information</p>
              </div>

              <div className="infoList">
                <div className="infoRow">
                  <div className="infoLeft">
                    <div className="infoIcon">
                      <Mail className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="infoTextPrimary">Email</p>
                      <p className="infoTextSecondary">support@socialhub.ai</p>
                    </div>
                  </div>
                </div>

                <div className="infoRow">
                  <div className="infoLeft">
                    <div className="infoIcon">
                      <Phone className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="infoTextPrimary">Phone</p>
                      <p className="infoTextSecondary">+84 123 456 789</p>
                    </div>
                  </div>
                </div>

                <div className="infoRow">
                  <div className="infoLeft">
                    <div className="infoIcon">
                      <MapPin className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="infoTextPrimary">Address</p>
                      <p className="infoTextSecondary">Ho Chi Minh City, Vietnam</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="socialRow">
                <button className="socialBtn" aria-label="Facebook">
                  <Facebook className="w-4 h-4" />
                </button>
                <button className="socialBtn" aria-label="Twitter">
                  <Twitter className="w-4 h-4" />
                </button>
                <button className="socialBtn" aria-label="LinkedIn">
                  <Linkedin className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="glassCard">
              <div className="formHeader">
                <p className="formTitle">Send us a message</p>
              </div>
              <form onSubmit={handleSubmit} className="formGrid">
                <div className="formField">
                  <label htmlFor="name">Full Name</label>
                  <input
                    id="name"
                    className="formInput"
                    placeholder="Your name"
                    value={form.name}
                    onChange={handleChange("name")}
                    required
                  />
                </div>
                <div className="formField">
                  <label htmlFor="email">Email Address</label>
                  <input
                    id="email"
                    type="email"
                    className="formInput"
                    placeholder="you@example.com"
                    value={form.email}
                    onChange={handleChange("email")}
                    required
                  />
                </div>
                <div className="formField">
                  <label htmlFor="subject">Subject</label>
                  <select id="subject" className="formSelect" value={form.subject} onChange={handleChange("subject")} required>
                    <option value="">Select a subject</option>
                    <option value="support">Support</option>
                    <option value="sales">Sales</option>
                    <option value="partnership">Partnership</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="formField" style={{ gridColumn: "1 / -1" }}>
                  <label htmlFor="message">Message</label>
                  <textarea
                    id="message"
                    className="formTextarea"
                    placeholder="How can we help?"
                    value={form.message}
                    onChange={handleChange("message")}
                    required
                  />
                </div>
                <div className="submitRow" style={{ gridColumn: "1 / -1" }}>
                  <button type="submit" className="submitBtn" disabled={submitting}>
                    {submitting ? "Sending..." : "Send Message"}
                    {!submitting && <Send className="w-4 h-4" />}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
