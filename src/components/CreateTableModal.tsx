import { useEffect, useMemo, useState } from "react";
import { X, Trash2, Plus } from "lucide-react";
import { dashboardApi, type DashboardTable, type TableDefinition, type NewFieldDefinition } from "../services/dashboards";
import { Input } from "./ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Button } from "./ui/button";

type FieldType = NewFieldDefinition["type"];

type CreateTableModalProps = {
  isOpen: boolean;
  onClose: () => void;
  dashboardId: string;
  existingTables: DashboardTable[];
  sessionId?: string;
  userId?: string | null;
  onCreated: (table: TableDefinition) => void;
};

const slugify = (text: string) =>
  text
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const RESERVED_KEYS = new Set(["id", "_id", "created_at", "updated_at"]);

export const CreateTableModal = ({ isOpen, onClose, dashboardId, existingTables, sessionId, userId, onCreated }: CreateTableModalProps) => {
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [description, setDescription] = useState("");
  const [fields, setFields] = useState<NewFieldDefinition[]>([
    { key: "name", label: "Name", type: "string", required: true },
  ]);
  const [errors, setErrors] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setName("");
      setKey("");
      setDescription("");
      setFields([{ key: "name", label: "Name", type: "string", required: true }]);
      setErrors(null);
      setSubmitting(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!key && name) {
      setKey(slugify(name));
    }
  }, [name, key]);

  const existingKeys = useMemo(
    () => new Set(existingTables.map((t) => (t.key || t.id || "").toLowerCase()).filter(Boolean)),
    [existingTables],
  );

  const handleFieldChange = (index: number, updater: (prev: NewFieldDefinition) => NewFieldDefinition) => {
    setFields((prev) => prev.map((f, i) => (i === index ? updater(f) : f)));
  };

  const addField = () => {
    setFields((prev) => [...prev, { key: "", label: "", type: "string", required: false }]);
  };

  const removeField = (idx: number) => {
    setFields((prev) => prev.filter((_, i) => i !== idx));
  };

  const validate = () => {
    if (!name.trim()) return "Table name is required";
    if (!key.trim()) return "Table key is required";
    const slug = slugify(key);
    if (!slug) return "Invalid table key";
    if (RESERVED_KEYS.has(slug)) return "Table key is reserved";
    if (existingKeys.has(slug)) return "Table key already exists";
    if (!fields.length) return "At least one field is required";
    const seen = new Set<string>();
    for (const field of fields) {
      const fKey = slugify(field.key || field.label);
      if (!field.label?.trim()) return "Field label is required";
      if (!fKey) return "Invalid field key";
      if (RESERVED_KEYS.has(fKey)) return `Field key "${fKey}" is reserved`;
      if (seen.has(fKey)) return `Duplicate field key "${fKey}"`;
      seen.add(fKey);
    }
    return null;
  };

  const handleSubmit = async () => {
    const err = validate();
    if (err) {
      setErrors(err);
      return;
    }
    setErrors(null);
    setSubmitting(true);
    const payload: TableDefinition = {
      key: slugify(key || name),
      name: name.trim(),
      description: description.trim() || undefined,
      fields: fields.map((f) => {
        const fKey = slugify(f.key || f.label);
        return {
          ...f,
          key: fKey,
          label: f.label.trim(),
          isReference: f.type === "reference" ? true : f.isReference,
          referenceTableKey: f.type === "reference" ? f.referenceTableKey || null : null,
        };
      }),
    };
    try {
      const res = await dashboardApi.createDashboardTable(dashboardId, payload, { sessionId, userId });
      onCreated((res as any)?.table || payload);
      onClose();
    } catch (e) {
      const message = (e as any)?.response?.data?.message || (e as any)?.message || "Failed to create table";
      setErrors(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="mdModalOverlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="mdModal" role="dialog" aria-modal="true">
        <div className="mdModalHeader">
          <div>
            <p className="mdMainSubtitle">Add new table</p>
            <h3 className="mdModalTitle">Define fields and relationships</h3>
          </div>
          <button className="mdGhostBtn" onClick={onClose} aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mdModalBody">
          {errors && <div className="mdInputError mb-3">{errors}</div>}
          <div className="mdFormGroup">
            <label className="mdFormLabel">Table name *</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Customers" />
          </div>
          <div className="mdFormGroup">
            <label className="mdFormLabel">Table key / API key *</label>
            <Input value={key} onChange={(e) => setKey(e.target.value)} placeholder="customers" />
          </div>
          <div className="mdFormGroup">
            <label className="mdFormLabel">Description</label>
            <textarea
              className="mdTextArea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what this table stores"
            />
          </div>

          <div className="schemaSubHeader">
            <div>
              <p className="mdMainSubtitle">Fields</p>
            </div>
            <Button variant="outline" className="mdGhostBtn" onClick={addField}>
              <Plus className="w-4 h-4 mr-1" /> Add field
            </Button>
          </div>

          <div className="fieldBuilder">
            {fields.map((field, idx) => (
              <div key={idx} className="fieldRow fancyFieldRow">
                <button className="mdIconButton fieldDeleteBtn" onClick={() => removeField(idx)} aria-label="Remove field">
                  <Trash2 className="w-4 h-4" />
                </button>
                <div className="fieldRowTop">
                  <div className="fieldCol">
                    <label className="mdFormLabel">Label</label>
                    <Input
                      value={field.label}
                      onChange={(e) =>
                        handleFieldChange(idx, (prev) => ({
                          ...prev,
                          label: e.target.value,
                          key: prev.key || slugify(e.target.value),
                        }))
                      }
                      placeholder="Full name"
                    />
                  </div>
                  <div className="fieldCol">
                    <label className="mdFormLabel">Key</label>
                    <Input
                      value={field.key}
                      onChange={(e) => handleFieldChange(idx, (prev) => ({ ...prev, key: e.target.value }))}
                      placeholder="full_name"
                    />
                  </div>
                  <div className="fieldCol">
                    <label className="mdFormLabel">Type</label>
                    <Select
                      value={field.type}
                      onValueChange={(val) =>
                        handleFieldChange(idx, (prev) => ({
                          ...prev,
                          type: val as FieldType,
                          isReference: val === "reference" ? true : prev.isReference,
                          referenceTableKey: val === "reference" ? prev.referenceTableKey || existingTables[0]?.key || null : null,
                          enumOptions: val === "enum" ? prev.enumOptions || [] : undefined,
                        }))
                      }
                    >
                      <SelectTrigger className="mdSelect">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="mdSelectContent">
                        {["string", "number", "boolean", "date", "enum", "reference"].map((opt) => (
                          <SelectItem key={opt} value={opt}>
                            {opt}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="fieldCol inline">
                    <label className="mdFormLabel">Required</label>
                    <input
                      type="checkbox"
                      checked={field.required}
                      onChange={(e) => handleFieldChange(idx, (prev) => ({ ...prev, required: e.target.checked }))}
                    />
                  </div>
                </div>

                {field.type === "enum" && (
                  <div className="fieldCol">
                    <label className="mdFormLabel">Enum options (comma separated)</label>
                    <Input
                      value={(field.enumOptions || []).join(", ")}
                      onChange={(e) =>
                        handleFieldChange(idx, (prev) => ({
                          ...prev,
                          enumOptions: e.target.value
                            .split(",")
                            .map((v) => v.trim())
                            .filter(Boolean),
                        }))
                      }
                      placeholder="pending, completed, cancelled"
                    />
                  </div>
                )}
                {field.type === "reference" && (
                  <div className="fieldCol">
                    <label className="mdFormLabel">Reference table</label>
                    <Select
                      value={field.referenceTableKey || ""}
                      onValueChange={(val) => handleFieldChange(idx, (prev) => ({ ...prev, referenceTableKey: val || null }))}
                    >
                      <SelectTrigger className="mdSelect">
                        <SelectValue placeholder="Select table" />
                      </SelectTrigger>
                      <SelectContent className="mdSelectContent">
                        {existingTables.map((t) => (
                          <SelectItem key={t.key || t.id || ""} value={t.key || t.id || ""}>
                            {t.name || t.key || t.id}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="mdModalFooter">
          <Button variant="outline" className="mdGhostBtn" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button className="primaryBtn" onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Saving..." : "Create table"}
          </Button>
        </div>
      </div>
    </div>
  );
};
