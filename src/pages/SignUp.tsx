import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Separator } from "../components/ui/separator";
import { Checkbox } from "../components/ui/checkbox";
import {
  Mail,
  Lock,
  User,
  ArrowLeft,
  Sparkles,
  Building2,
  Loader2,
  CheckCircle2,
  ShieldCheck,
  RefreshCw,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 flex flex-col">
      <div className="w-full bg-white/95 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl text-primary">SocialHub</h1>
            {onBack && (
              <Button variant="ghost" onClick={onBack}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Home
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8 py-12">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
              <Sparkles className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-3xl text-gray-900 mb-2">Create your account</h2>
            <p className="text-gray-600">Start building powerful dashboards today</p>
          </div>

          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-8">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="fullName">Full name</Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User className="h-5 w-5 text-gray-400" />
                  </div>
                  <Input
                    id="fullName"
                    type="text"
                    placeholder="John Doe"
                    value={formData.fullName}
                    onChange={(e) => handleChange("fullName", e.target.value)}
                    className="pl-10"
                    disabled={awaitingVerification}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Work email</Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-gray-400" />
                  </div>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@company.com"
                    value={formData.email}
                    onChange={(e) => handleChange("email", e.target.value)}
                    className="pl-10"
                    disabled={awaitingVerification}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="company">Company name (optional)</Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Building2 className="h-5 w-5 text-gray-400" />
                  </div>
                  <Input
                    id="company"
                    type="text"
                    placeholder="Acme Inc."
                    value={formData.company}
                    onChange={(e) => handleChange("company", e.target.value)}
                    className="pl-10"
                    disabled={awaitingVerification}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <label className="flex items-center space-x-2 text-sm text-gray-600 cursor-pointer select-none">
                    <Checkbox
                      id="signup-show-password"
                      checked={showPassword}
                      onCheckedChange={(checked) => setShowPassword(Boolean(checked))}
                    />
                    <span>Show password</span>
                  </label>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Create a strong password"
                    value={formData.password}
                    onChange={(e) => handleChange("password", e.target.value)}
                    className="pl-10"
                    disabled={awaitingVerification}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm password</Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <Input
                    id="confirmPassword"
                    type={showPassword ? "text" : "password"}
                    placeholder="Re-enter your password"
                    value={formData.confirmPassword}
                    onChange={(e) => handleChange("confirmPassword", e.target.value)}
                    className="pl-10"
                    disabled={awaitingVerification}
                    required
                  />
                </div>
              </div>

              <div className="flex items-start space-x-2">
                <Checkbox
                  id="terms"
                  checked={agreeToTerms}
                  onCheckedChange={(checked) => setAgreeToTerms(checked as boolean)}
                  disabled={awaitingVerification}
                  required
                />
                <label htmlFor="terms" className="text-sm text-gray-700 cursor-pointer leading-relaxed">
                  I agree to the{" "}
                  <a href="#" className="text-primary hover:underline">Terms of Service</a>{" "}
                  and{" "}
                  <a href="#" className="text-primary hover:underline">Privacy Policy</a>
                </label>
              </div>

              <Button type="submit" className="w-full" disabled={!agreeToTerms || loading || awaitingVerification}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Account"
                )}
              </Button>
            </form>

            {awaitingVerification && (
              <div className="mt-6 rounded-xl border border-dashed border-primary/40 bg-primary/5 p-4 space-y-3">
                <div className="flex items-center text-primary font-medium">
                  <ShieldCheck className="h-5 w-5 mr-2" />
                  Verify your email
                </div>
                <p className="text-sm text-gray-700">
                  We sent a verification code to <span className="font-medium">{pendingEmail}</span>. Enter the code below to activate your account.
                </p>
                <Input
                  placeholder="Enter 6-digit code"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                />
                <div className="flex gap-3">
                  <Button type="button" className="flex-1" onClick={handleVerifyCode} disabled={loading}>
                    <ShieldCheck className="h-4 w-4 mr-2" />
                    Verify code
                  </Button>
                  <Button type="button" variant="ghost" onClick={handleResendCode} disabled={loading}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Resend
                  </Button>
                </div>
              </div>
            )}

          </div>

          <p className="mt-6 text-center text-gray-600">
            Already have an account?{" "}
            <button onClick={onSwitchToLogin} className="text-primary hover:text-primary/80 transition-colors">Sign in</button>
          </p>

          <div className="mt-6 p-4 bg-primary/5 rounded-lg border border-primary/10">
            <p className="text-sm text-center text-gray-700">
              Start with a <span className="text-primary">14-day free trial</span> - no credit card required
            </p>
          </div>
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
