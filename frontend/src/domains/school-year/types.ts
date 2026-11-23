/**
 * Dữ liệu theo năm học (docs/du-lieu-theo-nam-hoc.md): phân công giáo viên, hồ sơ năm học theo điểm trường, bản chốt, chuẩn tối thiểu
 * theo năm học và điều chỉnh của trường.
 */

export type Ref = { id: number; code?: string | null; name: string };

export type SchoolYearOption = { id: number; code: string; name: string; startDate: string; endDate: string; current: boolean };

/** Một cán bộ trong một năm học (277). */
export type StaffAssignment = {
  id: number;
  schoolId: number;
  schoolYearId: number;
  staffId: number;
  staffCode: string;
  staffName: string;
  staffActive: boolean;
  campusId: number | null;
  campusName: string | null;
  mainSubject: Ref | null;
  subjects: Ref[];
  homeroomClasses: string[];
  note: string | null;
};

export type AssignmentCandidate = { id: number; code: string; name: string; campusId: number | null; mainSubject: Ref | null; subjects: Ref[] };

export type CopyResult = { fromYearId: number; fromYearName: string; copied: number; skipped: number };

/** Trạng thái hồ sơ năm học của một điểm trường / cả trường. */
export type ProfileStatus = "DRAFT" | "CONFIRMED" | "CLOSED" | "REOPENED";

export const PROFILE_STATUS_LABELS: Record<ProfileStatus, string> = {
  DRAFT: "Đang khai",
  CONFIRMED: "Đã xác nhận",
  CLOSED: "Đã chốt",
  REOPENED: "Mở lại",
};

/** Một việc còn thiếu của một điểm trường — phải trống mới xác nhận được. */
export type ProfileTodo = { part: "classes" | "teachers" | "rooms" | "equipment" | "adjustments"; text: string; count: number };

export type CampusProfile = {
  campusId: number | null;
  campusName: string;
  primary: boolean;
  status: "DRAFT" | "CONFIRMED";
  confirmedAt: string | null;
  confirmedBy: string | null;
  classes: number;
  students: number;
  teachers: number;
  assignedTeachers: number;
  rooms: number;
  equipment: number;
  equipmentNoRoom: number;
  pendingAdjustments: number;
  todos: ProfileTodo[];
};

export type ClosingInfo = {
  id: number;
  status: "CLOSED" | "REOPENED";
  closedAt: string;
  closedBy: string | null;
  reopenedAt: string | null;
  reopenedBy: string | null;
  reopenReason: string | null;
};

export type YearProfile = {
  schoolId: number;
  schoolName: string;
  schoolYearId: number;
  schoolYearName: string;
  current: boolean;
  status: ProfileStatus;
  closing: ClosingInfo | null;
  history: ClosingInfo[];
  campuses: CampusProfile[];
  canConfirm: boolean;
  canClose: boolean;
  canReopen: boolean;
  canWrite: boolean;
  /** Năm học kế tiếp chưa khởi tạo (chưa có lớp) — nút "Khởi tạo năm học …". */
  nextYear: { id: number; name: string } | null;
};

export type ProgressRow = {
  schoolId: number;
  schoolCode: string;
  schoolName: string;
  levelName: string | null;
  wardName: string | null;
  campuses: number;
  confirmed: number;
  status: ProfileStatus;
  closedAt: string | null;
  reopened: boolean;
  canReopen: boolean;
};

export type InitClasses = "PROMOTE" | "COPY" | "EMPTY";

export type InitResult = { schools: number; classes: number; assignments: number; adjustments: number; skippedAdjustments: number };

/** Kiểu điều chỉnh của trường trên một dòng (bước 3). `OUTSIDE` = nhu cầu ngoài thông tư trên dòng "Không được phép". */
export type SchoolAdjustKind = "REDUCE" | "SUBSTITUTE" | "SHARED" | "CHOOSE_IN_GROUP" | "OUTSIDE";

export const SCHOOL_ADJUST_LABELS: Record<SchoolAdjustKind, string> = {
  REDUCE: "Giảm",
  SUBSTITUTE: "Thay thế",
  SHARED: "Dùng chung",
  CHOOSE_IN_GROUP: "Chọn trong nhóm",
  OUTSIDE: "Ngoài thông tư",
};

export type AdjustmentStatus = "ACTIVE" | "PENDING_RECONFIRM" | "EXPIRED";

export type RowAdjustment = {
  id: number;
  kind: SchoolAdjustKind;
  status: AdjustmentStatus;
  reason: string;
  chosen: boolean | null;
  outsideNeed: number | null;
  substituteConfirmed: boolean;
  expiredReason: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
};

/** Một dòng so sánh (một thiết bị, ở một điểm trường hoặc cộng cả trường). */
export type YearRow = {
  catalogId: number | null;
  catalogCode: string | null;
  normId: number;
  normCode: string;
  name: string;
  subjectName: string | null;
  unitName: string | null;
  campusId: number | null;
  campusName: string | null;
  /** Sở cho điều chỉnh gì trên dòng. */
  allowedKind: "NONE" | "REDUCE" | "SUBSTITUTE" | "SHARED" | "CHOOSE_IN_GROUP";
  basisText: string | null;
  /** Điều chỉnh Sở cho, một câu ngắn ("Giảm còn 1/2 HS", "Thay bằng …"). */
  allowedText: string | null;
  requiredTt: number | null;
  requiredAdjusted: number | null;
  current: number;
  broken: number;
  lost: number;
  pendingDisposal: number;
  shortageTt: number | null;
  shortageAdjusted: number | null;
  surplus: number | null;
  outsideNeed: number | null;
  proposed: number;
  warning: string | null;
  adjustment: RowAdjustment | null;
};

export type YearStandard = {
  schoolId: number;
  schoolName: string;
  levelCode: string | null;
  schoolYearId: number;
  schoolYearName: string;
  current: boolean;
  /** LIVE = năm hiện tại tính trực tiếp, CLOSED = đọc bản chốt, RECOMPUTED = năm cũ chưa chốt tính lại. */
  source: "LIVE" | "CLOSED" | "RECOMPUTED";
  closedAt: string | null;
  campusId: number | null;
  campuses: { id: number | null; name: string }[];
  counted: number;
  metTt: number;
  metAdjusted: number;
  percentTt: number;
  percentAdjusted: number;
  shortageTt: number;
  shortageAdjusted: number;
  adjusted: number;
  outside: number;
  unhandled: number;
  canAdjust: boolean;
  rows: YearRow[];
};

export type YearOverviewRow = {
  schoolId: number;
  schoolName: string;
  levelName: string | null;
  status: ProfileStatus;
  percentTt: number;
  percentAdjusted: number;
  adjusted: number;
  outside: number;
  shortageTt: number;
  shortageAdjusted: number;
  hasEquipment: boolean;
};
