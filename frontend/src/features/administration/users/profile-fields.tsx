import type { Control } from "react-hook-form";

import { Checkbox } from "@/shared/ui/checkbox";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/shared/ui/form";
import { FormHint } from "@/shared/components/form/help-hint";
import { TextareaField, TextField } from "@/shared/components/form/simple-fields";
import type { UserProfile } from "@/domains/user/types";

/** Nhóm loại theo phần riêng (bảng con): quản trị · cơ quan (Sở, UBND) · trường. */
export type ProfileKind = "system" | "agency" | "school";

/* eslint-disable @typescript-eslint/no-explicit-any */

/** `control` của form bất kỳ — form tạo có kiểu giá trị riêng, form sửa thì không. */
export type AnyControl = Control<any>;

/**
 * Ô riêng theo loại tài khoản (docs/kien-truc/11): chức danh cho mọi loại, điện thoại cơ quan cho Sở / UBND, quản trị
 * cấp cao + IP được đăng nhập + ghi chú cho quản trị. Chức vụ (lãnh đạo / chuyên viên) không gõ — suy từ vai.
 */
export function ProfileFields({ control, kind }: { control: AnyControl; kind: ProfileKind }) {
  return (
    <div className="grid items-start gap-x-4 gap-y-5 @2xl:grid-cols-2">
      <TextField control={control} name="profile.jobTitle" label="Chức danh" rule="SHORT_TEXT"
        placeholder={kind === "school" ? "Cán bộ thiết bị, phó hiệu trưởng…" : "Chuyên viên phòng Kế hoạch – Tài chính…"} />
      {kind === "agency" ? (
        <TextField control={control} name="profile.workPhone" label="Điện thoại cơ quan" rule="PHONE" />
      ) : null}
      {kind === "system" ? (
        <>
          <FormField
            control={control}
            name="profile.superAdmin"
            render={({ field }) => (
              <FormItem className="@2xl:col-span-2">
                <div className="flex items-center gap-2">
                  <FormControl>
                    <Checkbox checked={field.value === true} onCheckedChange={(v) => field.onChange(v === true)} />
                  </FormControl>
                  <FormLabel className="font-normal">Quản trị cấp cao</FormLabel>
                </div>
                <FormHint>Quản lý được tài khoản quản trị khác. Chỉ quản trị cấp cao đổi được ô này.</FormHint>
                <FormMessage />
              </FormItem>
            )}
          />
          <TextareaField control={control} name="profile.allowedIps" label="IP được đăng nhập" rule="LONG_TEXT" max={1000}
            className="@2xl:col-span-2" placeholder="10.0.0.5, 192.168.1.0/24"
            description="Để trống = theo danh sách chung. Chỉ quản trị cấp cao đổi được." />
          <TextareaField control={control} name="profile.note" label="Ghi chú" rule="NOTE" className="@2xl:col-span-2" />
        </>
      ) : null}
    </div>
  );
}

/** Chỉ gửi những ô thuộc loại — máy chủ từ chối ô của loại khác. */
export function profilePayload(kind: ProfileKind, profile: Partial<UserProfile> | null | undefined) {
  const p = profile ?? {};
  const text = (v: unknown) => (v == null ? undefined : String(v));
  if (kind === "system") {
    return {
      jobTitle: text(p.jobTitle),
      note: text(p.note),
      superAdmin: p.superAdmin == null ? undefined : p.superAdmin === true,
      allowedIps: text(p.allowedIps),
    };
  }
  if (kind === "agency") return { jobTitle: text(p.jobTitle), workPhone: text(p.workPhone) };
  return { jobTitle: text(p.jobTitle) };
}
