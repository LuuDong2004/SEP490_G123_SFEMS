/**
 * PHÂN HỆ nghiệp vụ: sidebar chỉ hiện tên phân hệ; bấm vào thì mở trang có THANH TAB
 * gồm các chức năng của phân hệ đó (`shared/components/layout/module-tabs.tsx`).
 *
 * Ý tưởng lấy từ cách MISA EMIS gom chức năng (xem `docs/tham-khao/misa/`), nhưng NỘI
 * DUNG gom theo luồng nghiệp vụ của ta (`docs/phantich/03-luong-nghiep-vu.pdf`): vòng đời
 * tài sản (ghi tăng, kiểm kê) và mua sắm. Tab "Quy trình" của
 * mỗi phân hệ nói bước nào ai LẬP, ai DUYỆT ở cấp nào — thứ MISA không có vì họ chỉ phục
 * vụ một trường, còn ta có trường → Sở.
 *
 * Đây là NƠI DUY NHẤT khai báo resource nào thuộc phân hệ nào và đứng thứ mấy trong thanh
 * tab: `withModules` ghi đè `meta.parent`, `tabLabel`, `tabOrder` cho các resource đó, nên
 * không phải sửa rải rác từng khai báo resource.
 */
import type { ResourceProps } from "@refinedev/core";
import type { ReactNode } from "react";
import { MonitorSmartphone, ShoppingCart, Workflow } from "lucide-react";

import type { ProcessConfig } from "@/shared/components/process/process-page";

type ModuleDef = {
  /** Tên resource nhóm — cũng là `meta.parent` của các tab. */
  name: string;
  label: string;
  icon: ReactNode;
  /** Tab mở ra khi bấm phân hệ ở sidebar (không phải Quy trình: người dùng đến để làm việc). */
  home: string;
  /** [resource, nhãn tab] theo thứ tự hiển thị. Tab đầu luôn là Quy trình. */
  tabs: [string, string][];
  process: ProcessConfig;
};

const icon = (I: typeof Workflow) => <I className="h-4 w-4" />;

export const MODULES: ModuleDef[] = [
  {
    name: "equipment_mgmt",
    label: "Thiết bị",
    icon: icon(MonitorSmartphone),
    home: "equipment",
    tabs: [
      ["process_equipment", "Quy trình"],
      ["equipment", "Danh sách thiết bị"],
      // Hồ sơ năm học không ở đây: lớp, phân công, phòng theo điểm trường là dữ liệu của TRƯỜNG — tab "Năm học" của
      // màn Trường học (`SchoolWorkspace`).
      ["equipment_minimum", "Chuẩn tối thiểu"],
      ["equipment_intakes", "Ghi tăng"],
      ["inventory_campaigns", "Đợt kiểm kê"],
      ["inventory_sessions", "Kiểm kê"],
    ],
    process: {
      title: "Quy trình quản lý thiết bị",
      steps: [
        { resource: "equipment_intakes", title: "Ghi tăng", maker: "Cán bộ thiết bị", approver: "Lãnh đạo trường", result: "Thiết bị có mã, hồ sơ riêng; vật tư cộng theo lô.", handoff: "Thiết bị mới" },
        { resource: "equipment", title: "Bổ sung hồ sơ", maker: "Cán bộ thiết bị", optional: true, result: "Cho thiết bị nhập từ tệp còn thiếu thông tin.", handoff: "Hồ sơ đủ" },
        { resource: "inventory_campaigns", title: "Mở đợt kiểm kê", maker: "Chuyên viên Sở", optional: true, result: "Trường nhận đợt kèm hạn nộp.", handoff: "Đợt kiểm kê" },
        { resource: "inventory_sessions", title: "Kiểm kê tại trường", maker: "Cán bộ thiết bị", approver: "Lãnh đạo trường", result: "Ghi thừa, thiếu, tình trạng của từng thiết bị." },
      ],
      catalogs: ["equipment_standards", "equipment_types", "units", "rooms", "origin_sources"],
      reports: ["report_equipment_by_school", "report_equipment_by_status", "report_equipment_list", "report_inventory"],
    },
  },
  {
    name: "mod_procurement",
    label: "Mua sắm",
    icon: icon(ShoppingCart),
    home: "purchase_proposals",
    tabs: [
      ["process_procurement", "Quy trình"],
      ["equipment_adequacy", "Định mức & nhu cầu"],
      ["purchase_proposals", "Đề xuất mua sắm"],
      ["procurement_plans", "Kế hoạch mua sắm"],
    ],
    process: {
      title: "Quy trình mua sắm",
      steps: [
        { resource: "equipment_adequacy", title: "Đối chiếu định mức", maker: "Trường hoặc Sở", result: "Thấy loại còn thiếu.", handoff: "Loại còn thiếu" },
        { resource: "purchase_proposals", title: "Đề xuất mua sắm", maker: "Cán bộ thiết bị", approver: "Lãnh đạo trường, rồi Lãnh đạo Sở", result: "Chờ vào kế hoạch.", handoff: "Đề xuất đã duyệt" },
        { resource: "procurement_plans", title: "Kế hoạch mua sắm", maker: "Chuyên viên Sở", approver: "Lãnh đạo Sở", result: "Duyệt xong thì đề xuất cũng xong.", handoff: "Kế hoạch đã duyệt" },
        { resource: "equipment_intakes", title: "Ghi tăng khi hàng về", maker: "Cán bộ thiết bị", approver: "Lãnh đạo trường", result: "Làm ở tab Ghi tăng." },
      ],
      catalogs: ["equipment_standards", "equipment_types"],
      reports: ["report_adequacy", "report_purchase"],
    },
  },
];

/** Tên resource của trang Quy trình → phân hệ, để router dựng đúng trang. */
export const PROCESS_BY_ROUTE = Object.fromEntries(
  MODULES.map((m) => [m.tabs[0][0].replace("process_", ""), m])
) as Record<string, ModuleDef>;

/**
 * Chèn các resource nhóm phân hệ và trang Quy trình vào chỗ `anchor`, rồi ghi đè
 * `parent`/`tabLabel`/`tabOrder` của mọi resource là tab của một phân hệ.
 */
export function withModules(resources: ResourceProps[], anchor: string): ResourceProps[] {
  const tabOf = new Map<string, { module: string; label: string; order: number }>();
  for (const m of MODULES) m.tabs.forEach(([r, label], i) => tabOf.set(r, { module: m.name, label, order: i }));

  const moduleResources: ResourceProps[] = MODULES.flatMap((m) => [
    { name: m.name, meta: { group: true, module: true, home: m.home, label: m.label, icon: m.icon } },
    {
      name: m.tabs[0][0],
      list: `/modules/${m.tabs[0][0].replace("process_", "")}`,
      meta: { label: "Quy trình", icon: <Workflow className="h-4 w-4" />, process: true, companion: true },
    },
  ]);

  const out: ResourceProps[] = [];
  for (const r of resources) {
    if (r.name === anchor) out.push(...moduleResources);
    else out.push(r);
  }
  return out.map((r) => {
    const tab = tabOf.get(r.name);
    return tab ? { ...r, meta: { ...r.meta, parent: tab.module, tabLabel: tab.label, tabOrder: tab.order } } : r;
  });
}
