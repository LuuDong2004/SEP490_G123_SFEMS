/**
 * Mảng `resources` truyền cho `<Refine>`. Cây `<Route>` ở `app/router/routes.tsx` phải khớp
 * đường dẫn với mảng này. MENU CỦA CẢ NHÓM nằm ở đây: thêm màn = sửa CẢ HAI file, và báo người
 * giữ file này (DongLV) trước khi đổi tên resource.
 *
 * Tên resource là đoạn đường dẫn API (`/api/{name}`) và nửa đầu mã quyền (`{name}:read`), nên
 * dùng gạch dưới; đường dẫn màn hình dùng gạch nối. Mã quyền của mọi resource dưới đây đã seed ở
 * changelog 006; màn không có quyền thì sidebar tự ẩn.
 *
 * Cách sidebar đọc `meta`:
 *   - `group: true`   nhóm xổ xuống (Trường học & CSVC, Quản trị hệ thống)
 *   - `module: true`  PHÂN HỆ: một dòng trên sidebar, các con là thanh TAB trên đầu trang
 *                     (`shared/components/layout/module-tabs.tsx`); `home` là tab mở mặc định
 *   - `hub: "/..."`   nhóm có trang lối vào: một dòng mở trang đó, các con hiện ở cột trái của
 *                     trang (`hub-shell.tsx`) — dùng cho Danh mục dùng chung
 *   - `parent`        đặt resource dưới nhóm / phân hệ nào
 *   - `label`         tên trên menu, tab, breadcrumb; `tabLabel` riêng cho tab
 *   - `hide: true`    có route nhưng không lên menu (vd. định mức nằm trong bộ danh mục tối thiểu)
 *   - `companion`     trang đi kèm không có mã quyền riêng (trang lối vào của hub)
 */
import type { ResourceProps } from "@refinedev/core";
import {
  ArrowRightLeft,
  Banknote,
  Bell,
  BookOpen,
  Boxes,
  Building2,
  CalendarRange,
  ClipboardCheck,
  ClipboardList,
  DoorOpen,
  FileBarChart,
  FileCog,
  FileInput,
  FileSpreadsheet,
  Gauge,
  GraduationCap,
  Hash,
  LayoutDashboard,
  LayoutGrid,
  Layers,
  LibraryBig,
  ListChecks,
  MapPin,
  Megaphone,
  Package,
  Ruler,
  ScanLine,
  School,
  Settings2,
  ShieldCheck,
  ShoppingCart,
  Tag,
  University,
  Users,
} from "lucide-react";

const icon = (Icon: React.ComponentType<{ className?: string }>) => <Icon className="h-4 w-4" />;

/** Bốn màn list/create/edit/show theo quy ước đường dẫn gạch nối. */
const crud = (name: string, path: string) => ({
  name,
  list: path,
  create: `${path}/create`,
  edit: `${path}/edit/:id`,
  show: `${path}/show/:id`,
});

export const resources: ResourceProps[] = [
  // ── Bảng điều khiển (BC-01, QuangTD). Không có mã quyền: ai đăng nhập cũng mở được, từng khối
  //    số liệu tự gác bằng quyền của resource bên trong.
  {
    name: "dashboard",
    list: "/",
    meta: { label: "Bảng điều khiển", icon: icon(LayoutDashboard) },
  },

  // ── Báo cáo (BC-02 – BC-06, QuangTD): một phân hệ, bốn báo cáo là bốn tab, cùng quyền reports:read.
  //    Tên `report_*` được `permissionFor` quy về `reports`.
  { name: "reports", meta: { label: "Báo cáo", icon: icon(FileBarChart), module: true, home: "report_assets" } },
  { name: "report_assets", list: "/reports/assets", meta: { label: "Tài sản thiết bị", icon: icon(Boxes), parent: "reports", tabOrder: 1 } },
  { name: "report_adequacy", list: "/reports/adequacy", meta: { label: "Đáp ứng danh mục tối thiểu", icon: icon(Gauge), parent: "reports", tabOrder: 2 } },
  { name: "report_purchase", list: "/reports/purchase", meta: { label: "Nhu cầu và kế hoạch mua sắm", icon: icon(ShoppingCart), parent: "reports", tabOrder: 3 } },
  { name: "report_inventory", list: "/reports/inventory", meta: { label: "Kết quả kiểm kê", icon: icon(ClipboardCheck), parent: "reports", tabOrder: 4 } },

  // ── Thiết bị (TS-01 – TS-07, NghiaNV)
  { name: "equipment_mgmt", meta: { label: "Thiết bị", icon: icon(Boxes), module: true, home: "equipment" } },
  { ...crud("equipment", "/equipment"), meta: { label: "Thiết bị", tabLabel: "Danh sách thiết bị", icon: icon(Boxes), parent: "equipment_mgmt", tabOrder: 1 } },
  // Tra cứu theo mã (TS-02) mượn quyền equipment:read (xem `PERMISSION_ALIASES`).
  { name: "equipment_lookup", list: "/equipment-lookup", meta: { label: "Tra cứu theo mã", icon: icon(ScanLine), parent: "equipment_mgmt", tabOrder: 2 } },
  { name: "data_imports", list: "/data-imports", show: "/data-imports/show/:id", meta: { label: "Nhập từ tệp", icon: icon(FileSpreadsheet), parent: "equipment_mgmt", tabOrder: 3 } },

  // ── Mua sắm (NC-01 – NC-07, HoangPND)
  { name: "procurement", meta: { label: "Mua sắm", icon: icon(ShoppingCart), module: true, home: "purchase_proposals" } },
  // Mức đáp ứng định mức (NC-01) mượn quyền purchase_proposals:read.
  { name: "equipment_adequacy", list: "/equipment-adequacy", meta: { label: "Mức đáp ứng định mức", icon: icon(Gauge), parent: "procurement", tabOrder: 1 } },
  { ...crud("purchase_proposals", "/purchase-proposals"), meta: { label: "Đề xuất mua sắm", icon: icon(ClipboardList), parent: "procurement", tabOrder: 2 } },
  { ...crud("procurement_plans", "/procurement-plans"), meta: { label: "Kế hoạch mua sắm", icon: icon(ClipboardCheck), parent: "procurement", tabOrder: 3 } },

  // ── Nhập thiết bị – ghi tăng tài sản (PN-01 – PN-03, DongLV). Phân hệ một tab: thanh tab tự ẩn.
  { name: "intake", meta: { label: "Nhập thiết bị", icon: icon(FileInput), module: true, home: "equipment_intakes" } },
  { ...crud("equipment_intakes", "/equipment-intakes"), meta: { label: "Phiếu nhập thiết bị", icon: icon(FileInput), parent: "intake", tabOrder: 1 } },

  // ── Kiểm kê (KK-01 – KK-07, TuTN)
  { name: "inventory", meta: { label: "Kiểm kê", icon: icon(ClipboardList), module: true, home: "inventory_sessions" } },
  { ...crud("inventory_campaigns", "/inventory-campaigns"), meta: { label: "Đợt kiểm kê", icon: icon(Megaphone), parent: "inventory", tabOrder: 1 } },
  { ...crud("inventory_sessions", "/inventory-sessions"), meta: { label: "Phiếu kiểm kê", icon: icon(ClipboardList), parent: "inventory", tabOrder: 2 } },

  // ── Trường học & cơ sở vật chất (TC-01, TC-02, HoangPND)
  { name: "organization", meta: { label: "Trường học & cơ sở vật chất", icon: icon(University), group: true } },
  { ...crud("schools", "/schools"), meta: { label: "Trường học", icon: icon(School), parent: "organization" } },
  { ...crud("rooms", "/rooms"), meta: { label: "Phòng", icon: icon(DoorOpen), parent: "organization" } },

  // ── Danh mục dùng chung (DM-01 – DM-04, TuTN): một dòng menu mở trang hub `/catalogs`; cột trái
  //    của trang liệt kê các danh mục theo bốn nhóm (`module: true` dưới hub).
  { name: "catalog", meta: { label: "Danh mục dùng chung", icon: icon(LibraryBig), group: true, hub: "/catalogs" } },
  { name: "catalogs", list: "/catalogs", meta: { label: "Tổng quan danh mục", icon: icon(LayoutGrid), parent: "catalog", companion: true } },
  { name: "catalog_org", meta: { label: "Tổ chức và cơ sở vật chất", icon: icon(Building2), parent: "catalog", module: true } },
  { ...crud("wards", "/catalogs/wards"), meta: { label: "Phường/xã", icon: icon(MapPin), parent: "catalog_org" } },
  { ...crud("education_levels", "/catalogs/education-levels"), meta: { label: "Cấp học", icon: icon(GraduationCap), parent: "catalog_org" } },
  { ...crud("room_types", "/catalogs/room-types"), meta: { label: "Loại phòng", icon: icon(DoorOpen), parent: "catalog_org" } },
  { name: "catalog_academic", meta: { label: "Năm học và môn học", icon: icon(CalendarRange), parent: "catalog", module: true } },
  { ...crud("school_years", "/catalogs/school-years"), meta: { label: "Năm học", icon: icon(CalendarRange), parent: "catalog_academic" } },
  { ...crud("grades", "/catalogs/grades"), meta: { label: "Khối lớp", icon: icon(Layers), parent: "catalog_academic" } },
  { ...crud("subjects", "/catalogs/subjects"), meta: { label: "Môn học", icon: icon(BookOpen), parent: "catalog_academic" } },
  { name: "catalog_equip", meta: { label: "Thiết bị", icon: icon(Package), parent: "catalog", module: true } },
  { ...crud("equipment_types", "/catalogs/equipment-types"), meta: { label: "Loại thiết bị", icon: icon(Tag), parent: "catalog_equip" } },
  { ...crud("units", "/catalogs/units"), meta: { label: "Đơn vị tính", icon: icon(Ruler), parent: "catalog_equip" } },
  { ...crud("equipment_catalogs", "/catalogs/equipment-catalogs"), meta: { label: "Danh mục thiết bị", icon: icon(Package), parent: "catalog_equip" } },
  { ...crud("equipment_standards", "/catalogs/equipment-standards"), meta: { label: "Danh mục tối thiểu và định mức", icon: icon(ListChecks), parent: "catalog_equip" } },
  // Dòng định mức (DM-03) nằm trong màn bộ danh mục tối thiểu, có route riêng nhưng không lên cột trái.
  { ...crud("equipment_norms", "/catalogs/equipment-norms"), meta: { label: "Định mức thiết bị", icon: icon(ListChecks), parent: "catalog_equip", hide: true } },
  { name: "catalog_business", meta: { label: "Nghiệp vụ", icon: icon(FileCog), parent: "catalog", module: true } },
  { ...crud("origin_sources", "/catalogs/origin-sources"), meta: { label: "Nguồn hình thành", icon: icon(Banknote), parent: "catalog_business" } },
  { ...crud("acquisition_methods", "/catalogs/acquisition-methods"), meta: { label: "Phương thức hình thành", icon: icon(ShoppingCart), parent: "catalog_business" } },
  { ...crud("movement_reasons", "/catalogs/movement-reasons"), meta: { label: "Lý do biến động", icon: icon(ArrowRightLeft), parent: "catalog_business" } },
  { ...crud("code_rules", "/catalogs/code-rules"), meta: { label: "Quy tắc sinh mã", icon: icon(Hash), parent: "catalog_business" } },

  // ── Quản trị hệ thống (HT-04, HT-05, DongLV)
  { name: "administration", meta: { label: "Quản trị hệ thống", icon: icon(Settings2), group: true } },
  { ...crud("users", "/users"), meta: { label: "Người dùng", icon: icon(Users), parent: "administration" } },
  { ...crud("roles", "/roles"), meta: { label: "Vai trò", icon: icon(ShieldCheck), parent: "administration" } },

  // ── Thông báo (HT-06, QuangTD): chuông trên đầu trang và trang danh sách.
  { name: "notifications", list: "/notifications", meta: { label: "Thông báo", icon: icon(Bell) } },
];
