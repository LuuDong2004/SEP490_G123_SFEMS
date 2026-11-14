
import { todayLocal } from "@/shared/lib/format";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Các ô THÔNG TIN CHUNG của phiếu nhập.
 *
 * <p>Chứng từ (nhà cung cấp, số / ngày hoá đơn, nguồn kinh phí, hình thức mua sắm) khai MỘT LẦN ở đầu phiếu và áp
 * cho mọi dòng — máy chủ đọc dòng theo đầu phiếu khi dòng để trống (`EquipmentIntakeLine.effective*`). Dòng nào có
 * hoá đơn riêng thì bật "Hoá đơn riêng" trong chi tiết dòng.
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
};

export type IntakeFormValues = typeof INTAKE_DEFAULT_VALUES;

/** Khoá chứng từ của một dòng — trống là theo đầu phiếu. */
const LINE_DOCUMENT_KEYS = ["supplier", "documentNo", "documentDate", "fundingSource", "fundingNote", "acquisitionMethod", "acquisitionNote"] as const;

/** Chỉ có trên form, không gửi lên máy chủ. */
const FORM_ONLY_LINE_KEYS = ["ownDocuments", "differs", "serialText"] as const;

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
  const { fundingNoteHead, acquisitionNoteHead, ...head } = values ?? {};
  const lines = ((values?.lines ?? []) as any[]).map((l) => {
    const out: any = { ...l };
    if (!l?.ownDocuments) {
      for (const k of LINE_DOCUMENT_KEYS) out[k] = null;
      out.fundingNote = fundingNoteHead ? String(fundingNoteHead).trim() || null : null;
      out.acquisitionNote = acquisitionNoteHead ? String(acquisitionNoteHead).trim() || null : null;
    } else if (!l?.acquisitionMethod?.id) {
      out.acquisitionMethod = null;
    }
    out.serialNumbers = parseSerials(l?.serialText);
    if (!l?.differs) {
      out.documentQuantity = l?.receivedQuantity;
      out.varianceReason = null;
    }
    if (!out.packUnit?.id) out.packUnit = null;
    if (!out.room?.id) out.room = null;
    for (const k of FORM_ONLY_LINE_KEYS) delete out[k];
    return out;
  });
  return {
    ...head,
    // PATCH: null là "để nguyên" — chuỗi rỗng mới xoá được ô chữ ở đầu phiếu.
    supplier: head.supplier ?? "",
    documentNo: head.documentNo ?? "",
    lines,
  };
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
 * Bản ghi đã lưu → giá trị form của màn SỬA. Chứng từ được đưa LÊN đầu phiếu:
 *
 * - mọi dòng cùng một chứng từ (kể cả phiếu cũ đã chép chứng từ xuống từng dòng): chứng từ đó thành của đầu phiếu, các
 *   dòng để trống (theo phiếu);
 * - các dòng KHÁC nhau thật (phiếu cũ gom nhiều hoá đơn): đầu phiếu giữ chứng từ của phiếu (trống thì lấy của dòng
 *   đầu), dòng nào khác đầu phiếu thì bật "Hoá đơn riêng" và giữ nguyên chứng từ của nó — không mất dữ liệu.
 */
export function toFormValues(record: any) {
  const head = record ?? {};
  const raw = (head.lines ?? []) as any[];
  const docs = raw.map((l) => effectiveDocument(l, head));
  // Chứng từ của đầu phiếu = chứng từ (thật) mà NHIỀU dòng mang nhất — mọi dòng giống nhau thì chính là nó; hoà
  // thì lấy của dòng trên. Chưa có dòng thì giữ của đầu phiếu.
  const headDoc = docs.length
    ? docs.reduce((best, d) => (docs.filter((x) => sameDocument(x, d)).length > docs.filter((x) => sameDocument(x, best)).length ? d : best), docs[0])
    : effectiveDocument({}, head);
  // Ghi rõ của nguồn kinh phí / hình thức mua sắm ở đầu phiếu: đọc ngược từ dòng theo phiếu.
  const firstSame = docs.find((d) => sameDocument({ ...d, fundingNote: null, acquisitionNote: null }, { ...headDoc, fundingNote: null, acquisitionNote: null }));
  const headWithNotes = { ...headDoc, fundingNote: firstSame?.fundingNote ?? null, acquisitionNote: firstSame?.acquisitionNote ?? null };
  const lines = raw.map((l, i) => {
    const own = !sameDocument(docs[i], headWithNotes);
    const base = {
      ...l,
      warrantyMonths: l.warrantyMonths ?? head.warrantyMonths ?? null,
      packUnit: l.packUnit ?? { id: null },
      room: l.room ?? { id: null },
      differs: Number(l.documentQuantity ?? 0) !== Number(l.receivedQuantity ?? 0),
      serialText: ((l.serialNumbers ?? []) as string[]).join("\n"),
      ownDocuments: own,
    };
    return own
      ? { ...base, ...docs[i], acquisitionMethod: docs[i].acquisitionMethod ?? { id: null } }
      : { ...base, supplier: null, documentNo: null, documentDate: null, fundingSource: null, fundingNote: null, acquisitionMethod: { id: null }, acquisitionNote: null };
  });
  return {
    ...record,
    supplier: headDoc.supplier ?? "",
    documentNo: headDoc.documentNo ?? "",
    documentDate: headDoc.documentDate ?? null,
    fundingSource: headDoc.fundingSource ?? null,
    fundingNoteHead: headWithNotes.fundingNote ?? "",
    acquisitionMethod: headDoc.acquisitionMethod ?? { id: null },
    acquisitionNoteHead: headWithNotes.acquisitionNote ?? "",
    originSource: head.originSource ?? { id: null },
    originNote: head.originNote ?? "",
    details: head.details ?? {},
    lines,
  };
}
