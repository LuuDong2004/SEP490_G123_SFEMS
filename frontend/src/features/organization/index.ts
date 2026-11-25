/** Trục tổ chức và dữ liệu của từng trường: Sở, trường, màn Tổng quan, cán bộ/cơ sở vật chất/thiết bị. */
import { lazyNamed } from "@/shared/lib/lazy-named";

export { ORG_RESOURCES } from "./resources/registry";

// Màn hình: tải khi mở tới (mỗi thư mục một chunk) — xem `lazyNamed`.
export const FacilityLookup = lazyNamed(() => import("./resources/facility-qr"), "FacilityLookup");
export const EquipmentAdequacy = lazyNamed(() => import("./purchase-proposals/adequacy"), "EquipmentAdequacy");
export const EquipmentMinimum = lazyNamed(() => import("./minimum-standard/page"), "EquipmentMinimum");
export const StaffAssignmentsPage = lazyNamed(() => import("./school-year/page"), "StaffAssignmentsPage");
export const SchoolYearProfilePage = lazyNamed(() => import("./school-year/page"), "SchoolYearProfilePage");
export const SchoolExplorer = lazyNamed(() => import("./explorer"), "SchoolExplorer");
export const SchoolCodeRulesPage = lazyNamed(() => import("./explorer/code-rules"), "SchoolCodeRulesPage");
export const SchoolUsersPage = lazyNamed(() => import("./explorer/school-users"), "SchoolUsersPage");
export const ProcurementPlanList = lazyNamed(() => import("./procurement-plans/pages"), "ProcurementPlanList");
export const ProcurementPlanCreate = lazyNamed(() => import("./procurement-plans/pages"), "ProcurementPlanCreate");
export const ProcurementPlanEdit = lazyNamed(() => import("./procurement-plans/pages"), "ProcurementPlanEdit");
export const ProcurementPlanShow = lazyNamed(() => import("./procurement-plans/pages"), "ProcurementPlanShow");
export const PurchaseProposalList = lazyNamed(() => import("./purchase-proposals/pages"), "PurchaseProposalList");
export const PurchaseProposalCreate = lazyNamed(() => import("./purchase-proposals/pages"), "PurchaseProposalCreate");
export const PurchaseProposalEdit = lazyNamed(() => import("./purchase-proposals/pages"), "PurchaseProposalEdit");
export const PurchaseProposalShow = lazyNamed(() => import("./purchase-proposals/pages"), "PurchaseProposalShow");
export const InventoryCampaignList = lazyNamed(() => import("./inventory-campaigns/pages"), "InventoryCampaignList");
export const InventoryCampaignCreate = lazyNamed(() => import("./inventory-campaigns/pages"), "InventoryCampaignCreate");
export const InventoryCampaignEdit = lazyNamed(() => import("./inventory-campaigns/pages"), "InventoryCampaignEdit");
export const InventoryCampaignShow = lazyNamed(() => import("./inventory-campaigns/pages"), "InventoryCampaignShow");
export const InventorySessionList = lazyNamed(() => import("./inventory-sessions"), "InventorySessionList");
export const InventorySessionCreate = lazyNamed(() => import("./inventory-sessions"), "InventorySessionCreate");
export const InventorySessionEdit = lazyNamed(() => import("./inventory-sessions"), "InventorySessionEdit");
export const InventorySessionShow = lazyNamed(() => import("./inventory-sessions"), "InventorySessionShow");
export const DepartmentOfEducationList = lazyNamed(() => import("./departments-of-education/list"), "DepartmentOfEducationList");
export const DepartmentOfEducationCreate = lazyNamed(() => import("./departments-of-education/create"), "DepartmentOfEducationCreate");
export const DepartmentOfEducationEdit = lazyNamed(() => import("./departments-of-education/edit"), "DepartmentOfEducationEdit");
export const DepartmentOfEducationShow = lazyNamed(() => import("./departments-of-education/show"), "DepartmentOfEducationShow");
export const SchoolList = lazyNamed(() => import("./schools/list"), "SchoolList");
export const SchoolCreate = lazyNamed(() => import("./schools/create"), "SchoolCreate");
export const SchoolEdit = lazyNamed(() => import("./schools/edit"), "SchoolEdit");
export const SchoolShow = lazyNamed(() => import("./schools/show"), "SchoolShow");
export const EquipmentIntakeList = lazyNamed(() => import("./equipment-intakes"), "EquipmentIntakeList");
export const EquipmentIntakeCreate = lazyNamed(() => import("./equipment-intakes"), "EquipmentIntakeCreate");
export const EquipmentIntakeEdit = lazyNamed(() => import("./equipment-intakes"), "EquipmentIntakeEdit");
export const EquipmentIntakeShow = lazyNamed(() => import("./equipment-intakes"), "EquipmentIntakeShow");
