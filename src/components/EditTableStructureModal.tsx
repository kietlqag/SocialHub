import { useEffect, useMemo, useState } from "react";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { dashboardApi, type DashboardField, type DashboardTable } from "../services/dashboards";
import { SYSTEM_FIELDS, isSystemField } from "../../shared/systemFields";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

type EditTableStructureModalProps = {
  open: boolean;
  dashboardId: string;
  tableKey: string;
  tables: DashboardTable[];
  sessionId?: string;
  userId?: string | null;
  onClose: () => void;
  onSaved?: (fields: DashboardField[]) => void;
};

type EditableField = DashboardField & {
  tempId: string;
  previousKey?: string;
  isSystem?: boolean;
  visible?: boolean;
  allowEditReference?: boolean;
};

const FIELD_TYPES: Array<DashboardField["type"]> = ["string", "number", "boolean", "date", "enum", "reference"];
const RESERVED_KEYS = new Set(["_id", "created_at", "updated_at", ...SYSTEM_FIELDS]);
const SYSTEM_KEYS = new Set(["id", "_id", "created_at", "updated_at"]);

const makeTempId = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2));

const normalizeKey = (value: string) =>
  value
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9_]/g, "")
    .replace(/_{2,}/g, "_")
    .trim();

const looksLikeLegacyReference = (field: Partial<DashboardField>) => {
  if (!field) return false;
  const keyValue = (field.key || (field as any).fieldKey || "").toString().trim().toLowerCase();
  if (!keyValue) return false;
  if (SYSTEM_KEYS.has(keyValue)) return false;
  if (keyValue === "id") return false;
  if (keyValue.endsWith("_id")) return true;
  return false;
};

const isReferenceLike = (field: Partial<DashboardField>) => {
  if (!field) return false;
  const rawType = (field.type || (field as any).dataType) as string | undefined;
  const normalizedType = rawType ? rawType.toLowerCase() : undefined;
  if (normalizedType === "reference") return true;
  if (field.referenceTable || field.displayField) return true;
  const relationType = (field as any).relationType as string | undefined;
  if (relationType && relationType.toLowerCase() === "reference") return true;
  if ((field as any).allowEditReference === true) return true;
  if (looksLikeLegacyReference(field)) return true;
  return false;
};

const normalizeFieldVisibility = (field: DashboardField): EditableField => {
  const key = String(field.key || field.fieldName || field.name || "");
  const isSystem = field.system === true || field.systemField === true || SYSTEM_KEYS.has(key);
  const rawVisibleInTable = (field as any).visibleInTable;
  const rawHidden = (field as any).hidden;
  let visible: boolean;
  if (rawVisibleInTable !== undefined || rawHidden !== undefined) {
    if (rawHidden === true) visible = false;
    else if (rawVisibleInTable === false) visible = false;
    else visible = true;
  } else {
    visible = isSystem ? false : true;
  }
  const referenceLike = isReferenceLike(field);
  const allowEditReferenceRaw = (field as any).allowEditReference;
  const allowEditReference = referenceLike || allowEditReferenceRaw !== undefined ? Boolean(allowEditReferenceRaw) : undefined;
  return {
    ...field,
    visible,
    visibleInTable: visible,
    hidden: !visible,
    tempId: (field as any).tempId || (field as any).id || makeTempId(),
    previousKey: (field as any).previousKey || field.key,
    isSystem,
    ...(allowEditReference !== undefined ? { allowEditReference } : {}),
  };
};

const detectReferenceField = (field: Partial<EditableField>) => {
  if (!field) return false;
  if (isReferenceLike(field)) return true;
  if ((field as any).allowEditReference !== undefined) return true;
  return false;
};

export function EditTableStructureModal({
  open,
  dashboardId,
  tableKey,
  tables,
  sessionId,
  userId,
  onClose,
  onSaved,
}: EditTableStructureModalProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<EditableField[]>([]);
  const [systemFields, setSystemFields] = useState<EditableField[]>([]);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !dashboardId || !tableKey) return;
    setLoading(true);
    dashboardApi
      .getTableSchema(dashboardId, tableKey, { sessionId, userId })
      .then((res) => {
        const incoming = Array.isArray(res.fields) ? res.fields : [];
        const system = incoming
          .filter((f) => isSystemField(f))
          .map((f) => normalizeFieldVisibility({ ...f, required: true }));
        const editable = incoming
          .filter((f) => !isSystemField(f))
          .map((f) => normalizeFieldVisibility(f as DashboardField));
        setSystemFields(system);
        setFields(editable);
        setError(null);
      })
      .catch((err: any) => {
        const message = err?.message || "Failed to load table schema";
        setError(message);
        toast.error(message);
      })
      .finally(() => setLoading(false));
  }, [open, dashboardId, tableKey, sessionId, userId]);

  const referenceTargets = useMemo(
    () => tables.filter((t) => (t.key || t.id) && (t.key || t.id) !== tableKey),
    [tables, tableKey],
  );

  const getReferenceFields = (targetKey?: string) => {
    if (!targetKey) return [];
    const target = tables.find((t) => (t.key || t.id) === targetKey);
    return (target?.fields || []).filter((f) => !isSystemField(f));
  };

  const addField = () => {
    const baseKey = `field_${fields.length + 1}`;
    const existingKeys = new Set(fields.map((f) => f.key.toLowerCase()));
    let candidate = baseKey;
    let counter = 1;
    while (existingKeys.has(candidate.toLowerCase())) {
      candidate = `${baseKey}_${counter++}`;
    }
    const next: EditableField = {
      tempId: makeTempId(),
      key: candidate,
      label: "",
      type: "string",
      required: false,
      visible: true,
      visibleInTable: true,
      hidden: false,
      previousKey: "",
    };
    setFields((prev) => [...prev, next]);
  };

  const updateField = (tempId: string, patch: Partial<EditableField>) => {
    setFields((prev) =>
      prev.map((field) => {
        if (field.tempId !== tempId) return field;
        const next = { ...field, ...patch } as EditableField;
        if (patch.visible !== undefined) {
          next.visibleInTable = patch.visible;
          next.hidden = !patch.visible;
        }
        return next;
      }),
    );
  };

  const updateSystemField = (tempId: string, patch: Partial<EditableField>) => {
    setSystemFields((prev) =>
      prev.map((field) =>
        field.tempId === tempId
          ? {
              ...field,
              ...patch,
              required: true,
              visibleInTable: patch.visible !== undefined ? patch.visible : field.visibleInTable,
              hidden: patch.visible !== undefined ? !patch.visible : field.hidden,
            }
          : field,
      ),
    );
  };

  const handleToggleAllowEditReference = (field: EditableField, checked: boolean) => {
    if (field.isSystem) {
      updateSystemField(field.tempId, { allowEditReference: checked });
      return;
    }
    updateField(field.tempId, { allowEditReference: checked });
  };

  const removeField = (tempId: string) => {
    const target = fields.find((f) => f.tempId === tempId);
    const ok = window.confirm(`Remove column "${target?.label || target?.key || ""}"?`);
    if (!ok) return;
    setFields((prev) => prev.filter((f) => f.tempId !== tempId));
  };

  const handleDragStart = (tempId: string) => setDraggingId(tempId);
  const handleDragEnd = () => setDraggingId(null);
  const handleDrop = (targetId: string) => {
    if (!draggingId || draggingId === targetId) return;
    const fromIndex = fields.findIndex((f) => f.tempId === draggingId);
    const toIndex = fields.findIndex((f) => f.tempId === targetId);
    if (fromIndex === -1 || toIndex === -1) return;
    const next = [...fields];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    setFields(next);
    setDraggingId(null);
  };

  const validate = () => {
    const seen = new Set<string>();
    for (const field of fields) {
      const key = normalizeKey(field.key || "");
      const lowered = key.toLowerCase();
      if (!key) return "Field key is required";
      if (RESERVED_KEYS.has(lowered)) return `${key} is reserved for system use`;
      if (seen.has(lowered)) return "Duplicate field keys are not allowed";
      seen.add(lowered);
      if (!field.type) return `Field ${key} is missing a type`;
      if (field.type === "enum") {
        const options = (field.options || []).filter(Boolean);
        if (!options.length) return `Enum field "${key}" needs at least one option`;
      }
      if (field.type === "reference") {
        if (!field.referenceTable || !field.displayField) return `Reference field "${key}" needs table and display field`;
      }
    }
    return null;
  };

  const handleSave = async () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      toast.error(validationError);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payloadFields = [...systemFields, ...fields].map((f) => {
        const { tempId, isSystem, previousKey, ...rest } = f;
        const visible = rest.visible ?? rest.visibleInTable ?? !rest.hidden ?? true;
        return {
          ...rest,
          label: rest.label || rest.key,
          required: isSystem ? true : !!rest.required,
          visible,
          visibleInTable: visible,
          hidden: !visible,
        };
      });
      const res = await dashboardApi.updateTableSchema(
        dashboardId,
        tableKey,
        { fields: payloadFields },
        { sessionId, userId },
      );
      const incoming = Array.isArray(res.fields) ? res.fields : [];
      setSystemFields(
        incoming
          .filter((f) => isSystemField(f))
          .map((f) => normalizeFieldVisibility({ ...f, required: true })),
      );
      setFields(
        incoming
          .filter((f) => !isSystemField(f))
          .map((f) => normalizeFieldVisibility(f as DashboardField)),
      );
      onSaved?.(incoming);
      toast.success("Table structure updated");
      onClose();
    } catch (err: any) {
      const message = err?.message || "Failed to save table schema";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="mdModalOverlay">
      <div className="mdModal schemaModal">
        <div className="mdModalHeader">
          <div>
            <p className="mdMainSubtitle">Customize fields for {tableKey}</p>
            <h3 className="mdModalTitle">Edit table structure</h3>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="mdGhostBtn" onClick={onClose}>
              Cancel
            </Button>
            <Button className="primaryBtn" onClick={handleSave} disabled={saving || loading}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>

        <div className="mdModalBody">
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading schema...</div>
          ) : (
            <div className="schemaList">
              {systemFields.map((field) => {
                const refFields = getReferenceFields(field.referenceTable);
                const isReferenceField = detectReferenceField(field);
                const showReferenceConfig = field.type === "reference";
                return (
                  <div key={field.tempId} className="schemaRow systemRow">
                    <div className="schemaDragHandle" title="System field">
                      <GripVertical className="w-4 h-4 opacity-50" />
                    </div>
                    <div className="schemaGrid">
                      <div className="mdField">
                        <label className="mdLabel">Field key</label>
                        <Input value={field.key} disabled />
                      </div>
                      <div className="mdField">
                        <label className="mdLabel">Label</label>
                        <Input
                          value={field.label || ""}
                          onChange={(e) => updateSystemField(field.tempId, { label: e.target.value })}
                          placeholder="Label"
                        />
                      </div>
                      <div className="mdField">
                        <label className="mdLabel">Type</label>
                        <Select value={field.type} disabled>
                          <SelectTrigger className="mdSelect">
                            <SelectValue />
                          </SelectTrigger>
                        </Select>
                      </div>
                      <div className="mdField schemaToggles">
                        <label className="mdLabel">Options</label>
                        <div className="schemaToggleGroup">
                          <label className="mdCheckbox">
                            <input type="checkbox" checked readOnly />
                            <span>Required</span>
                          </label>
                          <label className="mdCheckbox">
                            <input
                              type="checkbox"
                              checked={field.visible !== false}
                              onChange={() =>
                                updateSystemField(field.tempId, {
                                  visible: !field.visible,
                                  visibleInTable: !field.visible,
                                  hidden: field.visible,
                                })
                              }
                            />
                            <span>Visible</span>
                          </label>
                          {isReferenceField && (
                            <label className="mdCheckbox">
                              <input
                                type="checkbox"
                                checked={!!field.allowEditReference}
                                onChange={(e) => handleToggleAllowEditReference(field, e.target.checked)}
                              />
                              <span>Allow editing reference</span>
                            </label>
                          )}
                        </div>
                      </div>
                    </div>

                    {isReferenceField && showReferenceConfig && (
                      <div className="schemaSubSection">
                        <div className="schemaSubHeader">
                          <p className="mdMainSubtitle">Reference settings</p>
                        </div>
                        <div className="schemaGrid">
                          <div className="mdField">
                            <label className="mdLabel">Reference table</label>
                            <Select
                              value={field.referenceTable || ""}
                              onValueChange={(v) => updateSystemField(field.tempId, { referenceTable: v, displayField: "" })}
                            >
                              <SelectTrigger className="mdSelect">
                                <SelectValue placeholder="Select table" />
                              </SelectTrigger>
                              <SelectContent className="mdSelectContent" position="popper">
                                {referenceTargets.map((table) => (
                                  <SelectItem key={table.key || table.id} value={table.key || table.id || ""}>
                                    {table.name || table.key}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="mdField">
                            <label className="mdLabel">Display field</label>
                            <Select
                              value={field.displayField || ""}
                              onValueChange={(v) => updateSystemField(field.tempId, { displayField: v })}
                              disabled={!field.referenceTable}
                            >
                              <SelectTrigger className="mdSelect">
                                <SelectValue placeholder="Choose field" />
                              </SelectTrigger>
                              <SelectContent className="mdSelectContent" position="popper">
                                {refFields.map((refField) => (
                                  <SelectItem key={refField.key} value={refField.key}>
                                    {refField.label || refField.key}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              {fields.map((field) => {
                const refFields = getReferenceFields(field.referenceTable);
                const isReferenceField = detectReferenceField(field);
                const showReferenceConfig = field.type === "reference";
                return (
                  <div
                    key={field.tempId}
                    className={`schemaRow ${draggingId === field.tempId ? "dragging" : ""}`}
                    draggable
                    onDragStart={() => handleDragStart(field.tempId)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => handleDrop(field.tempId)}
                    onDragEnd={handleDragEnd}
                  >
                    <div className="schemaDragHandle" title="Drag to reorder">
                      <GripVertical className="w-4 h-4" />
                    </div>
                    <div className="schemaGrid">
                      <div className="mdField">
                        <label className="mdLabel">Field key</label>
                        <Input
                          value={field.key}
                          onChange={(e) => updateField(field.tempId, { key: normalizeKey(e.target.value) })}
                          placeholder="status"
                        />
                      </div>
                      <div className="mdField">
                        <label className="mdLabel">Label</label>
                        <Input
                          value={field.label || ""}
                          onChange={(e) => updateField(field.tempId, { label: e.target.value })}
                          placeholder="Status"
                        />
                      </div>
                      <div className="mdField">
                        <label className="mdLabel">Type</label>
                        <Select
                          value={field.type}
                          onValueChange={(v) => {
                            const nextType = v as DashboardField["type"];
                            const patch: Partial<EditableField> = { type: nextType };
                            if (nextType !== "reference") {
                              patch.referenceTable = undefined;
                              patch.displayField = undefined;
                              patch.allowEditReference = undefined;
                            } else if (field.allowEditReference === undefined) {
                              patch.allowEditReference = false;
                            }
                            if (nextType !== "enum") {
                              patch.options = undefined;
                            }
                            updateField(field.tempId, patch);
                          }}
                        >
                          <SelectTrigger className="mdSelect">
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent className="mdSelectContent" position="popper">
                            {FIELD_TYPES.map((t) => (
                              <SelectItem key={t} value={t}>
                                {t.charAt(0).toUpperCase() + t.slice(1)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="mdField schemaToggles">
                        <label className="mdLabel">Options</label>
                        <div className="schemaToggleGroup">
                          <label className="mdCheckbox">
                            <input
                              type="checkbox"
                              checked={Boolean(field.required)}
                              onChange={(e) => updateField(field.tempId, { required: e.target.checked })}
                            />
                            <span>Required</span>
                          </label>
                          <label className="mdCheckbox">
                            <input
                              type="checkbox"
                              checked={field.visible !== false}
                              onChange={() =>
                                updateField(field.tempId, {
                                  visible: !field.visible,
                                  visibleInTable: !field.visible,
                                  hidden: field.visible,
                                })
                              }
                            />
                            <span>Visible</span>
                          </label>
                          {isReferenceField && (
                            <label className="mdCheckbox">
                              <input
                                type="checkbox"
                                checked={!!field.allowEditReference}
                                onChange={(e) => handleToggleAllowEditReference(field, e.target.checked)}
                              />
                              <span>Allow editing reference</span>
                            </label>
                          )}
                        </div>
                      </div>
                    </div>

                    {field.type === "enum" && (
                      <div className="schemaSubSection">
                        <div className="schemaSubHeader">
                          <p className="mdMainSubtitle">Enum options</p>
                          <Button size="sm" variant="outline" onClick={() => updateField(field.tempId, { options: [...(field.options || []), ""] })}>
                            <Plus className="w-3 h-3 mr-1" />
                            Add option
                          </Button>
                        </div>
                        <div className="schemaOptions">
                          {(field.options || []).map((opt, idx) => (
                            <div key={`${field.tempId}-opt-${idx}`} className="optionRow">
                              <Input
                                value={opt}
                                onChange={(e) => {
                                  const nextOpts = [...(field.options || [])];
                                  nextOpts[idx] = e.target.value;
                                  updateField(field.tempId, { options: nextOpts });
                                }}
                                placeholder="Value"
                              />
                              <button
                                type="button"
                                className="recordIconBtn danger"
                                title="Remove option"
                                onClick={() => {
                                  const nextOpts = [...(field.options || [])];
                                  nextOpts.splice(idx, 1);
                                  updateField(field.tempId, { options: nextOpts });
                                }}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                          {!(field.options || []).length && (
                            <p className="mdMainSubtitle text-xs text-muted-foreground">Add one or more option values.</p>
                          )}
                        </div>
                      </div>
                    )}

                    {isReferenceField && (
                      <div className="schemaSubSection">
                        <div className="schemaSubHeader">
                          <p className="mdMainSubtitle">Reference settings</p>
                        </div>
                        <div className="schemaGrid">
                          {showReferenceConfig && (
                            <div className="mdField">
                              <label className="mdLabel">Reference table</label>
                              <Select
                                value={field.referenceTable || ""}
                                onValueChange={(v) => updateField(field.tempId, { referenceTable: v, displayField: "" })}
                              >
                                <SelectTrigger className="mdSelect">
                                  <SelectValue placeholder="Select table" />
                                </SelectTrigger>
                                <SelectContent className="mdSelectContent" position="popper">
                                  {referenceTargets.map((table) => (
                                    <SelectItem key={table.key || table.id} value={table.key || table.id || ""}>
                                      {table.name || table.key}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                          {showReferenceConfig && (
                            <div className="mdField">
                              <label className="mdLabel">Display field</label>
                              <Select
                                value={field.displayField || ""}
                                onValueChange={(v) => updateField(field.tempId, { displayField: v })}
                                disabled={!field.referenceTable}
                              >
                                <SelectTrigger className="mdSelect">
                                  <SelectValue placeholder="Choose field" />
                                </SelectTrigger>
                                <SelectContent className="mdSelectContent" position="popper">
                                  {getReferenceFields(field.referenceTable).map((refField) => (
                                    <SelectItem key={refField.key} value={refField.key}>
                                      {refField.label || refField.key}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="schemaActions">
                      <button className="recordIconBtn danger" title="Delete column" onClick={() => removeField(field.tempId)}>
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {error && <div className="text-sm text-red-500 mt-2">{error}</div>}
        </div>

        <div className="mdModalFooter schemaFooter">
          <Button variant="outline" onClick={onClose} className="mdGhostBtn">
            Cancel
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={addField} className="mdGhostBtn">
              <Plus className="w-4 h-4 mr-2" />
              Add column
            </Button>
            <Button className="primaryBtn" onClick={handleSave} disabled={saving || loading}>
              {saving ? "Saving..." : "Save changes"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
