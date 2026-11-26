import { canWriteRecord } from "@/shared/lib/can-write";
import { FormHint } from "@/shared/components/form/help-hint";
import { useList, useOne, type CrudFilter } from "@refinedev/core";
import type { ColumnDef } from "@tanstack/react-table";
import { Activity, Clock, DoorOpen, FileText, Hotel, Lock, MapPin, Package, PenLine, Ruler, Users } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useFormContext, useFormState, useWatch, type Control } from "react-hook-form";

import { Badge } from "@/shared/ui/badge";
import { CampusCell, CampusTableFilter } from "@/shared/components/campus/campus";
import { FillPanelContext } from "@/shared/components/layout/fill-panel";
import { cn } from "@/shared/lib/utils";
import { lowerLabel } from "@/shared/lib/label";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { CatalogActiveField, CatalogCodeField, CatalogNameField, CatalogNoteField } from "@/shared/components/catalog/fields";
import type { CatalogConfig, CatalogExtra } from "@/shared/components/catalog/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/shared/ui/form";
import { RefField, type RefValue } from "@/shared/components/catalog/ref-field";
import { SchoolField, schoolColumn } from "@/features/organization/resources/school-field";
import { SIDE_GROUPS, SideGroup, TopGroup } from "@/features/organization/resources/form-groups";
import { useSchoolNextCode } from "@/features/organization/resources/school-code";
import { CONDITION_LABELS, OPEN_DAYS, OPEN_SESSIONS, STRUCTURE_LABELS, USAGE_STATUS_LABELS, campusKindLabel, openingText } from "@/domains/facility/types";
import { Checkbox } from "@/shared/ui/checkbox";
import { FACILITY_CONDITION_VARIANTS, ROOM_USAGE_VARIANTS } from "@/shared/lib/status-variants";
import { AlertDialog } from "@/shared/ui/alert-dialog";
import { ConfirmContent } from "@/shared/components/confirm/confirm-content";
import { AttachmentsPanel } from "@/shared/components/voucher/attachments-panel";
import { RoomEquipment } from "@/features/organization/resources/room-equipment";
import { CustomRoomTypeButton } from "@/features/organization/resources/custom-room-type";
import { FacilityQr } from "@/features/organization/resources/facility-qr";
import { RoomFrame, RoomQrButton, RoomRail, type RailPanel } from "@/features/organization/resources/room-shell";
import {
  inputModeOf,
  maxLengthOf,
  mergeRules,
  numberRules,
  textRules,
  type NumberRule,
  type TextRule,
} from "@/shared/lib/field-rules";

/* eslint-disable @typescript-eslint/no-explicit-any */



const CONDITION_VARIANT = FACILITY_CONDITION_VARIANTS;


const NONE = "__none__";

function EnumSelect({
  control,
  name,
  label,
  hint,
  options,
  required,
}: {
  control: Control<any>;
  name: string;
  label: string;
  /** Lời giải thích — dấu "?" cạnh nhãn. */
  hint?: string;
  options: Record<string, string>;
  required?: boolean;
}) {
  return (
    <FormField
      control={control}
      name={name}
      rules={required ? { required: `Chọn ${lowerLabel(label)}` } : undefined}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          {hint ? <FormHint>{hint}</FormHint> : null}
          <Select
            onValueChange={(v) => {
              // Radix bắn `""` lúc màn sửa nạp bản ghi — bỏ qua, nếu không giá trị bị xoá và lưu ra 400.
              if (v === "") return;
              field.onChange(v === NONE ? null : v);
            }}
            value={field.value ?? ""}
          >
            <FormControl>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={`Vui lòng chọn ${label.toLowerCase()}`} />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {Object.entries(options).map(([v, l]) => (
                <SelectItem key={v} value={v}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export function TextField({
  control,
  name,
  label,
  hint,
  placeholder,
  number,
  rule,
  max,
  numberRule,
  rules,
  warn,
}: {
  control: Control<any>;
  name: string;
  label: string;
  /** Cảnh báo mềm (không chặn lưu) theo giá trị đang nhập — vd diện tích lớn bất thường. */
  warn?: (value: any) => string | null;
  /** Lời giải thích — dấu "?" cạnh nhãn. */
  hint?: string;
  placeholder?: string;
  number?: boolean;
  /** Kiểu chữ chuẩn (`shared/lib/field-rules`) — cùng trần, cùng câu báo lỗi với máy chủ. */
  rule?: TextRule;
  max?: number;
  /** Kiểu số chuẩn; không khai thì ô số chỉ chặn số âm. */
  numberRule?: NumberRule;
  /** Luật riêng của ô, gộp với luật kiểu. */
  rules?: any;
}) {
  const base = rule
    ? textRules(rule, label, { max })
    : numberRule
      ? numberRules(numberRule, label)
      : number
        ? { validate: { min: (v: unknown) => v == null || v === "" || Number(v) >= 0 || `${label} không được âm` } }
        : undefined;
  return (
    <FormField
      control={control}
      name={name}
      rules={mergeRules(base, rules)}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          {hint ? <FormHint>{hint}</FormHint> : null}
          <FormControl>
            <Input
              type={number ? "number" : "text"}
              min={number ? 0 : undefined}
              step={number ? "any" : undefined}
              value={field.value ?? ""}
              onChange={(e) =>
                field.onChange(number ? (e.target.value === "" ? null : Number(e.target.value)) : e.target.value)
              }
              onBlur={field.onBlur}
              name={field.name}
              ref={field.ref}
              placeholder={placeholder}
              maxLength={rule ? maxLengthOf(rule, max) : undefined}
              inputMode={inputModeOf(rule)}
            />
          </FormControl>
          <FormMessage />
          {warn?.(field.value) ? <p className="text-warning-text text-xs">{warn(field.value)}</p> : null}
        </FormItem>
      )}
    />
  );
}

/**
 * Ô chọn dữ liệu CÙNG TRƯỜNG (cơ sở, khối nhà, cán bộ): lọc theo trường đang
 * chọn trên form, hoặc trường của bản ghi khi sửa. Chưa chọn trường thì không
 * lọc — với cán bộ trường, API vốn chỉ trả dữ liệu của trường họ.
 */
export function SameSchoolRef({
  control,
  record,
  name,
  resource,
  label,
  hint,
  current,
  extraFilters,
  onPicked,
  disabledHint,
  required,
}: {
  control: Control<any>;
  record?: any;
  name: string;
  resource: string;
  label: string;
  required?: boolean;
  /** Lời giải thích — dấu "?" cạnh nhãn. */
  hint?: string;
  current?: RefValue;
  extraFilters?: CrudFilter[];
  onPicked?: (item: any) => void;
  /** Có giá trị = ô khoá, hiện câu nhắc này ("Chọn cơ sở trước"). */
  disabledHint?: string;
}) {
  const chosen = useWatch({ control, name: "school.id" });
  const schoolId = record?.school?.id ?? chosen;
  const filters: CrudFilter[] = [
    ...(schoolId ? [{ field: "school.id", operator: "eq" as const, value: schoolId }] : []),
    ...(extraFilters ?? []),
  ];
  return (
    <RefField
      control={control}
      name={name}
      resource={resource}
      label={label}
      hint={hint}
      current={current}
      filters={filters.length ? filters : undefined}
      onPicked={onPicked}
      disabledHint={disabledHint}
      required={required}
    />
  );
}

/** Cột Cơ sở: cơ sở thực của dòng (ghi trên nó, không thì cơ sở chính) kèm loại. */
const campusColumn: ColumnDef<any, any> = {
  id: "campus",
  header: "Cơ sở",
  enableSorting: false,
  cell: ({ row }) => <CampusCell campus={row.original.campus} />,
};

export const refCell = (key: string, header: string, empty = "Chưa khai"): ColumnDef<any, any> => ({
  id: key,
  header,
  enableSorting: false,
  cell: ({ row }) => row.original[key]?.name ?? <span className="text-muted-foreground">{empty}</span>,
});

const conditionCell: ColumnDef<any, any> = {
  id: "condition",
  header: "Hiện trạng",
  enableSorting: false,
  cell: ({ row }) => {
    const v = row.original.condition;
    // "Tốt" là chữ thường; chỉ hiện trạng cần để ý mới thành nhãn màu (như bảng phòng ở Tổng quan trường).
    if (!v) return null;
    return CONDITION_VARIANT[v] === "success"
      ? <span className="text-muted-foreground">{CONDITION_LABELS[v]}</span>
      : <Badge variant={CONDITION_VARIANT[v] ?? "neutral"}>{CONDITION_LABELS[v]}</Badge>;
  },
};

// ---------------------------------------------------------------- Cơ sở

function CampusFields({ control, record }: { control: Control<any>; record?: any }) {
  useSchoolNextCode("campuses", control, record);
  const primary = useWatch({ control, name: "primaryCampus" }) === true;
  return (
    <>
      <SchoolField control={control} record={record} hideWhenFixed />
      <div className="grid gap-5 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <TextField control={control} name="address" label="Địa chỉ" rule="ADDRESS" />
        <TextField control={control} name="phone" label="Số điện thoại" rule="PHONE" />
      </div>
      <div className="form-flow">
        <FormField
          control={control}
          name="primaryCampus"
          render={({ field }) => (
            <FormItem className="self-end">
              <label className="flex h-9 cursor-pointer items-center gap-2 text-sm select-none">
                <FormControl>
                  <Checkbox checked={field.value ?? false} onCheckedChange={(c) => field.onChange(c === true)} />
                </FormControl>
                Cơ sở chính
              </label>
            </FormItem>
          )}
        />
        {primary ? null : (
          <FormField
            control={control}
            name="branch"
            render={({ field }) => (
              <FormItem className="self-end">
                <label className="flex h-9 cursor-pointer items-center gap-2 text-sm select-none">
                  <FormControl>
                    <Checkbox checked={field.value ?? false} onCheckedChange={(c) => field.onChange(c === true)} />
                  </FormControl>
                  Phân hiệu
                </label>
              </FormItem>
            )}
          />
        )}
      </div>
    </>
  );
}

/**
 * Ảnh hiện trạng, bản vẽ, hồ sơ pháp lý của cơ sở / khối nhà / phòng. Thêm, xoá tệp ngay
 * ở màn xem — ai sửa được bản ghi thì thêm được tệp (`_can.write`), còn lại chỉ xem.
 */
const facilityFiles = (resource: string, description: string) =>
  function FacilityFiles({ record }: { record: any }) {
    return (
      <AttachmentsPanel
        resource={resource}
        recordId={record?.id}
        canWrite={record?._can?.write === true && canWriteRecord(resource, record)}
        section
        title="Ảnh và hồ sơ"
        description={description}
      />
    );
  };

const CAMPUS_FILES = facilityFiles("campuses", "Ảnh toàn cảnh, sơ đồ mặt bằng, giấy tờ đất của cơ sở. Tối đa 10 MB mỗi tệp.");

export const CAMPUS_EXTRA = {
  ShowBelow: CAMPUS_FILES,
  ShowTabs: [{ key: "files", label: "Ảnh và hồ sơ", Content: CAMPUS_FILES }],
  section: { title: "Thông tin cơ sở" },
  defaults: { school: { id: null }, address: "", phone: "", primaryCampus: false, branch: false },
  Fields: CampusFields,
  columns: [
    {
      id: "address",
      header: "Địa chỉ",
      enableSorting: false,
      cell: ({ row }) => row.original.address ?? <span className="text-muted-foreground">Chưa khai</span>,
    },
    {
      id: "primaryCampus",
      header: "Loại",
      enableSorting: false,
      cell: ({ row }) => (row.original.primaryCampus
        ? <Badge variant="info">Trường chính</Badge>
        : <span className="text-muted-foreground text-sm">{campusKindLabel(row.original)}</span>),
    },
    schoolColumn,
  ] as ColumnDef<any, any>[],
  show: (r: any) => [
    { label: "Địa chỉ", value: r?.address ?? "—" },
    { label: "Số điện thoại", value: r?.phone ?? "—" },
    { label: "Loại", value: campusKindLabel(r) },
  ],
};

// ---------------------------------------------------------------- Khối nhà

/** Các ô của form khối nhà — khuôn chung (`BuildingFields`) và bố cục riêng (`BuildingFormBody`) dùng cùng một bộ. */
function buildingInputs(control: Control<any>, record?: any) {
  return {
    campus: <SameSchoolRef control={control} record={record} name="campus" resource="campuses" label="Cơ sở" current={record?.campus} />,
    managingStaff: <SameSchoolRef control={control} record={record} name="managingStaff" resource="staff" label="Cán bộ phụ trách" hint="Người chịu trách nhiệm." current={record?.managingStaff} />,
    floorCount: (
      <TextField control={control} name="floorCount" label="Số tầng" hint="Tầng của phòng không được vượt số này." number numberRule="COUNT"
        // Cùng luật máy chủ (`BuildingRequest`): 1–50 tầng.
        rules={{ validate: { range: (v: unknown) => v == null || v === "" || (Number(v) >= 1 && Number(v) <= 50) || "Số tầng từ 1 đến 50" } }} />
    ),
    builtYear: (
      <TextField control={control} name="builtYear" label="Năm đưa vào sử dụng" number
        rules={{ validate: {
          year: (v: unknown) => v == null || v === "" || (Number.isInteger(Number(v)) && Number(v) >= 1900) || "Năm đưa vào sử dụng phải từ 1900",
          notFuture: (v: unknown) => v == null || v === "" || Number(v) <= new Date().getFullYear() || "Năm đưa vào sử dụng không được sau năm nay",
        } }} />
    ),
    floorArea: <TextField control={control} name="floorArea" label="Diện tích sàn (m²)" number numberRule="AREA"
      rules={{ validate: { positive: (v: unknown) => v == null || v === "" || Number(v) > 0 || "Diện tích sàn phải lớn hơn 0" } }} />,
    condition: <EnumSelect control={control} name="condition" label="Hiện trạng" hint="Tình trạng hiện tại. “Cần sửa chữa” và “Xuống cấp” sẽ có trong báo cáo cơ sở vật chất." options={CONDITION_LABELS} />,
    structure: <EnumSelect control={control} name="structure" label="Kết cấu" hint="Kiên cố, bán kiên cố, tạm hay nhờ, mượn, thuê — theo biểu CSVC của Sở." options={STRUCTURE_LABELS} />,
  };
}

function BuildingFields({ control, record }: { control: Control<any>; record?: any }) {
  useSchoolNextCode("buildings", control, record);
  const f = buildingInputs(control, record);
  return (
    <>
      <SchoolField control={control} record={record} hideWhenFixed />
      <div className="form-flow">
        {f.campus}
        {f.managingStaff}
      </div>
      <div className="form-flow">
        {f.floorCount}
        {f.builtYear}
        {f.floorArea}
        {f.structure}
        {f.condition}
      </div>
    </>
  );
}

/**
 * Form thêm / sửa khối nhà chia ba nhóm, tên nhóm bên trái (như hộp lớp học): Khối nhà · Quy mô và tình
 * trạng · Ghi chú. Cùng các ô, cùng luật, cùng mã tự cấp với khuôn chung.
 */
function BuildingFormBody({ control, record, config }: { control: any; record?: any; config: CatalogConfig }) {
  useSchoolNextCode("buildings", control, record);
  const f = buildingInputs(control, record);
  return (
    <div className={SIDE_GROUPS}>
      <SideGroup icon={Hotel} title="Khối nhà" description="Mã, tên, cơ sở và người phụ trách.">
        {/* Ô Trường chỉ hiện khi tài khoản phải chọn trường. */}
        <div className="empty:hidden sm:col-span-2">
          <SchoolField control={control} record={record} hideWhenFixed wide />
        </div>
        <CatalogCodeField control={control} config={config} fill />
        <CatalogNameField control={control} config={config} />
        {f.campus}
        {f.managingStaff}
        {/* Công tắc hoạt động chỉ ở màn sửa, như khuôn chung. */}
        {record ? <CatalogActiveField control={control} className="sm:col-span-2" /> : null}
      </SideGroup>
      <SideGroup icon={Activity} title="Quy mô và tình trạng" description="Không bắt buộc, điền sau cũng được.">
        {f.floorCount}
        {f.builtYear}
        {f.floorArea}
        {f.structure}
        {f.condition}
      </SideGroup>
      <SideGroup icon={PenLine} title="Ghi chú">
        <div className="sm:col-span-2">
          <CatalogNoteField control={control} />
        </div>
      </SideGroup>
    </div>
  );
}

const BUILDING_FILES = facilityFiles("buildings", "Ảnh hiện trạng, bản vẽ, hồ sơ xây dựng và nghiệm thu của khối nhà. Tối đa 10 MB mỗi tệp.");

export const BUILDING_EXTRA = {
  ShowBelow: BUILDING_FILES,
  ShowTabs: [{ key: "files", label: "Ảnh và hồ sơ", Content: BUILDING_FILES }],
  section: { title: "Thông tin khối nhà" },
  defaults: {
    school: { id: null },
    campus: { id: null },
    managingStaff: { id: null },
    floorCount: null,
    builtYear: null,
    floorArea: null,
    condition: null,
    structure: null,
  },
  Fields: BuildingFields,
  FormBody: BuildingFormBody,
  dialogSize: "formFit" as const,
  dialogHeader: true,
  ListFilters: CampusTableFilter,
  columns: [
    campusColumn,
    {
      id: "floorCount",
      header: "Số tầng",
      enableSorting: false,
      cell: ({ row }) => <span className="tabular-nums">{row.original.floorCount ?? <span className="text-muted-foreground">Chưa khai</span>}</span>,
    },
    {
      id: "structure",
      header: "Kết cấu",
      enableSorting: false,
      cell: ({ row }) => STRUCTURE_LABELS[row.original.structure] ?? <span className="text-muted-foreground">Chưa khai</span>,
    },
    conditionCell,
    schoolColumn,
  ] as ColumnDef<any, any>[],
  show: (r: any) => [
    { label: "Cơ sở", value: r?.campus?.name ?? "—" },
    { label: "Số tầng", value: r?.floorCount ?? "—" },
    { label: "Năm đưa vào sử dụng", value: r?.builtYear ?? "—" },
    { label: "Diện tích sàn", value: r?.floorArea != null ? `${r.floorArea} m²` : "—" },
    { label: "Kết cấu", value: STRUCTURE_LABELS[r?.structure] ?? "—" },
    { label: "Hiện trạng", value: CONDITION_LABELS[r?.condition] ?? "Chưa đánh giá" },
    { label: "Cán bộ phụ trách", value: r?.managingStaff?.name ?? "—" },
  ],
};

// ---------------------------------------------------------------- Phòng

/**
 * Form phòng theo kiểu Jmix: chọn KHỐI NHÀ trước, rồi TẦNG (chỉ các tầng khối nhà có) — mã phòng
 * do máy chủ cấp theo quy tắc mã của trường (mặc định PH0001…, như bản Jmix); cơ sở theo khối
 * nhà, không hỏi.
 */
/** Việc tự động của form phòng: cơ sở theo khối nhà, số tầng của khối nhà, mã tự cấp, tên gợi ý theo loại phòng. */
function useRoomForm(control: Control<any>, record?: any) {
  const { setValue, getValues } = useFormContext();
  const buildingId = useWatch({ control, name: "building.id" });

  const { result: building } = useOne<any>({
    resource: "buildings",
    id: buildingId ?? "",
    queryOptions: { enabled: !!buildingId },
  });
  const floors = Math.max(1, Math.min(building?.floorCount ?? 10, 50));

  useEffect(() => {
    if (!building) return;
    if (building.campus?.id) setValue("campus.id", building.campus.id, { shouldDirty: true });
  }, [building, setValue]);

  // Mã do máy chủ cấp theo quy tắc mã của trường (mặc định PH0001, PH0002…, như bản Jmix).
  useSchoolNextCode("rooms", control, record);

  const roomTypeId = useWatch({ control, name: "roomType.id" });
  const { result: roomType } = useOne<any>({ resource: "room_types", id: roomTypeId ?? "", queryOptions: { enabled: !!roomTypeId } });
  const combinedTypeId = useWatch({ control, name: "combinedType.id" });
  const { result: combinedType } = useOne<any>({ resource: "room_types", id: combinedTypeId ?? "", queryOptions: { enabled: !!combinedTypeId } });
  // Khu vực, công trình (sân, cổng, khu vệ sinh…) không gắn khối nhà, tầng, sức chứa, môn — máy
  // chủ từ chối nếu còn giá trị, nên chọn loại khu vực thì bỏ trống các ô này (ô cũng bị ẩn).
  useEffect(() => {
    if (roomType?.kind !== "AREA") return;
    const clear = (name: string, empty: unknown, has: (v: any) => boolean) => {
      if (has(getValues(name))) setValue(name, empty, { shouldDirty: true });
    };
    clear("building", { id: null }, (v) => v?.id != null);
    clear("floor", "", (v) => v != null && v !== "");
    clear("capacity", null, (v) => v != null && v !== "");
    clear("subject", { id: null }, (v) => v?.id != null);
  }, [roomType?.kind, roomType?.id, getValues, setValue]);
  const chosenSchool = useWatch({ control, name: "school.id" });
  const roomSchool = record?.school?.id ?? chosenSchool;
  const typeGroup = useWatch({ control, name: "typeGroup" }) as number | null | undefined;

  // Điền sẵn cho phòng MỚI (trưởng nhóm chốt 12/11/2026); phòng đã có thì không đụng. Mọi ô điền sẵn vẫn sửa được.
  // Tên: chọn loại khi ô tên còn trống thì gợi ý tên loại ("Phòng học"), người dùng gõ thêm số / tên riêng.
  useEffect(() => {
    if (record?.id || !roomType?.name) return;
    const name = getValues("name");
    if (name == null || String(name).trim() === "") setValue("name", roomType.name, { shouldDirty: true });
  }, [record?.id, roomType?.name, getValues, setValue]);
  // Kết cấu: lấy theo khối nhà — xem `RoomStructureField`.
  // Khối nhà: trường chỉ có MỘT khối nhà thì chọn sẵn khối đó.
  const { result: schoolBuildings } = useList<any>({
    resource: "buildings",
    filters: [{ field: "school.id", operator: "eq", value: roomSchool }],
    pagination: { currentPage: 1, pageSize: 2 },
    queryOptions: { enabled: !record?.id && !!roomSchool },
  });
  useEffect(() => {
    const only = schoolBuildings?.total === 1 ? schoolBuildings.data[0] : null;
    if (record?.id || !only || roomType?.kind === "AREA" || getValues("building.id")) return;
    setValue("building", { id: only.id, name: only.name }, { shouldDirty: true });
  }, [record?.id, schoolBuildings, roomType?.kind, getValues, setValue]);

  return { buildingId, floors, roomSchool, roomType, combinedType, typeGroup };
}

type ParamSpec = { key: string; label: string; unit?: string; type?: "number" | "text" };

/** Thông số riêng theo loại CSVC (201): ô theo danh sách thông số của loại và loại dùng kết hợp. */
function paramSpecs(...types: any[]): ParamSpec[] {
  const seen = new Set<string>();
  const out: ParamSpec[] = [];
  for (const t of types) {
    for (const p of (t?.params ?? []) as ParamSpec[]) {
      if (p?.key && !seen.has(p.key)) {
        seen.add(p.key);
        out.push(p);
      }
    }
  }
  return out;
}

/** Một nhóm ô tích (ngày / buổi mở cửa) ghi một mảng giá trị; không tích gì = không giới hạn. */
function CheckGroup<V extends string | number>({ control, name, label, options }: {
  control: Control<any>;
  name: string;
  label: string;
  options: readonly { value: V; label: string }[];
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => {
        const value: V[] = field.value ?? [];
        return (
          <FormItem>
            <FormLabel>{label}</FormLabel>
            <div className="flex min-h-9 flex-wrap items-center gap-x-4 gap-y-2">
              {options.map((o) => (
                <Label key={String(o.value)} className="flex items-center gap-1.5 text-sm font-normal">
                  <Checkbox checked={value.includes(o.value)}
                    onCheckedChange={(on) => field.onChange(on === true ? [...value, o.value] : value.filter((x) => x !== o.value))} />
                  {o.label}
                </Label>
              ))}
            </div>
          </FormItem>
        );
      }}
    />
  );
}

/** Lịch mở cửa của phòng chức năng. Không tích = mở mọi lúc. */
function OpeningDays({ control }: { control: Control<any> }) {
  return <CheckGroup control={control} name="openDays" label="Ngày mở cửa" options={OPEN_DAYS.map((d) => ({ value: d.value, label: d.short }))} />;
}

function OpeningSessions({ control }: { control: Control<any> }) {
  return <CheckGroup control={control} name="openSessions" label="Buổi mở cửa" options={OPEN_SESSIONS} />;
}

function OpeningInputs({ control }: { control: Control<any> }) {
  return (
    <>
      <CheckGroup control={control} name="openDays" label="Ngày mở cửa" options={OPEN_DAYS.map((d) => ({ value: d.value, label: d.short }))} />
      <CheckGroup control={control} name="openSessions" label="Buổi mở cửa" options={OPEN_SESSIONS} />
    </>
  );
}

/** Thông số báo cáo đang dùng (biểu số liệu CSVC: số giường nội trú) — luôn hiện; còn lại gập vào "Thông số thêm". */
const REPORTED_PARAMS = new Set(["beds"]);

/** Luật ô thông số dạng số — cùng máy chủ (`FacilityProfile.params`): không âm, ≤ 10.000, tối đa 2 số lẻ. */
const PARAM_NUMBER_RULES = {
  validate: {
    param: (v: unknown) => {
      if (v == null || v === "") return true;
      const n = Number(v);
      if (Number.isNaN(n)) return "Phải là số";
      if (n < 0) return "Không được âm";
      if (n > 10_000) return "Tối đa 10.000 — kiểm tra lại đơn vị";
      return /^\d+(\.\d{1,2})?$/.test(String(v)) || "Tối đa 2 chữ số thập phân";
    },
  },
};

/**
 * Ô thông số theo loại (201). Trưởng nhóm 12/11/2026: form quá nhiều ô — thông số chưa báo cáo nào dùng (kho sách,
 * phòng đọc, chỗ để xe…) gập vào một dòng "Thông số thêm ›", bấm mới mở; đã có số thì mở sẵn.
 */
function ParamInputs({ control, specs }: { control: Control<any>; specs: ParamSpec[] }) {
  const values = useWatch({ control, name: "params" }) as Record<string, unknown> | undefined;
  const extra = specs.filter((p) => !REPORTED_PARAMS.has(p.key));
  const filled = extra.some((p) => values?.[p.key] != null && values[p.key] !== "");
  const [open, setOpen] = useState(filled);
  const input = (p: ParamSpec) => (
    <TextField key={p.key} control={control} name={`params.${p.key}`} label={p.unit ? `${p.label} (${p.unit})` : p.label}
      {...(p.type === "text" ? { rule: "SHORT_TEXT" as const, max: 100 } : { number: true, rules: PARAM_NUMBER_RULES })} />
  );
  return (
    <>
      {specs.filter((p) => REPORTED_PARAMS.has(p.key)).map(input)}
      {extra.length === 0 ? null : open || filled ? extra.map(input) : (
        <div className="col-span-full">
          <button type="button" onClick={() => setOpen(true)} title={extra.map((p) => p.label).join(", ")}
            className="text-primary hover:text-primary/80 inline-flex items-center gap-1 text-sm font-medium">
            Thông số thêm ({extra.length}) ›
          </button>
        </div>
      )}
    </>
  );
}

/** Các ô của form phòng — khuôn chung (`RoomFields`) và bố cục riêng (`RoomFormBody`) dùng cùng một bộ. */
/** Loại phòng bắt buộc khai sức chứa (chốt 12/11/2026). */
const CAPACITY_REQUIRED = new Set(["PHONG_HOC", "NHA_AN", "THU_VIEN"]);

function roomInputs(control: Control<any>, record: any, buildingId: unknown, floors: number, setValue: (name: string, value: unknown, opts?: any) => void, roomSchool?: number | null, typeGroup?: number | null, roomType?: any) {
  const isArea = roomType?.kind === "AREA";
  // Thêm từ một khối (tab Cơ sở vật chất): ô loại chỉ hiện loại của khối đó.
  const typeFilter = [
    ...(roomSchool ? [{ field: "schoolId", operator: "eq" as const, value: roomSchool }] : []),
    ...(typeGroup ? [{ field: "group.id", operator: "eq" as const, value: typeGroup }] : []),
  ];
  return {
    structure: <EnumSelect control={control} name="structure" label="Kết cấu" hint="Kiên cố, bán kiên cố, tạm hay nhờ, mượn, thuê — theo biểu CSVC của Sở." options={STRUCTURE_LABELS} required />,
    combinedType: (
      <RefField control={control} name="combinedType" resource="room_types" label="Dùng kết hợp"
        hint="Phòng dùng chung cho loại thứ hai, vd phòng học kết hợp nghỉ trưa, phòng Đoàn Đội kết hợp truyền thống."
        current={record?.combinedType} placeholder="Không" filters={typeFilter}
        validate={(v, all) => !v?.id || v.id !== all?.roomType?.id || "Loại dùng kết hợp phải khác loại CSVC chính"} />
    ),
    building: (
      <SameSchoolRef
        control={control}
        record={record}
        name="building"
        resource="buildings"
        label="Khối nhà"
        current={record?.building}
        // Phòng phải có khối nhà + tầng (chốt 12/11/2026); khu vực / công trình ẩn hai ô này nên không bị bắt.
        required={!isArea}
        onPicked={() => setValue("floor", "", { shouldDirty: true })}
      />
    ),
    floor: (
      <FormField
        control={control}
        name="floor"
        rules={{ validate: (v: unknown) => isArea || (v != null && v !== "") || "Chọn tầng" }}
        render={({ field }) => (
          <FormItem>
            <FormLabel required={!isArea}>Tầng</FormLabel>
            <Select onValueChange={(v) => { if (v !== "") field.onChange(v); }} value={field.value ? String(field.value) : ""} disabled={!buildingId}>
              <FormControl>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={buildingId ? "Chọn tầng" : "Chọn khối nhà trước"} />
                </SelectTrigger>
              </FormControl>
              <SelectContent className="max-h-64">
                {Array.from({ length: floors }, (_, i) => String(i + 1)).map((f) => (
                  <SelectItem key={f} value={f}>Tầng {f}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />
    ),
    roomType: (
      <div className="grid gap-1">
        {/* Loại của Sở + loại ngoài danh mục của chính trường này. */}
        <RefField control={control} name="roomType" resource="room_types" label="Loại CSVC"
          hint="Theo danh mục CSVC của Sở. Thiết bị để ở Phòng thiết bị giáo dục được tính là “trong kho”."
          current={record?.roomType} placeholder="Vui lòng chọn loại CSVC"
          filters={typeFilter} required />
        <div className="flex justify-end">
          <CustomRoomTypeButton schoolId={roomSchool}
            onCreated={(t) => setValue("roomType", { id: t.id, code: t.code, name: t.name }, { shouldDirty: true })} />
        </div>
      </div>
    ),
    // Phòng bộ môn / thí nghiệm / máy tính là của môn nào — định mức thiết bị "tính cho 01 phòng học
    // bộ môn" nhân theo số phòng của môn. Phòng học thường, kho, thư viện thì để trống.
    subject: <RefField control={control} name="subject" resource="subjects" label="Môn (phòng bộ môn)" hint="Chỉ chọn cho phòng bộ môn. Dùng để tính định mức theo phòng bộ môn." current={record?.subject}
      required={roomType?.functional === true} />,
    condition: <EnumSelect control={control} name="condition" label="Hiện trạng" hint="Tình trạng hiện tại. “Cần sửa chữa” và “Xuống cấp” sẽ có trong báo cáo cơ sở vật chất." options={CONDITION_LABELS} />,
    usageStatus: <EnumSelect control={control} name="usageStatus" label="Tình trạng sử dụng" options={USAGE_STATUS_LABELS} />,
    location: <TextField control={control} name="location" label="Vị trí" placeholder="Dãy A, cạnh cầu thang" rule="SHORT_TEXT" max={100} />,
    area: <TextField control={control} name="area" label="Diện tích (m²)" number numberRule="AREA"
      // > 0 và ≤ 10.000 m² (chốt 12/11/2026, máy chủ kiểm cùng trần); phòng > 500 m² vẫn nhắc kiểm lại.
      rules={{ required: "Nhập diện tích", validate: {
        positive: (v: unknown) => v == null || v === "" || Number(v) > 0 || "Diện tích phải lớn hơn 0",
        max: (v: unknown) => v == null || v === "" || Number(v) <= 10000 || "Diện tích tối đa 10.000 m² — kiểm tra lại đơn vị",
      } }}
      warn={(v) => (!isArea && Number(v) > 500 && Number(v) <= 10000 ? "Diện tích lớn bất thường, kiểm tra lại số m²" : null)} />,
    // Bắt buộc với phòng học, nhà ăn, thư viện (dùng để xếp lớp, cộng chỗ nhà ăn / thư viện); > 0, ≤ 2.000.
    capacity: <TextField control={control} name="capacity" label="Sức chứa" hint="Số chỗ ngồi tối đa." number numberRule="COUNT"
      // `required` (không phải validate) để nhãn tự có dấu * khi loại phòng bắt buộc sức chứa (M2-07, 13/11/2026).
      rules={{ required: CAPACITY_REQUIRED.has(roomType?.systemKey) ? "Nhập sức chứa" : false, validate: {
        positive: (v: unknown) => v == null || v === "" || Number(v) > 0 || "Sức chứa phải lớn hơn 0",
        max: (v: unknown) => v == null || v === "" || Number(v) <= 2000 || "Sức chứa tối đa 2.000 chỗ",
      } }} />,
    managingStaff: <SameSchoolRef control={control} record={record} name="managingStaff" resource="staff" label="Cán bộ phụ trách" hint="Người chịu trách nhiệm." current={record?.managingStaff} />,
    managingUnit: <TextField control={control} name="managingUnit" label="Đơn vị quản lý" hint="Tổ, bộ phận quản lý phòng (nếu không phải cá nhân)." placeholder="Tổ Vật lý" rule="SHORT_TEXT" max={100} />,
  };
}

function RoomFields({ control, record }: { control: Control<any>; record?: any }) {
  const { setValue } = useFormContext();
  const { buildingId, floors, roomSchool, roomType, combinedType, typeGroup } = useRoomForm(control, record);
  const f = roomInputs(control, record, buildingId, floors, setValue, roomSchool, typeGroup, roomType);
  const area = roomType?.kind === "AREA";
  const specs = paramSpecs(roomType, combinedType);
  return (
    <>
      <SchoolField control={control} record={record} hideWhenFixed />
      <div className="form-flow">
        {f.roomType}
        {f.combinedType}
        {area ? null : f.subject}
        {area ? null : f.building}
        {area ? null : f.floor}
        {f.structure}
        {f.condition}
        {f.usageStatus}
      </div>
      <div className="form-flow">
        {f.location}
        {f.area}
        {area ? null : f.capacity}
        <ParamInputs control={control} specs={specs} />
        {area ? null : <OpeningInputs control={control} />}
        {f.managingStaff}
        {f.managingUnit}
      </div>
    </>
  );
}

/**
 * Form thêm / sửa phòng xếp dọc bốn nhóm, mỗi nhóm 3 cột: Thông tin phòng · Vị trí · Tình trạng · Quản lý
 * (kèm Ghi chú). Đủ ô trên một màn, không cuộn. Cùng các ô, cùng việc tự động với khuôn chung.
 */
/** Ô bắt buộc (có dấu *) của form phòng còn trống — dải trên đầu hộp Thêm / Sửa ghi "Còn thiếu: …". */
function useRoomMissing(control: any) {
  const [name, roomType, size, structure, building, floor, capacity] =
    useWatch({ control, name: ["name", "roomType", "area", "structure", "building", "floor", "capacity"] });
  const area = roomType?.kind === "AREA";
  const blank = (v: unknown) => v == null || v === "" || (typeof v === "object" && (v as { id?: unknown }).id == null);
  return {
    info: [blank(name) && "Tên", blank(roomType) && "Loại CSVC"].filter(Boolean) as string[],
    // Chỉ ô có dấu * trên form. Khối nhà, tầng bắt buộc với phòng (không phải khu vực / công trình).
    place: [!area && blank(building) && "Khối nhà", !area && blank(floor) && "Tầng", blank(size) && "Diện tích",
      blank(structure) && "Kết cấu"].filter(Boolean) as string[],
    // Sức chứa bắt buộc với phòng học, nhà ăn, thư viện — cùng luật với ô (M2-07).
    use: [CAPACITY_REQUIRED.has(roomType?.systemKey) && blank(capacity) && "Sức chứa"].filter(Boolean) as string[],
  };
}

/** Ô bắt buộc còn trống trong hộp Thêm / Sửa phòng: chỉ viền đỏ trên chính ô nhập / ô chọn, không tô nền. */
const NEED_CLASS = cn(
  "[&_input:not([type=checkbox])]:border-destructive",
  "[&_[data-slot=select-trigger]]:border-destructive",
  "[&_button[role=combobox]]:border-destructive",
);

function Need({ on, children }: { on: boolean; children: ReactNode }) {
  return <div className={cn("min-w-0", on && NEED_CLASS)}>{children}</div>;
}

/**
 * Khung của từng phần form phòng (trưởng nhóm, 12/11/2026): cả ba phần cùng hiện trong một hộp; phần đang chọn ở cột
 * mục (`data-active` của `RoomFormNav`) có khung xanh — nền xanh nhạt, viền xanh. Ngoài hộp thoại (không có
 * `RoomFormNav`) các lớp này chỉ là lề, không tô gì.
 */
const SEC_BASE = "scroll-mt-3 -mx-3 rounded-xl px-3 py-3 transition-[background-color,box-shadow] duration-200";
// Khung xanh của nhóm đang chọn do `RoomFrame` vẽ: MỘT khung trượt tới nhóm đó (13/11/2026), không tô từng nhóm.
const ROOM_SEC_CLASS = {
  info: SEC_BASE,
  place: SEC_BASE,
  use: SEC_BASE,
};

const ROOM_SECTIONS = [
  { key: "info", title: "Thông tin phòng", icon: DoorOpen },
  { key: "place", title: "Vị trí, tình trạng", icon: MapPin },
  { key: "use", title: "Sử dụng, quản lý", icon: Users },
] as const;

/**
 * Hộp Thêm / Sửa phòng (mockup A, trưởng nhóm chốt 12/11/2026): cột mục bên trái kéo kín chiều cao, mỗi mục ghi còn
 * thiếu ô bắt buộc nào; bấm mục là cuộn tới mục đó. Thân form vẫn là các nhóm như trang sửa.
 */
/** Hai mục dưới của cột trái (Thiết bị · Hồ sơ, bản vẽ) — mở được ở hộp Xem, mờ ở Sửa / Thêm. */
const ROOM_PANELS: RailPanel[] = [
  { key: "equipment", label: "Thiết bị", icon: Package },
  { key: "files", label: "Hồ sơ, bản vẽ", icon: FileText },
];

/** Bấm một mục nhóm ô ở cột trái: khung xanh chuyển sang nhóm đó và cuộn tới (tìm trong chính hộp này). */
function scrollToSection(box: HTMLElement | null, key: string) {
  box?.querySelector(`#room-sec-${key}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function RoomFormNav({ control, record, children }: { control: any; record?: any; children: ReactNode }) {
  const missing = useRoomMissing(control);
  // Không chọn sẵn nhóm nào; bấm lại mục đang chọn / bấm chỗ trống là bỏ chọn (13/11/2026).
  const [active, setActive] = useState<string>("");
  // Bấm Lưu còn lỗi: khung xanh chuyển sang phần có ô lỗi đầu tiên.
  const { submitCount } = useFormState({ control });
  const boxRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!submitCount) return;
    const t = setTimeout(() => {
      const bad = boxRef.current?.querySelector("[aria-invalid=true]");
      const key = bad?.closest("[id^=room-sec-]")?.id.replace("room-sec-", "");
      if (key) setActive(key);
    }, 0);
    return () => clearTimeout(t);
  }, [submitCount]);
  return (
    // Cùng khung, cùng cột trái với hộp Xem (`RoomShowBody`). Bấm / Tab vào một ô thì mục bên trái tự chuyển theo.
    <RoomFrame active={active} boxRef={boxRef} onClear={() => setActive("")}
      onFocusCapture={(e) => {
        const key = (e.target as HTMLElement).closest?.("[id^=room-sec-]")?.id.replace("room-sec-", "");
        if (key && key !== active) setActive(key);
      }}
      rail={
        <RoomRail recordId={record?.id} canWrite={!!record?.id && canWriteRecord("rooms", record)}
          sections={ROOM_SECTIONS.map((s) => ({ ...s, missing: missing[s.key] }))}
          active={active} onSection={(k) => {
            if (k === active) return setActive("");
            setActive(k);
            scrollToSection(boxRef.current, k);
          }}
          panels={ROOM_PANELS} />
      }>
      {children}
    </RoomFrame>
  );
}

/** Chân hộp Thêm / Sửa phòng: còn bao nhiêu ô bắt buộc chưa điền (cùng đếm với cột mục). */
function RoomFormFooterNote({ control }: { control: any }) {
  const missing = useRoomMissing(control);
  const n = missing.info.length + missing.place.length + missing.use.length;
  return n ? <span className="text-warning-text text-sm">Còn {n} ô bắt buộc chưa điền</span> : null;
}


/**
 * Một ô của form phòng. Thêm và Sửa hiện sẵn ô nhập (trưởng nhóm, 12/11/2026 — bỏ kiểu "bấm vào mới sửa"); màn xem
 * vẫn là nhãn / giá trị (`RoomInfo`). `locked`: ô chỉ xem, có ổ khoá (Mã sau khi tạo) — dựng bằng đúng FormItem /
 * FormLabel / Input như ô bên cạnh để nhãn và ô thẳng hàng; giá trị cũ vẫn đi theo khi Lưu.
 */
function Cell({ control, name, label, locked, className, children }: {
  control: any;
  name: string;
  label: string;
  locked?: boolean;
  className?: string;
  children: ReactNode;
}) {
  if (!locked) return <div className={cn("min-w-0", className)}>{children}</div>;
  return (
    <FormField control={control} name={name} render={({ field }) => (
      <FormItem className={cn("min-w-0", className)} title="Không sửa sau khi tạo">
        <FormLabel required={false} className="text-muted-foreground">
          {label}
          <Lock className="size-3 opacity-70" />
        </FormLabel>
        <FormControl>
          <Input value={field.value ?? ""} readOnly tabIndex={-1} className="bg-muted/50 cursor-default font-mono" />
        </FormControl>
      </FormItem>
    )} />
  );
}

/**
 * Hỏi lại khi SỬA một phòng đang dùng (có thiết bị / lớp) mà đổi loại CSVC hoặc chuyển sang ngừng sử dụng (trưởng
 * nhóm chốt 12/11/2026): hỏi ngay lúc chọn, nói rõ số thiết bị, lớp đang ở phòng; "Giữ như cũ" trả ô về giá trị cũ.
 */
function RoomChangeGuard({ control, record }: { control: any; record?: any }) {
  const { setValue } = useFormContext();
  const [typeId, usage] = useWatch({ control, name: ["roomType.id", "usageStatus"] });
  const enabled = !!record?.id && !!record?.school?.id;
  const byRoom = [{ field: "school.id", operator: "eq" as const, value: record?.school?.id }, { field: "room.id", operator: "eq" as const, value: record?.id }];
  const { result: items } = useList({ resource: "equipment_items", filters: byRoom, pagination: { currentPage: 1, pageSize: 1 }, queryOptions: { enabled } });
  const { result: classes } = useList({ resource: "school_classes", filters: byRoom, pagination: { currentPage: 1, pageSize: 1 }, queryOptions: { enabled } });
  const used = [items?.total ? `${items.total} thiết bị` : null, classes?.total ? `${classes.total} lớp` : null].filter(Boolean).join(", ");
  const [ask, setAsk] = useState<null | "type" | "usage">(null);
  const [settled, setSettled] = useState<{ type?: unknown; usage?: unknown }>({});
  useEffect(() => {
    if (!enabled || !used) return;
    if (typeId && typeId !== record.roomType?.id && settled.type !== typeId) setAsk("type");
    else if (usage === "NGUNG_SU_DUNG" && record.usageStatus !== "NGUNG_SU_DUNG" && settled.usage !== usage) setAsk("usage");
  }, [enabled, used, typeId, usage, record, settled]);
  const keep = () => {
    if (ask === "type") setValue("roomType", record.roomType ?? { id: null }, { shouldDirty: true });
    if (ask === "usage") setValue("usageStatus", record.usageStatus, { shouldDirty: true });
    setAsk(null);
  };
  const accept = () => {
    setSettled((s) => (ask === "type" ? { ...s, type: typeId } : { ...s, usage }));
    setAsk(null);
  };
  return (
    <AlertDialog open={ask != null} onOpenChange={(o) => (o ? null : keep())}>
      {ask ? (
        <ConfirmContent tone="warning"
          title={ask === "type" ? "Đổi loại của phòng đang dùng?" : "Ngừng sử dụng phòng này?"}
          description={ask === "type"
            ? `Phòng đang có ${used}. Đổi loại thì phòng được tính vào chuẩn cơ sở vật chất khác, ô Môn có thể phải chọn lại.`
            : `Phòng đang có ${used}. Phòng ngừng sử dụng không chọn được ở phiếu; thiết bị, lớp vẫn ghi ở phòng này cho tới khi chuyển đi.`}
          cancelLabel="Giữ như cũ" confirmLabel={ask === "type" ? "Đổi loại" : "Ngừng sử dụng"}
          onConfirm={accept} />
      ) : null}
    </AlertDialog>
  );
}


/**
 * Kết cấu của phòng LẤY THEO KHỐI NHÀ (trưởng nhóm, 12/11/2026): khối nhà đã khai kết cấu thì ô chỉ hiện giá trị (không
 * phải chọn), đổi khối thì đổi theo; "Khai riêng ›" mở ô chọn cho phòng khác khối (tầng cơi nới, phần thuê, mượn…).
 * Khối chưa khai kết cấu / chưa chọn khối thì là ô chọn như thường (`fallback`). Máy chủ cùng luật (RoomService).
 */
function RoomStructureField({ control, record, buildingId, fallback }: {
  control: Control<any>;
  record?: any;
  buildingId: unknown;
  fallback: ReactNode;
}) {
  const { setValue } = useFormContext();
  const value = useWatch({ control, name: "structure" });
  const { result: building } = useOne<any>({ resource: "buildings", id: (buildingId as string) ?? "", queryOptions: { enabled: !!buildingId } });
  const inherited: string | undefined = buildingId ? building?.structure ?? undefined : undefined;
  // Khai riêng: phòng đã lưu kết cấu khác khối nhà của nó; hoặc người dùng vừa bấm "Khai riêng".
  const [own, setOwn] = useState<boolean | null>(null);
  const savedOwn = !!record?.structure && !!inherited && record?.building?.id === building?.id && record.structure !== inherited;
  const isOwn = own ?? savedOwn;
  useEffect(() => {
    if (inherited && !isOwn && value !== inherited) setValue("structure", inherited, { shouldDirty: true });
  }, [inherited, isOwn, value, setValue]);
  if (!inherited) return <>{fallback}</>;
  if (isOwn) {
    return (
      <div className="min-w-0">
        {fallback}
        <button type="button" onClick={() => { setOwn(false); setValue("structure", inherited, { shouldDirty: true }); }}
          className="text-primary hover:text-primary/80 mt-1 text-xs font-medium">
          Lấy lại theo khối nhà
        </button>
      </div>
    );
  }
  return (
    <FormItem className="min-w-0">
      <FormLabel required={false}>Kết cấu</FormLabel>
      <div className="flex h-9 items-center justify-between gap-2 rounded-md border bg-muted/40 px-3 text-sm">
        <span className="truncate font-medium">{STRUCTURE_LABELS[inherited] ?? inherited}</span>
        <button type="button" onClick={() => setOwn(true)} className="text-primary hover:text-primary/80 shrink-0 text-xs font-medium">
          Khai riêng ›
        </button>
      </div>
    </FormItem>
  );
}

function RoomFormBody({ control, record, config, inDialog }: { control: any; record?: any; config: CatalogConfig; inDialog?: boolean }) {
  const { setValue } = useFormContext();
  const { buildingId, floors, roomSchool, roomType, combinedType, typeGroup } = useRoomForm(control, record);
  const f = roomInputs(control, record, buildingId, floors, setValue, roomSchool, typeGroup, roomType);
  // Sân, cổng, khu vệ sinh, khu để xe… (dạng Khu vực, công trình): không có môn.
  const area = roomType?.kind === "AREA";
  const specs = paramSpecs(roomType, combinedType);
  // Hộp Thêm / Sửa: ô bắt buộc còn trống tô cam (cùng danh sách với cột mục bên trái).
  const missing = useRoomMissing(control);
  const need = (label: string) => !!inDialog && [...missing.info, ...missing.place, ...missing.use].includes(label);
  const body = (
    <div className="space-y-4">
      <RoomChangeGuard control={control} record={record} />
      <div id="room-sec-info" className={ROOM_SEC_CLASS.info}>
      <TopGroup icon={DoorOpen} title="Thông tin phòng" cols={4} plain={inDialog}>
        {/* Ô Trường chỉ hiện khi tài khoản phải chọn trường. */}
        <div className="empty:hidden sm:col-span-2 lg:col-span-4">
          <SchoolField control={control} record={record} hideWhenFixed />
        </div>
        {/* Mã khoá sau khi tạo: tem QR và lô nhập dò phòng theo mã (trưởng nhóm, 12/11/2026). */}
        <Cell control={control} name="code" label="Mã" locked={!!record?.id}>
          <CatalogCodeField control={control} config={config} fill />
        </Cell>
        {/* Tên một cột như mọi ô (trưởng nhóm 12/11/2026: ô tên hai cột dài thừa) — hàng 1: Mã · Tên · Loại. */}
        <Need on={need("Tên")}>
          <CatalogNameField control={control} config={config} />
        </Need>
        <Need on={need("Loại CSVC")}>{f.roomType}</Need>
        {f.combinedType}
        {area ? null : f.subject}
      </TopGroup>
      </div>
      <div id="room-sec-place" className={ROOM_SEC_CLASS.place}>
      <TopGroup icon={MapPin} title="Vị trí, tình trạng" cols={4} plain={inDialog}>
        {area ? null : <Need on={need("Khối nhà")}>{f.building}</Need>}
        {area ? null : <Need on={need("Tầng")}>{f.floor}</Need>}
        {f.location}
        <Need on={need("Diện tích")}>{f.area}</Need>
        <Need on={need("Kết cấu")}>
          {area ? f.structure : <RoomStructureField control={control} record={record} buildingId={buildingId} fallback={f.structure} />}
        </Need>
        {f.condition}
        {f.usageStatus}
        <ParamInputs control={control} specs={specs} />
      </TopGroup>
      </div>
      <div id="room-sec-use" className={ROOM_SEC_CLASS.use}>
      <TopGroup icon={Users} title="Sử dụng, quản lý" cols={4} plain={inDialog}>
        {area ? null : <Need on={need("Sức chứa")}>{f.capacity}</Need>}
        {f.managingStaff}
        {f.managingUnit}
        {area ? <div className="hidden lg:block" /> : <OpeningSessions control={control} />}
        {area ? null : <div className="min-w-0 sm:col-span-2"><OpeningDays control={control} /></div>}
        <div className={cn("min-w-0", area ? "sm:col-span-2 lg:col-span-4" : "sm:col-span-2")}>
          <Label className="mb-2">Ghi chú</Label>
          <CatalogNoteField control={control} max={config.noteMax} />
        </div>
      </TopGroup>
      </div>
    </div>
  );
  return inDialog ? <RoomFormNav control={control} record={record}>{body}</RoomFormNav> : body;
}

/** Nhãn của một thông số đã khai — tên khoá là chữ không dấu; hiện tên đọc được cho các thông số có sẵn. */
const PARAM_LABELS: Record<string, string> = {
  closedStackArea: "Kho sách kín (m²)",
  openStackArea: "Kho sách mở (m²)",
  studentReadingArea: "Phòng đọc học sinh (m²)",
  teacherReadingArea: "Phòng đọc giáo viên (m²)",
  bicycleArea: "Để xe đạp (m²)",
  motorbikeArea: "Để xe máy (m²)",
  floorLength: "Chiều dài sàn tập (m)",
  floorWidth: "Chiều rộng sàn tập (m)",
  clearHeight: "Chiều cao thông thủy (m)",
  fieldLength: "Chiều dài sân (m)",
  fieldWidth: "Chiều rộng sân (m)",
  beds: "Số chỗ ngủ",
};
const paramLabel = (key: string) => PARAM_LABELS[key] ?? key;

const ROOM_FILES = facilityFiles("rooms", "Ảnh hiện trạng, sơ đồ bố trí thiết bị của phòng. Tối đa 10 MB mỗi tệp.");


/**
 * Một ô của màn xem: nhãn nhỏ trên, giá trị dưới — cùng kiểu các khối Hồ sơ trường (trưởng nhóm, 12/11/2026: không vẽ
 * khung như ô nhập). Ô vẫn ở đúng vị trí của nó trên form Sửa. Ô bắt buộc còn trống ghi cam "Chưa khai".
 */
/** Ô chỉ đọc của màn xem phòng. Trống: ô bắt buộc ghi "Chưa khai" (cam); ô không bắt buộc ghi `blank` (chữ nghiêng mờ). */
function ViewField({ label, value, required, span, blank = "Chưa có" }: {
  label: string;
  value: ReactNode;
  required?: boolean;
  span?: "2" | "all";
  blank?: string;
}) {
  const empty = value == null || value === "" || value === "—";
  // Cùng khuôn với một ô của form (nhãn cỡ FormLabel, dòng giá trị cao bằng ô nhập h-9): bấm Sửa thì ô nhập hiện ra
  // đúng chỗ dòng chữ, không ô nào xê dịch.
  return (
    <div className={cn("grid min-w-0 gap-2", span === "2" && "sm:col-span-1 lg:col-span-2", span === "all" && "col-span-full")}>
      <div className="text-muted-foreground text-sm leading-none font-medium">{label}:</div>
      <div className={cn("flex min-h-9 items-center text-sm break-words",
        empty ? (required ? "text-warning-text font-medium" : "text-muted-foreground/80") : "font-medium")}>
        {empty ? (required ? "Chưa khai" : blank) : value}
      </div>
    </div>
  );
}

/** Ô bắt buộc còn trống của một phòng ĐÃ LƯU — cùng danh sách với `useRoomMissing` của form (cột trái, chân hộp Xem). */
function roomMissing(r: any) {
  const area = r?.roomType?.kind === "AREA";
  const blank = (v: unknown) => v == null || v === "";
  return {
    info: [blank(r?.name) && "Tên", !r?.roomType?.id && "Loại CSVC"].filter(Boolean) as string[],
    place: [!area && !r?.building?.id && "Khối nhà", !area && blank(r?.floor) && "Tầng", blank(r?.area) && "Diện tích",
      blank(r?.structure) && "Kết cấu"].filter(Boolean) as string[],
    use: [CAPACITY_REQUIRED.has(r?.roomType?.systemKey) && blank(r?.capacity) && "Sức chứa"].filter(Boolean) as string[],
  };
}

/**
 * Thân hộp XEM phòng (mockup "Hộp phòng", trưởng nhóm chốt 13/11/2026): cùng khung, cùng cột trái với hộp Sửa / Thêm —
 * ảnh (đổi ngay tại đây), mục lục ba nhóm ô, rồi Thiết bị · Hồ sơ, bản vẽ thay cho dải tab trên đầu.
 * Bên phải là các nhóm ô chỉ đọc ở đúng vị trí của chúng trên form — bấm Sửa thì chỉ chữ thành ô nhập.
 */
function RoomShowBody({ record: r, onTab }: { record: any; onTab?: (key: string) => void }) {
  const [panel, setPanel] = useState("info");
  // Không chọn sẵn nhóm nào; bấm lại mục đang chọn / bấm chỗ trống là bỏ chọn (13/11/2026).
  const [active, setActive] = useState("");
  const boxRef = useRef<HTMLDivElement>(null);
  const missing = roomMissing(r);
  // Thiết bị: chính các tab registry gắn vào `ShowTabs`; Hồ sơ, bản vẽ: tệp đính kèm của phòng.
  const contents: Record<string, (props: { record: any }) => ReactNode> = {
    ...Object.fromEntries((ROOM_EXTRA.ShowTabs ?? []).map((t) => [t.key, t.Content])),
    files: ROOM_FILES,
  };
  const panels = ROOM_PANELS.filter((p) => contents[p.key]);
  const Content = panel === "info" ? null : contents[panel];
  const open = (key: string) => {
    setPanel(key);
    onTab?.(key);
  };
  return (
    <RoomFrame active={panel === "info" ? active : ""} boxRef={boxRef} onClear={() => setActive("")}
      rail={
        <RoomRail recordId={r?.id} canWrite={r?._can?.write === true && canWriteRecord("rooms", r)}
          sections={ROOM_SECTIONS.map((s) => ({ ...s, missing: missing[s.key] }))}
          active={active}
          onSection={(k) => {
            if (panel === "info" && k === active) return setActive("");
            setActive(k);
            open("info");
            // Đang ở Thiết bị / Hồ sơ: đợi nhóm ô hiện lại rồi mới cuộn.
            setTimeout(() => scrollToSection(boxRef.current, k), 0);
          }}
          panels={panels} panel={panel} onPanel={open} />
      }>
      {Content ? (
        // Trang riêng cao kín khung; trống thì chữ đứng giữa (`FillPanelContext`, trưởng nhóm 13/11/2026).
        <div className="flex flex-1 flex-col gap-3">
          <h3 className="text-[0.9375rem] font-semibold">{panels.find((p) => p.key === panel)?.label}</h3>
          <FillPanelContext.Provider value>
            <div className="flex flex-1 flex-col"><Content record={r} /></div>
          </FillPanelContext.Provider>
        </div>
      ) : <RoomInfo record={r} />}
    </RoomFrame>
  );
}

/** "PH0009 · Thư viện · Nhà A, Tầng 3" — dòng phụ dưới tên phòng, chung cho Xem và Sửa. */
function roomSubtitle(r: any) {
  const place = [r?.building?.name, r?.floor ? `Tầng ${r.floor}` : null].filter(Boolean).join(", ");
  return [r?.code, r?.roomType?.name, place].filter(Boolean).join(" · ");
}

/** Đầu hộp phòng — Xem: tên + trạng thái + biểu tượng QR; Sửa: tên + "Đang sửa"; Thêm: "Thêm phòng". Cùng cỡ chữ. */
function RoomHeading({ record: r, editing, creating }: { record?: any; editing?: boolean; creating?: boolean }) {
  // Thêm cũng có dòng phụ: đầu hộp cao bằng hộp Xem / Sửa, thân không nhảy lên.
  if (creating) {
    return (
      <div className="min-w-0 space-y-1 text-start">
        <div className="truncate text-xl leading-snug font-semibold tracking-tight">Thêm phòng</div>
        <div className="text-muted-foreground truncate text-sm font-normal">Phòng mới, chưa lưu</div>
      </div>
    );
  }
  return (
    <div className="min-w-0 space-y-1 text-start">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <span className="truncate text-xl leading-snug font-semibold tracking-tight">{r?.name ?? "…"}</span>
        {editing ? (
          <Badge variant="info">Đang sửa</Badge>
        ) : (
          <>
            {r?.usageStatus ? <Badge variant={ROOM_USAGE_VARIANTS[r.usageStatus] ?? "neutral"}>{USAGE_STATUS_LABELS[r.usageStatus] ?? r.usageStatus}</Badge> : null}
            {r?.condition ? <Badge variant={FACILITY_CONDITION_VARIANTS[r.condition] ?? "neutral"}>{CONDITION_LABELS[r.condition] ?? r.condition}</Badge> : null}
          </>
        )}
        {/* Tem QR chỉ ở hộp Xem: ở hộp Sửa nút đầu hộp giành mất tiêu điểm của ô nhập đầu tiên. */}
        {editing ? null : <RoomQrButton record={r} />}
      </div>
      {r ? <div className="text-muted-foreground truncate text-sm font-normal">{roomSubtitle(r)}</div> : null}
    </div>
  );
}

/** Chân hộp Xem phòng: còn ô bắt buộc nào chưa khai (cùng đếm với cột trái). */
function RoomShowFooterNote({ record }: { record: any }) {
  const m = roomMissing(record);
  const gaps = [...m.info, ...m.place, ...m.use];
  return gaps.length ? (
    <span className="text-warning-text text-sm">Còn {gaps.length} ô bắt buộc chưa khai: {gaps.join(", ")}</span>
  ) : null;
}

/** Các nhóm ô chỉ đọc của hộp Xem phòng — cùng nhóm, cùng thứ tự, cùng độ rộng ô với `RoomFormBody`. */
function RoomInfo({ record: r }: { record: any }) {
  const area = r?.roomType?.kind === "AREA";
  const params = Object.entries((r?.params ?? {}) as Record<string, string>);
  // Lớp đang học ở phòng — thay thông số "Dành cho khối lớp" gõ tay (241): khối của phòng suy từ lớp, không khai.
  const { result: classResult } = useList<any>({
    resource: "school_classes",
    filters: [{ field: "school.id", operator: "eq", value: r?.school?.id }, { field: "room.id", operator: "eq", value: r?.id }],
    pagination: { currentPage: 1, pageSize: 50 },
    queryOptions: { enabled: !!r?.id && !!r?.school?.id && !area },
  });
  const classes = (classResult?.data ?? []).map((c: any) => (c.grade?.name ? `${c.code ?? c.name} (${c.grade.name.toLowerCase()})` : c.code ?? c.name)).join(", ");
  const days = r?.openDays?.length ? OPEN_DAYS.filter((d) => r.openDays.includes(d.value)).map((d) => d.short).join(", ") : "Mọi ngày";
  const sessions = r?.openSessions?.length ? OPEN_SESSIONS.filter((s) => r.openSessions.includes(s.value)).map((s) => s.label).join(", ") : "Mọi buổi";
  return (
    <div className="space-y-4">
      <div id="room-sec-info" className={ROOM_SEC_CLASS.info}>
      <TopGroup icon={DoorOpen} title="Thông tin phòng" cols={4} plain>
        <ViewField label="Mã" value={r?.code} required />
        <ViewField label="Tên" value={r?.name} required />
        <ViewField label="Loại CSVC" value={r?.roomType?.name} required />
        <ViewField label="Dùng kết hợp" value={r?.combinedType?.name ?? "Không"} />
        {area ? null : <ViewField label="Môn (phòng bộ môn)" value={r?.subject?.name} blank="Không phải phòng bộ môn" />}
        {area ? null : <ViewField label="Lớp đang học" value={classes || "Chưa có lớp nào"} span="2" />}
      </TopGroup>
      </div>
      <div id="room-sec-place" className={ROOM_SEC_CLASS.place}>
      <TopGroup icon={MapPin} title="Vị trí, tình trạng" cols={4} plain>
        {area ? null : <ViewField label="Khối nhà" value={r?.building?.name ? [r.building.name, r?.campus?.name].filter(Boolean).join(" · ") : null} />}
        {area ? null : <ViewField label="Tầng" value={r?.floor ? `Tầng ${r.floor}` : null} />}
        <ViewField label="Vị trí" value={r?.location} blank="Chưa ghi vị trí" />
        <ViewField label="Diện tích (m²)" value={r?.area != null && r.area !== "" ? Number(r.area).toLocaleString("vi-VN", { useGrouping: false }) : null} required />
        <ViewField label="Kết cấu" value={STRUCTURE_LABELS[r?.structure]} required />
        <ViewField label="Hiện trạng" value={CONDITION_LABELS[r?.condition]} />
        <ViewField label="Tình trạng sử dụng" value={USAGE_STATUS_LABELS[r?.usageStatus]} />
        {params.map(([k, v]) => <ViewField key={k} label={paramLabel(k)} value={v} />)}
      </TopGroup>
      </div>
      <div id="room-sec-use" className={ROOM_SEC_CLASS.use}>
      <TopGroup icon={Users} title="Sử dụng, quản lý" cols={4} plain>
        {area ? null : <ViewField label="Sức chứa" value={r?.capacity != null && r.capacity !== "" ? Number(r.capacity).toLocaleString("vi-VN", { useGrouping: false }) : null} required={CAPACITY_REQUIRED.has(r?.roomType?.systemKey)} blank="Chưa ghi sức chứa" />}
        <ViewField label="Cán bộ phụ trách" value={r?.managingStaff?.name} blank="Chưa phân công" />
        <ViewField label="Đơn vị quản lý" value={r?.managingUnit} blank="Chưa ghi đơn vị" />
        {area ? null : <ViewField label="Buổi mở cửa" value={sessions} />}
        {area ? null : <ViewField label="Ngày mở cửa" value={days} span="2" />}
        <ViewField label="Ghi chú" value={r?.note} span={area ? "all" : "2"} blank="Không có ghi chú" />
      </TopGroup>
      </div>
    </div>
  );
}

export const ROOM_EXTRA: CatalogExtra = {
  // Hộp xem, Sửa, Thêm cùng một khung (mockup "Hộp phòng", 13/11/2026): đầu hộp `RoomHeading`, cột trái `RoomRail`
  // (ảnh, mục lục, Thiết bị · Hồ sơ), thân là các nhóm ô. `ShowTabs` (Thiết bị)
  // không còn là dải tab — `RoomShowBody` mở chúng từ cột trái.
  ShowBody: RoomShowBody,
  ShowHeading: ({ record }: { record?: any }) => <RoomHeading record={record} />,
  FormHeading: ({ record, creating }: { record?: any; creating: boolean }) => <RoomHeading record={record} editing creating={creating} />,
  ShowFooterNote: RoomShowFooterNote,
  ShowBelow: function RoomShowBelow({ record }: { record: any }) {
    const Files = ROOM_FILES;
    return (
      <div className="space-y-5">
        <RoomEquipment record={record} />
        <FacilityQr record={record} />
        <Files record={record} />
      </div>
    );
  },
  ShowTabs: [{ key: "equipment", label: "Thiết bị", Content: RoomEquipment }],
  section: { title: "Thông tin phòng" },
  // Một trạng thái thôi: "Tình trạng sử dụng". Cờ hoạt động chung do máy chủ suy từ nó.
  hideActive: true,
  defaults: {
    school: { id: null },
    campus: { id: null },
    building: { id: null },
    roomType: { id: null },
    subject: { id: null },
    location: "",
    floor: "",
    area: null,
    capacity: null,
    // Phòng mới mặc định tốt và đang dùng — lập phòng là để dùng; khác thì đổi.
    condition: "TOT",
    usageStatus: "DANG_SU_DUNG",
    managingStaff: { id: null },
    managingUnit: "",
    structure: null,
    combinedType: { id: null },
    params: {},
    openDays: [],
    openSessions: [],
  },
  Fields: RoomFields,
  FormBody: RoomFormBody,
  // Hộp xem và hộp Thêm / Sửa cùng cỡ (64rem — nhỏ hơn `wide` 20%, trưởng nhóm 12/11/2026), cao vừa nội dung.
  dialogSize: "wide" as const, // cột mục bên trái (RoomFormNav) cần bề rộng hộp lớn
  FormFooterNote: RoomFormFooterNote,
  // Không `dialogHeader` (biểu tượng + mô tả): hộp Sửa giữ đúng tiêu đề của hộp xem (tên phòng), bấm Sửa tiêu đề không
  // đổi kiểu (trưởng nhóm, 12/11/2026) — xem `CatalogFormDialog`.
  ListFilters: CampusTableFilter,
  columns: [
    // Trường đứng NGAY SAU tên phòng, không ở cuối: bảng phòng có nhiều cột nhất trong các danh mục
    // của trường, và ở màn 1280px cột cuối bị đẩy ra ngoài — với người xem nhiều trường (quản trị,
    // Sở) thì "phòng của trường nào" là thứ phải thấy đầu tiên, không phải thứ phải cuộn ngang mới thấy.
    schoolColumn,
    campusColumn,
    refCell("building", "Khối nhà", "Chưa gắn"),
    refCell("roomType", "Loại CSVC", "Chưa phân loại"),
    refCell("subject", "Môn", "Không theo môn"),
    {
      id: "structure",
      header: "Kết cấu",
      enableSorting: false,
      cell: ({ row }) => STRUCTURE_LABELS[row.original.structure] ?? <span className="text-muted-foreground">Chưa khai</span>,
    },
    {
      id: "usageStatus",
      header: "Sử dụng",
      enableSorting: false,
      cell: ({ row }) => USAGE_STATUS_LABELS[row.original.usageStatus] ?? <span className="text-muted-foreground">Chưa khai</span>,
    },
    conditionCell,
  ] as ColumnDef<any, any>[],
  show: (r: any) => [
    // Cùng NHÓM, cùng thứ tự với form sửa (RoomFormBody): bấm Sửa thì mỗi ô nằm nguyên chỗ. Cơ sở không có ô riêng
    // trên form (theo khối nhà) nên đi kèm tên khối nhà.
    { label: "Loại CSVC", value: r?.roomType?.name ?? "—", group: "Thông tin phòng", groupIcon: DoorOpen },
    { label: "Dùng kết hợp", value: r?.combinedType?.name ?? "—" },
    { label: "Môn (phòng bộ môn)", value: r?.subject?.name ?? "—" },
    { label: "Khối nhà", value: r?.building?.name ? [r.building.name, r?.campus?.name].filter(Boolean).join(" · ") : "—", group: "Vị trí", groupIcon: MapPin },
    { label: "Tầng", value: r?.floor ? `Tầng ${r.floor}` : "—" },
    { label: "Vị trí", value: r?.location ?? "—" },
    { label: "Kết cấu", value: STRUCTURE_LABELS[r?.structure] ?? "—", group: "Tình trạng", groupIcon: Activity },
    { label: "Hiện trạng", value: CONDITION_LABELS[r?.condition] ?? "Chưa đánh giá" },
    { label: "Tình trạng sử dụng", value: USAGE_STATUS_LABELS[r?.usageStatus] ?? "—" },
    { label: "Diện tích (m²)", value: r?.area ?? "—" },
    ...Object.entries((r?.params ?? {}) as Record<string, string>).map(([k, v], i) => ({
      label: paramLabel(k), value: v, ...(i === 0 ? { group: "Thông số", groupIcon: Ruler } : {}),
    })),
    { label: "Lịch mở cửa", value: openingText(r?.openDays, r?.openSessions), group: "Lịch mở cửa", groupIcon: Clock },
    { label: "Sức chứa", value: r?.capacity ?? "—", group: "Quản lý", groupIcon: Users },
    { label: "Cán bộ phụ trách", value: r?.managingStaff?.name ?? "—" },
    { label: "Đơn vị quản lý", value: r?.managingUnit ?? "—" },
  ],
};
