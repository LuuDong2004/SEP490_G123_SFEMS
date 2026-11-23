/**
 * Resource `education_levels` theo đúng hình dạng API trả về —
 * `EducationLevelResponse` ở backend.
 *
 * Không có gì sinh file này ra từ Java record, nên hai bên giữ khớp bằng tay;
 * đó cũng là giao kèo mà phần còn lại của hợp đồng API đang chịu.
 *
 * <p>Nhãn tiếng Việt lấy từ `docs/i18n/jmix-vi.json` (khoá
 * `entities.EducationLevel`), không tự nghĩ lại — đó là lý do mang 5.910 chuỗi
 * của bản Jmix sang.
 */
export type EducationLevel = {
  id: number;
  code: string;
  name: string;
  shortName: string | null;
  sortOrder: number | null;
  active: boolean;
  note: string | null;
  createdAt: string;
  updatedAt: string | null;
};

/**
 * `active` là cờ chứ không phải enum trạng thái, nhưng vẫn hiển thị như một
 * chip: người dùng đọc "Đang hoạt động / Ngừng hoạt động" chứ không đọc true/false.
 */
export const ACTIVE_LABELS: Record<"true" | "false", string> = {
  true: "Đang hoạt động",
  false: "Ngừng hoạt động",
};
