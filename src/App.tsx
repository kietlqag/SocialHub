import { Header } from "./components/Header";
import { Hero } from "./components/Hero";
import { Features } from "./components/Features";
import { Testimonials } from "./components/Testimonials";
import { Pricing } from "./components/Pricing";
import { Footer } from "./components/Footer";
import { Login } from "./components/Login";
import { SignUp } from "./components/SignUp";
import { AIConversation } from "./components/AIConversation";
import { useCallback, useState, useEffect } from "react";
import {
  AuthUser,
  getCurrentSession,
  clearSession,
  fetchMe,
  persistSession,
} from "./services/auth";
import { ProfileSettings } from "./components/ProfileSettings";
import { NotificationPage } from "./components/NotificationPage";
import Profile from "./components/Profile"; // nếu Profile ở /pages thì đổi path cho đúng

type View =
  | "home"
  | "login"
  | "register"
  | "chat"
  | "settings"
  | "notifications"
  | "profile";

const VIEW_PATH: Record<View, string> = {
  home: "/home",
  login: "/login",
  register: "/register",
  chat: "/chat",
  settings: "/settings",
  notifications: "/notifications",
  profile: "/profile",
};

export default function App() {
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isSignUpOpen, setIsSignUpOpen] = useState(false);
  const [isAIConversationOpen, setIsAIConversationOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);

  const setView = useCallback(
    (view: View, options?: { replace?: boolean }) => {
      setIsLoginOpen(view === "login");
      setIsSignUpOpen(view === "register");
      setIsAIConversationOpen(view === "chat");
      setIsSettingsOpen(view === "settings");
      setIsNotificationsOpen(view === "notifications");
      setIsProfileOpen(view === "profile");

      const targetPath = VIEW_PATH[view];
      if (window.location.pathname !== targetPath) {
        const method = options?.replace ? "replaceState" : "pushState";
        window.history[method]({}, "", targetPath);
      }
    },
    []
  );

  const applyPathToView = useCallback(() => {
    const path = window.location.pathname;

    if (path === VIEW_PATH.login) setView("login", { replace: true });
    else if (path === VIEW_PATH.register) setView("register", { replace: true });
    else if (path === VIEW_PATH.chat) setView("chat", { replace: true });
    else if (path === VIEW_PATH.settings) setView("settings", { replace: true });
    else if (path === VIEW_PATH.notifications)
      setView("notifications", { replace: true });
    else if (path === VIEW_PATH.profile)
      setView("profile", { replace: true });
    else setView("home", { replace: true });
  }, [setView]);

  // Lấy session hiện tại
  useEffect(() => {
    const session = getCurrentSession();
    if (session?.user && session?.token) {
      fetchMe(session.token)
        .then((res) => setCurrentUser(res.user))
        .catch(() => clearSession());
    }
  }, []);

  // Xử lý token OAuth nếu có
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenFromOAuth = params.get("token");
    if (tokenFromOAuth) {
      fetchMe(tokenFromOAuth)
        .then((res) => {
          persistSession({ token: tokenFromOAuth, user: res.user }, true);
          setCurrentUser(res.user);
          setView("home", { replace: true });
        })
        .finally(() => {
          params.delete("token");
          const newQuery = params.toString();
          const newUrl = `${window.location.pathname}${
            newQuery ? `?${newQuery}` : ""
          }${window.location.hash}`;
          window.history.replaceState({}, "", newUrl);
        });
    }
  }, [setView]);

  // Đồng bộ URL <-> view
  useEffect(() => {
    applyPathToView();
    const onPopstate = () => applyPathToView();
    window.addEventListener("popstate", onPopstate);
    return () => window.removeEventListener("popstate", onPopstate);
  }, [applyPathToView]);

  const handleLoginSuccess = (user: AuthUser) => {
    setCurrentUser(user);
    setView("home");
  };

  const handleLogout = () => {
    clearSession();
    setCurrentUser(null);
    setView("home");
  };

  const isHomeView =
    !isLoginOpen &&
    !isSignUpOpen &&
    !isAIConversationOpen &&
    !isSettingsOpen &&
    !isNotificationsOpen &&
    !isProfileOpen;

  return (
    <div className="min-h-screen bg-white">
      {isAIConversationOpen ? (
        <AIConversation onBack={() => setView("home")} />
      ) : isSignUpOpen ? (
        <SignUp
          onBack={() => setView("home")}
          onSwitchToLogin={() => setView("login")}
        />
      ) : isLoginOpen ? (
        <Login
          onBack={() => setView("home")}
          onSwitchToSignUp={() => setView("register")}
          onSuccess={handleLoginSuccess}
        />
      ) : isProfileOpen ? (
        <Profile />
      ) : isSettingsOpen ? (
        <ProfileSettings onBack={() => setView("home")} onLogout={handleLogout} />
      ) : isNotificationsOpen ? (
        <NotificationPage onBack={() => setView("home")} />
      ) : isHomeView ? (
        <>
          <Header
            onChatOpen={() => setView("chat")}
            onLoginOpen={() => setView("login")}
            onSignUpOpen={() => setView("register")}
            onProfileOpen={() => setView("profile")}
            onSettingsOpen={() => setView("settings")}
            currentUser={currentUser}
            onLogout={handleLogout}
          />

          <main>
            <Hero
              onLoginOpen={() => setView("login")}
              onSignUpOpen={() => setView("register")}
              isAuthenticated={!!currentUser}
            />
            <Features />
            <Testimonials />
            <Pricing />
          </main>

          <Footer />
        </>
      ) : null}
    </div>
  );
}