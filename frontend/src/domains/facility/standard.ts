/** Chuẩn CSVC (203): quy tắc theo loại × cấp × mức, và kết quả chấm một trường. */

export type StandardTier = "MIN" | "LEVEL1" | "LEVEL2";

export const STANDARD_TIERS: { key: StandardTier; label: string; short: string }[] = [
  { key: "MIN", label: "Tiêu chuẩn tối thiểu", short: "Tối thiểu" },
  { key: "LEVEL1", label: "Tiêu chuẩn mức độ 1", short: "Mức độ 1" },
  { key: "LEVEL2", label: "Tiêu chuẩn mức độ 2", short: "Mức độ 2" },
];

export const STANDARD_TIER_LABELS: Record<StandardTier, string> = {
  MIN: "Tối thiểu",
  LEVEL1: "Mức độ 1",
  LEVEL2: "Mức độ 2",
};

/** PASS đạt · FAIL chưa đạt · NONE chưa có quy tắc. */
export type StandardStatus = "PASS" | "FAIL" | "NONE";

export const STANDARD_STATUS_LABELS: Record<StandardStatus, string> = {
  PASS: "Đạt",
  FAIL: "Chưa đạt",
  NONE: "Chưa có chuẩn",
};

/** Một quy tắc như API `/api/facility_standard_rules` trả. */
export type FacilityStandardRule = {
  id: number;
  code: string;
  name: string;
  active: boolean;
  note: string | null;
  roomType: { id: number; code: string; name: string; groupName: string | null } | null;
  levelCode: "TH" | "THCS" | "THPT";
  tier: StandardTier;
  minCount: number | null;
  countPerClass: number | null;
  minRoomArea: number | null;
  areaPerStudent: number | null;
  minTotalArea: number | null;
  /** Trường lớn hơn N lớp thì tối thiểu `largeMinCount` phòng (291). */
  largeClassFrom: number | null;
  largeMinCount: number | null;
  /** Diện tích theo học sinh chỉ tính trên bao nhiêu % học sinh (thư viện: 30%). Trống = mọi học sinh. */
  studentPercent: number | null;
  /** Chỉ xét khi trường có loại phòng này. */
  onlyIfPresent: boolean;
  /** Đếm chung mọi phòng học bộ môn. */
  subjectRooms: boolean;
  /** Văn bản căn cứ, chọn từ danh mục. */
  legalDocuments: { id: number; code: string; name: string }[];
  /** Điều, khoản áp dụng ("Khoản 4 Điều 18 và Phụ lục IV"). */
  legalBasis: string | null;
  sortOrder: number | null;
};

const num = (v: number | string) => String(Number(v)).replace(".", ",");

/**
 * Tỉ lệ phòng theo lớp viết như thông tư: 0,1 → "1 phòng/10 lớp", 0,6 → "3 phòng/5 lớp", 1 → "1 phòng/lớp".
 * Cùng cách ghi với `FacilityStandardService.perClassText` ở máy chủ.
 */
export function perClassText(ratio: number | string): string {
  const v = Number(ratio);
  if (v > 0 && v < 1) {
    const { rooms, classes } = splitPerClass(v);
    if (classes > 1) return `${rooms} phòng/${classes} lớp`;
  }
  return `${num(v)} phòng/lớp`;
}

/** Số phòng trên số lớp → tỉ lệ lưu 3 số lẻ, CẮT BỚT (1 phòng/3 lớp → 0,333) để làm tròn lên không đòi dư một phòng. */
export const joinPerClass = (rooms: number, classes: number) => Math.floor((rooms / classes) * 1000 + 1e-6) / 1000;

/** Ngược của {@link joinPerClass}: phân số có mẫu nhỏ nhất cho ra đúng tỉ lệ đang lưu. */
export function splitPerClass(ratio: number | string): { rooms: number; classes: number } {
  const v = Number(ratio);
  for (let classes = 1; classes <= 100; classes++) {
    const rooms = Math.round(v * classes);
    if (rooms > 0 && Math.abs(joinPerClass(rooms, classes) - v) < 1e-9) return { rooms, classes };
  }
  return { rooms: v, classes: 1 };
}

/** "≥ 1 phòng; 1 phòng/10 lớp; ≥ 45 m²/phòng; 0,6 m²/học sinh; tổng ≥ 60 m²" — cùng cách ghi với máy chủ. */
export function ruleSummary(r: Partial<Pick<FacilityStandardRule,
  "minCount" | "countPerClass" | "minRoomArea" | "areaPerStudent" | "minTotalArea" | "largeClassFrom" | "largeMinCount"
  | "studentPercent" | "onlyIfPresent">> | null | undefined): string {
  if (!r) return "—";
  const parts: string[] = [];
  if (r.minCount != null) parts.push(`≥ ${r.minCount} phòng`);
  if (r.countPerClass != null) parts.push(perClassText(r.countPerClass));
  if (r.largeClassFrom != null) parts.push(`trường trên ${r.largeClassFrom} lớp ≥ ${r.largeMinCount} phòng`);
  if (r.minRoomArea != null) parts.push(`≥ ${num(r.minRoomArea)} m²/phòng`);
  if (r.areaPerStudent != null) parts.push(`${num(r.areaPerStudent)} m²/học sinh${r.studentPercent != null ? ` (tính ${num(r.studentPercent)}% học sinh)` : ""}`);
  if (r.minTotalArea != null) parts.push(`tổng ≥ ${num(r.minTotalArea)} m²`);
  return parts.length ? `${r.onlyIfPresent ? "nếu có: " : ""}${parts.join("; ")}` : "—";
}

export type StandardItem = {
  roomTypeId: number;
  code: string;
  name: string;
  kind: "ROOM" | "AREA";
  count: number;
  totalArea: number;
  smallestArea: number | null;
  status: Record<StandardTier, StandardStatus>;
  shortfalls: string[];
  requirements: string[];
  hasRules: boolean;
  /** Điều kiện RIÊNG từng mức chưa đạt (`FacilityStandardService.Gap`); mức chỉ hỏng vì mức dưới thì không có. */
  gaps: Partial<Record<StandardTier, StandardGap>>;
  /** Thiếu dữ liệu để đánh giá: số lớp, số học sinh, diện tích phòng. */
  missing: ("classes" | "students" | "area")[];
};

export type StandardGap = { needCount: number | null; needRoomArea: number | null; needTotalArea: number | null };

export type StandardGroup = {
  code: string | null;
  name: string;
  status: Record<StandardTier, StandardStatus>;
  items: StandardItem[];
};

export type StandardEvaluation = {
  school: {
    id: number;
    code: string;
    name: string;
    levelCode: string | null;
    levelName: string | null;
    managingBody: string | null;
    students: number | null;
    classes: number | null;
  };
  schoolYear: string | null;
  tiers: { tier: StandardTier; label: string; passed: number; total: number; reached: boolean }[];
  reached: StandardTier | null;
  reachedLabel: string;
  warnings: string[];
  groups: StandardGroup[];
};
