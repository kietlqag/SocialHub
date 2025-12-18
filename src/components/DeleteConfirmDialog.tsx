import { Button } from "./ui/button";

type DeleteConfirmDialogProps = {
  open: boolean;
  record: any;
  onClose: () => void;
  onConfirm: () => void;
};

export function DeleteConfirmDialog({ open, onClose, onConfirm }: DeleteConfirmDialogProps) {
  if (!open) return null;
  return (
    <div className="mdModalOverlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="mdModal deleteModal" role="dialog" aria-modal="true">
        <div className="mdModalHeader">
          <div>
            <p className="mdMainSubtitle">Delete record</p>
            <h3 className="mdModalTitle">Delete this record?</h3>
            <p className="mdMainSubtitle">Are you sure you want to delete this record? This action cannot be undone.</p>
          </div>
        </div>
        <div className="mdModalFooter">
          <Button variant="outline" className="mdGhostBtn" onClick={onClose}>
            Cancel
          </Button>
          <Button className="primaryBtn danger" onClick={onConfirm}>
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
}
