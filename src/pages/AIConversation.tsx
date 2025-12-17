import { useEffect, useState } from "react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { ScrollArea } from "../components/ui/scroll-area";
import { Avatar } from "../components/ui/avatar";
import { Separator } from "../components/ui/separator";
import {
  ArrowLeft,
  Send,
  Plus,
  MessageSquare,
  Sparkles,
  MoreVertical,
  Trash2,
  ThumbsUp,
  ThumbsDown,
  User,
  Settings,
  Menu,
  X,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import {
  aiConversationApi,
  AiMessage,
  ConversationSummary,
} from "../services/aiConversations";
import "../styles/ai-chat.css";

const deriveTitleFromMessage = (text: string) => {
  const firstSentence = text.split(/[.!?]/)[0] || text;
  return firstSentence.slice(0, 80).trim();
};

export function AIConversation({ onBack }: { onBack?: () => void }) {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [messagesByConversation, setMessagesByConversation] = useState<
    Record<string, AiMessage[]>
  >({});
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [inputMessage, setInputMessage] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creatingConversation, setCreatingConversation] = useState(false);
  const [replyLanguage, setReplyLanguage] = useState<"en" | "vi">("en");
  const [bubbleDensity, setBubbleDensity] = useState<"comfortable" | "compact">(
    "comfortable"
  );
  const [exporting, setExporting] = useState(false);
  const [themeMode, setThemeMode] = useState<"light" | "dark">("light");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [feedbacks, setFeedbacks] = useState<Record<string, "up" | "down" | null>>(
    {}
  );
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("aiChatSettings");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed.replyLanguage === "vi" || parsed.replyLanguage === "en") {
          setReplyLanguage(parsed.replyLanguage);
        }
        if (
          parsed.bubbleDensity === "compact" ||
          parsed.bubbleDensity === "comfortable"
        ) {
          setBubbleDensity(parsed.bubbleDensity);
        }
        if (parsed.themeMode === "dark" || parsed.themeMode === "light") {
          setThemeMode(parsed.themeMode);
        }
      } catch (err) {
        console.warn("Failed to parse AI chat settings", err);
      }
    }

    const loadConversations = async () => {
      try {
        setLoadingConversations(true);
        const data = await aiConversationApi.list();
        setConversations(data);
        if (data.length > 0) {
          setActiveConversationId((prev) => prev ?? data[0].id);
        } else {
          await createConversation("Dashboard Design Help");
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load conversations."
        );
      } finally {
        setLoadingConversations(false);
      }
    };
    loadConversations();
  }, []);

  useEffect(() => {
    localStorage.setItem(
      "aiChatSettings",
      JSON.stringify({ replyLanguage, bubbleDensity, themeMode })
    );
  }, [replyLanguage, bubbleDensity, themeMode]);

  const applyTheme = (mode: "light" | "dark") => {
    setThemeMode(mode);
  };

  useEffect(() => {
    if (!activeConversationId) return;
    if (messagesByConversation[activeConversationId]) {
      return;
    }

    const loadMessages = async () => {
      try {
        setLoadingMessages(true);
        const res = await aiConversationApi.listMessages(activeConversationId);
        setMessagesByConversation((prev) => ({
          ...prev,
          [activeConversationId]: res.messages,
        }));
        setFeedbacks((prev) => {
          const map: Record<string, "up" | "down" | null> = { ...prev };
          res.messages.forEach((m) => {
            if (typeof m.feedback !== "undefined") {
              map[m.id] = m.feedback;
            }
          });
          return map;
        });
        const convoMeta =
          conversations.find((c) => c.id === activeConversationId) || {
            id: activeConversationId,
            title: "New Conversation",
          };
        const isDefaultTitle =
          convoMeta.title.toLowerCase().startsWith("new conversation") ||
          convoMeta.title === "Dashboard Design Help";
        if (isDefaultTitle) {
          const firstUser = res.messages.find((m) => m.role === "user");
          if (firstUser) {
            const newTitle = deriveTitleFromMessage(firstUser.content);
            if (newTitle) {
              try {
                const updated = await aiConversationApi.updateTitle(
                  activeConversationId,
                  newTitle
                );
                setConversations((prev) =>
                  prev.map((c) =>
                    c.id === updated.id ? { ...c, title: updated.title } : c
                  )
                );
              } catch (err) {
                console.warn("Failed to update title", err);
              }
            }
          }
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to load messages.";
        if (message.toLowerCase().includes("not found")) {
          setConversations((prev) =>
            prev.filter((c) => c.id !== activeConversationId)
          );
          setMessagesByConversation((prev) => {
            const next = { ...prev };
            delete next[activeConversationId];
            return next;
          });
          setActiveConversationId((prevId) => {
            const remaining = conversations.filter((c) => c.id !== prevId);
            return remaining[0]?.id || null;
          });
          setError(null);
        } else {
          setError(message);
        }
      } finally {
        setLoadingMessages(false);
      }
    };

    loadMessages();
  }, [activeConversationId, messagesByConversation, conversations]);

  const currentConversation = activeConversationId
    ? conversations.find((c) => c.id === activeConversationId)
    : null;
  const currentMessages = activeConversationId
    ? messagesByConversation[activeConversationId] || []
    : [];

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isSending) return;
    let conversationId = activeConversationId;
    if (!conversationId) {
      const convo = await createConversation("New Conversation");
      if (!convo) return;
      conversationId = convo.id;
    }

    setError(null);
    const trimmed = inputMessage.trim();
    setInputMessage("");
    setIsSending(true);
    const currentConversationMeta =
      conversations.find((c) => c.id === conversationId) || {
        id: conversationId,
        title: "New Conversation",
      };
    const newTitleCandidate = deriveTitleFromMessage(trimmed);
    const shouldRename =
      !!newTitleCandidate &&
      currentConversationMeta &&
      (currentConversationMeta.title
        .toLowerCase()
        .startsWith("new conversation") ||
        currentConversationMeta.title === "Dashboard Design Help");

    const tempUserMessage: AiMessage = {
      id: `temp-${Date.now()}`,
      role: "user",
      content: trimmed,
      createdAt: new Date().toISOString(),
    };

    if (shouldRename && newTitleCandidate && conversationId) {
      aiConversationApi
        .updateTitle(conversationId, newTitleCandidate)
        .then((updated) =>
          setConversations((prev) =>
            prev.map((c) =>
              c.id === updated.id ? { ...c, title: updated.title } : c
            )
          )
        )
        .catch((err) => console.warn("Failed to persist title", err));
    }

    setMessagesByConversation((prev) => {
      const current = prev[conversationId] || [];
      return {
        ...prev,
        [conversationId]: [...current, tempUserMessage],
      };
    });

    try {
      const { userMessage, assistantMessage } =
        await aiConversationApi.sendMessage(conversationId, trimmed, {
          language: replyLanguage,
        });
      setMessagesByConversation((prev) => {
        const current = (prev[conversationId] || []).filter(
          (msg) => msg.id !== tempUserMessage.id
        );
        return {
          ...prev,
          [conversationId]: [...current, userMessage, assistantMessage],
        };
      });
      setFeedbacks((prev) => ({
        ...prev,
        [assistantMessage.id]: assistantMessage.feedback ?? null,
      }));
      setConversations((prev) =>
        prev
          .map((conv) =>
            conv.id === conversationId
              ? {
                  ...conv,
                  lastMessageAt: assistantMessage.createdAt,
                  title:
                    shouldRename && newTitleCandidate
                      ? newTitleCandidate
                      : conv.title,
                }
              : conv
          )
          .sort((a, b) => {
            const timeA = a.lastMessageAt
              ? new Date(a.lastMessageAt).getTime()
              : 0;
            const timeB = b.lastMessageAt
              ? new Date(b.lastMessageAt).getTime()
              : 0;
            return timeB - timeA;
          })
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "AI service is unavailable. Please try again."
      );
      setMessagesByConversation((prev) => {
        const current = (prev[conversationId] || []).filter(
          (msg) => msg.id !== tempUserMessage.id
        );
        return {
          ...prev,
          [conversationId]: current,
        };
      });
    } finally {
      setIsSending(false);
    }
  };

  const createConversation = async (title: string) => {
    if (creatingConversation) return null;
    try {
      setCreatingConversation(true);
      const res = await aiConversationApi.create(title);
      setConversations((prev) => [res.conversation, ...prev]);
      setMessagesByConversation((prev) => ({
        ...prev,
        [res.conversation.id]: res.messages || [],
      }));
      setActiveConversationId(res.conversation.id);
      return res.conversation;
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create conversation."
      );
      return null;
    } finally {
      setCreatingConversation(false);
    }
  };

  const handleNewConversation = () => {
    setError(null);
    createConversation("New Conversation");
  };

  const handleDeleteConversation = async (id: string) => {
    try {
      await aiConversationApi.remove(id);
      setConversations((prev) => {
        const filtered = prev.filter((c) => c.id !== id);
        if (id === activeConversationId) {
          setActiveConversationId(filtered[0]?.id || null);
        }
        return filtered;
      });
      setMessagesByConversation((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to delete conversation."
      );
    }
  };

  const handleCopyMessage = (id: string, content: string) => {
    navigator.clipboard.writeText(content).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId((current) => (current === id ? null : current)), 1500);
    });
  };

  const handleFeedback = (id: string, value: "up" | "down") => {
    setFeedbacks((prev) => {
      const current = prev[id];
      const nextValue = current === value ? null : value;
      const next = { ...prev, [id]: nextValue };
      if (activeConversationId) {
        aiConversationApi.setFeedback(activeConversationId, id, nextValue).catch(() => {
          // revert on error
          setFeedbacks(prevState => ({ ...prevState, [id]: current }));
        });
      }
      return next;
    });
  };

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });

  const renderMessages = () => {
    if (!activeConversationId) {
      return <div className="aiChatEmpty">Create a conversation to get started.</div>;
    }

    if (loadingMessages && currentMessages.length === 0) {
      return <div className="aiChatEmpty">Loading messages...</div>;
    }

    return (
      <div className="aiChatMessages">
        {error && <div className="aiChatError">{error}</div>}

        {currentMessages.map((message) => {
          const isUser = message.role === "user";
          return (
            <div key={message.id} className={`msgRow ${isUser ? "fromUser" : "fromAI"}`}>
              <div className="msgAvatar">
                <div className={`msgAvatarInner ${isUser ? "userAvatar" : "aiAvatar"}`}>
                  {isUser ? <User className="icon-sm" /> : <Sparkles className="icon-sm" />}
                </div>
              </div>
              <div className="msgContent">
                <div
                  className={`msgBubble ${isUser ? "msgUser" : "msgAI"} ${
                    bubbleDensity === "compact" ? "compact" : "comfortable"
                  }`}
                >
                  <p className="msgText">{message.content}</p>
                </div>
                <div className={`msgMeta ${isUser ? "metaRight" : ""}`}>
                  <span>{formatTime(message.createdAt)}</span>
                  <span className="dot" />
                  <button
                    type="button"
                    className="msgAction"
                    onClick={() => handleCopyMessage(message.id, message.content)}
                  >
                    {copiedId === message.id ? "Copied" : "Copy"}
                  </button>
                  {message.role === "assistant" && (
                    <div className="msgActions">
                      {(() => {
                        const isUp = feedbacks[message.id] === "up";
                        const isDown = feedbacks[message.id] === "down";
                        return (
                          <>
                            <button
                              type="button"
                              aria-label="Like reply"
                              aria-pressed={isUp}
                              className={`iconBtn ${isUp ? "active" : ""}`}
                              onClick={() => handleFeedback(message.id, "up")}
                            >
                              <ThumbsUp className="icon-sm" />
                            </button>
                            <button
                              type="button"
                              aria-label="Dislike reply"
                              aria-pressed={isDown}
                              className={`iconBtn ${isDown ? "active" : ""}`}
                              onClick={() => handleFeedback(message.id, "down")}
                            >
                              <ThumbsDown className="icon-sm" />
                            </button>
                          </>
                        );
                      })()}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {isSending && (
          <div className="msgRow fromAI">
            <div className="msgAvatar">
              <div className="msgAvatarInner aiAvatar">
                <Sparkles className="icon-sm" />
              </div>
            </div>
            <div className="msgContent">
              <div className="msgBubble msgAI comfortable">
                <div className="typing">
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const showSidebarPlaceholder =
    loadingConversations && conversations.length === 0;

  const handleExportConversation = async (format: "json" | "text") => {
    if (!activeConversationId) return;
    const meta = conversations.find((c) => c.id === activeConversationId);
    const titleSafe =
      (meta?.title || "conversation")
        .replace(/[^\w\d-_]+/g, "_")
        .slice(0, 50) || "conversation";
    const messages = messagesByConversation[activeConversationId] || [];
    const payload =
      format === "json"
        ? JSON.stringify(
            { id: activeConversationId, title: meta?.title, messages },
            null,
            2
          )
        : messages
            .map((m) => `${m.role === "assistant" ? "AI" : "You"}: ${m.content}`)
            .join("\n\n");

    try {
      setExporting(true);
      const blob = new Blob([payload], {
        type: format === "json" ? "application/json" : "text/plain",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${titleSafe}.${format === "json" ? "json" : "txt"}`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className={`aiChatPage ${themeMode === "dark" ? "ai-dark" : "ai-light"}`}>
      <div className="aiChatBg" />
      <div className="aiChatContainer">
        <aside className={`aiChatSidebar ${isSidebarOpen ? "" : "collapsed"}`}>
          <div className="aiChatSidebarHeader">
            <div className="title">
              <Sparkles className="icon-sm" />
              <span>Conversations</span>
            </div>
            <button className="iconBtn" onClick={() => setIsSidebarOpen(false)}>
              <X className="icon-sm" />
            </button>
          </div>
          <button className="aiChatNewChatBtn" onClick={handleNewConversation} disabled={creatingConversation}>
            <Plus className="icon-sm" />
            New Chat
          </button>
          <div className="aiChatConvList">
            {showSidebarPlaceholder && <p className="muted">Loading...</p>}
            {conversations.map((conv) => (
              <div
                key={conv.id}
                className={`aiChatConvItem ${activeConversationId === conv.id ? "isActive" : ""}`}
                onClick={() => setActiveConversationId(conv.id)}
              >
                <div className="convTitle">
                  <MessageSquare className="icon-sm" />
                  <div>
                    <p className="line-clamp-1">{conv.title}</p>
                    <span className="muted">
                      {conv.lastMessageAt
                        ? `Updated ${new Date(conv.lastMessageAt).toLocaleTimeString()}`
                        : "New conversation"}
                    </span>
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="iconBtn ghost">
                      <MoreVertical className="icon-sm" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleDeleteConversation(conv.id)}>
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
          </div>
          <button className="secondaryBtn" onClick={onBack}>
            <ArrowLeft className="icon-sm" />
            Back to Home
          </button>
        </aside>

        <main className="aiChatMain">
          <div className="aiChatTopbar">
            <div className="aiChatTitleBlock">
              <button className="iconBtn ghost" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
                <Menu className="icon-sm" />
              </button>
              <div>
                <p className="title">SocialHub AI</p>
                <p className="subtitle">Always here to help</p>
              </div>
            </div>
            <button className="aiChatSettingsBtn iconBtn" onClick={() => setSettingsOpen((v) => !v)} aria-label="Open settings">
              <Settings className="icon-sm" />
            </button>
          </div>

          <div className="aiChatMessagesContainer">
            <ScrollArea className="aiChatMessagesScroll">{renderMessages()}</ScrollArea>
          </div>

          <div className="aiChatComposer">
            <Input
              className="composerInput"
              placeholder="Type your message..."
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              disabled={isSending || !activeConversationId}
            />
            <button
              className="sendBtn"
              onClick={handleSendMessage}
              disabled={!inputMessage.trim() || isSending || !activeConversationId}
            >
              <Send className="icon-sm" />
            </button>
          </div>
        </main>
      </div>

      {settingsOpen && (
        <>
          <div className="prefOverlay" onClick={() => setSettingsOpen(false)} />
          <div className="prefDrawer">
            <div className="prefHeader">
              <p>Preferences</p>
              <button className="iconBtn ghost" onClick={() => setSettingsOpen(false)}>
                <X className="icon-sm" />
              </button>
            </div>

            <div className="prefSection">
              <p className="sectionLabel">AI reply language</p>
              <div className="segmented">
                <button
                  className={`segBtn ${replyLanguage === "en" ? "segBtnActive" : ""}`}
                  onClick={() => setReplyLanguage("en")}
                >
                  English
                </button>
                <button
                  className={`segBtn ${replyLanguage === "vi" ? "segBtnActive" : ""}`}
                  onClick={() => setReplyLanguage("vi")}
                >
                  Vietnamese
                </button>
              </div>
            </div>

            <div className="prefSection">
              <p className="sectionLabel">Message density</p>
              <div className="segmented">
                <button
                  className={`segBtn ${bubbleDensity === "comfortable" ? "segBtnActive" : ""}`}
                  onClick={() => setBubbleDensity("comfortable")}
                >
                  Comfortable
                </button>
                <button
                  className={`segBtn ${bubbleDensity === "compact" ? "segBtnActive" : ""}`}
                  onClick={() => setBubbleDensity("compact")}
                >
                  Compact
                </button>
              </div>
            </div>

            <div className="prefSection">
              <p className="sectionLabel">Theme</p>
              <div className="segmented">
                <button
                  className={`segBtn ${themeMode === "light" ? "segBtnActive" : ""}`}
                  onClick={() => applyTheme("light")}
                >
                  Light
                </button>
                <button
                  className={`segBtn ${themeMode === "dark" ? "segBtnActive" : ""}`}
                  onClick={() => applyTheme("dark")}
                >
                  Dark
                </button>
              </div>
            </div>

            <div className="prefSection">
              <p className="sectionLabel">Export</p>
              <div className="segmented">
                <button
                  className="segBtn"
                  disabled={!activeConversationId || exporting}
                  onClick={() => handleExportConversation("json")}
                >
                  JSON
                </button>
                <button
                  className="segBtn"
                  disabled={!activeConversationId || exporting}
                  onClick={() => handleExportConversation("text")}
                >
                  Text
                </button>
              </div>
              {exporting && <p className="muted extra">Preparing export...</p>}
            </div>

            <div className="prefFooter">
              <Button variant="ghost" onClick={() => setSettingsOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
