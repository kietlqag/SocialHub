import { useEffect, useRef, useState } from "react";
import { Button } from "./ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { User, Settings, LogOut } from "lucide-react";

export default function UserMenu({
  userName,
  avatarUrl,
  onProfile,
  onSettings,
  onSignOut,
}: {
  userName?: string;
  avatarUrl?: string | null;
  onProfile?: () => void;
  onSettings?: () => void;
  onSignOut?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      {/* Use a normal ghost button (not `size="icon"`) so the username can appear beside the avatar */}
      <Button variant="ghost" className="flex items-center gap-2 px-2 py-1" onClick={() => setOpen((v) => !v)}>
        <Avatar className="w-7 h-7">
          {avatarUrl ? <AvatarImage src={avatarUrl} /> : <AvatarFallback>{(userName || "?").slice(0, 1)}</AvatarFallback>}
        </Avatar>
        {/* Always show a short, truncated label next to avatar so user sees who is signed in */}
        <span className="inline-block text-sm text-gray-700 max-w-[9rem] truncate" title={userName || "Account"}>{userName || "Account"}</span>
      </Button>

      {open && (
        <div className="absolute right-0 top-12 w-44 max-w-[12rem] bg-white rounded-lg shadow-lg border border-gray-200 z-50 py-2 overflow-hidden">
          <button
            className="flex items-center gap-2 px-3 py-2 w-full text-left hover:bg-gray-100"
            onClick={() => {
              setOpen(false);
              onProfile?.();
            }}
          >
            <User className="w-4 h-4 text-gray-600" />
            <span className="text-sm text-gray-700">Profile</span>
          </button>

          <button
            className="flex items-center gap-2 px-3 py-2 w-full text-left hover:bg-gray-100"
            onClick={() => {
              setOpen(false);
              onSettings?.();
            }}
          >
            <Settings className="w-4 h-4 text-gray-600" />
            <span className="text-sm text-gray-700">Settings</span>
          </button>

          <div className="border-t border-gray-100 mt-2" />

          <button
            className="flex items-center gap-2 px-3 py-2 w-full text-left hover:bg-gray-100 text-red-600"
            onClick={() => {
              setOpen(false);
              onSignOut?.();
            }}
          >
            <LogOut className="w-4 h-4" />
            <span className="text-sm">Sign out</span>
          </button>
        </div>
      )}
    </div>
  );
}
