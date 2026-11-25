/* eslint-disable @typescript-eslint/no-explicit-any -- bản ghi phiếu cũ đọc cả trường đầu phiếu lẫn trường dòng. */
import { useNavigation } from "@refinedev/core";
import { useConfirmDiscard } from "@/shared/components/form/unsaved-changes-guard";
import { useForm } from "@refinedev/react-hook-form";
import { Lock } from "lucide-react";
import { useEffect } from "react";
import { Navigate, useNavigate } from "react-router";

import { EditView, EditViewHeader } from "@/shared/components/views/edit-view";
import { IntakeFormBody } from "./form-body";
import { VoucherStatusBadge } from "@/shared/components/voucher/voucher-status";
import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/alert";
import { Button } from "@/shared/ui/button";
import { Form } from "@/shared/ui/form";
import { Skeleton } from "@/shared/ui/skeleton";
import type { EquipmentIntake } from "@/domains/equipment-intake/types";
import { INTAKE_DEFAULT_VALUES, toFormValues, type IntakeFormValues } from "./fields";

/**
 * Sửa một phiếu NHÁP.
 *
 * <p>Phiếu đã xác nhận thì màn này không hiện form: nó nói ra lý do và dẫn về
 * chi tiết. API cũng từ chối, nhưng để người dùng gõ xong cả phiếu rồi mới bị
 * từ chối là bắt họ làm một việc mà kết quả đã biết trước.
 */
export const EquipmentIntakeEdit = () => {
  const navigate = useNavigate();
  // Quay lại: về danh sách (trưởng nhóm 14/11/2026), không lùi lịch sử.
  const { list, showUrl } = useNavigation();
  // Hỏi TRƯỚC rồi mới đi (lưu nháp / bỏ) — lệnh đi của Refine không chặn được giữa chừng.
  const confirmLeave = useConfirmDiscard();
  const {
    refineCore: { onFinish, query },
    ...form
  } = useForm({
    defaultValues: INTAKE_DEFAULT_VALUES as unknown as IntakeFormValues,
    // Báo lỗi khi rời ô (mẫu chốt: gõ sai là thấy ngay), không đợi bấm Lưu.
    mode: "onTouched",
    // Đưa chứng từ LÊN đầu phiếu NGAY TRONG dữ liệu truy vấn (`toFormValues`): Refine tự `reset` form bằng dữ liệu
    // này, nên làm ở một effect riêng thì bị lần reset của Refine ghi đè.
    refineCoreProps: {
      redirect: false,
      queryOptions: { select: (res: any) => ({ ...res, data: toFormValues(res.data) }) },
    },
  });

  const record = query?.data?.data as EquipmentIntake | undefined;
  const { reset } = form;

  /**
   * Nạp form bằng `reset` sau khi bản ghi về, như màn sửa danh mục: các ô chọn
   * nằm trong component con và có thể chưa mount lúc Refine nạp lần đầu.
   * `keepDirtyValues` giữ lại thứ vừa gõ khi có một lần refetch nền.
   */
  useEffect(() => {
    if (!record) return;
    reset(record as unknown as IntakeFormValues, { keepDirtyValues: true });
  }, [record, reset]);

  if (query?.isLoading) {
    return (
      <EditView>
        <EditViewHeader />
        <Skeleton className="h-96 w-full" />
      </EditView>
    );
  }

  if (record && record.status !== "DRAFT") {
    return (
      <EditView>
        <EditViewHeader />
        <Alert>
          <Lock className="text-warning-text" />
          <AlertTitle>
            {record.status === "COMPLETED"
              ? "Phiếu đã ghi tăng thiết bị"
              : record.status === "PENDING"
                ? "Phiếu đang chờ duyệt"
                : "Phiếu không còn sửa được"}
          </AlertTitle>
          <AlertDescription>
            <p>
              {record.status === "COMPLETED"
                ? "Phiếu đã ghi tăng thiết bị nên không sửa được nữa."
                : record.status === "PENDING"
                  ? "Phiếu đang chờ duyệt. Người duyệt trả lại thì mới sửa được."
                  : "Phiếu đã huỷ hoặc bị từ chối, không sửa được."}
            </p>
            <Button type="button" variant="outline" size="sm" onClick={() => navigate(-1)}>
              Quay lại phiếu
            </Button>
          </AlertDescription>
        </Alert>
      </EditView>
    );
  }

  // Phiếu nháp của người khác (ngoài phạm vi ghi): không mở form có nút Lưu bấm vào là lỗi — xem ở trang chi tiết.
  if (record?._actions && !record._actions.includes("edit")) {
    return <Navigate to={showUrl("equipment_intakes", record.id)} replace />;
  }

  return (
    <EditView>
      <Form {...form}>
        <IntakeFormBody record={record} onFinish={onFinish}
          header={(actions) => <EditViewHeader meta={<VoucherStatusBadge status="DRAFT" />} actionsSlot={actions} onBack={() => confirmLeave(() => list("equipment_intakes"))} />} />
      </Form>
    </EditView>
  );
};
