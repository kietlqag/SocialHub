import {
  chat,
  createConversation,
  deleteConversationForUser,
  getConversationMessages,
  listUserConversations,
  patchConversationTitle,
  saveFeedback,
  sendMessage,
  suggestForOrganization,
} from "../services/aiService.js";

export async function chatController(req, res) {
  try {
    const reply = await chat({ message: req.body?.message, context: req.body?.context });
    res.json({ reply });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message || "Unable to chat" });
  }
}

export async function listConversationsController(req, res) {
  const conversations = await listUserConversations(req.user.id);
  res.json({ conversations });
}

export async function createConversationController(req, res) {
  const { title } = req.body || {};
  const result = await createConversation(req.user.id, title);
  res.status(201).json(result);
}

export async function conversationMessagesController(req, res) {
  try {
    const result = await getConversationMessages(req.params.conversationId, req.user.id);
    res.json(result);
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
}

export async function sendConversationMessageController(req, res) {
  try {
    const result = await sendMessage({
      conversationId: req.params.conversationId,
      userId: req.user.id,
      message: req.body?.message,
      language: req.body?.language,
    });
    res.status(201).json(result);
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
}

export async function deleteConversationController(req, res) {
  try {
    await deleteConversationForUser(req.user.id, req.params.conversationId);
    res.status(204).end();
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
}

export async function feedbackController(req, res) {
  try {
    const { conversationId, messageId } = req.params;
    const { value } = req.body || {};
    const result = await saveFeedback({ conversationId, messageId, userId: req.user.id, value });
    res.json(result);
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
}

export async function updateConversationController(req, res) {
  const { title } = req.body || {};
  try {
    const conversation = await patchConversationTitle(req.user.id, req.params.conversationId, title);
    res.json({ conversation });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
}

export async function suggestForOrgController(req, res) {
  const { orgId } = req.params;
  const { message, goals, metrics } = req.body || {};
  try {
    const suggestion = await suggestForOrganization(req.user.id, orgId, { message, goals, metrics });
    res.json({ suggestion });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
}
