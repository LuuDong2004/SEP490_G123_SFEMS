/** Mục "Cần hoàn thiện" của một trường — `GET /api/facility_todo/{schoolId}`. */

/** ERROR: thiếu dữ liệu làm sai số liệu. WARNING: số đáng ngờ, vẫn lưu được. */
export type FacilityTodoSeverity = "ERROR" | "WARNING";

/** Nơi sửa: danh sách lớp, hạng mục, khối nhà, diện tích đất (hồ sơ trường), hoặc xác nhận hiện trạng. */
export type FacilityTodoActionKind = "classes" | "rooms" | "buildings" | "landArea" | "confirm";

export type FacilityTodoItem = {
  key: string;
  severity: FacilityTodoSeverity;
  count: number;
  title: string;
  impact: string;
  action: { kind: FacilityTodoActionKind; filter?: string | null };
};

/** Việc đang lọc danh sách hạng mục (bấm "Xem" ở Cần hoàn thiện): khoá gửi `todo=<key>`, tiêu đề hiện trên nhãn lọc. */
export type FacilityTodoFilter = { key: string; title: string };

/** Chữ trên nút của từng loại việc. */
export const FACILITY_TODO_ACTION_LABELS: Record<FacilityTodoActionKind, string> = {
  classes: "Nhập lớp",
  rooms: "Xem",
  buildings: "Xem",
  landArea: "Khai",
  confirm: "Xác nhận",
};
