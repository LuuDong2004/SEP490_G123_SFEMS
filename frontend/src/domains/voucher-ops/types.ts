import type { EquipmentLine, VoucherBase, VoucherUsage } from "@/domains/voucher/types";

type Ref = { id: number; code?: string; name: string };

/** Các phiếu theo app Jmix cũ: sửa chữa, bảo hành, bảo dưỡng, xuất kho, lưu kho, hao mòn, tiêu hao, đặt phòng. */

export const REPAIR_TYPE_LABELS: Record<string, string> = {
  ON_SITE: "Sửa tại chỗ",
  SEND_OUT: "Gửi đi sửa",
  OUTSOURCED: "Thuê đơn vị ngoài",
};

/**
 * Bảo hành bên sửa cấp cho một tài sản — lần sửa xong gần nhất có ghi "Bảo hành sau sửa chữa"
 * (`GET /repair_orders/warranties`). Khác hạn bảo hành của hãng trên hồ sơ tài sản: hai nơi khác nhau để gọi.
 */
export type AfterRepairWarranty = {
  equipmentId: number;
  until: string;
  /** Hôm nay còn trong hạn — tính ở máy chủ, để trình duyệt khác múi giờ không nói khác. */
  active: boolean;
  orderId: number;
  orderCode: string | null;
  vendor: string | null;
};

/** Loại công việc của phiếu sửa chữa, bảo trì — phiếu bảo dưỡng cũ gộp vào đây (QLTB-506). */
export const REPAIR_WORK_KIND_LABELS: Record<string, string> = {
  REPAIR: "Sửa chữa",
  MAINTENANCE: "Bảo trì",
};

export const REPAIR_RESULT_LABELS: Record<string, string> = {
  REPAIRED: "Sửa được",
  UNREPAIRABLE: "Không sửa được",
};

export const WARRANTY_RESULT_LABELS: Record<string, string> = {
  REPAIRED: "Đã sửa",
  REPLACED: "Đổi thiết bị mới",
  REJECTED: "Từ chối bảo hành",
};

export const MAINTENANCE_RESULT_LABELS: Record<string, string> = {
  PASS: "Đạt",
  FAIL: "Không đạt",
  MONITOR: "Cần theo dõi",
};

export const DEPRECIATION_METHOD_LABELS: Record<string, string> = {
  STRAIGHT_LINE: "Đường thẳng",
  DECLINING_BALANCE: "Số dư giảm dần",
  UNITS_OF_OUTPUT: "Sản lượng",
};

export const BOOKING_MODE_LABELS: Record<string, string> = {
  THEO_TIET: "Theo tiết",
  THEO_BUOI: "Theo buổi",
};

export const SESSION_LABELS: Record<string, string> = {
  SANG: "Sáng",
  CHIEU: "Chiều",
  TOI: "Tối",
  CA_NGAY: "Cả ngày",
};

type SourceRef = { sourceResource: string | null; sourceId: number | null; sourceCode: string | null };

export type RepairOrder = VoucherBase & SourceRef & {
  workKind: "REPAIR" | "MAINTENANCE";
  plan: Ref | null;
  /** Kế hoạch lo cái gì: tài sản, cả phòng, hay khối nhà / hạng mục CSVC. */
  planTarget?: string | null;
  requestDate: string;
  repairType: string;
  vendor: string | null;
  damageDescription: string | null;
  startDate: string | null;
  completedDate: string | null;
  costEstimated: number | null;
  costActual: number | null;
  result: string | null;
  conditionAfter: string | null;
  resultNote: string | null;
  lines: (EquipmentLine & { statusBefore: string | null })[];
  lineCount: number;
};

export type WarrantyClaim = VoucherBase & SourceRef & {
  requestDate: string;
  vendor: string | null;
  reason: string | null;
  conditionBefore: string | null;
  expectedReturnDate: string | null;
  returnDate: string | null;
  cost: number | null;
  result: string | null;
  conditionAfter: string | null;
  resultNote: string | null;
  lines: (EquipmentLine & { statusBefore: string | null })[];
  lineCount: number;
};

export type MaintenanceOrder = VoucherBase & {
  maintenanceDate: string;
  plan: Ref | null;
  /** Kế hoạch lo cái gì: tài sản, cả phòng, hay khối nhà / hạng mục CSVC. */
  planTarget?: string | null;
  vendor: string | null;
  actualEndDate: string | null;
  costActual: number | null;
  resultStatus: string | null;
  conditionAfter: string | null;
  resultNote: string | null;
  lines: EquipmentLine[];
  lineCount: number;
};

export type DepreciationLine = EquipmentLine & {
  usefulLifeYears: number | null;
  originalValue: number;
  depreciationRate: number;
  accumulatedStart: number;
  depreciationAmount: number;
  accumulatedDepreciation: number;
  remainingValue: number;
};

export type DepreciationOrder = VoucherBase & {
  calculationDate: string;
  periodYear: number;
  method: string;
  lines: DepreciationLine[];
  lineCount: number;
  totalOriginalValue: number;
  totalDepreciationAmount: number;
  totalRemainingValue: number;
};

export type ConsumptionRecord = VoucherBase & {
  consumedDate: string;
  /** Null trên phiếu lịch sử lập trước khi chọn theo mã lô. */
  equipment: { id: number; code: string; name: string; room: Ref | null; quantity: number; unitName: string | null } | null;
  catalog: Ref;
  unitName: string | null;
  room: Ref | null;
  quantity: number;
};

export type RoomBooking = VoucherBase & VoucherUsage & {
  room: Ref;
  bookingDate: string;
  bookingMode: string;
  periodFrom: number | null;
  periodTo: number | null;
  session: string | null;
  startTime: string;
  endTime: string;
  requester: Ref | null;
  /** Tình trạng phòng lúc trả (QLTB-530); trống cho tới khi trả phòng. */
  roomCondition: RoomReturnCondition | null;
  roomConditionNote: string | null;
  returnedAt: string | null;
  lines: EquipmentLine[];
  lineCount: number;
};

export type RoomReturnCondition = "GOOD" | "ISSUE";

export const ROOM_RETURN_LABELS: Record<RoomReturnCondition, string> = {
  GOOD: "Bình thường",
  ISSUE: "Có vấn đề",
};
