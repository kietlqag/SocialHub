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
import { ProfileSettings } from "./pages/ProfileSettings";
import { NotificationPage } from "./pages/NotificationPage";
import Profile from "./pages/Profile";
import ManageDashList from "./pages/ManageDashList";
import ManageDashDetail from "./pages/ManageDashDetail";
import { clearSession, fetchMe, getCurrentSession, type AuthUser } from "./services/auth";

const Landing = ({ currentUser, onLogout }: { currentUser: AuthUser | null; onLogout: () => void }) => {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-white">
      <Header
        onChatOpen={() => navigate("/chat")}
        onLoginOpen={() => navigate("/login")}
        onSignUpOpen={() => navigate("/register")}
        onProfileOpen={() => navigate("/profile")}
        onSettingsOpen={() => navigate("/settings")}
        onManageDash={() => navigate("/managedash")}
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

const SettingsPage = () => {
  const navigate = useNavigate();
  return <ProfileSettings onBack={() => navigate("/")} onLogout={() => navigate("/")} />;
};

const NotificationsPage = () => {
  const navigate = useNavigate();
  return <NotificationPage onBack={() => navigate("/")} />;
};

const RequireAuth = ({ user, children }: { user: AuthUser | null; children: JSX.Element }) => {
  const location = useLocation();
  if (!user) {
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
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/profile" element={<Profile />} />
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
