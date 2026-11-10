/* eslint-disable @typescript-eslint/no-explicit-any -- control của form danh mục chung là Control<any> */
import { useCustom } from "@refinedev/core";
import { useEffect } from "react";
import { useFormContext, useWatch, type Control } from "react-hook-form";

import { API_URL } from "@/shared/api/constants";
import { customResult } from "@/shared/hooks/use-custom-result";

/** Quy tắc mã đang áp cho một loại của trường (`GET /school_code_rules`). */
export type SchoolCodeRule = {
  target: "rooms" | "buildings" | "campuses" | "staff" | "subject_teams" | "facility_works";
  label: string;
  prefix: string | null;
  numberLength: number;
  startNumber: number;
  /** `false` là cách đặt mặc định — trường chưa khai. */
  custom: boolean;
  /** Mã sẽ cấp cho bản ghi kế tiếp, tính từ dữ liệu đang có. */
  next: string | null;
};

/**
 * Điền ô Mã của form THÊM MỚI bằng mã kế tiếp do máy chủ tính theo quy tắc mã của trường
 * (`/school_code_rules/next`). Lúc lưu máy chủ cấp lại từ dữ liệu, nên hai người thêm cùng lúc
 * không nhận trùng mã. Form sửa không gọi: mã đã có thì giữ.
 */
export function useSchoolNextCode(
  target: SchoolCodeRule["target"],
  control: Control<any>,
  record: unknown,
) {
  const { setValue } = useFormContext();
  const schoolId = useWatch({ control, name: "school.id" });
  const query: Record<string, string> = { target };
  if (schoolId) query["school.id"] = String(schoolId);
  const { result } = useCustom<{ code: string | null }>({
    url: `${API_URL}/school_code_rules/next`,
    method: "get",
    config: { query },
    // Chưa chọn trường thì chưa có quy tắc để hỏi — gọi là 422 (quản trị / Sở lập mới chưa chọn trường).
    queryOptions: { enabled: !record && !!schoolId, staleTime: 0, gcTime: 0, retry: false },
  });
  const code = customResult(result?.data, "code")?.code;
  useEffect(() => {
    if (record || code === undefined) return;
    setValue("code", code ?? "", { shouldDirty: true, shouldValidate: !!code });
  }, [record, code, setValue]);
  return code;
}
