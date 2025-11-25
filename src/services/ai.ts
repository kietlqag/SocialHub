import { api, API_URL } from "./api";
import { getCurrentSession } from "./auth";

export type AiChatResponse = {
  reply: string;
};

export const aiApi = {
  chat: async (message: string, context?: string) => {
    const session = getCurrentSession();
    const token = session?.token;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const res = await fetch(`${API_URL}/ai/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ message, context }),
        signal: controller.signal,
      });
      const data: AiChatResponse | undefined = await res.json().catch(() => undefined);
      if (!res.ok || !data?.reply) {
        throw new Error(data?.reply || res.statusText || "AI request failed");
      }
      return data.reply;
    } finally {
      clearTimeout(timeout);
    }
  },
  suggestForOrg: async (orgId: string, message: string, goals?: string, metrics?: string) => {
    const session = getCurrentSession();
    const token = session?.token;
    const res = await api.post<{ suggestion: string }>(
      `/orgs/${orgId}/ai/suggest`,
      { message, goals, metrics },
      token
    );
    return res.suggestion;
  },
};
