import { Button } from "./ui/button";

type DeleteConfirmDialogProps = {
  open: boolean;
  record: any;
  references?: { tableKey: string; fieldKey: string; count: number }[];
  checking?: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export function DeleteConfirmDialog({ open, onClose, onConfirm, references = [], checking }: DeleteConfirmDialogProps) {
  if (!open) return null;
  const hasReferences = Array.isArray(references) && references.length > 0;
  return (
    <div className="mdModalOverlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="mdModal deleteModal" role="dialog" aria-modal="true">
        <div className="mdModalHeader">
          <div>
            <p className="mdMainSubtitle">Delete record</p>
            <h3 className="mdModalTitle">Delete this record?</h3>
            <p className="mdMainSubtitle">
              {hasReferences
                ? "Cannot delete because this record is referenced. Remove references from other tables first."
                : "Are you sure you want to delete this record? This action cannot be undone."}
            </p>
            {checking ? <p className="text-sm text-muted-foreground">Checking references...</p> : null}
            {hasReferences ? (
              <div className="mt-3 text-sm bg-amber-50 text-amber-800 border border-amber-200 rounded-lg p-3">
                <div className="font-semibold mb-2">Referenced by:</div>
                <ul className="list-disc list-inside space-y-1">
                  {references.map((ref) => (
                    <li key={`${ref.tableKey}-${ref.fieldKey}`}>
                      <span className="font-medium">{ref.tableKey}</span> · <span>{ref.fieldKey}</span>{" "}
                      <span className="text-xs text-muted-foreground">({ref.count} record{ref.count === 1 ? "" : "s"})</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </div>
        <div className="mdModalFooter">
          <Button variant="outline" className="mdGhostBtn" onClick={onClose}>
            Cancel
          </Button>
          <Button className="primaryBtn danger" onClick={onConfirm} disabled={hasReferences || checking}>
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
}
