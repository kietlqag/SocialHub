import type { LucideIcon } from "lucide-react";
import { SidebarItem } from "./SidebarItem";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "../components/ui/utils";

type SidebarItemConfig = {
  id: string;
  label: string;
  icon: LucideIcon;
  count?: number;
};

type SidebarProps = {
  items: SidebarItemConfig[];
  activeId: string;
  onSelect: (id: string) => void;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  tableDropdown?: {
    label: string;
    icon: LucideIcon;
    count?: number;
    open: boolean;
    onToggle: () => void;
    content: React.ReactNode;
  };
};

export function Sidebar({ items, activeId, onSelect, header, footer, tableDropdown }: SidebarProps) {
  return (
    <aside className="w-60 min-w-[240px] bg-[#F8F9FB] border-r border-gray-200 px-4 py-6 flex flex-col gap-4">
      {header && <div className="px-2">{header}</div>}
      <nav className="flex flex-col gap-1 flex-1">
        {items.map((item) => (
          <SidebarItem key={item.id} {...item} active={item.id === activeId} onClick={onSelect} />
        ))}
        {tableDropdown && (
          <div className="relative mt-1">
            <button
              type="button"
              onClick={tableDropdown.onToggle}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition",
                tableDropdown.open ? "bg-white text-gray-900 shadow-sm" : "text-gray-700 hover:bg-white/70"
              )}
            >
              <tableDropdown.icon className="w-4 h-4 text-gray-500" />
              <span className="flex-1 text-left">{tableDropdown.label}</span>
              {typeof tableDropdown.count === "number" && <span className="text-xs text-gray-500">{tableDropdown.count}</span>}
              {tableDropdown.open ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
            </button>
            {tableDropdown.open && (
              <div className="absolute left-0 right-0 mt-1 bg-white rounded-xl shadow-lg border border-gray-200 z-20">
                {tableDropdown.content}
              </div>
            )}
          </div>
        )}
      </nav>
      {footer && <div className="px-2 mt-auto">{footer}</div>}
    </aside>
  );
}
