/**
 * Số lượng của lô vật tư / hoá chất. Lô KHÔNG quy đổi bao bì (lọ, chai chỉ là đồ đựng): mọi số đều theo đơn vị tính
 * của danh mục (g, ml…).
 */
import { readableUnit } from "@/shared/lib/format";

export const fmtQty = (n: number) => n.toLocaleString("vi-VN", { maximumFractionDigits: 3 });
export const round3 = (n: number) => Math.round(n * 1000) / 1000;

/** "100 ml". */
export function lotAmount(qty: number | null | undefined, unit: string): string {
  if (qty == null || !Number.isFinite(Number(qty))) return "—";
  return `${fmtQty(Number(qty))} ${unit}`.trim();
}

/**
 * Số lượng của lô để ĐỌC, không để nhập: 8.250 g hiện "8,25 kg" (đơn vị gấp nghìn khi đủ lớn). Dùng ở dòng chữ dưới
 * ô nhập số lượng.
 */
export function readableAmount(qty: number, unit: string): string {
  if (!Number.isFinite(qty)) return "—";
  const r = readableUnit(qty, unit);
  return `${fmtQty(round3(qty / r.factor))} ${r.unit ?? ""}`.trim();
}

/** Phần của một lô mà luật số lượng cần (hồ sơ tài sản / dòng phiếu đều có). */
export type LotLike = {
  trackingType?: string | null;
  quantity?: number | null;
  unitName?: string | null;
  /** Hồ sơ tài sản trả đối tượng, dòng của `/equipment_items` trả tên. */
  unit?: { name: string } | string | null;
  unitAllowsFraction?: boolean | null;
};

/**
 * Luật số lượng của MỘT lô vật tư / hoá chất, chung cho mọi phiếu (cấp phát, điều chuyển, tiêu hao…) — cùng giới hạn
 * với máy chủ: bắt buộc, số dương tối đa 3 chữ số lẻ, đơn vị không chia được thì phải nguyên, không vượt số hiện có.
 * `null` là hợp lệ.
 */
export function lotQuantityIssue(item: LotLike | null | undefined, quantity: string | number | null | undefined): string | null {
  if (!item) return null;
  const raw = String(quantity ?? "").trim();
  const available = Number(item.quantity ?? 0);
  const unit = item.unitName ?? (typeof item.unit === "string" ? item.unit : item.unit?.name) ?? "";
  if (!raw) return "Nhập số lượng";
  if (!/^(?:\d+|\d*\.\d{1,3})$/.test(raw)) return "Nhập số hợp lệ, tối đa 3 chữ số lẻ";
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return "Số lượng phải lớn hơn 0";
  if (item.unitAllowsFraction === false && !Number.isInteger(n)) return `${unit || "Đơn vị này"} không nhận số lẻ`;
  if (n > available) return `Vượt số hiện có (${readableAmount(available, unit)})`;
  return null;
}

/** Luật số lượng của một DÒNG phiếu: chỉ dòng là lô (quản lý theo số lượng) mới có số lượng để kiểm. */
export function bulkLineIssue(line: { equipment?: LotLike | null; quantity?: string | number | null }): string | null {
  return line.equipment?.trackingType === "BULK" ? lotQuantityIssue(line.equipment, line.quantity) : null;
}
