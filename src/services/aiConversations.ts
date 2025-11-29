import { api } from "./api";
import { getCurrentSession } from "./auth";

export type ConversationSummary = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt?: string;
  lastMessageAt?: string | null;
};

export type AiMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  feedback?: "up" | "down" | null;
};

const requireToken = () => {
  const session = getCurrentSession();
  if (!session?.token) {
    throw new Error("Please sign in to use AI chat.");
  }
  return session.token;
};

export const aiConversationApi = {
  list: async () => {
    const token = requireToken();
    const res = await api.get<{ conversations: ConversationSummary[] }>("/ai/conversations", token);
    return res.conversations;
  },
  create: async (title?: string) => {
    const token = requireToken();
    return api.post<{ conversation: ConversationSummary; messages: AiMessage[] }>(
      "/ai/conversations",
      { title },
      token
    );
  },
  listMessages: async (conversationId: string) => {
    const token = requireToken();
    const res = await api.get<{ conversation: ConversationSummary; messages: AiMessage[] }>(
      `/ai/conversations/${conversationId}/messages`,
      token
    );
    return res;
  },
  sendMessage: async (conversationId: string, message: string, opts?: { language?: "en" | "vi" }) => {
    const token = requireToken();
    return api.post<{ userMessage: AiMessage; assistantMessage: AiMessage }>(
      `/ai/conversations/${conversationId}/messages`,
      { message, language: opts?.language },
      token
    );
  },
  updateTitle: async (conversationId: string, title: string) => {
    const token = requireToken();
    const res = await api.patch<{ conversation: ConversationSummary }>(
      `/ai/conversations/${conversationId}`,
      { title },
      token
    );
    return res.conversation;
  },
  setFeedback: async (conversationId: string, messageId: string, value: "up" | "down" | null) => {
    const token = requireToken();
    return api.post<{ messageId: string; feedback: "up" | "down" | null }>(
      `/ai/conversations/${conversationId}/messages/${messageId}/feedback`,
      { value },
      token
    );
  },
  remove: async (conversationId: string) => {
    const token = requireToken();
    await api.delete(`/ai/conversations/${conversationId}`, token);
  },
};




