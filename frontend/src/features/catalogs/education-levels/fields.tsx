import type { Control } from "react-hook-form";
import { GraduationCap } from "lucide-react";

import { Input } from "@/shared/ui/input";
import { maxLengthOf, textRules } from "@/shared/lib/field-rules";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/shared/ui/form";
import { CatalogFields, type CatalogFormValues } from "@/shared/components/catalog/fields";
import type { CatalogConfig } from "@/shared/components/catalog/types";

/**
 * Payload gửi lên khi tạo/sửa — tương ứng `EducationLevelRequest` /
 * `EducationLevelPatchRequest` ở backend, KHÔNG phải hình dạng
 * `EducationLevelResponse` mà phần còn lại của resource nói.
 */
export type EducationLevelFormValues = {
  code: string;
  name: string;
  shortName: string;
  sortOrder: number | null;
  active: boolean;
  note: string;
};

export const DEFAULT_VALUES: EducationLevelFormValues = {
  code: "",
  name: "",
  shortName: "",
  sortOrder: null,
  active: true,
  note: "",
};

/** Cấp học không nằm trong registry (khai riêng trong routes.tsx) nên tự mô tả ở đây. */
export const EDUCATION_LEVEL_CONFIG: CatalogConfig = {
  resource: "education_levels",
  path: "/education-levels",
  group: "catalog_org",
  icon: GraduationCap,
  label: "Cấp học",
  description: "",
  codeExample: "THPT",
  nameExample: "Trung học phổ thông",
  codeLockedOnEdit: true,
  // Chỉ dùng phần `show` — form của cấp học tự dựng ở EducationLevelFields.
  extra: {
    section: { title: "Hiển thị rút gọn" },
    defaults: {},
    Fields: () => null,
    columns: [],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    show: (r: any) => [{ label: "Tên viết tắt", value: r?.shortName ?? "—" }],
  },
};

/**
 * Các ô nhập của cấp học — cùng khuôn form với mọi danh mục (`CatalogFields`),
 * thêm một nhóm cho tên viết tắt.
 */
export function EducationLevelFields({
  control,
  suggestedCode,
  compact,
}: {
  control: Control<EducationLevelFormValues>;
  suggestedCode?: string | null;
  compact?: boolean;
}) {
  return (
    <CatalogFields
      control={control as unknown as Control<CatalogFormValues>}
      config={EDUCATION_LEVEL_CONFIG}
      suggestedCode={suggestedCode}
      compact={compact}
      extra={{
        title: "Hiển thị rút gọn",
        inline: true,
        content: (
          <FormField
            control={control}
            name="shortName"
            rules={textRules("SHORT_TEXT", "Tên viết tắt", { max: 64 })}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tên viết tắt</FormLabel>
                <FormControl>
                  <Input {...field} value={field.value ?? ""} placeholder="THPT" maxLength={maxLengthOf("SHORT_TEXT", 64)} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        ),
      }}
    />
  );
}
