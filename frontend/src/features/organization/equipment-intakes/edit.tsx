/* eslint-disable @typescript-eslint/no-explicit-any -- bản ghi phiếu cũ đọc cả trường đầu phiếu lẫn trường dòng. */
import { useForm } from "@refinedev/react-hook-form";
import { Lock } from "lucide-react";
import { useEffect } from "react";
import { useNavigate } from "react-router";

import { InventoryFreezeNotice } from "@/shared/components/voucher/inventory-freeze-notice";
import { EditView, EditViewHeader } from "@/shared/components/views/edit-view";
import { IntakeFormBody } from "./form-body";
import { VoucherStatusBadge } from "@/shared/components/voucher/voucher-status";
import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/alert";
import { Button } from "@/shared/ui/button";
import { Form } from "@/shared/ui/form";
import { Skeleton } from "@/shared/ui/skeleton";
import type { EquipmentIntake } from "@/domains/equipment-intake/types";
import {
  INTAKE_DEFAULT_VALUES,
  type IntakeFormValues,
} from "@/features/organization/equipment-intakes/fields";

/**
 * Sửa một phiếu NHÁP.
 *
 * <p>Phiếu đã xác nhận thì màn này không hiện form: nó nói ra lý do và dẫn về
 * chi tiết. API cũng từ chối, nhưng để người dùng gõ xong cả phiếu rồi mới bị
 * từ chối là bắt họ làm một việc mà kết quả đã biết trước.
 */
/**
 * Phiếu lập trước khi chứng từ đi theo dòng (và phiếu nháp sinh tự động từ đề xuất mua sắm) còn
 * mang nhà cung cấp, hoá đơn, nguồn ở ĐẦU PHIẾU. Chép chúng xuống từng dòng chưa có, và xoá ở đầu
 * phiếu những gì PATCH xoá được — để thứ hiện trên màn đúng là thứ được lưu, không còn giá trị
 * ẩn nào ở đầu phiếu âm thầm lấp vào dòng. (Nguồn kinh phí, ngày hoá đơn, bảo hành ở đầu phiếu
 * không xoá được qua PATCH — null là "để nguyên" — nhưng dòng đã mang giá trị riêng nên chúng
 * không còn tác dụng.)
 */
function withLineDocuments(record: EquipmentIntake) {
  const head = record as any;
  const lines = (record.lines ?? []).map((l: any) => ({
    ...l,
    supplier: l.supplier ?? head.supplier ?? null,
    documentNo: l.documentNo ?? head.documentNo ?? null,
    documentDate: l.documentDate ?? head.documentDate ?? null,
    fundingSource: l.fundingSource ?? null,
    acquisitionMethod: l.acquisitionMethod ?? { id: null },
    warrantyMonths: l.warrantyMonths ?? head.warrantyMonths ?? null,
    packUnit: l.packUnit ?? { id: null },
  }));
  // Biên bản giao nhận đi qua `details` (cùng khoá với máy chủ); bỏ các cột cùng nghĩa của bản ghi để form không gửi
  // lên hai bản của cùng một ô.
  const rest: Record<string, unknown> = { ...(record as any) };
  for (const key of ["deliverer", "delivererRepresentative", "receiver", "receiverPosition", "inspectionResult", "handoverNo"]) {
    delete rest[key];
  }
  return {
    ...rest,
    supplier: "",
    documentNo: "",
    // Nguồn hình thành Ở LẠI đầu phiếu (một phiếu một nguồn) — không chép xuống dòng như chứng từ.
    originSource: head.originSource ?? { id: null },
    originNote: head.originNote ?? "",
    // Hình thức mua sắm của phiếu ở lại đầu phiếu (dòng để trống = theo phiếu); phần ghi rõ của nó nằm ở
    // các dòng theo phiếu, nên đọc ngược từ dòng đầu tiên như thế.
    acquisitionMethod: head.acquisitionMethod ?? { id: null },
    acquisitionNoteHead: (record.lines ?? []).find((l: any) => !l.acquisitionMethod && l.acquisitionNote)?.acquisitionNote ?? "",
    lines,
  };
}

export const EquipmentIntakeEdit = () => {
  const navigate = useNavigate();
  const {
    refineCore: { onFinish, query },
    ...form
  } = useForm({
    defaultValues: INTAKE_DEFAULT_VALUES as unknown as IntakeFormValues,
    // Chép chứng từ đầu phiếu xuống dòng NGAY TRONG dữ liệu truy vấn: Refine tự `reset` form bằng
    // dữ liệu này, nên làm ở một effect riêng thì bị lần reset của Refine ghi đè.
    refineCoreProps: {
      redirect: "show",
      queryOptions: { select: (res: any) => ({ ...res, data: withLineDocuments(res.data) }) },
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
              ? "Phiếu đã ghi tăng tài sản"
              : record.status === "PENDING"
                ? "Phiếu đang chờ duyệt"
                : "Phiếu không còn sửa được"}
          </AlertTitle>
          <AlertDescription>
            <p>
              {record.status === "COMPLETED"
                ? "Phiếu đã ghi tăng tài sản nên không sửa được nữa."
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

  return (
    <EditView>
      <EditViewHeader
        meta={<VoucherStatusBadge status="DRAFT" />}
      />
      <InventoryFreezeNotice resource="equipment_intakes" />
      <Form {...form}>
        <IntakeFormBody record={record} onFinish={onFinish} />
      </Form>
    </EditView>
  );
};
