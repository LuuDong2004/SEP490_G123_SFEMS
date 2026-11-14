import { PASSWORD_LIMITS } from "@/shared/lib/field-rules";

/**
 * Chính sách mật khẩu (QLTB-508, HSDT TL4.1.11) — cùng luật với `PasswordPolicy` ở máy chủ, tính sẵn ở trình
 * duyệt để người đặt mật khẩu thấy còn thiếu gì TRƯỚC khi bấm lưu. Máy chủ vẫn là nơi quyết. Độ dài lấy từ
 * `field-rules.json` (sinh từ backend); tài khoản quyền cao (Quản trị, Sở) cần dài hơn.
 */
const COMMON = new Set([
  "password", "passw", "pass", "matkhau", "admin", "administrator", "qwerty", "qwertyuiop", "asdfgh",
  "abc", "abcabc", "iloveyou", "welcome", "letmein", "login", "user", "test", "demo", "root", "master",
  "secret", "changeme", "default", "hello", "monkey", "dragon", "football", "sunshine", "princess",
  "qltb", "giaoduc", "truonghoc", "vietnam", "hcm", "saigon",
]);

/** Bốn ký tự liền nhau tăng dần, giảm dần hoặc giống nhau — cùng cách đếm với máy chủ. */
const hasRun = (pw: string) => {
  const s = pw.toLowerCase();
  const alnum = (c: string) => /[\p{L}\p{N}]/u.test(c);
  let up = 1;
  let down = 1;
  let same = 1;
  for (let i = 1; i < s.length; i++) {
    const diff = s.charCodeAt(i) - s.charCodeAt(i - 1);
    const both = alnum(s[i]) && alnum(s[i - 1]);
    up = both && diff === 1 ? up + 1 : 1;
    down = both && diff === -1 ? down + 1 : 1;
    same = diff === 0 ? same + 1 : 1;
    if (up >= 4 || down >= 4 || same >= 4) return true;
  }
  return false;
};

export const isPrivileged = (roles: readonly string[] | undefined) =>
  !!roles?.some((r) => PASSWORD_LIMITS.privilegedRoles.includes(r));

/** `short`: chữ trên viên nhắc dưới ô mật khẩu; `label`: câu đầy đủ (hiện khi rê chuột). */
export function passwordRules(privileged = false): { key: string; label: string; short: string; ok: (pw: string) => boolean }[] {
  const min = privileged ? PASSWORD_LIMITS.privilegedMin : PASSWORD_LIMITS.min;
  return [
    { key: "length", label: `Từ ${min} ký tự trở lên`, short: `${min}+ ký tự`, ok: (pw) => pw.length >= min && pw.length <= PASSWORD_LIMITS.max },
    { key: "upper", label: "Có chữ hoa", short: "Chữ hoa", ok: (pw) => /\p{Lu}/u.test(pw) },
    { key: "lower", label: "Có chữ thường", short: "Chữ thường", ok: (pw) => /\p{Ll}/u.test(pw) },
    { key: "digit", label: "Có chữ số", short: "Chữ số", ok: (pw) => /\d/.test(pw) },
    { key: "special", label: "Có ký tự đặc biệt (vd. @ # !)", short: "Ký tự đặc biệt", ok: (pw) => /[^\p{L}\p{N}]/u.test(pw) },
    { key: "run", label: "Không có dãy liên tiếp (1234, abcd, aaaa)", short: "Không dãy 1234", ok: (pw) => pw.length > 0 && !hasRun(pw) },
    {
      key: "common",
      label: "Không dùng từ dễ đoán (password, admin…)",
      short: "Không từ dễ đoán",
      ok: (pw) => pw.length > 0 && !COMMON.has(pw.toLowerCase().replace(/[^a-z]/g, "")),
    },
  ];
}

/** Mật khẩu đủ mọi luật chưa. */
export const passwordOk = (pw: string, privileged = false) => passwordRules(privileged).every((r) => r.ok(pw));
