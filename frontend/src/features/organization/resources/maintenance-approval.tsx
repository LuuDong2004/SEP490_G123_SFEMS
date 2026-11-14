import { useCan, useInvalidate, useList, useNotification } from "@refinedev/core";
import { CheckCheck, Undo2 } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";

import { kyInstance } from "@/shared/api/data";
import { ConfirmContent } from "@/shared/components/confirm/confirm-content";
import { errorMessage } from "@/shared/lib/api-error";
import { formatDateTime, formatPlainDate } from "@/shared/lib/format";
import { LIFT_ROW } from "@/shared/lib/row-lift";
import { PLAN_APPROVAL_VARIANTS } from "@/shared/lib/status-variants";
import { cn } from "@/shared/lib/utils";
import { AlertDialog } from "@/shared/ui/alert-dialog";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Checkbox } from "@/shared/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { Textarea } from "@/shared/ui/textarea";
import { PLAN_APPROVAL_LABELS } from "@/domains/maintenance-plan/types";

/* eslint-disable @typescript-eslint/no-explicit-any */

export function ApprovalBadge({ status }: { status?: string | null }) {
  const st = status ?? "APPROVED";
  return <Badge variant={PLAN_APPROVAL_VARIANTS[st] ?? "neutral"}>{PLAN_APPROVAL_LABELS[st] ?? st}</Badge>;
}

const RESOURCE = "maintenance_plans";

/** Hộp nhập lý do trả lại một kế hoạch. */
function ReturnDialog({ plan, onClose, onDone }: { plan: { id: number; name: string }; onClose: () => void; onDone: () => void }) {
  const { open } = useNotification();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  async function send() {
    setBusy(true);
    try {
      await kyInstance.post(`${RESOURCE}/${plan.id}/return`, { json: { reason: reason.trim() } }).json();
      open?.({ type: "success", message: "Đã trả lại kế hoạch" });
      onDone();
      onClose();
    } catch (error) {
      open?.({ type: "error", message: await errorMessage(error) });
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog open onOpenChange={(o) => (o ? null : onClose())}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Trả lại {plan.name}</DialogTitle>
          <DialogDescription>Cán bộ thấy lý do này, sửa rồi lưu lại để trình duyệt.</DialogDescription>
        </DialogHeader>
        <Textarea rows={4} maxLength={500} value={reason} placeholder="Chu kỳ chưa hợp lý, đổi sang hằng quý"
          aria-label="Lý do trả lại" onChange={(e) => setReason(e.target.value)} />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Huỷ</Button>
          <Button type="button" disabled={busy || !reason.trim()} onClick={() => void send()}>Trả lại</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Nút "Chờ duyệt (N)" trên màn danh sách kế hoạch bảo trì (QLTB-653): lãnh đạo chọn nhiều kế hoạch để duyệt một lần,
 * hoặc trả lại từng kế hoạch kèm lý do; cán bộ thấy kế hoạch nào đang chờ, kế hoạch nào bị trả lại và vì sao.
 */
export function MaintenanceApprovalButton() {
  const mayApprove = useCan({ resource: RESOURCE, action: "approve" }).data?.can ?? false;
  const mayWrite = useCan({ resource: RESOURCE, action: "edit" }).data?.can ?? false;
  const { result } = useList<any>({
    resource: RESOURCE,
    filters: [{ field: "approvalStatus", operator: "eq", value: "OPEN" }],
    pagination: { currentPage: 1, pageSize: 200 },
    queryOptions: { enabled: mayApprove || mayWrite },
  });
  const [open, setOpen] = useState(false);
  const items = result?.data ?? [];
  if (!(mayApprove || mayWrite) || items.length === 0) return null;
  const pending = items.filter((i) => i.approvalStatus === "PENDING").length;
  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        <CheckCheck />
        {pending ? `Chờ duyệt (${pending})` : `Bị trả lại (${items.length})`}
      </Button>
      {open ? <ApprovalDialog items={items} leader={mayApprove} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function ApprovalDialog({ items, leader, onClose }: { items: any[]; leader: boolean; onClose: () => void }) {
  const invalidate = useInvalidate();
  const navigate = useNavigate();
  const { open } = useNotification();
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [returning, setReturning] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);
  const selectable = items.filter((i) => i.approvalStatus === "PENDING");
  const allOn = selectable.length > 0 && selectable.every((i) => picked.has(i.id));
  const refresh = () => invalidate({ resource: RESOURCE, invalidates: ["list", "detail"] });

  async function approve() {
    setBusy(true);
    try {
      await kyInstance.post(`${RESOURCE}/approve`, { json: { ids: [...picked] } }).json();
      open?.({ type: "success", message: `Đã duyệt ${picked.size} kế hoạch` });
      setPicked(new Set());
      await refresh();
      onClose();
    } catch (error) {
      open?.({ type: "error", message: await errorMessage(error) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => (o ? null : onClose())}>
      <DialogContent size="wide">
        <DialogHeader>
          <DialogTitle>Duyệt kế hoạch bảo trì</DialogTitle>
          <DialogDescription>
            {leader ? "Chọn kế hoạch rồi bấm Duyệt. Kế hoạch chưa hợp lý thì trả lại kèm lý do." : "Kế hoạch chờ lãnh đạo duyệt hoặc bị trả lại. Bấm một dòng để mở."}
          </DialogDescription>
        </DialogHeader>
        <div className="bg-card min-h-0 flex-1 overflow-auto rounded-lg border">
          <Table>
            <TableHeader sticky>
              <TableRow>
                {leader ? (
                  <TableHead className="w-10">
                    <Checkbox aria-label="Chọn tất cả" checked={allOn}
                      onCheckedChange={(on) => setPicked(on === true ? new Set(selectable.map((i) => i.id)) : new Set())} />
                  </TableHead>
                ) : null}
                <TableHead>Mã</TableHead>
                <TableHead>Tên kế hoạch</TableHead>
                <TableHead>Đối tượng</TableHead>
                <TableHead>Lần tới</TableHead>
                <TableHead>Trạng thái</TableHead>
                {leader ? <TableHead className="w-28" /> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((i) => (
                <TableRow key={i.id} className={cn("group/row", LIFT_ROW, "cursor-pointer")}
                  onClick={() => navigate(`/maintenance-plans/show/${i.id}`)}>
                  {leader ? (
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {i.approvalStatus === "PENDING" ? (
                        <Checkbox aria-label={`Chọn ${i.name}`} checked={picked.has(i.id)}
                          onCheckedChange={(on) => {
                            const next = new Set(picked);
                            if (on === true) next.add(i.id); else next.delete(i.id);
                            setPicked(next);
                          }} />
                      ) : null}
                    </TableCell>
                  ) : null}
                  <TableCell className="font-mono text-sm">{i.code}</TableCell>
                  <TableCell className="font-medium">{i.name}</TableCell>
                  <TableCell className="text-sm">{i.targetLabel || "—"}</TableCell>
                  <TableCell className="text-sm whitespace-nowrap">{i.nextDueDate ? formatPlainDate(i.nextDueDate) : "—"}</TableCell>
                  <TableCell className="max-w-72 whitespace-normal">
                    <ApprovalBadge status={i.approvalStatus} />
                    {i.approvalNote ? <p className="text-muted-foreground mt-1 text-xs">{i.approvalNote}</p> : null}
                  </TableCell>
                  {leader ? (
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {i.approvalStatus === "PENDING" ? (
                        <Button type="button" variant="ghost" size="sm" onClick={() => setReturning(i)}>
                          <Undo2 />
                          Trả lại
                        </Button>
                      ) : null}
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Đóng</Button>
          {leader ? (
            <Button type="button" disabled={busy || picked.size === 0} onClick={() => void approve()}>
              <CheckCheck />
              {picked.size ? `Duyệt ${picked.size} kế hoạch` : "Duyệt"}
            </Button>
          ) : null}
        </DialogFooter>
        {returning ? <ReturnDialog plan={returning} onClose={() => setReturning(null)} onDone={() => void refresh()} /> : null}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Thẻ "Duyệt kế hoạch" trên hồ sơ kế hoạch: trạng thái duyệt, lý do trả lại; lãnh đạo có nút Duyệt (hỏi lại) và
 * Trả lại. Kế hoạch chưa duyệt thì chưa được nhắc, chưa ghi nhận bảo trì được.
 */
export function PlanApprovalCard({ record }: { record: any }) {
  const mayApprove = useCan({ resource: RESOURCE, action: "approve" }).data?.can ?? false;
  const invalidate = useInvalidate();
  const { open } = useNotification();
  const [confirming, setConfirming] = useState(false);
  const [returning, setReturning] = useState(false);
  const [busy, setBusy] = useState(false);
  const status: string = record?.approvalStatus ?? "APPROVED";
  if (!record || status === "APPROVED") return null;
  const refresh = () => invalidate({ resource: RESOURCE, invalidates: ["list", "detail"], id: record.id });

  async function approve() {
    setBusy(true);
    try {
      await kyInstance.post(`${RESOURCE}/approve`, { json: { ids: [record.id] } }).json();
      open?.({ type: "success", message: "Đã duyệt kế hoạch" });
      setConfirming(false);
      await refresh();
    } catch (error) {
      open?.({ type: "error", message: await errorMessage(error) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="gap-3">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
        <CardTitle className="flex items-center gap-2 text-base">
          Duyệt kế hoạch
          <ApprovalBadge status={status} />
        </CardTitle>
        {mayApprove && status === "PENDING" ? (
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" disabled={busy} onClick={() => setConfirming(true)}>
              <CheckCheck /> Duyệt
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => setReturning(true)}>
              <Undo2 /> Trả lại
            </Button>
          </div>
        ) : null}
      </CardHeader>
      <CardContent className="text-muted-foreground space-y-1 text-sm">
        {status === "PENDING" ? <p>Chờ lãnh đạo duyệt. Chưa duyệt thì chưa nhắc đến hạn.</p> : null}
        {status === "RETURNED" ? (
          <p>
            Trả lại{record.approvedAt ? ` lúc ${formatDateTime(record.approvedAt)}` : ""}: <span className="text-foreground">{record.approvalNote ?? "—"}</span>
            {record._can?.write ? ". Sửa kế hoạch rồi lưu để trình lại." : ""}
          </p>
        ) : null}
      </CardContent>
      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <ConfirmContent
          title={`Duyệt kế hoạch ${record.name}?`}
          description="Kế hoạch được áp dụng, hệ thống nhắc trước hạn theo các mốc đã chọn."
          cancelLabel="Không duyệt"
          confirmLabel="Duyệt"
          busy={busy}
          keepOpen
          onConfirm={() => void approve()}
        />
      </AlertDialog>
      {returning ? <ReturnDialog plan={record} onClose={() => setReturning(false)} onDone={() => void refresh()} /> : null}
    </Card>
  );
}
