import { useEffect, useRef, useState } from "react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Checkbox } from "../components/ui/checkbox";
import {
  Mail,
  Lock,
  User,
  ArrowLeft,
  Building2,
  Loader2,
  CheckCircle2,
  ShieldCheck,
  RefreshCw,
} from "lucide-react";
import { registerUser, verifyEmail, resendVerification } from "../services/auth";
import { toast } from "sonner@2.0.3";

type SignUpProps = {
  onBack?: () => void;
  onSwitchToLogin?: () => void;
};

export function SignUp({ onBack, onSwitchToLogin }: SignUpProps) {
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    company: "",
    password: "",
    confirmPassword: "",
  });
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [awaitingVerification, setAwaitingVerification] = useState(false);
  const [pendingEmail, setPendingEmail] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const res = await registerUser(
        formData.email,
        formData.password,
        formData.fullName,
        formData.company
      );
      if (res.requiresVerification) {
        setAwaitingVerification(true);
        setPendingEmail(res.user.email);
      } else {
        toast.success(res.message ?? "Account created successfully!");
        onSwitchToLogin?.();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sign up failed. Please try again.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!pendingEmail || !verificationCode) {
      toast.error("Please enter both email and verification code.");
      return;
    }
    setLoading(true);
    try {
      await verifyEmail(pendingEmail, verificationCode, false);
      setShowSuccessModal(true);
      timerRef.current = setTimeout(() => {
        setShowSuccessModal(false);
        setAwaitingVerification(false);
        onSwitchToLogin?.();
      }, 3000);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Verification failed.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (!pendingEmail) return;
    setLoading(true);
    try {
      const res = await resendVerification(pendingEmail);
      toast.success(res.message || "Verification code resent to your email.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to resend code.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="login-page">
      <div className="login-header">
        <div className="login-header-inner">
          <div className="login-header-content">
            <h1 className="login-brand">SocialHub</h1>
            {onBack && (
              <Button variant="ghost" onClick={onBack} className="login-back-button">
                <ArrowLeft className="h-4 w-4" />
                Back to Home
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="login-main">
        <div className="login-card-container">
          <div className="login-welcome">
            <h2 className="login-title">Create your SocialHub account</h2>
            <p className="login-subtitle">Design dashboards with AI-powered automation</p>
          </div>

          <div className="login-card">
            <form onSubmit={handleSubmit} className="login-form space-y-5">
              <div className="space-y-2">
                <Label htmlFor="fullName" className="login-label">
                  Full name
                </Label>
                <div className="relative">
                  <div className="login-icon">
                    <User className="h-5 w-5" />
                  </div>
                  <Input
                    id="fullName"
                    type="text"
                    placeholder="John Doe"
                    value={formData.fullName}
                    onChange={(e) => handleChange("fullName", e.target.value)}
                    className="login-input pl-10"
                    disabled={awaitingVerification}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="login-label">
                  Work email
                </Label>
                <div className="relative">
                  <div className="login-icon">
                    <Mail className="h-5 w-5" />
                  </div>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@company.com"
                    value={formData.email}
                    onChange={(e) => handleChange("email", e.target.value)}
                    className="login-input pl-10"
                    disabled={awaitingVerification}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="company" className="login-label">
                  Company name (optional)
                </Label>
                <div className="relative">
                  <div className="login-icon">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <Input
                    id="company"
                    type="text"
                    placeholder="Acme Inc."
                    value={formData.company}
                    onChange={(e) => handleChange("company", e.target.value)}
                    className="login-input pl-10"
                    disabled={awaitingVerification}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="login-label">
                    Password
                  </Label>
                  <label className="login-inline-toggle">
                    <Checkbox
                      id="signup-show-password"
                      checked={showPassword}
                      onCheckedChange={(checked) => setShowPassword(Boolean(checked))}
                      className="login-checkbox"
                    />
                    <span>Show password</span>
                  </label>
                </div>
                <div className="relative">
                  <div className="login-icon">
                    <Lock className="h-5 w-5" />
                  </div>
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Create a strong password"
                    value={formData.password}
                    onChange={(e) => handleChange("password", e.target.value)}
                    className="login-input pl-10"
                    disabled={awaitingVerification}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="login-label">
                  Confirm password
                </Label>
                <div className="relative">
                  <div className="login-icon">
                    <Lock className="h-5 w-5" />
                  </div>
                  <Input
                    id="confirmPassword"
                    type={showPassword ? "text" : "password"}
                    placeholder="Re-enter your password"
                    value={formData.confirmPassword}
                    onChange={(e) => handleChange("confirmPassword", e.target.value)}
                    className="login-input pl-10"
                    disabled={awaitingVerification}
                    required
                  />
                </div>
              </div>

              <label className="login-inline-toggle items-start">
                <Checkbox
                  id="terms"
                  checked={agreeToTerms}
                  onCheckedChange={(checked) => setAgreeToTerms(checked as boolean)}
                  disabled={awaitingVerification}
                  className="login-checkbox"
                  required
                />
                <span className="text-sm text-white/80 leading-relaxed">
                  I agree to the <a href="#" className="login-link">Terms of Service</a> and <a href="#" className="login-link">Privacy Policy</a>
                </span>
              </label>

              <Button
                type="submit"
                className="login-primary-button w-full"
                disabled={!agreeToTerms || loading || awaitingVerification}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create account"
                )}
              </Button>
            </form>

            {awaitingVerification && (
              <div className="login-reset-panel space-y-3 mt-6">
                <div className="flex items-center text-white font-medium">
                  <ShieldCheck className="h-5 w-5 mr-2" />
                  Verify your email
                </div>
                <p className="login-reset-copy">
                  We sent a verification code to <span className="font-semibold text-white">{pendingEmail}</span>. Enter it below to activate your
                  account.
                </p>
                <Input
                  placeholder="Enter 6-digit code"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  className="login-input"
                />
                <div className="flex gap-3">
                  <Button type="button" className="login-primary-button flex-1" onClick={handleVerifyCode} disabled={loading}>
                    <ShieldCheck className="h-4 w-4 mr-2" />
                    Verify code
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="login-secondary-button flex-1"
                    onClick={handleResendCode}
                    disabled={loading}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Resend
                  </Button>
                </div>
              </div>
            )}
          </div>

          <p className="login-footer-text">
            Already have an account?{" "}
            <button onClick={onSwitchToLogin} className="login-link">
              Sign in
            </button>
          </p>

          <p className="login-terms">
            Start with a <span className="login-link">14-day free trial</span> — no credit card required
          </p>
        </div>
      </div>

      {showSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-64 rounded-2xl bg-white p-6 text-center shadow-2xl space-y-3">
            <div className="mx-auto h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="h-7 w-7 text-green-500" />
            </div>
            <p className="text-base font-semibold text-gray-900">Account created!</p>
            <p className="text-xs text-gray-600">Redirecting to the sign-in page...</p>
          </div>
        </div>
      )}
    </div>
  );
}




