import type { Details } from "./form-types";

/**
 * Vòng đời chung của mọi loại phiếu: trạng thái, bước duyệt, nhật ký duyệt, tệp
 * đính kèm. Mỗi loại phiếu (ghi tăng, đề xuất mua sắm, kiểm kê) mang các trường này
 * cộng với phần riêng của nó.
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

export type ApprovalStep = "SCHOOL" | "MANAGING_BODY";

/** Bước chờ duyệt, nói theo người đọc: "chờ ... duyệt". */
export const APPROVAL_STEP_LABELS: Record<ApprovalStep, string> = {
  SCHOOL: "lãnh đạo trường",
  MANAGING_BODY: "cơ quan quản lý",
};

/** Các hành động server cho phép người đang xem làm trên phiếu (`_actions`). */
export type VoucherAction =
  | "edit"
  | "intake"
  | "submit"
  /** Đi kèm `submit` khi phiếu không qua cấp duyệt nào: bấm là xong — nút gọi là "Duyệt", không phải "Trình". */
  | "submit_direct"
  | "cancel"
  | "delete"
  | "approve"
  | "return"
  | "reject"
  | "complete"
  /** Kiểm kê: ghi kết quả kiểm đếm. */
  | "count";

/** Phần chung mọi phiếu trả về. */
export type VoucherBase = {
  id: number;
  code: string | null;
  school: { id: number; code: string; name: string };
  status: VoucherStatus;
  approvalStep: ApprovalStep | null;
  submittedAt: string | null;
  cancelReason: string | null;
  returnNote: string | null;
  rejectReason: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string | null;
  completedAt?: string | null;
  _can?: { write?: boolean; delete?: boolean };
  _actions?: VoucherAction[];
  /** Trường chứng từ theo app Jmix cũ — xem `form-types.ts`. */
  details?: Details;
  /** Chỉ có ở DANH SÁCH: tối đa 3 tài sản đầu của phiếu (mã, tên) — để danh sách nói phiếu về cái gì. */
  lineItems?: { code: string | null; name: string | null }[];
  lineCount?: number;
  /** Chỉ có ở DANH SÁCH, với tài khoản cả trường của trường nhiều cơ sở: các cơ sở phiếu chạm tới. */
  campuses?: { id: number; name: string; primary?: boolean; branch?: boolean }[];
};

export type VoucherEventAction = "SUBMIT" | "APPROVE" | "RETURN" | "REJECT" | "CANCEL" | "COMPLETE" | "DISPUTE";

export const VOUCHER_EVENT_LABELS: Record<VoucherEventAction, string> = {
  SUBMIT: "Trình duyệt",
  APPROVE: "Duyệt",
  RETURN: "Trả lại",
  REJECT: "Từ chối",
  CANCEL: "Huỷ phiếu",
  COMPLETE: "Hoàn tất",
  DISPUTE: "Báo nhận thiếu, trả về bổ sung",
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

/** "Chờ lãnh đạo trường duyệt", "Hoàn tất"... — một câu cho badge. */
export function voucherStatusText(status: VoucherStatus, step: ApprovalStep | null, returned?: boolean): string {
  if (status === "PENDING" && step) return `Chờ ${APPROVAL_STEP_LABELS[step]} duyệt`;
  // Phiếu bị người duyệt trả lại nằm ở trạng thái nháp để sửa được, nhưng với người lập nó KHÔNG phải
  // một phiếu nháp bình thường: có việc phải làm trước khi trình lại.
  if (status === "DRAFT" && returned) return "Bị trả về";
  return VOUCHER_STATUS_LABELS[status];
}

/** Tài sản trên một dòng phiếu (`EquipmentSummary` ở backend). */
export type EquipmentRef = {
  id: number;
  code: string;
  name: string;
  room: { id: number; code: string; name: string } | null;
  manager?: { id: number; code: string; name: string } | null;
  status: string;
  condition?: string | null;
  serialNumber?: string | null;
  catalog?: { id: number; code: string; name: string } | null;
  trackingType?: string | null;
  unitName?: string | null;
  /** Quy tắc đơn vị của lô: false thì số lượng chỉ được là số nguyên. */
  unitAllowsFraction?: boolean | null;
  unit?: { id: number; code?: string; name: string } | null;
  quantity?: number | null;
  /** Quy cách bao bì của lô (182): "Lọ" và lượng trong một lọ theo `unitName`. */
  originalValue?: number | null;
  productionYear?: number | null;
  usageStartYear?: number | null;
  warrantyExpiry?: string | null;
  fundingSource?: string | null;
  originSource?: string | null;
};

/** Một dòng phiếu trỏ tới tài sản — phần chung của mọi loại phiếu. */
export type EquipmentLine = {
  id: number;
  lineNo: number;
  equipment: EquipmentRef;
  quantity?: number | null;
  stockBefore?: number | null;
  note: string | null;
  details?: Details;
};

