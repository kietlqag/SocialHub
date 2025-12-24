import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { Header } from "./components/Header";
import { Hero } from "./components/Hero";
import { Features } from "./components/Features";
import { Testimonials } from "./components/Testimonials";
import { Pricing } from "./components/Pricing";
import { Footer } from "./components/Footer";
import { Login } from "./pages/Login";
import { SignUp } from "./pages/SignUp";
import { AIConversation } from "./pages/AIConversation";
import { AdminPage } from "./pages/AdminPage";
import { ProfileSettings } from "./pages/ProfileSettings";
import { NotificationPage } from "./pages/NotificationPage";
import Profile from "./pages/Profile";
import ManageDashList from "./pages/ManageDashList";
import ManageDashDetail from "./pages/ManageDashDetail";
import Contact from "./pages/Contact";
import { clearSession, fetchMe, getCurrentSession, persistSession, type AuthUser } from "./services/auth";
import "./styles/home.css";
import ExploreDashboardsPage from "./pages/ExploreDashboardsPage";

const Landing = ({ currentUser, onLogout }: { currentUser: AuthUser | null; onLogout: () => void }) => {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen landing-page text-slate-900">
      <Header
        onChatOpen={() => navigate("/chat")}
        onLoginOpen={() => navigate("/login")}
        onSignUpOpen={() => navigate("/register")}
        onProfileOpen={() => navigate("/profile")}
        onSettingsOpen={() => navigate("/settings")}
        onManageDash={() => navigate("/managedash")}
        onAdmin={() => navigate("/admin")}
        currentUser={currentUser}
        onLogout={onLogout}
      />
      <main>
        <Hero onLoginOpen={() => navigate("/login")} onSignUpOpen={() => navigate("/register")} isAuthenticated={!!currentUser} />
        <Features />
        <Testimonials />
        <Pricing />
      </main>
      <Footer />
    </div>
  );
};

const LoginPage = ({ onLoginSuccess }: { onLoginSuccess: (user: AuthUser) => void }) => {
  const navigate = useNavigate();
  return (
    <Login
      onBack={() => navigate("/")}
      onSwitchToSignUp={() => navigate("/register")}
      onSuccess={(user) => {
        onLoginSuccess(user);
        navigate("/home");
      }}
    />
  );
};

const SignUpPage = ({ onLoginSuccess }: { onLoginSuccess: (user: AuthUser) => void }) => {
  const navigate = useNavigate();
  return (
    <SignUp
      onBack={() => navigate("/")}
      onSwitchToLogin={() => navigate("/login")}
      onSuccess={(user) => {
        onLoginSuccess(user);
        navigate("/home");
      }}
    />
  );
};

const ChatPage = () => {
  const navigate = useNavigate();
  return <AIConversation onBack={() => navigate("/")} />;
};

const SettingsPage = ({ currentUser, onLogout }: { currentUser: AuthUser | null; onLogout: () => void }) => {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen">
      <Header
        onChatOpen={() => navigate("/chat")}
        onLoginOpen={() => navigate("/login")}
        onSignUpOpen={() => navigate("/register")}
        onProfileOpen={() => navigate("/profile")}
        onSettingsOpen={() => navigate("/settings")}
        onManageDash={() => navigate("/managedash")}
        onAdmin={() => navigate("/admin")}
        currentUser={currentUser}
        onLogout={onLogout}
      />
      <main>
        <ProfileSettings onBack={() => navigate("/")} onLogout={() => navigate("/")} />
      </main>
    </div>
  );
};

const OAuthCallbackPage = ({ onLoginSuccess }: { onLoginSuccess: (user: AuthUser) => void }) => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const token = params.get("token");
    const error = params.get("error");
    if (error) {
      navigate("/login", { replace: true, state: { error } });
      return;
    }
    if (!token) {
      navigate("/login", { replace: true });
      return;
    }
    fetchMe(token)
      .then((res) => {
        const session = { user: res.user, token };
        persistSession(session, true);
        onLoginSuccess(res.user);
        navigate("/home", { replace: true });
      })
      .catch(() => navigate("/login", { replace: true }))
      // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search, navigate, onLoginSuccess]);

  return (
    <div className="min-h-screen flex items-center justify-center text-gray-700">
      Completing sign-in...
    </div>
  );
};

const NotificationsPage = () => {
  const navigate = useNavigate();
  return <NotificationPage onBack={() => navigate("/")} />;
};

const ContactPage = ({ currentUser, onLogout }: { currentUser: AuthUser | null; onLogout: () => void }) => {
  return <Contact currentUser={currentUser} onLogout={onLogout} />;
};

const RequireAuth = ({ user, children }: { user: AuthUser | null; children: JSX.Element }) => {
  const location = useLocation();
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return children;
};

const RequireAdmin = ({ user, children }: { user: AuthUser | null; children: JSX.Element }) => {
  const location = useLocation();
  if (!user || user.role !== "admin") {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return children;
};

function App() {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    const session = getCurrentSession();
    if (session?.token) {
      if (session.user) {
        setCurrentUser(session.user);
      }
      fetchMe(session.token)
        .then((res) => setCurrentUser(res.user))
        .catch(() => {
          clearSession();
          setCurrentUser(null);
        })
        .finally(() => setCheckingSession(false));
    } else {
      setCheckingSession(false);
    }
  }, []);

  const handleLogout = () => {
    clearSession();
    setCurrentUser(null);
  };

  const handleLoginSuccess = (user: AuthUser) => {
    setCurrentUser(user);
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-600">
        Loading...
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing currentUser={currentUser} onLogout={handleLogout} />} />
        <Route path="/home" element={<Landing currentUser={currentUser} onLogout={handleLogout} />} />
        <Route path="/login" element={<LoginPage onLoginSuccess={handleLoginSuccess} />} />
        <Route path="/register" element={<SignUpPage onLoginSuccess={handleLoginSuccess} />} />
        <Route path="/auth/callback" element={<OAuthCallbackPage onLoginSuccess={handleLoginSuccess} />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/settings" element={<SettingsPage currentUser={currentUser} onLogout={handleLogout} />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/contact" element={<ContactPage currentUser={currentUser} onLogout={handleLogout} />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/explore" element={<ExploreDashboardsPage currentUser={currentUser} onLogout={handleLogout} />} />
        <Route
          path="/admin"
          element={
            <RequireAdmin user={currentUser}>
              <AdminPage />
            </RequireAdmin>
          }
        />
        <Route
          path="/managedash"
          element={
            <RequireAuth user={currentUser}>
              <ManageDashList />
            </RequireAuth>
          }
        />
        <Route
          path="/managedash/:dashId"
          element={
            <RequireAuth user={currentUser}>
              <ManageDashDetail />
            </RequireAuth>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
