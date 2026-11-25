import { DOWNLOAD_TIMEOUT, kyInstance } from "@/shared/api/data";

/** Một cột của tệp Excel: khoá trong dòng, tiêu đề cột, kiểu ô. */
export type XlsxColumn = { key: string; label: string; type?: "text" | "number" };

/**
 * Xuất ĐÚNG bảng đang hiện ra tệp Excel thật (.xlsx): màn hình gửi các cột và các dòng đang lọc, máy chủ dựng tệp
 * (`POST /activity_logs/exports/xlsx`) và ghi lần xuất vào nhật ký. Chỉ xuất những cột có trên màn — không xuất thừa.
 */
export async function downloadXlsx(o: {
  resource: string;
  filename: string;
  title: string;
  subtitle?: string;
  columns: XlsxColumn[];
  rows: Record<string, unknown>[];
  /** Trang tính thêm sau trang đầu, cùng cột (vd. mỗi trường một trang). */
  parts?: { name: string; title?: string; rows: Record<string, unknown>[] }[];
  detail?: string;
}) {
  const blob = await kyInstance.post("activity_logs/exports/xlsx", {
    timeout: DOWNLOAD_TIMEOUT,
    json: {
      ...o,
      resource: o.resource.replace(/-/g, "_").replace(/[^a-z0-9_]/g, "").slice(0, 60) || "unknown",
      columns: o.columns.map((c) => ({ ...c, type: c.type ?? "text" })),
      path: (window.location.pathname + window.location.search).slice(0, 500),
    },
  }).blob();
  const url = URL.createObjectURL(blob);
  Object.assign(document.createElement("a"), { href: url, download: o.filename }).click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
