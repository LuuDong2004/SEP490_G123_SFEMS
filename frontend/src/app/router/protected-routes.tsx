import { Authenticated, CanAccess } from "@refinedev/core";
import { getIdentity, homePath } from "@/shared/api/session";
import { Suspense } from "react";
import { FullPageSpinner } from "@/shared/components/spinner";
import { WelcomeSplash } from "@/shared/components/layout/welcome-splash";
import { Navigate, Outlet, Route, Routes, useParams } from "react-router";
import { ProcessPage } from "@/shared/components/process/process-page";
import { PROCESS_BY_ROUTE } from "@/app/resources/modules";

import { WriteGuard } from "@/app/router/write-guard";
import { Dashboard } from "@/features/dashboard";
import { ReportSnapshotList, ReportSnapshotShow, Reports } from "@/features/reports";
import {
  EducationLevelList,
  EducationLevelCreate,
  EducationLevelEdit,
  EducationLevelShow,
} from "@/features/catalogs";
import { CATALOGS } from "@/app/resources";
import { ENUM_CATALOGS } from "@/features/catalogs";

import { EnumCatalogList } from "@/features/catalogs";
import {
  EquipmentAdequacy,
  EquipmentMinimum,
  StaffAssignmentsPage,
  SchoolYearProfilePage,
  SchoolExplorer,
  SchoolCodeRulesPage,
  SchoolUsersPage,
  ProcurementPlanList,
  ProcurementPlanCreate,
  ProcurementPlanEdit,
  ProcurementPlanShow,
  PurchaseProposalList,
  PurchaseProposalCreate,
  PurchaseProposalEdit,
  PurchaseProposalShow,
  InventoryCampaignList,
  InventoryCampaignCreate,
  InventoryCampaignEdit,
  InventoryCampaignShow,
  InventorySessionList,
  InventorySessionCreate,
  InventorySessionEdit,
  InventorySessionShow,
} from "@/features/organization";
import {
  CatalogCreate,
  CatalogEdit,
  CatalogList,
  CatalogShow,
} from "@/shared/components/catalog/pages";
import {
  DepartmentOfEducationList,
  DepartmentOfEducationCreate,
  DepartmentOfEducationEdit,
  DepartmentOfEducationShow,
} from "@/features/organization";
import {
  SchoolList,
  SchoolCreate,
  SchoolEdit,
  SchoolShow,
} from "@/features/organization";
import {
  EquipmentIntakeList,
  EquipmentIntakeCreate,
  EquipmentIntakeEdit,
  EquipmentIntakeShow,
} from "@/features/organization";
import { NotificationList } from "@/features/notifications";
import { UserList, UserCreate, UserEdit, UserShow } from "@/features/administration";
import { RoleList, RoleCreate, RoleEdit, RoleShow } from "@/features/administration";
import { PermissionList, PermissionShow } from "@/features/administration";
import {
  DataImports,
  DataImportBatch,
  NotificationSettingsPage,
  ApprovalFlowsPage,
  MailConfigPage,
} from "@/features/administration";
import { AdminMfaSetup, Profile } from "@/features/identity";
import { ErrorComponent } from "@/shared/components/layout/error-component";
import { Forbidden } from "@/shared/components/layout/forbidden";
import { Layout } from "@/shared/components/layout/layout";


/**
 * Nửa CẦN ĐĂNG NHẬP của cây route — tách khỏi `routes.tsx` để tải sau (`React.lazy` ở đó): màn đăng
 * nhập không phải mang theo khung ứng dụng, registry danh mục và mọi màn nghiệp vụ.
 *
 * `ready`: `resources` của `<Refine>` cũng tải sau (`App.tsx`). Khung chỉ vẽ khi chúng đã có, nếu không
 * menu trống và `useTable` không suy ra được resource từ URL trong một khung hình.
 */
export default function ProtectedRoutes({ ready }: { ready: boolean }) {
  return (
    <Routes>
      <Route
        element={
          <Authenticated
            key="authenticated-routes"
            redirectOnFail="/login"
            // Trong lúc `check` đang chạy, mặc định của Refine là KHÔNG vẽ gì —
            // một trang trắng im lặng mà người dùng không biết là đang chờ hay
            // đã hỏng. Mỗi lần tải trang đều đi qua đây một lần.
            loading={<FullPageSpinner label="Đang kiểm tra đăng nhập" />}
          >
            {/* Lời chào đặt NGOÀI khung: vừa đăng nhập xong là hiện ngay, che cả lúc khung / màn Tổng hợp còn đang tải —
                không lần lượt chớp màn "Đang tải" có logo rồi mới tới màn chào cũng có logo. */}
            <WelcomeSplash />
            {getIdentity()?.mfaSetupRequired ? (
              // Quản trị viên chưa bật xác thực qua email (cổng Admin cách ly): máy chủ chặn mọi API khác, nên mọi địa chỉ chỉ
              // mở màn bật xác thực qua email — không khung, không menu.
              <Suspense fallback={<FullPageSpinner label="Đang tải" />}>
                <AdminMfaSetup />
              </Suspense>
            ) : ready ? (
              <Layout>
                {/* Màn hình là chunk tải khi mở tới (`lazyNamed`): khung vẫn đứng, chỉ vùng nội dung chờ. */}
                <Suspense fallback={<FullPageSpinner label="Đang tải" />}>
                  <WriteGuard>
                    <Outlet />
                  </WriteGuard>
                </Suspense>
              </Layout>
            ) : (
              <FullPageSpinner label="Đang tải" />
            )}
          </Authenticated>
        }
      >
        {/*
          The application opens on the dashboard rather than on a resource's
          table. `Navigate` rather than `NavigateToResource`, because the
          dashboard is a screen and not a resource: there is no `list` action to
          resolve a path from beyond the one declared above.
        */}
        <Route index element={<Navigate to={homePath()} replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        {/* Trang Quy trình của từng phân hệ — nội dung ở app/resources/modules.tsx */}
        <Route path="/modules/:module" element={<ModuleProcess />} />
        <Route path="/catalogs" element={<Navigate to="/equipment-catalogs" replace />} />
        <Route path="/reports" element={<Navigate to="/reports/equipment-by-school" replace />} />
        <Route
          path="/report-snapshots"
          element={
            <CanAccess resource="reports" action="list" fallback={<Forbidden resource="reports" />}>
              <ReportSnapshotList />
            </CanAccess>
          }
        />
        <Route path="/report-snapshots/show/:id" element={<ReportSnapshotShow />} />
        <Route
          path="/reports/:name"
          element={
            <CanAccess resource="reports" action="list" fallback={<Forbidden resource="reports" />}>
              <Reports />
            </CanAccess>
          }
        />
        <Route path="/school-explorer" element={<SchoolExplorer />} />
        {/* Minh chứng hoạt động tạm ẩn — yêu cầu chưa rõ; xem ghi chú ở app/resources. */}
        <Route
          path="/school-users"
          element={
            <CanAccess resource="school_users" action="list" fallback={<Forbidden resource="school_users" />}>
              <SchoolUsersPage />
            </CanAccess>
          }
        />
        <Route
          path="/approval-flows"
          element={
            <CanAccess resource="approval_flows" action="list" fallback={<Forbidden resource="approval_flows" />}>
              <ApprovalFlowsPage />
            </CanAccess>
          }
        />
        <Route
          path="/school-code-rules"
          element={
            <CanAccess resource="school_code_rules" action="list" fallback={<Forbidden resource="school_code_rules" />}>
              <SchoolCodeRulesPage />
            </CanAccess>
          }
        />

        {/* Danh mục dùng chung. Đường dẫn dùng gạch nối (`/education-levels`)
            còn TÊN RESOURCE dùng gạch dưới (`education_levels`): tên resource
            là thứ đi vào mã quyền và vào đoạn đường dẫn API
            (`/api/education_levels`), hai thứ đó không được lẫn. */}
        <Route
          path="/education-levels"
          element={
            <CanAccess
              resource="education_levels"
              action="list"
              fallback={<Forbidden resource="education_levels" />}
            >
              <Outlet />
            </CanAccess>
          }
        >
          <Route index element={<EducationLevelList />} />
          <Route path="create" element={<EducationLevelCreate />} />
          <Route path="edit/:id" element={<EducationLevelEdit />} />
          <Route path="show/:id" element={<EducationLevelShow />} />
        </Route>
        {CATALOGS.map((c) => (
          <Route
            key={c.resource}
            path={c.path}
            element={
              <CanAccess
                resource={c.resource}
                action="list"
                fallback={<Forbidden resource={c.resource} />}
              >
                <Outlet />
              </CanAccess>
            }
          >
            <Route index element={<CatalogList config={c} />} />
            <Route path="create" element={<CatalogCreate config={c} />} />
            <Route path="edit/:id" element={<CatalogEdit config={c} />} />
            <Route path="show/:id" element={<CatalogShow config={c} />} />
          </Route>
        ))}

        {ENUM_CATALOGS.map((c) => (
          <Route key={c.resource} path={c.path} element={<EnumCatalogList config={c} />} />
        ))}

        {/* Trục tổ chức. Lại một lần nữa: đường dẫn gạch nối, tên resource
            gạch dưới. */}
        <Route
          path="/departments-of-education"
          element={
            <CanAccess
              resource="departments_of_education"
              action="list"
              fallback={<Forbidden resource="departments_of_education" />}
            >
              <Outlet />
            </CanAccess>
          }
        >
          {/* Thêm và sửa lồng DƯỚI danh sách: danh sách vẫn mount sau lớp
              phủ nên bộ lọc, thứ tự và trang đang xem còn nguyên khi đóng hộp
              thoại. Xem chi tiết thì không — nó là một trang thật, có khung
              trường trực thuộc riêng. */}
          <Route element={<DepartmentOfEducationList />}>
            <Route index element={null} />
            <Route path="create" element={<DepartmentOfEducationCreate />} />
            <Route path="edit/:id" element={<DepartmentOfEducationEdit />} />
          </Route>
          <Route path="show/:id" element={<DepartmentOfEducationShow />} />
        </Route>
        <Route
          path="/schools"
          element={
            <CanAccess
              resource="schools"
              action="list"
              fallback={<Forbidden resource="schools" />}
            >
              <Outlet />
            </CanAccess>
          }
        >
          {/* Thêm / Sửa là hộp thoại mở trên danh sách (route lồng, danh sách ở lại phía sau). */}
          <Route element={<SchoolList />}>
            <Route index element={null} />
            <Route path="create" element={<SchoolCreate />} />
            <Route path="edit/:id" element={<SchoolEdit />} />
          </Route>
          <Route path="show/:id" element={<SchoolShow />} />
        </Route>

        {/* Nghiệp vụ thiết bị. Phiếu nhập có đủ bốn màn; tồn kho chỉ có danh
            sách, đúng bằng những gì API cho phép. */}
        <Route
          path="/equipment-intakes"
          element={
            <CanAccess
              resource="equipment_intakes"
              action="list"
              fallback={<Forbidden resource="equipment_intakes" />}
            >
              <Outlet />
            </CanAccess>
          }
        >
          <Route index element={<EquipmentIntakeList />} />
          <Route path="create" element={<EquipmentIntakeCreate />} />
          <Route path="edit/:id" element={<EquipmentIntakeEdit />} />
          <Route path="show/:id" element={<EquipmentIntakeShow />} />
        </Route>

        {/*
          Administration — plain full-page routes, each wrapped
          in `<CanAccess>`. The sidebar already hides these, so the guard only
          matters for a typed or bookmarked URL: without it the screen would
          render and the list request would 403, leaving an empty table and a
          toast instead of an explanation.

          This is a courtesy, not the boundary. The API checks the same
          permission on every request regardless of what renders here.
        */}
        <Route
          path="/users"
          element={
            <CanAccess
              resource="users"
              action="list"
              fallback={<Forbidden resource="users" />}
            >
              <Outlet />
            </CanAccess>
          }
        >
          {/* Thêm người dùng là hộp thoại mở trên danh sách — danh sách vẫn đứng sau. */}
          <Route element={<UserList />}>
            <Route index element={null} />
            <Route path="create" element={<UserCreate />} />
          </Route>
          <Route path="edit/:id" element={<UserEdit />} />
          <Route path="show/:id" element={<UserShow />} />
        </Route>
        <Route
          path="/roles"
          element={
            <CanAccess
              resource="roles"
              action="list"
              fallback={<Forbidden resource="roles" />}
            >
              <Outlet />
            </CanAccess>
          }
        >
          <Route index element={<RoleList />} />
          <Route path="create" element={<RoleCreate />} />
          <Route path="edit/:id" element={<RoleEdit />} />
          <Route path="show/:id" element={<RoleShow />} />
        </Route>
        <Route
          path="/inventory-sessions"
          element={
            <CanAccess resource="inventory_sessions" action="list" fallback={<Forbidden resource="inventory_sessions" />}>
              <Outlet />
            </CanAccess>
          }
        >
          <Route index element={<InventorySessionList />} />
          <Route path="create" element={<InventorySessionCreate />} />
          <Route path="edit/:id" element={<InventorySessionEdit />} />
          <Route path="show/:id" element={<InventorySessionShow />} />
        </Route>
        <Route
          path="/inventory-campaigns"
          element={
            <CanAccess resource="inventory_campaigns" action="list" fallback={<Forbidden resource="inventory_campaigns" />}>
              <Outlet />
            </CanAccess>
          }
        >
          {/* Phát động / sửa đợt là hộp thoại mở trên danh sách — ít ô, danh sách vẫn đứng sau. */}
          <Route element={<InventoryCampaignList />}>
            <Route index element={null} />
            <Route path="create" element={<InventoryCampaignCreate />} />
            <Route path="edit/:id" element={<InventoryCampaignEdit />} />
          </Route>
          <Route path="show/:id" element={<InventoryCampaignShow />} />
        </Route>
        <Route
          path="/purchase-proposals"
          element={
            <CanAccess resource="purchase_proposals" action="list" fallback={<Forbidden resource="purchase_proposals" />}>
              <Outlet />
            </CanAccess>
          }
        >
          <Route index element={<PurchaseProposalList />} />
          <Route path="create" element={<PurchaseProposalCreate />} />
          <Route path="edit/:id" element={<PurchaseProposalEdit />} />
          <Route path="show/:id" element={<PurchaseProposalShow />} />
        </Route>
        <Route
          path="/procurement-plans"
          element={
            <CanAccess resource="procurement_plans" action="list" fallback={<Forbidden resource="procurement_plans" />}>
              <Outlet />
            </CanAccess>
          }
        >
          <Route index element={<ProcurementPlanList />} />
          <Route path="create" element={<ProcurementPlanCreate />} />
          <Route path="edit/:id" element={<ProcurementPlanEdit />} />
          <Route path="show/:id" element={<ProcurementPlanShow />} />
        </Route>
        <Route
          path="/equipment-adequacy"
          element={
            <CanAccess resource="equipment_adequacy" action="list" fallback={<Forbidden resource="purchase_proposals" />}>
              <EquipmentAdequacy />
            </CanAccess>
          }
        />
        <Route
          path="/staff-assignments"
          element={
            <CanAccess resource="staff_assignments" action="list" fallback={<Forbidden resource="staff_assignments" />}>
              <StaffAssignmentsPage />
            </CanAccess>
          }
        />
        <Route
          path="/school-year-profile"
          element={
            <CanAccess resource="school_year_profiles" action="list" fallback={<Forbidden resource="school_year_profiles" />}>
              <SchoolYearProfilePage />
            </CanAccess>
          }
        />
        {/* Màn Tiến độ hồ sơ năm học đã bỏ (năm học chọn trên header, trạng thái năm của một trường ở trang trường đó). */}
        <Route path="/school-year-progress" element={<Navigate to="/school-explorer" replace />} />
        <Route
          path="/equipment-minimum"
          element={
            <CanAccess resource="equipment_minimum" action="list" fallback={<Forbidden resource="purchase_proposals" />}>
              <EquipmentMinimum />
            </CanAccess>
          }
        />
        {/* "Số lượng tối thiểu" đã gộp vào Danh mục thiết bị tối thiểu (trưởng nhóm 17/11/2026) — địa chỉ cũ chuyển sang đó. */}
        <Route path="/norm-matrix" element={<Navigate to="/equipment-standards" replace />} />
        <Route
          path="/data-imports"
          element={
            <CanAccess resource="data_imports" action="list" fallback={<Forbidden resource="data_imports" />}>
              <DataImports />
            </CanAccess>
          }
        />
        <Route
          path="/data-imports/:id"
          element={
            <CanAccess resource="data_imports" action="show" fallback={<Forbidden resource="data_imports" />}>
              <DataImportBatch />
            </CanAccess>
          }
        />
        <Route
          path="/notification-settings"
          element={
            <CanAccess
              resource="notification_type_settings"
              action="list"
              fallback={<Forbidden resource="notification_type_settings" />}
            >
              <NotificationSettingsPage />
            </CanAccess>
          }
        />
        <Route
          path="/mail-config"
          element={
            <CanAccess
              resource="mail_config"
              action="list"
              fallback={<Forbidden resource="mail_config" />}
            >
              <MailConfigPage />
            </CanAccess>
          }
        />
        <Route
          path="/permissions"
          element={
            <CanAccess
              resource="permissions"
              action="list"
              fallback={<Forbidden resource="permissions" />}
            >
              <Outlet />
            </CanAccess>
          }
        >
          <Route index element={<PermissionList />} />
          <Route path="show/:id" element={<PermissionShow />} />
        </Route>

        {/*
          Notifications have a list and nothing else. No create screen, because
          the application raises a notification rather than a person writing
          one; no edit screen, because the only change a recipient may make is
          marking one read. No <CanAccess> wrapper either: every system role is
          granted notifications:read, and the rows are the caller's own, so
          there is no URL to guard against.
        */}
        <Route path="/notifications" element={<NotificationList />} />

        {/* Not a resource: no list of "my accounts", no id in the URL. */}
        <Route path="/profile" element={<Profile />} />

        <Route path="*" element={<ErrorComponent />} />
      </Route>
    </Routes>
  );
}


/** Trang Quy trình của một phân hệ; tên phân hệ lạ thì về Tổng hợp. */
function ModuleProcess() {
  const { module } = useParams();
  const m = module ? PROCESS_BY_ROUTE[module] : undefined;
  return m ? <ProcessPage config={m.process} /> : <Navigate to="/dashboard" replace />;
}
