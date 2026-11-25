import type { ImportRow, ImportRowStatus } from "@/domains/data-import/types";

/** Sắp xếp theo một cột: `key` là khoá dữ liệu của trang, hoặc `_row` / `_status` / `_messages` / `_catalog`. */
export type SortState = { key: string; dir: "asc" | "desc" } | null;

/** Bấm tiêu đề: chưa xếp → A→Z → Z→A → bỏ xếp. */
export function nextSort(current: SortState, key: string): SortState {
  if (current?.key !== key) return { key, dir: "asc" };
  return current.dir === "asc" ? { key, dir: "desc" } : null;
}

/** Bỏ dấu, viết thường — gõ "tu sach" vẫn tìm ra "Tủ sách". */
export function fold(text: string) {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "d").toLowerCase();
}

/** Dòng có chứa mọi từ đã gõ, ở bất kỳ ô nào hay trong lời nhắn. */
export function matches(row: ImportRow, words: string[]) {
  if (!words.length) return true;
  const hay = fold([String(row.rowNo), ...Object.values(row.data), ...row.messages.map((m) => m.text),
    String(row.resolved.catalogCode ?? ""), String(row.resolved.catalogName ?? "")].join(" "));
  return words.every((w) => hay.includes(w));
}

export function searchWords(term: string) {
  return fold(term).split(/\s+/).filter(Boolean);
}

const SEVERITY: Record<ImportRowStatus, number> = { ERROR: 0, WARNING: 1, OK: 2, EXISTS: 3, SKIPPED: 4 };
const collator = new Intl.Collator("vi", { numeric: true, sensitivity: "base" });

function sortValue(row: ImportRow, key: string): string | number {
  switch (key) {
    case "_row": return row.rowNo;
    case "_status": return SEVERITY[row.status];
    case "_messages": return row.messages.map((m) => m.text).join(" ");
    case "_catalog": return String(row.resolved.catalogCode ?? "");
    default: return row.data[key] ?? "";
  }
}

/** Như Excel: ô trống luôn xuống cuối, số so như số ("A.9" trước "A.10"). */
export function sortRows(rows: ImportRow[], sort: SortState) {
  if (!sort) return rows;
  const sign = sort.dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const x = sortValue(a, sort.key);
    const y = sortValue(b, sort.key);
    if (x === "" && y !== "") return 1;
    if (y === "" && x !== "") return -1;
    const c = typeof x === "number" && typeof y === "number" ? x - y : collator.compare(String(x), String(y));
    return c * sign || a.rowNo - b.rowNo;
  });
}
