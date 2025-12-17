import { useState } from "react";
import { Mail, Lock, ArrowLeft, Loader2, KeyRound } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Separator } from "../components/ui/separator";
import { Checkbox } from "../components/ui/checkbox";
import { AuthUser, login, requestPasswordReset, resetPassword } from "../services/auth";
import { toast } from "sonner@2.0.3";
import { API_URL } from "../services/api";
import "../styles/login.css";

export function Login({
  onBack,
  onSwitchToSignUp,
  onSuccess,
}: {
  onBack?: () => void;
  onSwitchToSignUp?: () => void;
  onSuccess?: (user: AuthUser) => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showResetPasswords, setShowResetPasswords] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [resetRequested, setResetRequested] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await login(email, password, rememberMe);
      toast.success("Signed in successfully!");
      onSuccess?.(res.user);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sign in failed. Please try again.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = (provider: "google" | "github") => {
    window.location.href = `${API_URL}/auth/${provider}`;
  };

  const handleForgotPassword = async () => {
    if (!email) {
      toast.error("Please enter your email.");
      return;
    }
    setLoading(true);
    try {
      const { message } = await requestPasswordReset(email);
      toast.success(message || "Reset code sent. Please check your email.");
      setResetCode("");
      setNewPassword("");
      setConfirmNewPassword("");
      setResetRequested(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Khong the khoi tao reset password.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!email || !resetCode || !newPassword) {
      toast.error("Nhap day du email, ma reset va mat khau moi.");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      toast.error("Mat khau moi nhap lai khong khop.");
      return;
    }
    setLoading(true);
    try {
      await resetPassword(email, resetCode, newPassword);
      toast.success("Password reset successfully. Please sign in.");
      setNewPassword("");
      setResetCode("");
      setConfirmNewPassword("");
      setResetRequested(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Khong the dat lai mat khau.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
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
            <h2 className="login-title">Welcome!</h2>
            <p className="login-subtitle">Sign in to your SocialHub account</p>
          </div>

          <div className="login-card">
            <form onSubmit={handleSubmit} className="login-form space-y-6">
              <div className="space-y-2">
                <Label htmlFor="email" className="login-label">
                  Email address
                </Label>
                <div className="relative">
                  <div className="login-icon">
                    <Mail className="h-5 w-5" />
                  </div>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="login-input pl-10"
                    required
                  />
                </div>
              </div>

              {!resetRequested && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="login-label">
                      Password
                    </Label>
                    <label className="login-inline-toggle">
                      <Checkbox
                        id="toggle-password"
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
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="login-input pl-10"
                      required
                    />
                  </div>
                </div>
              )}

              {resetRequested && (
                <div className="login-reset-panel space-y-2">
                  <p className="login-reset-copy">
                    Ma reset da duoc gui den email cua ban. Nhap ma va mat khau moi de hoan tat.
                  </p>
                  <Label htmlFor="resetCode" className="login-label">
                    Reset code
                  </Label>
                  <Input
                    id="resetCode"
                    value={resetCode}
                    onChange={(e) => setResetCode(e.target.value)}
                    placeholder="Enter code you received"
                    className="login-input"
                  />
                  <div className="flex items-center justify-between">
                    <Label htmlFor="newPassword" className="login-label">
                      New password
                    </Label>
                    <label className="login-inline-toggle">
                      <Checkbox
                        id="show-reset-passwords"
                        checked={showResetPasswords}
                        onCheckedChange={(checked) => setShowResetPasswords(Boolean(checked))}
                        className="login-checkbox"
                      />
                      <span>Show password</span>
                    </label>
                  </div>
                  <Input
                    id="newPassword"
                    type={showResetPasswords ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    className="login-input"
                  />
                  <Label htmlFor="confirmNewPassword" className="login-label">
                    Confirm new password
                  </Label>
                  <Input
                    id="confirmNewPassword"
                    type={showResetPasswords ? "text" : "password"}
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    className="login-input"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleResetPassword}
                    disabled={loading}
                    className="login-secondary-button"
                  >
                    Update password
                  </Button>
                </div>
              )}

              {!resetRequested && (
                <>
                  <div className="login-row">
                    <label className="login-inline-toggle">
                      <Checkbox
                        id="remember"
                        checked={rememberMe}
                        onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                        className="login-checkbox"
                      />
                      <span className="leading-none">Remember me for 30 days</span>
                    </label>
                    <button
                      type="button"
                      onClick={handleForgotPassword}
                      className="login-link inline-flex items-center"
                    >
                      <KeyRound className="mr-1 h-4 w-4" />
                      Forgot password?
                    </button>
                  </div>

                  <Button type="submit" className="login-primary-button w-full" disabled={loading}>
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Signing in...
                      </>
                    ) : (
                      "Sign in"
                    )}
                  </Button>
                </>
              )}
            </form>

            <div className="login-divider relative">
              <div className="absolute inset-0 flex items-center">
                <Separator className="login-separator" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="login-separator-label">Or continue with</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleSocialLogin("google")}
                className="social-button w-full"
              >
                <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Google
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleSocialLogin("github")}
                className="social-button w-full"
              >
                <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                  <path
                    fillRule="evenodd"
                    d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                    clipRule="evenodd"
                  />
                </svg>
                GitHub
              </Button>
            </div>

            <p className="login-footer-text">
              Don't have an account?{" "}
              <button onClick={onSwitchToSignUp} className="login-link">
                Start your free trial
              </button>
            </p>

            <p className="login-terms">
              By signing in, you agree to our{" "}
              <a href="#" className="login-link">
                Terms of Service
              </a>{" "}
              and{" "}
              <a href="#" className="login-link">
                Privacy Policy
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
