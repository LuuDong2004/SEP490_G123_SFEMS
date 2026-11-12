import { useForm } from "@refinedev/react-hook-form";
import { useEffect } from "react";

import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Form } from "@/shared/ui/form";
import { DEFAULT_VALUES, SchoolFields, type SchoolFormValues } from "@/features/organization/schools/fields";
import type { School } from "@/domains/school/types";
import { saveSchoolLogo } from "@/features/organization/schools/logo-field";

/**
 * Thêm / sửa trường trong HỘP THOẠI — dùng ở màn Tổng quan để người dùng
 * không phải rời cây. `id` có giá trị là sửa, vắng là thêm.
 *
 * <p>Tách thành component chỉ mount khi mở: form Refine nạp bản ghi lúc mount,
 * nên mỗi lần mở là một form mới, không lẫn dữ liệu của lần trước.
 */
export function SchoolDialog({
  open,
  id,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  id?: number;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Cỡ `wideFit` của repo nguồn chưa có trong `DialogContent` của nhóm (shared/**, phải báo
          DongLV trước khi sửa) — đặt bề rộng qua `className`. */}
      <DialogContent className="sm:max-w-[min(80rem,calc(100vw-4rem))]">
        <DialogHeader>
          <DialogTitle>{id ? "Sửa trường" : "Thêm trường"}</DialogTitle>
        </DialogHeader>
        {open ? (
          <SchoolDialogForm
            id={id}
            onDone={() => {
              onOpenChange(false);
              onSaved?.();
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function SchoolDialogForm({ id, onDone }: { id?: number; onDone: () => void }) {
  const {
    refineCore: { onFinish, query },
    ...form
  } = useForm({
    // Không cảnh báo "thay đổi chưa lưu": Huỷ trong hộp thoại là bỏ đi có chủ ý,
    // và cờ cảnh báo của form đã đóng không được treo lại chặn lần chuyển trang sau.
    warnWhenUnsavedChanges: false,
    refineCoreProps: {
      resource: "schools",
      action: id ? "edit" : "create",
      id,
      redirect: false,
      // Lưu logo SAU khi trường có id, rồi mới đóng hộp thoại.
      onMutationSuccess: async (data) => {
        const schoolId = id ?? (data?.data as { id?: number } | undefined)?.id;
        if (schoolId) {
          await saveSchoolLogo(schoolId, form.getValues("logo"));
        }
        onDone();
      },
    },
    defaultValues: DEFAULT_VALUES,
  });
  const record = query?.data?.data as School | undefined;

  // Cùng lý do với màn sửa: nạp bằng `reset` để ô nào mount muộn cũng nhận giá trị.
  const { reset } = form;
  useEffect(() => {
    if (!record) return;
    reset(record as unknown as SchoolFormValues, { keepDirtyValues: true });
  }, [record, reset]);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((v: SchoolFormValues) => onFinish(v))} className="space-y-5">
        <SchoolFields control={form.control} record={record} compact />
        <DialogFooter>
          {/* DialogClose: đóng bằng chính cơ chế của hộp thoại, một lần bấm là xong. */}
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Huỷ
            </Button>
          </DialogClose>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Đang lưu…" : id ? "Lưu thay đổi" : "Lưu"}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}
