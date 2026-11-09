/**
 * Vòng đời chung của mọi loại phiếu: trạng thái, bước duyệt, nhật ký duyệt. Mỗi loại phiếu (đề xuất
 * mua sắm, phiếu nhập, phiếu kiểm kê) mang các trường này cộng với phần riêng của nó.
 *
 * Khớp với `VoucherHeader` ở backend (`module/school/voucher`).
 */

export type VoucherStatus = "DRAFT" | "PENDING" | "APPROVED" | "COMPLETED" | "REJECTED" | "CANCELLED";

export const VOUCHER_STATUS_LABELS: Record<VoucherStatus, string> = {
  DRAFT: "Nháp",
  PENDING: "Chờ duyệt",
  APPROVED: "Đã duyệt",
  COMPLETED: "Hoàn tất",
  REJECTED: "Bị từ chối",
  CANCELLED: "Đã huỷ",
};

export const VOUCHER_STATUS_OPTIONS = (Object.keys(VOUCHER_STATUS_LABELS) as VoucherStatus[]).map(
  (value) => ({ value, label: VOUCHER_STATUS_LABELS[value] }),
);

export type ApprovalStep = "SCHOOL" | "MANAGING_BODY";

/** Bước chờ duyệt, nói theo người đọc: "chờ ... duyệt". */
export const APPROVAL_STEP_LABELS: Record<ApprovalStep, string> = {
  SCHOOL: "lãnh đạo trường",
  MANAGING_BODY: "cơ quan quản lý",
};

/** Các hành động server cho phép người đang xem làm trên phiếu (`_actions`). */
export type VoucherAction =
  | "edit"
  | "submit"
  /** Đi kèm `submit` khi phiếu không qua cấp duyệt nào: bấm là xong — nút gọi là "Duyệt", không phải "Trình". */
  | "submit_direct"
  | "cancel"
  | "delete"
  | "approve"
  | "return"
  | "reject"
  | "complete";

/** Phần chung mọi phiếu trả về. */
export type VoucherBase = {
  id: number;
  code: string | null;
  school: { id: number; code: string; name: string };
  status: VoucherStatus;
  approvalStep: ApprovalStep | null;
  submittedAt: string | null;
  completedAt: string | null;
  cancelReason: string | null;
  returnNote: string | null;
  rejectReason: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string | null;
  _can?: { write?: boolean; delete?: boolean };
  _actions?: VoucherAction[];
};

export type VoucherEventAction = "SUBMIT" | "APPROVE" | "RETURN" | "REJECT" | "CANCEL" | "COMPLETE";

export const VOUCHER_EVENT_LABELS: Record<VoucherEventAction, string> = {
  SUBMIT: "Trình duyệt",
  APPROVE: "Duyệt",
  RETURN: "Trả lại",
  REJECT: "Từ chối",
  CANCEL: "Huỷ phiếu",
  COMPLETE: "Hoàn tất",
};

export type VoucherEvent = {
  id: number;
  action: VoucherEventAction;
  fromStatus: VoucherStatus | null;
  toStatus: VoucherStatus;
  step: ApprovalStep | null;
  note: string | null;
  actorId: number | null;
  actorName: string | null;
  createdAt: string;
};

/** "Chờ lãnh đạo trường duyệt", "Hoàn tất"... — một câu cho badge. */
export function voucherStatusText(status: VoucherStatus, step: ApprovalStep | null, returned?: boolean): string {
  if (status === "PENDING" && step) return `Chờ ${APPROVAL_STEP_LABELS[step]} duyệt`;
  // Phiếu bị người duyệt trả lại nằm ở trạng thái nháp để sửa được, nhưng với người lập nó KHÔNG phải
  // một phiếu nháp bình thường: có việc phải làm trước khi trình lại.
  if (status === "DRAFT" && returned) return "Bị trả về";
  return VOUCHER_STATUS_LABELS[status];
}

/** Một tệp đính kèm của bản ghi (`GET /attachments?resource=&recordId=`). */
export type AttachmentInfo = {
  id: number;
  resource: string;
  recordId: number;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  note: string | null;
  createdById: number | null;
  createdAt: string;
  /** Ảnh đại diện của bản ghi (mỗi bản ghi tối đa một). */
  cover?: boolean;
  /** Cách đóng khung vuông của ảnh đại diện: "x,y,zoom". */
  coverCrop?: string | null;
};
