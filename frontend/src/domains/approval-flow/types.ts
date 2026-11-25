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
  /** `false`: luồng cố định theo nghiệp vụ (đề xuất mua sắm: trường rồi Sở), chỉ xem, không sửa được. */
  configurable: boolean;
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
  MANAGING_BODY: { title: "Sở duyệt", who: "Lãnh đạo Sở GD&ĐT" },
};

/** Tên ngắn trên chip. */
export const APPROVAL_STEP_SHORT: Record<ApprovalStep, string> = {
  SCHOOL: "Trường",
  MANAGING_BODY: "Sở",
};
