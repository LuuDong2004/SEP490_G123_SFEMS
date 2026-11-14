import { useForm } from "@refinedev/react-hook-form";
import { useSearchParams } from "react-router";

import { CreateView, CreateViewHeader } from "@/shared/components/views/create-view";
import { Form } from "@/shared/ui/form";
import { IntakeFormBody } from "./form-body";
import { INTAKE_DEFAULT_VALUES, type IntakeFormValues } from "./fields";

/**
 * Lập phiếu ghi tăng — luôn là MỘT phiếu, mở thẳng vào form, không hỏi trước. Chứng từ (nhà cung cấp, hoá đơn,
 * nguồn kinh phí, hình thức mua sắm) khai MỘT LẦN ở đầu phiếu, áp cho mọi dòng; dòng nào có hoá đơn khác thì bật
 * "Hoá đơn riêng" trong chi tiết dòng. Phiếu mới luôn là NHÁP: lưu xong đi tới màn chi tiết, hoặc "Trình duyệt" để
 * lưu và trình một lần.
 */
export const EquipmentIntakeCreate = () => {
  const [params] = useSearchParams();
  const presetSchool = Number(params.get("school.id"));

  const {
    refineCore: { onFinish },
    ...form
  } = useForm({
    refineCoreProps: { redirect: "show" },
    // Báo lỗi khi rời ô (mẫu chốt: gõ sai là thấy ngay), không đợi bấm Lưu.
    mode: "onTouched",
    defaultValues: {
      ...INTAKE_DEFAULT_VALUES,
      school: { id: Number.isInteger(presetSchool) && presetSchool > 0 ? presetSchool : null },
      lines: [],
      details: {},
    } as unknown as IntakeFormValues,
  });

  return (
    <CreateView>
      <Form {...form}>
        <IntakeFormBody onFinish={onFinish} header={(actions) => <CreateViewHeader actionsSlot={actions} />} />
      </Form>
    </CreateView>
  );
};
