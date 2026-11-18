/** Bộ tiêu chuẩn thiết bị và Danh mục thiết bị dạy học tối thiểu. */

export const DOCUMENT_ROLE_LABELS: Record<string, string> = {
  main: "Căn cứ chính",
  amendment: "Sửa đổi, bổ sung",
  guidance: "Hướng dẫn thực hiện",
  replacement: "Thay thế",
  correction: "Đính chính",
  reference: "Văn bản hợp nhất / tham khảo",
};

/** Loại một lần sửa danh mục (bộ lập bằng "Lập bộ mới"). */
export const REVISION_KIND_LABELS: Record<string, string> = {
  AMENDMENT: "Sửa đổi, bổ sung",
  CORRECTION: "Đính chính",
};

/** Căn cứ tính số lượng — cách phụ lục thông tư ghi cột "Số lượng". */
export const NORM_BASIS_LABELS: Record<string, string> = {
  per_class: "Theo lớp",
  per_student: "Theo nhóm học sinh",
  per_teacher: "Theo giáo viên",
  per_room: "Theo phòng học bộ môn",
  per_school: "Theo trường",
};

type Ref = { id: number; code: string; name: string } | null;

/** Một dòng của Danh mục thiết bị dạy học tối thiểu — một dòng phụ lục thông tư. */
export type EquipmentNorm = {
  id: number;
  code: string;
  name: string;
  sortOrder: number | null;
  active: boolean;
  note: string | null;
  standard: Ref;
  catalog: Ref;
  equipmentType: Ref;
  subject: Ref;
  unit: Ref;
  roomType: Ref;
  minQuantity: number | null;
  normBasis: string;
  basisSize: number | null;
  quantityText: string | null;
  unitText: string | null;
  gradeLevels: string | null;
  itemNo: string | null;
  sectionName: string | null;
  topic: string | null;
  purpose: string | null;
  description: string | null;
  forTeacher: boolean;
  forStudent: boolean;
  /** Nhóm tự chọn (phương án thay thế, môn thể thao tự chọn) — không vào đủ / thiếu. */
  optional: boolean;
  sourceDocument: { id: number; documentNo: string; documentName: string | null } | null;
  /** Áp dụng từ ngày (changelog 267). */
  effectiveFrom: string;
  /** Thôi áp dụng từ ngày (không tính ngày này); null = còn áp dụng. */
  effectiveTo: string | null;
  /** Dòng mà dòng này thay. */
  replacesId: number | null;
  /** Dòng thay dòng này (có thì "Đổi từ …", không thì "Bỏ từ …"). */
  replacedById: number | null;
  /** Văn bản căn cứ của lần bỏ / thay. */
  endDocument: { id: number; documentNo: string; documentName: string | null } | null;
  createdAt: string;
  updatedAt: string | null;
};

/** Số dòng của một môn — `GET /equipment_norms/groups`. */
export type NormSubjectGroup = {
  subjectId: number | null;
  subjectCode: string | null;
  subjectName: string | null;
  /** Số DÒNG phụ lục. */
  count: number;
  /** Số THIẾT BỊ khác nhau — một thiết bị có thể ghi ở nhiều chủ đề / lớp. */
  catalogs: number;
};

/** Một lựa chọn của ô lọc Chủ đề — `GET /equipment_norms/topics`. */
export type TopicOption = { subjectId: number | null; subjectName: string | null; kind: "topic" | "section"; value: string; count: number };

/** Các lớp của từng cấp học — lọc "Lớp" trên màn danh mục tối thiểu. */
export const LEVEL_GRADES: Record<string, number[]> = {
  TH: [1, 2, 3, 4, 5],
  THCS: [6, 7, 8, 9],
  THPT: [10, 11, 12],
};

/** "6,7,8,9" → "Lớp 6–9"; "6,8" → "Lớp 6, 8"; trống → "Mọi lớp". */
export function gradesLabel(gradeLevels: string | null | undefined, level?: string | null): string {
  if (!gradeLevels) return "Mọi lớp";
  const grades = gradeLevels.split(",").map(Number).sort((a, b) => a - b);
  const all = level ? LEVEL_GRADES[level] : undefined;
  if (all && all.length === grades.length && all.every((g) => grades.includes(g))) return "Mọi lớp";
  const contiguous = grades.length > 2 && grades.every((g, i) => i === 0 || g === grades[i - 1] + 1);
  return contiguous ? `Lớp ${grades[0]}–${grades[grades.length - 1]}` : `Lớp ${grades.join(", ")}`;
}

/**
 * Số lượng đọc được: nguyên văn của phụ lục ("01/4 đến 6HS") nếu có, không thì dựng từ phần đã
 * hiểu ("2 / lớp").
 */
export function quantityLabel(n: Pick<EquipmentNorm, "quantityText" | "minQuantity" | "normBasis" | "basisSize">): string {
  if (n.quantityText) return n.quantityText;
  if (n.minQuantity == null) return "—";
  const per: Record<string, string> = {
    per_class: "lớp",
    per_student: "HS",
    per_teacher: "GV",
    per_room: "PHBM",
    per_school: "trường",
  };
  const size = n.basisSize && n.basisSize > 1 ? `${n.basisSize} ` : "";
  return `${n.minQuantity} / ${size}${per[n.normBasis] ?? ""}`.trim();
}
