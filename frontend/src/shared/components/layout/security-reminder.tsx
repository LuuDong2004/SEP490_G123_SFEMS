import { useGetIdentity } from "@refinedev/core";
import { KeyRound, ShieldAlert, X } from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "react-router";

import { cn } from "@/shared/lib/utils";

/** Phần của `GET /auth/me` mà lời nhắc cần. */
type Identity = {
  id: number;
  mfaRequired?: boolean;
  secondFactor?: boolean;
  passwordChangedAt?: string | null;
};

/** Mật khẩu dùng quá ngần này ngày thì nhắc đổi. */
const PASSWORD_MAX_AGE_DAYS = 180;
/** Lời nhắc KHÔNG bắt buộc tắt đi thì im ngần này ngày rồi mới nhắc lại. */
const SNOOZE_DAYS = 7;
const DAY = 86_400_000;

function snoozed(key: string) {
  try {
    const until = Number(localStorage.getItem(key) ?? 0);
    return until > Date.now();
  } catch {
    return false;
  }
}

function snooze(key: string) {
  try {
    localStorage.setItem(key, String(Date.now() + SNOOZE_DAYS * DAY));
  } catch {
    // Trình duyệt chặn lưu: lời nhắc hiện lại lần sau, không sao.
  }
}

/**
 * Nhắc bảo mật trên toàn ứng dụng (QLTB-243), một dải mỏng trên đầu nội dung:
 *
 * <ul>
 *   <li>Tài khoản đặc quyền (quản trị) chưa có lớp xác thực thứ hai — BẮT BUỘC, không tắt được: máy chủ đã coi đó
 *       là yêu cầu (`mfaRequired`), trước đây chỉ trang Hồ sơ nói ra.</li>
 *   <li>Tài khoản khác chưa bật xác thực hai lớp — gợi ý, tắt được, nhắc lại sau {@link SNOOZE_DAYS} ngày.</li>
 *   <li>Mật khẩu đã dùng quá {@link PASSWORD_MAX_AGE_DAYS} ngày — tắt được như trên.</li>
 * </ul>
 *
 * Ẩn ở chính trang Hồ sơ, nơi việc cần làm đã ở ngay trước mắt.
 */
export function SecurityReminder() {
  const { data: me } = useGetIdentity<Identity>();
  const { pathname } = useLocation();
  const [, rerender] = useState(0);
  if (!me || pathname.startsWith("/profile")) return null;

  const ageDays = me.passwordChangedAt ? Math.floor((Date.now() - Date.parse(me.passwordChangedAt)) / DAY) : null;
  const items: { key: string; tone: "warning" | "info"; icon: typeof ShieldAlert; text: string; action: string; to: string; dismiss: boolean }[] = [];
  if (me.mfaRequired && !me.secondFactor) {
    items.push({ key: "mfa-required", tone: "warning", icon: ShieldAlert, dismiss: false,
      text: "Tài khoản quản trị phải bật xác thực hai lớp để bảo vệ dữ liệu toàn hệ thống.", action: "Bật ngay", to: "/profile?tab=mfa" });
  } else if (me.secondFactor === false && !snoozed(`sec.mfa.${me.id}`)) {
    items.push({ key: `sec.mfa.${me.id}`, tone: "info", icon: ShieldAlert, dismiss: true,
      text: "Nên bật xác thực hai lớp (mã qua ứng dụng hoặc email) — mất mật khẩu cũng không ai vào được tài khoản.", action: "Bật", to: "/profile?tab=mfa" });
  }
  if (ageDays != null && ageDays >= PASSWORD_MAX_AGE_DAYS && !snoozed(`sec.pwd.${me.id}`)) {
    items.push({ key: `sec.pwd.${me.id}`, tone: "warning", icon: KeyRound, dismiss: true,
      text: `Mật khẩu đã dùng ${ageDays} ngày chưa đổi.`, action: "Đổi mật khẩu", to: "/profile?tab=password" });
  }
  if (items.length === 0) return null;

  return (
    <div className="space-y-2" data-print="hide">
      {items.map((it) => (
        <div key={it.key} role="status"
          className={cn("flex items-center gap-3 rounded-lg px-3 py-2 text-sm",
            it.tone === "warning" ? "bg-warning-subtle text-warning-text" : "bg-info-subtle text-info-text")}>
          <it.icon className="size-4 shrink-0" />
          <span className="min-w-0 flex-1">{it.text}</span>
          <Link to={it.to} className="shrink-0 font-medium underline underline-offset-2">{it.action}</Link>
          {it.dismiss ? (
            <button type="button" aria-label="Nhắc sau" title={`Nhắc lại sau ${SNOOZE_DAYS} ngày`}
              className="shrink-0 opacity-70 hover:opacity-100"
              onClick={() => { snooze(it.key); rerender((n) => n + 1); }}>
              <X className="size-4" />
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );
}
