import { useCan, useNotification } from "@refinedev/core";
import { useQueryClient } from "@tanstack/react-query";
import { LockKeyhole } from "lucide-react";
import { useState } from "react";

import { kyInstance } from "@/shared/api/data";
import { OPENING_BALANCE_KEY as KEY, useOpeningBalance, type OpeningBalanceState } from "@/shared/hooks/use-opening-balance";
import { ConfirmContent } from "@/shared/components/confirm/confirm-content";
import { errorMessage } from "@/shared/lib/api-error";
import { formatDate } from "@/shared/lib/format";
import { AlertDialog } from "@/shared/ui/alert-dialog";
import { Button } from "@/shared/ui/button";

/**
 * Nút "Chốt số dư đầu kỳ" cho lãnh đạo trường (quyền duyệt ghi tăng): chốt một lần, không mở lại. Đã chốt thì nút
 * thành dòng chữ nói ngày chốt — để ai cũng biết vì sao không còn lối nhập thiết bị đang có từ tệp.
 */
export function OpeningBalanceButton() {
  const { data } = useOpeningBalance();
  const canApprove = useCan({ resource: "equipment_intakes", action: "approve" }).data?.can ?? false;
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const { open: notify } = useNotification();
  const queryClient = useQueryClient();

  if (!data) return null;
  if (data.closedAt) {
    return (
      <span className="text-muted-foreground inline-flex items-center gap-1.5 text-sm"
        title={`Khoá ngày ${formatDate(data.closedAt)}${data.closedBy ? ` bởi ${data.closedBy}` : ""}, lúc khoá có ${data.equipmentCount ?? 0} thiết bị. Từ ngày này thiết bị mới chỉ vào sổ qua phiếu ghi tăng.`}>
        <LockKeyhole className="size-4" />Đã khoá khai thiết bị ban đầu
      </span>
    );
  }
  if (!canApprove) return null;

  async function close() {
    setBusy(true);
    try {
      const next = await kyInstance.post("equipment/opening-balance/close").json<OpeningBalanceState>();
      queryClient.setQueryData(KEY, next);
      notify?.({ type: "success", message: `Đã khoá khai thiết bị ban đầu: ${next.equipmentCount ?? 0} thiết bị` });
      setOpen(false);
    } catch (error) {
      notify?.({ type: "error", message: await errorMessage(error) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        <LockKeyhole />Chốt số dư đầu kỳ
      </Button>
      <ConfirmContent
        tone="warning"
        icon={<LockKeyhole />}
        title="Chốt số dư đầu kỳ của trường?"
        description={
          <>
            Trường đang có <b>{data.equipmentNow}</b> thiết bị trên sổ. Sau khi chốt, không khai thêm hay nhập thiết bị đang có
            từ tệp được nữa: thiết bị mới chỉ vào sổ qua phiếu ghi tăng do lãnh đạo trường duyệt. Chốt một lần, không mở lại.
          </>
        }
        cancelLabel="Chưa chốt"
        confirmLabel="Chốt số dư"
        onConfirm={() => void close()}
        busy={busy}
        keepOpen
      />
    </AlertDialog>
  );
}

export { useOpeningBalance, type OpeningBalanceState };
