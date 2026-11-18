import { useForm } from "@refinedev/react-hook-form";
import { useNavigate } from "react-router";

import {
  CreateView,
  CreateViewHeader,
} from "@/shared/components/views/create-view";
import { Button } from "@/shared/ui/button";
import { Form } from "@/shared/ui/form";
import {
  FormActions,
  FormPanel,
} from "@/shared/components/form/form-panel";
import {
  DEFAULT_VALUES,
  EducationLevelFields,
  type EducationLevelFormValues,
} from "@/features/catalogs/education-levels/fields";
import { useSuggestedCode } from "@/shared/components/catalog/use-suggested-code";

export const EducationLevelCreate = () => {
  const navigate = useNavigate();

  const {
    refineCore: { onFinish },
    ...form
  } = useForm({
    refineCoreProps: {},
    defaultValues: DEFAULT_VALUES,
  });
  const suggestedCode = useSuggestedCode("education_levels", form);

  function onSubmit(values: EducationLevelFormValues) {
    onFinish(values);
  }

  return (
    <CreateView>
      {/* Thiếu header thì màn hình không có breadcrumb và không có đường ra —
          mà build, lint lẫn runtime đều không kêu gì. */}
      <CreateViewHeader />
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="w-full">
          <FormPanel>
            <EducationLevelFields control={form.control} suggestedCode={suggestedCode} />

            <FormActions>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Đang lưu…" : "Lưu"}
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
    </CreateView>
  );
};
