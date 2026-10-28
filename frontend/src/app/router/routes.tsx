import { Authenticated } from "@refinedev/core";
import { Navigate, Outlet, Route, Routes } from "react-router";

import { Login } from "@/features/identity";
import { FullPageSpinner } from "@/shared/components/spinner";
import { ErrorComponent } from "@/shared/components/layout/error-component";
import { Layout } from "@/shared/components/layout/layout";

/**
 * Cây route vẽ bên trong `<Refine>`. Mọi đường dẫn ở đây phải khớp với các
 * action route khai trong `resources` (`app/resources`).
 *
 * Hai nửa: mọi thứ dưới `<Authenticated>` cần phiên đăng nhập và vẽ trong khung
 * Layout; màn đăng nhập nằm ngoài, vẽ trơn.
 */
export function AppRoutes() {
  return (
    <Routes>
      <Route
        element={
          <Authenticated
            key="authenticated-routes"
            redirectOnFail="/login"
            loading={<FullPageSpinner label="Đang kiểm tra đăng nhập" />}
          >
            <Layout>
              <Outlet />
            </Layout>
          </Authenticated>
        }
      >
        {/* Trang chủ để trống; thay bằng màn hình nghiệp vụ khi dựng. */}
        <Route index element={null} />
        <Route path="*" element={<ErrorComponent />} />
      </Route>

      <Route
        element={
          <Authenticated key="unauthenticated-routes" fallback={<Outlet />}>
            <Navigate to="/" replace />
          </Authenticated>
        }
      >
        <Route path="/login" element={<Login />} />
      </Route>
    </Routes>
  );
}
