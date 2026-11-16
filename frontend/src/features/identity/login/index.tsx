import { useEffect } from "react";

import { SignInForm } from "@/shared/components/form/sign-in-form";

/**
 * `/login` — màn đăng nhập chung của mọi loại tài khoản. Bị đẩy ra khi phiên hết hạn trong một cổng thì router
 * (gốc = cổng cũ) dẫn tới `/<cổng>/login`: tải lại ở `/login` để người đăng nhập sau vào đúng cổng của họ.
 */
export const Login = () => {
  const { pathname, search } = window.location;
  const stray = pathname.replace(/\/+$/, "") !== "/login";
  useEffect(() => {
    if (stray) window.location.replace(`/login${search}`);
  }, [stray, search]);
  return stray ? null : <SignInForm />;
};
