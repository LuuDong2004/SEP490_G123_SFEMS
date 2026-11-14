import { kyInstance } from "@/shared/api/data";

/** Một lần xuất chạy trên trình duyệt — in / lưu PDF, xuất CSV. */
export type ExportEvent = {
  /** Tên resource của màn hình đã xuất (vd. `equipment`, `report_data_quality`). */
  resource: string;
  format: "PDF" | "CSV";
  /** Số dòng đã xuất; không biết thì bỏ trống. */
  rows?: number;
  /** Phạm vi / bộ lọc / tiêu đề bản in. */
  detail?: string;
};

/** Hai lần báo trong khoảng này coi là một (hai `PrintSheet` cùng nghe một lần in). */
const DEDUPE_MS = 1500;
let last: { key: string; at: number } | null = null;

const clip = (s: string | undefined, max: number) => (s && s.length > max ? s.slice(0, max) : s);

/**
 * Ghi lần xuất vào nhật ký hoạt động (`POST /activity_logs/exports`). Xuất Excel đi qua máy chủ nên đã tự được
 * ghi; in PDF và CSV thì máy chủ không thấy, màn hình phải báo. Người xuất là người của phiên — không gửi lên.
 * Không bao giờ ném lỗi: nhật ký hỏng không được chặn việc in hay tải tệp.
 */
export function logExport(event: ExportEvent) {
  const resource = event.resource.replace(/-/g, "_").replace(/[^a-z0-9_]/g, "").slice(0, 60) || "unknown";
  const key = `${resource}|${event.format}|${event.detail ?? ""}`;
  const now = Date.now();
  if (last && last.key === key && now - last.at < DEDUPE_MS) return;
  last = { key, at: now };
  void kyInstance
    .post("activity_logs/exports", {
      json: {
        resource,
        format: event.format,
        rows: event.rows,
        detail: clip(event.detail, 1000),
        path: clip(window.location.pathname + window.location.search, 500),
      },
    })
    .catch(() => undefined);
}

/** Bộ lọc của bảng thành chữ cho nhật ký: "status=IN_USE; school.id=3". */
export function describeFilters(filters: unknown[]): string {
  return filters
    .flatMap((f) => {
      const { field, operator, value } = (f ?? {}) as { field?: string; operator?: string; value?: unknown };
      if (!field || value == null || value === "" || (Array.isArray(value) && value.length === 0)) return [];
      const op = operator && operator !== "eq" ? ` ${operator} ` : "=";
      return [`${field}${op}${Array.isArray(value) ? value.join(",") : String(value)}`];
    })
    .join("; ");
}
