/** Nhập dữ liệu đầu vào qua vùng chờ (`/api/data_imports`). */

export type ImportSheetKey = "campus" | "staff" | "building" | "room" | "class" | "student" | "equipment" | "schools" | "wards";

/**
 * Loại dữ liệu của một lô: dữ liệu đầu vào của MỘT trường (nhiều trang), hoặc một danh mục dùng chung (một trang,
 * không thuộc trường nào).
 */
export type ImportKind = "school_data" | "schools" | "wards";

/** Kết quả kiểm tra cả lô danh mục: số thêm / sửa / ngừng, mục sẽ ngừng, lỗi của cả lô. */
export type ImportPreview = {
  created: number;
  updated: number;
  unchanged: number;
  outOfScope: number;
  deactivated: number;
  deactivateMissing: boolean;
  batchErrors: string[];
  deactivate: { code: string; name: string }[];
  kept: { code: string; name: string; note?: string }[];
};

export type ImportColumn = { key: string; label: string; required: boolean; hint: string };

export type ImportSheetInfo = {
  key: ImportSheetKey;
  title: string;
  columns: ImportColumn[];
};

export type ImportSheetCount = {
  sheet: ImportSheetKey;
  title: string;
  total: number;
  ok: number;
  warning: number;
  error: number;
  exists: number;
  skipped: number;
};

export type ImportBatchStatus = "DRAFT" | "COMMITTED";

export type ImportBatch = {
  id: number;
  kind: ImportKind;
  /** "Dữ liệu đầu vào của trường", "Danh sách trường", "Phường/xã". */
  kindTitle: string;
  /** Trường của lô dữ liệu đầu vào; lô danh mục: null. */
  school: { id: number; name: string } | null;
  fileName: string;
  status: ImportBatchStatus;
  createdAt: string;
  createdBy: string | null;
  committedAt: string | null;
  committedBy: string | null;
  sheets: ImportSheetCount[];
  errors: number;
  /** Đã tạo gì khi ghi: tên bảng → số bản ghi. */
  created: Record<string, number>;
  /** Lô danh mục: kết quả kiểm tra cả lô. */
  preview: ImportPreview | null;
};

/** OK · WARNING (có lưu ý, vẫn ghi) · ERROR (chặn ghi) · EXISTS (đã có, không tạo lại) · SKIPPED (người nhập bỏ). */
export type ImportRowStatus = "OK" | "WARNING" | "ERROR" | "EXISTS" | "SKIPPED";

export type ImportMessage = { level: "error" | "warning"; field: string; text: string };

export type ImportRow = {
  id: number;
  rowNo: number;
  data: Record<string, string>;
  skipped: boolean;
  status: ImportRowStatus;
  messages: ImportMessage[];
  /** Thứ hệ thống hiểu được: thiết bị trong danh mục đã ghép, ngày suy ra… */
  resolved: Record<string, string | number | null>;
  /** Lần sửa gần nhất của dòng là bằng cách nào; trống = chưa ai sửa. */
  editSource: ImportEditSource | null;
  /** Từng ô đã sửa → cách sửa gần nhất: lưới tô đúng ô đó (nền xanh nhạt, nhãn nói sửa tay hay sửa nhanh). */
  editedCells: Record<string, ImportEditSource>;
};

/** Cách một ô được sửa ở vùng chờ: tay, hay sửa nhanh theo luật. */
export type ImportEditSource = "manual" | "rule";

/** Một lần sửa ô — tab Lịch sử của lô. `field` = `_skip` là bỏ / dùng lại dòng. */
export type ImportEdit = {
  id: number;
  sheet: string;
  rowNo: number;
  rowId: number | null;
  field: string;
  oldValue: string | null;
  newValue: string | null;
  source: ImportEditSource;
  editedAt: string;
  editedBy: string | null;
};

/** Một gợi ý sửa nhanh (chuẩn hoá theo luật) cho một ô: giá trị cũ → mới và lý do. Nhận thì gửi qua PATCH như sửa tay. */
export type ImportFixSuggestion = {
  rowId: number;
  field: string;
  from: string;
  to: string;
  reason: string;
  /** Gợi ý sửa dòng của trang khác: tên ô và số dòng của dòng đó. */
  fieldLabel?: string | null;
  rowNo?: number | null;
  /** Phỏng đoán: không tích sẵn, người dùng tự xem. */
  review?: boolean;
  /** Ô chỉ nhận một danh sách: cho chọn thay vì gõ. */
  options?: string[];
};

export const IMPORT_ROW_STATUS: Record<ImportRowStatus, string> = {
  OK: "Hợp lệ",
  WARNING: "Có lưu ý",
  ERROR: "Lỗi",
  EXISTS: "Đã có trên hệ thống",
  SKIPPED: "Bỏ qua",
};

export const IMPORT_BATCH_STATUS: Record<ImportBatchStatus, string> = {
  DRAFT: "Đang chờ ghi",
  COMMITTED: "Đã ghi vào hệ thống",
};

/** Hoàn tác một lô chỉ trong ngần này giờ sau khi ghi — đi cùng `OnboardingService.UNDO_HOURS`. */
export const UNDO_HOURS = 24;

/** Cách hệ thống ghép một dòng thiết bị với danh mục. */
export const CATALOG_MATCH: Record<string, string> = {
  code: "theo mã",
  alias: "theo mã phần mềm cũ đã biết",
  name: "theo tên",
  own: "thiết bị riêng của trường",
  formula: "theo công thức hoá học",
  "other-level": "danh mục cấp học khác",
  new: "ngoài danh mục — sẽ tạo mới",
};

/** Tên bảng đã tạo khi ghi → nhãn. */
export const CREATED_LABELS: Record<string, string> = {
  schools: "trường mới",
  wards: "phường/xã mới",
  campuses: "cơ sở",
  staff: "cán bộ",
  subject_teams: "tổ bộ môn",
  buildings: "khối nhà",
  rooms: "phòng",
  school_classes: "lớp",
  students: "học sinh",
  equipment_catalogs: "thiết bị ngoài danh mục",
  equipment: "thiết bị",
};
