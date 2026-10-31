import { Authenticated, CanAccess } from "@refinedev/core";
import type { ReactNode } from "react";
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
import { PlaceholderScreen } from "@/shared/components/layout/placeholder-screen";

/**
 * Cây route vẽ bên trong `<Refine>`. Mọi đường dẫn ở đây phải khớp với các action route khai
 * trong `resources` (`app/resources`). Menu đã dựng đủ cho 42 UC; màn chưa làm trỏ tới
 * `PlaceholderScreen` ("Tính năng đang phát triển"). NGƯỜI PHỤ TRÁCH THAY PLACEHOLDER CỦA MÌNH
 * BẰNG COMPONENT THẬT qua tham số `screens`, không đổi đường dẫn, không đổi tên resource.
 *
 * Hai nửa: mọi thứ dưới `<Authenticated>` cần phiên đăng nhập và vẽ trong khung Layout; màn
 * đăng nhập nằm ngoài, vẽ trơn.
 */

/** Bọc một nhánh route bằng kiểm quyền đọc của resource: gõ tay đường dẫn thì ra màn "không có quyền". */
function guarded(resource: string) {
  return (
    <CanAccess resource={resource} action="list" fallback={<Forbidden resource={resource} />}>
      <Outlet />
    </CanAccess>
  );
}

/**
 * Bốn route list/create/edit/show của một resource. `screens` cho phép thay từng màn; màn nào
 * chưa có thì dùng placeholder.
 */
function crudRoutes(
  path: string,
  resource: string,
  screens: Partial<Record<"list" | "create" | "edit" | "show", ReactNode>> = {},
) {
  const ph = <PlaceholderScreen />;
  return (
    <Route path={path} element={guarded(resource)}>
      <Route index element={screens.list ?? ph} />
      <Route path="create" element={screens.create ?? ph} />
      <Route path="edit/:id" element={screens.edit ?? ph} />
      <Route path="show/:id" element={screens.show ?? ph} />
    </Route>
  );
}

/** Một route danh sách (màn không có thêm/sửa). */
function listRoute(path: string, resource: string, screen?: ReactNode) {
  return (
    <Route path={path} element={guarded(resource)}>
      <Route index element={screen ?? <PlaceholderScreen />} />
    </Route>
  );
}

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
        {/* Bảng điều khiển (BC-01). Không gác quyền: từng khối tự gác. */}
        <Route index element={<PlaceholderScreen />} />
        {/* Hồ sơ cá nhân, đổi mật khẩu (HT-03): mọi tài khoản đều mở được, không cần quyền riêng. */}
        <Route path="/profile" element={<Profile />} />

        {/* Báo cáo (BC-02 – BC-06): bốn tab cùng quyền reports:read. */}
        {listRoute("/reports/assets", "report_assets")}
        {listRoute("/reports/adequacy", "report_adequacy")}
        {listRoute("/reports/purchase", "report_purchase")}
        {listRoute("/reports/inventory", "report_inventory")}
        <Route path="/reports" element={<Navigate to="/reports/assets" replace />} />

        {/* Thiết bị (TS-01 – TS-07) */}
        {crudRoutes("/equipment", "equipment")}
        {listRoute("/equipment-lookup", "equipment_lookup")}
        <Route path="/data-imports" element={guarded("data_imports")}>
          <Route index element={<PlaceholderScreen />} />
          <Route path="show/:id" element={<PlaceholderScreen />} />
        </Route>

        {/* Mua sắm (NC-01 – NC-07) */}
        {listRoute("/equipment-adequacy", "equipment_adequacy")}
        {crudRoutes("/purchase-proposals", "purchase_proposals")}
        {crudRoutes("/procurement-plans", "procurement_plans")}

        {/* Nhập thiết bị – ghi tăng (PN-01 – PN-03) */}
        {crudRoutes("/equipment-intakes", "equipment_intakes")}

        {/* Kiểm kê (KK-01 – KK-07) */}
        {crudRoutes("/inventory-campaigns", "inventory_campaigns")}
        {crudRoutes("/inventory-sessions", "inventory_sessions")}

        {/* Trường học & cơ sở vật chất (TC-01, TC-02) */}
        {crudRoutes("/schools", "schools")}
        {crudRoutes("/rooms", "rooms")}

        {/* Danh mục dùng chung (DM-01 – DM-04). Trang lối vào `/catalogs` không có quyền riêng. */}
        <Route path="/catalogs" element={<PlaceholderScreen note="Chọn một danh mục ở cột bên trái." />} />
        {crudRoutes("/catalogs/wards", "wards")}
        {crudRoutes("/catalogs/education-levels", "education_levels")}
        {crudRoutes("/catalogs/room-types", "room_types")}
        {crudRoutes("/catalogs/school-years", "school_years")}
        {crudRoutes("/catalogs/grades", "grades")}
        {crudRoutes("/catalogs/subjects", "subjects")}
        {crudRoutes("/catalogs/equipment-types", "equipment_types")}
        {crudRoutes("/catalogs/units", "units")}
        {crudRoutes("/catalogs/equipment-catalogs", "equipment_catalogs")}
        {crudRoutes("/catalogs/equipment-standards", "equipment_standards")}
        {crudRoutes("/catalogs/equipment-norms", "equipment_norms")}
        {crudRoutes("/catalogs/origin-sources", "origin_sources")}
        {crudRoutes("/catalogs/acquisition-methods", "acquisition_methods")}
        {crudRoutes("/catalogs/movement-reasons", "movement_reasons")}
        {crudRoutes("/catalogs/code-rules", "code_rules")}

        {/* Quản trị hệ thống (HT-04, HT-05) — đã có màn thật. */}
        {crudRoutes("/users", "users", {
          list: <UserList />,
          create: <UserCreate />,
          edit: <UserEdit />,
          show: <UserShow />,
        })}
        {crudRoutes("/roles", "roles", {
          list: <RoleList />,
          create: <RoleCreate />,
          edit: <RoleEdit />,
          show: <RoleShow />,
        })}

        {/* Thông báo (HT-06) */}
        {listRoute("/notifications", "notifications")}

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
