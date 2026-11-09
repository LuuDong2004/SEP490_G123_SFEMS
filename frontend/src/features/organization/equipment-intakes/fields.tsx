import { useList } from "@refinedev/core";
import type { Control } from "react-hook-form";

import { AsyncCombobox } from "@/shared/components/form/async-combobox";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/shared/ui/form";
import { Input } from "@/shared/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Giá trị một ô tham chiếu trên form: `{ id, name }`; gửi lên chỉ `{ id }`. */
export type RefValue = { id: number | null; name?: string | null; code?: string | null };

export const NO_REF: RefValue = { id: null };

/** Ô chọn một bản ghi danh mục, tìm ở máy chủ. */
export function RefField({ control, name, label, resource, placeholder, className, clearable = true }: {
  control: Control<any>;
  name: string;
  label: string;
  resource: string;
  placeholder?: string;
  className?: string;
  clearable?: boolean;
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <AsyncCombobox<{ id: number; code?: string | null; name: string }>
              resource={resource}
              value={field.value?.id ?? null}
              fallbackLabel={field.value?.name}
              clearable={clearable}
              onChange={(id) => field.onChange(id == null ? NO_REF : { ...field.value, id })}
              onPick={(item) => field.onChange({ id: item.id, name: item.name, code: item.code ?? null })}
              labelOf={(item) => (item.code ? `${item.code} · ${item.name}` : item.name)}
              placeholder={placeholder ?? `Chọn ${label.toLowerCase()}`}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

type Reason = { id: number; code: string; name: string; direction: "increase" | "decrease"; active: boolean };

/** Các lý do TĂNG đang dùng — danh mục lý do biến động chỉ có vài dòng, tải một lần. */
export function useIncreaseReasons() {
  const { result } = useList<Reason>({
    resource: "movement_reasons",
    pagination: { pageSize: 100 },
    sorters: [{ field: "sortOrder", order: "asc" }],
  });
  return (result?.data ?? []).filter((r) => r.direction === "increase" && r.active !== false);
}

/** Lý do tăng của một dòng (bắt buộc khi trình). */
export function ReasonField({ control, name, className }: { control: Control<any>; name: string; className?: string }) {
  const reasons = useIncreaseReasons();
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          <FormLabel>Lý do tăng</FormLabel>
          <Select
            value={field.value?.id ? String(field.value.id) : ""}
            onValueChange={(v) => {
              if (v === "") return;
              const r = reasons.find((x) => String(x.id) === v);
              field.onChange(r ? { id: r.id, name: r.name, code: r.code } : NO_REF);
            }}
          >
            <FormControl>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={field.value?.name ?? "Chọn lý do tăng"} />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {reasons.map((r) => (
                <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

/** Ô số nguyên có nhãn — số lượng hoá đơn, số thực nhận, bảo hành. */
export function IntField({ control, name, label, min, max, className }: {
  control: Control<any>;
  name: string;
  label: string;
  min?: number;
  max?: number;
  className?: string;
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input type="number" inputMode="numeric" min={min} max={max} step={1} className="text-right tabular-nums"
              value={field.value ?? ""}
              onChange={(e) => field.onChange(e.target.value === "" ? "" : Number(e.target.value))}
              onBlur={field.onBlur} name={field.name} ref={field.ref} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
