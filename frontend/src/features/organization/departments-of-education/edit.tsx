import { swallow } from "@/shared/lib/swallow";
import { useForm } from "@refinedev/react-hook-form";
import { useEffect } from "react";

import { Button } from "@/shared/ui/button";
import { Form } from "@/shared/ui/form";
import { RouteDialog } from "@/shared/components/views/route-dialog";
import {
  DEFAULT_VALUES,
  DepartmentOfEducationFields,
  type DepartmentOfEducationFormValues,
} from "@/features/organization/departments-of-education/fields";

/** Nút Lưu nằm ngoài thẻ `form`, nối lại bằng thuộc tính `form` của HTML. */
const FORM_ID = "department-of-education-edit";

/** Sửa cơ quan quản lý — hộp thoại trên danh sách, cùng khuôn với màn thêm. */
export const DepartmentOfEducationEdit = () => {
  const {
    refineCore: { onFinish, query },
    ...form
  } = useForm({
    refineCoreProps: {},
    defaultValues: DEFAULT_VALUES,
  });

  // `reset` chỉ chạy được từ một effect, tức là luôn SAU một lần vẽ, nên form
  // mount trước khi có bản ghi sẽ mang giá trị mặc định. Nạp lại bằng `reset`
  // để ô nào mount muộn cũng nhận đúng giá trị của bản ghi.
  const record = query?.data?.data;
  const { reset } = form;
  useEffect(() => {
    if (record) reset(record as DepartmentOfEducationFormValues, { keepDirtyValues: true });
  }, [record, reset]);

  return (
    <RouteDialog
      title="Sửa cơ quan quản lý"
      description="Đổi loại cơ quan sẽ đổi dữ liệu mà tài khoản của đơn vị này xem được."
      footer={
        <Button type="submit" form={FORM_ID} disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Đang lưu..." : "Lưu"}
        </Button>
      }
    >
      <Form {...form}>
        <form
          id={FORM_ID}
          onSubmit={form.handleSubmit((v: DepartmentOfEducationFormValues) => onFinish(v).catch(swallow))}
          className="w-full"
        >
          <DepartmentOfEducationFields control={form.control} />
        </form>
      </Form>
    </RouteDialog>
  );
};
