import { Ban, CheckCircle2, CircleDot, CornerUpLeft, History, PackageCheck, Send, XCircle } from "lucide-react";
import type { ReactNode } from "react";

import { useVoucherEvents } from "@/shared/hooks/use-voucher-events";
import { formatDateTime } from "@/shared/lib/format";
import { Timeline, TimelineItem, type TimelineTone } from "@/shared/components/timeline";
import { Badge } from "@/shared/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { APPROVAL_STEP_LABELS, VOUCHER_EVENT_LABELS, type VoucherEventAction } from "@/domains/voucher/types";

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
 * Ai trình, ai duyệt, ai trả lại, nói gì — theo thứ tự thời gian. Đây là câu trả lời cho "phiếu này
 * đang ở đâu và vì sao". Lời nhắn khi trả lại được hiện nguyên văn, vì đó là thứ người lập cần đọc
 * để sửa.
 */
function TimelineBody({ resource, id }: { resource: string; id: number | undefined }) {
  const { data, isLoading } = useVoucherEvents(resource, id);
  const events = Array.isArray(data) ? data : [];
  if (isLoading) return <p className="text-muted-foreground text-sm">Đang tải…</p>;
  if (events.length === 0) {
    return (
      <p className="text-muted-foreground flex items-center gap-2 text-sm">
        <CircleDot className="size-4" />
        Phiếu còn là nháp, chưa trình lần nào.
      </p>
    );
  }
  return (
    <Timeline>
      {events.map((event) => (
        <TimelineItem
          key={event.id}
          icon={ICON[event.action]}
          tone={TONE[event.action]}
          title={
            <>
              {VOUCHER_EVENT_LABELS[event.action]}
              {event.step ? <Badge variant="neutral">{APPROVAL_STEP_LABELS[event.step]}</Badge> : null}
            </>
          }
          time={formatDateTime(event.createdAt)}
          by={event.actorName ?? "Hệ thống"}
        >
          {event.note ? <p className="mt-1 text-sm whitespace-pre-line">{event.note}</p> : null}
        </TimelineItem>
      ))}
    </Timeline>
  );
}

/** Quá trình duyệt trong một thẻ cố định của màn chi tiết. */
export function VoucherTimeline({ resource, id }: { resource: string; id: number | undefined }) {
  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <History className="text-muted-foreground size-4" />
          Quá trình duyệt
        </CardTitle>
      </CardHeader>
      <CardContent>
        <TimelineBody resource={resource} id={id} />
      </CardContent>
    </Card>
  );
}

/** Quá trình duyệt trong HỘP THOẠI — `VoucherShowShell` mở từ thẻ tóm tắt hoặc menu ⚙. */
export function VoucherTimelineDialog({ resource, id, open, onOpenChange }: {
  resource: string;
  id: number | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] gap-5 overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="text-muted-foreground size-4" />
            Quá trình duyệt
          </DialogTitle>
          <DialogDescription className="sr-only">Ai đã làm gì với phiếu, vào lúc nào.</DialogDescription>
        </DialogHeader>
        <TimelineBody resource={resource} id={id} />
      </DialogContent>
    </Dialog>
  );
}

/** Số lần phiếu đổi trạng thái — cho nhãn nút mở hộp thoại. Cùng khoá truy vấn với danh sách, không tốn thêm request. */
export function useVoucherEventCount(resource: string, id: number | undefined): number | undefined {
  const { data } = useVoucherEvents(resource, id);
  return Array.isArray(data) ? data.length : undefined;
}
