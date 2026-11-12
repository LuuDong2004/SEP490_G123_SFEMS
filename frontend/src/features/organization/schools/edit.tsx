import { isRecordMissing, RecordNotFound } from "@/shared/components/views/record-not-found";
import { useForm } from "@refinedev/react-hook-form";
import { useEffect } from "react";

import { RouteDialog } from "@/shared/components/views/route-dialog";
import { LoadingOverlay } from "@/shared/components/layout/loading-overlay";
import { Button } from "@/shared/ui/button";
import { DialogClose } from "@/shared/ui/dialog";
import { Form } from "@/shared/ui/form";
import { DEFAULT_VALUES, SchoolFields, type SchoolFormValues } from "@/features/organization/schools/fields";
import { saveSchoolLogo } from "@/features/organization/schools/logo-field";
import type { School } from "@/domains/school/types";

const FORM_ID = "school-edit";

/** Sửa trường — HỘP THOẠI trên danh sách trường, route `/schools/edit/:id` (cùng kiểu với Thêm trường). */
export const SchoolEdit = () => {
  const {
    refineCore: { onFinish, query },
    ...form
  } = useForm({
    refineCoreProps: {
      // Logo đi đường riêng (/api/schools/{id}/logo), sau khi trường đã lưu.
      onMutationSuccess: async () => {
        const schoolId = record?.id;
        if (schoolId) await saveSchoolLogo(schoolId, form.getValues("logo"));
      },
    },
    defaultValues: DEFAULT_VALUES,
  });

  const record = query?.data?.data as School | undefined;

  /**
   * Nạp form bằng `reset` chứ không bằng `values`: ô nào mount muộn cũng nhận giá trị; `keepDirtyValues` giữ
   * những gì người dùng vừa gõ khi bản ghi tải lại nền.
   */
  const { reset } = form;
  useEffect(() => {
    if (!record) return;
    reset(record as unknown as SchoolFormValues, { keepDirtyValues: true });
  }, [record, reset]);

  const missing = isRecordMissing(query);

  return (
    <RouteDialog
      title="Sửa trường"
      description={record?.name ?? "Thông tin trường"}
      // Cỡ `wideFit` của repo nguồn chưa có trong `RouteDialog` của nhóm (shared/**, phải báo
      // DongLV trước khi sửa) — đặt bề rộng qua `className` để không phải đụng file dùng chung.
      className="sm:max-w-[min(80rem,calc(100vw-4rem))]"
      footer={
        <>
          <DialogClose asChild>
            <Button type="button" variant="outline">Huỷ</Button>
          </DialogClose>
          {missing ? null : (
            <Button type="submit" form={FORM_ID} disabled={form.formState.isSubmitting || !record}>
              {form.formState.isSubmitting ? "Đang lưu..." : "Lưu"}
            </Button>
          )}
        </>
      }
    >
      {missing ? (
        <RecordNotFound what="trường" />
      ) : (
        <LoadingOverlay loading={query?.isLoading ?? false}>
          <Form {...form}>
            <form id={FORM_ID} onSubmit={form.handleSubmit((v: SchoolFormValues) => onFinish(v))} className="w-full">
              {/* `record` để hai ô chọn ghép được giá trị hiện tại vào danh sách tuỳ chọn — thiếu nó, ô chọn hiện
                  RỖNG đè lên giá trị thật và bấm Lưu là mất. */}
              <SchoolFields control={form.control} record={record} compact />
            </form>
          </Form>
        </LoadingOverlay>
      )}
    </RouteDialog>
  );
};
