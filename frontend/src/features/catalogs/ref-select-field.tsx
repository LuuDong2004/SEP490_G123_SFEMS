import type { Control } from "react-hook-form";

import { AsyncCombobox } from "@/shared/components/form/async-combobox";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/shared/ui/form";
import type { CatalogRef } from "@/domains/catalog/types";
import type { CatalogFormValues } from "@/features/catalogs/catalog-config";

/**
 * Ô chọn MỘT mục của danh mục khác (cấp học, năm học, tổ chuyên môn…). Giá trị trên form là tham
 * chiếu `{id, code, name}` như API trả về; chọn mục mới thì form giữ `{id}` — máy chủ chỉ đọc `id`.
 */
export function RefSelectField({
  control,
  name,
  label,
  resource,
  placeholder,
  required,
  className,
}: {
  control: Control<CatalogFormValues>;
  name: string;
  label: string;
  /** Resource của danh mục được chọn, vd. `education_levels`. */
  resource: string;
  placeholder: string;
  /** Câu báo lỗi khi bỏ trống; không truyền thì ô cho phép bỏ chọn. */
  required?: string;
  className?: string;
}) {
  return (
    <FormField
      control={control}
      name={name}
      rules={required ? { required } : undefined}
      render={({ field }) => {
        const current = field.value as CatalogRef | null;
        return (
          <FormItem className={className}>
            <FormLabel>{label}</FormLabel>
            <FormControl>
              <AsyncCombobox<CatalogRef>
                resource={resource}
                value={current?.id ?? null}
                // Bỏ chọn gửi `{id: null}` chứ không phải `null`: với API, vắng khoá là "để nguyên".
                onChange={(id) => field.onChange(id == null ? (required ? null : { id: null }) : { id })}
                labelOf={(item) => item.name}
                fallbackLabel={current?.name}
                placeholder={placeholder}
                clearable={!required}
                clearLabel="Bỏ chọn"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
}
