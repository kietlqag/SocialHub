import { api } from "./api";

export type AuthUser = {
  id: string;
  email: string;
  fullName?: string;
  company?: string;
  createdAt?: string;
  isVerified?: boolean;
  provider?: string | null;
  providerId?: string | null;
  avatarUrl?: string | null;
};

export type AuthResponse = {
  user: AuthUser;
  token: string;
};

export type RegisterResponse = {
  user: AuthUser;
  requiresVerification: boolean;
  message?: string;
};

const SESSION_KEY = "socialhub_auth_session";

export function persistSession(session: AuthResponse, remember: boolean) {
  const payload = JSON.stringify(session);
  if (remember) {
    localStorage.setItem(SESSION_KEY, payload);
  } else {
    sessionStorage.setItem(SESSION_KEY, payload);
  }
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(SESSION_KEY);
}

export function getCurrentSession(): AuthResponse | null {
  const raw = sessionStorage.getItem(SESSION_KEY) ?? localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthResponse;
  } catch {
    return null;
  }
}

export async function registerUser(email: string, password: string, fullName?: string, company?: string) {
  return api.post<RegisterResponse>("/auth/register", { email, password, fullName, company });
}

export async function login(email: string, password: string, remember: boolean) {
  const res = await api.post<AuthResponse>("/auth/login", { email, password });
  persistSession(res, remember);
  return res;
}

export async function verifyEmail(email: string, code: string, remember: boolean) {
  const res = await api.post<AuthResponse>("/auth/verify-email", { email, code });
  if (remember) {
    persistSession(res, remember);
  }
  return res;
}

export async function resendVerification(email: string) {
  return api.post<{ message: string }>(
    "/auth/resend-verification",
    { email }
  );
}

export async function fetchMe(token: string) {
  return api.get<{ user: AuthUser }>("/auth/me", token);
}

export async function requestPasswordReset(email: string) {
  return api.post<{ message: string }>("/auth/forgot", { email });
}

export async function resetPassword(email: string, code: string, newPassword: string) {
  return api.post<{ message: string }>("/auth/reset", { email, code, newPassword });
}
