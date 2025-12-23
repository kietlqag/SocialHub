import { useMemo } from "react";
import { Copy, Link2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";
import { AccessControlTab } from "./AccessControlTab";

export type ShareDashboardDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dashboardId: string;
  dashboardName?: string | null;
  sharePath: string;
  ownerId?: string | null;
  currentUserId?: string | null;
  sessionId?: string;
};

const buildShareUrl = (path: string) => {
  if (typeof window === "undefined") return path;
  try {
    return new URL(path, window.location.origin).toString();
  } catch {
    return path;
  }
};

export function ShareDashboardDialog({
  open,
  onOpenChange,
  dashboardId,
  dashboardName,
  sharePath,
  ownerId,
  currentUserId,
  sessionId,
}: ShareDashboardDialogProps) {
  const shareUrl = useMemo(() => buildShareUrl(sharePath), [sharePath]);
  const isOwner = Boolean(ownerId && currentUserId && String(ownerId) === String(currentUserId));

  const handleCopy = async () => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        const input = document.createElement("input");
        input.value = shareUrl;
        document.body.appendChild(input);
        input.select();
        document.execCommand("copy");
        document.body.removeChild(input);
      }
      toast.success("Copied");
    } catch (err) {
      toast.error("Failed to copy");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl p-0 overflow-hidden">
        <div className="max-h-[85vh] overflow-y-auto p-6 space-y-6">
          <DialogHeader>
            <DialogTitle>Share dashboard</DialogTitle>
            <DialogDescription>
              {dashboardName ? `Share the dashboard link for ${dashboardName}.` : "Share the dashboard link."}
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <Link2 className="h-4 w-4" />
              Dashboard link
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex-1 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 break-all">
                {shareUrl}
              </div>
              <Button type="button" variant="outline" onClick={handleCopy} className="gap-2">
                <Copy className="h-4 w-4" />
                Copy
              </Button>
            </div>
            <p className="text-xs text-slate-500">Recipients must sign in before viewing the dashboard.</p>
          </div>

          {isOwner && (
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <AccessControlTab
                dashboardId={dashboardId}
                sessionId={sessionId}
                userId={currentUserId || undefined}
                variant="compact"
              />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default ShareDashboardDialog;
