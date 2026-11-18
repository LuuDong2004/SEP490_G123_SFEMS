import type { ColumnDef } from "@tanstack/react-table";
import { Plus, Trash2 } from "lucide-react";
import { useFieldArray, useWatch, type Control } from "react-hook-form";

import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { DateInput } from "@/shared/components/form/date-input";
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
import { MultiRefPickerField } from "@/shared/components/catalog/multi-ref-picker";
import { formatPlainDate } from "@/shared/lib/format";
import { dateRules, maxLengthOf, mergeRules, textError, textRules, type TextRule } from "@/shared/lib/field-rules";
import { DATA_TYPE_LABELS } from "@/domains/equipment-config/types";

/* eslint-disable @typescript-eslint/no-explicit-any */


function TextInput({
  control,
  name,
  label,
  placeholder,
  type = "text",
  rules,
  className,
  rule,
  max,
}: {
  control: Control<any>;
  name: string;
  label: string;
  placeholder?: string;
  type?: string;
  rules?: any;
  className?: string;
  /** Kiểu trường chuẩn — cùng `@Text` của DTO ở máy chủ; `max` khi cột ngắn hơn trần của kiểu. */
  rule?: TextRule;
  max?: number;
}) {
  return (
    <FormField
      control={control}
      name={name}
      rules={type === "date" ? mergeRules(dateRules("ANY", label), rules)
        : rule ? mergeRules(textRules(rule, label, { max }), rules) : rules}
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
                name={field.name}
                ref={field.ref}
                placeholder={placeholder}
                maxLength={rule ? maxLengthOf(rule, max) : undefined}
              />
            )}
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

/** Ô lựa chọn cho kiểu "Chọn từ danh sách": mỗi dòng một giá trị, lưu thành mảng. */
function OptionsInput({ control, index }: { control: Control<any>; index: number }) {
  const dataType = useWatch({ control, name: `attributes.${index}.dataType` });
  if (dataType !== "enum") return null;
  return (
    <FormField
      control={control}
      name={`attributes.${index}.options`}
      // `ConfigAttributeInput.options`: mỗi lựa chọn là SHORT_TEXT.
      rules={{
        validate: (v: unknown) => {
          for (const o of Array.isArray(v) ? v : []) {
            const e = textError("SHORT_TEXT", "Lựa chọn", o);
            if (e) return e;
          }
          return true;
        },
      }}
      render={({ field }) => (
        <FormItem className="mt-4">
          <FormLabel>Các lựa chọn (mỗi dòng một giá trị)</FormLabel>
          <FormControl>
            <Textarea
              rows={3}
              value={Array.isArray(field.value) ? field.value.join("\n") : ""}
              onChange={(e) => field.onChange(e.target.value.split("\n"))}
              onBlur={field.onBlur}
              placeholder={"LCD\nLED\nOLED"}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function AttributesField({ control }: { control: Control<any> }) {
  const { fields, append, remove } = useFieldArray({ control, name: "attributes", keyName: "_key" });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Thông số kỹ thuật</span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            append({
              id: null,
              code: "",
              name: "",
              dataType: "text",
              measureUnit: "",
              required: false,
              options: [],
            })
          }
        >
          <Plus />
          Thêm thông số
        </Button>
      </div>

      {fields.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border border-dashed px-4 py-6 text-center text-sm">
          Chưa có thông số nào.
        </p>
      ) : (
        fields.map((f, i) => (
          <div key={f._key} className="relative rounded-lg border border-border p-4">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Xoá thông số"
              className="text-muted-foreground hover:text-destructive absolute top-2 right-2"
              onClick={() => remove(i)}
            >
              <Trash2 />
            </Button>
            <div className="grid gap-4 pr-8 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1.2fr)_7rem_auto] sm:items-start">
              <TextInput
                control={control}
                name={`attributes.${i}.name`}
                label="Tên thông số"
                placeholder="Công suất"
                rule="NAME"
                rules={{ required: "Nhập tên" }}
              />
              <TextInput
                control={control}
                name={`attributes.${i}.code`}
                label="Mã"
                placeholder="cong_suat"
                rule="CODE"
                rules={{
                  required: "Nhập mã",
                  pattern: { value: /^[A-Za-z0-9_]+$/, message: "Chữ không dấu, số, _" },
                }}
              />
              <FormField
                control={control}
                name={`attributes.${i}.dataType`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Kiểu dữ liệu</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value ?? "text"}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(DATA_TYPE_LABELS).map(([v, l]) => (
                          <SelectItem key={v} value={v}>
                            {l}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
              <TextInput control={control} name={`attributes.${i}.measureUnit`} label="Đơn vị" placeholder="W" rule="SHORT_TEXT" max={32} />
              <FormField
                control={control}
                name={`attributes.${i}.required`}
                render={({ field }) => (
                  <FormItem className="items-center">
                    <FormLabel>Bắt buộc</FormLabel>
                    <FormControl>
                      <Switch className="mt-2" checked={field.value ?? false} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
            <OptionsInput control={control} index={i} />
          </div>
        ))
      )}
    </div>
  );
}

function ConfigFields({ control, record }: { control: Control<any>; record?: any }) {
  return (
    <>
      <FormField
        control={control}
        name="description"
        rules={textRules("NOTE", "Mô tả")}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Mô tả</FormLabel>
            <FormControl>
              <Textarea {...field} value={field.value ?? ""} rows={2} maxLength={maxLengthOf("NOTE")} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <MultiRefPickerField
        control={control}
        name="scopeTypes"
        resource="equipment_types"
        label="Áp dụng cho loại thiết bị"
        unitLabel="loại"
        emptyHint="Để trống thì dùng cho mọi loại thiết bị."
      />
      <FormField
        control={control}
        name="defaultConfig"
        render={({ field }) => (
          <FormItem className="flex flex-row items-center justify-between gap-6 rounded-lg border border-border px-4 py-2.5 sm:max-w-xs">
            <FormLabel>Bộ mặc định</FormLabel>
            <FormControl>
              <Switch checked={field.value ?? false} onCheckedChange={field.onChange} />
            </FormControl>
          </FormItem>
        )}
      />
      <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_10rem]">
        <TextInput control={control} name="documentNo" label="Số hiệu văn bản" placeholder="37/2021/TT-BGDĐT" rule="SHORT_TEXT" max={100} />
        <TextInput control={control} name="documentName" label="Trích yếu" rule="SHORT_TEXT" />
        <TextInput control={control} name="issueDate" label="Ngày ban hành" type="date" />
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
      <AttributesField control={control} />
    </>
  );
}

export const CONFIG_EXTRA = {
  section: { title: "Thông số" },
  defaults: {
    description: "",
    defaultConfig: false,
    scopeTypes: [],
    documentNo: "",
    documentName: "",
    issueDate: null,
    startSchoolYear: { id: null },
    endSchoolYear: { id: null },
    attributes: [],
  },
  Fields: ConfigFields,
  columns: [
    {
      id: "scopeTypes",
      header: "Loại thiết bị",
      enableSorting: false,
      cell: ({ row }) => {
        const types: any[] = row.original.scopeTypes ?? [];
        return types.length === 0 ? (
          <span className="text-muted-foreground">Mọi loại</span>
        ) : (
          types.map((t) => t.name).join(", ")
        );
      },
    },
    {
      id: "attributes",
      header: "Số thông số",
      enableSorting: false,
      cell: ({ row }) => <span className="tabular-nums">{(row.original.attributes ?? []).length}</span>,
    },
    {
      id: "defaultConfig",
      header: "Mặc định",
      enableSorting: false,
      cell: ({ row }) => (row.original.defaultConfig ? <Badge variant="info">Mặc định</Badge> : null),
    },
  ] as ColumnDef<any, any>[],
  show: (r: any) => [
    { label: "Mô tả", value: r?.description ?? "—" },
    {
      label: "Loại thiết bị áp dụng",
      value: (r?.scopeTypes ?? []).length === 0 ? "Mọi loại" : r.scopeTypes.map((t: any) => t.name).join(", "),
    },
    { label: "Bộ mặc định", value: r?.defaultConfig ? "Có" : "Không" },
    { label: "Văn bản", value: r?.documentNo ? `${r.documentNo}${r.documentName ? ` — ${r.documentName}` : ""}` : "—" },
    { label: "Ngày ban hành", value: formatPlainDate(r?.issueDate) },
    {
      label: "Năm học áp dụng",
      value:
        !r?.startSchoolYear && !r?.endSchoolYear
          ? "Không giới hạn"
          : `${r?.startSchoolYear?.name ?? "…"} → ${r?.endSchoolYear?.name ?? "nay"}`,
    },
    {
      label: "Thông số kỹ thuật",
      value:
        (r?.attributes ?? []).length === 0 ? (
          "—"
        ) : (
          <ul className="space-y-1">
            {(r.attributes as any[]).map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-2">
                <span>{a.name}</span>
                <Badge variant="neutral">{DATA_TYPE_LABELS[a.dataType] ?? a.dataType}</Badge>
                {a.measureUnit ? <span className="text-muted-foreground font-normal">({a.measureUnit})</span> : null}
                {a.required ? <span className="text-destructive text-xs font-normal">bắt buộc</span> : null}
                {a.dataType === "enum" && a.options?.length ? (
                  <span className="text-muted-foreground text-xs font-normal">{a.options.join(" · ")}</span>
                ) : null}
              </li>
            ))}
          </ul>
        ),
    },
  ],
};
