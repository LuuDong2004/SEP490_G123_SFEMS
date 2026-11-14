import { useNotification } from "@refinedev/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, Undo2 } from "lucide-react";
import { useEffect, useState } from "react";

import { kyInstance } from "@/shared/api/data";
import { errorMessage } from "@/shared/lib/api-error";
import { cn } from "@/shared/lib/utils";
import { maxLengthOf, textError } from "@/shared/lib/field-rules";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Skeleton } from "@/shared/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { describeLine, STATUS_LABELS, type Adjustment } from "@/domains/standard-adjustment/types";

import { Verdict } from "./school-adjust";

type Choice = { decision: "APPROVED" | "RETURNED" | null; note: string };

/**
 * Một đề nghị điều chỉnh của trường. Người duyệt (cơ quan quản lý của trường) chọn Duyệt / Trả lại cho TỪNG dòng;
 * trả lại phải ghi lý do. Người khác xem kết quả.
 */
export function ReviewDialog({ id, onClose }: { id: number; onClose: () => void }) {
  const { open: notify } = useNotification();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["standard_adjustments", "one", id],
    queryFn: ({ signal }) => kyInstance.get(`standard_adjustments/${id}`, { signal }).json<Adjustment>(),
  });
  const [choices, setChoices] = useState<Record<number, Choice>>({});
  const [busy, setBusy] = useState(false);
  const [tried, setTried] = useState(false);

  useEffect(() => {
    if (data) setChoices(Object.fromEntries(data.items.map((l) => [l.id, { decision: null, note: "" }])));
  }, [data]);

  const review = data?.canReview ?? false;
  const set = (lineId: number, patch: Partial<Choice>) =>
    setChoices((c) => ({ ...c, [lineId]: { ...(c[lineId] ?? { decision: null, note: "" }), ...patch } }));
  const missing = data?.items.filter((l) => {
    const c = choices[l.id];
    return !c?.decision || (c.decision === "RETURNED" && (!c.note.trim() || !!textError("NOTE", "Lý do trả lại", c.note)));
  }).length ?? 0;

  const send = async () => {
    setTried(true);
    if (!data || missing) return;
    setBusy(true);
    try {
      await kyInstance.post(`standard_adjustments/${id}/review`, {
        json: { lines: data.items.map((l) => ({ lineId: l.id, decision: choices[l.id].decision, note: choices[l.id].note })) },
      }).json();
      void qc.invalidateQueries({ queryKey: ["standard_adjustments"] });
      const back = data.items.filter((l) => choices[l.id].decision === "RETURNED").length;
      notify?.({ type: "success", message: `Đã duyệt ${data.items.length - back} dòng${back ? `, trả lại ${back} dòng` : ""}` });
      onClose();
    } catch (e) {
      notify?.({ type: "error", message: await errorMessage(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => (o ? null : onClose())}>
      <DialogContent size="wide">
        <DialogHeader>
          <DialogTitle>
            {data ? `${data.schoolName} · Đề nghị ${data.code ?? ""}` : "Đề nghị điều chỉnh chuẩn"}
          </DialogTitle>
          <DialogDescription>
            {data
              ? [
                  data.submittedAt ? `Trình ${data.submittedAt}${data.submittedBy ? ` · ${data.submittedBy}` : ""}` : null,
                  data.reviewedAt ? `Duyệt ${data.reviewedAt}${data.reviewedBy ? ` · ${data.reviewedBy}` : ""}` : null,
                  STATUS_LABELS[data.status],
                ].filter(Boolean).join(" · ")
              : "Đang tải…"}
          </DialogDescription>
        </DialogHeader>
        {isLoading || !data ? (
          <Skeleton className="h-48 w-full" />
        ) : (
          <>
            {data.note ? <p className="bg-surface-subtle rounded-md px-3 py-2 text-sm">Ghi chú của trường: {data.note}</p> : null}
            <div className="min-h-0 flex-1 overflow-auto rounded-md border [&>[data-slot=table-container]]:overflow-visible [&_tbody_tr:last-child]:border-b">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Thiết bị</TableHead>
                    <TableHead>Đề nghị</TableHead>
                    <TableHead className="text-right">Theo chuẩn Bộ</TableHead>
                    <TableHead className="text-right">Sau điều chỉnh</TableHead>
                    <TableHead>Lý do</TableHead>
                    <TableHead className="w-64">{review ? "Quyết định" : "Kết quả"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((l) => {
                    const c = choices[l.id];
                    return (
                      <TableRow key={l.id} className="align-top">
                        <TableCell className="max-w-52">
                          <div className="truncate font-medium" title={l.catalogName}>{l.catalogName}</div>
                          <div className="text-muted-foreground text-xs">{l.catalogCode}{l.subjectName ? ` · ${l.subjectName}` : ""}</div>
                        </TableCell>
                        <TableCell className="text-sm">{describeLine(l)}</TableCell>
                        <TableCell className="text-right"><Verdict required={l.baseRequired} have={l.current} /></TableCell>
                        <TableCell className="text-right"><Verdict required={l.adjustedRequired} have={l.adjustedCurrent} /></TableCell>
                        <TableCell className="max-w-60 text-sm"><div className="line-clamp-3" title={l.reason}>{l.reason}</div></TableCell>
                        <TableCell>
                          {review ? (
                            <div className="space-y-1.5">
                              <div className="flex gap-1.5">
                                <Button type="button" size="sm" variant={c?.decision === "APPROVED" ? "default" : "outline"}
                                  className="h-7 px-2 text-xs" onClick={() => set(l.id, { decision: "APPROVED" })}>
                                  <Check /> Duyệt
                                </Button>
                                <Button type="button" size="sm" variant="outline"
                                  className={cn("h-7 px-2 text-xs", c?.decision === "RETURNED" && "border-destructive text-destructive-text")}
                                  onClick={() => set(l.id, { decision: "RETURNED" })}>
                                  <Undo2 /> Trả lại
                                </Button>
                              </div>
                              {c?.decision === "RETURNED" ? (
                                <Input value={c.note} onChange={(e) => set(l.id, { note: e.target.value })} placeholder="Lý do trả lại"
                                  maxLength={maxLengthOf("NOTE")}
                                  aria-invalid={(tried && !c.note.trim()) || !!textError("NOTE", "Lý do trả lại", c.note)} className="h-8 text-sm" />
                              ) : null}
                              {c?.decision === "RETURNED" && textError("NOTE", "Lý do trả lại", c.note) ? (
                                <p className="text-destructive-text text-xs">{textError("NOTE", "Lý do trả lại", c.note)}</p>
                              ) : null}
                              {tried && !c?.decision ? <p className="text-destructive-text text-xs">Chọn Duyệt hoặc Trả lại</p> : null}
                            </div>
                          ) : l.decision ? (
                            <div className="space-y-1">
                              <Badge variant={l.decision === "APPROVED" ? "success" : "destructive"}>
                                {l.decision === "APPROVED" ? "Đã duyệt" : "Trả lại"}
                              </Badge>
                              {l.decisionNote ? <p className="text-muted-foreground text-xs">{l.decisionNote}</p> : null}
                            </div>
                          ) : (
                            <Badge variant="warning">Chờ duyệt</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </>
        )}
        <DialogFooter className="gap-2">
          {review && data ? (
            <Button type="button" variant="ghost" className="me-auto"
              onClick={() => setChoices(Object.fromEntries(data.items.map((l) => [l.id, { decision: "APPROVED" as const, note: "" }])))}>
              Duyệt tất cả
            </Button>
          ) : null}
          <Button type="button" variant="outline" onClick={onClose}>Đóng</Button>
          {review ? (
            <Button type="button" disabled={busy} onClick={() => void send()}>
              {busy ? <Loader2 className="animate-spin" /> : null}
              Gửi kết quả
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
