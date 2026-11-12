import { useCustom } from "@refinedev/core";
import { useEffect } from "react";
import { useFormContext, type FieldValues, type Path, type PathValue, type UseFormReturn } from "react-hook-form";

import { customResult } from "@/shared/hooks/use-custom-result";
import { API_URL } from "@/shared/api/constants";

/**
 * Điền sẵn ô Mã ở form tạo mới bằng mã gợi ý của quy tắc sinh mã.
 *
 * <p>Bản cục bộ của `shared/components/catalog/use-suggested-code.ts` (repo nguồn). Giữ trong
 * `features/organization/schools` thay vì `shared/**` vì `shared/**` là vùng dùng chung: sửa ở đó phải
 * báo DongLV trước. Cùng cách TuTN đã làm với `features/catalogs/use-suggested-code.ts`.
 *
 * <p>Chỉ là gợi ý: bộ đếm KHÔNG tăng ở đây. Lúc lưu, backend so mã gửi lên với
 * mã gợi ý — giữ nguyên thì chốt số, tự gõ mã khác thì bộ đếm không bị tiêu.
 * Danh mục chưa có quy tắc thì API trả `null` và ô Mã để trống như cũ.
 *
 * <p>Không ghi đè nếu người dùng đã gõ vào ô trước khi gợi ý về tới.
 */
export function useSuggestedCode<T extends FieldValues & { code: string }>(
  target: string,
  form: Pick<UseFormReturn<T>, "getValues" | "setValue">,
  /** `false` khi ô Mã không hiện trên form (`hideCode`) — khỏi hỏi gợi ý. */
  enabled = true,
) {
  const { result } = useCustom<{ code: string | null }>({
    url: `${API_URL}/code_rules/next`,
    method: "get",
    config: { query: { target } },
    queryOptions: { staleTime: 0, gcTime: 0, enabled },
  });
  const suggested = customResult(result?.data, "code")?.code ?? null;

  const { getValues, setValue } = form;
  useEffect(() => {
    if (!suggested) return;
    const code = "code" as Path<T>;
    if (getValues(code)) return;
    setValue(code, suggested as PathValue<T, Path<T>>);
  }, [suggested, getValues, setValue]);

  return suggested;
}

/** Bản component để dùng trong hộp thoại, nơi chỉ có form context. */
export function SuggestCode({ target }: { target: string }) {
  const form = useFormContext<{ code: string }>();
  useSuggestedCode(target, form);
  return null;
}
