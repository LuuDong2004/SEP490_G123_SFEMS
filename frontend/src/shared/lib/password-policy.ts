/**
 * Chính sách mật khẩu (QLTB-508) — cùng luật với `PasswordPolicy` ở máy chủ, tính sẵn ở trình duyệt để người
 * đặt mật khẩu thấy còn thiếu gì TRƯỚC khi bấm lưu. Máy chủ vẫn là nơi quyết.
 */
export const PASSWORD_RULES: { key: string; label: string; ok: (pw: string) => boolean }[] = [
  { key: "length", label: "Từ 8 ký tự trở lên", ok: (pw) => pw.length >= 8 },
  { key: "upper", label: "Có chữ hoa", ok: (pw) => /\p{Lu}/u.test(pw) },
  { key: "lower", label: "Có chữ thường", ok: (pw) => /\p{Ll}/u.test(pw) },
  { key: "digit", label: "Có chữ số", ok: (pw) => /\d/.test(pw) },
  { key: "special", label: "Có ký tự đặc biệt (vd. @ # !)", ok: (pw) => /[^\p{L}\p{N}]/u.test(pw) },
];

/** Mật khẩu đủ mọi luật chưa. */
export const passwordOk = (pw: string) => PASSWORD_RULES.every((r) => r.ok(pw));

/** Bỏ mọi khoảng trắng — máy chủ cũng bỏ, nên hai phía luôn so cùng một chuỗi. */
export const stripSpaces = (value: string) => value.replace(/\s+/g, "");
