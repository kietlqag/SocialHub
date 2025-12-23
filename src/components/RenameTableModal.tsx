import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { Input } from "./ui/input";
import { Button } from "./ui/button";

export type RenameTableModalProps = {
  open: boolean;
  currentName: string;
  existingNames: string[];
  onClose: () => void;
  onSubmit: (name: string) => Promise<void>;
};

const normalizeName = (value: string) => value.trim();

export function RenameTableModal({ open, currentName, existingNames, onClose, onSubmit }: RenameTableModalProps) {
  const [name, setName] = useState<string>(currentName);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const normalizedExisting = useMemo(() => {
    const current = normalizeName(currentName).toLowerCase();
    return new Set(
      existingNames
        .map((entry) => normalizeName(entry).toLowerCase())
        .filter((entry) => entry && entry !== current),
    );
  }, [existingNames, currentName]);

  useEffect(() => {
    if (open) {
      setName(currentName);
      setError(null);
      setSubmitting(false);
    }
  }, [open, currentName]);

  if (!open) return null;

  const handleSubmit = async () => {
    const nextName = normalizeName(name);
    if (!nextName) {
      setError("Table name is required");
      return;
    }
    if (normalizedExisting.has(nextName.toLowerCase())) {
      setError("A table with this name already exists");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit(nextName);
      onClose();
    } catch (err: any) {
      const message = err?.message || "Failed to rename table";
      setError(message);
      setSubmitting(false);
    }
  };

  return (
    <div className="mdModalOverlay" onClick={(event) => event.target === event.currentTarget && !submitting && onClose()}>
      <div className="mdModal smallModal" role="dialog" aria-modal="true">
        <div className="mdModalHeader">
          <div>
            <p className="mdMainSubtitle">Rename table</p>
            <h3 className="mdModalTitle">Update display name</h3>
          </div>
          <button className="mdGhostBtn" onClick={onClose} aria-label="Close" disabled={submitting}>
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="mdModalBody">
          <div className="mdFormGroup">
            <label className="mdFormLabel">Display name</label>
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Sales pipeline"
              disabled={submitting}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  handleSubmit();
                }
              }}
            />
          </div>
          {error ? <div className="mdInputError mt-2">{error}</div> : null}
        </div>
        <div className="mdModalFooter">
          <Button variant="outline" className="mdGhostBtn" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button className="primaryBtn" onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}
