import { useCan, useNotification } from "@refinedev/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Pencil, RotateCcw, Send } from "lucide-react";
import { useEffect, useState } from "react";

import { kyInstance } from "@/shared/api/data";
import { ConfirmContent } from "@/shared/components/confirm/confirm-content";
import { ListView, ListViewHeader } from "@/shared/components/views/list-view";
import { errorMessage } from "@/shared/lib/api-error";
import { formatDateTime } from "@/shared/lib/format";
import { AlertDialog } from "@/shared/ui/alert-dialog";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { maxLengthOf, numberError, textError } from "@/shared/lib/field-rules";
import { Label } from "@/shared/ui/label";
import { Skeleton } from "@/shared/ui/skeleton";
import { Textarea } from "@/shared/ui/textarea";
import type { ApprovalFlow } from "@/domains/approval-flow/types";

import { FlowDesigner, FlowMini, flowSentence, type FlowDraft } from "./flow-designer";

const KEY = ["approval_flows"];
const money = new Intl.NumberFormat("vi-VN");

/** Hộp thiết kế luồng của MỘT loại phiếu: sơ đồ kéo thả, căn cứ, lưu. */
function EditFlowDialog({ flow, onClose }: { flow: ApprovalFlow | null; onClose: () => void }) {
  const [draft, setDraft] = useState<FlowDraft>({ steps: [], threshold: null, above: [] });
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const { open: notify } = useNotification();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!flow) return;
    setDraft({ steps: flow.steps, threshold: flow.amountThreshold, above: flow.stepsAbove ?? [] });
    setNote(flow.note ?? "");
  }, [flow]);

  if (!flow) return null;
  const branched = draft.threshold !== null;
  const thresholdMissing = branched && !(Number(draft.threshold) > 0);
  const sameAsBase = branched && draft.above.join() === draft.steps.join();
  // Cùng luật `ApprovalFlowService` (MONEY cho ngưỡng, NOTE cho ghi chú).
  const thresholdError = branched ? numberError("MONEY", "Ngưỡng tiền", draft.threshold) : undefined;
  const noteError = textError("NOTE", "Căn cứ / ghi chú", note);

  async function save() {
    if (!flow) return;
    setBusy(true);
    try {
      await kyInstance.put(`approval_flows/${flow.resource}`, {
        json: { steps: draft.steps, amountThreshold: branched ? draft.threshold : null, stepsAbove: branched ? draft.above : null, note },
      });
      notify?.({ type: "success", message: `Đã lưu luồng phê duyệt: ${flow.label}` });
      await queryClient.invalidateQueries({ queryKey: KEY });
      onClose();
    } catch (error) {
      notify?.({ type: "error", message: await errorMessage(error), description: "Không lưu được" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent size="wide" className="flex flex-col">
        <DialogHeader>
          <DialogTitle>Thiết kế luồng phê duyệt: {flow.label}</DialogTitle>
          <DialogDescription>
            Bấm “+” trên đường nối hoặc kéo khối vào sơ đồ để thêm bước; rê chuột lên một bước rồi bấm × để bỏ. Ai duyệt ở mỗi cấp là do vai trò và quyền "Duyệt"; đổi luồng có hiệu lực từ lần trình / duyệt kế tiếp.
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-col gap-4">
          <FlowDesigner value={draft} onChange={setDraft} receiving={flow.receivingSupported} amountLabel={flow.amountLabel} />

          {/* Panel cài đặt: ngưỡng tiền, tóm tắt luồng bằng lời, luật luôn áp dụng, căn cứ. */}
          <aside className="grid items-start gap-4 md:grid-cols-3">
            {branched ? (
              <section className="space-y-1.5">
                <Label htmlFor="flow-threshold">{flow.amountLabel} từ</Label>
                <div className="relative">
                  <Input id="flow-threshold" inputMode="numeric" className="pe-8 tabular-nums" placeholder="VD: 10.000.000"
                    value={draft.threshold ? money.format(draft.threshold) : ""}
                    onChange={(e) => setDraft({ ...draft, threshold: Number(e.target.value.replace(/\D/g, "")) || 0 })} />
                  <span className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm">đ</span>
                </div>
                {thresholdError ? <p className="text-destructive text-sm">{thresholdError}</p> : null}
                <p className="text-muted-foreground text-xs">Phiếu từ số tiền này trở lên đi theo nhánh trên.</p>
              </section>
            ) : null}

            <section className="bg-surface-subtle space-y-2 rounded-xl border p-3">
              <h4 className="text-overline text-muted-foreground">Tóm tắt luồng</h4>
              {branched ? (
                <>
                  <p className="text-sm"><span className="text-muted-foreground">Dưới {draft.threshold ? `${money.format(draft.threshold)} đ` : "ngưỡng"}: </span>{flowSentence(draft.steps)}</p>
                  <p className="text-sm"><span className="text-muted-foreground">Từ {draft.threshold ? `${money.format(draft.threshold)} đ` : "ngưỡng"}: </span>{flowSentence(draft.above)}</p>
                </>
              ) : (
                <p className="text-sm">{flowSentence(draft.steps)}</p>
              )}
              {thresholdMissing ? <p className="text-warning-text text-xs">Nhập ngưỡng tiền cho nhánh, hoặc bỏ rẽ nhánh.</p> : null}
              {sameAsBase ? <p className="text-warning-text text-xs">Hai nhánh đang giống hệt nhau — sửa một nhánh, hoặc bỏ rẽ nhánh.</p> : null}
            </section>

            {flow.exemptNote ? (
              <section className="space-y-1">
                <h4 className="text-overline text-muted-foreground">Luôn áp dụng</h4>
                <p className="text-muted-foreground text-xs leading-relaxed">{flow.exemptNote}</p>
              </section>
            ) : null}

            <section className="space-y-1.5">
              <Label htmlFor="flow-note">Căn cứ / ghi chú</Label>
              <Textarea id="flow-note" rows={2} value={note} maxLength={maxLengthOf("NOTE")}
                placeholder="VD: Theo Quyết định số …/QĐ-SGDĐT" onChange={(e) => setNote(e.target.value)} />
              {noteError ? <p className="text-destructive text-sm">{noteError}</p> : null}
            </section>

          </aside>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>Đóng</Button>
          <Button type="button" disabled={busy || thresholdMissing || sameAsBase || !!thresholdError || !!noteError} onClick={() => void save()}>
            <Check />
            Lưu luồng
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Luồng phê duyệt của từng loại phiếu — Sở cấu hình: cấp nào phải duyệt, và tuỳ chọn một ngưỡng tiền mà
 * từ đó trở lên phiếu đi theo luồng khác. Loại phiếu chưa cấu hình chạy luồng mặc định của hệ thống.
 *
 * Đổi luồng có hiệu lực với lần trình / duyệt KẾ TIẾP (chậm nhất một phút ở máy chủ khác); phiếu đang chờ
 * duyệt đi tiếp theo luồng mới từ đúng cấp nó đang đứng.
 */
export function ApprovalFlowsPage() {
  const mayWrite = useCan({ resource: "approval_flows", action: "edit" }).data?.can ?? false;
  const { data, isLoading } = useQuery({
    queryKey: KEY,
    queryFn: ({ signal }) => kyInstance.get("approval_flows", { signal }).json<ApprovalFlow[]>(),
  });
  const [editing, setEditing] = useState<ApprovalFlow | null>(null);
  const [resetting, setResetting] = useState<ApprovalFlow | null>(null);
  const [busy, setBusy] = useState(false);
  const { open: notify } = useNotification();
  const queryClient = useQueryClient();

  const flows = Array.isArray(data) ? data : [];
  const modules = [...new Set(flows.map((f) => f.module))];

  async function reset() {
    if (!resetting) return;
    setBusy(true);
    try {
      await kyInstance.delete(`approval_flows/${resetting.resource}`);
      notify?.({ type: "success", message: `${resetting.label}: đã về luồng mặc định` });
      await queryClient.invalidateQueries({ queryKey: KEY });
      setResetting(null);
    } catch (error) {
      notify?.({ type: "error", message: await errorMessage(error) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <ListView>
      <ListViewHeader canCreate={false} />
      <p className="text-muted-foreground -mt-2 flex items-center gap-2 text-sm">
        <Send className="size-4" />
        Cấp nào phải duyệt từng loại phiếu. Ai duyệt ở mỗi cấp thì đặt ở màn Vai trò (quyền "Duyệt" của loại phiếu).
      </p>
      {isLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        modules.map((module) => (
          <Card key={module} className="gap-0 overflow-hidden py-0">
            <h3 className="text-overline text-muted-foreground bg-surface-subtle border-b px-4 py-2.5">{module}</h3>
            <ul className="divide-y">
              {flows.filter((f) => f.module === module).map((f) => (
                <li key={f.resource} className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
                  <div className="w-64 min-w-0 shrink-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{f.label}</span>
                      {f.customized ? <Badge variant="gold">Sở đã cấu hình</Badge> : null}
                    </div>
                    {f.customized && f.updatedAt ? (
                      <span className="text-muted-foreground block truncate text-xs">
                        Sửa {formatDateTime(f.updatedAt)}{f.updatedBy ? ` · ${f.updatedBy}` : ""}
                      </span>
                    ) : (
                      <span className="text-muted-foreground block text-xs">Mặc định của hệ thống</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1 space-y-1.5">
                    {f.amountThreshold != null && f.stepsAbove ? (
                      <>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-muted-foreground w-40 shrink-0 text-xs">Dưới {money.format(f.amountThreshold)} đ</span>
                          <FlowMini steps={f.steps} />
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-muted-foreground w-40 shrink-0 text-xs">Từ {money.format(f.amountThreshold)} đ</span>
                          <FlowMini steps={f.stepsAbove} />
                        </div>
                      </>
                    ) : (
                      <FlowMini steps={f.steps} />
                    )}
                    {f.exemptNote ? <p className="text-muted-foreground text-xs">{f.exemptNote}</p> : null}
                    {f.note ? <p className="text-muted-foreground text-xs italic">{f.note}</p> : null}
                  </div>
                  {mayWrite ? (
                    <div className="flex shrink-0 items-center gap-1">
                      {f.customized ? (
                        <Button type="button" variant="ghost" size="sm" onClick={() => setResetting(f)} title="Về luồng mặc định của hệ thống">
                          <RotateCcw />
                          Mặc định
                        </Button>
                      ) : null}
                      <Button type="button" variant="outline" size="sm" onClick={() => setEditing(f)}>
                        <Pencil />
                        Sửa
                      </Button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          </Card>
        ))
      )}

      <EditFlowDialog flow={editing} onClose={() => setEditing(null)} />

      <AlertDialog open={resetting !== null} onOpenChange={(o) => !o && !busy && setResetting(null)}>
        <ConfirmContent
          tone="warning"
          icon={<RotateCcw />}
          title={`Đưa "${resetting?.label ?? ""}" về luồng mặc định?`}
          description={
            <span className="space-y-2">
              <span className="block">Cấu hình của Sở cho loại phiếu này bị bỏ. Luồng mặc định:</span>
              {resetting ? <FlowMini steps={resetting.defaultSteps} /> : null}
            </span>
          }
          cancelLabel="Giữ cấu hình"
          confirmLabel="Về mặc định"
          busy={busy}
          keepOpen
          onConfirm={() => void reset()}
        />
      </AlertDialog>
    </ListView>
  );
}
