import type { Details } from "@/domains/voucher/form-types";
import type { ApprovalStep, VoucherBase, VoucherStatus } from "@/domains/voucher/types";

/**
 * Một thiết bị đang được xin ở một đề xuất CÒN HIỆU LỰC khác của trường (`GET /purchase_proposals/overlaps`,
 * QLTB-495) — nháp, chờ duyệt, đã duyệt, hoặc đã vào kế hoạch mà hàng chưa về. `code` trống với nháp chưa trình.
 */
export type ProposalOverlap = {
  catalogId: number;
  proposalId: number;
  code: string | null;
  status: VoucherStatus;
  approvalStep: ApprovalStep | null;
  returned: boolean;
  quantity: number;
  unitName: string | null;
};

type Ref = { id: number; code?: string; name: string };

/** Đề xuất mua sắm: trường → lãnh đạo trường → cơ quan quản lý → vào kế hoạch. */
export type PurchaseLineKind = "NEW" | "REPLACE";

export const PURCHASE_LINE_KIND_LABELS: Record<PurchaseLineKind, string> = {
  NEW: "Mua mới",
  REPLACE: "Thay thế",
};

export const PRIORITY_LABELS: Record<number, string> = {
  1: "Cấp thiết",
  2: "Cần",
  3: "Nên có",
};

export type PurchaseLine = {
  details?: Details;
  id: number;
  lineNo: number;
  kind: PurchaseLineKind;
  catalog: Ref;
  trackingType: string;
  name: string;
  specification: string | null;
  unitName: string | null;
  quantity: number;
  unitPrice: number | null;
  amount: number | null;
  priority: number;
  currentQuantity: number | null;
  requiredQuantity: number | null;
  note: string | null;
};

export type PurchaseProposal = VoucherBase & {
  proposalDate: string;
  budgetYear: number | null;
  fundingSource: string | null;
  reason: string | null;
  plan: { id: number; title: string; status: ProcurementPlanStatus } | null;
  intakeId: number | null;
  totalAmount: number;
  totalQuantity: number;
  lines: PurchaseLine[];
  lineCount: number;
};

/** Kế hoạch mua sắm của UBND / Sở. */
export type ProcurementPlanStatus = "DRAFT" | "PENDING" | "APPROVED";

export const PLAN_STATUS_LABELS: Record<ProcurementPlanStatus, string> = {
  DRAFT: "Nháp",
  PENDING: "Chờ duyệt",
  APPROVED: "Đã duyệt",
};

export type ProposalRow = {
  id: number;
  code: string | null;
  school: Ref;
  status: string;
  budgetYear: number | null;
  reason: string | null;
  lineCount: number;
  totalQuantity: number;
  totalAmount: number;
};

export type CatalogTotal = {
  catalogId: number;
  catalogCode: string;
  catalogName: string;
  unitName: string | null;
  quantity: number;
  amount: number;
  schools: number;
};

/** Một dòng thiết bị của một đề xuất trong kế hoạch: số trường đề nghị và số đưa vào kế hoạch (0 = bỏ dòng). */
export type PlanLine = {
  lineId: number;
  proposalId: number;
  proposalCode: string | null;
  school: Ref;
  lineNo: number;
  catalog: { id: number; code: string; name: string };
  name: string;
  specification: string | null;
  unitName: string | null;
  requestedQuantity: number;
  plannedQuantity: number;
  unitPrice: number | null;
  amount: number;
  priority: number;
};

/** Đề xuất chờ vào kế hoạch, kèm các dòng thiết bị của nó. */
export type PlanCandidate = { proposal: ProposalRow; lines: PlanLine[] };

export type ProcurementPlan = {
  id: number;
  /** KHMS-<năm ngân sách>-<số>, máy cấp lúc lập. */
  code: string;
  managingBody: Ref;
  title: string;
  budgetYear: number;
  /** Năm học của kế hoạch — hiện "2026-2027"; năm ngân sách là năm kết thúc của nó. */
  schoolYear: { id: number; code?: string; name: string } | null;
  planDate: string;
  status: ProcurementPlanStatus;
  note: string | null;
  approvedAt: string | null;
  approvalNote: string | null;
  createdAt: string;
  updatedAt: string | null;
  createdBy: { id: number; code: string; name: string } | null;
  proposals: ProposalRow[] | null;
  lines: PlanLine[] | null;
  totals: CatalogTotal[] | null;
  totalAmount: number | null;
  proposalCount: number | null;
  details?: Details;
  _can?: { write?: boolean; delete?: boolean };
  _actions?: string[];
};

export type ProcurementSummary = {
  year: number | null;
  bodies: {
    bodyId: number | null;
    bodyName: string;
    schools: number;
    proposals: number;
    pending: number;
    approved: number;
    planned: number;
    amount: number;
    approvedAmount: number;
  }[];
  catalogs: CatalogTotal[];
  amount: number;
  approvedAmount: number;
};

/** Mức đáp ứng Danh mục thiết bị tối thiểu — một dòng là một thiết bị của phụ lục, ở một trường. */
export type NormRow = {
  normId: number;
  normCode: string;
  normName: string;
  catalogId: number | null;
  catalogCode: string | null;
  subjectId: number | null;
  subjectName: string | null;
  typeId: number | null;
  typeName: string | null;
  basis: string;
  /** Trống: phụ lục không ghi số — không tính tự động, không vào thống kê. */
  minQuantity: number | null;
  basisSize: number | null;
  quantityText: string | null;
  gradeLevels: string | null;
  /** Dòng tự chọn — hiện để biết, không vào thống kê đủ / thiếu. */
  optional: boolean;
  required: number | null;
  current: number;
  proposed: number;
  shortage: number | null;
  /** Phần có nhiều hơn số phải có. */
  surplus: number | null;
  warning: string | null;
  /** Số theo chuẩn Bộ (trước điều chỉnh); `required` / `current` ở trên đã tính theo điều chỉnh đã duyệt. */
  baseRequired: number | null;
  baseCurrent: number;
  /** Sở cho điều chỉnh thiết bị này ở cấp học của trường. */
  adjustable: boolean;
  /** Điều chỉnh đã duyệt đang có hiệu lực. */
  adjustment: NormAdjustment | null;
};

/** Điều chỉnh chuẩn đã duyệt của một thiết bị ở một trường. */
export type NormAdjustment = {
  lineId: number;
  method: "QUANTITY" | "SUBSTITUTE" | "CUSTOM";
  quantity: number | null;
  substituteId: number | null;
  substituteCode: string | null;
  substituteName: string | null;
  ratio: number | null;
  /** Số thiết bị thay thế dùng được, trước khi quy đổi. */
  substituteCount: number;
  reason: string;
  approvedAt: string | null;
};

export type SchoolAdequacy = {
  schoolId: number;
  schoolCode: string;
  schoolName: string;
  level: string | null;
  levelCode: string | null;
  district: string | null;
  classCount: number | null;
  studentCount: number | null;
  /** Số thiết bị (loại) của danh mục tối thiểu tính vào đủ / thiếu. */
  norms: number;
  met: number;
  unknown: number;
  /** Số thiết bị còn thiếu / đang thừa (đếm LOẠI) và tổng số đơn vị thiếu / thừa. */
  shortItems: number;
  shortageTotal: number;
  surplusItems: number;
  surplusTotal: number;
  hasEquipment: boolean;
  inputs: StandardInputs;
  rows: NormRow[];
  /** Số thiết bị đạt theo chuẩn Bộ, và số thiết bị đang có điều chỉnh. */
  baseMet: number;
  adjusted: number;
};

/** Dữ liệu nền của trường mà chuẩn được tính từ đó. */
export type StandardInputs = {
  classesDeclared: boolean;
  grades: { grade: number; classes: number; students: number; missingStudents: number }[];
  teachers: number;
  /** Mỗi môn của danh mục: số giáo viên dạy, số phòng bộ môn, số thiết bị tính theo giáo viên / theo phòng. */
  subjects: { subjectId: number; subjectName: string; teachers: number; rooms: number; perTeacher: number; perRoom: number }[];
};

export type SchoolStandardRow = {
  schoolId: number;
  schoolCode: string;
  schoolName: string;
  level: string | null;
  levelCode: string | null;
  district: string | null;
  norms: number;
  met: number;
  unknown: number;
  shortItems: number;
  shortageTotal: number;
  surplusItems: number;
  surplusTotal: number;
  hasEquipment: boolean;
  percent: number;
};

/** Cân đối một thiết bị trên địa bàn: thiếu, thừa và phần có thể điều chuyển. */
export type CatalogBalance = {
  catalogId: number;
  catalogCode: string | null;
  name: string;
  subjectName: string | null;
  level: string | null;
  shortage: number;
  shortSchools: number;
  surplus: number;
  surplusSchools: number;
  transferable: number;
};

export type CatalogSchool = {
  schoolId: number;
  schoolName: string;
  level: string | null;
  district: string | null;
  required: number | null;
  current: number;
  shortage: number;
  surplus: number;
};

export type AdequacySummary = {
  schools: number;
  withData: number;
  fullyMet: number;
  withShortage: number;
  missingSize: number;
  percent: number;
  shortageTotal: number;
  surplusTotal: number;
  transferable: number;
  subjects: { subjectName: string; shortage: number; surplus: number; schools: number }[];
  catalogs: CatalogBalance[];
  rows: SchoolStandardRow[];
};
