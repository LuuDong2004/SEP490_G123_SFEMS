import { useCustom } from "@refinedev/core";
import { useEffect } from "react";
import type { UseFormReturn } from "react-hook-form";

import { API_URL } from "@/shared/api/constants";
import { customResult } from "@/shared/hooks/use-custom-result";
import type { CatalogFormValues } from "@/features/catalogs/catalog-config";

/**
 * Điền sẵn ô Mã ở form thêm mới bằng mã gợi ý của quy tắc sinh mã (DM-04).
 *
 * <p>Chỉ là gợi ý: bộ đếm KHÔNG tăng ở đây. Lúc lưu, máy chủ so mã gửi lên với mã gợi ý — giữ nguyên thì
 * chốt số, tự gõ mã khác thì bộ đếm không bị tiêu. Danh mục chưa có quy tắc thì API trả `null` và ô Mã
 * để trống như cũ. Không ghi đè nếu người dùng đã gõ vào ô trước khi gợi ý về tới.
 */
export function useSuggestedCode(
  target: string,
  form: Pick<UseFormReturn<CatalogFormValues>, "getValues" | "setValue">,
  enabled: boolean,
) {
  const { result } = useCustom<{ code: string | null }>({
    url: `${API_URL}/code_rules/next`,
    method: "get",
    config: { query: { target } },
    queryOptions: { staleTime: 0, gcTime: 0, enabled },
  });
  const suggested = enabled ? (customResult(result?.data, "code")?.code ?? null) : null;

  const { getValues, setValue } = form;
  useEffect(() => {
    if (!suggested || getValues("code")) return;
    setValue("code", suggested);
  }, [suggested, getValues, setValue]);

  return suggested;
}
