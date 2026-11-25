import { useCan, useNotification } from "@refinedev/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FilePlus2, Loader2 } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";

import { kyInstance } from "@/shared/api/data";
import { StepTitle } from "@/shared/components/voucher/voucher-layout";
import { errorMessage } from "@/shared/lib/api-error";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { VOUCHER_ROUTES } from "@/domains/equipment/types";

type Kind = "SURPLUS";

/** `GET /inventory_sessions/{id}/follow-ups` — mỗi nhóm chênh lệch: số biên bản ghi, số còn chưa có phiếu. */
type FollowUpState = { kind: Kind; resource: string; total: number; pending: number };

const TEXT: Record<Kind, { finding: string; action: string }> = {
  SURPLUS: { finding: "thiết bị thừa", action: "Lập phiếu ghi tăng" },
};

function Row({ sessionId, state }: { sessionId: number; state: FollowUpState }) {
  const may = useCan({ resource: state.resource, action: "create" }).data?.can ?? false;
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const client = useQueryClient();
  const { open } = useNotification();
  const text = TEXT[state.kind];
  const done = state.total - state.pending;

  const create = async () => {
    setBusy(true);
    try {
      const result = await kyInstance
        .post(`inventory_sessions/${sessionId}/follow-ups`, { searchParams: { kind: state.kind } })
        .json<{ resource: string; ids: number[] }>();
      await client.invalidateQueries({ queryKey: ["inventory_follow_ups", sessionId] });
      await client.invalidateQueries({ queryKey: ["voucher_links", "inventory_sessions", sessionId] });
      const route = VOUCHER_ROUTES[result.resource];
      if (result.ids.length === 1 && route) {
        // Một phiếu: mở luôn để sửa / bớt dòng rồi trình.
        navigate(`${route}/edit/${result.ids[0]}`);
      } else {
        open?.({ type: "success", message: `Đã lập ${result.ids.length} phiếu nháp — xem ở khối Phiếu liên quan` });
      }
    } catch (error) {
      open?.({ type: "error", message: await errorMessage(error) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="font-medium">
          <span className="tabular-nums">{state.total}</span> {text.finding}
        </div>
        <div className="text-muted-foreground text-xs">
          {state.pending === 0
            ? "Đã có phiếu cho tất cả"
            : done > 0
              ? `${done} đã có phiếu, còn ${state.pending} chưa có`
              : "Chưa lập phiếu nào"}
        </div>
      </div>
      {may && state.pending > 0 ? (
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={create}>
          {busy ? <Loader2 className="animate-spin" /> : <FilePlus2 />}
          {text.action}
          {done > 0 && state.kind !== "SURPLUS" ? ` (${state.pending})` : ""}
        </Button>
      ) : null}
    </li>
  );
}

/**
 * Thiết bị thừa sau kiểm kê: duyệt biên bản đã tự lập phiếu ghi tăng nháp; nếu phiếu đó bị huỷ thì nút ở đây lập lại.
 * Thiếu, sai vị trí không có phiếu — duyệt biên bản ghi thẳng vào hồ sơ thiết bị (KK-06).
 */
export function InventoryFollowUps({ sessionId, approved }: { sessionId?: number; approved: boolean }) {
  const { data } = useQuery({
    queryKey: ["inventory_follow_ups", sessionId],
    queryFn: ({ signal }) => kyInstance.get(`inventory_sessions/${sessionId}/follow-ups`, { signal }).json<FollowUpState[]>(),
    enabled: !!sessionId && approved,
  });
  if (!sessionId || !approved || !data?.length) {
    return null;
  }
  return (
    <Card className="gap-3 px-4 py-4">
      <StepTitle
        title="Thiết bị thừa"
        hint={
          <>
            Thiếu, sai vị trí đã được ghi vào hồ sơ thiết bị khi duyệt biên bản. Thiết bị thừa thì lập phiếu ghi tăng
            nháp (nguồn "Kiểm kê thừa"), bổ sung thông tin rồi trình.
          </>
        }
      />
      <ul className="divide-y rounded-md border text-sm">
        {data.map((state) => <Row key={state.kind} sessionId={sessionId} state={state} />)}
      </ul>
    </Card>
  );
}
