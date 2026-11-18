/** Danh mục CSVC (192): khối, loại, dạng, cấp áp dụng. */

export type FacilityKind = "ROOM" | "AREA";

export const FACILITY_KIND_LABELS: Record<FacilityKind, string> = {
  ROOM: "Phòng, nhà",
  AREA: "Khu vực, công trình",
};

export const FACILITY_LEVELS = [
  { code: "TH", name: "Tiểu học" },
  { code: "THCS", name: "THCS" },
  { code: "THPT", name: "THPT" },
] as const;

/** "Mọi cấp" khi đủ ba cấp, không thì liệt kê. */
export function levelsText(levels: string[] | null | undefined): string {
  if (!levels || levels.length === 0 || levels.length === FACILITY_LEVELS.length) return "Mọi cấp";
  return FACILITY_LEVELS.filter((l) => levels.includes(l.code)).map((l) => l.name).join(", ");
}

/** Loại CSVC như API trả. */
export type RoomTypeRecord = {
  id: number;
  code: string;
  name: string;
  group?: { id: number; code: string; name: string } | null;
  kind: FacilityKind;
  levels: string[];
  standard: boolean;
  loanable: boolean;
  functional: boolean;
  schoolId?: number | null;
};
