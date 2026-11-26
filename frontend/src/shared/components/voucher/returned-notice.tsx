import { CornerUpLeft } from "lucide-react";

import { APPROVAL_STEP_LABELS } from "@/domains/voucher/types";
import { useVoucherEvents } from "@/shared/hooks/use-voucher-events";
import { formatDateTime } from "@/shared/lib/format";

/**
 * Khối "bị trả lại, cần sửa" đầu màn xem phiếu nháp bị người duyệt trả về. Màu tím — cùng màu nhãn "Bị trả về", khác
 * cam "chờ duyệt" và đỏ "từ chối": việc nằm lại ở người lập, không phải lỗi. Nói ai trả (vai trò, không nêu tên — như
 * dòng "Người duyệt"), lúc nào, và lời nhắn nguyên văn.
 */
export function ReturnedNotice({ resource, id, note, noun = "Phiếu" }: {
  resource: string;
  id: number | undefined;
  note: string;
  /** "Phiếu", "Biên bản"… — chữ đầu câu tiêu đề. */
  noun?: string;
}) {
  const { data: events } = useVoucherEvents(resource, id);
  const last = [...(events ?? [])].reverse().find((e) => e.action === "RETURN");
  const by = last?.step ? APPROVAL_STEP_LABELS[last.step] : null;
  return (
    <section className="border-returned/25 bg-returned-subtle flex gap-3 rounded-xl border p-4">
      <span aria-hidden className="bg-returned flex size-9 shrink-0 items-center justify-center rounded-full text-white [&_svg]:size-4.5">
        <CornerUpLeft />
      </span>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
          <h2 className="text-returned-text font-semibold">{noun} bị trả lại, cần sửa</h2>
          {last ? (
            <span className="text-muted-foreground text-xs">
              {by ? <>{by.charAt(0).toUpperCase() + by.slice(1)} trả lại · </> : "Trả lại · "}
              {formatDateTime(last.createdAt)}
            </span>
          ) : null}
        </div>
        <p className="border-returned text-foreground border-l-[3px] ps-3 text-sm break-words whitespace-pre-line">{note}</p>
      </div>
    </section>
  );
}
