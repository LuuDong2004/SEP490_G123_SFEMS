/**
 * Kiểm kê (KK-01 – KK-07). Khớp với phản hồi của `module/school/inventory` ở backend.
 */

import type { EquipmentCondition } from "@/domains/equipment/types";
import type { VoucherBase } from "@/domains/voucher/types";

/** Tham chiếu rút gọn (id, mã, tên). */
export type InventoryRef = {
  id: number;
  code: string;
  name: string;
};

/** Đợt kiểm kê do Sở phát động. */
export type InventoryCampaign = {
  id: number;
  managingBody: InventoryRef;
  title: string;
  /** Lặp lại `title` để ô chọn tham chiếu dùng chung đọc được. */
  name: string;
  /** Ngày chốt số liệu, dạng "2026-12-31". */
  cutoffDate: string;
  /** Hạn các trường nộp biên bản. */
  deadline: string;
  note: string | null;
  closed: boolean;
  /** Đợt còn mở mà đã quá hạn nộp. */
  overdue: boolean;
  createdAt: string;
  /** Người đang đăng nhập được sửa, xoá đợt này không. */
  _can?: { write?: boolean; delete?: boolean };
};

/** Loại chênh lệch của một dòng: mất, sai phòng, hỏng. Một dòng có thể vừa sai phòng vừa hỏng. */
export type Discrepancy = "MISSING" | "WRONG_ROOM" | "DAMAGED";

export const DISCREPANCY_LABELS: Record<Discrepancy, string> = {
  MISSING: "Thiếu",
  WRONG_ROOM: "Sai vị trí",
  DAMAGED: "Hỏng",
};

/** Số tóm tắt của một biên bản kiểm kê. */
export type InventorySummary = {
  total: number;
  checked: number;
  matched: number;
  missing: number;
  wrongRoom: number;
  damaged: number;
  surplus: number;
};

/** Số chênh lệch của một nhóm (phòng hoặc môn) — `GET /inventory_sessions/{id}/breakdown`. */
export type DiscrepancyCounts = {
  id: number | null;
  name: string | null;
  /** Nhóm theo phòng: phòng loại kho, hoặc tài sản chưa xếp phòng. */
  storeroom: boolean;
  total: number;
  checked: number;
  matched: number;
  missing: number;
  wrongRoom: number;
  damaged: number;
};

export type SessionBreakdown = { rooms: DiscrepancyCounts[]; subjects: DiscrepancyCounts[] };

/** Tiêu đề các cột số của bảng chênh lệch. */
export const COUNT_HEADS = ["Theo sổ", "Đã kiểm", "Khớp", "Thiếu", "Sai vị trí", "Hỏng"];

/** Cộng các nhóm thành một hàng tổng. */
export function sumCounts(rows: DiscrepancyCounts[]): DiscrepancyCounts {
  const total: DiscrepancyCounts = { id: null, name: "Cộng", storeroom: false, total: 0, checked: 0, matched: 0, missing: 0, wrongRoom: 0, damaged: 0 };
  for (const r of rows) {
    total.total += r.total;
    total.checked += r.checked;
    total.matched += r.matched;
    total.missing += r.missing;
    total.wrongRoom += r.wrongRoom;
    total.damaged += r.damaged;
  }
  return total;
}

/** Một tài sản trên sổ: sổ ghi ở đâu, tình trạng gì; tổ kiểm kê thấy gì. */
export type InventoryLine = {
  id: number;
  lineNo: number;
  equipment: InventoryRef;
  catalog: InventoryRef | null;
  expectedRoom: InventoryRef | null;
  expectedCondition: EquipmentCondition | null;
  found: boolean | null;
  foundRoom: InventoryRef | null;
  foundCondition: EquipmentCondition | null;
  discrepancies: Discrepancy[];
  note: string | null;
};

/** Tài sản thấy khi kiểm kê mà sổ không có. */
export type InventorySurplus = {
  id: number;
  lineNo: number;
  catalog: InventoryRef;
  name: string;
  quantity: number;
  room: InventoryRef | null;
  note: string | null;
};

/** Phiếu kiểm kê (cũng là biên bản kiểm kê) của một trường. */
export type InventorySession = VoucherBase & {
  campaign: { id: number; code: string | null; name: string } | null;
  title: string;
  inventoryDate: string;
  /** Kiểm kê một phòng; trống là cả trường. */
  room: InventoryRef | null;
  council: string | null;
  conclusion: string | null;
  summary: InventorySummary;
  /** Danh sách không trả dòng (mảng rỗng); màn chi tiết trả đủ. */
  lines: InventoryLine[];
  surplus: InventorySurplus[];
  lineCount: number;
};
