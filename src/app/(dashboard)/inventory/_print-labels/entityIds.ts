/** Rejects empty, stringified undefined/null from bad API rows. */
export function isUsableEntityId(id: unknown): id is string {
  const s = String(id ?? "").trim();
  return s.length > 0 && s !== "undefined" && s !== "null";
}
