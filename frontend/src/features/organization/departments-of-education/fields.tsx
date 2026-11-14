import type { Control } from "react-hook-form";

import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";
import { maxLengthOf, mergeRules, textRules } from "@/shared/lib/field-rules";
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
import {
  MANAGING_BODY_TYPE_OPTIONS,
  STATUS_OPTIONS,
  type ManagingBodyType,
  type OrgStatus,
} from "@/domains/department-of-education/types";

/**
 * Payload gửi lên khi tạo/sửa — tương ứng `DepartmentOfEducationRequest` /
 * `DepartmentOfEducationPatchRequest` ở backend.
 */
export type DepartmentOfEducationFormValues = {
  code: string;
  name: string;
  province: string;
  address: string;
  type: ManagingBodyType;
  status: OrgStatus;
};

/**
 * Khai kiểu tường minh chứ không để suy ra, để `status` nới thành union thay vì
 * bị ghim vào đúng chuỗi "active" mà đối tượng tình cờ khởi tạo bằng.
 */
export const DEFAULT_VALUES: DepartmentOfEducationFormValues = {
  code: "",
  name: "",
  province: "",
  address: "",
  type: "so",
  status: "active",
};

/** Các ô nhập của Sở/Phòng GD, dùng chung cho màn thêm và màn sửa. */
export function DepartmentOfEducationFields({
  control,
}: {
  control: Control<DepartmentOfEducationFormValues>;
}) {
  return (
    <>
      <FormField
        control={control}
        name="code"
        rules={mergeRules(textRules("CODE", "Mã"), { required: "Mã là bắt buộc" })}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Mã</FormLabel>
            <FormControl>
              <Input {...field} value={field.value ?? ""} placeholder="SGD-HCM" maxLength={maxLengthOf("CODE")} />
            </FormControl>
            <FormHint>
              Mã ngắn, không được trùng với đơn vị khác.
            </FormHint>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name="name"
        rules={mergeRules(textRules("NAME", "Tên đơn vị"), { required: "Tên đơn vị là bắt buộc" })}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Tên đơn vị</FormLabel>
            <FormControl>
              <Input
                {...field}
                value={field.value ?? ""}
                placeholder="Sở Giáo dục và Đào tạo Thành phố Hồ Chí Minh"
                maxLength={maxLengthOf("NAME")}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name="province"
        rules={textRules("SHORT_TEXT", "Tỉnh/Thành phố", { max: 128 })}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Tỉnh/Thành phố</FormLabel>
            <FormControl>
              <Input
                {...field}
                value={field.value ?? ""}
                placeholder="Thành phố Hồ Chí Minh"
                maxLength={maxLengthOf("SHORT_TEXT", 128)}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name="address"
        rules={textRules("ADDRESS", "Địa chỉ")}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Địa chỉ</FormLabel>
            <FormControl>
              <Textarea {...field} value={field.value ?? ""} rows={2} maxLength={maxLengthOf("ADDRESS")} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name="type"
        rules={{ required: "Loại cơ quan là bắt buộc" }}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Loại cơ quan</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Vui lòng chọn loại cơ quan" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {MANAGING_BODY_TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormHint>
              Loại quyết định phạm vi dữ liệu của tài khoản thuộc cơ quan này.
            </FormHint>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name="status"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Trạng thái</FormLabel>
            <Select onValueChange={field.onChange} value={field.value ?? "active"}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Vui lòng chọn trạng thái" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormHint>
              Ngưng hoạt động thì đơn vị và các trường trực thuộc vẫn được giữ lại.
            </FormHint>
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  );
}
