import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";
import bcrypt from "bcryptjs";
import {
  createUser,
  findUserByEmail,
  issueJwt,
  verifyJwt,
  createResetToken,
  consumeResetToken,
  updatePassword,
  createVerificationToken,
  verifyEmailToken,
  markUserVerified,
  ensureOAuthUser,
} from "./auth.js";
import { query, initDb } from "./db.js";
import { sendMail } from "./mailer.js";
import {
  createOrganization,
  listOrganizationsForUser,
  createDataSource,
  listDataSources,
  createDashboard,
  listDashboards,
  createWidget,
  listWidgets,
  createServiceProfile,
  listServiceProfiles,
  bindServiceToDashboard,
  listDashboardServices,
  createRecommendation,
  listRecommendations,
} from "./platform.js";

dotenv.config();

const app = express();
app.use(cors({ origin: "*", credentials: true }));
app.use(express.json());

const PORT = process.env.PORT || 4000;
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI;
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;
const GITHUB_REDIRECT_URI = process.env.GITHUB_REDIRECT_URI;
const openaiClient = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null;

const ensureOrgMembership = async (userId, orgId) => {
  const res = await query(
    `SELECT role FROM organization_members WHERE organization_id = $1 AND user_id = $2`,
    [orgId, userId]
  );
  if (res.rowCount === 0) {
    throw Object.assign(new Error("You are not a member of this organization."), { status: 404 });
  }
  return res.rows[0].role;
};

const loadOrgContext = async (orgId) => {
  const orgRes = await query(
    `SELECT id, name, industry, employee_count, data_volume, description
     FROM organizations WHERE id = $1`,
    [orgId]
  );
  const org = orgRes.rows[0];
  if (!org) return null;
  const dsRes = await query(
    `SELECT id, name, type, status FROM data_sources WHERE organization_id = $1 ORDER BY created_at DESC LIMIT 15`,
    [orgId]
  );
  return {
    organization: {
      id: org.id,
      name: org.name,
      industry: org.industry,
      employeeCount: org.employee_count,
      dataVolume: org.data_volume,
      description: org.description,
    },
    dataSources: dsRes.rows.map((r) => ({
      id: r.id,
      name: r.name,
      type: r.type,
      status: r.status,
    })),
  };
};

const mapConversationRow = (row) => ({
  id: row.id,
  title: row.title,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  lastMessageAt: row.last_message_at,
});

const mapMessageRow = (row) => ({
  id: row.id,
  role: row.role,
  content: row.content,
  createdAt: row.created_at,
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

  const firstUserMessage = await query(
    `SELECT content FROM ai_messages
     WHERE conversation_id = $1 AND user_id = $2 AND role = 'user'
     ORDER BY created_at ASC
     LIMIT 1`,
    [conversation.id, userId]
  );
  const firstContent = firstUserMessage.rows[0]?.content;
  if (!firstContent) return conversation;

  const firstSentence = firstContent.split(/[.!?]/)[0] || firstContent;
  const newTitle = firstSentence.slice(0, 80).trim();
  if (!newTitle) return conversation;

  const updated = await updateConversationTitle(userId, conversation.id, newTitle);
  return updated || conversation;
}

async function listUserConversations(userId) {
  const res = await query(
    `SELECT id, title, created_at, updated_at, last_message_at
     FROM ai_conversations
     WHERE user_id = $1
     ORDER BY COALESCE(last_message_at, created_at) DESC`,
    [userId]
  );
  return res.rows.map(mapConversationRow);
}

async function ensureConversationOwnership(conversationId, userId) {
  const res = await query(
    `SELECT id, title, created_at, updated_at, last_message_at
     FROM ai_conversations
     WHERE id = $1 AND user_id = $2`,
    [conversationId, userId]
  );
  return res.rows[0] ? mapConversationRow(res.rows[0]) : null;
}

async function listConversationMessages(conversationId, userId) {
  const res = await query(
    `SELECT m.id,
            m.role,
            m.content,
            m.created_at,
            f.value AS feedback
     FROM ai_messages m
     LEFT JOIN ai_message_feedbacks f
       ON f.message_id = m.id AND f.user_id = $2
     WHERE m.conversation_id = $1 AND m.user_id = $2
     ORDER BY m.created_at ASC`,
    [conversationId, userId]
  );
  return res.rows.map(mapMessageRow);
}

async function insertConversationMessage({ conversationId, userId, role, content }) {
  const res = await query(
    `INSERT INTO ai_messages (conversation_id, user_id, role, content)
     VALUES ($1, $2, $3, $4)
     RETURNING id, role, content, created_at`,
    [conversationId, userId, role, content]
  );
  await query(`UPDATE ai_conversations SET last_message_at = NOW(), updated_at = NOW() WHERE id = $1`, [
    conversationId,
  ]);
  return mapMessageRow(res.rows[0]);
}

async function createAiConversation(userId, title) {
  const convoRes = await query(
    `INSERT INTO ai_conversations (user_id, title, last_message_at)
     VALUES ($1, $2, NOW())
     RETURNING id, title, created_at, updated_at, last_message_at`,
    [userId, title]
  );
  const conversation = mapConversationRow(convoRes.rows[0]);
  const greeting =
    "Hello! I'm your SocialHub AI assistant. I can help you create custom dashboards, analyze your business data, and answer questions about using our platform. What would you like to work on today?";
  const assistantMessage = await insertConversationMessage({
    conversationId: conversation.id,
    userId,
    role: "assistant",
    content: greeting,
  });
  return { conversation, messages: [assistantMessage] };
}

async function deleteConversation(userId, conversationId) {
  await query(`DELETE FROM ai_conversations WHERE id = $1 AND user_id = $2`, [conversationId, userId]);
}

async function updateConversationTitle(userId, conversationId, title) {
  const res = await query(
    `UPDATE ai_conversations
     SET title = $1, updated_at = NOW()
     WHERE id = $2 AND user_id = $3
     RETURNING id, title, created_at, updated_at, last_message_at`,
    [title, conversationId, userId]
  );
  return res.rows[0] ? mapConversationRow(res.rows[0]) : null;
}

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const formatCodeHtml = (code) =>
  `<p style="font-size:14px;color:#1f2937;margin:0 0 8px">Your verification code:</p><p style="font-size:28px;font-weight:700;letter-spacing:4px;margin:0;color:#111827">${code}</p>`;

const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid Authorization header" });
  }
  const token = authHeader.slice("Bearer ".length);
  try {
    const payload = verifyJwt(token);
    req.user = { id: payload.sub, email: payload.email };
    return next();
  } catch (err) {
    console.error("Token verification failed", err.message);
    return res.status(401).json({ error: "Invalid token" });
  }
};

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

function redirectWithToken(res, token, error) {
  const url = new URL("/auth/callback", FRONTEND_URL);
  if (error) {
    url.searchParams.set("error", error);
  }
  if (token) {
    url.searchParams.set("token", token);
  }
  return res.redirect(url.toString());
}

async function completeOAuthLogin(user, res) {
  const token = await issueJwt(user);
  return redirectWithToken(res, token);
}

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.post(
  "/ai/chat",
  authenticate,
  asyncHandler(async (req, res) => {
    const { message, context } = req.body || {};
    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "Missing message" });
    }
    if (!openaiClient) {
      return res.status(503).json({ error: "AI provider not configured" });
    }

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

    const completion = await openaiClient.chat.completions.create({
      model: OPENAI_MODEL,
      messages: promptMessages,
      max_tokens: 400,
      temperature: 0.6,
    });

    const reply = completion.choices?.[0]?.message?.content?.trim();
    if (!reply) {
      return res.status(500).json({ error: "AI response empty" });
    }
    res.json({ reply });
  })
);

app.get(
  "/ai/conversations",
  authenticate,
  asyncHandler(async (req, res) => {
    const conversations = await listUserConversations(req.user.id);
    const fixed = await Promise.all(conversations.map((c) => autoNameConversationIfNeeded(c, req.user.id)));
    res.json({ conversations: fixed });
  })
);

app.post(
  "/ai/conversations",
  authenticate,
  asyncHandler(async (req, res) => {
    const { title } = req.body || {};
    const safeTitle = (title?.toString().trim() || "New Conversation").slice(0, 120);
    const result = await createAiConversation(req.user.id, safeTitle);
    res.status(201).json(result);
  })
);

app.get(
  "/ai/conversations/:conversationId/messages",
  authenticate,
  asyncHandler(async (req, res) => {
    const conversation = await ensureConversationOwnership(req.params.conversationId, req.user.id);
    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found." });
    }
    const messages = await listConversationMessages(conversation.id, req.user.id);
    res.json({ conversation, messages });
  })
);

app.post(
  "/ai/conversations/:conversationId/messages",
  authenticate,
  asyncHandler(async (req, res) => {
    const { message, language } = req.body || {};
    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "Message is required." });
    }
    if (!openaiClient) {
      return res.status(503).json({ error: "AI provider not configured" });
    }
    let conversation = await ensureConversationOwnership(req.params.conversationId, req.user.id);
    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found." });
    }
    const trimmed = message.trim();
    if (!trimmed) {
      return res.status(400).json({ error: "Message cannot be empty." });
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
        const updated = await updateConversationTitle(req.user.id, conversation.id, newTitle);
        if (updated) {
          conversation = updated;
        }
      }
    }

    const userMessage = await insertConversationMessage({
      conversationId: conversation.id,
      userId: req.user.id,
      role: "user",
      content: trimmed,
    });

    const history = await query(
      `SELECT role, content
       FROM ai_messages
       WHERE conversation_id = $1 AND user_id = $2
       ORDER BY created_at DESC
       LIMIT 12`,
      [conversation.id, req.user.id]
    );
    const orderedHistory = history.rows.reverse();

    const promptMessages = [
      {
        role: "system",
        content: `You are SocialHub's AI assistant. Be concise, helpful, and focused on dashboards/analytics and SaaS builder topics. Never invent links or credentials. ${languageHint}`,
      },
      ...orderedHistory,
    ];

    let aiContent;
    try {
      const completion = await openaiClient.chat.completions.create({
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

    const assistantMessage = await insertConversationMessage({
      conversationId: conversation.id,
      userId: req.user.id,
      role: "assistant",
      content: replyContent,
    });

    res.status(201).json({
      userMessage: { ...userMessage, feedback: null },
      assistantMessage: { ...assistantMessage, feedback: null },
    });
  })
);

app.delete(
  "/ai/conversations/:conversationId",
  authenticate,
  asyncHandler(async (req, res) => {
    const existing = await ensureConversationOwnership(req.params.conversationId, req.user.id);
    if (!existing) {
      return res.status(404).json({ error: "Conversation not found." });
    }
    await deleteConversation(req.user.id, req.params.conversationId);
    res.status(204).end();
  })
);

app.post(
  "/ai/conversations/:conversationId/messages/:messageId/feedback",
  authenticate,
  asyncHandler(async (req, res) => {
    const { conversationId, messageId } = req.params;
    const { value } = req.body || {};

    const conversation = await ensureConversationOwnership(conversationId, req.user.id);
    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found." });
    }

    const messageRes = await query(
      `SELECT id, conversation_id FROM ai_messages WHERE id = $1 AND user_id = $2 AND conversation_id = $3`,
      [messageId, req.user.id, conversationId]
    );
    if (messageRes.rowCount === 0) {
      return res.status(404).json({ error: "Message not found." });
    }

    if (value !== "up" && value !== "down" && value !== null && value !== undefined) {
      return res.status(400).json({ error: "Invalid feedback value." });
    }

    if (value === "up" || value === "down") {
      const upsert = await query(
        `INSERT INTO ai_message_feedbacks (message_id, conversation_id, user_id, value)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (message_id, user_id)
         DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
         RETURNING message_id, value`,
        [messageId, conversationId, req.user.id, value]
      );
      return res.json({ messageId: upsert.rows[0].message_id, feedback: upsert.rows[0].value });
    } else {
      await query(`DELETE FROM ai_message_feedbacks WHERE message_id = $1 AND user_id = $2`, [
        messageId,
        req.user.id,
      ]);
      return res.json({ messageId, feedback: null });
    }
  })
);

app.patch(
  "/ai/conversations/:conversationId",
  authenticate,
  asyncHandler(async (req, res) => {
    const { title } = req.body || {};
    if (!title || typeof title !== "string" || !title.trim()) {
      return res.status(400).json({ error: "Title is required." });
    }
    const safeTitle = title.trim().slice(0, 120);
    const existing = await ensureConversationOwnership(req.params.conversationId, req.user.id);
    if (!existing) {
      return res.status(404).json({ error: "Conversation not found." });
    }
    const updated = await updateConversationTitle(req.user.id, req.params.conversationId, safeTitle);
    res.json({ conversation: updated });
  })
);

app.post(
  "/orgs/:orgId/ai/suggest",
  authenticate,
  asyncHandler(async (req, res) => {
    const { orgId } = req.params;
    const { message, goals, metrics } = req.body || {};
    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "Missing message" });
    }
    if (!openaiClient) {
      return res.status(503).json({ error: "AI provider not configured" });
    }

    await ensureOrgMembership(req.user.id, orgId);
    const ctx = await loadOrgContext(orgId);
    if (!ctx) return res.status(404).json({ error: "Organization not found" });

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

    const completion = await openaiClient.chat.completions.create({
      model: OPENAI_MODEL,
      messages: promptMessages,
      max_tokens: 500,
      temperature: 0.6,
    });

    const reply = completion.choices?.[0]?.message?.content?.trim();
    if (!reply) {
      return res.status(500).json({ error: "AI response empty" });
    }
    res.json({ suggestion: reply });
  })
);

app.post(
  "/auth/register",
  asyncHandler(async (req, res) => {
    const { email, password, fullName, company } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: "Email and password are required" });
    if (password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters" });
    const exists = await findUserByEmail(email);
    if (exists) return res.status(409).json({ error: "Email already exists" });
    const user = await createUser({ email, password, fullName, company });
    const verification = await createVerificationToken(user.id);
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
  })
);

app.post(
  "/auth/login",
  asyncHandler(async (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: "Missing email or password" });
    const user = await findUserByEmail(email);
    if (!user) return res.status(401).json({ error: "Incorrect email or password" });
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ error: "Incorrect email or password" });
    if (!user.isVerified) return res.status(403).json({ error: "Account email has not been verified." });
    const token = await issueJwt(user);
    const { password_hash, ...clean } = user;
    res.json({ user: clean, token });
  })
);

// Organization & dashboard APIs
app.post(
  "/orgs",
  authenticate,
  asyncHandler(async (req, res) => {
    const organization = await createOrganization(req.user.id, req.body);
    res.status(201).json({ organization });
  })
);

app.get(
  "/orgs",
  authenticate,
  asyncHandler(async (req, res) => {
    const organizations = await listOrganizationsForUser(req.user.id);
    res.json({ organizations });
  })
);

app.post(
  "/orgs/:orgId/datasources",
  authenticate,
  asyncHandler(async (req, res) => {
    const dataSource = await createDataSource(req.user.id, req.params.orgId, req.body);
    res.status(201).json({ dataSource });
  })
);

app.get(
  "/orgs/:orgId/datasources",
  authenticate,
  asyncHandler(async (req, res) => {
    const dataSources = await listDataSources(req.user.id, req.params.orgId);
    res.json({ dataSources });
  })
);

app.post(
  "/orgs/:orgId/dashboards",
  authenticate,
  asyncHandler(async (req, res) => {
    const dashboard = await createDashboard(req.user.id, req.params.orgId, req.body);
    res.status(201).json({ dashboard });
  })
);

app.get(
  "/orgs/:orgId/dashboards",
  authenticate,
  asyncHandler(async (req, res) => {
    const dashboards = await listDashboards(req.user.id, req.params.orgId);
    res.json({ dashboards });
  })
);

app.post(
  "/orgs/:orgId/dashboards/:dashboardId/widgets",
  authenticate,
  asyncHandler(async (req, res) => {
    const widget = await createWidget(
      req.user.id,
      req.params.orgId,
      req.params.dashboardId,
      req.body
    );
    res.status(201).json({ widget });
  })
);

app.get(
  "/orgs/:orgId/dashboards/:dashboardId/widgets",
  authenticate,
  asyncHandler(async (req, res) => {
    const widgets = await listWidgets(req.user.id, req.params.orgId, req.params.dashboardId);
    res.json({ widgets });
  })
);

app.post(
  "/orgs/:orgId/services",
  authenticate,
  asyncHandler(async (req, res) => {
    const service = await createServiceProfile(req.user.id, req.params.orgId, req.body);
    res.status(201).json({ service });
  })
);

app.get(
  "/orgs/:orgId/services",
  authenticate,
  asyncHandler(async (req, res) => {
    const services = await listServiceProfiles(req.user.id, req.params.orgId);
    res.json({ services });
  })
);

app.post(
  "/orgs/:orgId/dashboards/:dashboardId/services",
  authenticate,
  asyncHandler(async (req, res) => {
    const binding = await bindServiceToDashboard(
      req.user.id,
      req.params.orgId,
      req.params.dashboardId,
      req.body
    );
    res.status(201).json({ binding });
  })
);

app.get(
  "/orgs/:orgId/dashboards/:dashboardId/services",
  authenticate,
  asyncHandler(async (req, res) => {
    const bindings = await listDashboardServices(
      req.user.id,
      req.params.orgId,
      req.params.dashboardId
    );
    res.json({ bindings });
  })
);

app.post(
  "/orgs/:orgId/recommendations",
  authenticate,
  asyncHandler(async (req, res) => {
    const recommendation = await createRecommendation(req.user.id, req.params.orgId, req.body);
    res.status(201).json({ recommendation });
  })
);

app.get(
  "/orgs/:orgId/recommendations",
  authenticate,
  asyncHandler(async (req, res) => {
    const recommendations = await listRecommendations(req.user.id, req.params.orgId);
    res.json({ recommendations });
  })
);

app.get(
  "/auth/me",
  asyncHandler(async (req, res) => {
    const auth = req.headers.authorization;
    if (!auth?.startsWith("Bearer ")) return res.status(401).json({ error: "Missing token" });
    const token = auth.slice(7);
    let payload;
    try {
      payload = verifyJwt(token);
    } catch (e) {
      return res.status(401).json({ error: "Invalid token" });
    }
    const userRes = await query(
      `SELECT id, email, full_name AS "fullName", company, created_at AS "createdAt", is_verified AS "isVerified", provider, provider_id AS "providerId", avatar_url AS "avatarUrl"
       FROM users WHERE id = $1`,
      [payload.sub]
    );
    const user = userRes.rows[0];
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ user });
  })
);

app.post(
  "/auth/verify-email",
  asyncHandler(async (req, res) => {
    const { email, code } = req.body || {};
    if (!email || !code) return res.status(400).json({ error: "Missing email or verification code" });
    const user = await findUserByEmail(email);
    if (!user) return res.status(404).json({ error: "User not found" });
    if (user.isVerified) {
      const token = await issueJwt(user);
      const { password_hash, ...clean } = user;
      return res.json({ user: clean, token, message: "Account already verified." });
    }
    await verifyEmailToken(user.id, code);
    await markUserVerified(user.id);
    const updated = { ...user, isVerified: true };
    const token = await issueJwt(updated);
    const { password_hash, ...clean } = updated;
    res.json({ user: clean, token });
  })
);

app.post(
  "/auth/resend-verification",
  asyncHandler(async (req, res) => {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ error: "Missing email" });
    const user = await findUserByEmail(email);
    if (!user) return res.status(404).json({ error: "User not found" });
    if (user.isVerified) return res.status(200).json({ message: "Account already verified." });
    const verification = await createVerificationToken(user.id);
    try {
      await sendVerificationEmail(user.email, verification.code, verification.expiresAt);
    } catch (err) {
      console.error("Failed to resend verification email", err);
      return res.status(500).json({ error: "Unable to resend verification email." });
    }
    res.json({
      message: "Verification code resent to your email.",
    });
  })
);

app.post(
  "/auth/forgot",
  asyncHandler(async (req, res) => {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ error: "Missing email" });
    const user = await findUserByEmail(email);
    if (!user) return res.status(404).json({ error: "Email not found" });
    if (!user.isVerified) return res.status(400).json({ error: "Account email is not verified." });
    const { code } = await createResetToken(user.id);
    try {
      await sendResetEmail(user.email, code);
    } catch (err) {
      console.error("Failed to send reset email", err);
      return res.status(500).json({ error: "Unable to send password reset email." });
    }
    res.json({ message: "Password reset code sent to your email." });
  })
);

app.post(
  "/auth/reset",
  asyncHandler(async (req, res) => {
    const { email, code, newPassword } = req.body || {};
    if (!email || !code || !newPassword) return res.status(400).json({ error: "Missing required fields" });
    if (newPassword.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters" });
    try {
      const user = await consumeResetToken(email, code);
      await updatePassword(user.id, newPassword);
      res.json({ message: "Password reset successfully" });
    } catch (e) {
      res.status(400).json({ error: e.message || "Unable to reset password" });
    }
  })
);

app.get(
  "/auth/google",
  asyncHandler(async (req, res) => {
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
  })
);

app.get(
  "/auth/google/callback",
  asyncHandler(async (req, res) => {
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
      await completeOAuthLogin(user, res);
    } catch (err) {
      console.error("Google OAuth error", err);
      return redirectWithToken(res, null, "google_auth_error");
    }
  })
);

app.get(
  "/auth/github",
  asyncHandler(async (req, res) => {
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
  })
);

app.get(
  "/auth/github/callback",
  asyncHandler(async (req, res) => {
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
      await completeOAuthLogin(user, res);
    } catch (err) {
      console.error("GitHub OAuth error", err);
      return redirectWithToken(res, null, "github_auth_error");
    }
  })
);

// Basic error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  const status = err.status || 500;
  const message = err.status ? err.message : "Internal Server Error";
  res.status(status).json({ error: message });
});

async function start() {
  await initDb();
  app.listen(PORT, () => {
    console.log(`API listening on http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  console.error("Failed to start server", err);
  process.exit(1);
});


