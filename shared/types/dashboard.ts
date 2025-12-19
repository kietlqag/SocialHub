export type WidgetType = "metric" | "chart" | "table";

export type FieldType = "string" | "number" | "boolean" | "date" | "enum" | "reference" | "id";

export interface ChartSeriesConfig {
  name: string;
  filter?: Record<string, any>;
}

export interface WidgetConfig {
  id: string;
  title: string;
  type: WidgetType;
  sourceTable: string;
  widgetKey?: string;
  valueField?: string;
  aggregate?: "sum" | "count" | "avg" | "min" | "max";
  groupByField?: string;
  dateField?: string;
  seriesConfig?: ChartSeriesConfig[];
  filter?: Record<string, any>;
  description?: string;
  icon?: string;
  source?: "auto" | "manual";
  hidden?: boolean;
  hiddenAt?: string;
}

export interface ChartPoint {
  x: string | number | Date;
  y: number;
}

export interface WidgetResult {
  id: string;
  type: WidgetType;
  hasData: boolean;
  error?: string;
  value?: number;
  formattedValue?: string | null;
  series?: Array<{ name: string; points: ChartPoint[] }>;
  rows?: Record<string, any>[];
}

export type SemanticType =
  | "money"
  | "quantity"
  | "countable_entity"
  | "timestamp"
  | "category"
  | "status"
  | "boolean";

export type SemanticRole =
  | "transaction_value"
  | "entity_id"
  | "entity_name"
  | "time_dimension"
  | "group_dimension"
  | "state"
  | "generic";

export interface FieldConfig {
  id?: string;
  key: string;
  label?: string;
  type: FieldType;
  required?: boolean;
  visibleInTable?: boolean;
  options?: string[];
  referenceTable?: string;
  displayField?: string;
  system?: boolean;
  systemField?: boolean;
  enumValues?: string[];
  semanticType?: SemanticType;
  semanticRole?: SemanticRole;
}

export interface FieldDefinition extends FieldConfig {}

export interface TableConfig {
  key: string;
  name: string;
  description?: string;
  fields: FieldConfig[];
  sampleRows?: Record<string, any>[];
}

export interface TableDefinition extends TableConfig {}

export interface Dashboard {
  _id: string;
  name: string;
  description?: string;
  widgets: WidgetConfig[];
  tables?: TableConfig[];
}
