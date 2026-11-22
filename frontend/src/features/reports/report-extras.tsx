import { formatPlainDate } from "@/shared/lib/format";
import { VOUCHER_ROUTES } from "@/domains/equipment/types";
import type { ReportColumnType } from "@/domains/report/types";

/* eslint-disable @typescript-eslint/no-explicit-any */

const number = new Intl.NumberFormat("vi-VN");

export function format(value: string | number | null | undefined, type: ReportColumnType) {
  if (value == null || value === "") return "";
  if (type === "number" || type === "money") return number.format(Number(value));
  if (type === "date") return formatPlainDate(String(value));
  return String(value);
}

export const numeric = (t: ReportColumnType) => t === "number" || t === "money";

/**
 * Bộ lọc theo cột của từng báo cáo — lọc NGAY trên các dòng đã tải (không hỏi lại máy chủ), giá trị lấy từ chính
 * cột đó. Báo cáo không có ở đây thì không có ô lọc thêm. Xuất Excel vẫn ra đủ các dòng.
 */
export const REPORT_FILTERS: Record<string, { key: string; label: string }[]> = {
  // Môn, loại phòng, kết luận.
  "room-standard": [
    { key: "subject", label: "môn" },
    { key: "room_type", label: "loại phòng" },
    { key: "verdict", label: "kết luận" },
  ],
};

/**
 * Bấm một dòng thì làm gì: mở hồ sơ tài sản / phòng, hoặc xem đánh giá chuẩn CSVC của một trường.
 * Id đi kèm dòng dưới dạng khoá ẩn (không có trong `columns`, không ra Excel).
 */
export type RowAction =
  | { to: string; title: string }
  | { standard: { id: number; name: string }; title: string };

export function rowAction(report: string, row: Record<string, any>): RowAction | null {
  // Một trường trên "Đánh giá mức độ chuẩn CSVC" mở bản đánh giá chi tiết của trường đó.
  if (report === "facility-standard" && row.school_id != null)
    return { standard: { id: Number(row.school_id), name: String(row.name ?? "") }, title: "Xem đánh giá chi tiết" };
  if (row.room_id != null) return { to: `/rooms/show/${row.room_id}`, title: "Mở hồ sơ phòng" };
  if (row.equipment_id != null) return { to: `/equipment/show/${row.equipment_id}`, title: "Mở hồ sơ thiết bị" };
  return null;
}

/** Đường tới phiếu đã gây ra dòng lịch sử: `equipment_intakes` → `/equipment-intakes/show/1`. Loại phiếu không có màn thì không có liên kết. */
export function voucherLink(row: Record<string, any>): string | null {
  const route = row.voucher_resource ? VOUCHER_ROUTES[String(row.voucher_resource)] : undefined;
  if (!route || row.voucher_id == null) return null;
  return `${route}/show/${row.voucher_id}`;
}
