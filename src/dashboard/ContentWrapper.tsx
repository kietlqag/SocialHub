import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Search, Download, Upload, Plus } from "lucide-react";

type ContentWrapperProps = {
  title: string;
  subtitle?: string;
  onCopyLayout?: () => void;
  onExport?: () => void;
  onImport?: () => void;
  onAddRecord?: () => void;
  searchPlaceholder?: string;
  actionsDisabled?: boolean;
  showActions?: boolean;
  showSearch?: boolean;
  children: React.ReactNode;
};

export function ContentWrapper({
  title,
  subtitle,
  onCopyLayout,
  onExport,
  onImport,
  onAddRecord,
  searchPlaceholder = "Search dashboards, tables, data...",
  actionsDisabled,
  showActions = true,
  showSearch = true,
  children,
}: ContentWrapperProps) {
  return (
    <div className="flex-1 px-6 py-6 space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>{/* header intentionally hidden */}</div>
        {showActions && (
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" onClick={onCopyLayout} disabled={actionsDisabled}>
              Copy layout code
            </Button>
            <Button variant="outline" className="gap-2" onClick={onExport} disabled={actionsDisabled}>
              <Download className="w-4 h-4" /> Export layout
            </Button>
            <Button variant="outline" className="gap-2" onClick={onImport} disabled={actionsDisabled}>
              <Upload className="w-4 h-4" /> Import data
            </Button>
            <Button className="gap-2" onClick={onAddRecord} disabled={actionsDisabled}>
              <Plus className="w-4 h-4" /> Add record
            </Button>
          </div>
        )}
      </div>

      {showSearch && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input placeholder={searchPlaceholder} className="pl-10 bg-white" />
        </div>
      )}

      <div className="space-y-4">{children}</div>
    </div>
  );
}
