/**
 * Mảng `resources` truyền cho `<Refine>`. Cây `<Route>` ở `app/router/routes.tsx`
 * phải khớp đường dẫn với mảng này — thêm resource là sửa CẢ HAI file.
 */
import type { ResourceProps } from "@refinedev/core";
import {
  Activity,
  Bell,
  BookOpen,
  Boxes,
  Building2,
  CalendarRange,
  ClipboardCheck,
  ClipboardList,
  Cog,
  FileBarChart,
  FileCog,
  FileInput,
  FileSpreadsheet,
  Gauge,
  GraduationCap,
  Hash,
  KeyRound,
  Landmark,
  LayoutDashboard,
  LibraryBig,
  ListFilter,
  Megaphone,
  Network,
  Plug,
  ScanLine,
  School,
  School as SchoolIcon,
  Settings2,
  ShieldCheck,
  ShoppingCart,
  Stethoscope,
  University,
  Users,
  Wallet,
  Workflow,
  UserCog,
  MonitorCog,
} from "lucide-react";
import { CATALOGS as SHARED_CATALOGS } from "@/features/catalogs";
import { ENUM_CATALOGS } from "@/features/catalogs";
import { ORG_RESOURCES } from "@/features/organization";
import { withModules } from "@/app/resources/modules";
import { withHelp } from "@/app/resources/help";


/**
 * Chỗ của các resource sinh từ registry của feature (không khai tay ở dưới) trong menu
 * của góc nhìn QUẢN LÝ. Thiết bị ở đây là để TRA CỨU toàn địa bàn: màn Thiết bị đã có cây
 * lọc theo đơn vị (cơ quan quản lý → trường), và server vẫn giới hạn theo phạm vi dòng.
 */
const MGMT_PLACEMENT: Record<string, Record<string, unknown>> = {
  equipment: { mgmtParent: "mgmt_equipment", mgmtLabel: "Thiết bị hiện có", mgmtOrder: 1 },
};

/** Mọi resource dựng trên bộ màn danh mục: danh mục dùng chung + dữ liệu trường. */
export const CATALOGS = [...SHARED_CATALOGS, ...ORG_RESOURCES];

/**
 * Resource definitions passed to `<Refine resources={...} />`.
 *
 * A resource maps a name to its action routes. Refine infers the current
 * resource from the URL, which is what lets hooks like `useTable`, `useForm`
 * and the `*Button` components work without being told which resource they are
 * operating on.
 *
 * The resource name is load-bearing twice over. It is the path segment the data
 * provider builds every request from (`/api/{name}`), and it is the first half
 * of the permission code the access control provider asks about
 * (`{name}:read`). Renaming one here means renaming the endpoint and the seeded
 * permission with it.
 *
 * `meta` keys used here:
 *   - `label`     display name in the sidebar, breadcrumb and document title
 *   - `icon`      sidebar and breadcrumb icon (falls back to a generic list icon)
 *   - `parent`    nests this resource under another one (Refine)
 *   - `group`     renders the resource as a sidebar section header
 *                 (convention of `components/refine-ui/layout/sidebar.tsx`,
 *                 not a Refine API)
 *   - `canDelete` declared, but **read by nothing**. It is a Refine resource
 *                 type with no runtime consumer in this UI layer: the list
 *                 action columns render a `<DeleteButton>` outright and so does
 *                 `ShowViewHeader`, both leaving the decision to access control
 *                 (`{resource}:delete`). The values below are therefore inert —
 *                 a resource saying `false` still offers a delete, because the
 *                 seeded `{resource}:delete` code decides. Do not start honouring
 *                 it in one view only; that would give a resource a delete on
 *                 its table and none on its detail page.
 *
 * Adding a resource means touching two places in this file: `resources` below,
 * and the matching `<Route>` entries in `<AppRoutes />`.
 */
export const resources: ResourceProps[] = withHelp(withModules([
  // The landing screen, and the one resource here with nothing behind it: no
  // endpoint, no rows, no permission. It is declared so `useMenu` has an item
  // to render and so the breadcrumb and document title have a label; the code
  // that would otherwise be derived from this name (`dashboard:read`) is
  // suppressed in `providers/access-control.ts`, or the sidebar would hide the
  // item from everybody.
  {
    name: "dashboard",
    list: "/dashboard",
    meta: {
      icon: <LayoutDashboard className="h-4 w-4" />,
      mgmt: 1,
      mgmtLabel: "Tổng quan địa bàn",
    },
  },
  // Góc nhìn QUẢN LÝ (Sở, UBND) không đi theo phân hệ của trường: menu của nó dựng từ
  // `meta.mgmt` (thứ tự mục gốc) và `meta.mgmtParent` (mục con của ba nhóm dưới đây),
  // trong `shared/components/layout/sidebar.tsx`. Ba nhóm này chỉ tồn tại ở góc nhìn đó —
  // không route, không con trong cây của Refine, nên góc nhìn trường không thấy chúng.
  // `meta.audience: "management"` thì ngược lại: ẩn khỏi góc nhìn trường.
  { name: "mgmt_schools", meta: { group: true, mgmt: 2, label: "Trường học", icon: <School className="h-4 w-4" /> } },
  { name: "mgmt_equipment", meta: { group: true, mgmt: 3, label: "Thiết bị", icon: <Boxes className="h-4 w-4" /> } },
  { name: "mgmt_procurement", meta: { group: true, mgmt: 4, label: "Mua sắm", icon: <ShoppingCart className="h-4 w-4" /> } },
  { name: "mgmt_inventory", meta: { group: true, mgmt: 5, label: "Kiểm kê", icon: <ClipboardList className="h-4 w-4" /> } },
  // Bộ báo cáo (P7): một màn cho mọi báo cáo, quyền `reports:read`.
  {
    name: "reports",
    meta: {
      group: true,
      mgmt: 6,
      icon: <FileBarChart className="h-4 w-4" />,
    },
  },
  // Sáu nhóm báo cáo, mỗi nhóm MỘT dòng menu — bấm vào mở báo cáo đầu, các báo cáo trong nhóm là thanh tab
  // trên đầu trang, như Danh mục dùng chung. Nhóm không còn báo cáo nào sau lọc quyền thì không hiện.
  ...(
    [
      ["rpt_assets", "Thiết bị", <Boxes className="h-4 w-4" />],
      ["rpt_procurement", "Mua sắm & định mức", <ShoppingCart className="h-4 w-4" />],
      ["rpt_facilities", "Cơ sở vật chất", <School className="h-4 w-4" />],
    ] as const
  ).map(
    ([name, label, icon]): ResourceProps => ({
      name,
      meta: { label, icon, parent: "reports", module: true, tabsEverywhere: true },
    })
  ),
  // Thứ tự theo yêu cầu báo cáo của Sở: tài sản (tổng hợp, trạng thái, tình
  // trạng, giá trị), cơ sở vật chất, hư hỏng, kiểm kê, bảo trì - sửa chữa, biến động - điều chuyển - mượn trả,
  // khai thác, mua sắm, định mức, chất lượng dữ liệu; chứng từ và ghi giảm đứng cuối. Cùng thứ tự với
  // `ReportService.DEFINITIONS` ở máy chủ.
  {
    name: "report_equipment_by_school",
    list: "/reports/equipment-by-school",
    meta: { icon: <School className="h-4 w-4" />, parent: "rpt_assets" },
  },
  {
    name: "report_equipment_by_catalog",
    list: "/reports/equipment-by-catalog",
    meta: { icon: <Boxes className="h-4 w-4" />, parent: "rpt_assets" },
  },
  {
    name: "report_equipment_by_status",
    list: "/reports/equipment-by-status",
    meta: { icon: <Activity className="h-4 w-4" />, parent: "rpt_assets" },
  },
  {
    name: "report_equipment_by_condition",
    list: "/reports/equipment-by-condition",
    meta: { icon: <Stethoscope className="h-4 w-4" />, parent: "rpt_assets" },
  },
  {
    name: "report_equipment_list",
    list: "/reports/equipment-list",
    meta: { icon: <ListFilter className="h-4 w-4" />, parent: "rpt_assets" },
  },
  {
    name: "report_equipment_ledger",
    list: "/reports/equipment-ledger",
    meta: { icon: <BookOpen className="h-4 w-4" />, parent: "rpt_assets" },
  },
  {
    name: "report_inventory",
    list: "/reports/inventory",
    meta: { icon: <ClipboardCheck className="h-4 w-4" />, parent: "rpt_assets" },
  },
  {
    name: "report_purchase",
    list: "/reports/purchase",
    meta: { icon: <ShoppingCart className="h-4 w-4" />, parent: "rpt_procurement" },
  },
  {
    name: "report_adequacy",
    list: "/reports/adequacy",
    meta: { icon: <Gauge className="h-4 w-4" />, parent: "rpt_procurement" },
  },
  {
    name: "report_facility_standard",
    list: "/reports/facility-standard",
    meta: { icon: <ShieldCheck className="h-4 w-4" />, parent: "rpt_facilities" },
  },

  // Section header. A resource with no route acts purely as a grouping node:
  // `useMenu` keeps it because it has children (it drops items that have
  // neither a `list` route nor children), and the sidebar renders it as a
  // section because of `meta.group`.
  // Trục tổ chức: Sở/Phòng GD -> Trường. Đây là gốc phân quyền của hệ thống;
  // gần như mọi bảng nghiệp vụ sau này đều trỏ về `schools`.
  {
    name: "organization",
    meta: {
      group: true,
      icon: <University className="h-4 w-4" />,
    },
  },
  // Các PHÂN HỆ nghiệp vụ (Thiết bị, Cấp phát & sử dụng, Mượn trả, Sửa chữa & bảo trì,
  // Mua sắm) được chèn ở đây bởi `withModules` — xem `app/resources/modules.tsx`.
  { name: "__modules__" },
  {
    name: "purchase_proposals",
    list: "/purchase-proposals",
    create: "/purchase-proposals/create",
    edit: "/purchase-proposals/edit/:id",
    show: "/purchase-proposals/show/:id",
    meta: { icon: <ShoppingCart className="h-4 w-4" />, mgmtParent: "mgmt_procurement", mgmtLabel: "Đề xuất mua sắm của trường" },
  },
  {
    name: "procurement_plans",
    list: "/procurement-plans",
    create: "/procurement-plans/create",
    edit: "/procurement-plans/edit/:id",
    show: "/procurement-plans/show/:id",
    meta: { icon: <ClipboardCheck className="h-4 w-4" />, mgmtParent: "mgmt_procurement", mgmtLabel: "Kế hoạch mua sắm" },
  },
  {
    name: "equipment_intakes",
    list: "/equipment-intakes",
    create: "/equipment-intakes/create",
    edit: "/equipment-intakes/edit/:id",
    show: "/equipment-intakes/show/:id",
    meta: {
      canDelete: true,
      icon: <FileInput className="h-4 w-4" />,
    },
  },
  {
    name: "inventory_campaigns",
    list: "/inventory-campaigns",
    create: "/inventory-campaigns/create",
    edit: "/inventory-campaigns/edit/:id",
    show: "/inventory-campaigns/show/:id",
    // `audience: "management"`: đợt kiểm kê là việc của Sở / UBND (phát động, theo dõi tiến độ). Trường thấy
    // các đợt đang mở ngay trên tab Kiểm kê (`CampaignStrip`), nên không có tab riêng ở góc nhìn trường.
    meta: { icon: <Megaphone className="h-4 w-4" />, audience: "management", mgmtParent: "mgmt_inventory", mgmtLabel: "Đợt kiểm kê" },
  },
  {
    name: "inventory_sessions",
    list: "/inventory-sessions",
    create: "/inventory-sessions/create",
    edit: "/inventory-sessions/edit/:id",
    show: "/inventory-sessions/show/:id",
    // Cơ quan quản lý đọc biên bản của các trường (lọc theo trường) ngay cạnh đợt kiểm kê.
    meta: { icon: <ClipboardList className="h-4 w-4" />, mgmtParent: "mgmt_inventory", mgmtLabel: "Biên bản của trường" },
  },
  // Một màn duy nhất cho toàn bộ dữ liệu trường: cây Sở -> Trường -> Cơ sở
  // -> Khối nhà -> Phòng + Cán bộ, Thiết bị. Các màn danh sách rời vẫn còn
  // (thêm/sửa/xem chi tiết đi qua chúng) nhưng ẩn khỏi menu.
  {
    name: "school_explorer",
    list: "/school-explorer",
    meta: {
      icon: <Network className="h-4 w-4" />,
      parent: "organization",
      mgmtParent: "mgmt_schools",
      mgmtLabel: "Tổng quan các trường",
    },
  },
  {
    name: "departments_of_education",
    list: "/departments-of-education",
    create: "/departments-of-education/create",
    edit: "/departments-of-education/edit/:id",
    show: "/departments-of-education/show/:id",
    meta: {
      hide: true,
      canDelete: true,
      icon: <Landmark className="h-4 w-4" />,
      parent: "organization",
      audience: "management",
      mgmtParent: "mgmt_schools",
      mgmtLabel: "Cơ quan quản lý",
      // Tab cuối của nhóm Trường học: danh mục cơ quan, ít khi mở hơn hai tab về trường.
      mgmtOrder: 3,
    },
  },
  {
    name: "schools",
    list: "/schools",
    create: "/schools/create",
    edit: "/schools/edit/:id",
    show: "/schools/show/:id",
    meta: {
      hide: true,
      canDelete: true,
      icon: <SchoolIcon className="h-4 w-4" />,
      parent: "organization",
      mgmtParent: "mgmt_schools",
      mgmtLabel: "Danh sách trường",
      mgmtOrder: 2,
    },
  },

  // Danh mục dùng chung — dữ liệu tham chiếu toàn cục mà mọi trường đều nhìn
  // chung một danh sách.
  //
  // Cây ba cấp theo đúng menu bản Jmix (`menu.catalog.group.*`): nhóm lớn ->
  // nhóm con -> danh mục. Nhóm con là resource KHÔNG có route và KHÔNG có
  // `meta.group`, nên sidebar vẽ nó thành một khối thu gọn được; `useMenu` giữ
  // nó vì nó có con, và bộ lọc quyền của sidebar bỏ nó đi nếu không con nào
  // còn lại — một nhóm rỗng không bao giờ hiện ra.
  {
    name: "catalog",
    meta: {
      mgmt: 7,
      // Mục menu xổ ra các NHÓM (Tổ chức và cơ sở vật chất, Năm học và môn học…); mỗi nhóm là một
      // "phân hệ" — bấm vào mở danh mục đầu của nhóm, các danh mục trong nhóm là thanh tab.
      label: "Danh mục chung",
      icon: <LibraryBig className="h-4 w-4" />,
    },
  },
  ...(
    [
      ["catalog_org", <Building2 className="h-4 w-4" />],
      ["catalog_academic", <CalendarRange className="h-4 w-4" />],
      ["catalog_equip", <Boxes className="h-4 w-4" />],
      ["catalog_finance", <Wallet className="h-4 w-4" />],
      ["catalog_business", <FileCog className="h-4 w-4" />],
      ["catalog_system", <Cog className="h-4 w-4" />],
    ] as const
  ).map(
    ([name, icon]): ResourceProps => ({
      name,
      // `tabsEverywhere`: thanh tab hiện cả ở góc nhìn quản lý — Sở là người khai danh mục.
      meta: { icon, parent: "catalog", module: true, tabsEverywhere: true },
    })
  ),
  {
    name: "education_levels",
    list: "/education-levels",
    create: "/education-levels/create",
    edit: "/education-levels/edit/:id",
    show: "/education-levels/show/:id",
    meta: {
      canDelete: true,
      icon: <GraduationCap className="h-4 w-4" />,
      parent: "catalog_org",
    },
  },
  // Định mức và nhu cầu mua sắm: màn tổng hợp, mượn quyền `purchase_proposals:read`.
  {
    name: "equipment_adequacy",
    list: "/equipment-adequacy",
    meta: { icon: <Gauge className="h-4 w-4" />, mgmtParent: "mgmt_procurement", mgmtLabel: "Tổng hợp đề xuất" },
  },
  // Thiết bị dạy học tối thiểu của TỪNG TRƯỜNG: trường thấy chuẩn của mình (tab "Chuẩn tối thiểu" của
  // phân hệ Thiết bị, cạnh danh sách thiết bị); cơ quan quản lý thấy tổng hợp địa bàn, bấm trường để
  // mở chuẩn của trường đó. Mượn quyền `purchase_proposals:read` như màn Mức đáp ứng định mức.
  {
    name: "equipment_minimum",
    list: "/equipment-minimum",
    meta: {
      icon: <Gauge className="h-4 w-4" />,
      label: "Thiết bị tối thiểu",
      mgmtParent: "mgmt_equipment",
      mgmtLabel: "Đáp ứng tối thiểu",
      mgmtOrder: 2,
    },
  },
  // Tra cứu và in tem: màn hình trên dữ liệu thiết bị, mượn quyền `equipment:read`.
  // Không có mục menu riêng — mở từ nút trên màn Thiết bị. Đường dẫn vẫn giữ vì tem
  // QR đã in trỏ về `/equipment-lookup`.
  {
    name: "equipment_lookup",
    list: "/equipment-lookup",
    meta: { icon: <ScanLine className="h-4 w-4" />, parent: "equipment_mgmt", hide: true },
  },
  // Các danh mục cùng hình dạng CatalogEntity. Sinh từ `CATALOGS` — cùng mảng
  // mà cây <Route> bên dưới dùng — nên hai nửa của khai báo không thể lệch.
  ...CATALOGS.flatMap((c): ResourceProps[] => [
    {
      name: c.resource,
      list: c.path,
      create: `${c.path}/create`,
      edit: `${c.path}/edit/:id`,
      show: `${c.path}/show/:id`,
      meta: {
        canDelete: true,
        icon: <c.icon className="h-4 w-4" />,
        parent: c.group,
        hide: c.hidden,
        // Tài chính: Nguồn hình thành · Nguồn kinh phí · Hình thức mua (nguồn kinh phí là danh mục cố định, khai ở sau).
        tabOrder: c.resource === "origin_sources" ? 1 : c.resource === "acquisition_methods" ? 3 : undefined,
        countResource: c.countResource,
        countFilters: c.countFilters,
      },
    },
  ]),
  // Danh mục cố định, chỉ đọc: chỉ có màn danh sách.
  ...ENUM_CATALOGS.map(
    (c): ResourceProps => ({
      name: c.resource,
      list: c.path,
      meta: {
        icon: <c.icon className="h-4 w-4" />,
        parent: c.group,
        // Danh mục cố định theo quy định: chỉ đọc với mọi người. Phần lớn không lên menu hay thanh tab — chúng
        // chỉ là lựa chọn trong ô chọn của form; đường dẫn vẫn mở được. `visible` thì hiện thành tab của nhóm.
        fixed: true,
        hide: !c.visible,
        tabOrder: c.resource === "funding_sources" ? 2 : undefined,
      },
    })
  ),

  // Administration. The whole section disappears for anyone without the
  // matching permissions -- but not by itself: `useMenu` does not consult
  // access control, so `sidebar.tsx` filters the tree it returns. See
  // `useAccessibleMenuItems` there.
  {
    name: "administration",
    meta: {
      group: true,
      mgmt: 8,
      icon: <Settings2 className="h-4 w-4" />,
    },
  },
  // Nhập dữ liệu đầu vào của một trường qua vùng chờ: tải tệp nhiều trang, sửa trên hệ thống, ghi, hoàn tác.
  // Dòng riêng, đứng đầu Quản trị hệ thống — việc làm thường xuyên, không giấu sau thanh tab.
  {
    name: "data_imports",
    list: "/data-imports",
    show: "/data-imports/:id",
    meta: { icon: <FileSpreadsheet className="h-4 w-4" />, parent: "administration" },
  },
  // Các nhóm con, mỗi nhóm MỘT dòng menu — bấm vào mở mục đầu, các mục trong nhóm là thanh tab trên đầu trang
  // (`module-tabs.tsx`), như Danh mục dùng chung. Nhóm không còn mục nào sau lọc quyền thì không hiện.
  ...(
    [
      ["admin_accounts", "Tài khoản & phân quyền", <UserCog className="h-4 w-4" />],
      ["admin_config", "Cấu hình", <Cog className="h-4 w-4" />],
      ["admin_data", "Tích hợp", <Plug className="h-4 w-4" />],
      ["admin_monitor", "Giám sát hệ thống", <MonitorCog className="h-4 w-4" />],
    ] as const
  ).map(
    ([name, label, icon]): ResourceProps => ({
      name,
      meta: { label, icon, parent: "administration", module: true, tabsEverywhere: true },
    })
  ),
  // Quy tắc mã của trường (phòng, khối nhà, cơ sở, cán bộ) — trong Quản trị hệ thống, cạnh "Quy tắc
  // sinh mã" của danh mục dùng chung (như Jmix: mọi cấu hình mã ở một chỗ). Cũng mở được từ nút
  // "Quy tắc mã" trên bàn làm việc của trường.
  // Tài khoản của trường — lãnh đạo trường quản trị tài khoản DƯỚI CẤP TRƯỜNG (school_users:*, 092).
  {
    name: "school_users",
    list: "/school-users",
    meta: {
      icon: <Users className="h-4 w-4" />,
      parent: "admin_accounts",
    },
  },
  // Luồng phê duyệt của từng loại phiếu — Sở cấu hình (approval_flows:*, 110).
  {
    name: "approval_flows",
    list: "/approval-flows",
    meta: {
      icon: <Workflow className="h-4 w-4" />,
      parent: "admin_config",
    },
  },
  {
    name: "school_code_rules",
    list: "/school-code-rules",
    meta: {
      icon: <Hash className="h-4 w-4" />,
      parent: "admin_config",
    },
  },
  {
    name: "users",
    list: "/users",
    create: "/users/create",
    edit: "/users/edit/:id",
    show: "/users/show/:id",
    meta: {
      canDelete: true,
      icon: <Users className="h-4 w-4" />,
      parent: "admin_accounts",
    },
  },
  {
    name: "roles",
    list: "/roles",
    create: "/roles/create",
    edit: "/roles/edit/:id",
    show: "/roles/show/:id",
    meta: {
      canDelete: true,
      icon: <ShieldCheck className="h-4 w-4" />,
      parent: "admin_accounts",
    },
  },
  // Read-only: a list and a show, and no create, edit or delete action. The
  // absent actions are what stops the screen promising something the API will
  // not do — a permission only means something once an endpoint checks for it,
  // so the catalogue is written by migrations. Refine derives no route it was
  // not given, and `permissions:write` / `permissions:delete` are not codes any
  // migration seeds, so the buttons would be hidden even if they were.
  {
    name: "permissions",
    list: "/permissions",
    show: "/permissions/show/:id",
    meta: {
      canDelete: false,
      icon: <KeyRound className="h-4 w-4" />,
      parent: "admin_accounts",
    },
  },
  {
    name: "notifications",
    list: "/notifications",
    meta: {
      canDelete: true,
      mgmt: 9,
      icon: <Bell className="h-4 w-4" />,
    },
  },
], "__modules__").map((r) => (MGMT_PLACEMENT[r.name] ? { ...r, meta: { ...r.meta, ...MGMT_PLACEMENT[r.name] } } : r)));
