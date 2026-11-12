import { fundingAllowed, fundingRequired, OTHER_ACQUISITION_CODE, type OriginRule } from "@/domains/equipment/types";
import type { Details, VoucherFormConfig } from "@/domains/voucher/form-types";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Một mục "cần hoàn thiện". `lines` là chỉ số (từ 0) các dòng dính mục này — bấm mục là mở dòng
 * đầu tiên; `head` là mục của Biên bản giao nhận.
 */
export type ReadinessItem = { key: string; label: string; ok: boolean; hint?: string; lines?: number[]; head?: boolean; /** Mục của ô Nguồn hình thành ở đầu phiếu. */ origin?: boolean };

const filled = (v: unknown) => v != null && v !== "" && !(Array.isArray(v) && v.length === 0);

type CatalogOf = (line: any) => { trackingType?: string; unit?: unknown; assetCategory?: string | null } | undefined;

/**
 * Dòng hoá chất (theo phân loại của dòng, không thì của thiết bị) quản lý theo số lượng, có hàng nhận mà chưa
 * khai hạn sử dụng — cùng luật với `requireAssetProfileData` ở máy chủ. Thiếu hạn thì màn Thiết bị không báo
 * được lô sắp / đã hết hạn (QLTB-503).
 */
export function missingChemicalExpiry(line: any, catalog: ReturnType<CatalogOf>): boolean {
  return isChemical(line, catalog) && catalog?.trackingType === "BULK"
    && Number(line?.receivedQuantity ?? 0) > 0 && !filled(line?.expiryDate);
}

export function isChemical(line: any, catalog: ReturnType<CatalogOf>): boolean {
  return (line?.assetCategory ?? catalog?.assetCategory) === "CHEMICAL";
}

/**
 * Nguồn kinh phí của một dòng so với luật của nguồn hình thành — cùng phép với `requireSources` ở máy
 * chủ: thiếu khi bắt buộc, không đi với nguồn hình thành, hoặc "nguồn khác" mà chưa ghi rõ. Chưa chọn
 * nguồn hình thành thì chưa xét (mục đó có dòng riêng trong danh sách cần hoàn thiện).
 */
function fundingIssue(line: any, headFunding: string | null | undefined, rule: OriginRule | undefined): string | null {
  if (!rule || Number(line?.receivedQuantity ?? 0) <= 0) return null;
  const funding = filled(line?.fundingSource) ? line.fundingSource : filled(headFunding) ? headFunding : null;
  if (!funding) return fundingRequired(rule, line?.unitPrice) ? "Thiếu nguồn kinh phí" : null;
  if (!fundingAllowed(rule, funding)) return "Nguồn kinh phí không đi với nguồn hình thành";
  // Hình thức mua sắm "Khác" phải ghi rõ — cùng luật với máy chủ lúc trình.
  if (rule.acquisitionMethod && line?.acquisitionMethod?.id && line?.acquisitionMethod?.code === OTHER_ACQUISITION_CODE && !filled(line?.acquisitionNote)) {
    return "Chưa ghi rõ hình thức mua sắm";
  }
  return null;
}

/**
 * Những gì MỘT dòng còn thiếu trước khi trình — bảng dòng hiện thành dấu ⚠N trên dòng đó, hộp
 * chi tiết dòng liệt kê ra. Cùng luật với {@link intakeReadiness}.
 */
export function lineIssues(line: any, catalog: ReturnType<CatalogOf>, config: VoucherFormConfig | undefined, headFunding?: string | null, rule?: OriginRule): string[] {
  const out: string[] = [];
  if (!line?.catalog?.id) return ["Chưa chọn thiết bị"];
  const serial = catalog?.trackingType === "SERIAL";
  // Đơn giá không bắt buộc: nguyên giá chỉ ghi khi có dữ liệu (HSMT 3.5.3).
  if (missingChemicalExpiry(line, catalog)) out.push("Hoá chất chưa có hạn sử dụng");
  const issue = fundingIssue(line, headFunding, rule);
  if (issue) out.push(issue);
  if (serial && catalog && !catalog.unit) out.push("Thiết bị chưa có đơn vị tính (sửa ở danh mục)");
  if (Number(line.documentQuantity ?? 0) !== Number(line.receivedQuantity ?? 0) && !filled(line.varianceReason)) {
    out.push("Lệch số lượng, chưa ghi lý do");
  }
  for (const f of (config?.line ?? []).filter((f) => f.required && !f.stage)) {
    if (!filled(line.details?.[f.key])) out.push(`Thiếu ${f.label.toLowerCase()}`);
  }
  // Quy cách khai dở thì máy chủ từ chối ngay lúc lưu — nói trước ở đây.
  if (!serial && Boolean(line.packUnit?.id) !== (line.packSize != null && line.packSize !== "")) {
    out.push("Quy cách chưa đủ (bao bì và lượng)");
  }
  if (serial && Number(line.receivedQuantity ?? 0) > 999) out.push("Quá 999 cái, hãy tách sang phiếu khác");
  return out;
}

/**
 * "Trình được chưa?" — cùng các luật máy chủ kiểm lúc TRÌNH (`requireAssetProfileData`,
 * `requireLineComplete`, `requireComplete`, `checkCodeCapacity`), tính sẵn ở trình duyệt để người
 * nhập thấy còn thiếu gì TRƯỚC khi bấm, thay vì gửi lên rồi đọc câu từ chối. Máy chủ vẫn là nơi
 * quyết; đây chỉ là danh sách việc.
 *
 * @param catalogOf thiết bị của một dòng (cách quản lý, đơn vị tính) — form tra từ danh mục đã
 *   nạp, màn xem đọc thẳng trên dòng.
 */
export function intakeReadiness(
  values: {
    fundingSource?: string | null;
    lines?: any[];
    details?: Details | null;
    originSource?: { id?: unknown } | null;
    originNote?: string | null;
    acquisitionMethod?: { id?: unknown; code?: string | null } | null;
    acquisitionNoteHead?: string | null;
  },
  catalogOf: CatalogOf,
  config: VoucherFormConfig | undefined,
  rule?: OriginRule,
): ReadinessItem[] {
  const lines = (values.lines ?? []).filter(Boolean);
  const numbered = lines.map((l, i) => ({ l, i, c: catalogOf(l) }));
  const serial = numbered.filter((x) => x.c?.trackingType === "SERIAL");
  const hint = (xs: { i: number }[]) => (xs.length ? `Dòng ${xs.map((x) => x.i + 1).join(", ")}` : undefined);
  const item = (key: string, label: string, bad: { i: number }[]): ReadinessItem => ({
    key, label, ok: bad.length === 0, hint: hint(bad), lines: bad.map((x) => x.i),
  });

  const items: ReadinessItem[] = [
    { key: "origin", label: "Nguồn hình thành", ok: filled(values.originSource?.id), origin: true },
    { key: "lines", label: "Thiết bị trên phiếu", ok: lines.length > 0 },
    // Mục của từng dòng chỉ có khi đã có dòng — chưa có dòng thì "đã đủ" là sai.
    ...(lines.length ? [item("catalog", "Thiết bị của từng dòng", numbered.filter((x) => !x.l?.catalog?.id))] : []),
  ];
  if (rule?.noteRequired) {
    items.push({ key: "originNote", label: "Ghi rõ nguồn hình thành", ok: filled(values.originNote), origin: true });
  }
  if (rule?.acquisitionMethod && filled(values.acquisitionMethod?.id) && values.acquisitionMethod?.code === OTHER_ACQUISITION_CODE) {
    items.push({ key: "acquisitionNote", label: "Ghi rõ hình thức mua sắm", ok: filled(values.acquisitionNoteHead), origin: true });
  }
  if (rule && lines.length) {
    // Một mục cho mỗi KIỂU lỗi về nguồn kinh phí, để câu nhắc nói đúng việc phải làm.
    const issues = numbered.map((x) => ({ ...x, issue: fundingIssue(x.l, values.fundingSource, rule) }));
    for (const label of ["Thiếu nguồn kinh phí", "Nguồn kinh phí không đi với nguồn hình thành", "Chưa ghi rõ nguồn kinh phí"]) {
      const bad = issues.filter((x) => x.issue === label);
      // Mục luôn có là "Nguồn kinh phí"; hai mục sai còn lại chỉ hiện khi có dòng sai.
      if (bad.length || label === "Thiếu nguồn kinh phí") {
        items.push(item(`funding:${label}`, label === "Thiếu nguồn kinh phí" ? "Nguồn kinh phí" : label, bad));
      }
    }
  }
  const expiry = numbered.filter((x) => missingChemicalExpiry(x.l, x.c));
  if (expiry.length) items.push(item("expiry", "Hạn sử dụng của hoá chất", expiry));
  if (serial.length) items.push(item("unit", "Đơn vị tính của thiết bị", serial.filter((x) => !x.c?.unit)));
  if (lines.length) {
    items.push(item("variance", "Lý do lệch số lượng", numbered.filter(
      (x) => Number(x.l?.documentQuantity ?? 0) !== Number(x.l?.receivedQuantity ?? 0) && !filled(x.l?.varianceReason),
    )));
  }
  const headRequired = (config?.sections ?? [])
    .filter((s) => !s.stage && !s.when)
    .flatMap((s) => s.fields)
    .filter((f) => f.required && !f.stage);
  const headMissing = headRequired.filter((f) => !filled(values.details?.[f.key])).map((f) => f.label);
  if (headRequired.length) {
    items.push({ key: "head", label: headRequired.map((f) => f.label).join(", "), ok: headMissing.length === 0, head: true });
  }
  for (const f of (config?.line ?? []).filter((f) => f.required && !f.stage)) {
    if (lines.length) items.push(item(`line:${f.key}`, f.label, numbered.filter((x) => !filled(x.l?.details?.[f.key]))));
  }
  const tooMany = serial.filter((x) => Number(x.l?.receivedQuantity ?? 0) > 999);
  if (tooMany.length) items.push({ ...item("capacity", "Quá 999 cái một dòng", tooMany), hint: `${hint(tooMany)}. Hãy tách sang phiếu khác` });
  return items;
}
