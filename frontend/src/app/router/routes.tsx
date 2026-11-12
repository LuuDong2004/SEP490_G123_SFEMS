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
import { catalogScreens, ENUM_CATALOGS, EnumCatalogList, MinimumCatalogPage } from "@/features/catalogs";
import { Dashboard } from "@/features/dashboard";
import { AdequacyReportPage, AssetsReport, InventoryReportPage, PurchaseReportPage } from "@/features/reports";
import { CampaignPage, CampaignShow } from "@/features/organization/inventory-campaigns";
import {
  InventorySessionCreate,
  InventorySessionEdit,
  InventorySessionList,
  InventorySessionShow,
} from "@/features/organization/inventory-sessions";
import {
  EquipmentIntakeCreate,
  EquipmentIntakeEdit,
  EquipmentIntakeList,
  EquipmentIntakeShow,
} from "@/features/organization/equipment-intakes";
import { EquipmentEdit, EquipmentList, EquipmentLookup, EquipmentShow } from "@/features/organization/resources";
import { SchoolList } from "@/features/organization/schools/list";
import { SchoolCreate } from "@/features/organization/schools/create";
import { SchoolEdit } from "@/features/organization/schools/edit";
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
        <Route index element={<Dashboard />} />
        {/* Hồ sơ cá nhân, đổi mật khẩu (HT-03): mọi tài khoản đều mở được, không cần quyền riêng. */}
        <Route path="/profile" element={<Profile />} />

        {/* Báo cáo (BC-02 – BC-06): bốn tab cùng quyền reports:read. */}
        {listRoute("/reports/assets", "report_assets", <AssetsReport />)}
        {listRoute("/reports/adequacy", "report_adequacy", <AdequacyReportPage />)}
        {listRoute("/reports/purchase", "report_purchase", <PurchaseReportPage />)}
        {listRoute("/reports/inventory", "report_inventory", <InventoryReportPage />)}
        <Route path="/reports" element={<Navigate to="/reports/assets" replace />} />

        {/* Thiết bị (TS-01 – TS-07) */}
        {crudRoutes("/equipment", "equipment", {
          list: <EquipmentList />,
          // Thiết bị mới vào sổ bằng phiếu ghi tăng, không tạo thẳng (PN-01..03).
          create: <Navigate to="/equipment-intakes/create" replace />,
          edit: <EquipmentEdit />,
          show: <EquipmentShow />,
        })}
        {listRoute("/equipment-lookup", "equipment_lookup", <EquipmentLookup />)}
        <Route path="/data-imports" element={guarded("data_imports")}>
          <Route index element={<PlaceholderScreen />} />
          <Route path="show/:id" element={<PlaceholderScreen />} />
        </Route>

        {/* Mua sắm (NC-01 – NC-07) */}
        {listRoute("/equipment-adequacy", "equipment_adequacy")}
        {crudRoutes("/purchase-proposals", "purchase_proposals")}
        {crudRoutes("/procurement-plans", "procurement_plans")}

        {/* Nhập thiết bị – ghi tăng (PN-01 – PN-03) */}
        {crudRoutes("/equipment-intakes", "equipment_intakes", {
          list: <EquipmentIntakeList />,
          create: <EquipmentIntakeCreate />,
          edit: <EquipmentIntakeEdit />,
          show: <EquipmentIntakeShow />,
        })}

        {/* Kiểm kê (KK-01 – KK-07) */}
        {crudRoutes("/inventory-campaigns", "inventory_campaigns", {
          list: <CampaignPage />, create: <CampaignPage />, edit: <CampaignPage />, show: <CampaignShow />,
        })}
        {crudRoutes("/inventory-sessions", "inventory_sessions", {
          list: <InventorySessionList />, create: <InventorySessionCreate />,
          edit: <InventorySessionEdit />, show: <InventorySessionShow />,
        })}

        {/* Trường học & cơ sở vật chất (TC-01, TC-02) */}
        {crudRoutes("/schools", "schools", {
          list: <SchoolList />,
          create: <SchoolCreate />,
          edit: <SchoolEdit />,
        })}
        {crudRoutes("/rooms", "rooms")}

        {/* Danh mục dùng chung (DM-01 – DM-04). `/catalogs` mở thẳng danh mục thiết bị. */}
        <Route path="/catalogs" element={<Navigate to="/catalogs/equipment-catalogs" replace />} />
        {crudRoutes("/catalogs/wards", "wards", catalogScreens("wards"))}
        {crudRoutes("/catalogs/education-levels", "education_levels", catalogScreens("education_levels"))}
        {crudRoutes("/catalogs/room-types", "room_types", catalogScreens("room_types"))}
        {crudRoutes("/catalogs/school-types", "school_types", catalogScreens("school_types"))}
        {crudRoutes("/catalogs/school-years", "school_years", catalogScreens("school_years"))}
        {crudRoutes("/catalogs/semesters", "semesters", catalogScreens("semesters"))}
        {crudRoutes("/catalogs/grades", "grades", catalogScreens("grades"))}
        {crudRoutes("/catalogs/subject-groups", "subject_groups", catalogScreens("subject_groups"))}
        {crudRoutes("/catalogs/subjects", "subjects", catalogScreens("subjects"))}
        {crudRoutes("/catalogs/equipment-types", "equipment_types", catalogScreens("equipment_types"))}
        {crudRoutes("/catalogs/units", "units", catalogScreens("units"))}
        {crudRoutes("/catalogs/equipment-configs", "equipment_configs", catalogScreens("equipment_configs"))}
        {crudRoutes("/catalogs/equipment-catalogs", "equipment_catalogs", catalogScreens("equipment_catalogs"))}
        {crudRoutes("/catalogs/equipment-standards", "equipment_standards", {
          list: <MinimumCatalogPage />, create: <MinimumCatalogPage />,
          edit: <MinimumCatalogPage />, show: <MinimumCatalogPage />,
        })}
        {crudRoutes("/catalogs/equipment-norms", "equipment_norms", catalogScreens("equipment_norms"))}
        {crudRoutes("/catalogs/origin-sources", "origin_sources", catalogScreens("origin_sources"))}
        {crudRoutes("/catalogs/acquisition-methods", "acquisition_methods", catalogScreens("acquisition_methods"))}
        {crudRoutes("/catalogs/movement-reasons", "movement_reasons", catalogScreens("movement_reasons"))}
        {crudRoutes("/catalogs/code-rules", "code_rules", catalogScreens("code_rules"))}
        {/* Danh mục cố định, chỉ đọc: chỉ có màn danh sách. */}
        {ENUM_CATALOGS.map((catalog) => (
          <Route key={catalog.resource} path={catalog.path} element={<EnumCatalogList config={catalog} />} />
        ))}

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
