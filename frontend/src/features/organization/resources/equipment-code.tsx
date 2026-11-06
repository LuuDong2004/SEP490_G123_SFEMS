/* eslint-disable @typescript-eslint/no-explicit-any -- control của form thiết bị là Control<any> */
import { useCustom, useCustomMutation, useNotification } from "@refinedev/core";
import { Sparkles } from "lucide-react";
import { useEffect } from "react";
import { useFormContext, useWatch, type Control } from "react-hook-form";

import { API_URL } from "@/shared/api/constants";
import { customResult } from "@/shared/hooks/use-custom-result";
import { Button } from "@/shared/ui/button";
import { Label } from "@/shared/ui/label";

/** Mã chuẩn TT.TR.MH.LT.ST.NC — khớp với `Equipment.STANDARD_CODE` ở backend. */
const STANDARD_CODE = /^\d{2}\.[A-Z0-9]{2}\.\d{2}\.(TB|PM|HL)\.\d{3}\.\d{2}$/;

/**
 * Ô "Mã tài sản" của form THÊM MỚI: chỉ đọc, hiện mã sẽ cấp lấy từ `GET /equipment/next-code`.
 * Mã được ghi vào form để gửi đi; máy chủ chốt số lúc lưu nên có thể khác nếu vừa có người lưu trước.
 * Chưa đủ dữ liệu (chưa chọn nhóm, trường thiếu mã viết tắt...) thì nói rõ lý do.
 */
export function CodeSuggestion({ control }: { control: Control<any> }) {
  const { setValue, getValues } = useFormContext();
  const [catalog, type, received, purchased] = useWatch({
    control,
    name: ["catalog", "physicalOrDigital", "receivedDate", "purchaseDate"],
  });
  const catalogId: number | null = catalog?.id ?? null;

  const query: Record<string, string> = {};
  if (catalogId) query.catalogId = String(catalogId);
  if (type) query.physicalOrDigital = type;
  if (received) query.receivedDate = received;
  if (purchased) query.purchaseDate = purchased;

  const { result } = useCustom<{ code: string | null; reason: string | null }>({
    url: `${API_URL}/equipment/next-code`,
    method: "get",
    config: { query },
    queryOptions: { enabled: !!catalogId, staleTime: 0, gcTime: 0 },
  });
  const data = customResult(result?.data, "code");
  const suggested = data?.code ?? null;

  useEffect(() => {
    // Chỉ thay mã khi ô đang là gợi ý cũ hoặc trống; chưa đủ dữ liệu thì xoá gợi ý cũ.
    const current = getValues("code");
    if (suggested) {
      setValue("code", suggested, { shouldDirty: true });
    } else if (current) {
      setValue("code", "", { shouldDirty: true });
    }
  }, [suggested, getValues, setValue]);

  return (
    <div className="space-y-1.5">
      <Label>Mã tài sản</Label>
      <div className="border-input bg-muted/40 flex h-9 items-center rounded-md border px-3 text-sm">
        {suggested ? (
          <span className="flex items-center gap-1.5 font-mono font-medium">
            <Sparkles className="text-muted-foreground size-3.5" />
            {suggested}
          </span>
        ) : (
          <span className="text-muted-foreground text-xs">
            {catalogId ? "Chưa cấp được mã" : "Chọn danh mục thiết bị để được cấp mã"}
          </span>
        )}
      </div>
      {!suggested && data?.reason ? (
        <p className="text-warning-text text-xs">Không cấp được mã: {data.reason}.</p>
      ) : null}
    </div>
  );
}

/**
 * Ô "Mã tài sản" của form SỬA: chỉ đọc. Mã cũ (chưa theo chuẩn) hiện nút "Cấp mã chuẩn", gọi
 * `POST /equipment/{id}/standard-code`. Mã cũ được giữ ở "Mã cũ" để tra tem đã in.
 */
export function CodeField({
  control,
  recordId,
  onChanged,
}: {
  control: Control<any>;
  recordId: number | undefined;
  onChanged: () => void;
}) {
  const code: string = useWatch({ control, name: "code" }) ?? "";
  const isStandard = STANDARD_CODE.test(code);
  const { mutate, mutation } = useCustomMutation();
  const { open } = useNotification();

  const standardize = () => {
    if (!recordId) return;
    mutate(
      { url: `${API_URL}/equipment/${recordId}/standard-code`, method: "post", values: {} },
      {
        onSuccess: () => {
          open?.({ type: "success", message: "Đã cấp mã chuẩn" });
          onChanged();
        },
        onError: (error: any) => {
          open?.({ type: "error", message: error?.message ?? "Không cấp được mã chuẩn" });
        },
      },
    );
  };

  return (
    <div className="space-y-1.5">
      <Label>Mã tài sản</Label>
      <div className="border-input bg-muted/40 flex h-9 items-center justify-between gap-2 rounded-md border px-3">
        <span className="truncate font-mono text-sm">{code || "—"}</span>
        {!isStandard && recordId ? (
          <Button type="button" size="sm" variant="outline" disabled={mutation.isPending} onClick={standardize}>
            Cấp mã chuẩn
          </Button>
        ) : null}
      </div>
      {!isStandard && code ? (
        <p className="text-muted-foreground text-xs">Mã chưa theo chuẩn TT.TR.MH.LT.ST.NC.</p>
      ) : null}
    </div>
  );
}
