import { CalendarClock, DoorOpen, GraduationCap, Hammer, Hotel, IdCard, PackageSearch, School as SchoolIcon, UsersRound } from "lucide-react";

import type { CatalogConfig } from "@/shared/components/catalog/types";
import { EQUIPMENT_EXTRA } from "@/features/organization/resources/equipment-extra";
import { BUILDING_EXTRA, CAMPUS_EXTRA, ROOM_EXTRA } from "@/features/organization/resources/facility-extra";
import { STAFF_EXTRA } from "@/features/organization/resources/staff-extra";
import { SCHOOL_CLASS_EXTRA } from "@/features/organization/resources/class-extra";
import { SUBJECT_TEAM_EXTRA } from "@/features/organization/resources/team-extra";
import { FACILITY_WORK_EXTRA } from "@/features/organization/resources/work-extra";
import { withWorkHistory, withWorkHistoryTab } from "@/features/organization/resources/work-history";
import { MAINTENANCE_EXTRA } from "@/features/organization/resources/maintenance-extra";

/**
 * Dữ liệu CỦA TỪNG TRƯỜNG dựng trên bộ màn danh mục dùng chung: cán bộ, cơ sở,
 * khối nhà, phòng, thiết bị. Ẩn khỏi menu — vào qua màn Tổng quan trường học.
 * `routes.tsx` sinh route/resource từ mảng này, như `CATALOGS`.
 */
export const ORG_RESOURCES: CatalogConfig[] = [
  {
    resource: "staff",
    hidden: true,
    path: "/staff",
    group: "organization",
    icon: IdCard,
    label: "Cán bộ, giáo viên",
    description: "Nhân sự của trường.",
    codeExample: "CB0001",
    nameExample: "Nguyễn Văn A",
    nameRule: "PERSON_NAME",
    nameLabel: "Họ tên",
    // Trưởng nhóm chốt 12/11/2026: mã tối đa 20, họ tên 2–50 (khớp StaffRequest).
    codeMax: 20,
    nameMax: 50,
    codeAuto: true,
  },
  {
    resource: "campuses",
    hidden: true,
    path: "/campuses",
    group: "organization",
    icon: SchoolIcon,
    label: "Cơ sở",
    description: "Các điểm trường.",
    codeExample: "CS1",
    nameExample: "Cơ sở chính",
    codeAuto: true,
  },
  {
    resource: "buildings",
    hidden: true,
    path: "/buildings",
    group: "organization",
    icon: Hotel,
    label: "Khối nhà",
    description: "Các khối nhà trong trường.",
    codeExample: "KA",
    nameExample: "Khối A",
    codeAuto: true,
  },
  {
    resource: "rooms",
    hidden: true,
    path: "/rooms",
    group: "organization",
    icon: DoorOpen,
    label: "Phòng",
    description: "Phòng học và phòng chức năng.",
    codeExample: "Chọn khối nhà và tầng",
    nameExample: "Phòng 101",
    codeAuto: true,
    hideSortOrder: true,
    // Trần riêng của phòng (chốt 12/11/2026) — RoomService.MAX_CODE / MAX_NAME / MAX_NOTE.
    codeMax: 20,
    nameMax: 100,
    noteMax: 255,
  },
  {
    resource: "subject_teams",
    hidden: true,
    path: "/subject-teams",
    group: "organization",
    icon: UsersRound,
    label: "Tổ bộ môn",
    description: "Các tổ bộ môn của trường: tổ trưởng, môn phụ trách, giáo viên.",
    codeExample: "TO01",
    nameExample: "Tổ Khoa học tự nhiên",
    nameLabel: "Tên tổ",
    codeAuto: true,
    hideSortOrder: true,
  },
  {
    resource: "facility_works",
    hidden: true,
    path: "/facility-works",
    group: "organization",
    icon: Hammer,
    label: "Sửa chữa, cải tạo",
    description: "Danh sách sửa chữa, cải tạo, nâng cấp công trình của trường.",
    codeExample: "SC001",
    nameExample: "Sơn lại dãy nhà A",
    nameLabel: "Nội dung công việc",
    codeAuto: true,
    hideSortOrder: true,
  },
  {
    resource: "school_classes",
    hidden: true,
    path: "/school-classes",
    group: "organization",
    icon: GraduationCap,
    label: "Lớp học",
    description: "Các lớp học của trường theo năm học.",
    codeLabel: "Tên lớp",
    codeWidth: "8rem",
    codeExample: "6A1",
    // Tên lớp có dấu và khoảng trắng được.
    codePattern: { value: /^[\p{L}\p{N}._-][\p{L}\p{N}._ /-]*$/u, message: "Chỉ dùng chữ, số, khoảng trắng và . _ - /" },
    nameExample: "Lớp 6A1",
    hideName: true,
    hideSortOrder: true,
  },
  {
    resource: "equipment",
    pageForm: true,
    path: "/equipment",
    group: "equipment_mgmt",
    icon: PackageSearch,
    label: "Thiết bị",
    description: "Hồ sơ thiết bị của trường.",
    codeExample: "79.A1.08.TB.001.25",
    codeReadOnly: "Mã được cấp tự động theo chuẩn của Sở, không sửa tay.",
    nameExample: "Máy chiếu Epson EB-X51",
  },
  {
    resource: "maintenance_plans",
    // Trang riêng, không hộp thoại: kế hoạch có bảng nhiều tài sản, cần chỗ.
    pageForm: true,
    path: "/maintenance-plans",
    group: "ops_maintenance",
    icon: CalendarClock,
    label: "Kế hoạch bảo trì",
    description: "Lịch bảo trì định kỳ thiết bị và phòng. Được nhắc trước hạn 7 ngày.",
    codeExample: "BT-MC-01",
    nameExample: "Vệ sinh máy chiếu phòng 101",
  },
];

const EXTRAS: Record<string, CatalogConfig["extra"]> = {
  staff: STAFF_EXTRA,
  campuses: CAMPUS_EXTRA,
  buildings: BUILDING_EXTRA,
  rooms: ROOM_EXTRA,
  school_classes: SCHOOL_CLASS_EXTRA,
  subject_teams: SUBJECT_TEAM_EXTRA,
  facility_works: FACILITY_WORK_EXTRA,
  equipment: EQUIPMENT_EXTRA,
  maintenance_plans: MAINTENANCE_EXTRA,
};
for (const c of ORG_RESOURCES) c.extra = EXTRAS[c.resource];

// Hồ sơ phòng, khối nhà, cơ sở có lịch sử sửa chữa, cải tạo của chính nó và nút ghi ngay tại đó.
const works = ORG_RESOURCES.find((c) => c.resource === "facility_works")!;
for (const [resource, level] of [["rooms", "room"], ["buildings", "building"], ["campuses", "campus"]] as const) {
  const extra = EXTRAS[resource]!;
  extra.ShowBelow = withWorkHistory(level, works, extra.ShowBelow);
  extra.ShowTabs = withWorkHistoryTab(level, works, extra.ShowTabs);
}
