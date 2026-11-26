import type { ColumnDef } from "@tanstack/react-table";
import { Plus, Trash2 } from "lucide-react";
import { useFieldArray, type Control } from "react-hook-form";

import { Badge } from "@/shared/ui/badge";
import { Card } from "@/shared/ui/card";
import { cn } from "@/shared/lib/utils";
import { TextareaField } from "@/shared/components/form/simple-fields";
import { dateRules, inputModeOf, maxLengthOf, mergeRules, textRules, type TextRule } from "@/shared/lib/field-rules";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { DateInput } from "@/shared/components/form/date-input";
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
import { formatPlainDate } from "@/shared/lib/format";
import { RefField } from "@/shared/components/catalog/ref-field";
import { DOCUMENT_ROLE_LABELS } from "@/domains/equipment-standard/types";
import { MinimumCatalog } from "./minimum-catalog";

/* eslint-disable @typescript-eslint/no-explicit-any */



function TextInput({
  control,
  name,
  label,
  placeholder,
  required,
  type = "text",
  className,
  rule,
  max,
  readOnly,
}: {
  control: Control<any>;
  name: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  type?: string;
  className?: string;
  /** Kiểu trường chuẩn — cùng `@Text` của DTO ở máy chủ; `max` khi cột ngắn hơn trần của kiểu. */
  rule?: TextRule;
  max?: number;
  /** Mã của bộ đã lưu: khoá, máy chủ cũng từ chối đổi mã. */
  readOnly?: boolean;
}) {
  const own = required ? { required: `Nhập ${label.toLowerCase()}` } : undefined;
  return (
    <FormField
      control={control}
      name={name}
      rules={type === "date" ? mergeRules(dateRules("ANY", label), own) : rule ? mergeRules(textRules(rule, label, { max }), own) : own}
      render={({ field }) => (
        <FormItem className={className}>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            {type === "date" ? (
              <DateInput value={field.value} onChange={field.onChange} onBlur={field.onBlur} name={field.name} />
            ) : (
              <Input
                type={type}
                value={field.value ?? ""}
                onChange={(e) => field.onChange(e.target.value)}
                onBlur={field.onBlur}
                readOnly={readOnly}
                className={readOnly ? "bg-muted/60 text-muted-foreground" : undefined}
                name={field.name}
                ref={field.ref}
                placeholder={placeholder}
                maxLength={rule ? maxLengthOf(rule, max) : undefined}
                inputMode={inputModeOf(rule)}
              />
            )}
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

/**
 * Danh sách văn bản căn cứ, thêm / xoá tại chỗ. `id` đi theo dòng để backend sửa đúng văn bản cũ. Mỗi văn
 * bản là một khối gọn ngăn bằng đường kẻ (không lồng khung trong khung): vai trò, số hiệu, ngày ban hành,
 * ngày hiệu lực; rồi trích yếu, cơ quan ban hành, đường dẫn. `framed`: đầu khối là tiêu đề thẻ.
 */
function DocumentsField({ control, framed }: { control: Control<any>; framed?: boolean }) {
  const { fields, append, remove } = useFieldArray({ control, name: "documents", keyName: "_key" });
  const add = () =>
    append({
      id: null,
      documentRole: fields.length === 0 ? "main" : "amendment",
      documentNo: "",
      documentName: "",
      issuingAuthority: "Bộ Giáo dục và Đào tạo",
      issueDate: null,
      effectiveDate: null,
      url: "",
    });

  return (
    <div className="@container">
      <div className={cn("flex items-center justify-between gap-2", framed ? "border-b px-5 py-3" : "mb-3")}>
        <h3 className={cn(framed ? "text-base font-semibold" : "text-sm font-semibold")}>
          Văn bản căn cứ <span className="text-muted-foreground ms-1 text-xs font-normal">{fields.length} văn bản</span>
        </h3>
        <Button type="button" variant="outline" size="sm" onClick={add}>
          <Plus />
          Thêm văn bản
        </Button>
      </div>

      {fields.length === 0 ? (
        <p className={cn("text-muted-foreground py-8 text-center text-sm", framed ? "" : "rounded-lg border border-dashed")}>
          Chưa có văn bản nào. Thêm thông tư ban hành, rồi các thông tư sửa đổi.
        </p>
      ) : (
        <div className="divide-y">
          {fields.map((f, i) => (
            <div key={f._key} className={cn("relative py-4", framed ? "px-5" : "")}>
              <div className="mb-3 flex items-center gap-2">
                <span className="bg-muted text-muted-foreground flex size-6 items-center justify-center rounded-full text-xs font-semibold tabular-nums">{i + 1}</span>
                <span className="text-muted-foreground text-xs">Văn bản {i + 1}</span>
                <Button type="button" variant="ghost" size="icon-sm" aria-label="Xoá văn bản" title="Xoá văn bản"
                  className="text-muted-foreground hover:text-destructive ms-auto" onClick={() => remove(i)}>
                  <Trash2 />
                </Button>
              </div>
              <div className="grid items-start gap-x-4 gap-y-4 @md:grid-cols-2 @2xl:grid-cols-4">
                <FormField
                  control={control}
                  name={`documents.${i}.documentRole`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vai trò</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value ?? "main"}>
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.entries(DOCUMENT_ROLE_LABELS).map(([v, l]) => (
                            <SelectItem key={v} value={v}>{l}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
                <TextInput control={control} name={`documents.${i}.documentNo`} label="Số hiệu" placeholder="37/2021/TT-BGDĐT" required rule="SHORT_TEXT" max={100} />
                <TextInput control={control} name={`documents.${i}.issueDate`} label="Ngày ban hành" type="date" />
                <TextInput control={control} name={`documents.${i}.effectiveDate`} label="Ngày hiệu lực" type="date" />
                {/* Trích yếu dài (tên thông tư) — một hàng riêng để đọc hết, không bị cắt. */}
                <TextInput control={control} name={`documents.${i}.documentName`} label="Trích yếu" className="col-span-full" rule="NOTE" />
                <TextInput control={control} name={`documents.${i}.issuingAuthority`} label="Cơ quan ban hành" placeholder="Bộ Giáo dục và Đào tạo" rule="NAME" className="@2xl:col-span-2" />
                <TextInput control={control} name={`documents.${i}.url`} label="Đường dẫn văn bản" placeholder="https://" rule="URL" max={1000} className="@2xl:col-span-2" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


/**
 * Form Thêm / Sửa BỘ TIÊU CHUẨN, hai cột lấp kín bề ngang: trái là thông tin của bộ (mã, tên, trạng thái,
 * cấp học, phiên bản, năm học áp dụng, bộ được thay thế, ghi chú), phải là VĂN BẢN CĂN CỨ — phần dài nhất,
 * mỗi văn bản một khối gọn không lồng khung. Khuôn chung (một cột hẹp tối đa 5xl) để trống nửa màn bên phải.
 */
function StandardFormBody({ control, record, inDialog }: { control: Control<any>; record?: any; inDialog?: boolean }) {
  const info = (
    <div className="@container space-y-4">
      {/* Không có công tắc "Đang hoạt động": trạng thái của bộ chỉ đổi qua Lập bộ mới → Áp dụng. */}
      <div className="grid items-start gap-x-4 gap-y-5 @md:grid-cols-2">
        <TextInput control={control} name="code" label="Mã" placeholder="STD-TH" required rule="CODE" className="max-w-[12rem]" readOnly={!!record?.id} />
        <RefField control={control} name="educationLevel" resource="education_levels" label="Cấp học" current={record?.educationLevel} />
        <TextInput control={control} name="name" label="Tên bộ" required className="@md:col-span-2" rule="NAME" />
        <TextInput control={control} name="standardVersion" label="Phiên bản" placeholder="TT 37/2021 + 26/2023" rule="SHORT_TEXT" max={50} />
        <RefField control={control} name="previousStandard" resource="equipment_standards" label="Thay thế bộ" current={record?.previousStandard} />
        <RefField control={control} name="startSchoolYear" resource="school_years" label="Năm học bắt đầu" current={record?.startSchoolYear} />
        <RefField control={control} name="endSchoolYear" resource="school_years" label="Năm học kết thúc" current={record?.endSchoolYear} />
        <TextareaField control={control} name="note" label="Ghi chú" className="@md:col-span-2" rule="NOTE" />
      </div>
    </div>
  );
  if (inDialog) {
    // Hộp rộng: hai cột như trang sửa, ngăn bằng đường kẻ thay cho hai thẻ (hộp thoại đã là khung).
    return (
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:divide-x">
        <section className="lg:pe-6">
          <h3 className="mb-3 flex h-8 items-center text-sm font-semibold">Thông tin bộ</h3>
          {info}
        </section>
        <DocumentsField control={control} />
      </div>
    );
  }
  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <Card className="gap-0 py-0">
        <div className="border-b px-5 py-3">
          <h3 className="text-base font-semibold">Thông tin bộ</h3>
        </div>
        <div className="px-5 py-4">{info}</div>
      </Card>
      <Card className="gap-0 py-0">
        <DocumentsField control={control} framed />
      </Card>
    </div>
  );
}

function StandardFields({ control, record }: { control: Control<any>; record?: any }) {
  return (
    <>
      <div className="form-flow">
        <RefField
          control={control}
          name="educationLevel"
          resource="education_levels"
          label="Cấp học"
          current={record?.educationLevel}
        />
        <TextInput control={control} name="standardVersion" label="Phiên bản" placeholder="TT 37/2021" />
      </div>
      <div className="form-flow">
        <RefField
          control={control}
          name="startSchoolYear"
          resource="school_years"
          label="Năm học bắt đầu"
          current={record?.startSchoolYear}
        />
        <RefField
          control={control}
          name="endSchoolYear"
          resource="school_years"
          label="Năm học kết thúc"
          current={record?.endSchoolYear}
        />
      </div>
      <RefField
        control={control}
        name="previousStandard"
        resource="equipment_standards"
        label="Thay thế bộ"
        current={record?.previousStandard}
        className="sm:max-w-md"
      />
      <DocumentsField control={control} />
    </>
  );
}

const refCell = (key: string): ColumnDef<any, any> => ({
  id: key,
  enableSorting: false,
  cell: ({ row }) => row.original[key]?.name ?? <span className="text-muted-foreground">Mọi cấp học</span>,
});

export const STANDARD_EXTRA = {
  section: { title: "Phạm vi áp dụng" },
  // Màn danh sách là Danh mục thiết bị dạy học tối thiểu: chọn cấp học, xem / sửa thiết bị của bộ.
  ListPage: MinimumCatalog,
  saveInHeader: true,
  defaults: {
    educationLevel: { id: null },
    startSchoolYear: { id: null },
    endSchoolYear: { id: null },
    previousStandard: { id: null },
    standardVersion: "",
    documents: [],
  },
  Fields: StandardFields,
  FormBody: StandardFormBody,
  columns: [
    { ...refCell("educationLevel"), header: "Cấp học" },
    {
      id: "standardVersion",
      accessorKey: "standardVersion",
      header: "Phiên bản",
      enableSorting: false,
      cell: ({ getValue }) => (getValue() as string) ?? <span className="text-muted-foreground">Chưa khai</span>,
    },
    {
      id: "years",
      header: "Năm học áp dụng",
      enableSorting: false,
      cell: ({ row }) => {
        const s = row.original.startSchoolYear?.name;
        const e = row.original.endSchoolYear?.name;
        if (!s && !e) return <span className="text-muted-foreground">Không giới hạn</span>;
        return `${s ?? "…"} → ${e ?? "nay"}`;
      },
    },
  ] as ColumnDef<any, any>[],
  show: (r: any) => [
    { label: "Cấp học", value: r?.educationLevel?.name ?? "Mọi cấp học" },
    { label: "Phiên bản", value: r?.standardVersion ?? "—" },
    { label: "Năm học bắt đầu", value: r?.startSchoolYear?.name ?? "Không giới hạn" },
    { label: "Năm học kết thúc", value: r?.endSchoolYear?.name ?? "Còn áp dụng" },
    { label: "Thay thế bộ", value: r?.previousStandard?.name ?? "—" },
    {
      label: "Văn bản căn cứ",
      value:
        (r?.documents ?? []).length === 0 ? (
          "—"
        ) : (
          <ul className="space-y-1.5">
            {(r.documents as any[]).map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-2">
                <Badge variant="neutral">{DOCUMENT_ROLE_LABELS[d.documentRole] ?? d.documentRole}</Badge>
                {d.url ? (
                  <a href={d.url} target="_blank" rel="noreferrer" className="text-primary underline-offset-2 hover:underline">
                    {d.documentNo}
                  </a>
                ) : (
                  <span>{d.documentNo}</span>
                )}
                {d.documentName ? <span className="text-muted-foreground font-normal">{d.documentName}</span> : null}
                {d.issueDate ? (
                  <span className="text-muted-foreground font-normal">· {formatPlainDate(d.issueDate)}</span>
                ) : null}
              </li>
            ))}
          </ul>
        ),
    },
  ],
};
