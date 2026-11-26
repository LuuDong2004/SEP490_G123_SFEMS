import type { Details } from "@/domains/voucher/form-types";
import type { EquipmentRef, VoucherBase } from "@/domains/voucher/types";

type Ref = { id: number; code: string | null; name: string };

/** Đợt kiểm kê do Sở / UBND phát động. */
export type InventoryCampaign = {
  id: number;
  managingBody: Ref;
  /** Năm học của đợt (306); đợt cũ chưa gán thì trống. */
  schoolYear: Ref | null;
  title: string;
  /** Số công văn phát động (307), không bắt buộc. */
  documentNo: string | null;
  cutoffDate: string;
  deadline: string;
  note: string | null;
  closed: boolean;
  overdue: boolean;
  createdAt: string;
  /** Duyệt đợt (308): nháp → chờ Lãnh đạo Sở duyệt → đã duyệt (phát động tới trường). */
  status: CampaignApproval;
  /** Lý do trả lại (đợt về nháp) hoặc ý kiến khi duyệt. */
  approvalNote: string | null;
  submittedAt: string | null;
  approvedAt: string | null;
  _can?: { write?: boolean; delete?: boolean; submit?: boolean; approve?: boolean };
};

export type CampaignApproval = "DRAFT" | "PENDING" | "APPROVED";

export const CAMPAIGN_APPROVAL_LABELS: Record<CampaignApproval, string> = {
  DRAFT: "Nháp",
  PENDING: "Chờ duyệt",
  APPROVED: "Đã duyệt",
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
  /** Phiếu bị từ chối mà trường chưa lập phiếu khác. */
  rejected: number;
  schools: CampaignProgressRow[];
};

/** Tình trạng của đợt, tính theo ngày: đợt đã phát động không đóng tay, hết ngày kết thúc là kết thúc. */
export type CampaignState = "upcoming" | "active" | "ended";

export const CAMPAIGN_STATE_LABELS: Record<CampaignState, string> = {
  upcoming: "Chưa hiệu lực",
  active: "Đang diễn ra",
  ended: "Đã kết thúc",
};

/** `today` dạng "yyyy-MM-dd" (ngày lịch, so sánh chuỗi được). */
export function campaignStateOf(c: { cutoffDate: string; deadline: string }, today: string): CampaignState {
  return today < c.cutoffDate ? "upcoming" : today > c.deadline ? "ended" : "active";
}

/**
 * Trường đang ở đâu trong đợt, suy từ phiếu kiểm kê của nó — cùng cách chia với máy chủ
 * (`InventoryCampaignService.progress`): nháp là đang kiểm, chờ duyệt, đã duyệt (duyệt xong), bị từ chối.
 */
export type CampaignStage = "done" | "pending" | "drafting" | "rejected" | "none";

export const CAMPAIGN_STAGE_LABELS: Record<CampaignStage, string> = {
  done: "Đã duyệt",
  pending: "Chờ duyệt",
  drafting: "Đang kiểm",
  rejected: "Bị từ chối",
  none: "Chưa bắt đầu",
};

export const campaignStageOf = (status?: string | null): CampaignStage =>
  !status ? "none"
    : status === "APPROVED" || status === "COMPLETED" ? "done"
      : status === "PENDING" ? "pending"
        : status === "REJECTED" ? "rejected"
          : "drafting";

/** `InventoryLine.Discrepancy` ở máy chủ. CONDITION: thấy nhưng tình trạng khác hệ thống. */
export type Discrepancy = "MISSING" | "WRONG_ROOM" | "CONDITION" | "SHORTAGE";

export const DISCREPANCY_LABELS: Record<Discrepancy, string> = {
  MISSING: "Thiếu",
  WRONG_ROOM: "Sai vị trí",
  CONDITION: "Sai tình trạng",
  SHORTAGE: "Thiếu số lượng",
};

/**
 * Duyệt biên bản làm gì với từng loại chênh lệch (KK-06): ghi thẳng vào hồ sơ thiết bị, chỉ thừa mới lập phiếu ghi tăng
 * nháp. Thiếu số lượng (hoá chất, vật tư theo lô) chỉ ghi trong biên bản.
 */
export const DISCREPANCY_OUTCOMES: Record<Exclude<Discrepancy, "SHORTAGE"> | "SURPLUS", string> = {
  MISSING: "ghi trạng thái Mất vào hồ sơ thiết bị",
  WRONG_ROOM: "chuyển thiết bị về phòng thực tế thấy (về kho thì Trong kho, về phòng khác thì Đang sử dụng)",
  CONDITION: "ghi tình trạng thực tế vào hồ sơ thiết bị",
  SURPLUS: "lập phiếu ghi tăng nháp (nguồn Kiểm kê thừa)",
};

export type InventoryLine = {
  details?: Details;
  id: number;
  lineNo: number;
  /** Trống khi hồ sơ thiết bị (đã Mất) bị xoá sau khi biên bản duyệt xong — mã, tên đọc từ `equipmentCode` / `equipmentName`. */
  equipment: EquipmentRef | null;
  /** Mã, tên thiết bị: của hồ sơ khi còn, không thì bản chụp lúc lập phiếu. Luôn có. */
  equipmentCode: string;
  equipmentName: string;
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
    wrongCondition: number;
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
  wrongCondition: number;
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
export const COUNT_HEADS = ["Theo hệ thống", "Đã kiểm", "Khớp", "Thiếu", "Sai vị trí", "Sai tình trạng"];

/** Cộng các nhóm thành một hàng tổng. */
export function sumCounts(rows: DiscrepancyCounts[]): DiscrepancyCounts {
  const total: DiscrepancyCounts = { id: null, name: "Cộng", storeroom: false, total: 0, checked: 0, matched: 0, missing: 0, wrongRoom: 0, wrongCondition: 0 };
  for (const r of rows) {
    total.total += r.total;
    total.checked += r.checked;
    total.matched += r.matched;
    total.missing += r.missing;
    total.wrongRoom += r.wrongRoom;
    total.wrongCondition += r.wrongCondition;
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
