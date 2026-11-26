import { useCan, useInvalidate, useList, useNotification } from "@refinedev/core";
import { kyInstance } from "@/shared/api/data";
import { ConfirmContent } from "@/shared/components/confirm/confirm-content";
import { errorMessage } from "@/shared/lib/api-error";
import { AlertDialog } from "@/shared/ui/alert-dialog";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Backpack, CalendarCheck, CircleDashed, BadgeCheck, DoorOpen, Gauge, ListPlus, Hotel, IdCard, School, Warehouse, MapPin, Funnel, UsersRound, X } from "lucide-react";
import type { ReactNode } from "react";

import { Badge } from "@/shared/ui/badge";
import { FillBox } from "@/shared/components/layout/fill-box";
import { usePersistentState } from "@/shared/hooks/use-persistent-state";
import { cn } from "@/shared/lib/utils";
import { Card } from "@/shared/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";
import { IconFilter } from "@/shared/components/data-table/icon-filter";
import { CONDITION_LABELS, STRUCTURE_LABELS, USAGE_STATUS_LABELS, campusKindLabel } from "@/domains/facility/types";
import type { FacilityTodoFilter } from "@/domains/facility/todo";
import { FACILITY_CONDITION_VARIANTS, ROOM_USAGE_VARIANTS } from "@/shared/lib/status-variants";
import { STAFF_TYPE_LABELS, POSITION_LABELS } from "@/domains/staff/types";
import {
  DEPARTMENT_SOURCE_LABELS,
  DEPARTMENT_SOURCE_UNCERTAIN,
  type DepartmentSource,
} from "@/domains/school/types";
import { MiniTable, type MiniChoice, type MiniColumn, type MiniView } from "@/features/organization/explorer/mini-table";
import { CatalogFormDialog, CatalogShowDialog } from "@/shared/components/catalog/pages";
import { ORG_RESOURCES } from "@/features/organization/resources/registry";
import { ClassBoard } from "@/features/organization/explorer/class-board";
import { StudentBoard } from "@/features/organization/explorer/student-board";
import { useSchoolYear } from "@/shared/hooks/use-school-year";
import { FacilityNav, useFacilitySectionTitle } from "@/features/organization/explorer/facility-nav";
import { FacilityAssessment } from "@/features/organization/explorer/facility-assessment";
import { QuickAddBuildings } from "@/features/organization/explorer/quick-add";
import { StaffAccountCell } from "@/features/organization/explorer/staff-account";
import type { FormDialogState } from "@/shared/components/catalog/form-dialog";
import { useMemo, useState } from "react";
import { StaffAssignmentsPanel } from "@/features/organization/school-year/staff-assignments";

/* eslint-disable @typescript-eslint/no-explicit-any */

export type SchoolStats = {
  id: number | null;
  code: string | null;
  name: string;
  ward: string | null;
  staff: number;
  campuses: number;
  buildings: number;
  rooms: number;
  equipment: number;
  equipmentValue: number;
  /** Lớp học đang hoạt động của năm học hiện hành, và tổng sĩ số. */
  classes: number;
  students: number;
};

const num = new Intl.NumberFormat("vi-VN", { useGrouping: false });

// Ô không có giá trị để TRỐNG (không vẽ gạch) — cả cột gạch chỉ là nhiễu. Ô phải khai (kết cấu, sử dụng, hiện trạng)
// thì nói rõ "Chưa khai" vì đó là việc còn phải làm.
const dash = <span className="sr-only">Trống</span>;
const notDeclared = <span className="text-muted-foreground/70 text-xs">Chưa khai</span>;

/** Nhãn trạng thái có màu (cùng bảng màu với cột trạng thái ở danh sách đầy đủ). */
/**
 * Trạng thái BÌNH THƯỜNG (tốt, đang dùng) là chữ thường; chỉ cái cần để ý (cần sửa, xuống cấp, ngừng dùng) mới
 * thành nhãn màu. Cả cột nhãn xanh giống hệt nhau không nói gì — và che mất nhãn vàng / đỏ thật sự cần thấy.
 */
function statusBadge(labels: Record<string, string>, variants: Record<string, any>, value?: string | null) {
  if (!value) return notDeclared;
  const variant = variants[value] ?? "neutral";
  return variant === "success"
    ? <span className="text-muted-foreground">{labels[value] ?? value}</span>
    : <Badge variant={variant}>{labels[value] ?? value}</Badge>;
}

/**
 * Nhãn cảnh báo khi cơ quan quản lý của trường là một PHỎNG ĐOÁN.
 *
 * <p>Phần lớn trường được gán cơ quan quản lý bằng cách suy từ địa chỉ, chứ
 * không theo phân công quản lý do Sở công bố. Một phỏng đoán không được đánh
 * dấu thì sau vài tuần không ai phân biệt nổi nó với dữ liệu thật — nên chỗ
 * nào hiển thị trường, chỗ đó phải nói ra.
 *
 * <p>Chỉ đánh dấu hai nhóm kém chắc nhất. Đánh dấu cả những dòng suy ra 1-1 từ
 * nghị quyết sẽ làm cảnh báo mất giá: cái gì cũng cảnh báo thì không cảnh báo
 * cái gì cả.
 */
export function UncertainDepartment({ source }: { source?: DepartmentSource | null }) {
  if (!source || !DEPARTMENT_SOURCE_UNCERTAIN.includes(source)) return null;
  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>
        <Badge variant="warning" tabIndex={0}>
          <AlertTriangle />
          Chưa xác nhận cơ quan quản lý
        </Badge>
      </TooltipTrigger>
      <TooltipContent side="bottom" tone="light" className="max-w-80">
        {DEPARTMENT_SOURCE_LABELS[source]} Cần Sở xác nhận lại.
      </TooltipContent>
    </Tooltip>
  );
}

function Kpi({ icon: Icon, label, value, tone }: { icon: typeof School; label: string; value: ReactNode; tone?: string }) {
  return (
    <div className="flex items-center gap-3 px-5 py-3.5">
      <Icon className={cn("size-5 shrink-0", tone ?? "text-primary")} />
      <div className="min-w-0">
        <p className="text-muted-foreground truncate text-xs">{label}</p>
        <p className="text-xl leading-tight font-bold tabular-nums">{value}</p>
      </div>
    </div>
  );
}

/**
 * Dải số của màn Tổng quan các trường: TRƯỜNG và CƠ SỞ VẬT CHẤT — trường, cơ sở / điểm trường, khối nhà, phòng.
 * Lớp, cán bộ, thiết bị, nguyên giá không ở đây: chúng là việc của phân hệ Thiết bị và của bàn làm việc từng trường.
 * Dòng tên phạm vi ở trên, các ô ngăn bằng đường kẻ mảnh bên dưới.
 */
export function KpiRow({ s, schools, title, meta }: { s: SchoolStats; schools: number; title?: ReactNode; meta?: ReactNode }) {
  return (
    <Card className="gap-0 py-0">
      {title ? (
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b px-5 py-3">
          <h2 className="text-base font-semibold">{title}</h2>
          {meta ? <span className="text-muted-foreground text-sm">{meta}</span> : null}
        </div>
      ) : null}
      <div className="grid divide-y sm:grid-cols-2 sm:divide-y-0 xl:grid-cols-4 xl:divide-x">
        <Kpi icon={School} label="Trường" value={num.format(schools)} />
        <Kpi icon={Hotel} label="Cơ sở, điểm trường" value={num.format(s.campuses)} />
        <Kpi icon={Warehouse} label="Khối nhà" value={num.format(s.buildings)} />
        <Kpi icon={DoorOpen} label="Phòng" value={num.format(s.rooms)} />
      </div>
    </Card>
  );
}

function useQuickDialog(resource: string, presets: Record<string, unknown>, onSaved?: () => void) {
  const config = ORG_RESOURCES.find((c) => c.resource === resource)!;
  const [state, setState] = useState<FormDialogState>({ open: false });
  const [viewing, setViewing] = useState<number | null>(null);
  // Giá trị điền sẵn riêng của LẦN mở này (vd. loại nhân sự theo tab đang xem).
  const [extra, setExtra] = useState<Record<string, unknown>>({});
  // Thêm / sửa / xoá xong: số trên tab, cột mục tab CSVC, bảng Đánh giá CSVC đọc lại ngay (M2-08, 13/11/2026) —
  // chúng là truy vấn riêng, không tự làm mới theo danh sách phòng.
  const queryClient = useQueryClient();
  const refresh = () => {
    for (const key of ["school_overview", "facility_info", "facility-standard"]) void queryClient.invalidateQueries({ queryKey: [key] });
    onSaved?.();
  };
  // Xoá (M2-10, 13/11/2026): hỏi lại; máy chủ chặn bản ghi còn dùng (phòng còn thiết bị, lớp, lịch sử…) và câu báo
  // của nó hiện nguyên văn — người dùng biết vì sao và làm gì tiếp (chuyển Ngừng sử dụng).
  const { open: notify } = useNotification();
  const invalidate = useInvalidate();
  const [removing, setRemoving] = useState<{ id: number; name?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const remove = async () => {
    if (!removing) return;
    setBusy(true);
    try {
      await kyInstance.delete(`${resource}/${removing.id}`).json();
      notify?.({ type: "success", message: removing.name ? `Đã xoá ${config.label.toLowerCase()} “${removing.name}”` : `Đã xoá ${config.label.toLowerCase()}` });
      await invalidate({ resource, invalidates: ["list", "many"] });
      refresh();
      setRemoving(null);
    } catch (error) {
      // Quy ước toast lỗi: `message` = câu của máy chủ, `description` = kết quả.
      notify?.({ type: "error", message: await errorMessage(error), description: `Không xoá được ${config.label.toLowerCase()}` });
    } finally {
      setBusy(false);
    }
  };
  const element = (
    <>
      <AlertDialog open={removing != null} onOpenChange={(o) => !o && !busy && setRemoving(null)}>
        {removing ? (
          <ConfirmContent tone="danger" title={removing.name ? `Xoá ${config.label.toLowerCase()} “${removing.name}”?` : `Xoá ${config.label.toLowerCase()} này?`}
            description={resource === "students"
              ? "Học sinh ra khỏi danh sách của lớp, sĩ số lớp tự đếm lại. Xoá rồi không lấy lại được."
              : "Chỉ xoá được khi chưa có thiết bị, lớp hay kiểm kê. Xoá rồi không lấy lại được."}
            cancelLabel="Giữ lại" confirmLabel="Xoá" busy={busy} keepOpen onConfirm={() => void remove()} />
        ) : null}
      </AlertDialog>
      <CatalogFormDialog
        config={config}
        state={state}
        onOpenChange={(open) => setState((d) => ({ ...d, open }))}
        presets={{ ...presets, ...extra }}
        onSaved={refresh}
      />
      <CatalogShowDialog
        config={config}
        id={viewing}
        onOpenChange={(open) => !open && setViewing(null)}
        onEdit={(id) => {
          setViewing(null);
          setState({ open: true, id });
        }}
      />
    </>
  );
  return {
    element,
    open: (id?: number, more?: Record<string, unknown>) => {
      setExtra(more ?? {});
      setState({ open: true, id });
    },
    view: (id: number) => setViewing(id),
    remove: (row: { id: number; name?: string }) => setRemoving({ id: row.id, name: row.name }),
  };
}

/** Nhãn "đang lọc" theo một việc của Cần hoàn thiện, có nút bỏ lọc. */
function TodoChip({ title, onClear }: { title: string; onClear: () => void }) {
  return (
    <span className="bg-warning-subtle text-warning-text flex h-8 max-w-full min-w-0 items-center gap-1.5 rounded-full pr-1 pl-3 text-sm font-medium">
      <span className="truncate" title={title}>{title}</span>
      <button type="button" onClick={onClear} aria-label="Bỏ lọc" title="Bỏ lọc"
        className="hover:bg-warning-text/15 flex size-6 shrink-0 items-center justify-center rounded-full">
        <X className="size-3.5" />
      </button>
    </span>
  );
}

// ---------------------------------------------------------------- cột dùng lại

/** Phòng xem theo khối nhà, theo loại phòng, hoặc bảng chi tiết — như "Theo kho/phòng" của màn Thiết bị. */
const ROOM_VIEWS: MiniView[] = [
  {
    key: "building",
    label: "Khối nhà",
    hint: "Phòng gom theo khối nhà, từng tầng",
    lazy: {
      field: "building.id",
      resource: "buildings",
      bySchool: true,
      noneLabel: "Chưa gắn khối nhà",
      icon: (g) => (g ? <Hotel /> : <CircleDashed />),
    },
  },
  {
    key: "type",
    label: "Loại CSVC",
    hint: "Phòng gom theo loại: phòng học, phòng bộ môn, kho…",
    lazy: {
      field: "roomType.id",
      resource: "room_types",
      schoolParam: "schoolId",
      noneLabel: "Chưa phân loại",
      icon: (g) => (!g ? <CircleDashed /> : /kho/i.test(g.name ?? "") ? <Warehouse /> : <DoorOpen />),
    },
  },
  { key: "detail", label: "Danh sách", hint: "Danh sách từng hạng mục, không gom theo khối nhà hay loại" },
];

/** Tên, cắt bớt khi dài (rê chuột xem đủ). */
const nameCell = (r: any) => (
  <span className="flex min-w-0 items-center gap-1.5">
    <span className="truncate" title={r.name}>{r.name}</span>
  </span>
);

/** Loại CSVC; loại trường tự thêm (ngoài danh mục của Sở) có nhãn nhỏ "Ngoài DM" để phân biệt. */
const roomTypeCell = (r: any) => (r.roomType ? (
  <span className="flex min-w-0 items-center gap-1.5">
    <span className="truncate">{r.roomType.name}</span>
    {r.customType ? <Badge variant="warning" className="shrink-0" title="Loại ngoài danh mục của Sở, trường tự thêm">Ngoài DM</Badge> : null}
  </span>
) : dash);

/** Lọc hạng mục theo nguồn loại: trong danh mục của Sở / ngoài danh mục (trường tự thêm). */
const CATALOG_CHOICE: MiniChoice = {
  field: "catalog",
  allLabel: "Tất cả",
  icon: <Funnel />,
  label: "danh mục",
  options: [{ value: "in", label: "Trong danh mục" }, { value: "out", label: "Ngoài danh mục" }],
  menu: true,
};

const roomColumns: MiniColumn[] = [
  { header: "Mã", cell: (r) => <span className="font-medium">{r.code}</span>, className: "w-28" },
  { header: "Tên phòng", cell: nameCell },
  { header: "Khối nhà", cell: (r) => r.building?.name ?? dash },
  { header: "Loại CSVC", cell: roomTypeCell },
  { header: "Kết cấu", cell: (r) => STRUCTURE_LABELS[r.structure] ?? notDeclared, className: "w-28" },
  { header: "Sử dụng", cell: (r) => statusBadge(USAGE_STATUS_LABELS, ROOM_USAGE_VARIANTS, r.usageStatus), className: "w-32" },
  { header: "Hiện trạng", cell: (r) => statusBadge(CONDITION_LABELS, FACILITY_CONDITION_VARIANTS, r.condition), className: "w-28" },
];

/** Hạng mục của một khối — cột như màn khai báo CSDL HCM (tên, loại, hiện trạng kết cấu, diện tích, điểm trường, kết hợp). */
const itemColumns: MiniColumn[] = [
  { header: "Mã", cell: (r) => <span className="font-medium">{r.code}</span>, className: "w-28" },
  { header: "Tên", cell: nameCell },
  { header: "Loại CSVC", cell: roomTypeCell },
  { header: "Kết cấu", cell: (r) => STRUCTURE_LABELS[r.structure] ?? <span className="text-warning-text">Chưa khai</span>, className: "w-24" },
  { header: "Diện tích (m²)", cell: (r) => (r.area != null ? Number(r.area).toLocaleString("vi-VN", { useGrouping: false }) : dash), className: "w-32 text-right" },
  { header: "Điểm trường", cell: (r) => r.campus?.name ?? dash, className: "w-28" },
  { header: "Kết hợp", cell: (r) => r.combinedType?.name ?? dash, className: "w-24" },
  { header: "Hiện trạng", cell: (r) => statusBadge(CONDITION_LABELS, FACILITY_CONDITION_VARIANTS, r.condition), className: "w-28" },
];

const buildingColumns: MiniColumn[] = [
  { header: "Mã", cell: (r) => <span className="font-medium">{r.code}</span>, className: "w-28" },
  { header: "Tên khối nhà", cell: nameCell },
  { header: "Cơ sở", cell: (r) => r.campus?.name ?? dash },
  { header: "Số tầng", cell: (r) => r.floorCount ?? dash, className: "w-20" },
  { header: "Kết cấu", cell: (r) => STRUCTURE_LABELS[r.structure] ?? notDeclared, className: "w-28" },
  { header: "Hiện trạng", cell: (r) => statusBadge(CONDITION_LABELS, FACILITY_CONDITION_VARIANTS, r.condition), className: "w-28" },
];

const campusColumns: MiniColumn[] = [
  { header: "Mã", cell: (r) => <span className="font-medium">{r.code}</span>, className: "w-28" },
  { header: "Tên cơ sở", cell: (r) => r.name },
  { header: "Địa chỉ", cell: (r) => r.address ?? dash },
  { header: "", cell: (r) => (r.primaryCampus ? <Badge variant="info">Trường chính</Badge> : <span className="text-muted-foreground text-sm">{campusKindLabel(r)}</span>), className: "w-28" },
];

const staffColumns: MiniColumn[] = [
  { header: "Mã", cell: (r) => <span className="font-medium">{r.code}</span>, className: "w-40" },
  { header: "Họ tên", cell: (r) => r.name },
  { header: "Loại", cell: (r) => STAFF_TYPE_LABELS[r.staffType] ?? dash, className: "w-28" },
  { header: "Chức vụ", cell: (r) => POSITION_LABELS[r.position] ?? dash },
  { header: "Môn chính", cell: (r) => r.mainSubject?.name ?? dash },
];

/**
 * Tài khoản đăng nhập: cấp / đặt lại mật khẩu / khoá ngay tại dòng (staff_accounts:write). Là việc của
 * lãnh đạo trường và Sở, nên cột chỉ vẽ cho người có quyền đó — cán bộ thiết bị không thấy.
 */
const staffAccountColumn: MiniColumn = {
  header: "Tài khoản",
  cell: (r) => <StaffAccountCell staff={r} />,
  className: "w-24 text-center",
};

const teamColumns: MiniColumn[] = [
  { header: "Mã", cell: (r) => <span className="font-medium">{r.code}</span>, className: "w-24" },
  { header: "Tên tổ", cell: (r) => r.name },
  { header: "Tổ trưởng", cell: (r) => r.leader?.name ?? dash },
  { header: "Môn phụ trách", cell: (r) => (r.subjects ?? []).map((s: any) => s.name).join(", ") || dash },
  { header: "Giáo viên", cell: (r) => r.memberCount ?? 0, className: "w-24 tabular-nums" },
];

const bySchool = (id: number) => [{ field: "school.id", operator: "eq" as const, value: id }];

// ---------------------------------------------------------------- Trường

/**
 * Các bảng con của MỘT trường: hạng mục CSVC, khối nhà, cơ sở, lớp, cán bộ. Thiết bị xem ở phân hệ Thiết bị, không có tab riêng ở đây.
 *
 * <p>Tách khỏi khung chi tiết cũ để trang riêng của trường dùng lại được.
 * Nhận `schoolId` chứ không nhận cả bản ghi: khối này chỉ cần biết lọc theo
 * trường nào, và nhận nguyên bản ghi sẽ buộc mọi nơi gọi phải có sẵn một bản
 * ghi đầy đủ chỉ để hiện một cái bảng.
 *
 * <p>`tab` do bên gọi giữ, vì nó thuộc về địa chỉ trang chứ không thuộc về
 * khối này — mở đúng tab từ một liên kết là việc của trang.
 */
/** Số đếm cạnh tên tab — vắng thì tab chỉ có chữ. */
export type FacilityCounts = Partial<Record<"classes" | "rooms" | "buildings" | "campuses" | "staff" | "teams" | "equipment", number>>;

/**
 * Các tab: Hồ sơ trường (TC-01), Cơ sở vật chất — phòng (TC-02), Đánh giá CSVC theo chuẩn, Nhân sự (cán bộ và
 * tổ bộ môn là cùng một nhóm người — một tab, bên trong có ô chọn nhỏ), Học sinh (304 — chỉ tài khoản được xem học
 * sinh, tức vai loại trường), và Năm học (hồ sơ năm học: xác nhận từng điểm
 * trường, chốt năm — chỉ khi bên gọi đưa nội dung, tức tài khoản của chính trường).
 */
const TAB_DEFS = [
  { value: "profile", label: "Hồ sơ trường", icon: School, count: null },
  { value: "facilities", label: "Cơ sở vật chất", icon: DoorOpen, count: "rooms" },
  { value: "assessment", label: "Đánh giá CSVC", icon: BadgeCheck, count: null },
  { value: "people", label: "Nhân sự", icon: IdCard, count: "staff" },
  { value: "students", label: "Học sinh", icon: Backpack, count: "students" },
  { value: "year", label: "Năm học", icon: CalendarCheck, count: null },
] as const;

const FACILITY_PARTS = [
  { value: "info", label: "Thông tin chung", icon: Gauge },
  { value: "rooms", label: "Phòng, hạng mục", count: "rooms", icon: DoorOpen },
  { value: "buildings", label: "Khối nhà", count: "buildings", icon: Hotel },
  { value: "campuses", label: "Cơ sở", count: "campuses", icon: MapPin },
  { value: "standard", label: "Chuẩn CSVC", icon: BadgeCheck },
  { value: "statistics", label: "Biểu số liệu", icon: BadgeCheck },
] as const;
const PEOPLE_PARTS = [
  { value: "staff", label: "Cán bộ, giáo viên", count: "staff", icon: IdCard },
  { value: "teams", label: "Tổ bộ môn", count: "teams", icon: UsersRound },
  { value: "assignments", label: "Phân công năm học", count: null, icon: UsersRound },
] as const;

/** Giá trị tab cũ (`rooms`, `staff`… — đã lưu trong trình duyệt, hoặc trên liên kết) thuộc tab gộp nào. */
function groupOf(tab: string): string {
  // Phần cũ của tab Cơ sở vật chất nay là tab riêng: thông tin chung → Hồ sơ trường, chuẩn / biểu số liệu → Đánh giá.
  if (tab === "info") return "profile";
  if (tab === "standard" || tab === "statistics") return "assessment";
  // "classes": tab Lớp học cũ — lớp nay là một mục của cột trái Cơ sở vật chất (lớp gắn với phòng học).
  if (tab === "classes" || FACILITY_PARTS.some((p) => p.value === tab)) return "facilities";
  if (PEOPLE_PARTS.some((p) => p.value === tab)) return "people";
  return TAB_DEFS.some((t) => t.value === tab) ? tab : "profile";
}

export function SchoolFacilityTabs({
  schoolId,
  tab,
  onTab,
  counts,
  header,
  profile,
  year,
}: {
  schoolId: number;
  tab: string;
  onTab: (t: string) => void;
  counts?: FacilityCounts;
  /** Thẻ đầu của trường (tên, cấp học) — nằm DƯỚI dải tab, trên nội dung của tab. */
  header?: ReactNode;
  /** Nội dung tab Hồ sơ trường (thông tin, ban giám hiệu, quy mô) — do màn của trường dựng. */
  profile?: ReactNode;
  /** Nội dung tab Năm học (hồ sơ năm học, chốt năm). Vắng thì không có tab này. */
  year?: ReactNode;
}) {
  // Học sinh (304): chỉ tài khoản được xem danh sách học sinh (vai loại trường) có tab này.
  const mayStudents = useCan({ resource: "students", action: "list" }).data?.can ?? false;
  const tabs = TAB_DEFS.filter((t) => (t.value !== "year" || year) && (t.value !== "students" || mayStudents));
  const group = groupOf(tab);
  const active = (group === "year" && !year) || (group === "students" && !mayStudents) ? "profile" : group;
  const q = `?school.id=${schoolId}`;
  const campusDialog = useQuickDialog("campuses", { school: { id: schoolId } });
  const buildingDialog = useQuickDialog("buildings", { school: { id: schoolId } });
  const roomDialog = useQuickDialog("rooms", { school: { id: schoolId } });
  // Thêm nhân sự: người dùng chọn Loại (Giáo viên / Cán bộ) trong form; mặc định Giáo viên theo `STAFF_EXTRA.defaults`.
  const staffDialog = useQuickDialog("staff", { school: { id: schoolId } });
  const mayManageAccounts = useCan({ resource: "staff_accounts", action: "edit" }).data?.can ?? false;
  const mayAssign = useCan({ resource: "staff_assignments", action: "list" }).data?.can ?? false;
  // Lớp học ít trường: thêm / xem / sửa trong hộp thoại, không rời màn trường. Bấm một lớp là
  // xem chi tiết; nút Sửa trong đó mở form sửa (cùng khuôn với thêm mới).
  const classDialog = useQuickDialog("school_classes", { school: { id: schoolId } });
  const invalidateClasses = useInvalidate();
  // Thêm, chuyển lớp, xoá học sinh là sĩ số lớp đổi: bảng lớp đọc lại.
  const studentDialog = useQuickDialog("students", { school: { id: schoolId } },
    () => void invalidateClasses({ resource: "school_classes", invalidates: ["list", "many", "detail"] }));
  const { id: workingYear } = useSchoolYear();
  const { result: studentTotal } = useList<any>({
    resource: "students",
    filters: [...bySchool(schoolId), ...(workingYear != null ? [{ field: "schoolYear.id", operator: "eq" as const, value: workingYear }] : [])],
    pagination: { pageSize: 1 },
    queryOptions: { enabled: mayStudents },
  });
  // Lớp học ở phòng nào: bảng hạng mục có cột "Lớp" — mở Phòng học tập là thấy phòng của lớp nào. Một trường vài chục
  // lớp, đọc một lần.
  const { result: classResult } = useList<any>({
    resource: "school_classes",
    filters: bySchool(schoolId),
    pagination: { pageSize: 500 },
  });
  const classesByRoom = useMemo(() => {
    const map = new Map<number, string[]>();
    for (const c of classResult?.data ?? []) {
      if (c.room?.id == null) continue;
      // Tên lớp ngắn (6A1), bỏ chữ "Lớp" đứng đầu — cột hẹp, tiêu đề cột đã ghi "Lớp".
      map.set(c.room.id, [...(map.get(c.room.id) ?? []), String(c.name ?? "").replace(/^Lớp\s+/i, "")]);
    }
    return map;
  }, [classResult]);
  const withClasses = (cols: MiniColumn[]) => {
    // Chỉ phòng học mới có lớp: phòng học chưa gán lớp ghi "Chưa có lớp"; kho, thư viện, phòng bộ môn để trống.
    const col: MiniColumn = {
      header: "Lớp",
      cell: (r) => classesByRoom.get(r.id)?.join(", ")
        ?? (r.roomType?.code === "PHONG_HOC" ? <span className="text-muted-foreground/70 text-xs">Chưa có lớp</span> : dash),
      className: "w-24",
    };
    return [...cols.slice(0, 2), col, ...cols.slice(2)];
  };
  const teamDialog = useQuickDialog("subject_teams", { school: { id: schoolId } });
  // Phần đang mở trong hai tab gộp. Bên gọi đưa giá trị cũ ("rooms", "teams"…) thì mở đúng phần đó.
  const [peoplePart, setPeoplePart] = usePersistentState<(typeof PEOPLE_PARTS)[number]["value"]>("explorer.peoplePart", "staff");
  // "Thêm nhanh" (khối nhà): nút riêng cạnh nút thêm; hộp của nó do màn này mở.
  const [quickAdd, setQuickAdd] = useState<"buildings" | null>(null);
  const quickProps = (key: "buildings") => ({ open: quickAdd === key, onOpenChange: (o: boolean) => setQuickAdd(o ? key : null) });
  const quickMenu = (key: "buildings", label: string) => [{ label, short: "Thêm nhanh", icon: <ListPlus />, onSelect: () => setQuickAdd(key) }];
  const people = PEOPLE_PARTS.find((p) => p.value === tab)?.value ?? peoplePart;
  // Cột trái của tab Cơ sở vật chất (như CSDL HCM): mục đang mở nhớ theo phiên; liên kết cũ (?tab=rooms…) vẫn mở đúng mục.
  const [section, setSection] = usePersistentState<string>("explorer.facilitySection", "rooms");
  const legacy = ["info", "standard", "statistics"];
  const picked = tab === "classes" || FACILITY_PARTS.some((p) => p.value === tab) ? tab : section;
  // "students": mục Học sinh cũ ở cột trái — nay là tab riêng.
  const sec = legacy.includes(picked) || picked === "students" ? "rooms" : picked;
  // Việc đang lọc danh sách hạng mục (từ "Cần hoàn thiện"); chọn mục khác ở cột trái là bỏ lọc.
  const [todo, setTodo] = useState<FacilityTodoFilter | null>(null);
  const pickSection = (v: string) => { setTodo(null); setSection(v); onTab("facilities"); };
  const groupTitle = useFacilitySectionTitle(schoolId, sec);
  const groupId = sec.startsWith("g:") ? sec.slice(2) : null;
  const pickPeople = (v: typeof people) => { setPeoplePart(v); onTab("people"); };
  // Một ô thả xuống cho cả phần (cán bộ / tổ) lẫn loại cán bộ — thay hai dải chọn đứng liền nhau (góp ý 12/11/2026).
  const [staffType, setStaffType] = usePersistentState<"all" | "staff" | "teacher">("explorer.staffType", "all");
  const peopleValue = people === "teams" || people === "assignments" ? people : staffType;
  const peopleTop = (
    <IconFilter labeled icon={<IdCard />} label="danh sách" value={peopleValue} baseline="all"
      onChange={(v) => {
        if (v === "teams") return pickPeople("teams");
        if (v === "assignments") return pickPeople("assignments");
        setStaffType(v === "staff" || v === "teacher" ? v : "all");
        pickPeople("staff");
      }}
      groups={[{ items: [
        { key: "all", label: "Tất cả", count: counts?.staff },
        { key: "staff", label: "Cán bộ" },
        { key: "teacher", label: "Giáo viên" },
        { key: "teams", label: "Tổ bộ môn", count: counts?.teams },
        ...(mayAssign ? [{ key: "assignments", label: "Phân công năm học" }] : []),
      ] }]} />
  );
  const tabCounts: FacilityCounts & { students?: number } = { ...counts, students: mayStudents ? studentTotal?.total : undefined };
  return (
    <>
      {campusDialog.element}
      {buildingDialog.element}
      {roomDialog.element}
      {staffDialog.element}
      {classDialog.element}
      {mayStudents ? studentDialog.element : null}
      {teamDialog.element}
      <QuickAddBuildings schoolId={schoolId} onAddCampus={() => campusDialog.open()} {...quickProps("buildings")} />
      {/* Dải tab đứng đầu màn (như thanh tab của phân hệ), rồi thẻ trường, rồi nội dung của tab trên một tấm. */}
      <Tabs value={active} onValueChange={onTab} className="gap-4">
        {/* Dải tab và tên trường chung một hàng; hẹp thì tên xuống dòng dưới. */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <TabsList>
          {tabs.map(({ value, label, icon: Icon, count }) => (
            <TabsTrigger
              key={value}
              value={value}
              className="gap-2"
            >
              <Icon className="size-4" />
              {label}
              {count && tabCounts[count] != null ? (
                <span className="bg-foreground/[0.06] text-muted-foreground group-data-[state=active]:bg-white/20 group-data-[state=active]:text-primary-foreground rounded-full px-1.5 text-[0.6875rem] font-medium tabular-nums transition-colors">
                  {num.format(tabCounts[count]!)}
                </span>
              ) : null}
            </TabsTrigger>
          ))}
        </TabsList>
        {header ? <div className="min-w-0 flex-1">{header}</div> : null}
        </div>
        <FillBox>
        <Card className="min-h-0 flex-1 gap-0 px-5 pt-2 pb-5">
        <TabsContent value="profile" className="flex min-h-0 flex-1 flex-col overflow-y-auto pt-3">
          {profile}
        </TabsContent>
        {year ? (
          <TabsContent value="year" className="flex min-h-0 flex-1 flex-col pt-3">
            {year}
          </TabsContent>
        ) : null}
        <TabsContent value="assessment" className="flex min-h-0 flex-1 flex-col overflow-y-auto pt-3">
          <FacilityAssessment schoolId={schoolId} onTab={onTab} onTodo={setTodo}
            onAdd={(roomType) => roomDialog.open(undefined, { roomType })} />
        </TabsContent>
        <TabsContent value="facilities" className="flex min-h-0 flex-1 flex-col pt-3">
          <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-5">
            <FacilityNav schoolId={schoolId} value={sec} onChange={pickSection}
              counts={{ rooms: counts?.rooms, buildings: counts?.buildings, campuses: counts?.campuses, classes: counts?.classes }} />
            <div className="flex min-h-0 min-w-0 flex-col overflow-y-auto">
              {sec === "classes" ? (
                <ClassBoard schoolId={schoolId} onCreate={() => classDialog.open()} onOpen={(id) => classDialog.view(id)} onEdit={(id) => classDialog.open(id)} />
              ) : groupId ? (
                <MiniTable key={sec} resource="rooms" path="/rooms"
                  filters={[...bySchool(schoolId), { field: "group.id", operator: "eq", value: groupId }]}
                  columns={withClasses(itemColumns)} createQuery={q} emptyText={`Chưa khai hạng mục nào${groupTitle ? ` ở ${groupTitle.toLowerCase()}` : ""}.`}
                  searchPlaceholder="Tìm theo mã hoặc tên..." createLabel="Thêm hạng mục"
                  onCreate={() => roomDialog.open(undefined, groupId === "none" ? undefined : { typeGroup: Number(groupId) })}
                  onOpen={(r) => roomDialog.view(r.id)} onEdit={(r) => roomDialog.open(r.id)} onDelete={roomDialog.remove} quickButtons choice={CATALOG_CHOICE} unit="hạng mục"
                  // Chọn một nhóm bên trái vẫn gom theo khối nhà như "Tất cả hạng mục" (cùng cách nhóm đã chọn, nhớ chung).
                  views={ROOM_VIEWS} viewsLabel="cách nhóm" />
              ) : sec === "buildings" ? (
                <MiniTable resource="buildings" path="/buildings" filters={bySchool(schoolId)} columns={buildingColumns} createQuery={q} emptyText="Chưa có khối nhà nào." onCreate={() => buildingDialog.open()} onOpen={(r) => buildingDialog.view(r.id)} onEdit={(r) => buildingDialog.open(r.id)}
                  searchPlaceholder="Tìm khối nhà theo mã hoặc tên..." createLabel="Thêm khối nhà"
                  createMenu={quickMenu("buildings", "Thêm nhanh nhiều khối nhà")} quickButtons />
              ) : sec === "campuses" ? (
                <MiniTable resource="campuses" path="/campuses" filters={bySchool(schoolId)} columns={campusColumns} createQuery={q} emptyText="Chưa có cơ sở nào." onCreate={() => campusDialog.open()} onOpen={(r) => campusDialog.view(r.id)} onEdit={(r) => campusDialog.open(r.id)}
                  searchPlaceholder="Tìm điểm trường theo mã hoặc tên..." createLabel="Thêm điểm trường" quickButtons />
              ) : (
                <MiniTable key={todo?.key ?? "all"} resource="rooms" path="/rooms"
                  filters={todo ? [...bySchool(schoolId), { field: "todo", operator: "eq", value: todo.key }] : bySchool(schoolId)}
                  columns={withClasses(roomColumns)} createQuery={q} emptyText={todo ? "Đã xử lý hết." : "Chưa có hạng mục nào."}
                  searchPlaceholder="Tìm theo mã hoặc tên..." createLabel="Thêm hạng mục"
                  onCreate={() => roomDialog.open()} onOpen={(r) => roomDialog.view(r.id)} onEdit={(r) => roomDialog.open(r.id)} onDelete={roomDialog.remove}
                  quickButtons
                  top={todo ? <TodoChip title={todo.title} onClear={() => setTodo(null)} /> : undefined}
                  // Đang lọc theo một việc: danh sách phẳng (nhóm theo khối nhà / loại tự đọc lại toàn bộ, không theo lọc).
                  views={todo ? undefined : ROOM_VIEWS} viewsLabel="cách nhóm" choice={CATALOG_CHOICE} unit="hạng mục" />
              )}
            </div>
          </div>
        </TabsContent>
        {mayStudents ? (
          <TabsContent value="students" className="flex min-h-0 flex-1 flex-col overflow-y-auto pt-3">
            <StudentBoard schoolId={schoolId} onCreate={() => studentDialog.open()} onOpen={(id) => studentDialog.view(id)}
              onEdit={(id) => studentDialog.open(id)} onDelete={studentDialog.remove} />
          </TabsContent>
        ) : null}
        <TabsContent value="people" className="flex min-h-0 flex-1 flex-col overflow-y-auto pt-3">
          {people === "staff" ? (
            <>
              <MiniTable key={staffType} top={peopleTop} resource="staff" path="/staff"
                filters={staffType === "all" ? bySchool(schoolId) : [...bySchool(schoolId), { field: "staffType", operator: "eq", value: staffType }]}
                columns={mayManageAccounts ? [...staffColumns, staffAccountColumn] : staffColumns} createQuery={q}
                emptyText={staffType === "staff" ? "Chưa có cán bộ nào." : staffType === "teacher" ? "Chưa có giáo viên nào." : "Chưa có cán bộ, giáo viên nào."}
                createLabel={staffType === "staff" ? "Thêm cán bộ" : staffType === "teacher" ? "Thêm giáo viên" : "Thêm nhân sự"} searchPlaceholder="Tìm cán bộ, giáo viên theo mã hoặc tên..."
                onCreate={() => staffDialog.open(undefined, staffType === "all" ? undefined : { staffType })} onOpen={(r) => staffDialog.view(r.id)} onEdit={(r) => staffDialog.open(r.id)}
                quickButtons />
            
            </>
          ) : people === "assignments" ? (
            <div className="flex min-h-0 flex-1 flex-col gap-3">
              {peopleTop}
              <StaffAssignmentsPanel schoolId={schoolId} />
            </div>
          ) : (
            <>
              <MiniTable top={peopleTop} resource="subject_teams" path="/subject-teams" filters={bySchool(schoolId)} columns={teamColumns} createQuery={q}
                emptyText="Chưa có tổ bộ môn nào." onCreate={() => teamDialog.open()} onOpen={(r) => teamDialog.view(r.id)} onEdit={(r) => teamDialog.open(r.id)} unit="tổ"
                createLabel="Thêm tổ bộ môn" searchPlaceholder="Tìm tổ bộ môn theo mã hoặc tên..." quickButtons />
            
            </>
          )}
        </TabsContent>
        </Card>
        </FillBox>
      </Tabs>
    </>
  );
}
