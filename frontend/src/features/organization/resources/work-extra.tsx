import type { CrudFilter } from "@refinedev/core";
import type { ColumnDef } from "@tanstack/react-table";
import { useFormContext, useWatch, type Control } from "react-hook-form";
import { useEffect } from "react";

import { Badge } from "@/shared/ui/badge";
import { Label } from "@/shared/ui/label";
import { DateField, SelectField, TextField } from "@/shared/components/form/simple-fields";
import { AttachmentsPanel } from "@/shared/components/voucher/attachments-panel";
import { formatPlainDate } from "@/shared/lib/format";
import { FACILITY_WORK_TYPE_LABELS } from "@/domains/facility/types";
import { FUNDING_LABELS, FUNDING_OPTIONS } from "@/domains/equipment/types";
import { SameSchoolRef } from "@/features/organization/resources/facility-extra";
import { useSchoolNextCode } from "@/features/organization/resources/school-code";
import { SchoolField, schoolColumn } from "@/features/organization/resources/school-field";

/* eslint-disable @typescript-eslint/no-explicit-any */

const money = new Intl.NumberFormat("vi-VN");
const TYPE_OPTIONS = Object.entries(FACILITY_WORK_TYPE_LABELS).map(([value, label]) => ({ value, label }));
/** Nguồn kinh phí của việc sửa: danh mục Nguồn kinh phí (như ghi tăng), trừ "Chưa xác định nguồn" chỉ hệ thống ghi. */
export const REPAIR_FUNDING_OPTIONS = FUNDING_OPTIONS.map((value) => ({ value, label: FUNDING_LABELS[value] ?? value }));

/** Vị trí cụ thể nhất của công việc: phòng, không thì khối nhà, không thì cơ sở, không thì cả trường. */
/** Ngày hoàn thành không trước ngày bắt đầu — cùng câu với `FacilityWorkService`. */
export const endNotBeforeStart = (v: unknown, values: any) =>
  !v || !values?.startDate || String(v) >= String(values.startDate) || "Ngày hoàn thành không được trước ngày bắt đầu";

export const workPlace = (r: any): string => r?.room?.name ?? r?.building?.name ?? r?.campus?.name ?? "Toàn trường";

const idOf = (v: unknown) => (v == null || v === "" ? null : Number(v));

/**
 * Cơ sở → khối nhà → phòng, theo thứ tự lồng nhau: chọn cơ sở thì ô khối nhà chỉ còn khối nhà
 * của cơ sở đó, chọn khối nhà thì ô phòng chỉ còn phòng của khối nhà đó. Chọn ô dưới trước cũng được —
 * chọn phòng là điền luôn khối nhà và cơ sở của nó (máy chủ cũng tự điền, `FacilityWorkService.reconcile`).
 * Đổi ô trên sang chỗ khác thì xoá ô dưới, để ba ô không chỉ ba chỗ khác nhau.
 */
export function PlaceFields({ control, record, rooms = true }: { control: Control<any>; record?: any; rooms?: boolean }) {
  const { setValue } = useFormContext();
  const campusId = idOf(useWatch({ control, name: "campus.id" }));
  const buildingId = idOf(useWatch({ control, name: "building.id" }));
  const set = (name: string, id: number | null | undefined) => setValue(`${name}.id`, id ?? null, { shouldDirty: true });
  const buildingFilters: CrudFilter[] = campusId ? [{ field: "campus.id", operator: "eq", value: campusId }] : [];
  const roomId = idOf(useWatch({ control, name: "room.id" }));
  // Bỏ chọn ô trên thì ô dưới (đang khoá) cũng phải trống — không để lại khối nhà của cơ sở đã bỏ.
  useEffect(() => {
    if (!campusId && buildingId) setValue("building.id", null, { shouldDirty: true });
    if (!buildingId && roomId) setValue("room.id", null, { shouldDirty: true });
  }, [campusId, buildingId, roomId, setValue]);
  const roomFilters: CrudFilter[] = buildingId
    ? [{ field: "building.id", operator: "eq", value: buildingId }]
    : campusId ? [{ field: "campus.id", operator: "eq", value: campusId }] : [];
  return (
    <>
      <SameSchoolRef control={control} record={record} name="campus" resource="campuses" label="Cơ sở" current={record?.campus}
        onPicked={(row) => {
          if (row.id !== campusId) {
            set("building", null);
            set("room", null);
          }
        }} />
      <SameSchoolRef control={control} record={record} name="building" resource="buildings" label="Khối nhà" current={record?.building}
        extraFilters={buildingFilters}
        // Chọn từ trên xuống: chưa chọn cơ sở thì chưa chọn khối nhà, chưa có khối nhà thì chưa chọn phòng.
        disabledHint={campusId ? undefined : "Chọn cơ sở trước"}
        onPicked={(row) => {
          if (row.campus?.id) set("campus", row.campus.id);
          if (row.id !== buildingId) set("room", null);
        }} />
      {rooms ? (
        <SameSchoolRef control={control} record={record} name="room" resource="rooms" label="Phòng" current={record?.room}
          extraFilters={roomFilters}
          disabledHint={buildingId ? undefined : "Chọn khối nhà trước"}
          onPicked={(row) => {
            if (row.building?.id) set("building", row.building.id);
            if (row.campus?.id) set("campus", row.campus.id);
          }} />
      ) : null}
    </>
  );
}

/**
 * Form ghi một lần sửa chữa, cải tạo công trình. Vị trí chọn từ trên xuống (cơ sở → khối nhà →
 * phòng) và chỉ cần tới mức cụ thể nhất cần thiết; để trống cả ba là việc của cả trường.
 */
function WorkFields({ control, record, place }: { control: Control<any>; record?: any; place?: string }) {
  // Mã do máy chủ cấp theo quy tắc mã của trường (mặc định SC001, SC002…).
  useSchoolNextCode("facility_works", control, record);
  return (
    <>
      <SchoolField control={control} record={record} hideWhenFixed />
      <div className="form-flow">
        <SelectField control={control} name="workType" label="Loại công việc" options={TYPE_OPTIONS} />
        {/* Ghi từ hồ sơ một phòng / khối nhà / cơ sở: vị trí đã biết — hiện một dòng, không bắt chọn lại ba ô. */}
        {place ? (
          <div className="grid gap-2 @md:col-span-2">
            <Label>Vị trí</Label>
            <span className="bg-muted/50 text-foreground flex h-9 items-center rounded-md px-3 text-sm">{place}</span>
          </div>
        ) : (
          <PlaceFields control={control} record={record} />
        )}
        <DateField control={control} name="startDate" label="Ngày bắt đầu" />
        <DateField control={control} name="endDate" label="Ngày hoàn thành" description="Để trống nếu đang làm."
          rules={{ validate: { range: endNotBeforeStart } }} />
        <TextField control={control} name="cost" label="Chi phí (đ)" type="money" />
        <SelectField control={control} name="fundingSource" label="Nguồn kinh phí" options={REPAIR_FUNDING_OPTIONS}
          placeholder="Vui lòng chọn nguồn kinh phí" />
        <TextField control={control} name="contractor" label="Đơn vị thực hiện" className="@md:col-span-2" placeholder="Nhà thầu, tổ sửa chữa…" rule="SHORT_TEXT" />
      </div>
    </>
  );
}

function WorkFiles({ record }: { record: any }) {
  return (
    <AttachmentsPanel
      resource="facility_works"
      recordId={record?.id}
      canWrite={record?._can?.write === true}
      compact
      title="Ảnh và hồ sơ"
      description="Ảnh trước và sau khi làm, hợp đồng, biên bản nghiệm thu. Tối đa 10 MB mỗi tệp."
    />
  );
}

/** Form ghi sửa chữa có vị trí cố định (mở từ hồ sơ phòng / khối nhà / cơ sở): `place` là dòng "Cơ sở › Khối nhà › Phòng". */
export function fixedPlaceWorkFields(place: string) {
  return function FixedPlaceWorkFields(props: { control: Control<any>; record?: any }) {
    return <WorkFields {...props} place={place} />;
  };
}

export const FACILITY_WORK_EXTRA = {
  // Việc sửa chữa có Trạng thái riêng của nó; cờ "Đang hoạt động" của danh mục ở đây vô nghĩa.
  hideActive: true,
  ShowBelow: WorkFiles,
  section: { title: "Công việc" },
  defaults: {
    school: { id: null },
    workType: "REPAIR",
    room: { id: null },
    building: { id: null },
    campus: { id: null },
    startDate: null,
    endDate: null,
    cost: null,
    contractor: "",
    fundingSource: null,
  },
  Fields: WorkFields,
  columns: [
    {
      id: "workType",
      header: "Loại",
      enableSorting: false,
      cell: ({ row }) => <Badge variant="neutral">{FACILITY_WORK_TYPE_LABELS[row.original.workType] ?? row.original.workType}</Badge>,
    },
    { id: "place", header: "Vị trí", enableSorting: false, cell: ({ row }) => workPlace(row.original) },
    {
      id: "endDate",
      header: "Hoàn thành",
      enableSorting: false,
      cell: ({ row }) => (row.original.endDate ? formatPlainDate(row.original.endDate) : <span className="text-muted-foreground">Đang làm</span>),
    },
    {
      id: "cost",
      header: "Chi phí (đ)",
      enableSorting: false,
      cell: ({ row }) => <span className="tabular-nums">{row.original.cost != null ? money.format(row.original.cost) : "—"}</span>,
    },
    schoolColumn,
  ] as ColumnDef<any, any>[],
  show: (r: any) => [
    { label: "Loại công việc", value: FACILITY_WORK_TYPE_LABELS[r?.workType] ?? "—" },
    { label: "Vị trí", value: r ? [r.campus?.name, r.building?.name, r.room?.name].filter(Boolean).join(" › ") || "Toàn trường" : "—" },
    { label: "Ngày bắt đầu", value: r?.startDate ? formatPlainDate(r.startDate) : "—" },
    { label: "Ngày hoàn thành", value: r?.endDate ? formatPlainDate(r.endDate) : "Đang làm" },
    { label: "Chi phí", value: r?.cost != null ? `${money.format(r.cost)} đ` : "—" },
    { label: "Nguồn kinh phí", value: FUNDING_LABELS[r?.fundingSource] ?? "—" },
    { label: "Đơn vị thực hiện", value: r?.contractor || "—", span: 2 as const },
  ],
};
