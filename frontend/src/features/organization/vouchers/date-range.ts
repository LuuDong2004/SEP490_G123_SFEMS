/**
 * Ngày cuối không được trước ngày đầu — vế màn hình của `@DateRange` ở máy chủ, cùng câu báo lỗi. Dùng làm
 * `validate` của ô ngày cuối; ô ngày đầu khai `deps: ["<ô cuối>"]` để đổi ngày đầu là kiểm lại ngày cuối.
 * Thiếu một trong hai ngày thì không xét (bắt buộc là việc của `required`).
 */
export const notBefore = (from: string, message: string) => (value: unknown, all: Record<string, unknown>) =>
  !value || !all?.[from] || String(value).slice(0, 10) >= String(all[from]).slice(0, 10) || message;
