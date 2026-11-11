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
  NONE: "—",
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
  legalBasis: string | null;
};

const num = (v: number | string) => String(Number(v)).replace(".", ",");

/** "≥ 1 phòng; 1 phòng/lớp; ≥ 45 m²/phòng; 0,6 m²/học sinh; tổng ≥ 60 m²" — cùng cách ghi với máy chủ. */
export function ruleSummary(r: Partial<Pick<FacilityStandardRule,
  "minCount" | "countPerClass" | "minRoomArea" | "areaPerStudent" | "minTotalArea">> | null | undefined): string {
  if (!r) return "—";
  const parts: string[] = [];
  if (r.minCount != null) parts.push(`≥ ${r.minCount} phòng`);
  if (r.countPerClass != null) parts.push(`${num(r.countPerClass)} phòng/lớp`);
  if (r.minRoomArea != null) parts.push(`≥ ${num(r.minRoomArea)} m²/phòng`);
  if (r.areaPerStudent != null) parts.push(`${num(r.areaPerStudent)} m²/học sinh`);
  if (r.minTotalArea != null) parts.push(`tổng ≥ ${num(r.minTotalArea)} m²`);
  return parts.length ? parts.join("; ") : "—";
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
};

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
