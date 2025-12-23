import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";

export type UseTemplateDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (openAfter: boolean) => void;
  loading?: boolean;
};

export function UseTemplateDialog({ open, onOpenChange, onConfirm, loading = false }: UseTemplateDialogProps) {
  const [openAfter, setOpenAfter] = useState(true);

  useEffect(() => {
    if (open) setOpenAfter(true);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md sm:max-w-md rounded-2xl p-6 gap-5 shadow-xl">
        <DialogHeader className="gap-2">
          <DialogTitle className="text-xl tracking-tight">Use this template?</DialogTitle>
          <DialogDescription className="text-sm text-slate-500">
            This will create a new dashboard with the same schema but without any data.
          </DialogDescription>
        </DialogHeader>

        <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-3 text-sm text-slate-700">
          <Checkbox
            checked={openAfter}
            onCheckedChange={(checked) => setOpenAfter(Boolean(checked))}
            className="mt-0.5"
          />
          <span>Open new dashboard after creation</span>
        </label>

        <DialogFooter className="justify-end sm:justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={() => onConfirm(openAfter)} disabled={loading}>
            {loading ? "Creating..." : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default UseTemplateDialog;
