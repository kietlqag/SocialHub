import { Button } from "./ui/button";
import { Menu, X, LogOut, User as UserIcon } from "lucide-react";
import { useState } from "react";
import { AuthUser } from "../services/auth";

export function Header({
  onChatOpen,
  onLoginOpen,
  onSignUpOpen,
  currentUser,
  onLogout,
}: {
  onChatOpen?: () => void;
  onLoginOpen?: () => void;
  onSignUpOpen?: () => void;
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
              <a href="#features" className="text-gray-600 hover:text-primary transition-colors">Features</a>
              <a href="#pricing" className="text-gray-600 hover:text-primary transition-colors">Pricing</a>
              <a href="#testimonials" className="text-gray-600 hover:text-primary transition-colors">Testimonials</a>
              <button onClick={onChatOpen} className="text-gray-600 hover:text-primary transition-colors">AI Chat</button>
              <a href="#contact" className="text-gray-600 hover:text-primary transition-colors">Contact</a>
            </div>
          </nav>

          {/* Desktop CTA */}
          <div className="hidden md:block">
            <div className="ml-4 flex items-center md:ml-6 space-x-4">
              {currentUser ? (
                <>
                  <div className="flex items-center text-sm text-gray-700">
                    <UserIcon className="h-4 w-4 mr-1 text-primary" />
                    {currentUser.fullName || currentUser.email}
                  </div>
                  <Button variant="outline" onClick={onLogout}>
                    <LogOut className="h-4 w-4 mr-2" />
                    Sign out
                  </Button>
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
            <a href="#features" className="block px-3 py-2 text-gray-600 hover:text-primary">Features</a>
            <a href="#pricing" className="block px-3 py-2 text-gray-600 hover:text-primary">Pricing</a>
            <a href="#testimonials" className="block px-3 py-2 text-gray-600 hover:text-primary">Testimonials</a>
            <button onClick={onChatOpen} className="block w-full text-left px-3 py-2 text-gray-600 hover:text-primary">AI Chat</button>
            <a href="#contact" className="block px-3 py-2 text-gray-600 hover:text-primary">Contact</a>
            <div className="px-3 py-2 space-y-2">
              {currentUser ? (
                <>
                  <div className="flex items-center px-3 py-2 text-sm text-gray-700">
                    <UserIcon className="h-4 w-4 mr-2 text-primary" />
                    {currentUser.fullName || currentUser.email}
                  </div>
                  <Button variant="outline" className="w-full" onClick={onLogout}>
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
