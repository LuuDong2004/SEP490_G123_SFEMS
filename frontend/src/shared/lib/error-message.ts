/**
 * Câu lỗi người dùng đọc được. Máy chủ đã viết câu tiếng Việt cho lỗi nghiệp vụ (422, 409…) — giữ nguyên. Câu kỹ thuật
 * (tên lớp Java, SQL, chữ tiếng Anh của trình duyệt / proxy, câu quá dài) thì thay bằng câu chung theo mã HTTP.
 */

const BY_STATUS: Record<number, string> = {
  0: "Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.",
  400: "Yêu cầu chưa hợp lệ. Kiểm tra lại thông tin đã nhập.",
  401: "Phiên đăng nhập đã hết. Vui lòng đăng nhập lại.",
  403: "Bạn không có quyền làm thao tác này.",
  404: "Không tìm thấy dữ liệu, có thể đã bị xoá.",
  408: "Máy chủ phản hồi quá lâu. Vui lòng thử lại.",
  409: "Dữ liệu bị trùng hoặc vừa được người khác sửa. Tải lại rồi thử lại.",
  413: "Tệp quá lớn.",
  415: "Định dạng tệp không được hỗ trợ.",
  422: "Dữ liệu chưa hợp lệ. Kiểm tra lại các ô.",
  429: "Thao tác quá nhanh. Vui lòng chờ giây lát.",
  503: "Dịch vụ tạm thời không sẵn sàng. Vui lòng thử lại sau.",
};
const SERVER_ERROR = "Hệ thống đang gặp sự cố. Vui lòng thử lại sau.";
const MAX_LENGTH = 220;

const TECHNICAL =
  /exception|java\.|org\.|jakarta\.|hibernate|sql|constraint|violat|stack|null|undefined|\bat [a-z]+\.|ERROR:|could not|failed to|networkerror|status code|unexpected token|json|internal server error|bad gateway|gateway timeout|service unavailable|timeout|\{|\}|<[a-z]/i;
/** Có dấu tiếng Việt — dấu hiệu câu do máy chủ viết cho người dùng. */
const VIETNAMESE = /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i;

export function statusOf(text: string | undefined): number | undefined {
  const m = text ? /\(mã (\d{3})\)/.exec(text) : null;
  return m ? Number(m[1]) : undefined;
}

/** Bỏ đuôi "(mã 422)" trong tiêu đề — mã HTTP không giúp gì người dùng. */
export function withoutStatus(text: string): string {
  return text.replace(/\s*\(mã[^)]*\)/g, "").trim();
}

export function friendlyError(message: string | undefined, status?: number): string {
  const text = (message ?? "").replace(/\s+/g, " ").trim();
  const fallback = status == null ? SERVER_ERROR : (BY_STATUS[status] ?? (status >= 500 ? SERVER_ERROR : BY_STATUS[400]));
  if (!text) return fallback;
  if (status != null && status >= 500) return fallback;
  if (TECHNICAL.test(text) || !VIETNAMESE.test(text)) return fallback;
  return text.length > MAX_LENGTH ? `${text.slice(0, MAX_LENGTH - 1).trimEnd()}…` : text;
}
