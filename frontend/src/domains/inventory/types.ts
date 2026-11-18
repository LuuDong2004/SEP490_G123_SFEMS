import type { Details } from "@/domains/voucher/form-types";
import type { EquipmentRef, VoucherBase } from "@/domains/voucher/types";

type Ref = { id: number; code: string | null; name: string };

/** Đợt kiểm kê do Sở / UBND phát động. */
export type InventoryCampaign = {
  id: number;
  managingBody: Ref;
  title: string;
  cutoffDate: string;
  deadline: string;
  note: string | null;
  closed: boolean;
  overdue: boolean;
  createdAt: string;
  _can?: { write?: boolean; delete?: boolean };
};

export type CampaignProgressRow = {
  schoolId: number;
  schoolCode: string;
  schoolName: string;
  sessionId: number | null;
  sessionCode: string | null;
  status: string | null;
  /** Người xem mở được biên bản — Sở / UBND không đọc biên bản còn ở bàn hiệu trưởng. */
  canOpen: boolean;
  /** Hạng mục CSVC đã kiểm / tổng của biên bản. */
  facilityChecked?: number;
  facilityTotal?: number;
};

export type CampaignProgress = {
  total: number;
  notStarted: number;
  drafting: number;
  pending: number;
  completed: number;
  schools: CampaignProgressRow[];
};

export type Discrepancy = "MISSING" | "WRONG_ROOM" | "DAMAGED" | "SHORTAGE";

export const DISCREPANCY_LABELS: Record<Discrepancy, string> = {
  MISSING: "Thiếu",
  WRONG_ROOM: "Sai vị trí",
  DAMAGED: "Hỏng",
  SHORTAGE: "Thiếu số lượng",
};

/** Mỗi chênh lệch sinh ra phiếu gì khi biên bản được duyệt. */
/** Thiếu số lượng (hoá chất, vật tư theo lô) không sinh phiếu — xử lý tay theo biên bản. */
export const DISCREPANCY_OUTCOMES: Record<Exclude<Discrepancy, "SHORTAGE"> | "SURPLUS", string> = {
  MISSING: "Đề nghị ghi giảm do mất",
  WRONG_ROOM: "Phiếu điều chuyển nội bộ",
  DAMAGED: "Phiếu báo hỏng",
  SURPLUS: "Phiếu ghi tăng",
};

export type InventoryLine = {
  details?: Details;
  id: number;
  lineNo: number;
  equipment: EquipmentRef;
  expectedRoom: Ref | null;
  expectedCondition: string | null;
  found: boolean | null;
  foundRoom: Ref | null;
  foundCondition: string | null;
  discrepancies: Discrepancy[];
  /** Hoá chất, vật tư theo lô: số trên sổ lúc lập phiếu và số đếm được. */
  expectedQuantity?: number | null;
  countedQuantity?: number | null;
  note: string | null;
};

export type InventorySurplus = {
  id: number;
  lineNo: number;
  catalog: Ref;
  name: string;
  quantity: number;
  room: Ref | null;
  note: string | null;
};

export type InventorySession = VoucherBase & {
  campaign: Ref | null;
  title: string;
  inventoryDate: string;
  room: Ref | null;
  council: string | null;
  conclusion: string | null;
  summary: {
    total: number;
    checked: number;
    matched: number;
    missing: number;
    wrongRoom: number;
    damaged: number;
    surplus: number;
  };
  lines: InventoryLine[];
  surplus: InventorySurplus[];
  lineCount: number;
};

/** Số chênh lệch của một nhóm (phòng, môn học hoặc trường) — `InventoryDiscrepancies.Row` ở máy chủ. */
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

/** `GET /inventory_sessions/{id}/breakdown`. */
export type SessionBreakdown = { rooms: DiscrepancyCounts[]; subjects: DiscrepancyCounts[] };

/** `GET /inventory_campaigns/{id}/discrepancies` — `counts` trống khi người xem chưa mở được biên bản. */
export type CampaignDiscrepancyRow = {
  schoolId: number;
  schoolCode: string;
  schoolName: string;
  sessionId: number | null;
  sessionCode: string | null;
  status: string | null;
  counts: DiscrepancyCounts | null;
  surplus: number;
};

/** Tiêu đề các cột số của bảng chênh lệch. */
export const COUNT_HEADS = ["Theo hệ thống", "Đã kiểm", "Khớp", "Thiếu", "Sai vị trí", "Hỏng"];

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

/** Hạng mục CSVC của biên bản kiểm kê: khối nhà hoặc phòng / hạng mục, kết cấu và hiện trạng sổ → thực tế. */
export type InventoryFacilityLine = {
  id: number;
  roomId: number | null;
  buildingId: number | null;
  code: string;
  name: string;
  typeName: string;
  typeKind: string | null;
  buildingName: string | null;
  structureBefore: string | null;
  conditionBefore: string | null;
  structureFound: string | null;
  conditionFound: string | null;
  checked: boolean;
  note: string | null;
  appliedAt: string | null;
};

/** `GET /inventory_sessions/{id}/facility-lines`. `editable` — phiếu còn nháp; `applicable` — đã duyệt, còn dòng khác sổ chưa áp. */
export type InventoryFacilityLines = {
  lines: InventoryFacilityLine[];
  total: number;
  checked: number;
  changed: number;
  applied: number;
  editable: boolean;
  applicable: boolean;
};
