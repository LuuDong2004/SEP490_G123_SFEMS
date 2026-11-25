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

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
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
 * được lô sắp / đã hết hạn.
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
  for (const f of (config?.line ?? []).filter((f) => f.required)) {
    if (!filled(line.details?.[f.key])) out.push(`Thiếu ${f.label.toLowerCase()}`);
  }
  const serialProblem = serial ? serialError(line) : undefined;
  if (serialProblem) out.push(serialProblem);
  if (serial && Number(line.receivedQuantity ?? 0) > 9999) out.push("Quá 9.999 cái, hãy tách sang phiếu khác");
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
    /** Hoá đơn (chứng từ) của phiếu (254); dòng thuộc hoá đơn qua `docKey`. */
    documents?: any[];
  },
  catalogOf: CatalogOf,
  config: VoucherFormConfig | undefined,
  rule?: OriginRule,
  /** `noun`: tên chứng từ theo nguồn ("hoá đơn"…); `hasFile`: hoá đơn đã có tệp chưa (chỉ form biết). */
  opts?: { noun?: string | null; hasFile?: (doc: any, index: number) => boolean },
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
  // Chỉ "Kế hoạch mua sắm" phải đi từ kế hoạch — "Trường tự mua sắm" thì không (cùng `requirePlanLink`).
  if (rule?.code === PURCHASE_CODE) {
    // "Kế hoạch mua sắm" phải đi từ một đề xuất trong kế hoạch — cùng `requirePlanLink` ở máy chủ. Bấm mục này mở
    // ô Nguồn hình thành, dưới ô có nút chọn đề xuất.
    items.push({
      key: "planLink", label: "Chọn kế hoạch mua sắm", ok: values.source?.resource === "purchase_proposals",
      origin: true, group: "source", field: "originSource.id",
    });
  }
  // "Kiểm kê thừa" cũng phải đi từ một biên bản kiểm kê đã duyệt — cùng `requirePlanLink` ở máy chủ.
  if (rule?.code === "KIEM_KE_THUA") {
    items.push({
      key: "sessionLink", label: "Chọn biên bản kiểm kê", ok: values.source?.resource === "inventory_sessions",
      origin: true, group: "source", field: "originSource.id",
    });
  }
  const docs = (values.documents ?? []) as any[];
  const noun = cap(opts?.noun ?? "chứng từ");
  const centralized = rule?.code === PURCHASE_CODE && values.details?.centralized === true;
  if (centralized) {
    // Quyết định giao tài sản + biên bản bàn giao của cả phiếu (cùng `requireAssignment` máy chủ).
    const need: [string, string][] = [
      ["deliveringUnit", "đơn vị giao"], ["assignmentDecisionNo", "số"], ["assignmentDecisionDate", "ngày quyết định"], ["handoverDate", "ngày bàn giao"],
    ];
    const lack = need.filter(([k]) => !filled(values.details?.[k]));
    items.push({
      key: "assignment", label: lack.length ? `Quyết định giao: thiếu ${lack.map(([, l]) => l).join(", ")}` : "Quyết định giao tài sản",
      ok: lack.length === 0, group: "handover", field: `details.${(lack[0] ?? need[0])[0]}`,
    });
  }
  /** "Hoá đơn 1, 3" — một chứng từ thì chỉ "Hoá đơn". */
  const docTitle = (idx: number[]) => (docs.length > 1 ? `${noun} ${idx.map((i) => i + 1).join(", ")}` : noun);
  // Khối bên phải phải NGẮN (trưởng nhóm 14/11/2026, hai lần): chứng từ chưa có thiết bị thì chưa đòi ô nào của nó —
  // chỉ một mục "chưa có thiết bị" chung cho mọi chứng từ trống; các chứng từ thiếu CÙNG những ô thì gộp một mục.
  const docState = docs.map((d, i) => {
    // Form: dòng thuộc hoá đơn qua `docKey`; màn xem (bản ghi đã lưu): qua `documentId`.
    const own = numbered.filter((x) => (d?.key != null && x.l?.docKey === d.key) || (d?.id != null && x.l?.documentId === d.id));
    const checks: { label: string; ok: boolean; field: string; wrong?: boolean }[] = [];
    if (isPurchase(rule)) {
      checks.push({ label: "nhà cung cấp", ok: filled(String(d?.supplier ?? "").trim()), field: `documents.${i}.supplier` });
      // Cấp trên mua tập trung: số / ngày / tệp hoá đơn có thì ghi, không đòi (cùng `requirePurchaseDocuments`).
      if (!centralized) {
        checks.push({ label: "số", ok: filled(String(d?.documentNo ?? "").trim()), field: `documents.${i}.documentNo` });
        checks.push({ label: "ngày", ok: filled(d?.documentDate), field: `documents.${i}.documentDate` });
        if (opts?.hasFile) checks.push({ label: "tệp", ok: !!opts?.hasFile?.(d, i), field: `documents.${i}.files` });
      }
    }
    if (rule) {
      const issues = own.map((x) => fundingIssue(x.l, d?.fundingSource, rule)).filter(Boolean);
      const needFunding = rule.fundingRequired === "ALWAYS" || issues.includes("Thiếu nguồn kinh phí");
      if (issues.includes("Nguồn kinh phí không đi với nguồn hình thành") && filled(d?.fundingSource)) {
        checks.push({ label: "nguồn kinh phí không đi với nguồn hình thành", ok: false, wrong: true, field: `documents.${i}.fundingSource` });
      } else if (needFunding || filled(d?.fundingSource)) {
        checks.push({ label: "nguồn kinh phí", ok: filled(d?.fundingSource), field: `documents.${i}.fundingSource` });
      }
      if (d?.fundingSource === "OTHER") {
        checks.push({ label: "ghi rõ nguồn kinh phí", ok: filled(String(d?.fundingNote ?? "").trim()), field: `documents.${i}.fundingSource` });
      }
      if (rule.acquisitionMethod && d?.acquisitionMethod?.code === OTHER_ACQUISITION_CODE) {
        checks.push({ label: "ghi rõ hình thức mua sắm", ok: filled(String(d?.acquisitionNote ?? "").trim()), field: `documents.${i}.acquisitionMethod` });
      }
    }
    const missing = checks.filter((c) => !c.ok && !c.wrong).map((c) => c.label);
    const wrong = checks.filter((c) => c.wrong).map((c) => c.label);
    const parts = [missing.length ? `thiếu ${missing.join(", ")}` : null, ...wrong].filter(Boolean).join("; ");
    return { i, empty: own.length === 0, checked: checks.length > 0, parts, field: checks.find((c) => !c.ok)?.field ?? checks[0]?.field };
  });

  // Chưa có dòng nào: chỉ nói "thêm thiết bị" và các ô của chứng từ đầu — chưa nhắc các chứng từ trống còn lại.
  const relevant = docState.filter((s) => s.checked && (!s.empty || docs.length === 1 || (lines.length === 0 && s.i === 0)));
  const byParts = new Map<string, typeof relevant>();
  for (const s of relevant) byParts.set(s.parts, [...(byParts.get(s.parts) ?? []), s]);
  for (const [parts, group] of byParts) {
    const title = docTitle(group.map((s) => s.i));
    items.push({
      key: `doc${group[0].i}:doc`, label: parts ? `${title}: ${parts}` : title, ok: !parts, group: "lines",
      field: group[0].field,
    });
  }
  items.push({ key: "lines", label: "Thêm ít nhất một thiết bị", ok: lines.length > 0, group: "lines" });
  const emptyDocs = docState.filter((s) => s.empty);
  if (lines.length > 0 && docs.length > 1 && emptyDocs.length) {
    items.push({
      key: `doc${emptyDocs[0].i}:empty`, label: `${docTitle(emptyDocs.map((s) => s.i))}: chưa có thiết bị — thêm hoặc xoá`,
      ok: false, group: "lines", field: `documents.${emptyDocs[0].i}`,
    });
  }
  // Mục của từng dòng chỉ có khi đã có dòng — chưa có dòng thì "đã đủ" là sai.
  if (lines.length) items.push(item("catalog", "Thiết bị của từng dòng", numbered.filter((x) => !x.l?.catalog?.id)));
  if (isPurchase(rule) && lines.length) items.push(item("price", "Đơn giá lớn hơn 0", numbered.filter((x) => unpriced(x.l))));
  const expiry = numbered.filter((x) => missingChemicalExpiry(x.l, x.c));
  if (expiry.length) items.push(item("expiry", "Hạn sử dụng của hoá chất", expiry));
  if (serial.length) items.push(item("unit", "Đơn vị tính của thiết bị", serial.filter((x) => !x.c?.unit)));
  const dupAcross = crossLineDuplicates(lines);
  const badSerial = serial.filter((x) => serialError(x.l) || dupAcross.has(x.i));
  if (badSerial.length) items.push(item("serial", "Số serial", badSerial));
  const tooMany = serial.filter((x) => Number(x.l?.receivedQuantity ?? 0) > 9999);
  if (tooMany.length) items.push({ ...item("capacity", "Quá 9.999 cái một dòng", tooMany), hint: `${hint(tooMany)}. Hãy tách sang phiếu khác` });
  for (const f of (config?.line ?? []).filter((f) => f.required)) {
    if (lines.length) items.push(item(`line:${f.key}`, f.label, numbered.filter((x) => !filled(x.l?.details?.[f.key]))));
  }

  const headRequired = (config?.sections ?? [])
    .filter((s) => !s.when)
    .flatMap((s) => s.fields)
    .filter((f) => f.required);
  for (const f of headRequired) {
    items.push({ key: `head:${f.key}`, label: f.label, ok: filled(values.details?.[f.key]), head: true, group: "handover", field: `details.${f.key}` });
  }
  return items;
}
