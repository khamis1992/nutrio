export type CsvCell = unknown;

const FORMULA_MARKERS = new Set(["=", "+", "@", "-"]);
const INVALID_FILENAME_CHARACTERS = '<>:"/\\|?*';

function startsWithFormulaMarker(value: string): boolean {
  let index = 0;
  while (index < value.length) {
    const code = value.charCodeAt(index);
    if (code !== 9 && code !== 10 && code !== 13 && code !== 32) break;
    index += 1;
  }
  return FORMULA_MARKERS.has(value[index] ?? "");
}

export function escapeCsvCell(value: CsvCell): string {
  let text = value === null || value === undefined
    ? ""
    : typeof value === "object"
      ? JSON.stringify(value)
      : String(value);

  // Spreadsheet programs can execute cells beginning with formula markers.
  // Prefixing an apostrophe preserves the display value while forcing text.
  if (startsWithFormulaMarker(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function buildCsv(rows: CsvCell[][]): string {
  return `\uFEFF${rows
    .map((row) => row.map(escapeCsvCell).join(","))
    .join("\r\n")}`;
}

function safeFilename(filename: string): string {
  const cleaned = Array.from(filename, (character) => {
    const code = character.charCodeAt(0);
    return code <= 31 || INVALID_FILENAME_CHARACTERS.includes(character)
      ? "-"
      : character;
  })
    .join("")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
  return cleaned || "export.csv";
}

export function downloadCsv(rows: CsvCell[][], filename: string): void {
  const blob = new Blob([buildCsv(rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = safeFilename(filename.endsWith(".csv") ? filename : `${filename}.csv`);
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
