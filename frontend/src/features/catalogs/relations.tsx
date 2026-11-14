import { useCan, useList } from "@refinedev/core";
import { useWatch, type Control } from "react-hook-form";

import { MultiRefPickerField, union } from "@/shared/components/catalog/multi-ref-picker";

import { Checkbox } from "@/shared/ui/checkbox";
import { Skeleton } from "@/shared/ui/skeleton";
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
import { SUBJECT_TYPE_LABELS } from "@/domains/subject/types";

/* eslint-disable @typescript-eslint/no-explicit-any */

type Ref = { id: number; code?: string; name?: string };



type LevelRow = {
  educationLevel: Ref;
  subjectType: string;
  sortOrder: number | null;
};

/**
 * Môn học được dạy ở cấp nào, và ở cấp đó là bắt buộc hay tự chọn.
 *
 * <p>Mỗi cấp học là một dòng cố định: đánh dấu là "dạy ở cấp này", rồi chọn
 * loại. Không phải danh sách thêm/xoá dòng tự do — với ba cấp học, một bảng cố
 * định không cho phép chọn trùng một cấp hai lần, thứ mà backend vẫn chặn
 * nhưng người dùng không nên phải gặp.
 *
 * <p>Ô chọn loại có tuỳ chọn là hằng số cục bộ, luôn mount sẵn, nên không vướng
 * bẫy "Select so khớp trước khi item tới".
 */
export function SubjectLevelsField({ control }: { control: Control<any> }) {
  const mayRead =
    useCan({ resource: "education_levels", action: "list" }).data?.can ?? false;
  const { result, query } = useList<Ref & { sortOrder: number | null }>({
    resource: "education_levels",
    pagination: { pageSize: 100 },
    sorters: [{ field: "sortOrder", order: "asc" }],
    queryOptions: { enabled: mayRead },
  });

  return (
    <FormField
      control={control}
      name="educationLevels"
      render={({ field }) => {
        const value: LevelRow[] = Array.isArray(field.value) ? field.value : [];
        const levels = union(
          (result?.data ?? []) as Ref[],
          value.map((v) => v.educationLevel),
        );
        const rowFor = (id: number) => value.find((v) => v.educationLevel?.id === id);

        const toggle = (level: Ref, checked: boolean) => {
          if (checked) {
            field.onChange([
              ...value,
              { educationLevel: level, subjectType: "bat_buoc", sortOrder: null },
            ]);
          } else {
            field.onChange(value.filter((v) => v.educationLevel?.id !== level.id));
          }
        };
        const setType = (id: number, subjectType: string) =>
          field.onChange(
            value.map((v) => (v.educationLevel?.id === id ? { ...v, subjectType } : v)),
          );

        return (
          <FormItem>
            <FormLabel>Cấp học giảng dạy</FormLabel>
            {query.isLoading && mayRead ? (
              <Skeleton className="h-24 w-full" />
            ) : (
              <div className="divide-y rounded-md border">
                {levels.map((level) => {
                  const row = rowFor(level.id);
                  return (
                    <div key={level.id} className="flex items-center gap-3 px-3 py-2">
                      <Checkbox
                        id={`level-${level.id}`}
                        checked={Boolean(row)}
                        onCheckedChange={(c) => toggle(level, c === true)}
                      />
                      <label htmlFor={`level-${level.id}`} className="flex-1 text-sm">
                        {level.name}
                      </label>
                      <Select
                        disabled={!row}
                        value={row?.subjectType ?? "bat_buoc"}
                        onValueChange={(v) => setType(level.id, v)}
                      >
                        <FormControl>
                          <SelectTrigger className="w-40">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.entries(SUBJECT_TYPE_LABELS).map(([v, l]) => (
                            <SelectItem key={v} value={v}>
                              {l}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  );
                })}
              </div>
            )}
            <FormHint>
              Chọn các cấp học có dạy môn này, rồi chọn môn là bắt buộc hay tự
              chọn ở từng cấp.
            </FormHint>
            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
}

/**
 * Môn học thuộc tổ chuyên môn — chỉ liệt kê môn DẠY Ở cấp học của tổ; chưa
 * chọn cấp học thì liệt kê mọi môn. Một môn có thể thuộc nhiều tổ.
 */
export function SubjectPickerField({ control }: { control: Control<any> }) {
  const levelId = useWatch({ control, name: "educationLevel.id" });
  return (
    <MultiRefPickerField
      control={control}
      name="subjects"
      resource="subjects"
      label="Môn học thuộc tổ"
      unitLabel="môn"
      filters={levelId ? [{ field: "educationLevel.id", operator: "eq", value: levelId }] : undefined}
    />
  );
}
