import { useForm } from "@refinedev/react-hook-form";
import { useSearchParams } from "react-router";

import { CreateView, CreateViewHeader } from "@/shared/components/views/create-view";
import { Form } from "@/shared/ui/form";
import { IntakeFormBody } from "./form-body";
import {
  INTAKE_DEFAULT_VALUES,
  type IntakeFormValues,
} from "@/features/organization/equipment-intakes/fields";

/**
 * Lập phiếu nhập — luôn là MỘT phiếu, mở thẳng vào form, không hỏi trước. Chứng từ (nhà cung cấp,
 * hoá đơn, nguồn, bảo hành) khai ở TỪNG DÒNG: một nhà cung cấp thì khai dòng đầu rồi "Áp cho mọi
 * dòng" (dòng thêm sau tự chép chứng từ của dòng trên); nhiều nhà cung cấp thì mỗi dòng khai của nó.
 * Phiếu mới luôn là NHÁP: lưu xong đi thẳng tới màn chi tiết — việc tiếp theo (trình) ở đó.
 */
export const EquipmentIntakeCreate = () => {
  const [params] = useSearchParams();
  const presetSchool = Number(params.get("school.id"));

  const {
    refineCore: { onFinish },
    ...form
  } = useForm({
    refineCoreProps: { redirect: "show" },
    defaultValues: {
      ...INTAKE_DEFAULT_VALUES,
      school: { id: Number.isInteger(presetSchool) && presetSchool > 0 ? presetSchool : null },
      lines: [],
      details: {},
    } as unknown as IntakeFormValues,
  });

  return (
    <CreateView>
      <CreateViewHeader />
      <Form {...form}>
        <IntakeFormBody onFinish={onFinish} />
      </Form>
    </CreateView>
  );
};
