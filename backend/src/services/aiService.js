import OpenAI from "openai";
import {
  deleteConversation as removeConversation,
  deleteFeedback,
  findMessageForUser,
  getConversationForUser,
  firstUserMessage,
  insertConversation,
  insertMessage,
  latestHistory,
  listConversations,
  listMessages,
  updateConversationTitle,
  upsertFeedback,
} from "../repositories/aiRepository.js";
import { HttpError } from "../utils/httpError.js";
import { ensureOrgMembership, loadOrgContext } from "./platformService.js";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

const openaiClient = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null;

const requireOpenAI = () => {
  if (!openaiClient) {
    throw new HttpError(503, "AI provider not configured");
  }
  return openaiClient;
};

const mapConversationRow = (row) => ({
  id: row.id,
  title: row.title,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
  lastMessageAt: row.lastMessageAt,
});

const mapMessageRow = (row) => ({
  id: row.id,
  role: row.role,
  content: row.content,
  createdAt: row.createdAt,
  feedback: row.feedback || null,
});

async function autoNameConversationIfNeeded(conversation, userId) {
  if (
    !conversation ||
    !conversation.title ||
    (!conversation.title.toLowerCase().startsWith("new conversation") &&
      conversation.title !== "Dashboard Design Help")
  ) {
    return conversation;
  }

  const firstContent = await firstUserMessage(conversation.id, userId);
  if (!firstContent) return conversation;

  const firstSentence = firstContent.split(/[.!?]/)[0] || firstContent;
  const newTitle = firstSentence.slice(0, 80).trim();
  if (!newTitle) return conversation;

  const updated = await updateConversationTitle(userId, conversation.id, newTitle);
  return updated || conversation;
}

export async function chat({ message, context }) {
  if (!message || typeof message !== "string") {
    throw new HttpError(400, "Missing message");
  }
  const client = requireOpenAI();
  const promptMessages = [
    {
      role: "system",
      content:
        "You are SocialHub's AI assistant. Be concise, helpful, and focused on dashboards/analytics. If info is missing, ask up to 2 short clarifying questions. Never invent links or credentials.",
    },
    context
      ? {
          role: "system",
          content: `Context: ${context}`,
        }
      : null,
    {
      role: "user",
      content: message,
    },
  ].filter(Boolean);

  const completion = await client.chat.completions.create({
    model: OPENAI_MODEL,
    messages: promptMessages,
    max_tokens: 400,
    temperature: 0.6,
  });

  const reply = completion.choices?.[0]?.message?.content?.trim();
  if (!reply) {
    throw new HttpError(500, "AI response empty");
  }
  return reply;
}

export async function listUserConversations(userId) {
  const conversations = await listConversations(userId);
  const fixed = await Promise.all(conversations.map((c) => autoNameConversationIfNeeded(c, userId)));
  return fixed.map(mapConversationRow);
}

export async function createConversation(userId, title) {
  const safeTitle = (title?.toString().trim() || "New Conversation").slice(0, 120);
  const conversation = await insertConversation(userId, safeTitle);
  const greeting =
    "Hello! I'm your SocialHub AI assistant. I can help you create custom dashboards, analyze your business data, and answer questions about using our platform. What would you like to work on today?";
  const assistantMessage = await insertMessage({
    conversationId: conversation.id,
    userId,
    role: "assistant",
    content: greeting,
  });
  return { conversation: mapConversationRow(conversation), messages: [mapMessageRow(assistantMessage)] };
}

export async function getConversationMessages(conversationId, userId) {
  const conversation = await getConversationForUser(conversationId, userId);
  if (!conversation) {
    throw new HttpError(404, "Conversation not found.");
  }
  const messages = await listMessages(conversation.id, userId);
  return { conversation: mapConversationRow(conversation), messages: messages.map(mapMessageRow) };
}

export async function deleteConversationForUser(userId, conversationId) {
  const existing = await getConversationForUser(conversationId, userId);
  if (!existing) {
    throw new HttpError(404, "Conversation not found.");
  }
  await removeConversation(userId, conversationId);
}

export async function patchConversationTitle(userId, conversationId, title) {
  if (!title || typeof title !== "string" || !title.trim()) {
    throw new HttpError(400, "Title is required.");
  }
  const safeTitle = title.trim().slice(0, 120);
  const existing = await getConversationForUser(conversationId, userId);
  if (!existing) {
    throw new HttpError(404, "Conversation not found.");
  }
  const updated = await updateConversationTitle(userId, conversationId, safeTitle);
  return mapConversationRow(updated);
}

export async function sendMessage({ conversationId, userId, message, language }) {
  if (!message || typeof message !== "string") {
    throw new HttpError(400, "Message is required.");
  }
  const client = requireOpenAI();
  let conversation = await getConversationForUser(conversationId, userId);
  if (!conversation) {
    throw new HttpError(404, "Conversation not found.");
  }
  const trimmed = message.trim();
  if (!trimmed) {
    throw new HttpError(400, "Message cannot be empty.");
  }
  const replyLanguage = typeof language === "string" ? language.toLowerCase() : "en";
  const languageHint = replyLanguage === "vi" ? "Reply in Vietnamese." : "Reply in English.";

  const needsTitle =
    !conversation.title ||
    conversation.title.toLowerCase().startsWith("new conversation") ||
    conversation.title === "Dashboard Design Help";
  if (needsTitle) {
    const firstSentence = trimmed.split(/[.!?]/)[0] || trimmed;
    const newTitle = firstSentence.slice(0, 80).trim();
    if (newTitle) {
      const updated = await updateConversationTitle(userId, conversation.id, newTitle);
      if (updated) {
        conversation = updated;
      }
    }
  }

  const userMessage = await insertMessage({
    conversationId: conversation.id,
    userId,
    role: "user",
    content: trimmed,
  });

  const history = await latestHistory(conversation.id, userId, 12);

  const promptMessages = [
    {
      role: "system",
      content: `You are SocialHub's AI assistant. Be concise, helpful, and focused on dashboards/analytics and SaaS builder topics. Never invent links or credentials. ${languageHint}`,
    },
    ...history,
  ];

  let aiContent;
  try {
    const completion = await client.chat.completions.create({
      model: OPENAI_MODEL,
      messages: promptMessages,
      max_tokens: 400,
      temperature: 0.6,
    });
    aiContent = completion.choices?.[0]?.message?.content?.trim();
  } catch (err) {
    console.error("AI conversation error", err);
  }

  const fallbackReply =
    "I've captured your request. Do you want me to add alerts, a summary view, or connect specific data sources for this dashboard?";
  const replyContent = aiContent || fallbackReply;

  const assistantMessage = await insertMessage({
    conversationId: conversation.id,
    userId,
    role: "assistant",
    content: replyContent,
  });

  return {
    userMessage: { ...mapMessageRow(userMessage), feedback: null },
    assistantMessage: { ...mapMessageRow(assistantMessage), feedback: null },
  };
}

export async function saveFeedback({ conversationId, messageId, userId, value }) {
  const conversation = await getConversationForUser(conversationId, userId);
  if (!conversation) {
    throw new HttpError(404, "Conversation not found.");
  }
  const message = await findMessageForUser(messageId, userId, conversationId);
  if (!message) {
    throw new HttpError(404, "Message not found.");
  }
  if (value !== "up" && value !== "down" && value !== null && value !== undefined) {
    throw new HttpError(400, "Invalid feedback value.");
  }
  if (value === "up" || value === "down") {
    const res = await upsertFeedback({ messageId, conversationId, userId, value });
    return { messageId: res.message_id, feedback: res.value };
  }
  await deleteFeedback({ messageId, userId });
  return { messageId, feedback: null };
}

export async function suggestForOrganization(userId, orgId, { message, goals, metrics }) {
  if (!message || typeof message !== "string") {
    throw new HttpError(400, "Missing message");
  }
  await ensureOrgMembership(userId, orgId);
  const ctx = await loadOrgContext(orgId);
  if (!ctx) throw new HttpError(404, "Organization not found");
  const client = requireOpenAI();

  const promptMessages = [
    {
      role: "system",
      content:
        "You are SocialHub's AI assistant. You suggest dashboard layouts for a given organization using only the provided data sources. Output JSON with: summary, recommended_kpis[], widgets[], data_needs[], next_actions[]. Do not invent links or credentials.",
    },
    {
      role: "system",
      content: `Organization: ${ctx.organization.name || "N/A"} | Industry: ${ctx.organization.industry || "N/A"} | Size: ${ctx.organization.employeeCount || "N/A"} | Data volume: ${ctx.organization.dataVolume || "N/A"}. Data sources: ${ctx.dataSources
        .map((d) => `${d.name} (${d.type}, ${d.status})`)
        .join("; ") || "none"}.`,
    },
    {
      role: "user",
      content: `User request: ${message}\nGoals: ${goals || "unspecified"}\nMetrics: ${metrics || "unspecified"}`,
    },
  ];

  const completion = await client.chat.completions.create({
    model: OPENAI_MODEL,
    messages: promptMessages,
    max_tokens: 500,
    temperature: 0.6,
  });

  const reply = completion.choices?.[0]?.message?.content?.trim();
  if (!reply) {
    throw new HttpError(500, "AI response empty");
  }
  return reply;
}
