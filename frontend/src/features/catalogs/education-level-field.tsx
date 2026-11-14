import { useCan, useSelect } from "@refinedev/core";
import { useMemo } from "react";
import type { Control } from "react-hook-form";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { FormHint } from "@/shared/components/form/help-hint";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/shared/ui/form";

/** Radix không cho `SelectItem` mang value rỗng, nên "chưa chọn" cần một giá trị thật. */
const NONE = "__none__";

type LevelRef = { id: number; code?: string; name: string } | null | undefined;

/**
 * Ô chọn cấp học, dùng chung cho mọi danh mục trỏ tới cấp học.
 *
 * <p>Hai việc bắt buộc, và cả hai đều vì Radix `Select` so khớp `value` với item
 * ĐANG mount và không so lại khi item tới sau:
 *
 * <ul>
 *   <li>ghép cấp học của CHÍNH bản ghi vào danh sách, thay vì chờ danh sách tới
 *       — thua cuộc đua thì ô chọn hiện placeholder đè lên một giá trị thật,
 *       trông như ô rỗng, và bấm Lưu là mất nó</li>
 *   <li>gác truy vấn bằng `useCan`: đọc cấp học là quyền riêng, hỏi bừa là tiêu
 *       một request cho một cái 403 chắc chắn và dựng toast lỗi đè lên form</li>
 * </ul>
 */
export function EducationLevelField({
  control,
  current,
  description,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  control: Control<any>;
  current?: LevelRef;
  description?: string;
}) {
  const mayRead =
    useCan({ resource: "education_levels", action: "list" }).data?.can ?? false;

  const { options } = useSelect({
    resource: "education_levels",
    optionLabel: "name",
    optionValue: "id",
    sorters: [{ field: "sortOrder", order: "asc" }],
    queryOptions: { enabled: mayRead },
  });

  const items = useMemo<{ value: string; label: string }[]>(() => {
    const list = (options ?? []).map((o: { label: string; value: unknown }) => ({
      value: String(o.value),
      label: o.label,
    }));
    if (!current?.id) return list;
    return list.some((o) => o.value === String(current.id))
      ? list
      : [{ value: String(current.id), label: current.name }, ...list];
  }, [options, current?.id, current?.name]);

  return (
    <FormField
      control={control}
      name="educationLevel.id"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Cấp học</FormLabel>
          <Select
            onValueChange={(value) =>
              field.onChange(value === NONE ? null : Number(value))
            }
            value={field.value == null ? "" : String(field.value)}
          >
            <FormControl>
              <SelectTrigger>
                <SelectValue placeholder="Vui lòng chọn cấp học" />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {items.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {description ? <FormHint>{description}</FormHint> : null}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
