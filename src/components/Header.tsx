import { Button } from "./ui/button";
import { Menu, X, LogOut, User as UserIcon } from "lucide-react";
import UserMenu from "./UserMenu";
import { useState } from "react";
import { AuthUser } from "../services/auth";
import { NotificationDropdown } from "./NotificationDropdown";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import "../styles/headerDropdown.css";

export function Header({
  onProfileOpen,
  onSettingsOpen,
  onChatOpen,
  onLoginOpen,
  onSignUpOpen,
  onManageDash,
  onTemplateOpen,
  currentUser,
  onLogout,
}: {
  onSettingsOpen?: () => void;
  onChatOpen?: () => void;
  onLoginOpen?: () => void;
  onSignUpOpen?: () => void;
  onManageDash?: () => void;
  onTemplateOpen?: () => void;
  currentUser?: AuthUser | null;
  onLogout?: () => void;
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const pathname = location.pathname || "/";
  const activeKey =
    pathname === "/" || pathname.startsWith("/home")
      ? "home"
      : pathname.startsWith("/managedash") || pathname.startsWith("/dashboard")
        ? "dashboard"
        : pathname.startsWith("/chat")
          ? "chat"
          : pathname.startsWith("/contact")
            ? "contact"
            : "";

  return (
    <header className="w-full bg-white border-b border-slate-200 shadow-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <h1 className="text-2xl font-bold brand-mark">SocialHub</h1>
            </div>
          </div>
          
          {/* Desktop Navigation */}
          <nav className="hidden md:block">
            <div className="ml-10 flex items-baseline space-x-8">
              <a href="/home" className={`nav-link ${activeKey === "home" ? "active" : ""}`}>Home</a>
              {currentUser && (
                <button
                  onClick={onManageDash}
                  className={`nav-link text-sm ${activeKey === "dashboard" ? "active" : ""}`}
                >
                  Dashboard
                </button>
              )}
              {/* AI Chat moved into the nav between Testimonials and Contact */}
              <button onClick={onChatOpen} className={`nav-link text-sm ${activeKey === "chat" ? "active" : ""}`}>AI Chat</button>
              <a href="/contact" className={`nav-link ${activeKey === "contact" ? "active" : ""}`}>Contact</a>
              <button
                onClick={onTemplateOpen ?? (() => navigate("/template"))}
                className={`nav-link text-sm ${pathname.startsWith("/template") ? "active" : ""}`}
              >
                Template
              </button>
            </div>
          </nav>

          {/* Desktop CTA */}
          <div className="hidden md:block">
            {/* Pull right-side controls slightly left so they don't sit flush with the edge */}
            <div className="ml-4 flex items-center md:ml-6 space-x-4 md:-mr-8">
              {/* AI Chat button moved to desktop navigation */}
              {currentUser ? (
                <>
                  <NotificationDropdown />
                  <UserMenu
                    userName={currentUser.fullName || currentUser.email}
                    role={currentUser.role}
                    onAdmin={() => navigate("/admin")}
                    onProfile={onProfileOpen}
                    onSettings={onSettingsOpen}
                    onSignOut={onLogout}
                  />
                </>
              ) : (
                <>
                  <Button variant="ghost" className="cta-ghost" onClick={onLoginOpen}>Sign In</Button>
                  <Button className="cta-primary" onClick={onSignUpOpen}>Start Free Trial</Button>
                </>
              )}
            </div>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-600 hover:text-primary hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary"
            >
              {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {isMenuOpen && (
        <div className="md:hidden">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 bg-white border-t border-gray-100">
            <a href="/home" className="block px-3 py-2 text-gray-700 hover:text-primary font-semibold">Home</a>
            {currentUser && (
              <Button
                variant="ghost"
                className="w-full text-left px-3 py-2"
                onClick={() => {
                  onManageDash?.();
                  setIsMenuOpen(false);
                }}
              >
                Dashboard
              </Button>
            )}
            <a href="#contact" className="block px-3 py-2 text-gray-700 hover:text-primary font-semibold">Contact</a>
              <div className="px-3 py-2 space-y-2">
              <Button variant="ghost" className="w-full" onClick={onChatOpen}>AI Chat</Button>
              <Button variant="ghost" className="w-full" onClick={onTemplateOpen ?? (() => { setIsMenuOpen(false); navigate("/template"); })}>
                Template
              </Button>
                {currentUser ? (
                  <>
                    <div className="flex items-center px-3 py-2 text-sm text-gray-700">
                      <UserIcon className="h-4 w-4 mr-2 text-primary" />
                      {currentUser.fullName || currentUser.email}
                    </div>
                    <Button variant="ghost" className="w-full" onClick={() => { onProfileOpen?.(); setIsMenuOpen(false); }}>Profile</Button>
                    {onSettingsOpen && <Button variant="ghost" className="w-full" onClick={() => { onSettingsOpen?.(); setIsMenuOpen(false); }}>Settings</Button>}
                    <Button variant="outline" className="w-full" onClick={() => { onLogout?.(); setIsMenuOpen(false); }}>
                      <LogOut className="h-4 w-4 mr-2" />
                      Sign out
                    </Button>
                </>
              ) : (
                <>
                  <Button variant="ghost" className="w-full cta-ghost" onClick={onLoginOpen}>Sign In</Button>
                  <Button className="w-full cta-primary" onClick={onSignUpOpen}>Start Free Trial</Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
