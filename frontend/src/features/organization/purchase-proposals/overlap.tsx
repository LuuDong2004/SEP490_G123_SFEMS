import { useQuery } from "@tanstack/react-query";
import { TriangleAlert } from "lucide-react";
import { Fragment, useMemo } from "react";
import { Link } from "react-router";

import { kyInstance } from "@/shared/api/data";
import { cn } from "@/shared/lib/utils";
import type { ProposalOverlap } from "@/domains/procurement/types";
import { voucherStatusText } from "@/domains/voucher/types";

/**
 * Thiết bị đã có trong đề xuất khác. Chỉ CẢNH BÁO, không chặn: trường có lý do xin thêm (phiếu trước
 * bị cắt số lượng…), và người duyệt cũng thấy cùng lời nhắc để quyết định duyệt hay trả lại.
 */

/** Theo thiết bị: những đề xuất còn hiệu lực KHÁC của trường đang xin nó. */
export type OverlapIndex = Map<number, ProposalOverlap[]>;

export function useProposalOverlaps(schoolId: number | null | undefined, excludeId?: number, enabled = true) {
  const { data } = useQuery({
    queryKey: ["purchase_proposals", "overlaps", schoolId ?? null, excludeId ?? null],
    enabled,
    queryFn: () => {
      const searchParams: Record<string, string> = {};
      if (schoolId != null) searchParams.schoolId = String(schoolId);
      if (excludeId != null) searchParams.excludeId = String(excludeId);
      return kyInstance.get("purchase_proposals/overlaps", { searchParams }).json<ProposalOverlap[]>();
    },
  });
  return useMemo(() => {
    const index: OverlapIndex = new Map();
    for (const o of data ?? []) {
      const list = index.get(o.catalogId) ?? [];
      list.push(o);
      index.set(o.catalogId, list);
    }
    return index;
  }, [data]);
}

/** Tổng số lượng các đề xuất khác đang xin cho một thiết bị. */
export const overlapQuantity = (list: ProposalOverlap[] | undefined) =>
  (list ?? []).reduce((sum, o) => sum + o.quantity, 0);

export const overlapName = (o: ProposalOverlap) => o.code ?? `phiếu nháp #${o.proposalId}`;

/** "MS-2026-00003 (1 Bộ, chờ lãnh đạo trường duyệt)" — một phiếu trong câu cảnh báo. */
function OverlapLink({ o, newTab }: { o: ProposalOverlap; newTab?: boolean }) {
  const state = voucherStatusText(o.status, o.approvalStep, o.returned).toLowerCase();
  return (
    <>
      <Link
        to={`/purchase-proposals/show/${o.proposalId}`}
        target={newTab ? "_blank" : undefined}
        rel={newTab ? "noreferrer" : undefined}
        className="font-medium underline-offset-2 hover:underline"
        onClick={(e) => e.stopPropagation()}
      >
        {overlapName(o)}
      </Link>
      <span>
        {" "}
        ({o.quantity}
        {o.unitName ? ` ${o.unitName}` : ""}, {state})
      </span>
    </>
  );
}

/**
 * Dòng chữ vàng dưới một thiết bị: "Đã có trong MS-2026-00003 (1 Bộ, chờ duyệt)". `newTab` dùng trên
 * form, để mở phiếu kia không làm mất phiếu đang lập. `duplicateOf` là dòng khác của CHÍNH phiếu này
 * đã có cùng thiết bị.
 */
export function OverlapNote({ list, duplicateOf, newTab, className }: {
  list: ProposalOverlap[] | undefined;
  duplicateOf?: number;
  newTab?: boolean;
  className?: string;
}) {
  if (!list?.length && duplicateOf == null) return null;
  return (
    <div className={cn("text-warning-text flex items-start gap-1.5 text-xs", className)}>
      <TriangleAlert className="mt-px size-3.5 shrink-0" />
      <span>
        {duplicateOf != null ? <span>Trùng với dòng {duplicateOf} của phiếu này. </span> : null}
        {list?.length ? (
          <>
            Đã có trong{" "}
            {list.map((o, i) => (
              <Fragment key={o.proposalId}>
                {i > 0 ? ", " : null}
                <OverlapLink o={o} newTab={newTab} />
              </Fragment>
            ))}
          </>
        ) : null}
      </span>
    </div>
  );
}

/** Thẻ bên phải của form: "2 thiết bị đã có trong đề xuất khác" — chỉ nhắc, nút Trình vẫn bấm được. */
export function OverlapSummary({ count }: { count: number }) {
  if (!count) return null;
  return (
    <div className="text-warning-text mt-2 flex items-start gap-2 text-sm">
      <TriangleAlert className="mt-0.5 size-4 shrink-0" />
      <span>
        {count} thiết bị đã có trong đề xuất khác. Xem lại để không xin trùng — vẫn trình được nếu cần
        xin thêm.
      </span>
    </div>
  );
}
