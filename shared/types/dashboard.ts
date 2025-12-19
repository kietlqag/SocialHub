export type WidgetType = "metric" | "chart" | "table";

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

export interface FieldDefinition {
  key: string;
  type: string;
  required?: boolean;
  enumValues?: string[];
  semanticType?: SemanticType;
  semanticRole?: SemanticRole;
}

export interface TableDefinition {
  key: string;
  name: string;
  description?: string;
  fields: FieldDefinition[];
  sampleRows?: Record<string, any>[];
}

export interface Dashboard {
  _id: string;
  name: string;
  description?: string;
  widgets: WidgetConfig[];
  tables?: TableDefinition[];
}
