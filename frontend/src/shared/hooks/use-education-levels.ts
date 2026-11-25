import { useCan, useList } from "@refinedev/core";
import { useMemo } from "react";

export type EducationLevelOption = { id: number; code: string; name: string };

/**
 * Cấp học đang dùng của hệ thống (danh mục Cấp học, đang hoạt động). Hệ thống hiện chỉ có MỘT cấp (Sở quản lý các trường
 * THPT): `single` là cấp đó — ô chọn cấp học trên form tự điền và ẩn đi, vì một lựa chọn duy nhất không phải là câu hỏi.
 * Có thêm cấp vào danh mục thì các ô đó tự hiện lại.
 */
export function useEducationLevels() {
  const mayRead = useCan({ resource: "education_levels", action: "list" }).data?.can ?? false;
  const { result, query } = useList<EducationLevelOption & { active?: boolean; sortOrder?: number | null }>({
    resource: "education_levels",
    pagination: { pageSize: 100 },
    sorters: [{ field: "sortOrder", order: "asc" }],
    queryOptions: { enabled: mayRead },
  });
  const levels = useMemo(
    () => (result?.data ?? []).filter((l) => l.active !== false).map((l) => ({ id: l.id, code: l.code, name: l.name })),
    [result],
  );
  const loading = mayRead && query.isLoading;
  return { levels, single: !loading && levels.length === 1 ? levels[0] : null, loading };
}
