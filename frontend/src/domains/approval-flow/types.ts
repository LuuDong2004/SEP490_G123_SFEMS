import type { ApprovalStep } from "@/domains/voucher/types";

/** Một loại phiếu trên màn cấu hình luồng phê duyệt (`GET /approval_flows`). */
export type ApprovalFlow = {
  resource: string;
  label: string;
  /** Phân hệ chứa loại phiếu — màn cấu hình gom theo đó. */
  module: string;
  defaultSteps: ApprovalStep[];
  /** Luồng đang áp dụng: đã cấu hình thì là cấu hình, chưa thì là mặc định. */
  steps: ApprovalStep[];
  /** Tên số tiền ngưỡng so với; `null` = loại phiếu này không đặt ngưỡng được. */
  amountLabel: string | null;
  amountThreshold: number | null;
  stepsAbove: ApprovalStep[] | null;
  customized: boolean;
  note: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
};

/** Các bước theo đúng thứ tự cấp — cũng là thứ tự máy chủ lưu. */
export const APPROVAL_STEP_ORDER: ApprovalStep[] = ["SCHOOL", "MANAGING_BODY"];

/** Tên bước trên màn cấu hình: nói CẤP nào duyệt, kèm ai là người của cấp đó. */
export const APPROVAL_STEP_TITLES: Record<ApprovalStep, { title: string; who: string }> = {
  SCHOOL: { title: "Trường duyệt", who: "Lãnh đạo trường của phiếu" },
  MANAGING_BODY: { title: "Cơ quan quản lý duyệt", who: "Sở GD&ĐT" },
};

/** Tên ngắn trên chip. */
export const APPROVAL_STEP_SHORT: Record<ApprovalStep, string> = {
  SCHOOL: "Trường",
  MANAGING_BODY: "Cơ quan quản lý",
};
