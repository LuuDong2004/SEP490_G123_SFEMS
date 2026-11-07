/**
 * Kiểu dữ liệu của các danh mục dùng chung (DM-01), đúng hình dạng API trả về. Mỗi danh mục có năm
 * trường chung (`CatalogItem`); danh mục nào có trường riêng thì mở rộng kiểu chung.
 */

/** Năm trường chung của mọi danh mục — `CatalogResponse` phía backend. */
export type CatalogItem = {
  id: number;
  code: string;
  name: string;
  sortOrder: number | null;
  active: boolean;
  note: string | null;
  createdAt: string;
  updatedAt: string | null;
  /** Người đang đăng nhập được làm gì với chính dòng này. */
  _can?: Record<string, boolean>;
};

/** Tham chiếu rút gọn tới một danh mục khác (id, mã, tên). */
export type CatalogRef = {
  id: number;
  code: string;
  name: string;
};

export type EducationLevel = CatalogItem & {
  shortName: string | null;
};

export type SchoolType = CatalogItem & {
  /** Tên viết tắt: CL, DL, TT. */
  shortName: string | null;
};

export type Unit = CatalogItem & {
  /** Chia được (kg, g, lít, ml, mét); tắt là chỉ đếm số nguyên. */
  allowsFraction: boolean;
};

/** Kiểu dữ liệu của một thông số kỹ thuật. */
export type AttributeDataType = "text" | "integer" | "decimal" | "boolean" | "date" | "enum";

export const DATA_TYPE_LABELS: Record<AttributeDataType, string> = {
  text: "Chữ",
  integer: "Số nguyên",
  decimal: "Số thập phân",
  boolean: "Có / Không",
  date: "Ngày",
  enum: "Chọn từ danh sách",
};

/** Một thông số trong bộ thông số kỹ thuật (chỉ là định nghĩa, giá trị nằm ở từng thiết bị). */
export type ConfigAttribute = {
  id: number | null;
  code: string;
  name: string;
  dataType: AttributeDataType;
  measureUnit: string | null;
  required: boolean;
  /** Các lựa chọn của kiểu "Chọn từ danh sách". */
  options: string[];
};

export type EquipmentConfig = CatalogItem & {
  description: string | null;
  /** Bộ được chọn sẵn khi tạo thiết bị mới. */
  defaultConfig: boolean;
  /** Rỗng là dùng cho mọi loại thiết bị. */
  scopeTypes: CatalogRef[];
  documentNo: string | null;
  documentName: string | null;
  issueDate: string | null;
  startSchoolYear: CatalogRef | null;
  endSchoolYear: CatalogRef | null;
  attributes: ConfigAttribute[];
};

export type RoomType = CatalogItem & {
  /** Phòng thuộc loại này là kho. */
  warehouse: boolean;
};

export type SchoolYear = CatalogItem & {
  /** Ngày lịch dạng "2026-09-05". */
  startDate: string;
  endDate: string;
  /** Năm học đang diễn ra; chỉ một năm mang cờ này. */
  current: boolean;
};

export type Grade = CatalogItem & {
  educationLevel: CatalogRef;
  gradeNumber: number | null;
};

export type SubjectGroup = CatalogItem & {
  educationLevel: CatalogRef | null;
  /** Số môn học thuộc tổ, máy chủ đếm. */
  subjectCount: number;
};

export type Subject = CatalogItem & {
  /** Ký hiệu môn — thành phần MH của mã tài sản. */
  shortCode: string | null;
  /** Cấp học giảng dạy môn này. */
  educationLevel: CatalogRef | null;
  /** Tổ chuyên môn phụ trách; null là chưa xếp tổ. */
  subjectGroup: CatalogRef | null;
};

export type MovementDirection = "increase" | "decrease";

export type MovementReason = CatalogItem & {
  direction: MovementDirection;
};

export const MOVEMENT_DIRECTION_LABELS: Record<MovementDirection, string> = {
  increase: "Tăng",
  decrease: "Giảm",
};

export const MOVEMENT_DIRECTION_OPTIONS = (Object.keys(MOVEMENT_DIRECTION_LABELS) as MovementDirection[]).map(
  (value) => ({ value, label: MOVEMENT_DIRECTION_LABELS[value] }),
);

export const ACTIVE_LABELS = {
  true: "Đang hoạt động",
  false: "Ngừng hoạt động",
} as const;
