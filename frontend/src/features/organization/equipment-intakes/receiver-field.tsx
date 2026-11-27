import { useGetIdentity, useList } from "@refinedev/core";
import { Lock, Users } from "lucide-react";
import { useEffect } from "react";
import { useFormContext, useWatch, type Control } from "react-hook-form";

import { StaffPicker, type StaffRow } from "@/shared/components/catalog/staff-picker";
import { maxLengthOf, textError, textRules } from "@/shared/lib/field-rules";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/shared/ui/form";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { POSITION_LABELS } from "@/domains/staff/types";

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Chức vụ khi người nhận không có trong danh sách cán bộ, hoặc hồ sơ chưa khai chức vụ. */
const UNKNOWN_POSITION = "Chưa xác định";

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").toLowerCase().replace(/\s+/g, " ").trim();
const positionOf = (r?: StaffRow | null) => (r?.position ? (POSITION_LABELS[r.position] ?? r.position) : UNKNOWN_POSITION);

function useSchoolStaff(schoolId?: number | null) {
  const { result, query } = useList<any>({
    resource: "staff",
    filters: schoolId ? [{ field: "school.id", operator: "eq", value: schoolId }] : [],
    pagination: { pageSize: 500 },
  });
  return {
    rows: (result?.data ?? []) as (StaffRow & { account?: { id: number } | null })[],
    // Đã có câu trả lời (kể cả lỗi / không có quyền đọc cán bộ) — từ đó mới biết người lập có hồ sơ hay không.
    settled: !!query?.isFetched,
  };
}

/** Cán bộ mang đúng tên này (bỏ dấu, bỏ khoảng trắng thừa) — chỉ khi DUY NHẤT một người, trùng tên thì không đoán. */
function byName(rows: StaffRow[], name: unknown) {
  const n = fold(String(name ?? ""));
  if (!n) return null;
  const hits = rows.filter((r) => fold(r.name) === n);
  return hits.length === 1 ? hits[0] : null;
}

/**
 * Ô "Người nhận" của phiếu ghi tăng (trưởng nhóm 13/11/2026): ô CHỮ — người ký nhận có khi không có trong danh sách
 * cán bộ — kèm nút chọn cán bộ của trường bằng hộp chọn chuẩn (`StaffPicker`). "Chức vụ người nhận" KHÔNG gõ được:
 * nó đi theo người nhận — chức vụ trong hồ sơ cán bộ, hồ sơ chưa khai hoặc người ngoài danh sách thì "Chưa xác
 * định". Lưu vẫn là chữ (`details.receiverName` / `receiverPosition`), máy chủ không đổi.
 *
 * <p>Lúc LẬP phiếu, ô trống thì điền sẵn người đang lập (hồ sơ cán bộ nối với tài khoản, không có thì tên tài
 * khoản). Không đánh dấu form "đã sửa".
 */
export function ReceiverField({ control, schoolId, creating, label, max, min }: {
  control: Control<any>;
  schoolId?: number | null;
  creating: boolean;
  label: string;
  max?: number;
  min?: number;
}) {
  const { getValues, setValue } = useFormContext();
  const { rows, settled } = useSchoolStaff(schoolId);
  const { data: me } = useGetIdentity<{ id?: number; fullName?: string }>();
  const mine = rows.find((r) => r.account?.id != null && r.account.id === me?.id);
  const name = useWatch({ control, name: "details.receiverName" });

  // Lập phiếu: người nhận mặc định là người đang lập — ĐỢI danh sách cán bộ về: điền tên tài khoản trước rồi hồ sơ
  // mới tới là ô đã có chữ, không điền lại được nữa (tên hồ sơ mới là tên đúng). Tên tài khoản không qua luật họ tên
  // (vd. "Lưu Văn Test 2" có chữ số) thì để trống cho người dùng gõ, không điền sẵn một giá trị mà chính form chặn.
  useEffect(() => {
    if (!creating || !settled) return;
    const mineName = mine?.name ?? me?.fullName;
    if (!mineName || textError("PERSON_NAME", label, mineName, max, min)) return;
    if (!String(getValues("details.receiverName") ?? "").trim()) setValue("details.receiverName", mineName);
  }, [creating, settled, mine?.name, me?.fullName, getValues, setValue, label, max, min]);

  // Chức vụ luôn suy từ người nhận: gõ tay đúng tên một cán bộ cũng nhận ra; trống người nhận thì trống chức vụ.
  useEffect(() => {
    if (!settled && String(name ?? "").trim()) return; // danh sách chưa về — đợi, không ghi "Chưa xác định" vội
    const next = String(name ?? "").trim() ? positionOf(byName(rows, name) ?? (mine && fold(mine.name) === fold(String(name)) ? mine : null)) : "";
    if ((getValues("details.receiverPosition") ?? "") !== next) setValue("details.receiverPosition", next);
  }, [name, rows, settled, mine, getValues, setValue]);

  return (
    <FormField
      control={control}
      name="details.receiverName"
      rules={textRules("PERSON_NAME", label, { max, min })}
      render={({ field, fieldState }) => (
        <FormItem data-field="details.receiverName">
          <FormLabel>{label}</FormLabel>
          <div className="relative">
            <FormControl>
              <Input value={field.value ?? ""} onChange={field.onChange} onBlur={field.onBlur} name={field.name} ref={field.ref}
                maxLength={maxLengthOf("PERSON_NAME", max)} placeholder="Họ tên, hoặc chọn cán bộ" className="pe-10"
                aria-invalid={!!fieldState.error || undefined} />
            </FormControl>
            <StaffPicker rows={rows} value={null} label="người nhận" prefer="keeper"
              onChange={(row) => {
                if (!row) return;
                setValue("details.receiverName", row.name, { shouldDirty: true, shouldValidate: true });
                setValue("details.receiverPosition", positionOf(row), { shouldDirty: true });
              }}
              trigger={(open) => (
                <button type="button" onClick={open} title="Chọn cán bộ của trường" aria-label="Chọn cán bộ của trường"
                  className="text-muted-foreground hover:bg-muted hover:text-foreground absolute top-1/2 right-1.5 flex size-7 -translate-y-1/2 items-center justify-center rounded-md">
                  <Users className="size-4" />
                </button>
              )} />
          </div>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

/** "Chức vụ người nhận": chỉ hiện, khoá — giá trị do {@link ReceiverField} đặt theo người nhận. */
export function ReceiverPositionField({ control, label }: { control: Control<any>; label: string }) {
  const value = useWatch({ control, name: "details.receiverPosition" }) as string | undefined;
  return (
    <div className="grid gap-2" data-field="details.receiverPosition">
      <Label>{label}</Label>
      <div className="relative">
        <Input disabled value={value ?? ""} placeholder="Theo người nhận" aria-label={label} className="pe-8"
          title="Theo hồ sơ cán bộ của người nhận" />
        <Lock className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 size-3.5 -translate-y-1/2" />
      </div>
    </div>
  );
}
