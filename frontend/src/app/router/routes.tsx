import { Authenticated } from "@refinedev/core";
import { lazy, Suspense, useEffect, useState } from "react";
import { Navigate, Outlet, Route, Routes } from "react-router";

import { ForgotPassword, Login, ResetPassword } from "@/features/identity";
import { homePath } from "@/shared/api/session";
import { FullPageSpinner } from "@/shared/components/spinner";

/** Nửa cần đăng nhập: khung, danh mục, mọi màn nghiệp vụ — một chunk riêng, xem `protected-routes.tsx`. */
type ProtectedComponent = (typeof import("@/app/router/protected-routes"))["default"];
/** Đã tải sẵn (từ màn đăng nhập) thì vẽ thẳng — `lazy` vẫn treo một nhịp và React giữ màn chờ tối thiểu ~300ms. */
let preloaded: ProtectedComponent | null = null;
const loadProtected = () => import("@/app/router/protected-routes").then((m) => {
  preloaded = m.default;
  return m;
});
const ProtectedRoutes = lazy(loadProtected);

/**
 * Đang ở màn đăng nhập thì tải sẵn phần cần đăng nhập — bấm Đăng nhập xong là vào thẳng, không qua một màn chờ "Đang tải"
 * trong lúc trình duyệt kéo khung ứng dụng về.
 */
function PreloadApp() {
  useEffect(() => {
    const t = setTimeout(() => void loadProtected(), 300);
    return () => clearTimeout(t);
  }, []);
  return <Outlet />;
}

/**
 * Route tree rendered inside `<Refine>`. Every path here must line up with the
 * action routes declared in `resources` above.
 *
 * The tree has two halves. Everything under `<Authenticated>` requires a
 * session and renders inside the shell; the login screen sits outside it and
 * renders bare. `<Authenticated>` calls the auth provider's `check`, which is
 * what turns an expired access token into a silent refresh rather than a
 * bounce to the login form.
 */
export function AppRoutes({ ready }: { ready: boolean }) {
  return (
    <Routes>
      {/*
        The unauthenticated half. `fallback` is what renders when there is no
        session; a signed-in visitor is sent to their home screen instead, so
        the login URL never shows a form to someone who is already past it.
        Cùng đích với `redirectTo` của `authProvider.login`: ngay khi đăng nhập
        xong, lớp bọc này chuyển hướng TRƯỚC cả lệnh của authProvider, nên hai
        chỗ phải chỉ cùng một nơi.
      */}
      <Route
        element={
          <Authenticated key="unauthenticated-routes" fallback={<PreloadApp />}>
            <Navigate to={homePath()} replace />
          </Authenticated>
        }
      >
        <Route path="/login" element={<Login />} />
        {/* Gốc khi chưa đăng nhập (đăng xuất xong về đây) là màn đăng nhập, không mang `?to=` của trang cũ. Đã đăng
            nhập thì lớp bọc trên chuyển về trang chủ của cổng như trước. */}
        <Route index element={<Login />} />
        {/* Quên mật khẩu: người chưa đăng nhập mới cần. */}
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
      </Route>
      <Route
        path="*"
        element={
          <Suspense fallback={<FullPageSpinner label="Đang tải" />}>
            <SignedInRoutes ready={ready} />
          </Suspense>
        }
      />
    </Routes>
  );
}

/** Chọn MỘT lần lúc gắn vào: bản đã tải sẵn (không treo) hoặc bản `lazy` — đổi giữa chừng là dựng lại cả ứng dụng. */
function SignedInRoutes({ ready }: { ready: boolean }) {
  const [Signed] = useState<ProtectedComponent | typeof ProtectedRoutes>(() => preloaded ?? ProtectedRoutes);
  return <Signed ready={ready} />;
}
