import { useForm } from "@refinedev/react-hook-form";
import { useNavigate } from "react-router";

import {
  CreateView,
  CreateViewHeader,
} from "@/shared/components/views/create-view";
import { Button } from "@/shared/ui/button";
import { PolicyForm, type PolicyFormValues } from "@/features/administration/row-level-policies/policy-form";
import { DEFAULT_POLICY, normalize } from "@/features/administration/row-level-policies/policy-values";
import { useManagedResources } from "@/features/administration/row-level-policies/use-managed-resources";

export const RowLevelPolicyCreate = () => {
  const navigate = useNavigate();
  const resources = useManagedResources();

  const {
    refineCore: { onFinish },
    ...form
  } = useForm({
    refineCoreProps: {},
    defaultValues: DEFAULT_POLICY,
  });

  function onSubmit(values: PolicyFormValues) {
    onFinish(normalize(values));
  }

  return (
    <CreateView>
      <CreateViewHeader />
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <PolicyForm form={form} resources={resources} />
        <div className="flex gap-2">
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Đang tạo..." : "Thêm mới"}
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate(-1)}>
            Huỷ
          </Button>
        </div>
      </form>
    </CreateView>
  );
};
