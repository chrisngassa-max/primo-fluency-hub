export function inferCurriculumSessionCode(title?: string | null): string | null {
  if (!title) return null;
  const match = title.match(/\bS(\d{1,2})\b/i) ?? title.match(/\bS[ée]ance\s+(\d{1,2})\b/i);
  if (!match) return null;
  const sessionNumber = Number(match[1]);
  if (!Number.isInteger(sessionNumber) || sessionNumber < 1 || sessionNumber > 37) return null;
  return `S${String(sessionNumber).padStart(2, "0")}`;
}