import { fundingAllowed, fundingRequired, OTHER_ACQUISITION_CODE, type OriginRule } from "@/domains/equipment/types";
import type { Details, VoucherFormConfig } from "@/domains/voucher/form-types";
import { textError } from "@/shared/lib/field-rules";

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Nhóm của form lập phiếu mà một mục thuộc về — "Trước khi trình" xếp theo đúng ba khối của form. */
export type ReadinessGroup = "source" | "lines" | "handover";

/**
 * Một mục "cần hoàn thiện". `lines` là chỉ số (từ 0) các dòng dính mục này — bấm mục là mở dòng
 * đầu tiên; `head` là mục của Biên bản giao nhận; `field` là tên ô trên form để đưa con trỏ tới.
 */
export type ReadinessItem = {
  key: string;
  label: string;
  ok: boolean;
  hint?: string;
  lines?: number[];
  head?: boolean;
  /** Mục của ô Nguồn hình thành ở đầu phiếu. */
  origin?: boolean;
  group?: ReadinessGroup;
  field?: string;
};

const filled = (v: unknown) => v != null && v !== "" && !(Array.isArray(v) && v.length === 0);

/** Mã nguồn hình thành "Mua sắm" — nguồn duy nhất bắt buộc hoá đơn và đơn giá. */
export const PURCHASE_CODE = "MUA_SAM";
/** Hàng MUA — theo hay ngoài kế hoạch: cùng đòi hoá đơn, đơn giá (`OriginRule.purchase` ở máy chủ). */
export const PURCHASE_CODES: readonly string[] = [PURCHASE_CODE, "MUA_NGOAI_KH"];
export const isPurchaseCode = (code: string | null | undefined) => !!code && PURCHASE_CODES.includes(code);

type CatalogOf = (line: any) => { trackingType?: string; unit?: unknown; assetCategory?: string | null } | undefined;

/**
 * Dòng hoá chất (theo phân loại của dòng, không thì của thiết bị) quản lý theo số lượng, có hàng nhận mà chưa
 * khai hạn sử dụng — cùng luật với `requireAssetProfileData` ở máy chủ. Thiếu hạn thì màn Thiết bị không báo
 * được lô sắp / đã hết hạn (QLTB-503).
 */
export function missingChemicalExpiry(line: any, catalog: ReturnType<CatalogOf>): boolean {
  return isChemical(line, catalog) && catalog?.trackingType === "bulk"
    && Number(line?.receivedQuantity ?? 0) > 0 && !filled(line?.expiryDate);
}

export function isChemical(line: any, catalog: ReturnType<CatalogOf>): boolean {
  return (line?.assetCategory ?? catalog?.assetCategory) === "CHEMICAL";
}

/** Số serial của một dòng: ô nhiều dòng trên form (`serialText`), hoặc danh sách đã lưu (`serialNumbers`). */
export function serialsOf(line: any): string[] {
  const text = line?.serialText ?? ((line?.serialNumbers ?? []) as string[]).join("\n");
  return String(text ?? "").split(/\r?\n/).map((s) => s.replace(/\s+/g, "").toUpperCase()).filter(Boolean);
}

/**
 * Lỗi số serial của một dòng — cùng luật máy chủ (`EquipmentIntakeService.serialProblem` + `FieldRule.SERIAL`):
 * không quá số lượng nhận, mỗi số 3–50 ký tự theo kiểu SERIAL, không lặp trong dòng. Trùng thiết bị khác của trường
 * thì chỉ máy chủ biết.
 */
export function serialError(line: any): string | undefined {
  const serials = serialsOf(line);
  if (!serials.length) return undefined;
  const received = Number(line?.receivedQuantity ?? 0);
  if (serials.length > received) return `Có ${serials.length} số serial, nhiều hơn số lượng (${received})`;
  // Theo vị trí: serial khai cho máy thứ k mà dòng chỉ còn nhận ít hơn k cái.
  const slots = String(line?.serialText ?? "").split(/\r?\n/);
  const last = slots.map((s) => s.trim()).lastIndexOf(slots.map((s) => s.trim()).filter(Boolean).pop() ?? "\u0000");
  if (last >= received) return `Có số serial cho máy thứ ${last + 1}, nhiều hơn số lượng (${received})`;
  for (const s of serials) {
    const e = textError("SERIAL", "Số serial", s, undefined, 3);
    if (e) return `${e} (${s})`;
  }
  const dup = serials.find((s, i) => serials.indexOf(s) !== i);
  return dup ? `Số serial ${dup} nhập hai lần` : undefined;
}

/** Số serial lặp giữa các dòng của phiếu: chỉ số dòng (từ 0) → số trùng với dòng trước. */
function crossLineDuplicates(lines: any[]): Map<number, string> {
  const seen = new Map<string, number>();
  const out = new Map<number, string>();
  lines.forEach((l, i) => {
    for (const s of new Set(serialsOf(l))) {
      const at = seen.get(s);
      if (at != null && at !== i) out.set(i, `${s} trùng dòng ${at + 1}`);
      else seen.set(s, i);
    }
  });
  return out;
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
  // "Nguồn khác" phải ghi rõ — dòng theo phiếu mang phần ghi rõ của phiếu lúc lưu.
  if (funding === "OTHER" && !filled(line?.fundingNote) && filled(line?.fundingSource)) return "Chưa ghi rõ nguồn kinh phí";
  // Hình thức mua sắm "Khác" phải ghi rõ — cùng luật với máy chủ lúc trình.
  if (rule.acquisitionMethod && line?.acquisitionMethod?.id && line?.acquisitionMethod?.code === OTHER_ACQUISITION_CODE && !filled(line?.acquisitionNote)) {
    return "Chưa ghi rõ hình thức mua sắm";
  }
  return null;
}

const isPurchase = (rule: OriginRule | undefined) => isPurchaseCode(rule?.code);
const unpriced = (line: any) => Number(line?.receivedQuantity ?? 0) > 0 && !(Number(line?.unitPrice ?? 0) > 0);

/**
 * Những gì MỘT dòng còn thiếu trước khi trình — bảng dòng hiện thành dấu ⚠N trên dòng đó. Cùng luật với
 * {@link intakeReadiness}.
 */
export function lineIssues(line: any, catalog: ReturnType<CatalogOf>, config: VoucherFormConfig | undefined, headFunding?: string | null, rule?: OriginRule): string[] {
  const out: string[] = [];
  if (!line?.catalog?.id) return ["Chưa chọn thiết bị"];
  const serial = catalog?.trackingType === "serial";
  if (isPurchase(rule) && unpriced(line)) out.push("Mua sắm phải có đơn giá");
  if (missingChemicalExpiry(line, catalog)) out.push("Hoá chất chưa có hạn sử dụng");
  const issue = fundingIssue(line, headFunding, rule);
  if (issue) out.push(issue);
  if (serial && catalog && !catalog.unit) out.push("Thiết bị chưa có đơn vị tính (sửa ở danh mục)");
  if (Number(line.documentQuantity ?? 0) !== Number(line.receivedQuantity ?? 0) && !filled(line.varianceReason)) {
    out.push("Nhận khác hoá đơn, chưa ghi lý do");
  }
  for (const f of (config?.line ?? []).filter((f) => f.required && !f.stage)) {
    if (!filled(line.details?.[f.key])) out.push(`Thiếu ${f.label.toLowerCase()}`);
  }
  // Quy cách khai dở thì máy chủ từ chối ngay lúc lưu — nói trước ở đây.
  if (!serial && Boolean(line.packUnit?.id) !== (line.packSize != null && line.packSize !== "")) {
    out.push("Quy cách chưa đủ (bao bì và lượng)");
  }
  const serialProblem = serial ? serialError(line) : undefined;
  if (serialProblem) out.push(serialProblem);
  if (serial && Number(line.receivedQuantity ?? 0) > 999) out.push("Quá 999 cái, hãy tách sang phiếu khác");
  return out;
}

/**
 * "Trình được chưa?" — cùng các luật máy chủ kiểm lúc TRÌNH (`requireAssetProfileData`, `requirePurchaseDocuments`,
 * `requireLineComplete`, `requireComplete`, `checkCodeCapacity`), tính sẵn ở trình duyệt để người nhập thấy còn
 * thiếu gì TRƯỚC khi bấm. Máy chủ vẫn là nơi quyết; đây chỉ là danh sách việc. Tệp đính kèm (bắt buộc ít nhất một)
 * do form thêm vì chỉ form biết số tệp.
 *
 * @param catalogOf thiết bị của một dòng (cách quản lý, đơn vị tính) — form tra từ danh mục đã
 *   nạp, màn xem đọc thẳng trên dòng.
 */
export function intakeReadiness(
  values: {
    fundingSource?: string | null;
    fundingNoteHead?: string | null;
    lines?: any[];
    details?: Details | null;
    originSource?: { id?: unknown } | null;
    originNote?: string | null;
    acquisitionMethod?: { id?: unknown; code?: string | null } | null;
    acquisitionNoteHead?: string | null;
    supplier?: string | null;
    documentNo?: string | null;
    documentDate?: string | null;
    intakeDate?: string | null;
    /** Phiếu nghiệp vụ phiếu ghi tăng đi từ đó (đề xuất mua sắm, biên bản kiểm kê) — có khi phiếu đã lưu. */
    source?: { resource?: string | null } | null;
  },
  catalogOf: CatalogOf,
  config: VoucherFormConfig | undefined,
  rule?: OriginRule,
): ReadinessItem[] {
  const lines = (values.lines ?? []).filter(Boolean);
  const numbered = lines.map((l, i) => ({ l, i, c: catalogOf(l) }));
  const serial = numbered.filter((x) => x.c?.trackingType === "serial");
  const hint = (xs: { i: number }[]) => (xs.length ? `Dòng ${xs.map((x) => x.i + 1).join(", ")}` : undefined);
  const item = (key: string, label: string, bad: { i: number }[], group: ReadinessGroup = "lines"): ReadinessItem => ({
    key, label, ok: bad.length === 0, hint: hint(bad), lines: bad.map((x) => x.i), group,
  });

  const items: ReadinessItem[] = [
    { key: "origin", label: "Nguồn hình thành", ok: filled(values.originSource?.id), origin: true, group: "source", field: "originSource.id" },
  ];
  if (rule?.noteRequired) {
    items.push({ key: "originNote", label: "Ghi rõ nguồn hình thành", ok: filled(values.originNote), origin: true, group: "source", field: "originNote" });
  }
  if (isPurchase(rule)) {
    // "Kế hoạch mua sắm" phải đi từ một đề xuất trong kế hoạch — cùng `requirePlanLink` ở máy chủ. Bấm mục này mở
    // ô Nguồn hình thành, dưới ô có nút chọn đề xuất.
    items.push({
      key: "planLink", label: "Chọn kế hoạch mua sắm", ok: values.source?.resource === "purchase_proposals",
      origin: true, group: "source", field: "originSource.id",
    });
    // Chứng từ của phiếu, hoặc của dòng có hoá đơn riêng — mỗi dòng có nhận hàng phải có đủ.
    const receiving = numbered.filter((x) => Number(x.l?.receivedQuantity ?? 0) > 0);
    const lacks = (k: "supplier" | "documentNo" | "documentDate") =>
      receiving.length ? receiving.some((x) => !filled(x.l?.[k]) && !filled(values[k])) : !filled(values[k]);
    items.push({ key: "supplier", label: "Nhà cung cấp", ok: !lacks("supplier"), group: "source", field: "supplier" });
    items.push({ key: "documentNo", label: "Số hoá đơn", ok: !lacks("documentNo"), group: "source", field: "documentNo" });
    const late = values.intakeDate && values.documentDate && String(values.documentDate) > String(values.intakeDate);
    items.push({
      key: "documentDate", label: late ? "Ngày hoá đơn sau ngày nhập" : "Ngày hoá đơn", ok: !lacks("documentDate") && !late,
      group: "source", field: "documentDate",
    });
  }
  if (rule?.acquisitionMethod && filled(values.acquisitionMethod?.id) && values.acquisitionMethod?.code === OTHER_ACQUISITION_CODE) {
    items.push({ key: "acquisitionNote", label: "Ghi rõ hình thức mua sắm", ok: filled(values.acquisitionNoteHead), origin: true, group: "source", field: "acquisitionNoteHead" });
  }
  if (rule && values.fundingSource === "OTHER" && "fundingNoteHead" in values) {
    items.push({ key: "fundingNote", label: "Ghi rõ nguồn kinh phí", ok: filled(values.fundingNoteHead), group: "source", field: "fundingNoteHead" });
  }
  if (rule && lines.length) {
    // Một mục cho mỗi KIỂU lỗi về nguồn kinh phí, để câu nhắc nói đúng việc phải làm.
    const issues = numbered.map((x) => ({ ...x, issue: fundingIssue(x.l, values.fundingSource, rule) }));
    for (const label of ["Thiếu nguồn kinh phí", "Nguồn kinh phí không đi với nguồn hình thành", "Chưa ghi rõ nguồn kinh phí", "Chưa ghi rõ hình thức mua sắm"]) {
      const bad = issues.filter((x) => x.issue === label);
      // Mục luôn có là "Nguồn kinh phí"; các mục sai còn lại chỉ hiện khi có dòng sai.
      if (bad.length || label === "Thiếu nguồn kinh phí") {
        items.push({ ...item(`funding:${label}`, label === "Thiếu nguồn kinh phí" ? "Nguồn kinh phí" : label, bad, "source"), field: "fundingSource" });
      }
    }
  }

  items.push({ key: "lines", label: "Thêm ít nhất một thiết bị", ok: lines.length > 0, group: "lines" });
  // Mục của từng dòng chỉ có khi đã có dòng — chưa có dòng thì "đã đủ" là sai.
  if (lines.length) items.push(item("catalog", "Thiết bị của từng dòng", numbered.filter((x) => !x.l?.catalog?.id)));
  if (isPurchase(rule) && lines.length) items.push(item("price", "Đơn giá lớn hơn 0", numbered.filter((x) => unpriced(x.l))));
  const expiry = numbered.filter((x) => missingChemicalExpiry(x.l, x.c));
  if (expiry.length) items.push(item("expiry", "Hạn sử dụng của hoá chất", expiry));
  if (serial.length) items.push(item("unit", "Đơn vị tính của thiết bị", serial.filter((x) => !x.c?.unit)));
  if (lines.length) {
    items.push(item("variance", "Lý do nhận khác hoá đơn", numbered.filter(
      (x) => Number(x.l?.documentQuantity ?? 0) !== Number(x.l?.receivedQuantity ?? 0) && !filled(x.l?.varianceReason),
    )));
  }
  const dupAcross = crossLineDuplicates(lines);
  const badSerial = serial.filter((x) => serialError(x.l) || dupAcross.has(x.i));
  if (badSerial.length) items.push(item("serial", "Số serial", badSerial));
  const tooMany = serial.filter((x) => Number(x.l?.receivedQuantity ?? 0) > 999);
  if (tooMany.length) items.push({ ...item("capacity", "Quá 999 cái một dòng", tooMany), hint: `${hint(tooMany)}. Hãy tách sang phiếu khác` });
  for (const f of (config?.line ?? []).filter((f) => f.required && !f.stage)) {
    if (lines.length) items.push(item(`line:${f.key}`, f.label, numbered.filter((x) => !filled(x.l?.details?.[f.key]))));
  }

  const headRequired = (config?.sections ?? [])
    .filter((s) => !s.stage && !s.when)
    .flatMap((s) => s.fields)
    .filter((f) => f.required && !f.stage);
  for (const f of headRequired) {
    items.push({ key: `head:${f.key}`, label: f.label, ok: filled(values.details?.[f.key]), head: true, group: "handover", field: `details.${f.key}` });
  }
  return items;
}
