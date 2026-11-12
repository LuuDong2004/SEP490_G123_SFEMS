import { useForm } from "@refinedev/react-hook-form";

import { RouteDialog } from "@/shared/components/views/route-dialog";
import { Button } from "@/shared/ui/button";
import { DialogClose } from "@/shared/ui/dialog";
import { Form } from "@/shared/ui/form";
import { DEFAULT_VALUES, SchoolFields, type SchoolFormValues } from "@/features/organization/schools/fields";
import { saveSchoolLogo } from "@/features/organization/schools/logo-field";

/** Nút ở chân hộp thoại nằm NGOÀI thẻ `form` — nối lại bằng thuộc tính `form` của HTML. */
const FORM_ID = "school-create";

/**
 * Thêm trường — HỘP THOẠI mở trên chính danh sách trường (như Thêm cơ quan quản lý). Vẫn là route
 * `/schools/create`: mở thẳng được, và mọi lối đóng đều quay về danh sách với bộ lọc / trang đang xem.
 */
export const SchoolCreate = () => {
  const {
    refineCore: { onFinish },
    ...form
  } = useForm({
    refineCoreProps: {
      // Logo đi đường riêng (/api/schools/{id}/logo), sau khi trường đã lưu.
      onMutationSuccess: async (data) => {
        const schoolId = (data?.data as { id?: number } | undefined)?.id;
        if (schoolId) await saveSchoolLogo(schoolId, form.getValues("logo"));
      },
    },
    defaultValues: DEFAULT_VALUES,
  });

  return (
    <RouteDialog
      title="Thêm trường"
      description="Mã trường và mã 2 ký tự để trống thì hệ thống tự cấp."
      // Cỡ `wideFit` của repo nguồn chưa có trong `RouteDialog` của nhóm (shared/**, phải báo
      // DongLV trước khi sửa) — đặt bề rộng qua `className` để không phải đụng file dùng chung.
      className="sm:max-w-[min(80rem,calc(100vw-4rem))]"
      footer={
        <>
          <DialogClose asChild>
            <Button type="button" variant="outline">Huỷ</Button>
          </DialogClose>
          <Button type="submit" form={FORM_ID} disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Đang lưu..." : "Thêm mới"}
          </Button>
        </>
      }
    >
      <Form {...form}>
        <form id={FORM_ID} onSubmit={form.handleSubmit((v: SchoolFormValues) => onFinish(v))} className="w-full">
          {/* Không truyền `record`: màn thêm không có giá trị hiện tại nào phải ghép vào danh sách tuỳ chọn. */}
          <SchoolFields control={form.control} compact />
        </form>
      </Form>
    </RouteDialog>
  );
};
