import { query } from "../db.js";
import { parseJsonField } from "../utils/parsers.js";

const mapConversation = (row) => ({
  id: row.id,
  title: row.title,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  lastMessageAt: row.last_message_at,
});

const mapMessage = (row) => ({
  id: row.id,
  role: row.role,
  content: row.content,
  createdAt: row.created_at,
  feedback: row.feedback ?? null,
});

export async function listConversations(userId) {
  const res = await query(
    `SELECT id, title, created_at, updated_at, last_message_at
     FROM ai_conversations
     WHERE user_id = $1
     ORDER BY COALESCE(last_message_at, created_at) DESC`,
    [userId]
  );
  return res.rows.map(mapConversation);
}

export async function getConversationForUser(conversationId, userId) {
  const res = await query(
    `SELECT id, title, created_at, updated_at, last_message_at
     FROM ai_conversations
     WHERE id = $1 AND user_id = $2`,
    [conversationId, userId]
  );
  return res.rows[0] ? mapConversation(res.rows[0]) : null;
}

export async function insertConversation(userId, title) {
  const res = await query(
    `INSERT INTO ai_conversations (user_id, title, last_message_at)
     VALUES ($1, $2, NOW())
     RETURNING id, title, created_at, updated_at, last_message_at`,
    [userId, title]
  );
  return mapConversation(res.rows[0]);
}

export async function updateConversationTitle(userId, conversationId, title) {
  const res = await query(
    `UPDATE ai_conversations
     SET title = $1, updated_at = NOW()
     WHERE id = $2 AND user_id = $3
     RETURNING id, title, created_at, updated_at, last_message_at`,
    [title, conversationId, userId]
  );
  return res.rows[0] ? mapConversation(res.rows[0]) : null;
}

export async function deleteConversation(userId, conversationId) {
  await query(`DELETE FROM ai_conversations WHERE id = $1 AND user_id = $2`, [conversationId, userId]);
}

export async function insertMessage({ conversationId, userId, role, content }) {
  const res = await query(
    `INSERT INTO ai_messages (conversation_id, user_id, role, content)
     VALUES ($1, $2, $3, $4)
     RETURNING id, role, content, created_at`,
    [conversationId, userId, role, content]
  );
  await query(`UPDATE ai_conversations SET last_message_at = NOW(), updated_at = NOW() WHERE id = $1`, [
    conversationId,
  ]);
  return mapMessage(res.rows[0]);
}

export async function listMessages(conversationId, userId) {
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
  return res.rows.map(mapMessage);
}

export async function latestHistory(conversationId, userId, limit = 12) {
  const res = await query(
    `SELECT role, content
     FROM ai_messages
     WHERE conversation_id = $1 AND user_id = $2
     ORDER BY created_at DESC
     LIMIT $3`,
    [conversationId, userId, limit]
  );
  return res.rows.reverse();
}

export async function firstUserMessage(conversationId, userId) {
  const res = await query(
    `SELECT content
     FROM ai_messages
     WHERE conversation_id = $1 AND user_id = $2 AND role = 'user'
     ORDER BY created_at ASC
     LIMIT 1`,
    [conversationId, userId]
  );
  return res.rows[0]?.content || null;
}

export async function upsertFeedback({ messageId, conversationId, userId, value }) {
  const res = await query(
    `INSERT INTO ai_message_feedbacks (message_id, conversation_id, user_id, value)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (message_id, user_id)
     DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
     RETURNING message_id, value`,
    [messageId, conversationId, userId, value]
  );
  return res.rows[0] || null;
}

export async function deleteFeedback({ messageId, userId }) {
  await query(`DELETE FROM ai_message_feedbacks WHERE message_id = $1 AND user_id = $2`, [
    messageId,
    userId,
  ]);
}

export async function findMessageForUser(messageId, userId, conversationId) {
  const res = await query(
    `SELECT id, conversation_id
     FROM ai_messages
     WHERE id = $1 AND user_id = $2 AND conversation_id = $3`,
    [messageId, userId, conversationId]
  );
  return res.rows[0] || null;
}
