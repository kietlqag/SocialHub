import { Header } from "./components/Header";
import { Hero } from "./components/Hero";
import { Features } from "./components/Features";
import { Testimonials } from "./components/Testimonials";
import { Pricing } from "./components/Pricing";
import { Footer } from "./components/Footer";
import { Login } from "./components/Login";
import { SignUp } from "./components/SignUp";
import { AIConversation } from "./components/AIConversation";
import { useState } from "react";
import { AuthUser, getCurrentSession, clearSession, fetchMe, persistSession } from "./services/auth";
import { useEffect } from "react";
// PlatformBuilder removed

export default function App() {
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isSignUpOpen, setIsSignUpOpen] = useState(false);
  const [isAIConversationOpen, setIsAIConversationOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    const session = getCurrentSession();
    if (session?.user && session?.token) {
      fetchMe(session.token)
        .then((res) => setCurrentUser(res.user))
        .catch(() => clearSession());
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenFromOAuth = params.get("token");
    if (tokenFromOAuth) {
      fetchMe(tokenFromOAuth)
        .then((res) => {
          persistSession({ token: tokenFromOAuth, user: res.user }, true);
          setCurrentUser(res.user);
          setIsLoginOpen(false);
          setIsSignUpOpen(false);
          setIsAIConversationOpen(false);
        })
        .finally(() => {
          params.delete("token");
          const newQuery = params.toString();
          const newUrl = `${window.location.pathname}${newQuery ? `?${newQuery}` : ""}${window.location.hash}`;
          window.history.replaceState({}, "", newUrl);
        });
    }
  }, []);

  const handleLoginSuccess = (user: AuthUser) => {
    setCurrentUser(user);
    setIsLoginOpen(false);
    setIsSignUpOpen(false);
    setIsAIConversationOpen(false);
  };

  const handleLogout = () => {
    clearSession();
    setCurrentUser(null);
    setIsAIConversationOpen(false);
  };

  return (
    <div className="min-h-screen bg-white">
      {isAIConversationOpen ? (
        <AIConversation onBack={() => setIsAIConversationOpen(false)} />
      ) : isSignUpOpen ? (
        <SignUp 
          onBack={() => setIsSignUpOpen(false)} 
          onSwitchToLogin={() => {
            setIsSignUpOpen(false);
            setIsLoginOpen(true);
          }}
        />
      ) : isLoginOpen ? (
        <Login 
          onBack={() => setIsLoginOpen(false)}
          onSwitchToSignUp={() => {
            setIsLoginOpen(false);
            setIsSignUpOpen(true);
          }}
          onSuccess={handleLoginSuccess}
        />
      ) : (
        <>
          <Header 
            onChatOpen={() => setIsAIConversationOpen(true)}
            onLoginOpen={() => setIsLoginOpen(true)}
            onSignUpOpen={() => setIsSignUpOpen(true)}
            currentUser={currentUser}
            onLogout={handleLogout}
          />
          <main>
            <Hero 
              onLoginOpen={() => setIsLoginOpen(true)}
              onSignUpOpen={() => setIsSignUpOpen(true)}
              isAuthenticated={!!currentUser}
            />
            <Features />
            <Testimonials />
            <Pricing />
          </main>
          <Footer />
        </>
      )}
    </div>
  );
}
