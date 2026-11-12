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

/** Dự án chỉ có phiếu nhập, nên chỉ có một nhóm chênh lệch lập nhanh được: tài sản thừa. */
type Kind = "SURPLUS";

/** `GET /inventory_sessions/{id}/follow-ups` — mỗi nhóm chênh lệch: số biên bản ghi, số còn chưa có phiếu. */
type FollowUpState = { kind: Kind; resource: string; total: number; pending: number };

const TEXT: Record<Kind, { finding: string; action: string; route: string }> = {
  SURPLUS: { finding: "tài sản thừa", action: "Lập phiếu ghi tăng", route: "/equipment-intakes" },
};

function Row({ sessionId, state }: { sessionId: number; state: FollowUpState }) {
  const may = useCan({ resource: state.resource, action: "create" }).data?.can ?? false;
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const client = useQueryClient();
  const { open } = useNotification();
  const text = TEXT[state.kind];

  const create = async () => {
    setBusy(true);
    try {
      const result = await kyInstance
        .post(`inventory_sessions/${sessionId}/follow-ups`, { searchParams: { kind: state.kind } })
        .json<{ resource: string; ids: number[] }>();
      await client.invalidateQueries({ queryKey: ["inventory_follow_ups", sessionId] });
      // Một phiếu: mở luôn để sửa / bớt dòng rồi trình.
      if (result.ids.length === 1) {
        navigate(`${text.route}/edit/${result.ids[0]}`);
      } else {
        open?.({ type: "success", message: `Đã lập ${result.ids.length} phiếu nháp` });
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
          {state.pending === 0 ? "Đã có phiếu cho tất cả" : "Chưa lập phiếu nào"}
        </div>
      </div>
      {may && state.pending > 0 ? (
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={create}>
          {busy ? <Loader2 className="animate-spin" /> : <FilePlus2 />}
          {text.action}
        </Button>
      ) : null}
    </li>
  );
}

/**
 * Biên bản kiểm kê chỉ ghi nhận; xử lý chênh lệch là việc của người dùng (KK-06). Khối này giúp LẬP NHANH: bấm là có
 * phiếu nháp mang sẵn các tài sản chưa có phiếu (nguồn = biên bản này). Chỉ hiện khi biên bản đã duyệt và có chênh
 * lệch cần phiếu.
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
        title="Nghiệp vụ đề xuất"
        hint="Biên bản kiểm kê chỉ ghi nhận kết quả, không tự sửa sổ. Bấm nút để lập phiếu ghi tăng nháp có sẵn các tài sản thừa, sửa lại rồi trình."
      />
      <ul className="divide-y rounded-md border text-sm">
        {data.map((state) => <Row key={state.kind} sessionId={sessionId} state={state} />)}
      </ul>
    </Card>
  );
}
