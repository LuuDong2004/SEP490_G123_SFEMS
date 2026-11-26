import { useCan, useSelect } from "@refinedev/core";
import type { ColumnDef } from "@tanstack/react-table";
import { useEffect, useMemo } from "react";
import { useFormContext, useWatch, type Control } from "react-hook-form";

import { useEducationLevels } from "@/shared/hooks/use-education-levels";

import type { CatalogExtra } from "@/shared/components/catalog/types";
import { SwitchRow } from "@/shared/components/form/switch-row";
import { maxLengthOf, textRules } from "@/shared/lib/field-rules";
import { Badge } from "@/shared/ui/badge";
import { Checkbox } from "@/shared/ui/checkbox";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/shared/ui/form";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Button } from "@/shared/ui/button";
import { Plus, X } from "lucide-react";
import {
  FACILITY_KIND_LABELS,
  FACILITY_LEVELS,
  levelsText,
  type FacilityKind,
} from "@/domains/facility/catalog";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Cấp áp dụng: mỗi cấp học của hệ thống một ô tích. Đủ ba cấp = mọi cấp (máy chủ lưu trống). Hệ thống chỉ có MỘT cấp
 * học thì ô này ẩn và luôn là cấp đó — mặc định "cả ba cấp" của bản ghi mới không còn đúng.
 */
function LevelsField({ control }: { control: Control<any> }) {
  const shown = useFacilityLevels();
  const single = shown.length === 1 ? shown[0].code : null;
  const { setValue } = useFormContext();
  const current = useWatch({ control, name: "levels" }) as string[] | undefined;
  useEffect(() => {
    if (single && !(current?.length === 1 && current[0] === single)) setValue("levels", [single], { shouldDirty: true });
  }, [single, current, setValue]);
  if (single) return null;
  return (
    <FormField
      control={control}
      name="levels"
      rules={{ validate: (v: string[] | undefined) => (v && v.length > 0) || "Vui lòng chọn ít nhất một cấp" }}
      render={({ field }) => {
        const value: string[] = field.value ?? [];
        const toggle = (code: string, on: boolean) =>
          field.onChange(FACILITY_LEVELS.map((l) => l.code).filter((c) => (c === code ? on : value.includes(c))));
        return (
          <FormItem>
            <FormLabel>Cấp áp dụng</FormLabel>
            <div className="flex min-h-9 flex-wrap items-center gap-x-5 gap-y-2">
              {shown.map((l) => (
                <Label key={l.code} className="flex items-center gap-2 text-sm font-normal">
                  <Checkbox checked={value.includes(l.code)} onCheckedChange={(on) => toggle(l.code, on === true)} />
                  {l.name}
                </Label>
              ))}
            </div>
            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
}

/** Các cấp của `FACILITY_LEVELS` có trong danh mục Cấp học (chưa đọc được danh mục thì đủ ba cấp). */
export function useFacilityLevels() {
  const { levels } = useEducationLevels();
  return useMemo(() => {
    const codes = new Set(levels.map((l) => l.code));
    const shown = FACILITY_LEVELS.filter((l) => codes.has(l.code));
    return shown.length ? shown : [...FACILITY_LEVELS];
  }, [levels]);
}

/** Khối CSVC — ghép khối của bản ghi vào danh sách để ô chọn không trống khi danh sách về sau. */
function GroupField({ control, current }: { control: Control<any>; current?: { id: number; name: string } | null }) {
  const mayRead = useCan({ resource: "facility_groups", action: "list" }).data?.can ?? false;
  const { options } = useSelect({
    resource: "facility_groups",
    optionLabel: "name",
    optionValue: "id",
    sorters: [{ field: "sortOrder", order: "asc" }],
    pagination: { pageSize: 100 },
    queryOptions: { enabled: mayRead },
  });
  const items = useMemo(() => {
    const list = (options ?? []).map((o: { label: string; value: unknown }) => ({ value: String(o.value), label: o.label }));
    if (!current?.id || list.some((o) => o.value === String(current.id))) return list;
    return [{ value: String(current.id), label: current.name }, ...list];
  }, [options, current?.id, current?.name]);
  return (
    <FormField
      control={control}
      name="group.id"
      rules={{ required: "Vui lòng chọn khối" }}
      render={({ field }) => (
        <FormItem>
          <FormLabel>Khối</FormLabel>
          <Select value={field.value ? String(field.value) : ""} onValueChange={(v) => field.onChange(Number(v))}>
            <FormControl>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Vui lòng chọn khối" />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {items.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function KindField({ control }: { control: Control<any> }) {
  return (
    <FormField
      control={control}
      name="kind"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Dạng</FormLabel>
          <Select value={field.value ?? "ROOM"} onValueChange={field.onChange}>
            <FormControl>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {(Object.keys(FACILITY_KIND_LABELS) as FacilityKind[]).map((k) => (
                <SelectItem key={k} value={k}>{FACILITY_KIND_LABELS[k]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export function SwitchField({ control, name, title, description }: { control: Control<any>; name: string; title: string; description: string }) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className="@md:col-span-2">
          <SwitchRow checked={field.value ?? false} onCheckedChange={field.onChange} title={title} description={description} />
        </FormItem>
      )}
    />
  );
}

type ParamSpec = { key?: string; label: string; unit?: string; type?: "number" | "text" };

/**
 * Thông số riêng của loại: mỗi dòng một ô sẽ hiện trên form phòng thuộc loại này — tên, đơn vị, kiểu số
 * hay chữ. Khoá do máy chủ sinh từ tên lần đầu và giữ nguyên khi đổi tên, nên phòng đã khai không mất giá trị.
 */
function ParamsField({ control }: { control: Control<any> }) {
  return (
    <FormField
      control={control}
      name="params"
      render={({ field }) => {
        const list: ParamSpec[] = field.value ?? [];
        const set = (i: number, patch: Partial<ParamSpec>) => field.onChange(list.map((p, j) => (j === i ? { ...p, ...patch } : p)));
        return (
          <FormItem className="@md:col-span-2">
            <FormLabel>Thông số theo loại</FormLabel>
            <div className="grid gap-2">
              {list.map((p, i) => (
                <div key={p.key ?? i} className="grid grid-cols-[minmax(0,1fr)_6rem_8rem_auto] items-center gap-2">
                  <Input value={p.label ?? ""} maxLength={100} placeholder="Tên thông số, vd Diện tích kho sách kín"
                    aria-label="Tên thông số" onChange={(e) => set(i, { label: e.target.value })} />
                  <Input value={p.unit ?? ""} maxLength={20} placeholder="Đơn vị" aria-label="Đơn vị"
                    onChange={(e) => set(i, { unit: e.target.value })} />
                  <Select value={p.type ?? "number"} onValueChange={(v) => set(i, { type: v as ParamSpec["type"] })}>
                    <SelectTrigger className="w-full" aria-label="Kiểu"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="number">Số</SelectItem>
                      <SelectItem value="text">Chữ</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button type="button" variant="ghost" size="icon-sm" aria-label="Bỏ thông số"
                    onClick={() => field.onChange(list.filter((_, j) => j !== i))}>
                    <X />
                  </Button>
                </div>
              ))}
              <div>
                <Button type="button" variant="outline" size="sm" disabled={list.length >= 20}
                  onClick={() => field.onChange([...list, { label: "", unit: "m²", type: "number" }])}>
                  <Plus />
                  Thêm thông số
                </Button>
              </div>
            </div>
            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
}

const levelsColumn: ColumnDef<any, any> = {
  id: "levels",
  header: "Cấp áp dụng",
  enableSorting: false,
  cell: ({ row }) => <span className="text-sm whitespace-nowrap">{levelsText(row.original.levels)}</span>,
};

export const FACILITY_GROUP_EXTRA: CatalogExtra = {
  section: { title: "Áp dụng" },
  defaults: { levels: FACILITY_LEVELS.map((l) => l.code) },
  Fields: ({ control }) => (
    <div className="form-flow">
      <LevelsField control={control} />
    </div>
  ),
  columns: [levelsColumn],
  show: (r) => [{ label: "Cấp áp dụng", value: levelsText(r?.levels) }],
};

export const ROOM_TYPE_EXTRA: CatalogExtra = {
  section: { title: "Phân loại" },
  defaults: {
    group: { id: null },
    kind: "ROOM",
    levels: FACILITY_LEVELS.map((l) => l.code),
    standard: true,
    legalBasis: "",
    functional: false,
    params: [],
  },
  Fields: ({ control, record }) => (
    <div className="form-flow">
      <GroupField control={control} current={record?.group} />
      <KindField control={control} />
      <LevelsField control={control} />
      <FormField
        control={control}
        name="legalBasis"
        rules={textRules("SHORT_TEXT", "Văn bản căn cứ", { max: 255 })}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Văn bản căn cứ</FormLabel>
            <FormControl>
              <Input {...field} value={field.value ?? ""} placeholder="TT 13/2020/TT-BGDĐT" maxLength={maxLengthOf("SHORT_TEXT", 255)} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <SwitchField control={control} name="standard" title="Thuộc danh mục chuẩn"
        description="Tắt với loại ngoài danh mục." />
      <SwitchField control={control} name="functional" title="Phòng bộ môn, phòng chức năng"
        description="Tính vào báo cáo sử dụng phòng." />
      <ParamsField control={control} />
    </div>
  ),
  columns: [
    {
      id: "group",
      header: "Khối",
      enableSorting: false,
      cell: ({ row }) => <span className="text-sm">{row.original.group?.name ?? <span className="text-muted-foreground">Chưa xếp khối</span>}</span>,
    },
    {
      id: "kind",
      header: "Dạng",
      enableSorting: false,
      cell: ({ row }) => <span className="text-sm whitespace-nowrap">{FACILITY_KIND_LABELS[row.original.kind as FacilityKind] ?? <span className="text-muted-foreground">Chưa khai</span>}</span>,
    },
    levelsColumn,
    {
      id: "standard",
      header: "Danh mục",
      enableSorting: false,
      cell: ({ row }) => row.original.schoolId
        ? <Badge variant="warning">Của trường</Badge>
        : row.original.standard ? <Badge variant="success">Chuẩn</Badge> : <Badge variant="neutral">Ngoài danh mục</Badge>,
    },
  ],
  show: (r) => [
    { label: "Khối", value: r?.group?.name ?? "—" },
    { label: "Dạng", value: FACILITY_KIND_LABELS[r?.kind as FacilityKind] ?? "—" },
    { label: "Cấp áp dụng", value: levelsText(r?.levels) },
    { label: "Văn bản căn cứ", value: r?.legalBasis ?? "—" },
    { label: "Danh mục", value: r?.schoolId ? "Ngoài danh mục, của trường" : r?.standard ? "Chuẩn" : "Ngoài danh mục" },
    { label: "Phòng bộ môn, chức năng", value: r?.functional ? "Có" : "Không" },
    {
      label: "Thông số theo loại",
      span: 4,
      value: (r?.params ?? []).length
        ? (r.params as ParamSpec[]).map((p) => (p.unit ? `${p.label} (${p.unit})` : p.label)).join("; ")
        : "Không",
    },
  ],
};
