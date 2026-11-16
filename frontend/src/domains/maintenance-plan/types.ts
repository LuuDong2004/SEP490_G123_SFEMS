/** Kế hoạch bảo trì: loại kế hoạch và trạng thái duyệt (205). */

/** Kế hoạch lo thiết bị, hay chính công trình — khối nhà, phòng / hạng mục CSVC. */
export type PlanTarget = "EQUIPMENT" | "FACILITY";

export const PLAN_TARGET_LABELS: Record<PlanTarget, string> = {
  EQUIPMENT: "Thiết bị",
  FACILITY: "Công trình",
};

/** Lãnh đạo trường duyệt kế hoạch do cán bộ lập; chưa duyệt thì không nhắc. */
export const PLAN_APPROVAL_LABELS: Record<string, string> = {
  PENDING: "Chờ duyệt",
  APPROVED: "Đã duyệt",
  RETURNED: "Trả lại",
};
