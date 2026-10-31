import { Authenticated, CanAccess } from "@refinedev/core";
import { Navigate, Outlet, Route, Routes } from "react-router";

import {
  RoleCreate,
  RoleEdit,
  RoleList,
  RoleShow,
  UserCreate,
  UserEdit,
  UserList,
  UserShow,
} from "@/features/administration";
import { Login, Profile } from "@/features/identity";
import { Forbidden } from "@/shared/components/layout/forbidden";
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
        {/* Hồ sơ cá nhân, đổi mật khẩu (HT-03): mọi tài khoản đều mở được, không cần quyền riêng. */}
        <Route path="/profile" element={<Profile />} />

        {/* Quản trị hệ thống. <CanAccess> chỉ để đường dẫn gõ tay hiện đúng màn "không có quyền";
            API vẫn kiểm cùng quyền ở mọi yêu cầu. */}
        <Route
          path="/users"
          element={
            <CanAccess resource="users" action="list" fallback={<Forbidden resource="users" />}>
              <Outlet />
            </CanAccess>
          }
        >
          <Route index element={<UserList />} />
          <Route path="create" element={<UserCreate />} />
          <Route path="edit/:id" element={<UserEdit />} />
          <Route path="show/:id" element={<UserShow />} />
        </Route>
        <Route
          path="/roles"
          element={
            <CanAccess resource="roles" action="list" fallback={<Forbidden resource="roles" />}>
              <Outlet />
            </CanAccess>
          }
        >
          <Route index element={<RoleList />} />
          <Route path="create" element={<RoleCreate />} />
          <Route path="edit/:id" element={<RoleEdit />} />
          <Route path="show/:id" element={<RoleShow />} />
        </Route>
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
