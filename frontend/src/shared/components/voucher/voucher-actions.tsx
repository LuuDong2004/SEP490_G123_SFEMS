import { useInvalidate, useNavigation, useNotification } from "@refinedev/core";
import { useQueryClient } from "@tanstack/react-query";
import { Ban, CheckCircle2, CornerUpLeft, PackageCheck, Send, XCircle } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { kyInstance } from "@/shared/api/data";
import { DeleteButton } from "@/shared/components/buttons/delete";
import { EditButton } from "@/shared/components/buttons/edit";
import { ConfirmContent } from "@/shared/components/confirm/confirm-content";
import { errorMessage } from "@/shared/lib/api-error";
import { AlertDialog } from "@/shared/ui/alert-dialog";
import { Button } from "@/shared/ui/button";
import { Label } from "@/shared/ui/label";
import { Textarea } from "@/shared/ui/textarea";
import type { VoucherAction, VoucherBase } from "@/domains/voucher/types";

type WorkflowAction = "submit" | "approve" | "return" | "reject" | "cancel" | "complete";

export type ActionText = {
  label: string;
  title: string;
  description: ReactNode;
  confirm: string;
  done: string;
  /** Lời nhắn: không hỏi, hỏi nhưng không bắt buộc, hay bắt buộc. */
  note?: "optional" | "required";
  noteLabel?: string;
};

const DEFAULT_TEXT: Record<WorkflowAction, ActionText> = {
  submit: {
    label: "Trình duyệt",
    title: "Trình phiếu lên duyệt?",
    description: "Phiếu được chuyển tới người duyệt. Trong lúc chờ duyệt thì không sửa được.",
    confirm: "Trình duyệt",
    done: "Đã trình phiếu",
  },
  approve: {
    label: "Duyệt",
    title: "Duyệt phiếu?",
    description: "Phiếu sang bước duyệt tiếp theo, hoặc xong nếu đây là bước cuối.",
    confirm: "Duyệt",
    done: "Đã duyệt phiếu",
    note: "optional",
    noteLabel: "Ý kiến (không bắt buộc)",
  },
  return: {
    label: "Trả lại",
    title: "Trả phiếu về người lập?",
    description: "Người lập sẽ sửa rồi trình lại. Số phiếu giữ nguyên.",
    confirm: "Trả lại",
    done: "Đã trả phiếu về người lập",
    note: "required",
    noteLabel: "Cần sửa gì",
  },
  reject: {
    label: "Từ chối",
    title: "Từ chối phiếu?",
    description: "Phiếu dừng hẳn, không trình lại được. Dữ liệu vẫn như trước khi lập phiếu.",
    confirm: "Từ chối",
    done: "Đã từ chối phiếu",
    note: "required",
    noteLabel: "Lý do từ chối",
  },
  cancel: {
    label: "Huỷ phiếu",
    title: "Huỷ phiếu nháp?",
    description: 'Phiếu không bị xoá, vẫn nằm trong danh sách với trạng thái "Đã huỷ".',
    confirm: "Huỷ phiếu",
    done: "Đã huỷ phiếu",
    note: "optional",
    noteLabel: "Lý do (không bắt buộc)",
  },
  complete: {
    label: "Hoàn tất",
    title: "Hoàn tất phiếu?",
    description: "Sau đó phiếu không sửa được nữa.",
    confirm: "Hoàn tất",
    done: "Đã hoàn tất phiếu",
    note: "optional",
    noteLabel: "Ghi chú (không bắt buộc)",
  },
};

/** Chữ của nút "trình" khi phiếu KHÔNG qua cấp duyệt nào (`submit_direct`): bấm là hệ thống ghi nhận và khoá phiếu. */
const DIRECT_SUBMIT_TEXT: ActionText = {
  label: "Duyệt",
  title: "Duyệt phiếu?",
  description: "Phiếu này không cần trình lên cấp trên. Duyệt xong hệ thống ghi nhận ngay và phiếu không sửa được nữa.",
  confirm: "Duyệt",
  done: "Đã duyệt, hệ thống đã ghi nhận phiếu",
};

const ICONS: Record<WorkflowAction, ReactNode> = {
  submit: <Send />,
  approve: <CheckCircle2 />,
  return: <CornerUpLeft />,
  reject: <XCircle />,
  cancel: <Ban />,
  complete: <PackageCheck />,
};

/** Việc của phiếu mà màn có menu ⚙ đưa vào menu thay vì để thành nút. */
export type TuckedAction = "cancel" | "delete";

/**
 * Cụm nút của vòng duyệt, dùng chung cho mọi loại phiếu.
 *
 * Nút nào hiện là do SERVER nói (`_actions`), không phải màn hình tự suy ra từ trạng thái: chỉ server
 * biết người đang xem có đúng là người thuộc cấp đang chờ duyệt không.
 *
 * @param text        thay câu chữ cho loại phiếu cụ thể — vd. approve: { label: "Duyệt và ghi tăng" }
 * @param invalidates tài nguyên khác cần làm mới sau khi phiếu đổi trạng thái (thiết bị...)
 * @param tucked      màn có menu ⚙ thì Huỷ phiếu và Xoá nằm trong menu đó; menu báo việc được chọn qua
 *                    `request` và cụm này mở đúng hộp hỏi lại như khi bấm nút.
 */
export function VoucherActions({
  resource,
  record,
  text,
  invalidates = [],
  hide = [],
  tucked,
}: {
  resource: string;
  record: VoucherBase | undefined;
  text?: Partial<Record<WorkflowAction, Partial<ActionText>>>;
  invalidates?: string[];
  hide?: VoucherAction[];
  tucked?: { request: TuckedAction | null; clear: () => void };
}) {
  const { open } = useNotification();
  const invalidate = useInvalidate();
  const { list } = useNavigation();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<WorkflowAction | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const deleteButton = useRef<HTMLButtonElement>(null);
  const request = tucked?.request ?? null;
  const clearRequest = tucked?.clear;
  useEffect(() => {
    if (!request) return;
    if (request === "cancel") {
      setNote("");
      setPending("cancel");
    } else {
      // Nút Xoá vẫn là `DeleteButton` (quyền, hộp hỏi lại, điều hướng sau khi xoá đều của nó) — chỉ ẩn đi.
      deleteButton.current?.click();
    }
    clearRequest?.();
  }, [request, clearRequest]);

  if (!record) return null;
  const allowed = new Set((record._actions ?? []).filter((a) => !hide.includes(a)));
  const direct = allowed.has("submit_direct");
  const texts = (action: WorkflowAction): ActionText => ({
    ...(action === "submit" && direct ? DIRECT_SUBMIT_TEXT : DEFAULT_TEXT[action]),
    ...text?.[action],
  });
  const current = pending ? texts(pending) : null;

  async function run(action: WorkflowAction) {
    if (!record) return;
    const t = texts(action);
    if (t.note === "required" && !note.trim()) {
      open?.({ type: "error", message: `Hãy ghi ${t.noteLabel?.toLowerCase() ?? "lời nhắn"}` });
      return;
    }
    setBusy(true);
    try {
      await kyInstance.post(`${resource}/${record.id}/${action}`, { json: { note: note.trim() || null } });
      open?.({ type: "success", message: t.done });
      setPending(null);
      setNote("");
      invalidate({ resource, invalidates: ["list", "detail"], id: record.id });
      for (const other of invalidates) invalidate({ resource: other, invalidates: ["list"] });
      queryClient.invalidateQueries({ queryKey: ["voucher_events", resource, record.id] });
    } catch (error) {
      open?.({ type: "error", message: await errorMessage(error), description: "Không thực hiện được" });
    } finally {
      setBusy(false);
    }
  }

  const button = (action: WorkflowAction, variant: "default" | "outline" | "destructive" = "outline") =>
    allowed.has(action) ? (
      <Button
        key={action}
        type="button"
        variant={variant}
        disabled={busy}
        onClick={() => {
          setNote("");
          setPending(action);
        }}
      >
        {ICONS[action]}
        {texts(action).label}
      </Button>
    ) : null;

  return (
    <>
      {tucked ? null : button("cancel")}
      {allowed.has("edit") ? <EditButton variant="outline" recordItemId={record.id} /> : null}
      {allowed.has("delete") ? (
        <DeleteButton
          ref={deleteButton}
          variant="outline"
          className={tucked ? "hidden" : "text-destructive hover:bg-destructive hover:text-destructive-foreground"}
          recordItemId={record.id}
          record={record}
          noun="phiếu"
          // Màn này nói về đúng phiếu vừa xoá: ở lại là đứng trên một bản ghi không còn.
          onSuccess={() => list(resource, "replace")}
        />
      ) : null}
      {button("submit", "default")}
      {button("reject")}
      {button("return")}
      {button("approve", "default")}
      {button("complete", "default")}

      <AlertDialog open={pending !== null} onOpenChange={(o) => !o && setPending(null)}>
        <ConfirmContent
          tone={pending === "reject" || pending === "cancel" ? "danger" : pending === "return" ? "warning" : "neutral"}
          icon={pending ? ICONS[pending] : undefined}
          title={current?.title}
          description={current?.description}
          cancelLabel={pending === "cancel" ? "Giữ phiếu" : "Chưa, để sau"}
          confirmLabel={current?.confirm}
          busy={busy}
          keepOpen
          onConfirm={() => {
            if (pending) void run(pending);
          }}
        >
          {current?.note ? (
            <div className="space-y-2">
              <Label htmlFor="voucher-note">
                {current.noteLabel}
                {current.note === "required" ? <span className="text-destructive"> *</span> : null}
              </Label>
              <Textarea id="voucher-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
          ) : null}
        </ConfirmContent>
      </AlertDialog>
    </>
  );
}
