/**
 * Tab mở từ trước một lần triển khai vẫn giữ index.html cũ, nên khi mở một màn chưa tải nó xin tệp JS
 * mang tên băm cũ — tệp ấy không còn trên máy chủ, `import()` lỗi và cả trang trắng. Tải lại trang là
 * lấy được bản mới; nhớ lần tải lại trong `sessionStorage` để một chunk hỏng thật không thành vòng
 * tải lại vô tận (trong 30 giây chỉ tải lại một lần, lần sau để lỗi đi tiếp).
 */
const KEY = "dth-stale-chunk-reload";
const WINDOW_MS = 30_000;

/** Tải lại trang nếu chưa vừa tải lại vì cùng lý do; trả `true` khi đã cho tải lại. */
export function reloadForStaleChunk(): boolean {
  try {
    const last = Number(sessionStorage.getItem(KEY) ?? 0);
    if (Date.now() - last < WINDOW_MS) return false;
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    // sessionStorage bị chặn: vẫn tải lại một lần, trình duyệt không cho thì thôi.
  }
  window.location.reload();
  return true;
}
