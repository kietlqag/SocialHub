import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [coords, setCoords] = useState<{ top: number; right: number }>({ top: 0, right: 0 });
  const selfId = useRef(`dropdown-${Math.random().toString(36).slice(2, 8)}`);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  useEffect(() => {
    const handleCloseOthers = (event: Event) => {
      const detailId = (event as CustomEvent)?.detail;
      if (detailId !== selfId.current) setOpen(false);
    };
    window.addEventListener("close-all-dropdowns", handleCloseOthers as EventListener);
    return () => window.removeEventListener("close-all-dropdowns", handleCloseOthers as EventListener);
  }, []);

  useEffect(() => {
    const update = () => {
      if (!triggerRef.current) return;
      const rect = triggerRef.current.getBoundingClientRect();
      const top = rect.bottom + 12 + window.scrollY;
      const right = Math.max(4, window.innerWidth + window.scrollX - rect.right);
      setCoords({ top, right });
    };
    if (open) {
      update();
      window.addEventListener("scroll", update, true);
      window.addEventListener("resize", update);
    }
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open]);

  const renderDropdown = () => {
    if (!open) return null;
    const panel = (
      <div
        className="dropdownPanel dropdownProfile profileDropdown"
        style={{ top: coords.top, right: coords.right, left: "auto", position: "absolute", zIndex: 9999 }}
        ref={ref}
      >
        <button
          className="dropdownItem"
          onClick={() => {
            setOpen(false);
            onProfile?.();
          }}
        >
          <User className="w-4 h-4" />
          <span>Profile</span>
        </button>

        <button
          className="dropdownItem"
          onClick={() => {
            setOpen(false);
            onSettings?.();
          }}
        >
          <Settings className="w-4 h-4" />
          <span>Settings</span>
        </button>

        <div className="dropdownDivider" />

        <button
          className="dropdownItem dangerItem text-red-600"
          onClick={() => {
            setOpen(false);
            onSignOut?.();
          }}
        >
          <LogOut className="w-4 h-4" />
          <span>Sign out</span>
        </button>
      </div>
    );
    return createPortal(panel, document.body);
  };

  return (
    <div className="dropdownRoot">
      <Button
        ref={triggerRef}
        variant="ghost"
        className="flex items-center gap-2 px-2 py-1"
        onClick={() => {
          const next = !open;
          setOpen(next);
          if (next) window.dispatchEvent(new CustomEvent("close-all-dropdowns", { detail: selfId.current }));
        }}
      >
        <Avatar className="w-7 h-7">
          {avatarUrl ? <AvatarImage src={avatarUrl} /> : <AvatarFallback>{(userName || "?").slice(0, 1)}</AvatarFallback>}
        </Avatar>
        <span className="inline-block text-sm text-gray-700 max-w-[9rem] truncate" title={userName || "Account"}>
          {userName || "Account"}
        </span>
      </Button>
      {renderDropdown()}
    </div>
  );
}
