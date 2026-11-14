import { useForm } from "@refinedev/react-hook-form";

import { Button } from "@/shared/ui/button";
import { Form } from "@/shared/ui/form";
import { RouteDialog } from "@/shared/components/views/route-dialog";
import {
  DEFAULT_VALUES,
  DepartmentOfEducationFields,
  type DepartmentOfEducationFormValues,
} from "@/features/organization/departments-of-education/fields";

/**
 * Nút bấm nằm ở chân hộp thoại, tức là NGOÀI thẻ `form`, nên phải nối lại bằng
 * thuộc tính `form` của HTML. Không có nó thì nút Lưu không gửi gì cả.
 */
const FORM_ID = "department-of-education-create";

/**
 * Thêm cơ quan quản lý — một HỘP THOẠI mở trên chính màn danh sách.
 *
 * <p>Trước đây đây là một trang riêng. Thêm một đơn vị chỉ có sáu ô nhập, nên
 * rời khỏi danh sách để điền sáu ô rồi quay lại là ba lần chuyển trang cho một
 * việc nhỏ — và mỗi lần quay lại là bộ lọc, thứ tự, trang đang xem đều dựng
 * lại từ đầu.
 *
 * <p>Vẫn là một ROUTE chứ không phải trạng thái cục bộ: địa chỉ
 * `/departments-of-education/create` mở được thẳng, gửi cho người khác được,
 * và mọi lối đóng hộp thoại đều quay về danh sách đứng sau nó.
 */
export const DepartmentOfEducationCreate = () => {
  const {
    refineCore: { onFinish },
    ...form
  } = useForm({
    refineCoreProps: {},
    defaultValues: DEFAULT_VALUES,
  });

  return (
    <RouteDialog
      title="Thêm cơ quan quản lý"
      description="Sở GD&ĐT quản lý các trường trong hệ thống."
      footer={
        <>
          <Button type="submit" form={FORM_ID} disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Đang lưu..." : "Thêm mới"}
          </Button>
        </>
      }
    >
      <Form {...form}>
        <form
          id={FORM_ID}
          onSubmit={form.handleSubmit((v: DepartmentOfEducationFormValues) => onFinish(v))}
          className="w-full"
        >
          <DepartmentOfEducationFields control={form.control} />
        </form>
      </Form>
    </RouteDialog>
  );
};
