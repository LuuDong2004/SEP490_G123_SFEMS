/**
 * Cấu hình các mục và trường chứng từ của một loại phiếu (`GET /api/voucher_forms/{resource}`),
 * sinh từ app Jmix cũ. Giá trị nằm trong `details` của phiếu và của từng dòng.
 */
export type DetailFieldKind =
  | "text"
  | "textarea"
  | "date"
  | "time"
  | "integer"
  | "money"
  | "percent"
  | "boolean"
  | "enum"
  | "staff"
  | "room"
  | "school";

export type DetailField = {
  key: string;
  label: string;
  kind: DetailFieldKind;
  max?: number;
  /** Độ dài tối thiểu khi có khai (vd. họ tên 2–100) — cùng `min` của cấu hình ở máy chủ. */
  min?: number;
  /** Kiểu chuẩn của ô chữ (`FieldRule` ở máy chủ) — vắng: một dòng SHORT_TEXT, nhiều dòng LONG_TEXT. */
  rule?: string;
  /** `"past"`: ngày của việc đã xảy ra, không sau hôm nay. */
  date?: "past";
  required?: boolean;
  wide?: boolean;
  enum?: string;
  /** Ô chọn (`enum`) có mục "Khác" để gõ tay — máy chủ gắn (`VoucherForms`); ô tình trạng tài sản thì không. */
  other?: boolean;
  /** Gợi ý khi gõ: năm học, năm, tên cán bộ, tên phòng, nguồn vốn... */
  suggest?: "schoolYear" | "year" | "staff" | "room" | "funding" | "origin";
  /** Lời giải thích — dấu "?" cạnh nhãn. Chỉ có ở ô mà nhãn ngắn chưa đủ nói phải điền gì. */
  hint?: string;
  /** Chữ mờ trong ô — ví dụ giá trị để người nhập hiểu phải ghi gì (vắng: "Nhập" / "Nhập số"). */
  placeholder?: string;
  /** Cột của bảng con: bề rộng tương đối (mặc định 1) — cột tên dài cho 2. */
  grow?: number;
};

export type DetailSection = {
  title: string;
  fields: DetailField[];
  /** Chỉ hiện khi trường `field` của phiếu thuộc `in` (vd. `centralized`: cấp trên mua tập trung). */
  when?: { field: string; in: string[] };
  /**
   * Trang của loại phiếu tự đặt các ô này vào khối "Thông tin phiếu" (ô `details.<key>`) và tự đưa vào `facts` khi
   * xem — khối "Thông tin bổ sung" chung bỏ qua chúng. Dùng khi chỉ còn một hai ô, đứng riêng một khối thì lạc lõng.
   */
  inline?: boolean;
};

export type VoucherFormConfig = {
  resource: string;
  sections: DetailSection[];
  line: DetailField[];
  lineTables: Record<string, DetailField[]>;
  enums: Record<string, { value: string; label: string }[]>;
  /**
   * Các cấp duyệt đang áp dụng cho loại phiếu (Sở cấu hình). Rỗng = phiếu bấm là xong, không ai duyệt.
   * Vắng mặt = loại phiếu không có luồng duyệt cấu hình được.
   */
  approvalSteps?: string[];
};

// `{ name, other }`: ô cán bộ "Người khác" — họ tên gõ tay, không có id.
export type DetailValue = string | number | boolean | { id: number; name?: string } | { name: string; other: true } | Record<string, unknown>[] | null;
export type Details = Record<string, DetailValue>;
