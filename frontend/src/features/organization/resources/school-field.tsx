import { useList, useOne } from "@refinedev/core";
import { useEffect } from "react";
import { useFormContext, useWatch, type Control } from "react-hook-form";

import { Lock } from "lucide-react";

import { RefField } from "@/shared/components/catalog/ref-field";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { isScopedResource } from "@/shared/api/session";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Trường sở hữu của dữ liệu thuộc trường.
 *
 * <p>Màn sửa: ô khoá chỉ đọc, vì dữ liệu không đổi trường bằng một lần sửa form.
 *
 * <p>Màn thêm: ô chọn — TRỪ tài khoản chỉ với tới đúng một trường, thì hiện tên
 * trường đó trong một ô khoá chỉ đọc thay cho ô chọn. Cán bộ và hiệu trưởng chỉ có một lựa chọn duy
 * nhất; bắt họ mở danh sách một dòng rồi bấm vào chính trường mình là hỏi một
 * câu đã biết trước câu trả lời, và để trống thì phiếu lại báo "Chọn trường".
 * Máy chủ vẫn tự điền khi payload vắng {@code school.id}
 * ({@code SchoolOwnedService.resolveSchool}), nên ô này chỉ là chuyện màn hình.
 *
 * <p>Điều kiện là "bị thu hẹp phạm vi dòng ở resource schools VÀ chỉ với tới
 * một trường", không phải "danh sách có một dòng": chuyên viên Sở không bị thu
 * hẹp (thấy 947 trường) và chuyên viên UBND thấy 57 — cả hai vẫn phải chọn, vì
 * với họ "trường nào" là một câu hỏi thật.
 */
export function SchoolField({
  control,
  record,
  hideWhenFixed,
  hideWhenLocked,
  wide,
  required,
}: {
  control: Control<any>;
  record?: any;
  /** Trường đã cố định (sửa, tài khoản một trường, hay mở từ màn của một trường) thì không vẽ ô — chỉ giữ giá trị. */
  hideWhenFixed?: boolean;
  /** Chỉ ẩn ô KHOÁ (màn sửa, tài khoản một trường) — người phải chọn trường thì ô vẫn ở đó sau khi chọn. */
  hideWhenLocked?: boolean;
  /**
   * Ô nằm trong một ô lưới đã định bề rộng (phiếu ghi tăng: rộng hai cột) — lấp đủ ô đó. Mặc định ô tự chặn ở
   * `max-w-md` để khỏi kéo dài cả hàng khi đứng riêng, và trong ô hai cột thì chừa ra một khoảng trống.
   */
  wide?: boolean;
  /** Ô bắt buộc (phiếu): dấu * và câu nhắc "Chọn trường" khi bỏ trống. */
  required?: boolean;
}) {
  // Trường điền sẵn từ màn Tổng quan (?school.id=): nạp tên để ô chọn hiện
  // đúng ngay, không chờ danh sách trường về (bẫy Radix Select).
  const presetId = useWatch({ control, name: "school.id" });

  const scoped = isScopedResource("schools");
  const { result: reachable } = useList<any>({
    resource: "schools",
    pagination: { pageSize: 1 },
    queryOptions: { enabled: !record && scoped },
  });
  const onlySchool = scoped && reachable?.total === 1 ? reachable.data[0] : undefined;

  // Tên trường đã nằm sẵn trong `reachable`, nên khi tự điền thì không tra lại:
  // hiệu ứng dưới ghi `school.id`, và một `useOne` không canh sẽ đuổi theo
  // chính giá trị vừa ghi để lấy về đúng dòng đang cầm trong tay.
  const { result: preset } = useOne<any>({
    resource: "schools",
    id: presetId ?? "",
    queryOptions: { enabled: !record && !onlySchool && !!presetId },
  });

  const { setValue } = useFormContext();
  useEffect(() => {
    if (onlySchool && presetId !== onlySchool.id) {
      setValue("school.id", onlySchool.id, { shouldDirty: false });
    }
  }, [onlySchool, presetId, setValue]);

  if (hideWhenFixed && (record || onlySchool || presetId)) return null;
  if (hideWhenLocked && (record || onlySchool)) return null;

  if (record || onlySchool) {
    // Vẫn là một Ô như mọi ô khác trên form — cùng khung, cùng hàng — chỉ khoá không cho
    // sửa. Một dòng chữ trơn giữa hàng ô nhập làm lệch hàng và đọc như nhãn, không như dữ liệu.
    const why = record ? "Không đổi được trường sau khi tạo" : "Tài khoản của bạn chỉ thuộc trường này";
    return (
      <div className="grid gap-2">
        <Label htmlFor="school-readonly">Trường</Label>
        <div className={wide ? "relative" : "relative sm:max-w-md"} title={why}>
          <Input
            id="school-readonly"
            readOnly
            tabIndex={-1}
            aria-readonly
            value={record ? (record.school?.name ?? "—") : onlySchool.name}
            className="bg-muted text-muted-foreground cursor-not-allowed pe-9 focus-visible:bg-muted"
          />
          <Lock className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2" />
        </div>
      </div>
    );
  }
  return (
    <RefField
      control={control}
      name="school"
      resource="schools"
      label="Trường"
      required={required}
      current={preset ? { id: preset.id, name: preset.name } : undefined}
      className={wide ? undefined : "sm:max-w-md"}
    />
  );
}

export const schoolColumn = {
  id: "school",
  header: "Trường",
  enableSorting: false,
  // Tên trường dài ("Trường THCS và THPT …") cắt bằng dấu ba chấm thay vì nới cả bảng ra.
  size: 200,
  cell: ({ row }: any) => (
    <span className="block max-w-56 truncate" title={row.original.school?.name ?? undefined}>
      {row.original.school?.name ?? "—"}
    </span>
  ),
};
