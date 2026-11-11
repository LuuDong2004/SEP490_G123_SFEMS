import { useCan, useList } from "@refinedev/core";
import type { Control } from "react-hook-form";

import { Checkbox } from "@/shared/ui/checkbox";
import { FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/shared/ui/form";
import { Skeleton } from "@/shared/ui/skeleton";
import type { CatalogFormValues } from "@/features/catalogs/catalog-config";

type Ref = { id: number; code?: string; name?: string };

/**
 * Hợp danh sách tải về với những mục ĐANG được chọn trong form: danh sách có thể chưa về, hoặc không
 * về vì người sửa không có quyền đọc nó — khi đó mục đang chọn sẽ biến khỏi màn hình và bấm Lưu là
 * gửi đi một danh sách thiếu nó.
 */
function union(fetched: Ref[], selected: Ref[]): Ref[] {
  const seen = new Set(fetched.map((item) => item.id));
  return [...fetched, ...selected.filter((item) => item?.id != null && !seen.has(item.id))];
}

/**
 * Chọn NHIỀU mục của một danh mục bằng danh sách ô tích, cho quan hệ nhiều-nhiều (loại thiết bị của bộ
 * thông số…). Giá trị trên form là mảng `{ id, ... }`.
 */
export function MultiRefPickerField({
  control,
  name,
  resource,
  label,
  unitLabel,
  emptyHint,
  className,
}: {
  control: Control<CatalogFormValues>;
  name: string;
  resource: string;
  label: string;
  /** Đơn vị đếm trong dòng "Đã chọn N …". */
  unitLabel: string;
  /** Dòng gợi ý khi chưa chọn gì; mặc định chỉ đếm. */
  emptyHint?: string;
  className?: string;
}) {
  const mayRead = useCan({ resource, action: "list" }).data?.can ?? false;
  const { result, query } = useList<Ref>({
    resource,
    // Danh mục ngắn; lấy một trang lớn để ô chọn không lặng lẽ thiếu mục.
    pagination: { pageSize: 200 },
    sorters: [{ field: "sortOrder", order: "asc" }],
    queryOptions: { enabled: mayRead },
  });

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => {
        const value: Ref[] = Array.isArray(field.value) ? (field.value as Ref[]) : [];
        const selected = new Set(value.map((item) => Number(item.id)));
        const items = union((result?.data ?? []) as Ref[], value);
        const toggle = (item: Ref, checked: boolean) =>
          field.onChange(checked ? [...value, item] : value.filter((v) => Number(v.id) !== item.id));

        return (
          <FormItem className={className}>
            <FormLabel>{label}</FormLabel>
            {query.isLoading && mayRead ? (
              <Skeleton className="h-32 w-full" />
            ) : (
              <div className="grid max-h-72 gap-2 overflow-y-auto rounded-md border p-3 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((item) => (
                  <label key={item.id} className="flex cursor-pointer items-center gap-2 text-sm">
                    <Checkbox checked={selected.has(item.id)} onCheckedChange={(c) => toggle(item, c === true)} />
                    {item.name}
                  </label>
                ))}
              </div>
            )}
            <FormDescription>
              {selected.size === 0 && emptyHint ? emptyHint : `Đã chọn ${selected.size} ${unitLabel}.`}
            </FormDescription>
            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
}
