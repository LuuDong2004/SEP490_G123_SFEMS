import { CheckCircle2, CircleDot, CornerUpLeft, Ban, History, Send, XCircle, PackageCheck } from "lucide-react";
import type { ReactNode } from "react";

import { useVoucherEvents } from "@/shared/hooks/use-voucher-events";
import { formatDateTime } from "@/shared/lib/format";
import { Timeline, TimelineItem, type TimelineTone } from "@/shared/components/timeline";
import { Badge } from "@/shared/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import {
  APPROVAL_STEP_LABELS,
  VOUCHER_EVENT_LABELS,
  type VoucherEventAction,
} from "@/domains/voucher/types";
import { LoadingText } from "@/shared/components/spinner";

const ICON: Record<VoucherEventAction, ReactNode> = {
  SUBMIT: <Send />,
  APPROVE: <CheckCircle2 />,
  RETURN: <CornerUpLeft />,
  REJECT: <XCircle />,
  CANCEL: <Ban />,
  COMPLETE: <PackageCheck />,
};

const TONE: Record<VoucherEventAction, TimelineTone> = {
  SUBMIT: "info",
  APPROVE: "success",
  RETURN: "warning",
  REJECT: "destructive",
  CANCEL: "neutral",
  COMPLETE: "success",
};

/**
 * Ai trình, ai duyệt, ai trả lại, nói gì — theo thứ tự thời gian.
 *
 * <p>Đây là câu trả lời cho "phiếu này đang ở đâu và vì sao", và là vết mà HSMT
 * đòi cho thao tác phê duyệt. Lời nhắn khi trả lại được hiện nguyên văn, vì đó
 * là thứ người lập cần đọc để sửa.
 */
/**
 * Chữ riêng của một loại phiếu cho phần quá trình — phiếu không qua duyệt không gọi là
 * "Quá trình duyệt". Thiếu ô nào thì dùng chữ mặc định.
 */
export type TimelineWording = {
  /** Tên phần: mặc định "Quá trình duyệt". */
  title?: string;
  /** Nhãn mốc gửi trên thẻ tóm tắt: mặc định "Trình lúc". */
  submittedAt?: string;
  /** Khi chưa có bước nào: mặc định "Chưa trình lần nào". */
  notSubmitted?: string;
  /** Tên từng việc trên dòng thời gian, đè lên `VOUCHER_EVENT_LABELS`. */
  events?: Partial<Record<VoucherEventAction, string>>;
};

export const DEFAULT_TIMELINE_WORDING = {
  title: "Quá trình duyệt",
  submittedAt: "Trình lúc",
  notSubmitted: "Chưa trình lần nào",
} as const;

/** Danh sách sự kiện — dùng trong thẻ, hoặc thẳng trong hộp thoại. */
function TimelineBody({ resource, id, wording }: { resource: string; id: number | undefined; wording?: TimelineWording }) {
  const { data, isLoading } = useVoucherEvents(resource, id);
  const events = Array.isArray(data) ? data : [];
  return (
    <>
    {isLoading ? (
      <LoadingText />
    ) : events.length === 0 ? (
      <p className="text-muted-foreground flex items-center gap-2 text-sm">
        <CircleDot className="size-4" />
        Phiếu còn là nháp, {(wording?.notSubmitted ?? DEFAULT_TIMELINE_WORDING.notSubmitted).toLowerCase()}.
      </p>
    ) : (
      <Timeline>
        {events.map((event) => (
          <TimelineItem
            key={event.id}
            icon={ICON[event.action]}
            tone={TONE[event.action]}
            title={
              <>
                {wording?.events?.[event.action] ?? VOUCHER_EVENT_LABELS[event.action]}
                {/* Bước duyệt là nhãn nhỏ cạnh việc, không phải một cụm chữ trong ngoặc lẫn vào tên người. */}
                {event.step ? <Badge variant="neutral">{APPROVAL_STEP_LABELS[event.step]}</Badge> : null}
              </>
            }
            time={formatDateTime(event.createdAt)}
            by={event.actorName ?? "Hệ thống"}
          >
            {/* Lời nhắn khi trả lại / từ chối hiện nguyên văn: đó là thứ người lập cần đọc để sửa. */}
            {/* Lời nhắn là chữ thường dưới tên người làm — đóng khung thì trông như một ô nhập. */}
            {event.note ? <p className="mt-1 text-sm whitespace-pre-line">{event.note}</p> : null}
          </TimelineItem>
        ))}
      </Timeline>
    )}
    </>
  );
}

/**
 * Quá trình duyệt trong HỘP THOẠI — cho màn không muốn dành một thẻ cố định cho nó (phiếu nhập:
 * mở từ nút cạnh trạng thái hoặc từ menu ⚙, như "Lịch sử tài sản" của hồ sơ thiết bị).
 */
export function VoucherTimelineDialog({ resource, id, open, onOpenChange, wording }: {
  resource: string;
  id: number | undefined;
  wording?: TimelineWording;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-5 overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="text-muted-foreground size-4" />
            {wording?.title ?? DEFAULT_TIMELINE_WORDING.title}
          </DialogTitle>
          <DialogDescription className="sr-only">Ai đã làm gì với phiếu, vào lúc nào.</DialogDescription>
        </DialogHeader>
        <TimelineBody resource={resource} id={id} wording={wording} />
      </DialogContent>
    </Dialog>
  );
}

/** Số lần phiếu đổi trạng thái — cho nhãn nút mở hộp thoại. Cùng khoá truy vấn với danh sách, không tốn thêm request. */
export function useVoucherEventCount(resource: string, id: number | undefined): number | undefined {
  const { data } = useVoucherEvents(resource, id);
  return Array.isArray(data) ? data.length : undefined;
}
