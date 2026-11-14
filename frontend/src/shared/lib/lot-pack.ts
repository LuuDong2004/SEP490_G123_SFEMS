/** Quy cách bao bì của lô vật tư / hoá chất (182): quy đổi giữa bao bì (lọ, chai) và đơn vị của lô (ml, g). */
import { readableUnit } from "@/shared/lib/format";

/** Quy cách bao bì của một lô: tên bao bì (Lọ, Chai…) và lượng trong một bao bì theo đơn vị của lô (10 ml). */
export type LotPack = { packUnitName?: string | null; packUnit?: { name: string } | null; packSize?: number | string | null };

export const fmtQty = (n: number) => n.toLocaleString("vi-VN", { maximumFractionDigits: 3 });
export const round3 = (n: number) => Math.round(n * 1000) / 1000;

/** Tên bao bì và lượng mỗi bao bì của lô — `null` khi lô không có quy cách. */
export function packOf(item: LotPack | null | undefined): { name: string; size: number } | null {
  const name = item?.packUnitName ?? item?.packUnit?.name ?? null;
  const size = Number(item?.packSize);
  return name && Number.isFinite(size) && size > 0 ? { name: name.toLowerCase(), size } : null;
}

/** "100 ml" hoặc "100 ml (10 lọ)" khi lô có quy cách. */
export function lotAmount(qty: number | null | undefined, unit: string, item?: LotPack | null): string {
  if (qty == null || !Number.isFinite(Number(qty))) return "—";
  const pack = packOf(item);
  const base = `${fmtQty(Number(qty))} ${unit}`.trim();
  return pack ? `${base} (${fmtQty(round3(Number(qty) / pack.size))} ${pack.name})` : base;
}


/**
 * Số lượng của lô để ĐỌC, không để nhập: 8.250 g hiện "8,25 kg" (đơn vị gấp nghìn khi đủ lớn), lô có quy cách ghi
 * kèm số bao bì — "16,5 lọ · 8,25 kg". Dùng ở dòng chữ dưới ô nhập số lượng.
 */
export function readableAmount(qty: number, unit: string, item?: LotPack | null): string {
  if (!Number.isFinite(qty)) return "—";
  const r = readableUnit(qty, unit);
  const main = `${fmtQty(round3(qty / r.factor))} ${r.unit ?? ""}`.trim();
  const pack = packOf(item);
  return pack ? `${fmtQty(round3(qty / pack.size))} ${pack.name} · ${main}` : main;
}

/** Phần của một lô mà luật số lượng cần (hồ sơ tài sản / dòng phiếu đều có). */
export type LotLike = LotPack & {
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
  if (n > available) return `Vượt số hiện có (${readableAmount(available, unit, item)})`;
  return null;
}

/** Luật số lượng của một DÒNG phiếu: chỉ dòng là lô (quản lý theo số lượng) mới có số lượng để kiểm. */
export function bulkLineIssue(line: { equipment?: LotLike | null; quantity?: string | number | null }): string | null {
  return line.equipment?.trackingType === "BULK" ? lotQuantityIssue(line.equipment, line.quantity) : null;
}
