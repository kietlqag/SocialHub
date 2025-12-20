import { useEffect, useMemo, useState } from "react";
import type { FilterCondition, FilterGroup, FilterOperator, TableField } from "./useTableFilters";

interface TableFiltersModalProps {
  isOpen: boolean;
  onClose: () => void;
  tableKey: string;
  fields: TableField[];
  value: FilterGroup | null;
  onChange: (value: FilterGroup | null) => void;
}

const stringOps: FilterOperator[] = ["contains", "starts_with", "equals", "not_equals"];
const numberOps: FilterOperator[] = ["equals", "not_equals", "gt", "gte", "lt", "lte", "between"];
const dateOps: FilterOperator[] = ["equals", "gt", "lt", "between"];
const booleanOps: FilterOperator[] = ["equals"];
const enumOps: FilterOperator[] = ["equals", "in"];

const emptyCondition = (field?: string): FilterCondition => ({
  field: field || "",
  operator: "equals",
  value: "",
  valueTo: undefined,
});

export function TableFiltersModal({ isOpen, onClose, tableKey, fields, value, onChange }: TableFiltersModalProps) {
  const [draft, setDraft] = useState<FilterGroup | null>(value || { mode: "AND", conditions: [] });

  useEffect(() => {
    setDraft(value || { mode: "AND", conditions: [] });
  }, [value, tableKey, isOpen]);

  const handleApply = () => {
    onChange(draft && draft.conditions.length ? draft : null);
    onClose();
  };

  const handleReset = () => {
    setDraft({ mode: "AND", conditions: [] });
    onChange(null);
    onClose();
  };

  const visibleFields = useMemo(
    () => fields.filter((f) => f.key && !["_id", "id", "created_at", "updated_at"].includes(f.key.toLowerCase())),
    [fields],
  );

  const getOps = (fieldKey: string): FilterOperator[] => {
    const f = visibleFields.find((x) => x.key === fieldKey);
    if (!f) return stringOps;
    const t = (f.type || "").toLowerCase();
    if (t === "number") return numberOps;
    if (t === "date") return dateOps;
    if (t === "boolean") return booleanOps;
    if (f.enumValues?.length || f.isReference) return enumOps;
    return stringOps;
  };

  const renderValueInput = (cond: FilterCondition, idx: number) => {
    const field = visibleFields.find((f) => f.key === cond.field);
    const type = (field?.type || "").toLowerCase();
    const operator = cond.operator;
    const commonProps = {
      className:
        "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 bg-white",
    };

    if (operator === "between") {
      const inputType = type === "number" ? "number" : type === "date" ? "date" : "text";
      return (
        <div className="grid grid-cols-2 gap-2">
          <input
            {...commonProps}
            type={inputType}
            value={cond.value ?? ""}
            onChange={(e) =>
              setDraft((prev) =>
                prev
                  ? {
                      ...prev,
                      conditions: prev.conditions.map((c, i) =>
                        i === idx ? { ...c, value: inputType === "number" ? e.target.value : e.target.value } : c,
                      ),
                    }
                  : prev,
              )
            }
            placeholder="From"
          />
          <input
            {...commonProps}
            type={inputType}
            value={cond.valueTo ?? ""}
            onChange={(e) =>
              setDraft((prev) =>
                prev
                  ? {
                      ...prev,
                      conditions: prev.conditions.map((c, i) =>
                        i === idx ? { ...c, valueTo: inputType === "number" ? e.target.value : e.target.value } : c,
                      ),
                    }
                  : prev,
              )
            }
            placeholder="To"
          />
        </div>
      );
    }

    if (type === "number") {
      return (
        <input
          {...commonProps}
          type="number"
          value={cond.value ?? ""}
          onChange={(e) =>
            setDraft((prev) =>
              prev
                ? {
                    ...prev,
                    conditions: prev.conditions.map((c, i) => (i === idx ? { ...c, value: e.target.value } : c)),
                  }
                : prev,
            )
          }
          placeholder="Enter number"
        />
      );
    }

    if (type === "date") {
      return (
        <input
          {...commonProps}
          type="date"
          value={cond.value ?? ""}
          onChange={(e) =>
            setDraft((prev) =>
              prev
                ? {
                    ...prev,
                    conditions: prev.conditions.map((c, i) => (i === idx ? { ...c, value: e.target.value } : c)),
                  }
                : prev,
            )
          }
        />
      );
    }

    if (type === "boolean") {
      return (
        <select
          {...commonProps}
          value={String(cond.value ?? "")}
          onChange={(e) =>
            setDraft((prev) =>
              prev
                ? {
                    ...prev,
                    conditions: prev.conditions.map((c, i) => (i === idx ? { ...c, value: e.target.value === "true" } : c)),
                  }
                : prev,
            )
          }
        >
          <option value="">Select</option>
          <option value="true">True</option>
          <option value="false">False</option>
        </select>
      );
    }

    if ((field?.enumValues?.length || field?.isReference) && cond.operator === "in") {
      return (
        <select
          {...commonProps}
          multiple
          value={Array.isArray(cond.value) ? cond.value : []}
          onChange={(e) => {
            const selected = Array.from(e.target.selectedOptions).map((o) => o.value);
            setDraft((prev) =>
              prev
                ? {
                    ...prev,
                    conditions: prev.conditions.map((c, i) => (i === idx ? { ...c, value: selected } : c)),
                  }
                : prev,
            );
          }}
        >
          {(field?.enumValues || []).map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      );
    }

    if (field?.enumValues?.length) {
      return (
        <select
          {...commonProps}
          value={cond.value ?? ""}
          onChange={(e) =>
            setDraft((prev) =>
              prev
                ? {
                    ...prev,
                    conditions: prev.conditions.map((c, i) => (i === idx ? { ...c, value: e.target.value } : c)),
                  }
                : prev,
            )
          }
        >
          <option value="">Select</option>
          {field.enumValues.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      );
    }

    return (
      <input
        {...commonProps}
        type="text"
        value={cond.value ?? ""}
        onChange={(e) =>
          setDraft((prev) =>
            prev
              ? {
                  ...prev,
                  conditions: prev.conditions.map((c, i) => (i === idx ? { ...c, value: e.target.value } : c)),
                }
              : prev,
          )
        }
        placeholder="Enter value"
      />
    );
  };

  if (!isOpen) return null;

  return (
    <div className="mdFiltersOverlay">
      <div className="mdFiltersPanel">
        <div className="mdFiltersHeader">
          <div>
            <p className="mdFiltersTitle">Filters</p>
            <p className="mdFiltersSubtitle">Filter {tableKey}</p>
          </div>
          <button className="mdFiltersClose" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="filterConditions">
          {(draft?.conditions || []).map((cond, idx) => {
            const ops = getOps(cond.field);
            return (
              <div key={idx} className="mdFilterRow">
                <div>
                  <select
                    className="mdInput"
                    value={cond.field}
                    onChange={(e) => {
                      const fieldKey = e.target.value;
                      const nextOps = getOps(fieldKey);
                      setDraft((prev) =>
                        prev
                          ? {
                              ...prev,
                              conditions: prev.conditions.map((c, i) =>
                                i === idx ? { ...c, field: fieldKey, operator: nextOps[0], value: "", valueTo: "" } : c,
                              ),
                            }
                          : prev,
                      );
                    }}
                  >
                    <option value="">Select field</option>
                    {visibleFields.map((f) => (
                      <option key={f.key} value={f.key}>
                        {f.label || f.key}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <select
                    className="mdInput"
                    value={cond.operator}
                    onChange={(e) =>
                      setDraft((prev) =>
                        prev
                          ? {
                              ...prev,
                              conditions: prev.conditions.map((c, i) =>
                                i === idx ? { ...c, operator: e.target.value as FilterOperator, value: "", valueTo: "" } : c,
                              ),
                            }
                          : prev,
                      )
                    }
                    disabled={!cond.field}
                  >
                    {ops.map((op) => (
                      <option key={op} value={op}>
                        {op}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="mdFilterValue">{renderValueInput(cond, idx)}</div>
                <div className="mdFilterRemoveCol">
                  <button
                    className="mdIconButton mdFilterRemove"
                    onClick={() =>
                      setDraft((prev) =>
                        prev
                          ? { ...prev, conditions: prev.conditions.filter((_, i) => i !== idx) }
                          : prev,
                      )
                    }
                  >
                    ×
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <button
          className="mdBtnGhost"
          onClick={() =>
            setDraft((prev) => ({
              mode: prev?.mode || "AND",
              conditions: [...(prev?.conditions || []), emptyCondition(visibleFields[0]?.key)],
            }))
          }
        >
          Add condition
        </button>

        <div className="mdFiltersFooter">
          <div className="match-group">
            {(["AND", "OR"] as FilterGroup["mode"][]).map((mode) => (
              <button
                key={mode}
                onClick={() => setDraft((prev) => (prev ? { ...prev, mode } : { mode, conditions: [] }))}
                className={draft?.mode === mode ? "match-btn active" : "match-btn"}
              >
                {mode === "AND" ? "All conditions" : "Any condition"}
              </button>
            ))}
          </div>
          <div className="actions">
            <button className="btn-reset" onClick={handleReset}>
              Reset
            </button>
            <button className="btn-apply" onClick={handleApply}>
              Apply filters
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
