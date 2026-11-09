import { EquipmentCatalogPicker } from "@/shared/components/catalog/equipment-catalog-picker";
import { StaffPicker, type StaffPrefer, type StaffRow } from "@/shared/components/catalog/staff-picker";
import { AsyncCombobox } from "@/shared/components/form/async-combobox";
import { FormHint } from "@/shared/components/form/help-hint";
import { useCan, useSelect, type CrudFilter } from "@refinedev/core";
import { useMemo } from "react";
import type { Control } from "react-hook-form";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/shared/ui/form";

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Resource chọn bằng ô có tìm kiếm tự đọc theo trang — không đổ sẵn danh sách ở đây. */
const SEARCHED = new Set(["equipment_catalogs", "schools"]);

/** Radix không cho `SelectItem` mang value rỗng, nên "chưa chọn" cần một giá trị thật. */
const NONE = "__none__";

export type RefValue = { id: number; code?: string; name: string } | null | undefined;

/**
 * Ô chọn một mục danh mục khác, lưu vào `{name}.id` — cùng khuôn với ô chọn
 * cấp học (`EducationLevelField`), tổng quát cho mọi danh mục:
 *
 * <ul>
 *   <li>ghép mục ĐANG chọn của bản ghi vào danh sách, vì Radix `Select` không
 *       so lại khi item tới sau</li>
 *   <li>gác truy vấn bằng `useCan` — không có quyền đọc thì không hỏi</li>
 *   <li>chỉ mục ĐANG HOẠT ĐỘNG (`active=true`): mục đã tắt — phòng ngừng sử dụng, môn bỏ — không
 *       chọn mới được nữa; mục đang gắn với bản ghi vẫn hiện nhờ dòng trên. Máy chủ bỏ qua bộ lọc
 *       với resource không có cờ này</li>
 * </ul>
 */
export function RefField({
  control,
  name,
  resource,
  label,
  current,
  required,
  filters,
  className,
  hideLabel,
  disabledHint,
  emptyHint,
  onPicked,
  hint,
  staffPrefer,
  placeholder,
  labelField = "name",
}: {
  control: Control<any>;
  name: string;
  resource: string;
  label: string;
  current?: RefValue;
  required?: boolean;
  filters?: CrudFilter[];
  className?: string;
  /** Nhãn chỉ cho trình đọc màn hình — ô nằm trong một khung đã có tiêu đề riêng. */
  hideLabel?: boolean;
  /** Có giá trị = ô bị khoá, hiện câu nhắc này (ví dụ "Chọn cấp học trước"). */
  disabledHint?: string;
  /**
   * Câu hiện trong ô khi danh sách đã tải xong mà KHÔNG có lựa chọn nào (vd. "Cấp trên chưa mở đợt kiểm kê
   * nào") — ô khoá lại, thay vì mở ra một danh sách rỗng trông như lỗi.
   */
  emptyHint?: string;
  /** Gọi khi người dùng chọn một mục — để tự điền các ô phụ thuộc. */
  onPicked?: (item: any) => void;
  /** Ô chọn cán bộ: nhóm người hay được chọn ở ô này, xếp lên đầu hộp chọn. */
  staffPrefer?: StaffPrefer;
  /** Lời giải thích — hiện thành dấu "?" cạnh nhãn. */
  hint?: string;
  /**
   * Chữ trong ô khi còn trống, cho ô mà "không chọn" tự nó là một câu trả lời ("Cả trường", "Trường tự
   * kiểm kê") — thay cho "Vui lòng chọn …", vốn nói là còn việc phải làm.
   */
  placeholder?: string;
  /** Trường hiện trong ô: `"code"` khi nhãn ô đã nói loại (ô "Năm học" hiện "2026-2027", không "Năm học 2026-2027"). */
  labelField?: "name" | "code";
}) {
  const mayRead = useCan({ resource, action: "list" }).data?.can ?? false;

  const { options, query: selectQuery } = useSelect({
    resource,
    optionLabel: labelField,
    optionValue: "id",
    sorters: [{ field: "sortOrder", order: "asc" }],
    filters: [...(filters ?? []), { field: "active", operator: "eq", value: true }],
    pagination: { pageSize: resource === "staff" ? 500 : 200 },
    // Thiết bị từ danh mục chọn bằng hộp thoại tự đọc theo trang — không đổ sẵn danh sách ở đây.
    queryOptions: { enabled: mayRead && !disabledHint && !SEARCHED.has(resource) },
  });

  const items = useMemo(() => {
    const list = (options ?? []).map((o: { label: string; value: unknown }) => ({
      value: String(o.value),
      label: o.label,
    }));
    if (!current?.id) return list;
    return list.some((o) => o.value === String(current.id))
      ? list
      : [{ value: String(current.id), label: (labelField === "code" ? current.code : undefined) ?? current.name }, ...list];
  }, [options, current?.id, current?.name, current?.code, labelField]);
  const empty = !!emptyHint && !disabledHint && selectQuery?.isSuccess === true && items.length === 0;
  const lockedHint = disabledHint ?? (empty ? emptyHint : undefined);

  return (
    <FormField
      control={control}
      name={`${name}.id`}
      rules={required ? { required: `Chọn ${label.toLowerCase()}` } : undefined}
      render={({ field, fieldState }) => (
        <FormItem className={className}>
          <FormLabel className={hideLabel ? "sr-only" : undefined}>
            {label}
          </FormLabel>
          {hint ? <FormHint>{hint}</FormHint> : null}
          {/* Cán bộ chọn bằng hộp thoại có ô tìm, hiện chức vụ và tổ — danh sách xổ chỉ có tên
              không phân biệt được hai người trùng tên. */}
          {resource === "staff" ? (
            <StaffPicker
              rows={(selectQuery?.data?.data as StaffRow[] | undefined) ?? []}
              loading={selectQuery?.isLoading}
              value={field.value == null ? null : { id: Number(field.value), name: current?.id === Number(field.value) ? current?.name : undefined }}
              label={label.toLowerCase()}
              disabledHint={disabledHint}
              invalid={!!fieldState.error}
              prefer={staffPrefer}
              onChange={(row) => {
                field.onChange(row ? row.id : null);
                if (row) onPicked?.(row);
              }}
            />
          ) : resource === "equipment_catalogs" ? (
            <EquipmentCatalogPicker
              value={field.value == null ? null : { id: Number(field.value), ...(current?.id === Number(field.value) ? { name: current?.name, code: current?.code } : {}) }}
              filters={filters}
              label={label.toLowerCase()}
              disabledHint={disabledHint}
              invalid={!!fieldState.error}
              required={required}
              onChange={(row) => {
                field.onChange(row ? row.id : null);
                if (row) onPicked?.(row);
              }}
            />
          ) : resource === "schools" ? (
            // Hàng trăm trường (Sở thấy 947): ô có tìm kiếm, tải theo trang — danh sách xổ 200 dòng vừa không
            // tìm được vừa thiếu mất các trường sau dòng 200.
            <AsyncCombobox<{ id: number; name: string; code?: string }>
              resource="schools"
              value={field.value == null ? null : Number(field.value)}
              onChange={(id) => field.onChange(id)}
              onPick={(row) => onPicked?.(row)}
              labelOf={(s) => s.name}
              fallbackLabel={current?.id === Number(field.value) ? current?.name : null}
              placeholder={lockedHint ?? placeholder ?? `Vui lòng chọn ${label.toLowerCase()}`}
              searchPlaceholder="Gõ tên hoặc mã trường..."
              clearable={!required}
              clearLabel="Bỏ chọn"
              disabled={!!lockedHint}
              invalid={!!fieldState.error}
            />
          ) : (
          <Select
            disabled={!!lockedHint}
            onValueChange={(value) => {
              // Radix bắn `""` khi giá trị tới trước danh sách lựa chọn (điền sẵn, màn sửa nạp bản ghi) — không mục
              // nào mang value rỗng nên "" không bao giờ là lựa chọn thật; nhận vào là ghi đè giá trị bằng 0.
              if (value === "") return;
              const id = value === NONE ? null : Number(value);
              field.onChange(id);
              if (onPicked && id != null) {
                const rows: any[] = (selectQuery?.data?.data as any[]) ?? [];
                onPicked(rows.find((r) => r.id === id) ?? { id });
              }
            }}
            value={field.value == null ? "" : String(field.value)}
          >
            <FormControl>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={lockedHint ?? placeholder ?? `Vui lòng chọn ${label.toLowerCase()}`} />
              </SelectTrigger>
            </FormControl>
            {/* Phải chặn chiều cao bằng tay. `SelectContent` của shadcn dùng
                `--radix-select-content-available-height`, mà popover được
                portal ra `body` nên "chiều cao còn trống" là CẢ MÀN HÌNH —
                danh sách 200 mục (hoặc 947 trường với tài khoản Sở) nở kín
                trang thay vì cuộn. */}
            <SelectContent className="max-h-64">
              {/* Ô không bắt buộc thì phải bỏ chọn được — chọn nhầm rồi kẹt lại là lỗi của ô, không phải của người nhập. */}
              {!required && field.value != null ? (
                <SelectItem value={NONE} className="text-muted-foreground">Bỏ chọn</SelectItem>
              ) : null}
              {items.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          )}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

