import { useForm } from "@refinedev/react-hook-form";
import { useNavigate } from "react-router";

import {
  EditView,
  EditViewHeader,
} from "@/shared/components/views/edit-view";
import { Button } from "@/shared/ui/button";
import { Form } from "@/shared/ui/form";
import {
  FormActions,
  FormPanel,
} from "@/shared/components/form/form-panel";
import { CatalogEditingContext } from "@/shared/components/catalog/fields";
import {
  DEFAULT_VALUES,
  EducationLevelFields,
  type EducationLevelFormValues,
} from "@/features/catalogs/education-levels/fields";

/**
 * Màn sửa dựng form NGAY, không chờ bản ghi về — được, vì màn này không có ô
 * Radix `Select` nào.
 *
 * <p>Cái bẫy mà `row-level-policies/edit.tsx` phải né là riêng của `Select`:
 * nó lấy nhãn từ `SelectItem` khớp, nên một giá trị về SAU khi mount thì hiện
 * ra placeholder và đọc như ô rỗng. `Input`, `Textarea` và `Switch` thì đọc
 * thẳng `value`/`checked`, nên `reset` của Refine vẽ lại chúng đúng. Ngày nào
 * màn này có thêm một `Select` thì phải gác lại việc dựng form.
 */
export const EducationLevelEdit = () => {
  const navigate = useNavigate();

  const {
    refineCore: { onFinish },
    ...form
  } = useForm({
    // Kiểu giá trị form suy ra từ `defaultValues`, không truyền generic:
    // `useForm` của Refine có thứ tự tham số kiểu KHÁC `react-hook-form`
    // (tham số đầu là kiểu dữ liệu truy vấn), nên đặt kiểu form vào ô đầu sẽ
    // làm `control` tụt về `FieldValues`.
    refineCoreProps: {},
    defaultValues: DEFAULT_VALUES,
  });

  function onSubmit(values: EducationLevelFormValues) {
    onFinish(values);
  }

  return (
    <EditView>
      <EditViewHeader />
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="w-full">
          <FormPanel>
            <CatalogEditingContext.Provider value>
              <EducationLevelFields control={form.control} />
            </CatalogEditingContext.Provider>

            <FormActions>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Đang lưu…" : "Lưu thay đổi"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate(-1)}
              >
                Huỷ
              </Button>
            </FormActions>
          </FormPanel>
        </form>
      </Form>
    </EditView>
  );
};
