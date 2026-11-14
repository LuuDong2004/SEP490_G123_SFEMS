/**
 * Điều chỉnh chuẩn thiết bị tối thiểu (changelog 154): Sở quy định thiết bị nào được điều chỉnh, trường đề nghị,
 * cơ quan quản lý của trường duyệt từng dòng. API: `/api/standard_adjustment_rules`, `/api/standard_adjustments`.
 */

export type AdjustMethod = "QUANTITY" | "SUBSTITUTE" | "CUSTOM";

export const METHOD_LABELS: Record<AdjustMethod, string> = {
  QUANTITY: "Tăng / giảm số lượng",
  SUBSTITUTE: "Thay bằng thiết bị khác",
  CUSTOM: "Thiết bị trường tự khai",
};

export type RuleSubstitute = { catalogId: number; code: string; name: string; unit: string | null; ratio: number };

export type AdjustRule = {
  catalogId: number;
  allowReduce: boolean;
  /** % chuẩn Bộ thấp nhất được giảm tới; 0 = được bỏ hẳn. */
  reduceFloor: number;
  allowSubstitute: boolean;
  substitutes: RuleSubstitute[];
  allowCustom: boolean;
  basis: string | null;
  updatedAt?: string | null;
};

export type RuleItem = {
  catalogId: number;
  code: string;
  name: string;
  subjectId: number | null;
  subjectName: string | null;
  unit: string | null;
  /** "6,7"; trống = mọi lớp. */
  gradeLevels: string | null;
  quantityText: string | null;
  optional: boolean;
  rule: AdjustRule | null;
};

export type LevelItems = { levelId: number; levelCode: string; levelName: string; schools: number; items: RuleItem[] };

export type AdjustmentStatus = "DRAFT" | "PENDING" | "DONE";

export const STATUS_LABELS: Record<AdjustmentStatus, string> = {
  DRAFT: "Nháp",
  PENDING: "Chờ duyệt",
  DONE: "Đã có kết quả",
};

export type AdjustmentLine = {
  id: number;
  catalogId: number;
  catalogCode: string;
  catalogName: string;
  subjectName: string | null;
  unit: string | null;
  method: AdjustMethod;
  quantity: number | null;
  substituteId: number | null;
  substituteCode: string | null;
  substituteName: string | null;
  substituteUnit: string | null;
  ratio: number | null;
  reason: string;
  /** Chuẩn Bộ (lúc trình; bản nháp thì tính lại). */
  baseRequired: number | null;
  current: number | null;
  substituteCount: number | null;
  adjustedRequired: number | null;
  adjustedCurrent: number | null;
  decision: "APPROVED" | "RETURNED" | null;
  decisionNote: string | null;
  /** Lý do lần trước bị trả lại, nếu dòng chép từ dòng bị trả lại. */
  returnedNote: string | null;
};

export type Adjustment = {
  id: number;
  schoolId: number;
  schoolCode: string;
  schoolName: string;
  bodyName: string | null;
  code: string | null;
  status: AdjustmentStatus;
  note: string | null;
  createdAt: string | null;
  submittedAt: string | null;
  submittedBy: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  lines: number;
  approved: number;
  returned: number;
  canEdit: boolean;
  canReview: boolean;
  items: AdjustmentLine[];
};

export type OverviewRow = {
  schoolId: number;
  schoolName: string;
  levelName: string;
  bodyName: string | null;
  /** Số thiết bị đang có điều chỉnh đã duyệt. */
  effective: number;
  latestId: number;
  latestCode: string | null;
  latestStatus: AdjustmentStatus;
  latestLines: number;
  percent: number;
  basePercent: number;
};

/** Một câu nói điều chỉnh là gì: "4 → 2", "Thay bằng Đàn organ (1 = 1)". */
export function describeLine(l: Pick<AdjustmentLine, "method" | "quantity" | "baseRequired" | "substituteName" | "ratio">) {
  if (l.method === "QUANTITY") return `Số phải có ${l.baseRequired ?? "?"} → ${l.quantity ?? "?"}`;
  const ratio = l.ratio == null ? "" : ` (1 = ${formatRatio(l.ratio)})`;
  return `${l.method === "CUSTOM" ? "Tự khai" : "Thay bằng"}: ${l.substituteName ?? "?"}${ratio}`;
}

export function formatRatio(r: number) {
  return Number(r).toLocaleString("vi-VN", { maximumFractionDigits: 2 });
}

/** Số thấp nhất được giảm tới — cùng phép `StandardAdjustmentService.minAllowed`. */
export function minAllowed(base: number, floorPercent: number) {
  return Math.ceil((base * floorPercent) / 100);
}
