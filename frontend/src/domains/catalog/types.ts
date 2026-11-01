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

export type RoomType = CatalogItem & {
  /** Phòng thuộc loại này là kho. */
  warehouse: boolean;
};

export type SchoolYear = CatalogItem & {
  /** Ngày lịch dạng "2026-09-05". */
  startDate: string;
  endDate: string;
};

export type Grade = CatalogItem & {
  educationLevel: CatalogRef;
  gradeNumber: number | null;
};

export type Subject = CatalogItem & {
  /** Mã môn ngắn — thành phần MH của mã tài sản. */
  shortCode: string | null;
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
  true: "Đang dùng",
  false: "Ngừng dùng",
} as const;
