import type { ColumnDef } from "@tanstack/react-table";
import type { Control } from "react-hook-form";

import { Badge } from "@/shared/ui/badge";
import { SwitchRow } from "@/shared/components/form/switch-row";
import { formatPlainDate, todayLocal } from "@/shared/lib/format";
import { Input } from "@/shared/ui/input";
import { DateInput } from "@/shared/components/form/date-input";
import { FormHint } from "@/shared/components/form/help-hint";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/shared/ui/form";
import { dateRules, maxLengthOf, mergeRules, textRules, type TextRule } from "@/shared/lib/field-rules";
import { CODE_RULE_EXTRA } from "@/features/catalogs/code-rule-extra";
import { NORM_EXTRA } from "@/features/catalogs/norm-extra";
import { LEGAL_DOCUMENT_EXTRA } from "@/features/catalogs/legal-document-extra";
import { EQUIPMENT_CATALOG_EXTRA } from "@/features/catalogs/equipment-catalog-extra";
import { CONFIG_EXTRA } from "@/features/catalogs/config-extra";
import { STANDARD_EXTRA } from "@/features/catalogs/standard-extra";
import { EducationLevelField } from "@/features/catalogs/education-level-field";
import { FACILITY_GROUP_EXTRA, ROOM_TYPE_EXTRA } from "@/features/catalogs/facility-catalog-extra";
import { FACILITY_STANDARD_EXTRA } from "@/features/catalogs/facility-standard-extra";
import { SubjectLevelsField, SubjectPickerField } from "@/features/catalogs/relations";
import { SUBJECT_TYPE_LABELS } from "@/domains/subject/types";

/* eslint-disable @typescript-eslint/no-explicit-any */

export type { CatalogExtra } from "@/shared/components/catalog/types";
import type { CatalogExtra } from "@/shared/components/catalog/types";

function TextField({
  control,
  name,
  label,
  hint,
  max,
  placeholder,
  description,
  rules,
  rule = "SHORT_TEXT",
}: {
  control: Control<any>;
  name: string;
  label: string;
  /** Lời giải thích — dấu "?" cạnh nhãn. */
  hint?: string;
  max: number;
  /** Kiểu trường chuẩn — cùng `@Text` của DTO ở máy chủ. */
  rule?: TextRule;
  placeholder?: string;
  description?: string;
  /** Luật thêm (bắt buộc, pattern…) — gộp với kiểm độ dài `max`. */
  rules?: object;
}) {
  return (
    <FormField
      control={control}
      name={name}
      rules={mergeRules(textRules(rule, label, { max }), rules)}
      render={({ field }) => (
        <FormItem>
          <FormLabel>
            {label}
          </FormLabel>
          {hint ? <FormHint>{hint}</FormHint> : null}
          <FormControl>
            <Input {...field} value={field.value ?? ""} placeholder={placeholder} maxLength={maxLengthOf(rule, max)} />
          </FormControl>
          {description ? <FormHint>{description}</FormHint> : null}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

const levelColumn: ColumnDef<any, any> = {
  id: "educationLevel",
  header: "Cấp học",
  // Không sắp xếp được: API sắp theo thuộc tính của chính danh mục, không theo
  // tên của bảng liên kết.
  enableSorting: false,
  cell: ({ row }) => {
    const level = row.original.educationLevel;
    return level ? (
      <Badge variant="neutral">{level.name}</Badge>
    ) : (
      <span className="text-muted-foreground">—</span>
    );
  },
};

const levelShow = (record: any) => ({
  label: "Cấp học",
  value: record?.educationLevel?.name ?? "—",
});


function DateField({
  control,
  name,
  label,
  hint,
  validate,
}: {
  control: Control<any>;
  name: string;
  label: string;
  /** Lời giải thích — dấu "?" cạnh nhãn. */
  hint?: string;
  /** Kiểm thêm (vd. so với ô ngày khác). */
  validate?: (value: any, values: any) => true | string;
}) {
  return (
    <FormField
      control={control}
      name={name}
      rules={mergeRules(dateRules("ANY", label, { required: true }), validate ? { validate } : undefined)}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          {hint ? <FormHint>{hint}</FormHint> : null}
          <FormControl>
            {/* Ô rỗng gửi null chứ không phải "": backend nhận LocalDate. */}
            <DateInput value={field.value} onChange={field.onChange} onBlur={field.onBlur} name={field.name} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}


/** Một dòng `educationLevels` trên payload môn học (theo `SubjectResponse.Level`). */
type SubjectLevelRow = {
  educationLevel: { id: number; code: string; name: string };
  subjectType: string;
  sortOrder: number | null;
};

export const CATALOG_EXTRAS: Record<string, CatalogExtra> = {
  legal_documents: LEGAL_DOCUMENT_EXTRA,
  code_rules: CODE_RULE_EXTRA,
  equipment_standards: STANDARD_EXTRA,
  equipment_norms: NORM_EXTRA,
  equipment_catalogs: EQUIPMENT_CATALOG_EXTRA,
  equipment_configs: CONFIG_EXTRA,

  subjects: {
    section: { title: "Giảng dạy" },
    defaults: { teachingCode: "", educationLevels: [] },
    Fields: ({ control, record }) => (
      <div className="form-flow">
        <TextField
          control={control}
          name="teachingCode"
          label="Mã môn dạy học"
          rule="CODE"
          rules={{
            required: "Vui lòng nhập mã môn dạy học",
            pattern: { value: /^\d{2}$/, message: "Mã môn dạy học gồm đúng hai chữ số" },
          }}
          max={32}
          placeholder="22"
          description="Hai chữ số theo chương trình dạy học — đi vào mã thiết bị in trên tem và làm mã danh mục của môn."
        />
        <div className="@md:col-span-2 @3xl:col-span-3">
          <SubjectLevelsField control={control} creating={!record} />
        </div>
      </div>
    ),
    columns: [
      {
        id: "educationLevels",
        header: "Cấp học giảng dạy",
        enableSorting: false,
        cell: ({ row }) => {
          const levels: SubjectLevelRow[] = row.original.educationLevels ?? [];
          if (levels.length === 0) return <span className="text-muted-foreground">—</span>;
          return (
            <div className="flex flex-wrap gap-1">
              {levels.map((l) => (
                <Badge key={l.educationLevel.id} variant="neutral">
                  {l.educationLevel.code} · {SUBJECT_TYPE_LABELS[l.subjectType] ?? l.subjectType}
                </Badge>
              ))}
            </div>
          );
        },
      },
    ],
    // Cột MÃ trên màn xem đã là mã môn dạy học (code = teaching_code) nên không
    // lặp lại — chỉ còn thông tin cấp học giảng dạy.
    show: (r) => [
      {
        label: "Cấp học giảng dạy",
        span: 3,
        value:
          (r?.educationLevels ?? []).length === 0
            ? "—"
            : (r.educationLevels as SubjectLevelRow[])
                .map(
                  (l) =>
                    `${l.educationLevel.name} (${SUBJECT_TYPE_LABELS[l.subjectType] ?? l.subjectType})`,
                )
                .join(", "),
      },
    ],
  },
  subject_groups: {
    section: { title: "Thành phần tổ" },
    defaults: { educationLevel: { id: null }, subjects: [] },
    Fields: ({ control, record }) => (
      <div className="form-flow">
        <EducationLevelField control={control} current={record?.educationLevel} />
        <div className="@md:col-span-2 @3xl:col-span-3">
          <SubjectPickerField control={control} />
        </div>
      </div>
    ),
    columns: [
      levelColumn,
      {
        id: "subjects",
        header: "Số môn",
        enableSorting: false,
        cell: ({ row }) => (
          <span className="tabular-nums">{(row.original.subjects ?? []).length}</span>
        ),
      },
    ],
    show: (r) => [
      levelShow(r),
      {
        label: "Môn học thuộc tổ",
        span: 3,
        value:
          (r?.subjects ?? []).length === 0
            ? "Chưa gán môn nào"
            : (r.subjects as any[]).map((s) => s.name).join(", "),
      },
    ],
  },
  school_years: {
    // Năm học chỉ cần cờ Hiện hành: cờ Đang hoạt động không có nghĩa với năm học.
    hideActive: true,
    section: { title: "Thời gian" },
    defaults: { startDate: null, endDate: null, current: false },
    Fields: ({ control, record }) => (
      <div className="form-flow">
        <DateField control={control} name="startDate" label="Ngày bắt đầu" />
        <DateField control={control} name="endDate" label="Ngày kết thúc"
          // `@DateRange` của `SchoolYearRequest`.
          validate={(v, values) => !v || !values?.startDate || String(v) >= String(values.startDate)
            || "Ngày kết thúc không được trước ngày bắt đầu"} />
        <FormField
          control={control}
          name="current"
          // Cùng quy tắc `SchoolYearService.requireNotEnded`: năm đã kết thúc không làm hiện hành được.
          rules={{
            deps: ["endDate"],
            validate: (v, values) => {
              const end = values?.endDate ? String(values.endDate) : null;
              const unchanged = record?.current === true && end === record?.endDate;
              return !v || !end || unchanged || end >= todayLocal() || "Năm học đã kết thúc, không chọn làm năm hiện hành được";
            },
          }}
          render={({ field }) => (
            <FormItem className="@md:col-span-2">
              <SwitchRow checked={field.value ?? false} onCheckedChange={field.onChange} title="Năm học hiện hành" />
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    ),
    columns: [
      {
        id: "startDate",
        accessorKey: "startDate",
        header: "Bắt đầu",
        enableSorting: false,
        cell: ({ getValue }) => formatPlainDate(getValue() as string),
      },
      {
        id: "endDate",
        accessorKey: "endDate",
        header: "Kết thúc",
        enableSorting: false,
        cell: ({ getValue }) => formatPlainDate(getValue() as string),
      },
      {
        id: "current",
        accessorKey: "current",
        header: "Hiện hành",
        enableSorting: false,
        cell: ({ getValue }) =>
          getValue() ? <Badge variant="success">Hiện hành</Badge> : null,
      },
    ],
    show: (r) => [
      { label: "Ngày bắt đầu", value: formatPlainDate(r?.startDate) },
      { label: "Ngày kết thúc", value: formatPlainDate(r?.endDate) },
      {
        label: "Hiện hành",
        value: r?.current ? <Badge variant="success">Hiện hành</Badge> : "Không",
      },
    ],
  },
  grades: {
    section: { title: "Phân loại" },
    defaults: { teachingCode: "", educationLevel: { id: null } },
    Fields: ({ control, record }) => (
      <div className="form-flow">
        <EducationLevelField control={control} current={record?.educationLevel} />
        <TextField
          control={control}
          name="teachingCode"
          label="Mã khối dạy học"
          rule="CODE"
          max={32}
          placeholder="10"
          description="Theo chương trình dạy học, khác mã danh mục."
        />
      </div>
    ),
    columns: [
      levelColumn,
      {
        id: "teachingCode",
        accessorKey: "teachingCode",
        header: "Mã khối",
        enableSorting: false,
        cell: ({ getValue }) => (
          <span className="font-mono text-xs">{(getValue() as string) ?? "—"}</span>
        ),
      },
    ],
    show: (r) => [levelShow(r), { label: "Mã khối dạy học", value: r?.teachingCode ?? "—" }],
  },
  units: {
    section: { title: "Cách đếm" },
    defaults: { allowsFraction: false },
    // Số lẻ chỉ có nghĩa với đơn vị chia được (kg, g, lít, ml, mét) — 0,25 kg hoá chất thì có,
    // 0,5 cái máy tính thì không. Máy chủ từ chối số lẻ khi cờ này tắt.
    Fields: ({ control }) => (
      <div className="form-flow">
        <FormField
          control={control}
          name="allowsFraction"
          render={({ field }) => (
            <FormItem className="@md:col-span-2">
              <SwitchRow checked={field.value ?? false} onCheckedChange={field.onChange} title="Cho phép số lẻ"
                description="Bật cho kg, g, lít, ml, mét. Cái, chiếc, bộ, bình… để tắt." />
            </FormItem>
          )}
        />
      </div>
    ),
    columns: [
      {
        id: "allowsFraction",
        header: "Số lẻ",
        enableSorting: false,
        cell: ({ row }) => (row.original.allowsFraction ? <Badge variant="success">Cho phép</Badge> : <span className="text-muted-foreground">—</span>),
      },
    ] as ColumnDef<any, any>[],
    show: (r) => [{ label: "Cho phép số lẻ", span: 2, value: r?.allowsFraction ? "Có, đơn vị chia được" : "Không" }],
  },
  room_types: ROOM_TYPE_EXTRA,
  facility_groups: FACILITY_GROUP_EXTRA,
  facility_standard_rules: FACILITY_STANDARD_EXTRA,
};
