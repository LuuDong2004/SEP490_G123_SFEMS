
import { todayLocal } from "@/shared/lib/format";

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Một hoá đơn (chứng từ) trên form (254). `key` chỉ có trên form — dòng chỉ tới hoá đơn của nó bằng `docKey`. */
export type DocumentForm = {
  id?: number | null;
  key: string;
  supplier: string;
  taxCode: string;
  contact: string;
  documentNo: string;
  documentDate: string | null;
  fundingSource: string | null;
  fundingNote: string;
  acquisitionMethod: { id: number | null; code?: string | null; name?: string | null };
  acquisitionNote: string;
  /** Chỉ trên form: tệp chọn khi hoá đơn chưa lưu — tải lên ngay sau khi lưu phiếu. */
  pendingFiles: File[];
};

let seq = 0;
/** Hoá đơn trống. */
export function newDocument(over: Partial<DocumentForm> = {}): DocumentForm {
  seq += 1;
  return {
    id: null, key: `n${Date.now().toString(36)}${seq}`, supplier: "", taxCode: "", contact: "", documentNo: "", documentDate: null,
    fundingSource: null, fundingNote: "", acquisitionMethod: { id: null }, acquisitionNote: "", pendingFiles: [], ...over,
  };
}

/**
 * Các ô THÔNG TIN CHUNG của phiếu nhập.
 *
 * <p>Chứng từ đi theo HOÁ ĐƠN (254, trưởng nhóm 14/11/2026): mỗi hoá đơn có nhà cung cấp, mã số thuế, số, ngày, nguồn kinh
 * phí, hình thức mua sắm và tệp; thiết bị nằm dưới hoá đơn của nó (`docKey`). Máy chủ chép chứng từ của hoá đơn xuống
 * từng dòng khi lưu.
 */
export const INTAKE_DEFAULT_VALUES = {
  school: { id: null },
  // Getter: tính lúc form mount (khi `defaults` được trải ra), không chốt lúc tải trang.
  get intakeDate() {
    return todayLocal();
  },
  documentNo: "",
  documentDate: null,
  supplier: "",
  fundingSource: null,
  /** Phần ghi rõ của nguồn kinh phí "Nguồn khác" ở đầu phiếu — chỉ trên form, chép xuống các dòng theo phiếu. */
  fundingNoteHead: "",
  originSource: { id: null },
  originNote: "",
  schoolYear: { id: null },
  acquisitionMethod: { id: null },
  /** Phần ghi rõ của hình thức "Khác" ở đầu phiếu — chỉ trên form, chép xuống các dòng theo phiếu. */
  acquisitionNoteHead: "",
  warrantyMonths: null,
  note: "",
  details: {},
  lines: [] as unknown[],
  // Getter: mỗi form mới một hoá đơn trống với khoá riêng.
  get documents(): DocumentForm[] {
    return [newDocument()];
  },
};

export type IntakeFormValues = typeof INTAKE_DEFAULT_VALUES;

/** Khoá chứng từ của một dòng — trống là theo đầu phiếu. */
const LINE_DOCUMENT_KEYS = ["supplier", "documentNo", "documentDate", "fundingSource", "fundingNote", "acquisitionMethod", "acquisitionNote"] as const;

/** Chỉ có trên form, không gửi lên máy chủ. */
const FORM_ONLY_LINE_KEYS = ["ownDocuments", "differs", "serialText", "unitRooms", "units", "fromExcel", "pendingFiles", "docKey"] as const;

/** Thông tin của TỪNG cái (256): model, hãng, bảo hành, thông tin khác — vắng ô nào thì theo ô cùng tên của dòng. */
export type UnitInfo = { model?: string | null; manufacturer?: string | null; warrantyMonths?: number | null; otherInfo?: string | null };
export const UNIT_KEYS = ["model", "manufacturer", "warrantyMonths", "otherInfo"] as const;
/** Giá trị ô `key` của cái thứ i: của riêng nó nếu đã có, không thì của dòng. */
export const unitValue = (line: any, i: number, key: (typeof UNIT_KEYS)[number]) => {
  const own = (line?.units as UnitInfo[] | undefined)?.[i];
  return own && own[key] !== undefined ? own[key] : (line?.[key] ?? null);
};

/** "SN 001\nsn-002" → ["SN001", "SN-002"]: mỗi dòng một số, bỏ khoảng trắng, viết hoa, bỏ dòng trống. */
export function parseSerials(text: unknown): string[] {
  // Theo VỊ TRÍ (máy thứ i ↔ phần tử thứ i): ô trống giữ chỗ, chỉ bỏ phần trống ở cuối.
  const list = String(text ?? "")
    .split(/\r?\n/)
    .map((s) => s.replace(/\s+/g, "").toUpperCase());
  while (list.length && !list[list.length - 1]) list.pop();
  return list;
}

/**
 * Giá trị form → payload gửi máy chủ:
 * - dòng theo phiếu (không "Hoá đơn riêng") gửi chứng từ TRỐNG — máy chủ đọc theo đầu phiếu; phần ghi rõ của nguồn
 *   kinh phí / hình thức mua sắm "Khác" ở đầu phiếu được chép xuống các dòng đó (máy chủ giữ ghi rõ theo dòng);
 * - số serial gõ trong ô nhiều dòng thành danh sách;
 * - các khoá chỉ có trên form được bỏ đi.
 */
export function toPayload(values: any) {
  const { fundingNoteHead: _fn, acquisitionNoteHead: _an, supplier: _s, documentNo: _d, documentDate: _dd, fundingSource: _f, acquisitionMethod: _a, ...head } = values ?? {};
  void _fn; void _an; void _s; void _d; void _dd; void _f; void _a;
  const docs = ((values?.documents ?? []) as DocumentForm[]);
  const docIndex = new Map(docs.map((d, i) => [d.key, i]));
  // Dòng xếp theo hoá đơn (thứ tự hoá đơn, rồi thứ tự trên form) — số dòng và mã tài sản đi theo thứ tự này.
  const ordered = ((values?.lines ?? []) as any[])
    .map((l, i) => ({ l, i, d: docIndex.get(l?.docKey) ?? 0 }))
    .sort((a, b) => a.d - b.d || a.i - b.i);
  const documents = docs.map((d) => ({
    id: d.id ?? null,
    supplier: String(d.supplier ?? "").trim() || null,
    taxCode: String(d.taxCode ?? "").trim() || null,
    contact: String(d.contact ?? "").trim() || null,
    documentNo: String(d.documentNo ?? "").trim() || null,
    documentDate: d.documentDate || null,
    fundingSource: d.fundingSource || null,
    fundingNote: String(d.fundingNote ?? "").trim() || null,
    acquisitionMethod: d.acquisitionMethod?.id ? { id: d.acquisitionMethod.id } : null,
    acquisitionNote: String(d.acquisitionNote ?? "").trim() || null,
  }));
  const lines = ordered.map(({ l, d }) => {
    const out: any = { ...l };
    // Chứng từ của dòng là của hoá đơn nó thuộc — máy chủ chép xuống khi lưu.
    for (const k of LINE_DOCUMENT_KEYS) out[k] = null;
    out.documentIndex = d;
    out.serialNumbers = parseSerials(l?.serialText);
    // Phòng riêng của từng cái theo vị trí (255); null = theo phòng nhận của dòng.
    out.unitRoomIds = ((l?.unitRooms ?? []) as (number | null)[]).map((x) => (x == null ? null : Number(x)));
    // Từng cái: gửi đủ theo vị trí; ô nào mọi cái giống nhau thì đó cũng là giá trị của dòng (tóm tắt, phiếu cũ).
    if ((l?.units ?? []).length) {
      const n = Number(l?.receivedQuantity ?? 0);
      const col = (key: (typeof UNIT_KEYS)[number]) => Array.from({ length: n }, (_, i) => {
        const v = unitValue(l, i, key);
        return v === "" ? null : v;
      });
      const common = (list: unknown[]) => (list.length && list.every((v) => v === list[0]) ? list[0] : null);
      const models = col("model"), makers = col("manufacturer"), warranties = col("warrantyMonths"), others = col("otherInfo");
      out.unitModels = models; out.unitManufacturers = makers; out.unitWarrantyMonths = warranties; out.unitOtherInfos = others;
      out.model = common(models); out.manufacturer = common(makers); out.warrantyMonths = common(warranties); out.otherInfo = common(others);
    }
    if (!l?.differs) {
      out.documentQuantity = l?.receivedQuantity;
      out.varianceReason = null;
    }
    // Không quy đổi bao bì nữa: lưu lại một phiếu cũ thì gỡ quy cách đã khai.
    out.packUnit = null;
    out.packSize = null;
    if (!out.room?.id) out.room = null;
    for (const k of FORM_ONLY_LINE_KEYS) delete out[k];
    return out;
  });
  return { ...head, documents, lines };
}

/** Chứng từ "thật" của một dòng: của dòng nếu có, không thì của đầu phiếu. */
function effectiveDocument(line: any, head: any) {
  return {
    supplier: line?.supplier ?? head?.supplier ?? null,
    documentNo: line?.documentNo ?? head?.documentNo ?? null,
    documentDate: line?.documentDate ?? head?.documentDate ?? null,
    fundingSource: line?.fundingSource ?? head?.fundingSource ?? null,
    fundingNote: line?.fundingNote ?? null,
    acquisitionMethod: line?.acquisitionMethod?.id ? line.acquisitionMethod : (head?.acquisitionMethod?.id ? head.acquisitionMethod : null),
    acquisitionNote: line?.acquisitionNote ?? null,
  };
}

const sameDocument = (a: any, b: any) =>
  (a.supplier ?? "") === (b.supplier ?? "")
  && (a.documentNo ?? "") === (b.documentNo ?? "")
  && (a.documentDate ?? "") === (b.documentDate ?? "")
  && (a.fundingSource ?? "") === (b.fundingSource ?? "")
  && (a.fundingNote ?? "") === (b.fundingNote ?? "")
  && (a.acquisitionMethod?.id ?? null) === (b.acquisitionMethod?.id ?? null)
  && (a.acquisitionNote ?? "") === (b.acquisitionNote ?? "");

/**
 * Bản ghi đã lưu → giá trị form của màn SỬA. Hoá đơn lấy từ `documents` (254); phiếu chưa có (lập từ đề xuất mua sắm,
 * biên bản kiểm kê) thì gom các dòng theo chứng từ THẬT của dòng — mỗi bộ chứng từ khác nhau thành một hoá đơn.
 */
export function toFormValues(record: any) {
  const head = record ?? {};
  const raw = (head.lines ?? []) as any[];
  let documents: DocumentForm[];
  let keyOf: (l: any, i: number) => string;
  if ((head.documents ?? []).length) {
    documents = (head.documents as any[]).map((d) => newDocument({
      id: d.id, key: `d${d.id}`, supplier: d.supplier ?? "", taxCode: d.taxCode ?? "", contact: d.contact ?? "", documentNo: d.documentNo ?? "",
      documentDate: d.documentDate ?? null, fundingSource: d.fundingSource ?? null, fundingNote: d.fundingNote ?? "",
      acquisitionMethod: d.acquisitionMethod?.id ? d.acquisitionMethod : { id: null }, acquisitionNote: d.acquisitionNote ?? "",
    }));
    const first = documents[0].key;
    keyOf = (l) => (l.documentId ? `d${l.documentId}` : first);
  } else {
    const effs = raw.map((l) => effectiveDocument(l, head));
    const groups: { doc: ReturnType<typeof effectiveDocument>; key: string }[] = [];
    const lineKeys = effs.map((e) => {
      let g = groups.find((x) => sameDocument(x.doc, e));
      // Khoá CỐ ĐỊNH theo thứ tự nhóm: hàm này chạy lại mỗi lần truy vấn \`select\`; khoá ngẫu nhiên làm dữ liệu "khác" mỗi
      // lần → form bị reset liên tục (vòng lặp vẽ lại ở phiếu lập từ kế hoạch mua sắm).
      if (!g) {
        g = { doc: e, key: `g${groups.length + 1}` };
        groups.push(g);
      }
      return g.key;
    });
    if (!groups.length) groups.push({ doc: effectiveDocument({}, head), key: "g1" });
    documents = groups.map(({ doc, key }) => newDocument({
      key, supplier: doc.supplier ?? "", documentNo: doc.documentNo ?? "", documentDate: doc.documentDate ?? null,
      fundingSource: doc.fundingSource ?? null, fundingNote: doc.fundingNote ?? "",
      acquisitionMethod: doc.acquisitionMethod ?? { id: null }, acquisitionNote: doc.acquisitionNote ?? "",
    }));
    keyOf = (_l, i) => lineKeys[i] ?? groups[0].key;
  }
  const lines = raw.map((l, i) => ({
    ...l,
    warrantyMonths: l.warrantyMonths ?? head.warrantyMonths ?? null,
    room: l.room ?? { id: null },
    differs: false,
    serialText: ((l.serialNumbers ?? []) as string[]).join("\n"),
    unitRooms: ((l.unitRoomIds ?? []) as (number | null)[]),
    units: [l.unitModels, l.unitManufacturers, l.unitWarrantyMonths, l.unitOtherInfos].some((x) => (x ?? []).length)
      ? Array.from({ length: Number(l.receivedQuantity ?? 0) }, (_, k) => ({
        model: l.unitModels?.[k] || l.model || null,
        manufacturer: l.unitManufacturers?.[k] || l.manufacturer || null,
        warrantyMonths: l.unitWarrantyMonths?.[k] ?? l.warrantyMonths ?? head.warrantyMonths ?? null,
        otherInfo: l.unitOtherInfos?.[k] || l.otherInfo || null,
      }))
      : [],
    docKey: keyOf(l, i),
    supplier: null, documentNo: null, documentDate: null, fundingSource: null, fundingNote: null, acquisitionMethod: { id: null }, acquisitionNote: null,
  }));
  return {
    ...record,
    originSource: head.originSource ?? { id: null },
    originNote: head.originNote ?? "",
    details: head.details ?? {},
    documents,
    lines,
  };
}
