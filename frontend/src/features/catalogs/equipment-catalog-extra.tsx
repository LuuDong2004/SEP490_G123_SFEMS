import { FormHint } from "@/shared/components/form/help-hint";
import type { ColumnDef } from "@tanstack/react-table";
import { useFormContext, useWatch, type Control } from "react-hook-form";

import { Badge } from "@/shared/ui/badge";
import { Input } from "@/shared/ui/input";
import { Switch } from "@/shared/ui/switch";
import { Textarea } from "@/shared/ui/textarea";
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
import { RefField } from "@/shared/components/catalog/ref-field";
import { CATALOG_ORIGIN_LABELS, TRACKING_TYPE_LABELS } from "@/domains/equipment-catalog/types";
import { maxLengthOf, mergeRules, textRules, type TextRule } from "@/shared/lib/field-rules";
import { ASSET_CATEGORY_LABELS, PHYSICAL_TYPE_LABELS } from "@/domains/equipment/types";
import { EquipmentCatalogDetail, EquipmentCatalogFormBody } from "./equipment-catalog-profile";

/* eslint-disable @typescript-eslint/no-explicit-any */



const NONE = "__none__";

function TextField({
  control,
  name,
  label,
  hint,
  placeholder,
  rules,
  transform,
  rule,
  max,
}: {
  control: Control<any>;
  name: string;
  label: string;
  /** Lời giải thích — dấu "?" cạnh nhãn. */
  hint?: string;
  placeholder?: string;
  rules?: any;
  transform?: (v: string) => string;
  /** Kiểu trường chuẩn — cùng `@Text` của `EquipmentCatalogRequest`. */
  rule?: TextRule;
  max?: number;
}) {
  return (
    <FormField
      control={control}
      name={name}
      rules={rule ? mergeRules(textRules(rule, label, { max }), rules) : rules}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          {hint ? <FormHint>{hint}</FormHint> : null}
          <FormControl>
            <Input
              {...field}
              value={field.value ?? ""}
              onChange={(e) => field.onChange(transform ? transform(e.target.value) : e.target.value)}
              placeholder={placeholder}
              maxLength={rule ? maxLengthOf(rule, max) : undefined}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function EnumSelect({
  control,
  name,
  label,
  hint,
  options,
}: {
  control: Control<any>;
  name: string;
  label: string;
  /** Lời giải thích — dấu "?" cạnh nhãn. */
  hint?: string;
  options: Record<string, string>;
}) {
  return (
    <FormField
      control={control}
      name={name}
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
        </FormItem>
      )}
    />
  );
}

/** Một cờ bật/tắt, viền như ô "Thuộc danh mục tối thiểu" để cả cụm đọc thành một hàng. */
function CheckField({ control, name, label }: { control: Control<any>; name: string; label: string }) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className="border-border flex flex-row items-center gap-3 rounded-lg border px-4 py-2.5">
          <FormControl>
            <Switch checked={field.value ?? false} onCheckedChange={field.onChange} />
          </FormControl>
          <FormLabel className="font-normal">{label}</FormLabel>
        </FormItem>
      )}
    />
  );
}

function CatalogTreeFields({ control, record }: { control: Control<any>; record?: any }) {
  const { setValue } = useFormContext();
  const levelId = useWatch({ control, name: "educationLevel.id" });
  const byLevel = levelId ? [{ field: "educationLevel.id", operator: "eq" as const, value: levelId }] : undefined;
  return (
    <>
      <div className="grid gap-5 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <RefField
          control={control}
          name="parent"
          resource="equipment_catalogs"
          label="Thuộc nhóm" hint="Chỉ chọn khi đây là một biến thể của thiết bị khác."
          current={record?.parent}
        />
        <TextField
          control={control}
          name="teachingCode"
          label="Mã loại thiết bị chuẩn" hint="Ba chữ in hoa theo bảng mã của Sở."
          placeholder="ABC"
          transform={(v) => v.toUpperCase()}
          rules={{ pattern: { value: /^$|^[A-Z]{3}$/, message: "Gồm đúng 3 chữ in hoa" } }}
        />
      </div>
      <div className="form-flow">
        <RefField control={control} name="equipmentType" resource="equipment_types" label="Loại thiết bị" current={record?.equipmentType} />
        <RefField control={control} name="unit" resource="units" label="Đơn vị tính" hint="Thiết bị thuộc mục này dùng đơn vị tính này. Để trống thì hồ sơ thiết bị chưa chuẩn." current={record?.unit} />
        {/* Cấp học trước; môn học và khối lớp lọc theo cấp học đã chọn. */}
        <RefField
          control={control}
          name="educationLevel"
          resource="education_levels"
          label="Cấp học"
          current={record?.educationLevel}
          onPicked={() => setValue("grade.id", null, { shouldDirty: true })}
        />
        <RefField control={control} name="subject" resource="subjects" label="Môn học" hint="Môn học có trong mã thiết bị. Để trống nếu dùng chung cho mọi môn." current={record?.subject} filters={byLevel} />
        <RefField control={control} name="grade" resource="grades" label="Khối lớp" current={record?.grade} filters={byLevel} />
      </div>
      <div className="form-flow">
        <EnumSelect control={control} name="assetCategory" label="Phân loại kế toán" hint="Tài sản cố định, công cụ dụng cụ, vật tư hay hoá chất. Áp dụng cho mọi thiết bị thuộc mục này." options={ASSET_CATEGORY_LABELS} />
        <EnumSelect control={control} name="physicalOrDigital" label="Dạng thiết bị" options={PHYSICAL_TYPE_LABELS} />
      </div>
      {/* Mã thống kê tách khỏi Mã: mã trên là của danh mục cấp chủ quản ban
          hành, mã dưới là mã trường tự đặt. Gộp lại thì trường đổi mã nội bộ
          một cái là số liệu gửi lên không ghép được với danh mục gốc nữa. */}
      <div className="form-flow">
        <TextField control={control} name="statisticalCode" label="Mã thống kê" rule="CODE" />
        <TextField control={control} name="legalBasis" label="Thông tư / Quyết định" rule="SHORT_TEXT" />
      </div>
      {/* Với thiết bị tối thiểu là cột "Mô tả chi tiết" của phụ lục thông tư — yêu cầu kỹ thuật dùng
          lại khi lập đề xuất mua sắm và khi nghiệm thu hàng về. */}
      <FormField
        control={control}
        name="description"
        rules={textRules("LONG_TEXT", "Mô tả / yêu cầu kỹ thuật", { max: 20000 })}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Mô tả / yêu cầu kỹ thuật</FormLabel>
            <FormControl>
              <Textarea rows={5} maxLength={maxLengthOf("LONG_TEXT", 20000)} value={field.value ?? ""} onChange={field.onChange} onBlur={field.onBlur} name={field.name} ref={field.ref} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <div className="flex flex-wrap gap-3">
        <CheckField control={control} name="usedByTeacher" label="Giáo viên sử dụng" />
        <CheckField control={control} name="usedByStudent" label="Học sinh sử dụng" />
        <CheckField control={control} name="selfMade" label="Thiết bị tự làm" />
      </div>
      <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_10rem]">
        <EnumSelect control={control} name="trackingType" label="Cách quản lý" hint="Từng cái: mỗi cái một mã. Theo lô: cả lô chung một mã, chỉ cho vật tư, hoá chất." options={TRACKING_TYPE_LABELS} />
      </div>
      <FormField
        control={control}
        name="minimumRequired"
        render={({ field }) => (
          <FormItem className="flex flex-row items-center justify-between gap-6 rounded-lg border border-border px-4 py-2.5 sm:max-w-xs">
            <FormLabel>Thuộc danh mục tối thiểu</FormLabel>
            <FormControl>
              <Switch checked={field.value ?? false} onCheckedChange={field.onChange} />
            </FormControl>
          </FormItem>
        )}
      />
    </>
  );
}

export const EQUIPMENT_CATALOG_EXTRA = {
  section: { title: "Phân loại" },
  defaults: {
    teachingCode: "",
    parent: { id: null },
    equipmentType: { id: null },
    subject: { id: null },
    educationLevel: { id: null },
    grade: { id: null },
    unit: { id: null },
    trackingType: "serial",
    assetCategory: null,
    physicalOrDigital: null,
    statisticalCode: "",
    legalBasis: "",
    description: "",
    usedByTeacher: false,
    usedByStudent: false,
    selfMade: false,
    minimumRequired: false,
    educationLevels: [],
    subjects: [],
    grades: [],
  },
  Fields: CatalogTreeFields,
  // Danh mục của Sở và thiết bị NGOÀI danh mục do trường thêm nằm chung một bảng; lọc tách được.
  filters: [
    {
      field: "ownership",
      label: "Nguồn",
      type: "select" as const,
      options: [
        { value: "official", label: "Danh mục của Sở" },
        { value: "school", label: "Ngoài danh mục (trường thêm)" },
      ],
    },
    {
      field: "minimumRequired",
      label: "Danh mục tối thiểu",
      type: "select" as const,
      options: [
        { value: "true", label: "Thuộc danh mục tối thiểu" },
        { value: "false", label: "Không thuộc" },
      ],
    },
  ],
  columns: [
    {
      id: "ownership",
      header: "Nguồn",
      size: 200,
      enableSorting: false,
      cell: ({ row }) =>
        row.original.ownerSchool ? (
          <Badge variant="warning" title={CATALOG_ORIGIN_LABELS[row.original.origin] ?? undefined}>
            Ngoài DM · {row.original.ownerSchool.name}
          </Badge>
        ) : (
          <span className="text-muted-foreground text-xs">Danh mục Sở</span>
        ),
    },
    {
      id: "parent",
      header: "Thuộc nhóm",
      enableSorting: false,
      cell: ({ row }) => row.original.parent?.name ?? <span className="text-muted-foreground">Nhóm gốc</span>,
    },
    {
      id: "equipmentType",
      header: "Loại thiết bị",
      enableSorting: false,
      cell: ({ row }) => row.original.equipmentType?.name ?? <span className="text-muted-foreground">—</span>,
    },
    {
      id: "minimumRequired",
      header: "Tối thiểu",
      enableSorting: false,
      cell: ({ row }) => (row.original.minimumRequired ? <Badge variant="info">Tối thiểu</Badge> : <Badge variant="neutral">Ngoài thông tư</Badge>),
    },
  ] as ColumnDef<any, any>[],
  // Thiết bị của danh mục tối thiểu không xoá tay — máy chủ cũng từ chối.
  canDelete: (r: any) => !(r?.minimumRequired && !r?.ownerSchool),
  show: (r: any) => [
    { label: "Nguồn", value: r?.ownerSchool ? `Ngoài danh mục: thiết bị riêng của ${r.ownerSchool.name}` : "Danh mục của Sở" },
    ...(r?.ownerSchool ? [{ label: "Nguồn gốc", value: CATALOG_ORIGIN_LABELS[r?.origin] ?? "—" }] : []),
    { label: "Thuộc nhóm", value: r?.parent?.name ?? "Nhóm gốc" },
    { label: "Mã loại thiết bị chuẩn", value: r?.teachingCode ?? "—" },
    { label: "Loại thiết bị", value: r?.equipmentType?.name ?? "—" },
    { label: "Đơn vị tính", value: r?.unit?.name ?? "—" },
    { label: "Môn học", value: r?.subject?.name ?? "—" },
    { label: "Cấp học", value: r?.educationLevel?.name ?? "—" },
    { label: "Khối lớp", value: r?.grade?.name ?? "—" },
    { label: "Phân loại kế toán", value: ASSET_CATEGORY_LABELS[r?.assetCategory] ?? "—" },
    { label: "Dạng thiết bị", value: PHYSICAL_TYPE_LABELS[r?.physicalOrDigital] ?? "—" },
    { label: "Cách quản lý", value: TRACKING_TYPE_LABELS[r?.trackingType] ?? "—" },
    { label: "Mã thống kê", value: r?.statisticalCode ?? "—" },
    { label: "Thông tư / Quyết định", value: r?.legalBasis ?? "—" },
    { label: "Đối tượng sử dụng", value: [r?.usedByTeacher ? "Giáo viên" : null, r?.usedByStudent ? "Học sinh" : null].filter(Boolean).join(", ") || "—" },
    { label: "Thiết bị tự làm", value: r?.selfMade ? "Có" : "Không" },
    { label: "Thuộc danh mục tối thiểu", value: r?.minimumRequired ? "Có" : "Không" },
  ],
  // Xem, sửa, tạo cùng một bố cục (nhóm, thứ tự, lưới 4 cột) — xem `equipment-catalog-profile.tsx`.
  Detail: EquipmentCatalogDetail,
  FormBody: EquipmentCatalogFormBody,
};
