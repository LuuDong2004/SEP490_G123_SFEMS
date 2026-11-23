/** Đăng nhập và hồ sơ cá nhân. */
import { lazyNamed } from "@/shared/lib/lazy-named";

export { Login } from "./login";
export { ForgotPassword } from "./password-reset";
export { ResetPassword } from "./password-reset";

// Màn hình: tải khi mở tới (mỗi thư mục một chunk) — xem `lazyNamed`.
export const Profile = lazyNamed(() => import("./profile"), "Profile");
/** Màn bắt buộc bật 2 lớp của tài khoản quản trị (cổng Admin cách ly) — thay cả khung ứng dụng. */
export const AdminMfaSetup = lazyNamed(() => import("./mfa-setup"), "AdminMfaSetup");
