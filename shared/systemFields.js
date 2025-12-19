export const SYSTEM_FIELDS = ["id", "_id", "created_at", "updated_at"];

export const isSystemField = (field) => {
  if (!field) return false;

  if (typeof field === "string") {
    const key = field.toLowerCase();
    return (
      SYSTEM_FIELDS.includes(field) ||
      SYSTEM_FIELDS.map((k) => k.toLowerCase()).includes(key)
    );
  }

  if (field.systemField === true) return true;

  const key = (field.key || "").toString();
  const lowerKey = key.toLowerCase();
  const normalized = lowerKey.replace(/[^a-z0-9]/g, "");
  const systemLower = SYSTEM_FIELDS.map((k) => k.toLowerCase());

  return (
    (!!key &&
      (SYSTEM_FIELDS.includes(key) ||
        systemLower.includes(lowerKey) ||
        systemLower.includes(normalized) ||
        normalized === "createdat" ||
        normalized === "updatedat" ||
        normalized.startsWith("createdat") ||
        normalized.startsWith("updatedat"))) ||
    (field.type || "").toString().toLowerCase() === "id" ||
    (field.type || "").toString().toLowerCase() === "timestamp"
  );
};
