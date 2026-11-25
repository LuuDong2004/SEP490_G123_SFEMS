import { useList } from "@refinedev/core";
import { useEffect } from "react";
import { useWatch, type Control } from "react-hook-form";

import { SchoolField } from "@/features/organization/resources/school-field";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Ô trường của một phiếu. Tài khoản của trường chỉ đọc được đúng một trường, nên
 * ô được chọn sẵn — cán bộ thiết bị không phải chọn trường của chính mình mỗi lần
 * lập phiếu, và bộ chọn tài sản mở được ngay.
 */
export function VoucherSchoolField({
  control,
  record,
  setValue,
}: {
  control: Control<any>;
  record?: any;
  setValue: (name: string, value: any) => void;
}) {
  const current = useWatch({ control, name: "school.id" });
  const { result } = useList<any>({
    resource: "schools",
    pagination: { currentPage: 1, pageSize: 2 },
    queryOptions: { enabled: !record && !current },
  });
  const only = result?.data?.length === 1 ? result.data[0] : null;

  useEffect(() => {
    if (!record && !current && only) setValue("school", { id: only.id });
  }, [record, current, only, setValue]);

  // Phiếu lập ở trường nào thì thuộc trường đó: ô Trường chỉ hiện khi phải CHỌN (Sở, UBND, quản trị).
  // Tài khoản của một trường và màn sửa thì trường đã cố định — ô khoá chỉ chiếm chỗ.
  return <SchoolField control={control} record={record} hideWhenLocked wide required />;
}

/** Id trường đang chọn trên form (hoặc của phiếu đang sửa). */
export function useVoucherSchoolId(control: Control<any>, record?: any): number | null {
  const picked = useWatch({ control, name: "school.id" });
  return record?.school?.id ?? picked ?? null;
}
