import { registerUser, loginUser, verifyEmail, resendVerification, createPasswordReset, resetPassword, ensureOAuthUser, getUserProfile } from "../services/authService.js";
import { issueJwt } from "../services/tokenService.js";
import { sendMail } from "../mailer.js";
import { HttpError } from "../utils/httpError.js";
import { findUserByEmail } from "../repositories/userRepository.js";
import { insertActivity } from "../repositories/activityRepository.js";

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI;
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;
const GITHUB_REDIRECT_URI = process.env.GITHUB_REDIRECT_URI;

const formatCodeHtml = (code) =>
  `<p style="font-size:14px;color:#1f2937;margin:0 0 8px">Your verification code:</p><p style="font-size:28px;font-weight:700;letter-spacing:4px;margin:0;color:#111827">${code}</p>`;

async function sendVerificationEmail(email, code, expiresAt) {
  const subject = "Verify your SocialHub account";
  const text = `Your verification code is ${code}. The code expires at ${new Date(expiresAt).toLocaleString()}.`;
  const html = `
    <h2>Welcome to SocialHub</h2>
    <p>Use the code below to verify your email. The code expires in 15 minutes.</p>
    ${formatCodeHtml(code)}
    <p>If you did not request this, you can safely ignore this email.</p>
  `;
  await sendMail({ to: email, subject, text, html });
}

async function sendResetEmail(email, code) {
  const subject = "Reset your SocialHub password";
  const text = `Your password reset code is ${code}. The code expires in 10 minutes.`;
  const html = `
    <h2>Password reset request</h2>
    <p>Enter the code below to create a new password.</p>
    ${formatCodeHtml(code)}
    <p>If you did not request a password reset, you can ignore this email.</p>
  `;
  await sendMail({ to: email, subject, text, html });
}

const redirectWithToken = (res, token, error) => {
  const url = new URL("/auth/callback", FRONTEND_URL);
  if (error) {
    url.searchParams.set("error", error);
  }
  if (token) {
    url.searchParams.set("token", token);
  }
  return res.redirect(url.toString());
};

const logLoginActivity = async (req, user, provider = "password") => {
  if (!user?.id) return;
  try {
    await insertActivity({
      userId: user.id,
      action: "auth.login",
      targetType: "user",
      targetId: user.id,
      metadata: {
        provider,
        ip: req.ip,
        userAgent: req.get("user-agent") || "",
      },
    });
  } catch (err) {
    console.warn("Failed to log activity (auth.login):", err.message);
  }
};

const completeOAuthLogin = async (req, user, provider, res) => {
  const token = await issueJwt(user);
  await logLoginActivity(req, user, provider);
  return redirectWithToken(res, token);
};

export async function register(req, res) {
  const { email, password, fullName, company } = req.body || {};
  try {
    const { user, verification } = await registerUser({ email, password, fullName, company });
    try {
      await sendVerificationEmail(user.email, verification.code, verification.expiresAt);
    } catch (err) {
      console.error("Failed to send verification email", err);
      return res.status(500).json({ error: "Unable to send verification email. Please try again." });
    }
    res.status(201).json({
      user,
      requiresVerification: true,
      message: "We sent a verification code to your email.",
    });
  } catch (err) {
    const status = err instanceof HttpError && err.status ? err.status : 500;
    res.status(status).json({ error: err.message || "Unable to register" });
  }
}

export async function login(req, res) {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "Missing email or password" });
  try {
    const result = await loginUser(email, password);
    await logLoginActivity(req, result.user, "password");
    res.json(result);
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message || "Unable to login" });
  }
}

export async function me(req, res) {
  try {
    const user = await getUserProfile(req.user.id);
    res.json({ user });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message || "Unable to fetch user" });
  }
}

export async function verifyEmailCode(req, res) {
  const { email, code } = req.body || {};
  if (!email || !code) return res.status(400).json({ error: "Missing email or verification code" });
  const user = await findUserByEmail(email);
  if (!user) return res.status(404).json({ error: "User not found" });
  if (user.isVerified) {
    const token = await issueJwt(user);
    const { password_hash, ...clean } = user;
    return res.json({ user: clean, token, message: "Account already verified." });
  }
  try {
    await verifyEmail(user.id, code);
    const updated = { ...user, isVerified: true };
    const token = await issueJwt(updated);
    const { password_hash, ...clean } = updated;
    res.json({ user: clean, token });
  } catch (err) {
    const status = err.status || 400;
    res.status(status).json({ error: err.message || "Unable to verify email" });
  }
}

export async function resendVerificationCode(req, res) {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: "Missing email" });
  try {
    const { user, verification, alreadyVerified } = await resendVerification(email);
    if (alreadyVerified) {
      return res.status(200).json({ message: "Account already verified." });
    }
    await sendVerificationEmail(user.email, verification.code, verification.expiresAt);
    res.json({
      message: "Verification code resent to your email.",
    });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message || "Unable to resend verification email." });
  }
}

export async function forgotPassword(req, res) {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: "Missing email" });
  try {
    const { user, code } = await createPasswordReset(email);
    await sendResetEmail(user.email, code);
    res.json({ message: "Password reset code sent to your email." });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message || "Unable to send password reset email." });
  }
}

export async function resetPasswordController(req, res) {
  const { email, code, newPassword } = req.body || {};
  if (!email || !code || !newPassword) return res.status(400).json({ error: "Missing required fields" });
  try {
    await resetPassword(email, code, newPassword);
    res.json({ message: "Password reset successfully" });
  } catch (err) {
    const status = err.status || 400;
    res.status(status).json({ error: err.message || "Unable to reset password" });
  }
}

export async function googleAuth(req, res) {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_REDIRECT_URI) {
    return res.status(503).json({ error: "Google OAuth not configured" });
  }
  const state = req.query.state || "/";
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_REDIRECT_URI,
    response_type: "code",
    scope: "openid email profile",
    access_type: "offline",
    state,
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
}

export async function googleCallback(req, res) {
  const { code } = req.query;
  if (!code) return redirectWithToken(res, null, "missing_code");
  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: GOOGLE_REDIRECT_URI,
        grant_type: "authorization_code",
      }),
    });
    if (!tokenRes.ok) {
      return redirectWithToken(res, null, "google_token_error");
    }
    const tokenData = await tokenRes.json();
    const profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    if (!profileRes.ok) {
      return redirectWithToken(res, null, "google_profile_error");
    }
    const profile = await profileRes.json();
    if (!profile.email) {
      return redirectWithToken(res, null, "google_email_missing");
    }
    const user = await ensureOAuthUser({
      email: profile.email,
      fullName: profile.name,
      provider: "google",
      providerId: profile.id?.toString(),
      avatarUrl: profile.picture,
    });
    await completeOAuthLogin(req, user, "google", res);
  } catch (err) {
    console.error("Google OAuth error", err);
    return redirectWithToken(res, null, "google_auth_error");
  }
}

export async function githubAuth(req, res) {
  if (!GITHUB_CLIENT_ID || !GITHUB_REDIRECT_URI) {
    return res.status(503).json({ error: "GitHub OAuth not configured" });
  }
  const state = req.query.state || "/";
  const params = new URLSearchParams({
    client_id: GITHUB_CLIENT_ID,
    redirect_uri: GITHUB_REDIRECT_URI,
    scope: "user:email",
    state,
  });
  res.redirect(`https://github.com/login/oauth/authorize?${params.toString()}`);
}

export async function githubCallback(req, res) {
  const { code } = req.query;
  if (!code) return redirectWithToken(res, null, "missing_code");
  try {
    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        Accept: "application/json",
      },
      body: new URLSearchParams({
        client_id: GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: GITHUB_REDIRECT_URI,
      }),
    });
    if (!tokenRes.ok) {
      return redirectWithToken(res, null, "github_token_error");
    }
    const tokenData = await tokenRes.json();
    const profileRes = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        "User-Agent": "SocialHub OAuth",
      },
    });
    if (!profileRes.ok) {
      return redirectWithToken(res, null, "github_profile_error");
    }
    const profile = await profileRes.json();
    let email = profile.email;
    if (!email) {
      const emailsRes = await fetch("https://api.github.com/user/emails", {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          "User-Agent": "SocialHub OAuth",
        },
      });
      if (emailsRes.ok) {
        const emails = await emailsRes.json();
        const primary = emails.find((item) => item.primary && item.verified);
        const anyVerified = emails.find((item) => item.verified);
        email = primary?.email || anyVerified?.email;
      }
    }
    if (!email) {
      return redirectWithToken(res, null, "github_email_missing");
    }
    const user = await ensureOAuthUser({
      email,
      fullName: profile.name || profile.login,
      provider: "github",
      providerId: profile.id?.toString(),
      avatarUrl: profile.avatar_url,
    });
    await completeOAuthLogin(req, user, "github", res);
  } catch (err) {
    console.error("GitHub OAuth error", err);
    return redirectWithToken(res, null, "github_auth_error");
  }
}
