import { API_URL } from "@/shared/api/constants";
import { getUserType } from "@/shared/api/session";
import { PORTAL_OF, PORTALS, UNGATED, type Portal } from "@/domains/portal/types";

export { getUserType };

export function currentPortal(token?: string | null): Portal | null {
  const type = getUserType(token);
  return type ? PORTAL_OF[type] : null;
}

/** Gốc giao diện của cổng: `/school`, `/so`… — rỗng khi chưa đăng nhập. */
export function portalBase(token?: string | null): string {
  const portal = currentPortal(token);
  return portal ? `/${portal}` : "";
}

/** Cổng ở đầu đường dẫn giao diện (`/so/equipment` → `so`), hoặc null. */
export function portalInPath(pathname: string): Portal | null {
  const first = pathname.split("/")[1] as Portal;
  return PORTALS.includes(first) ? first : null;
}

/**
 * Chèn cổng vào địa chỉ API: `<API_URL>/equipment` → `<API_URL>/school/equipment`. Bỏ qua địa chỉ ngoài API,
 * `auth/*` (dùng trước khi có loại tài khoản) và địa chỉ đã có cổng.
 */
export function withPortal(url: string, portal: Portal | null = currentPortal()): string {
  if (!portal) return url;
  const base = new URL(API_URL, window.location.origin).href.replace(/\/$/, "");
  const absolute = new URL(url, window.location.origin).href;
  if (!absolute.startsWith(base + "/")) return url;
  const rest = absolute.slice(base.length + 1);
  const first = rest.split(/[/?#]/)[0];
  if (UNGATED.includes(first) || PORTALS.includes(first as Portal)) return url;
  return `${base}/${portal}/${rest}`;
}

/** Màn đăng nhập của khu quản trị (cổng Admin cách ly): chỉ nhận tài khoản quản trị hệ thống. */
export const ADMIN_LOGIN_PATH = "/admin/login";

/** Đang ở màn đăng nhập khu quản trị không — đọc từ địa chỉ trình duyệt, đúng cả khi gốc router là `/admin`. */
export function isAdminLoginPath(pathname: string = window.location.pathname): boolean {
  return pathname.replace(/\/+$/, "") === ADMIN_LOGIN_PATH;
}

/**
 * Đặt địa chỉ trình duyệt vào đúng cổng TRƯỚC khi dựng giao diện (gốc của router là cổng, docs/kien-truc/11):
 * - đã đăng nhập, địa chỉ chưa có cổng (liên kết cũ `/equipment/5`) → thêm cổng của mình;
 * - đã đăng nhập, địa chỉ ở cổng KHÁC (`/so/...` với tài khoản trường) → về trang đầu cổng của mình
 *   (máy chủ cũng chặn 403 nếu gọi thẳng API cổng khác);
 * - chưa đăng nhập, địa chỉ có cổng → bỏ cổng (màn đăng nhập ở gốc); riêng địa chỉ `/admin/...` → `/admin/login`,
 *   màn đăng nhập riêng của khu quản trị.
 */
export function normalizePortalPath(): void {
  const { pathname, search, hash } = window.location;
  const mine = currentPortal();
  const there = portalInPath(pathname);
  let next: string | null = null;
  if (!mine && there === "admin") {
    // Chưa đăng nhập mà mở một địa chỉ của khu quản trị: về màn đăng nhập của khu đó, không về màn chung.
    next = ADMIN_LOGIN_PATH;
  } else if (mine && there !== mine) {
    next = there ? `/${mine}/` : `/${mine}${pathname === "/" ? "/" : pathname}`;
  } else if (!mine && there) {
    next = pathname.slice(there.length + 1) || "/";
  }
  if (next && next !== pathname) window.history.replaceState(null, "", next + (there && mine ? "" : search + hash));
}
