import { lowerLabel } from "@/shared/lib/label";
import { useCan, useList, type CrudFilter } from "@refinedev/core";
import { ChevronDown } from "lucide-react";
import { useMemo } from "react";
import type { Control } from "react-hook-form";

import { FormHint } from "@/shared/components/form/help-hint";
import { cn } from "@/shared/lib/utils";
import { Checkbox } from "@/shared/ui/checkbox";
import { FormField, FormItem, FormLabel, FormMessage } from "@/shared/ui/form";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";

/* eslint-disable @typescript-eslint/no-explicit-any */

type Ref = { id: number; name: string };

/**
 * Ô chọn NHIỀU mục của một danh mục ngắn (cấp học, môn học, khối lớp), cao bằng một ô nhập thường: bấm mở
 * danh sách có ô tích, chọn bao nhiêu cũng được. Giá trị là mảng `[{ id }]` theo THỨ TỰ CHỌN — mục đầu là
 * cái CHÍNH (máy chủ ghi nó vào cột chính), nên trong danh sách nó mang nhãn "chính".
 *
 * <p>Khác `MultiRefPickerField` (một khung ô tích trải cả hàng): cái này dùng khi ô phải nằm gọn trong lưới
 * bốn cột của form.
 */
export function MultiRefSelectField({ control, name, resource, label, hint, filters, disabledHint, className }: {
  control: Control<any>;
  name: string;
  resource: string;
  label: string;
  /** Lời giải thích — dấu "?" cạnh nhãn. */
  hint?: string;
  filters?: CrudFilter[];
  /** Có giá trị = ô bị khoá, kèm câu nhắc này trong chú thích. */
  disabledHint?: string;
  className?: string;
}) {
  const mayRead = useCan({ resource, action: "list" }).data?.can ?? false;
  const { result } = useList<Ref>({
    resource,
    pagination: { pageSize: 200 },
    sorters: [{ field: "sortOrder", order: "asc" }],
    filters: [...(filters ?? []), { field: "active", operator: "eq", value: true }],
    queryOptions: { enabled: mayRead },
  });
  const options = useMemo(() => result?.data ?? [], [result]);

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => {
        const chosen: Ref[] = Array.isArray(field.value) ? field.value.filter((v: any) => v?.id != null) : [];
        const ids = chosen.map((c) => Number(c.id));
        // Mục đã chọn mà không còn trong danh sách (đã tắt, hoặc bị bộ lọc loại) vẫn phải hiện để bỏ chọn được.
        const rows = [...options, ...chosen.filter((c) => !options.some((o) => o.id === Number(c.id)))];
        const nameOf = (id: number) => rows.find((o) => Number(o.id) === id)?.name ?? "…";
        const toggle = (row: Ref) =>
          field.onChange(ids.includes(Number(row.id))
            ? chosen.filter((c) => Number(c.id) !== Number(row.id))
            : [...chosen, { id: row.id, name: row.name }]);
        return (
          <FormItem className={className}>
            <FormLabel>{label}</FormLabel>
            {hint ? <FormHint>{hint}</FormHint> : null}
            <Popover>
              <PopoverTrigger asChild disabled={!!disabledHint}>
                <button
                  type="button"
                  title={disabledHint ?? (ids.length ? ids.map(nameOf).join(", ") : undefined)}
                  className={cn(
                    "bg-field flex h-9 w-full min-w-0 items-center justify-between gap-2 rounded-full border px-3.5 text-sm",
                    "focus-visible:border-ring outline-none",
                    disabledHint && "cursor-not-allowed opacity-60",
                  )}
                >
                  <span className={cn("truncate", ids.length === 0 && "text-muted-foreground")}>
                    {ids.length === 0 ? `Vui lòng chọn ${lowerLabel(label)}` : ids.map(nameOf).join(", ")}
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    {ids.length > 1 ? <span className="bg-primary/10 text-primary rounded-full px-1.5 text-xs font-medium tabular-nums">{ids.length}</span> : null}
                    <ChevronDown className="text-muted-foreground size-4" />
                  </span>
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="max-h-72 w-(--radix-popover-trigger-width) min-w-56 overflow-y-auto p-1">
                {rows.length === 0 ? (
                  <p className="text-muted-foreground px-2 py-3 text-center text-sm">Không có mục nào.</p>
                ) : (
                  rows.map((row) => {
                    const at = ids.indexOf(Number(row.id));
                    return (
                      <label key={row.id} className="hover:bg-muted flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm">
                        <Checkbox checked={at >= 0} onCheckedChange={() => toggle(row)} />
                        <span className="min-w-0 flex-1 truncate">{row.name}</span>
                        {at === 0 && ids.length > 1 ? <span className="text-muted-foreground text-xs">chính</span> : null}
                      </label>
                    );
                  })
                )}
                {ids.length > 0 ? (
                  <button type="button" className="text-muted-foreground hover:bg-muted mt-1 w-full rounded-sm border-t px-2 py-1.5 text-start text-sm"
                    onClick={() => field.onChange([])}>
                    Bỏ chọn tất cả
                  </button>
                ) : null}
              </PopoverContent>
            </Popover>
            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
}
