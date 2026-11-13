import { useCan, useSelect } from "@refinedev/core";
import { useMemo } from "react";
import { useWatch, type Control } from "react-hook-form";

import { Input } from "@/shared/ui/input";
import { maxLengthOf, mergeRules, textRules } from "@/shared/lib/field-rules";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { FormSection } from "@/shared/components/form/form-section";
import { SuggestCode } from "@/features/organization/schools/use-suggested-code";
import { ColorPicker } from "@/features/organization/schools/color-picker";
import { LogoField, type LogoValue } from "@/features/organization/schools/logo-field";
import { WardCombobox } from "@/features/organization/schools/ward-combobox";
import { AsyncCombobox } from "@/shared/components/form/async-combobox";
import {
  MANAGING_BODY_TYPE_SHORT_LABELS,
  type DepartmentOfEducation as DepartmentOfEducationRow,
} from "@/domains/department-of-education/types";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/shared/ui/form";
import { STATUS_OPTIONS, type School, type SchoolStatus } from "@/domains/school/types";

/** Giá trị mà ô chọn "Cấp học" dùng để nói "chưa chọn". */
const NO_LEVEL = "__none__";

/**
 * Payload gửi lên khi tạo/sửa — tương ứng `SchoolRequest` /
 * `SchoolPatchRequest`.
 *
 * <p>Hai tham chiếu là đối tượng lồng, khớp đúng hình dạng API nhận VÀ hình
 * dạng API trả về. Nhờ vậy màn sửa chỉ cần `reset(record)` là xong, không phải
 * dẹt hoá rồi phồng lại.
 */
export type SchoolFormValues = {
  code: string;
  name: string;
  departmentOfEducation: { id: number | null };
  educationLevel: { id: number | null };
  schoolType: { id: number | null };
  shortCode: string;
  moetCode: string;
  ward: { id: number | null };
  /** Chỉ đọc — chữ người dùng từng gõ trước khi có danh mục phường/xã. */
  wardText?: string | null;
  address: string;
  primaryColor: string;
  status: SchoolStatus;
  /** Logo — gửi riêng sau khi lưu trường, xem `saveSchoolLogo`. */
  logo?: LogoValue;
};

export const DEFAULT_VALUES: SchoolFormValues = {
  code: "",
  name: "",
  departmentOfEducation: { id: null },
  educationLevel: { id: null },
  schoolType: { id: null },
  shortCode: "",
  moetCode: "",
  ward: { id: null },
  wardText: null,
  address: "",
  primaryColor: "",
  status: "active",
};

/**
 * Các ô nhập của trường học, dùng chung cho màn thêm và màn sửa.
 *
 * <p>`record` chỉ có ở màn sửa, và nó ở đây vì MỘT lý do: ghép giá trị hiện
 * tại của hai ô chọn vào danh sách tuỳ chọn. Xem `mergedOptions` bên dưới.
 */
export function SchoolFields({
  control,
  record,
  compact,
}: {
  control: Control<SchoolFormValues>;
  record?: School;
  /** Bố cục gọn cho hộp thoại. */
  compact?: boolean;
}) {
  // Đọc Sở và đọc cấp học là hai quyền RIÊNG so với đọc trường, nên một vai
  // trò có thể có quyền này mà không có quyền kia. Hỏi bừa là tiêu một request
  // cho một cái 403 chắc chắn và dựng một toast lỗi đè lên form — trong khi
  // giá trị hiện tại vẫn hiện được, vì nó đến từ bản ghi chứ không từ danh
  // sách này.
  // Chữ địa bàn gõ tay từ trước khi có danh mục. Hiện trên nút chọn khi bản
  // ghi chưa ghép được với phường/xã nào, để người sửa không tưởng là mất dữ
  // liệu.
  const watchedWardText = useWatch({ control, name: "wardText" }) ?? record?.wardText ?? null;

  const mayReadLevels =
    useCan({ resource: "education_levels", action: "list" }).data?.can ?? false;

  const { options: levelOptions } = useSelect({
    resource: "education_levels",
    optionLabel: "name",
    optionValue: "id",
    sorters: [{ field: "sortOrder", order: "asc" }],
    queryOptions: { enabled: mayReadLevels },
  });

  /**
   * Ghép giá trị của chính bản ghi vào danh sách, thay vì chờ nó tới.
   *
   * <p>`Select` của Radix so khớp `value` với những item ĐANG mount ở thời
   * điểm đó và KHÔNG so lại khi item tới sau. Nên Sở của bản ghi phải là một
   * tuỳ chọn chậm nhất là ở lần vẽ mà form được nạp từ bản ghi. Truy vấn danh
   * sách đang chạy đua với lần vẽ đó, và thua cuộc đua thì ô chọn hiện
   * placeholder đè lên một giá trị thật sự đang được đặt — trông y hệt ô rỗng,
   * và bấm Lưu là mất dữ liệu. Với danh sách bị từ chối hẳn thì nó sẽ không
   * bao giờ hiện ra.
   */
  const levelItems = useMemo(
    () => mergeCurrent(levelOptions, record?.educationLevel),
    [levelOptions, record?.educationLevel],
  );

  const mayReadTypes = useCan({ resource: "school_types", action: "list" }).data?.can ?? false;
  const { options: typeOptions } = useSelect({
    resource: "school_types",
    optionLabel: "name",
    optionValue: "id",
    sorters: [{ field: "sortOrder", order: "asc" }],
    pagination: { pageSize: 200 },
    filters: [{ field: "active", operator: "eq", value: true }],
    queryOptions: { enabled: mayReadTypes },
  });
  const typeItems = useMemo(
    () => mergeCurrent(typeOptions, record?.schoolType),
    [typeOptions, record?.schoolType],
  );

  return (
    <div
      className={
        compact
          ? "grid gap-x-8 gap-y-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]"
          : "space-y-8"
      }
    >
      {/* Trong hộp thoại: hai cột để vừa một màn, không phải cuộn. */}
      <div className={compact ? "space-y-5" : "space-y-8"}>
      <FormSection title="Thông tin cơ bản" compact={compact}>
          <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          {/* Mã trường tự sinh theo quy tắc sinh mã "schools" (TR0001…): thêm mới điền sẵn mã gợi ý,
              sửa được nếu muốn; để trống thì máy chủ tự cấp. */}
          {record ? null : <SuggestCode target="schools" />}
          <FormField
            control={control}
            name="code"
            rules={textRules("CODE", "Mã trường")}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Mã trường</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    value={field.value ?? ""}
                    placeholder="Để trống: tự cấp"
                    maxLength={maxLengthOf("CODE")}
                    className="font-mono"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name="name"
            rules={mergeRules(textRules("NAME", "Tên trường"), { required: "Tên trường là bắt buộc" })}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tên trường</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    value={field.value ?? ""}
                    placeholder="Trường THPT Thủ Đức"
                    maxLength={maxLengthOf("NAME")}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          </div>
      </FormSection>
      <FormSection title="Phân loại" compact={compact}>
          <div
            className={
              compact
                ? "grid items-start gap-x-4 gap-y-5 sm:grid-cols-2"
                : "grid items-start gap-5 sm:grid-cols-3"
            }
          >
          {/* Từng là một ô CHỈ ĐỌC ghim cứng vào Sở GD&ĐT TP.HCM, vì lúc đó
              hệ thống chỉ có đúng một cơ quan quản lý. Không còn đúng nữa:
              Sở quản lý trực tiếp THPT, còn Tiểu học và THCS thuộc UBND
              phường/xã — 169 cơ quan. Ghim cứng nghĩa là mọi trường tạo mới
              đều rơi về Sở, tức là sai phân quyền ngay từ dòng đầu tiên. */}
          <FormField
            control={control}
            name="departmentOfEducation.id"
            rules={{ required: "Cơ quan quản lý là bắt buộc" }}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Cơ quan quản lý</FormLabel>
                <FormControl>
                  <AsyncCombobox<DepartmentOfEducationRow>
                    resource="departments_of_education"
                    value={field.value ?? null}
                    onChange={field.onChange}
                    labelOf={(d) =>
                      // `type` của bản nhóm là bắt buộc (không nullable) nên không cần nhánh "chưa rõ loại".
                      `${MANAGING_BODY_TYPE_SHORT_LABELS[d.type] ?? "?"} · ${d.name}`
                    }
                    fallbackLabel={record?.departmentOfEducation?.name ?? null}
                    placeholder="Vui lòng chọn cơ quan quản lý"
                    searchPlaceholder="Gõ tên Sở hoặc UBND..."
                    clearable={false}
                  />
                </FormControl>
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
                    <SelectTrigger className="w-full">
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
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name="educationLevel.id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Cấp học</FormLabel>
                <Select
                  // Radix không cho `SelectItem` mang value rỗng, nên "chưa chọn"
                  // phải là một giá trị canh gác rồi dịch ngược về null ở đây.
                  onValueChange={(value) =>
                    field.onChange(value === NO_LEVEL ? null : Number(value))
                  }
                  value={field.value == null ? "" : String(field.value)}
                >
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Vui lòng chọn cấp học" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {levelItems.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name="schoolType.id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Loại hình trường</FormLabel>
                <Select
                  onValueChange={(value) => {
                    // Radix bắn "" khi giá trị chưa khớp mục nào — không phải người dùng bỏ chọn.
                    if (value === "") return;
                    field.onChange(value === NO_LEVEL ? null : Number(value));
                  }}
                  value={field.value == null ? "" : String(field.value)}
                >
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Vui lòng chọn loại hình trường" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {field.value != null ? <SelectItem value={NO_LEVEL}>Bỏ chọn</SelectItem> : null}
                    {typeItems.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name="shortCode"
            rules={{ pattern: { value: /^$|^[A-Za-z0-9]{2}$/, message: "Mã hai ký tự phải đúng 2 ký tự chữ hoặc số" } }}
            render={({ field }) => (
              <FormItem>
                {/* Mã 2 ký tự (thành phần TR của mã tài sản): để trống thì hệ thống cấp tổ hợp còn trống.
                    Sửa được, nhưng đổi sau khi đã in tem tài sản là lệch với mã trên tem. */}
                <FormLabel>Mã 2 ký tự</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    value={field.value ?? ""}
                    maxLength={2}
                    placeholder="Tự cấp"
                    className="font-mono"
                  />
                </FormControl>
                <p className="text-muted-foreground text-xs">Dùng để cấp mã thiết bị.</p>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name="moetCode"
            rules={textRules("CODE", "Mã định danh Bộ GD&ĐT", { max: 20 })}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Mã định danh Bộ GD&ĐT</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    value={field.value ?? ""}
                    maxLength={20}
                    placeholder="20 ký tự trên CSDL ngành"
                    className="font-mono"
                  />
                </FormControl>
                <p className="text-muted-foreground text-xs">Chưa có thì bổ sung sau.</p>
                <FormMessage />
              </FormItem>
            )}
          />
          </div>
      </FormSection>
      <FormSection title="Địa chỉ" compact={compact}>
          <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <FormField
            control={control}
            name="ward"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phường/Xã</FormLabel>
                <FormControl>
                  <WardCombobox
                    value={field.value?.id ?? null}
                    fallbackLabel={watchedWardText}
                    onChange={(id) => field.onChange({ id })}
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
                  <Input {...field} value={field.value ?? ""} placeholder="Số nhà, tên đường" maxLength={maxLengthOf("ADDRESS")} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          </div>
      </FormSection>
      </div>
      <div className={compact ? "space-y-5 lg:border-l lg:border-border lg:pl-8" : "space-y-8"}>
      {/* Không hỏi Số lớp / Số học sinh: hai số này đếm từ LỚP HỌC của trường (tab Lớp học) —
          định mức (AdequacyService) đọc từ đó, chỉ rơi về số cũ khi trường chưa khai lớp nào. */}
      <FormSection title="Hiển thị" compact={compact}>
          <FormField
            control={control}
            name="logo"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Logo trường</FormLabel>
                <LogoField schoolId={record?.id} value={field.value} onChange={field.onChange} />
              </FormItem>
            )}
          />
          <div className={compact ? "grid gap-5" : "grid gap-5 sm:grid-cols-2 sm:max-w-xl"}>
          <FormField
            control={control}
            name="primaryColor"
            rules={{
              pattern: {
                value: /^$|^#[0-9A-Fa-f]{6}$/,
                message: "Màu chủ đạo phải có dạng #RRGGBB",
              },
            }}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Màu chủ đạo</FormLabel>
                <FormControl>
                  <ColorPicker value={field.value} onChange={field.onChange} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          </div>
      </FormSection>
      </div>
    </div>
  );
}

/** Một dòng trong ô chọn, sau khi đã chuẩn hoá `value` về chuỗi. */
type Option = { label: string; value: string };

/**
 * Xem javadoc của `levelItems` về việc vì sao phải ghép.
 *
 * <p>`useSelect` khai `value` là `unknown` (nó không biết `optionValue` trỏ
 * vào cột kiểu gì), nên chuẩn hoá về chuỗi ngay tại đây — đó cũng là kiểu mà
 * `SelectItem` và React `key` cần.
 */
function mergeCurrent(
  options: { label: string; value: unknown }[] | undefined,
  current: { id: number; name: string } | null | undefined,
): Option[] {
  const list: Option[] = (options ?? []).map((o) => ({
    label: o.label,
    value: String(o.value),
  }));
  if (!current?.id) return list;
  return list.some((o) => o.value === String(current.id))
    ? list
    : [{ label: current.name, value: String(current.id) }, ...list];
}
