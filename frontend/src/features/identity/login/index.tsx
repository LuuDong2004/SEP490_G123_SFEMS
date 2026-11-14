import { SignInForm } from "@/shared/components/form/sign-in-form";
import { isAdminLoginPath } from "@/shared/api/portal";

/** `/login` — khu nghiệp vụ; `/admin/login` — khu quản trị, chỉ tài khoản quản trị hệ thống (cổng Admin cách ly). */
export const Login = () => {
  return <SignInForm area={isAdminLoginPath() ? "admin" : "business"} />;
};
