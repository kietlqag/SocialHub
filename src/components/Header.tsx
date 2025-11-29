import { Button } from "./ui/button";
import { Menu, X, LogOut, User as UserIcon } from "lucide-react";
import UserMenu from "./UserMenu";
import { useState } from "react";
import { AuthUser } from "../services/auth";
import { NotificationDropdown } from "./NotificationDropdown";

export function Header({
  onProfileOpen,
  onSettingsOpen,
  onChatOpen,
  onLoginOpen,
  onSignUpOpen,
  onManageDash,
  currentUser,
  onLogout,
}: {
  onSettingsOpen?: () => void;
  onChatOpen?: () => void;
  onLoginOpen?: () => void;
  onSignUpOpen?: () => void;
  onManageDash?: () => void;
  currentUser?: AuthUser | null;
  onLogout?: () => void;
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <header className="w-full bg-white/95 backdrop-blur-sm border-b border-gray-100 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <h1 className="text-2xl font-bold text-primary">SocialHub</h1>
            </div>
          </div>
          
          {/* Desktop Navigation */}
          <nav className="hidden md:block">
            <div className="ml-10 flex items-baseline space-x-8">
              <a href="/home" className="text-gray-600 hover:text-primary transition-colors">Home</a>
              <button
                onClick={onManageDash}
                className="text-gray-600 hover:text-primary transition-colors px-2 py-1 rounded-md text-sm"
              >
                Dashboard
              </button>
              {/* AI Chat moved into the nav between Testimonials and Contact */}
              <button onClick={onChatOpen} className="text-gray-600 hover:text-primary transition-colors px-2 py-1 rounded-md text-sm">AI Chat</button>
              <a href="#contact" className="text-gray-600 hover:text-primary transition-colors">Contact</a>
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
                    avatarUrl={currentUser.avatarUrl || undefined}
                    onProfile={onProfileOpen}
                    onSettings={onSettingsOpen}
                    onSignOut={onLogout}
                  />
                </>
              ) : (
                <>
                  <Button variant="ghost" onClick={onLoginOpen}>Sign In</Button>
                  <Button onClick={onSignUpOpen}>Start Free Trial</Button>
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
            <a href="/home" className="block px-3 py-2 text-gray-600 hover:text-primary">Home</a>
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
            <a href="#contact" className="block px-3 py-2 text-gray-600 hover:text-primary">Contact</a>
              <div className="px-3 py-2 space-y-2">
              <Button variant="ghost" className="w-full" onClick={onChatOpen}>AI Chat</Button>
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
                  <Button variant="ghost" className="w-full" onClick={onLoginOpen}>Sign In</Button>
                  <Button className="w-full" onClick={onSignUpOpen}>Start Free Trial</Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
