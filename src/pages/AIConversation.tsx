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
      return (
        <div className="flex flex-1 items-center justify-center text-gray-500 dark:text-white">
          Create a conversation to get started.
        </div>
      );
    }

    if (loadingMessages && currentMessages.length === 0) {
      return (
        <div className="flex flex-1 items-center justify-center text-gray-500 dark:text-white">
          Loading messages...
        </div>
      );
    }

    return (
      <div className="h-full px-6 py-6">
        <div className="max-w-3xl mx-auto space-y-6">
          {error && (
            <div className="px-4 py-3 bg-red-50 dark:bg-red-900/40 border border-red-200 dark:border-red-700 rounded-lg text-sm text-red-700 dark:text-red-100">
              {error}
            </div>
          )}

          {currentMessages.map((message) => (
            <div
              key={message.id}
              className={`flex ${
                message.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`flex items-start gap-3 max-w-[85%] ${
                  message.role === "user" ? "flex-row-reverse" : ""
                }`}
              >
                <Avatar className="h-10 w-10 flex-shrink-0">
                  <div
                    className={`h-full w-full rounded-full flex items-center justify-center ${
                      message.role === "assistant"
                        ? "bg-primary/10 text-primary"
                        : "bg-gray-200 text-gray-700"
                    }`}
                  >
                    {message.role === "assistant" ? (
                      <Sparkles className="h-5 w-5" />
                    ) : (
                      <User className="h-5 w-5" />
                    )}
                  </div>
                </Avatar>
                <div
                    className={`space-y-2 ${
                    message.role === "user" ? "text-right" : ""
                  }`}
                >
                  <div
                    className={`${
                      bubbleDensity === "compact" ? "px-4 py-2" : "px-5 py-3"
                    } rounded-2xl ${
                      message.role === "user"
                        ? "bg-primary text-white rounded-tr-sm dark:bg-white dark:text-black user-bubble"
                        : "bg-white text-gray-900 shadow-sm border border-gray-200 rounded-tl-sm dark:bg-slate-700 dark:text-white dark:border-slate-500 assistant-bubble"
                    }`}
                  >
                    <p
                      className={`whitespace-pre-line text-sm ${
                        message.role === "user"
                          ? "text-white dark:text-black"
                          : "text-gray-900 dark:text-white"
                      }`}
                    >
                      {message.content}
                    </p>
                  </div>
                  <div
                    className={`flex items-center gap-3 text-xs text-gray-500 dark:text-white ${
                      message.role === "user" ? "justify-end" : ""
                    }`}
                  >
                    <span>{formatTime(message.createdAt)}</span>
                    <Separator orientation="vertical" className="h-3" />
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleCopyMessage(message.id, message.content)}
                        className="hover:text-gray-700 dark:hover:text-gray-200"
                      >
                        Copy
                      </button>
                      {copiedId === message.id && (
                        <span className="text-[11px] text-green-500">Copied</span>
                      )}
                    </div>
                    {message.role === "assistant" && (
                      <>
                        {(() => {
                          const isUp = feedbacks[message.id] === "up";
                          const isDown = feedbacks[message.id] === "down";
                          return (
                            <>
                              <button
                                type="button"
                                aria-label="Like reply"
                                aria-pressed={isUp}
                                onClick={() => handleFeedback(message.id, "up")}
                                className={`inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors cursor-pointer ${
                                  isUp
                                    ? themeMode === "dark"
                                      ? "bg-white text-black"
                                      : "bg-primary text-white"
                                    : "text-gray-500 dark:text-gray-300 hover:bg-primary/10 hover:text-primary"
                                }`}
                              >
                                <ThumbsUp
                                  className="h-3.5 w-3.5"
                                  style={{
                                    color: isUp
                                      ? themeMode === "dark"
                                        ? "#000000"
                                        : "#ffffff"
                                      : undefined,
                                  }}
                                />
                              </button>
                              <button
                                type="button"
                                aria-label="Dislike reply"
                                aria-pressed={isDown}
                                onClick={() => handleFeedback(message.id, "down")}
                                className={`inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors cursor-pointer ${
                                  isDown
                                    ? themeMode === "dark"
                                      ? "bg-white text-black"
                                      : "bg-primary text-white"
                                    : "text-gray-500 dark:text-gray-300 hover:bg-primary/10 hover:text-primary"
                                }`}
                              >
                                <ThumbsDown
                                  className="h-3.5 w-3.5"
                                  style={{
                                    color: isDown
                                      ? themeMode === "dark"
                                        ? "#000000"
                                        : "#ffffff"
                                      : undefined,
                                  }}
                                />
                              </button>
                            </>
                          );
                        })()}
                        <button
                          type="button"
                          aria-label="Like reply"
                          className="hidden"
                        >
                          Like
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}

          {isSending && (
            <div className="flex justify-start">
              <div className="flex items-center gap-3 max-w-[85%]">
                <Avatar className="h-10 w-10 flex-shrink-0">
                  <div className="h-full w-full rounded-full bg-primary/10 text-primary flex items-center justify-center">
                    <Sparkles className="h-5 w-5" />
                  </div>
                </Avatar>
                <div className="px-5 py-3 rounded-2xl bg-white dark:bg-slate-700 shadow-sm border border-gray-200 dark:border-slate-600">
                  <div className="flex space-x-2">
                    <div className="h-2 w-2 bg-gray-400 rounded-full animate-bounce" />
                    <div
                      className="h-2 w-2 bg-gray-400 rounded-full animate-bounce"
                      style={{ animationDelay: "0.15s" }}
                    />
                    <div
                      className="h-2 w-2 bg-gray-400 rounded-full animate-bounce"
                      style={{ animationDelay: "0.3s" }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
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
    <>
      <div
        className={`fixed inset-0 flex overflow-hidden app-shell ${
          themeMode === "dark" ? "dark ai-dark" : "ai-light"
        }`}
      >
      {/* SIDEBAR */}
      <div
        className={`${
          isSidebarOpen ? "w-64" : "w-0"
        } border-r sidebar-panel flex flex-col transition-all duration-300 overflow-hidden h-full`}
      >
        <div className="p-4 border-b flex-shrink-0 relative sidebar-panel">
          <div className="flex items-center justify-between mb-4 gap-2">
            <div className="flex items-center gap-2">
              <h2 className="text-lg text-gray-900 dark:text-white">Conversations</h2>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsSidebarOpen(false)}
                className="md:hidden"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <Button onClick={handleNewConversation} className="w-full">
            <Plus className="h-4 w-4 mr-2" />
            New Chat
          </Button>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {showSidebarPlaceholder && (
              <p className="text-sm text-gray-500 dark:text-white px-3 py-2">Loading...</p>
            )}
            {conversations.map((conv) => (
              <div
                key={conv.id}
                className={`group relative p-3 rounded-lg cursor-pointer transition-colors ${
                  activeConversationId === conv.id
                    ? "bg-white text-black border border-gray-600 active-conversation"
                    : "hover:bg-gray-100 dark:hover:bg-gray-800"
                }`}
                onClick={() => setActiveConversationId(conv.id)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 flex-1 min-w-0">
                    <MessageSquare className="h-4 w-4 mt-0.5 flex-shrink-0 text-gray-400" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900 dark:text-white truncate">
                        {conv.title}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-white">
                        {conv.lastMessageAt
                          ? `Updated ${new Date(
                              conv.lastMessageAt
                            ).toLocaleTimeString()}`
                          : "New conversation"}
                      </p>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="inline-flex items-center justify-center h-6 w-6 rounded-md hover:bg-accent hover:text-accent-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                        <MoreVertical className="h-3 w-3" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => handleDeleteConversation(conv.id)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        <div className="p-4 border-t flex-shrink-0 sidebar-panel">
          <Button variant="outline" className="w-full" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Home
          </Button>
        </div>
      </div>

      {/* MAIN AREA */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Header */}
        <div className="border-b px-4 py-3 flex-shrink-0 sticky top-0 z-20 header-bar">
          <div className="flex items-center justify-between relative">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              >
                <Menu className="h-5 w-5" />
              </Button>
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Sparkles className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h1 className="text-base text-gray-900 dark:text-white">SocialHub AI</h1>
                  <p className="text-xs text-gray-500 dark:text-white">Always here to help</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSettingsOpen((v) => !v)}
                aria-label="Open settings"
              >
                <Settings className="h-4 w-4" />
              </Button>
            </div>

          </div>
        </div>

        {/* Messages area */}
        <div className="flex-1 min-h-0 overflow-hidden">
          <ScrollArea className="h-full">{renderMessages()}</ScrollArea>
        </div>

        {/* Input area */}
        <div className="border-t px-6 py-4 flex-shrink-0 sticky bottom-0 z-20 input-bar">
          <div className="max-w-3xl mx-auto flex items-end gap-3">
            <div className="flex-1">
              <Input
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
                className="input-field placeholder:text-gray-500 dark:placeholder:text-white"
              />
            </div>
            <Button
              size="icon"
              onClick={handleSendMessage}
              disabled={
                !inputMessage.trim() || isSending || !activeConversationId
              }
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>

    {settingsOpen && (
      <div className="fixed inset-0 z-[9999] flex justify-end items-start">
        <div
          className="absolute inset-0 bg-black/20"
          onClick={() => setSettingsOpen(false)}
        />
        <div className="relative mt-16 mr-6">
          <div className="w-72 max-h-[80vh] overflow-y-auto rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-black dark:text-gray-50 shadow-2xl p-3 space-y-3 panel-surface">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-50">Preferences</p>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSettingsOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                AI reply language
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant={replyLanguage === "en" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setReplyLanguage("en")}
                >
                  English
                </Button>
                <Button
                  variant={replyLanguage === "vi" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setReplyLanguage("vi")}
                >
                  Vietnamese
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                Message density
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant={bubbleDensity === "comfortable" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setBubbleDensity("comfortable")}
                >
                  Comfortable
                </Button>
                <Button
                  variant={bubbleDensity === "compact" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setBubbleDensity("compact")}
                >
                  Compact
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                Theme
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant={themeMode === "light" ? "default" : "outline"}
                  size="sm"
                  onClick={() => applyTheme("light")}
                >
                  Light
                </Button>
                <Button
                  variant={themeMode === "dark" ? "default" : "outline"}
                  size="sm"
                  onClick={() => applyTheme("dark")}
                >
                  Dark
                </Button>
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-600 dark:text-gray-300">Export</p>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!activeConversationId || exporting}
                  onClick={() => handleExportConversation("json")}
                >
                  JSON
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!activeConversationId || exporting}
                  onClick={() => handleExportConversation("text")}
                >
                  Text
                </Button>
              </div>
              {exporting && (
                <p className="text-[11px] text-gray-500 mt-1">
                  Preparing export...
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  );
}



