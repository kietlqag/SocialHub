import { useMemo, useState } from "react";

export type FilterOperator =
  | "contains"
  | "starts_with"
  | "equals"
  | "not_equals"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "between"
  | "in";

export type FilterCondition = {
  field: string;
  operator: FilterOperator;
  value: any;
  valueTo?: any;
};

export type FilterGroup = {
  mode: "AND" | "OR";
  conditions: FilterCondition[];
};

export type TableField = {
  key: string;
  type: string;
  label?: string;
  enumValues?: string[];
  isReference?: boolean;
  referenceTableKey?: string | null;
};

type FiltersState = Record<string, FilterGroup | null>;

export const useTableFilters = () => {
  const [filtersByTable, setFiltersByTable] = useState<FiltersState>({});

  const setTableFilters = (tableKey: string, value: FilterGroup | null) => {
    setFiltersByTable((prev) => ({ ...prev, [tableKey]: value }));
  };

  const activeCounts = useMemo(() => {
    const map: Record<string, number> = {};
    Object.entries(filtersByTable).forEach(([key, group]) => {
      map[key] = group?.conditions?.length || 0;
    });
    return map;
  }, [filtersByTable]);

  return {
    filtersByTable,
    setTableFilters,
    activeCounts,
  };
};
