import { useCan, useGetIdentity, useInvalidate, useList, useNavigation, useNotification } from "@refinedev/core";
import { AddLinesButton, AddLinesEmpty } from "@/shared/components/voucher/add-lines";
import { useForm } from "@refinedev/react-hook-form";
import { useQuery } from "@tanstack/react-query";
import { Check, CornerUpLeft, FileSpreadsheet, Loader2, Printer, Save, Send, X } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useWatch, type Control } from "react-hook-form";
import { Link } from "react-router";

import { kyInstance } from "@/shared/api/data";
import { RefField } from "@/shared/components/catalog/ref-field";
import { ConfirmContent } from "@/shared/components/confirm/confirm-content";
import { DateField, TextareaField, TextField } from "@/shared/components/form/simple-fields";
import { SideFact, SideSection, StepTitle, VoucherTwoColumn } from "@/shared/components/voucher/voucher-layout";
import { errorMessage } from "@/shared/lib/api-error";
import { formatDateTime, formatPlainDate, moneyInWords, todayLocal } from "@/shared/lib/format";
import { cn } from "@/shared/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/alert";
import { AlertDialog } from "@/shared/ui/alert-dialog";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Checkbox } from "@/shared/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Form } from "@/shared/ui/form";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { Textarea } from "@/shared/ui/textarea";
import {
  PLAN_STATUS_LABELS,
  PRIORITY_LABELS,
  type PlanCandidate,
  type PlanLine,
  type ProcurementPlan,
  type ProcurementPlanStatus,
} from "@/domains/procurement/types";
import { maxLengthOf } from "@/shared/lib/field-rules";
import { LIFT_ROW } from "@/shared/lib/row-lift";
import { TableEmpty } from "@/shared/components/data-table/table-empty";

/* eslint-disable @typescript-eslint/no-explicit-any */

export const RESOURCE = "procurement_plans";
const money = new Intl.NumberFormat("vi-VN");

const PLAN_VARIANT: Record<ProcurementPlanStatus, "neutral" | "warning" | "success"> = {
  DRAFT: "neutral",
  PENDING: "warning",
  APPROVED: "success",
};
const PRIORITY_VARIANT: Record<number, "destructive" | "warning" | "neutral"> = { 1: "destructive", 2: "warning", 3: "neutral" };

export function PlanStatusBadge({ status }: { status: ProcurementPlanStatus }) {
  return <Badge variant={PLAN_VARIANT[status]}>{PLAN_STATUS_LABELS[status]}</Badge>;
}

type Values = { title: string; schoolYear: { id: number | null }; planDate: string; note: string; lines: PlanLine[] };

const today = () => todayLocal();

/**
 * Màn kế hoạch mua sắm — MỘT màn cho lập, sửa và xem. Kế hoạch đi theo DÒNG THIẾT BỊ của các đề xuất đã duyệt:
 * chọn đề xuất là mọi dòng của nó vào bảng với đủ số đề nghị, rồi bớt số lượng hay bỏ dòng (0) khi ngân sách
 * không đủ. Tiền tính theo số ĐƯA VÀO KẾ HOẠCH, và phiếu ghi tăng lập từ đề xuất sau khi duyệt cũng đọc số này.
 * Không sửa được (đã trình / đã duyệt, hoặc không phải cơ quan lập) thì mọi ô bị khoá.
 */
export function PlanEditor({ plan, onChanged }: { plan?: ProcurementPlan; onChanged?: () => void }) {
  const creating = !plan;
  const actions = new Set(plan?._actions ?? []);
  const editable = creating || actions.has("edit");
  const { open: notify } = useNotification();
  const invalidate = useInvalidate();
  const { show } = useNavigation();
  const { data: me } = useGetIdentity<{ fullName?: string; username?: string }>();

  const {
    refineCore: { onFinish },
    ...form
  } = useForm<Values>({
    refineCoreProps: creating
      ? { resource: RESOURCE, action: "create", redirect: false }
      : { resource: RESOURCE, action: "edit", id: plan.id, redirect: false, queryOptions: { enabled: false } },
    defaultValues: {
      title: plan?.title ?? "",
      schoolYear: { id: plan?.schoolYear?.id ?? null },
      planDate: plan?.planDate ?? today(),
      note: plan?.note ?? "",
      lines: plan?.lines ?? [],
    },
  });
  const control = form.control as unknown as Control<any>;
  const lines = (useWatch({ control, name: "lines" }) ?? []) as PlanLine[];

  // Kế hoạch mới: năm học hiện hành điền sẵn, vẫn đổi được.
  const yearId = useWatch({ control, name: "schoolYear.id" });
  const { result: years } = useList<any>({ resource: "school_years", pagination: { pageSize: 50 }, queryOptions: { enabled: creating } });
  useEffect(() => {
    if (!creating || yearId) return;
    const current = (years?.data ?? []).find((y: any) => y.current);
    if (current) form.setValue("schoolYear", { id: current.id });
  }, [creating, yearId, years, form]);
  const setLines = (next: PlanLine[]) => form.setValue("lines", next, { shouldDirty: true });

  // Đề xuất vừa rút khỏi kế hoạch trên màn (chưa lưu) vẫn chọn lại được — máy chủ còn coi nó thuộc kế hoạch.
  const [removed, setRemoved] = useState<PlanCandidate[]>([]);
  const [busy, setBusy] = useState<"save" | "submit" | null>(null);
  const [confirmSubmit, setConfirmSubmit] = useState(false);

  const included = lines.filter((l) => l.plannedQuantity > 0);
  const totalAmount = included.reduce((s, l) => s + (l.unitPrice ?? 0) * l.plannedQuantity, 0);
  const totalQty = included.reduce((s, l) => s + l.plannedQuantity, 0);
  const proposals = new Set(lines.map((l) => l.proposalId));
  const schools = new Set(lines.map((l) => l.school.id));

  async function save(values: Values): Promise<number | undefined> {
    const res: any = await onFinish({
      title: values.title,
      schoolYear: values.schoolYear?.id ? { id: values.schoolYear.id } : null,
      planDate: values.planDate,
      note: values.note,
      lines: values.lines.map((l) => ({ lineId: l.lineId, plannedQuantity: l.plannedQuantity })),
    } as any);
    const id = res?.data?.id ?? plan?.id;
    form.reset(values);
    invalidate({ resource: RESOURCE, invalidates: ["list", "detail"], id });
    invalidate({ resource: "purchase_proposals", invalidates: ["list"] });
    return id;
  }

  const onSave = form.handleSubmit(async (values) => {
    setBusy("save");
    try {
      const id = await save(values as Values);
      if (creating && id) show(RESOURCE, id, "replace");
      else onChanged?.();
    } catch {
      // Refine đã báo lỗi.
    } finally {
      setBusy(null);
    }
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setBusy("submit");
    let id: number | undefined;
    try {
      id = await save(values as Values);
      if (!id) return;
      await kyInstance.post(`${RESOURCE}/${id}/submit`);
      notify?.({ type: "success", message: "Đã trình kế hoạch" });
      setConfirmSubmit(false);
      invalidate({ resource: RESOURCE, invalidates: ["list", "detail"], id });
      if (creating) show(RESOURCE, id, "replace");
      else onChanged?.();
    } catch (error) {
      notify?.({ type: "error", message: await errorMessage(error), description: "Kế hoạch đã lưu nháp nhưng chưa trình được" });
      setConfirmSubmit(false);
      if (creating && id) show(RESOURCE, id, "replace");
    } finally {
      setBusy(null);
    }
  });

  const addCandidates = (picked: PlanCandidate[]) => {
    const have = new Set(lines.map((l) => l.proposalId));
    const add = picked.filter((c) => !have.has(c.proposal.id)).flatMap((c) => c.lines);
    setLines([...lines, ...add]);
    setRemoved((r) => r.filter((c) => !picked.some((p) => p.proposal.id === c.proposal.id)));
  };
  const removeProposal = (proposalId: number) => {
    const gone = lines.filter((l) => l.proposalId === proposalId);
    if (gone.length) {
      const first = gone[0];
      setRemoved((r) => [
        ...r.filter((c) => c.proposal.id !== proposalId),
        {
          proposal: {
            id: proposalId, code: first.proposalCode, school: first.school, status: "APPROVED", budgetYear: null, reason: null,
            lineCount: gone.length, totalQuantity: gone.reduce((s, l) => s + l.requestedQuantity, 0),
            totalAmount: gone.reduce((s, l) => s + (l.unitPrice ?? 0) * l.requestedQuantity, 0),
          },
          lines: gone.map((l) => ({ ...l, plannedQuantity: l.requestedQuantity })),
        },
      ]);
    }
    setLines(lines.filter((l) => l.proposalId !== proposalId));
  };
  const setPlanned = (lineId: number, value: number) =>
    setLines(lines.map((l) => (l.lineId === lineId ? { ...l, plannedQuantity: Math.max(0, Math.min(l.requestedQuantity, value)) } : l)));

  const [picking, setPicking] = useState(false);
  const main = (
    <>
      {plan?.status === "DRAFT" && plan.approvalNote ? (
        <Alert>
          <CornerUpLeft />
          <AlertTitle>Kế hoạch bị trả lại</AlertTitle>
          <AlertDescription>{plan.approvalNote}</AlertDescription>
        </Alert>
      ) : null}

      <Card className="gap-4 px-4 py-4">
        <StepTitle title="Thông tin kế hoạch" />
        {/* Chỉ xem: chữ thường theo cặp nhãn – giá trị, không vẽ ô nhập xám với dấu * và chữ gợi ý. */}
        {!editable && plan ? (
          <dl className="grid min-w-0 items-start gap-x-4 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
            <ViewFact label="Mã kế hoạch"><span className="font-mono">{plan.code}</span></ViewFact>
            <ViewFact label="Tên kế hoạch" wide>{plan.title}</ViewFact>
            <ViewFact label="Ngày lập">{formatPlainDate(plan.planDate)}</ViewFact>
            <ViewFact label="Năm học">{plan.schoolYear?.code ?? plan.schoolYear?.name ?? `Năm ngân sách ${plan.budgetYear}`}</ViewFact>
            <ViewFact label="Người lập">{plan.createdBy?.name ?? "—"}</ViewFact>
            {plan.note ? <ViewFact label="Mô tả" wide>{plan.note}</ViewFact> : null}
          </dl>
        ) : (
        <fieldset disabled={!editable} className="grid min-w-0 items-start gap-x-4 gap-y-5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="grid gap-2">
            <Label>Mã kế hoạch</Label>
            <Input readOnly tabIndex={-1} value={plan?.code ?? "Cấp khi lưu"} className={cn("bg-muted/60", !plan && "text-muted-foreground")} />
          </div>
          <TextField control={control} name="title" label="Tên kế hoạch" rule="NAME" rules={{ required: "Nhập tên kế hoạch" }}
            className="sm:col-span-2" placeholder="VD: Kế hoạch mua sắm thiết bị dạy học năm học 2026-2027" />
          <DateField control={control} name="planDate" label="Ngày lập" rules={{ required: "Chọn ngày lập" }} />
          <RefField control={control} name="schoolYear" resource="school_years" label="Năm học" required labelField="code" current={plan?.schoolYear ?? undefined} />
          <div className="grid gap-2">
            <Label>Người lập</Label>
            <Input readOnly tabIndex={-1} className="bg-muted/60"
              value={plan ? (plan.createdBy?.name ?? "—") : (me?.fullName ?? me?.username ?? "")} />
          </div>
          <TextareaField control={control} name="note" label="Mô tả" rule="LONG_TEXT" max={1000} inGrid placeholder="Mục đích, phạm vi của kế hoạch" />
        </fieldset>
        )}
      </Card>

      <Card className="gap-0 overflow-hidden py-0">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b px-4 py-3">
          <StepTitle title="Đề xuất của các trường"
            hint="Đề xuất đã duyệt, chưa vào kế hoạch nào" />
          <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-sm sm:ms-auto">
            <span><span className="text-foreground font-semibold tabular-nums">{included.length}</span>/{lines.length} dòng</span>
            <span>SL kế hoạch <span className="text-foreground font-semibold tabular-nums">{money.format(totalQty)}</span></span>
            {editable && lines.length ? <AddLinesButton label="Thêm đề xuất" onClick={() => setPicking(true)} /> : null}
          </div>
        </div>
        {editable ? (
          <CandidatesDialog planId={plan?.id} exclude={proposals} extra={removed} onAdd={addCandidates}
            open={picking} onOpenChange={setPicking} />
        ) : null}
        {editable && lines.length === 0 ? (
          <AddLinesEmpty label="Thêm đề xuất" hint="Đề xuất đã duyệt của các trường" onClick={() => setPicking(true)} />
        ) : (
          <PlanLinesTable lines={lines} editable={editable} onPlanned={setPlanned} onRemove={removeProposal} />
        )}
      </Card>
    </>
  );

  const side = (
    <Card className="gap-0 py-0">
      <SideSection title="Kế hoạch mua sắm" aside={plan ? <PlanStatusBadge status={plan.status} /> : null}>
        <SideFact label="Mã">{plan?.code ? <span className="font-mono">{plan.code}</span> : <span className="text-muted-foreground font-normal">Cấp khi lưu</span>}</SideFact>
        {plan ? <SideFact label="Cơ quan">{plan.managingBody.name}</SideFact> : null}
        {plan?.approvedAt ? <SideFact label="Duyệt lúc">{formatDateTime(plan.approvedAt)}</SideFact> : null}
      </SideSection>
      <SideSection title="Tổng giá trị dự toán">
        <p className="text-2xl font-bold tabular-nums">{money.format(totalAmount)} đ</p>
        <p className="text-muted-foreground text-xs">Bằng chữ: {moneyInWords(totalAmount)}.</p>
      </SideSection>
      <SideSection title="Phạm vi">
        <SideFact label="Số đề xuất">{proposals.size}</SideFact>
        <SideFact label="Số trường">{schools.size}</SideFact>
        <SideFact label="Thiết bị đưa vào">{included.length} dòng · {money.format(totalQty)}</SideFact>
      </SideSection>
      {plan?.status === "APPROVED" && plan.approvalNote ? (
        <SideSection title="Ý kiến duyệt">
          <p className="text-sm">{plan.approvalNote}</p>
        </SideSection>
      ) : null}
      {editable ? (
        <SideSection>
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant="outline" className="min-w-0" disabled={busy !== null} onClick={() => void onSave()}>
              {busy === "save" ? <Loader2 className="animate-spin" /> : <Save />}
              <span className="truncate">Lưu nháp</span>
            </Button>
            <Button type="button" className="min-w-0" disabled={busy !== null || included.length === 0}
              title={included.length === 0 ? "Thêm đề xuất và đưa ít nhất một thiết bị vào kế hoạch" : undefined}
              onClick={() => setConfirmSubmit(true)}>
              <Send />
              <span className="truncate">Trình duyệt</span>
            </Button>
          </div>
          {included.length === 0 ? (
            <p className="text-muted-foreground text-xs">Thêm đề xuất đã duyệt của các trường, trước khi trình lãnh đạo cơ quan.</p>
          ) : null}
        </SideSection>
      ) : null}
    </Card>
  );

  return (
    <Form {...form}>
      <form onSubmit={(e) => { e.preventDefault(); void onSave(); }} className="w-full">
        <VoucherTwoColumn main={main} side={side} />
      </form>
      <AlertDialog open={confirmSubmit} onOpenChange={(o) => !busy && setConfirmSubmit(o)}>
        <ConfirmContent
          icon={<Send />}
          title="Trình kế hoạch mua sắm?"
          description={`${included.length} thiết bị, tổng ${money.format(totalAmount)} đ. Lãnh đạo cơ quan sẽ duyệt hoặc trả lại; trong lúc chờ không sửa được kế hoạch.`}
          cancelLabel="Chưa, để sau"
          confirmLabel="Trình duyệt"
          busy={busy === "submit"}
          keepOpen
          onConfirm={() => void onSubmit()}
        />
      </AlertDialog>
    </Form>
  );
}

function ViewFact({ label, wide, children }: { label: string; wide?: boolean; children: ReactNode }) {
  return (
    <div className={cn("min-w-0", wide && "sm:col-span-2")}>
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="mt-1 text-sm font-medium break-words whitespace-pre-line">{children}</dd>
    </div>
  );
}

/** Bảng dòng thiết bị, nhóm theo đề xuất: dòng đầu mỗi nhóm là số phiếu và trường. */
function PlanLinesTable({ lines, editable, onPlanned, onRemove }: {
  lines: PlanLine[];
  editable: boolean;
  onPlanned: (lineId: number, value: number) => void;
  onRemove: (proposalId: number) => void;
}) {
  const groups = useMemo(() => {
    const m = new Map<number, PlanLine[]>();
    for (const l of lines) m.set(l.proposalId, [...(m.get(l.proposalId) ?? []), l]);
    return [...m.values()];
  }, [lines]);
  const cols = editable ? 7 : 6;
  return (
    <Table>
      <TableHeader className="bg-surface-subtle">
        <TableRow>
          {editable ? <TableHead className="w-10 ps-4" /> : null}
          <TableHead className={cn("text-overline text-muted-foreground", !editable && "ps-4")}>Thiết bị</TableHead>
          <TableHead className="text-overline text-muted-foreground w-24 text-right">SL đề nghị</TableHead>
          <TableHead className="text-overline text-muted-foreground w-32 text-right">SL đưa vào KH</TableHead>
          <TableHead className="text-overline text-muted-foreground w-32 text-right">Đơn giá</TableHead>
          <TableHead className="text-overline text-muted-foreground w-36 text-right">Thành tiền</TableHead>
          <TableHead className="text-overline text-muted-foreground w-24 pe-4">Ưu tiên</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {groups.length === 0 ? (
          <TableEmpty colSpan={cols} compact title={<>Kế hoạch chưa có đề xuất nào.</>} />
        ) : groups.map((g) => {
          const head = g[0];
          return [
            <TableRow key={`p${head.proposalId}`} className="bg-muted/40 hover:bg-muted/40">
              <TableCell colSpan={cols} className="ps-4 py-2">
                <div className="flex items-center gap-2 text-sm">
                  <Link className="text-primary font-mono text-xs font-medium hover:underline" to={`/purchase-proposals/show/${head.proposalId}`}>
                    {head.proposalCode ?? "Đề xuất"}
                  </Link>
                  <span className="font-medium">{head.school.name}</span>
                  <span className="text-muted-foreground text-xs">· {g.length} thiết bị</span>
                  {editable ? (
                    <Button type="button" variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive-text ms-auto h-7"
                      onClick={() => onRemove(head.proposalId)}>
                      <X />
                      Rút khỏi kế hoạch
                    </Button>
                  ) : null}
                </div>
              </TableCell>
            </TableRow>,
            ...g.map((l) => {
              const off = l.plannedQuantity === 0;
              const cut = l.requestedQuantity - l.plannedQuantity;
              return (
                <TableRow key={l.lineId} className={cn(off && "text-muted-foreground")}>
                  {editable ? (
                    <TableCell className="ps-4">
                      <Checkbox checked={!off} aria-label="Đưa vào kế hoạch"
                        onCheckedChange={(v) => onPlanned(l.lineId, v ? l.requestedQuantity : 0)} />
                    </TableCell>
                  ) : null}
                  <TableCell className={cn("whitespace-normal", !editable && "ps-4")}>
                    <span className={cn("font-medium", off && "line-through")}>{l.name}</span>
                    <span className="text-muted-foreground block text-xs">
                      {[l.catalog.code, l.specification].filter(Boolean).join(" · ")}
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {money.format(l.requestedQuantity)} <span className="text-muted-foreground text-xs">{l.unitName ?? ""}</span>
                  </TableCell>
                  <TableCell className="text-right">
                    {editable ? (
                      <Input type="number" min={0} max={l.requestedQuantity} step={1} value={l.plannedQuantity}
                        onChange={(e) => onPlanned(l.lineId, Math.max(0, Math.floor(Number(e.target.value || 0))))}
                        className="ms-auto h-8 w-20 text-right tabular-nums" aria-label="Số đưa vào kế hoạch" />
                    ) : (
                      <span className="font-medium tabular-nums">{money.format(l.plannedQuantity)}</span>
                    )}
                    {cut > 0 && !off ? <span className="text-warning-text mt-1 block text-[0.6875rem]">Bớt {cut} so với đề nghị</span> : null}
                    {off ? <span className="mt-1 block text-[0.6875rem]">Không đưa vào</span> : null}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{l.unitPrice != null ? money.format(l.unitPrice) : "—"}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{money.format((l.unitPrice ?? 0) * l.plannedQuantity)}</TableCell>
                  <TableCell className="pe-4">
                    <Badge variant={PRIORITY_VARIANT[l.priority] ?? "neutral"}>{PRIORITY_LABELS[l.priority] ?? l.priority}</Badge>
                  </TableCell>
                </TableRow>
              );
            }),
          ];
        })}
      </TableBody>
    </Table>
  );
}

/** Chọn đề xuất đã duyệt, chưa vào kế hoạch nào, của các trường cơ quan lập kế hoạch quản lý. */
function CandidatesDialog({ planId, exclude, extra, onAdd, open, onOpenChange: setOpen }: {
  planId?: number;
  exclude: Set<number>;
  extra: PlanCandidate[];
  onAdd: (picked: PlanCandidate[]) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [picked, setPicked] = useState<Set<number>>(new Set());
  // Mở hộp là bắt đầu chọn lại từ đầu.
  useEffect(() => {
    if (open) setPicked(new Set());
  }, [open]);
  const { data, isLoading } = useQuery({
    queryKey: [RESOURCE, planId ?? "new", "candidates"],
    enabled: open,
    queryFn: ({ signal }) => kyInstance.get(planId ? `${RESOURCE}/${planId}/candidates` : `${RESOURCE}/candidates`, { signal }).json<PlanCandidate[]>(),
  });
  const rows = [...extra, ...(Array.isArray(data) ? data : [])]
    .filter((c, i, all) => !exclude.has(c.proposal.id) && all.findIndex((x) => x.proposal.id === c.proposal.id) === i);
  const toggle = (id: number) => setPicked((s) => {
    const next = new Set(s);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent size="picker">
          <DialogHeader>
            <DialogTitle>Chọn đề xuất của các trường</DialogTitle>
            <DialogDescription>Đề xuất đã được duyệt, chưa nằm trong kế hoạch nào. Bấm một dòng để chọn.</DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-auto rounded-md border [&>[data-slot=table-container]]:overflow-visible [&_tbody_tr:last-child]:border-b">
            <Table>
              <TableHeader className="bg-surface-subtle sticky top-0">
                <TableRow>
                  <TableHead className="w-10" />
                  <TableHead className="text-overline text-muted-foreground">Số phiếu</TableHead>
                  <TableHead className="text-overline text-muted-foreground">Trường</TableHead>
                  <TableHead className="text-overline text-muted-foreground text-right">Thiết bị</TableHead>
                  <TableHead className="text-overline text-muted-foreground text-right">Dự toán</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableEmpty colSpan={5} compact loading={isLoading} title={<>Không có đề xuất nào đang chờ vào kế hoạch.</>} />
                ) : rows.map((c) => (
                  <TableRow key={c.proposal.id} className={cn("group/row", LIFT_ROW, "cursor-pointer")} onClick={() => toggle(c.proposal.id)}>
                    <TableCell><Checkbox checked={picked.has(c.proposal.id)} onCheckedChange={() => toggle(c.proposal.id)} onClick={(e) => e.stopPropagation()} /></TableCell>
                    <TableCell className="font-mono text-xs">{c.proposal.code}</TableCell>
                    <TableCell>{c.proposal.school.name}</TableCell>
                    <TableCell className="text-right tabular-nums">{c.lines.length}</TableCell>
                    <TableCell className="text-right tabular-nums">{money.format(c.proposal.totalAmount)} đ</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Đóng</Button>
            <Button type="button" disabled={picked.size === 0}
              onClick={() => { onAdd(rows.filter((c) => picked.has(c.proposal.id))); setOpen(false); }}>
              Thêm {picked.size || ""} đề xuất
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Duyệt / trả lại kế hoạch đang chờ — cùng một hộp có ô ý kiến. */
export function PlanReviewButton({ plan, step, onDone }: { plan: ProcurementPlan; step: "approve" | "return"; onDone: () => void }) {
  const { open: notify } = useNotification();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const text = {
    approve: { label: "Duyệt", icon: <Check />, title: "Duyệt kế hoạch mua sắm?", desc: `${plan.proposalCount ?? 0} đề xuất trong kế hoạch sẽ hoàn tất; các trường lập phiếu ghi tăng theo số đưa vào kế hoạch khi hàng về.`, ok: "Đã duyệt kế hoạch" },
    return: { label: "Trả lại", icon: <CornerUpLeft />, title: "Trả lại kế hoạch?", desc: "Ghi rõ cần sửa gì để chuyên viên biết.", ok: "Đã trả lại kế hoạch" },
  }[step];
  async function run() {
    setBusy(true);
    try {
      await kyInstance.post(`${RESOURCE}/${plan.id}/${step}`, { json: { note: note.trim() || null } });
      notify?.({ type: "success", message: text.ok });
      setOpen(false);
      onDone();
    } catch (error) {
      notify?.({ type: "error", message: await errorMessage(error) });
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Button type="button" variant={step === "return" ? "outline" : "default"} onClick={() => { setNote(""); setOpen(true); }}>
        {text.icon}
        {text.label}
      </Button>
      <AlertDialog open={open} onOpenChange={(o) => !busy && setOpen(o)}>
        <ConfirmContent
          tone={step === "return" ? "warning" : "neutral"}
          icon={text.icon}
          title={text.title}
          description={text.desc}
          cancelLabel="Chưa, để sau"
          confirmLabel={text.label}
          busy={busy}
          keepOpen
          confirmDisabled={step === "return" && !note.trim()}
          onConfirm={() => void run()}
        >
          <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} maxLength={maxLengthOf("NOTE")}
            placeholder={step === "return" ? "Lý do trả lại (bắt buộc)" : "Ý kiến (không bắt buộc)"} />
        </ConfirmContent>
      </AlertDialog>
    </>
  );
}

/** In: bản in là chính màn này — thanh bên, nút bấm và thẻ tóm tắt tự ẩn khi in. */
export function PrintButton() {
  return (
    <Button type="button" variant="outline" onClick={() => window.print()}>
      <Printer />
      In kế hoạch
    </Button>
  );
}

/** Xuất Excel: chi tiết theo dòng đề xuất và tổng hợp theo thiết bị (`GET /procurement_plans/{id}/export.xlsx`). */
export function ExportButton({ plan }: { plan: ProcurementPlan }) {
  const { open: notify } = useNotification();
  const [busy, setBusy] = useState(false);
  const allowed = useCan({ resource: RESOURCE, action: "export" }).data?.can ?? false;
  if (!allowed) return null;
  const run = async () => {
    setBusy(true);
    try {
      const blob = await kyInstance.get(`${RESOURCE}/${plan.id}/export.xlsx`).blob();
      const url = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement("a"), { href: url, download: `Kế hoạch mua sắm - ${plan.code ?? plan.id}.xlsx` });
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      notify?.({ type: "error", message: await errorMessage(error), description: "Không xuất được Excel" });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Button type="button" variant="outline" disabled={busy} onClick={() => void run()}>
      {busy ? <Loader2 className="animate-spin" /> : <FileSpreadsheet />}
      Xuất Excel
    </Button>
  );
}
