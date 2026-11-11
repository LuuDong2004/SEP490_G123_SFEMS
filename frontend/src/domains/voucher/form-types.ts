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
  | "school"
  | "ref";

export type DetailField = {
  key: string;
  label: string;
  kind: DetailFieldKind;
  max?: number;
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
  resource?: string;
  /** Trường của một giai đoạn sau (vd. "return" — lúc trả), không của form lập phiếu. */
  stage?: string;
};

export type DetailSection = {
  title: string;
  fields: DetailField[];
  stage?: string;
  /** Chỉ hiện khi trường `field` của phiếu thuộc `in` (vd. hình thức ghi giảm = tiêu huỷ). */
  when?: { field: string; in: string[] };
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

export type DetailValue = string | number | boolean | { id: number; name?: string } | Record<string, unknown>[] | null;
export type Details = Record<string, DetailValue>;
