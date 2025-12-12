import { cn } from "../components/ui/utils";
import type { LucideIcon } from "lucide-react";

type SidebarItemProps = {
  label: string;
  id: string;
  icon: LucideIcon;
  active?: boolean;
  count?: number;
  onClick: (id: string) => void;
};

export function SidebarItem({ label, id, icon: Icon, active, count, onClick }: SidebarItemProps) {
  return (
    <button
      type="button"
      onClick={() => onClick(id)}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition",
        active ? "bg-white text-gray-900 shadow-sm" : "text-gray-700 hover:bg-white/70"
      )}
    >
      <Icon className="w-4 h-4 text-gray-500" />
      <span className="flex-1 text-left">{label}</span>
      {typeof count === "number" && (
        <span className="text-xs text-gray-500">{count}</span>
      )}
    </button>
  );
}
