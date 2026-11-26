import { useCan, useGetIdentity, useInvalidate, useNavigation, useNotification } from "@refinedev/core";
import { AddLinesButton, AddLinesEmpty } from "@/shared/components/voucher/add-lines";
import { useForm } from "@refinedev/react-hook-form";
import { useQuery } from "@tanstack/react-query";
import { usePagedRows } from "@/shared/components/data-table/use-paged-rows";
import { ArrowLeft, Check, ChevronDown, CornerUpLeft, FileSpreadsheet, Loader2, Save, Send, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useWatch, type Control } from "react-hook-form";
import { Link, useSearchParams } from "react-router";

import { kyInstance } from "@/shared/api/data";
import { useSchoolYear, useSchoolYears } from "@/shared/hooks/use-school-year";
import { RefField } from "@/shared/components/catalog/ref-field";
import { ConfirmContent } from "@/shared/components/confirm/confirm-content";
import { MoneyInput } from "@/shared/components/form/money-input";
import { DateField, TextareaField, TextField } from "@/shared/components/form/simple-fields";
import { CompletionList, SideFact, SideSection, StepTitle, VoucherTwoColumn, type ChecklistItem } from "@/shared/components/voucher/voucher-layout";
import { useConfirmDiscard } from "@/shared/components/form/unsaved-changes-guard";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";
import {
  PLAN_STATUS_LABELS,
  type PlanCandidate,
  type PlanLine,
  type ProcurementPlan,
  type ProcurementPlanStatus,
} from "@/domains/procurement/types";
import { maxLengthOf, numberMax, textError } from "@/shared/lib/field-rules";
import { LIFT_ROW } from "@/shared/lib/row-lift";
import { ROW_ACTION_ITEM, useRowActionsMenu } from "@/shared/components/data-table/row-actions";
import { TableEmpty } from "@/shared/components/data-table/table-empty";
import { yearLabel } from "@/shared/hooks/use-school-year";

/* eslint-disable @typescript-eslint/no-explicit-any */

export const RESOURCE = "procurement_plans";
const money = new Intl.NumberFormat("vi-VN");

const PLAN_VARIANT: Record<ProcurementPlanStatus, "neutral" | "warning" | "success"> = {
  DRAFT: "neutral",
  PENDING: "warning",
  APPROVED: "success",
};

export function PlanStatusBadge({ status }: { status: ProcurementPlanStatus }) {
  return <Badge variant={PLAN_VARIANT[status]}>{PLAN_STATUS_LABELS[status]}</Badge>;
}

type Values = { title: string; schoolYear: { id: number | null }; planDate: string; note: string; lines: PlanLine[] };

const today = () => todayLocal();

/** Khối của thẻ bên phải nối tiếp khối trên, không kẻ ngang, sát lên. */
const FLAT = "border-t-0 pt-1";

/** Lỗi do bấm mục thiếu ở "Kiểm tra trước khi trình" — tự gỡ khi ô được điền. */
const MISSING = "missing";

/**
 * Màn kế hoạch mua sắm — MỘT màn cho lập, sửa và xem. Kế hoạch đi theo DÒNG THIẾT BỊ của các đề xuất đã duyệt:
 * chọn đề xuất là mọi dòng của nó vào bảng với đủ số đề nghị, rồi bớt số lượng hay bỏ dòng (0) khi ngân sách
 * không đủ. Tiền tính theo số ĐƯA VÀO KẾ HOẠCH, và phiếu ghi tăng lập từ đề xuất sau khi duyệt cũng đọc số này.
 * Không sửa được (đã trình / đã duyệt, hoặc không thuộc Sở lập) thì mọi ô bị khoá.
 */
export function PlanEditor({ plan, onChanged }: { plan?: ProcurementPlan; onChanged?: () => void }) {
  const creating = !plan;
  const actions = new Set(plan?._actions ?? []);
  const editable = creating || actions.has("edit");
  const { open: notify } = useNotification();
  const invalidate = useInvalidate();
  const { show, list } = useNavigation();
  const confirmDiscard = useConfirmDiscard();
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
  const watchedLines = useWatch({ control, name: "lines" }) as PlanLine[] | undefined;
  const lines = useMemo(() => watchedLines ?? [], [watchedLines]);

  // Kế hoạch mới: năm học đang làm việc (header) điền sẵn, vẫn đổi được.
  const yearId = useWatch({ control, name: "schoolYear.id" });
  const { id: workingYear } = useSchoolYear();
  useEffect(() => {
    if (!creating || yearId || workingYear == null) return;
    form.setValue("schoolYear", { id: workingYear });
  }, [creating, yearId, workingYear, form]);
  const setLines = (next: PlanLine[]) => form.setValue("lines", next, { shouldDirty: true });

  // Lập từ danh sách đề xuất (`?proposals=1,2,3` — chuyên viên tích chọn rồi bấm "Lập kế hoạch"): đưa sẵn mọi dòng của
  // các đề xuất đó vào bảng, và chọn năm học có năm ngân sách trùng năm ngân sách của chúng (2026-2027 → 2027).
  const [params] = useSearchParams();
  const preset = useMemo(() => (creating ? (params.get("proposals") ?? "") : "").split(",").map(Number).filter((n) => n > 0),
    [creating, params]);
  const { years } = useSchoolYears();
  const presetDone = useRef(false);
  const { data: presetCandidates } = useQuery({
    queryKey: [RESOURCE, "new", "candidates", "preset", preset.join(",")],
    enabled: preset.length > 0,
    queryFn: ({ signal }) => kyInstance.get(`${RESOURCE}/candidates`, { signal }).json<PlanCandidate[]>(),
  });
  useEffect(() => {
    if (presetDone.current || !presetCandidates || !years.length) return;
    presetDone.current = true;
    const picked = presetCandidates.filter((c) => preset.includes(c.proposal.id));
    if (!picked.length) return;
    form.setValue("lines", picked.flatMap((c) => c.lines), { shouldDirty: true });
    const budgets = new Set(picked.map((c) => c.proposal.budgetYear).filter((y): y is number => y != null));
    const year = budgets.size === 1 ? years.find((y) => Number(y.endDate?.slice(0, 4)) === [...budgets][0]) : undefined;
    if (year) form.setValue("schoolYear", { id: year.id }, { shouldDirty: true });
    if (picked.length < preset.length) {
      notify?.({ type: "error", message: `${preset.length - picked.length} đề xuất đã chọn không còn chờ vào kế hoạch nên không được đưa vào` });
    }
  }, [presetCandidates, years, preset, form, notify]);

  // Đề xuất vừa rút khỏi kế hoạch trên màn (chưa lưu) vẫn chọn lại được — máy chủ còn coi nó thuộc kế hoạch.
  const [removed, setRemoved] = useState<PlanCandidate[]>([]);
  const [busy, setBusy] = useState<"save" | "submit" | null>(null);
  const [confirmSubmit, setConfirmSubmit] = useState(false);

  const included = lines.filter((l) => l.plannedQuantity > 0);
  const totalAmount = included.reduce((s, l) => s + (l.unitPrice ?? 0) * l.plannedQuantity, 0);
  const totalQty = included.reduce((s, l) => s + l.plannedQuantity, 0);
  // Kế hoạch là quyết định chi tiền: mọi thiết bị đưa vào phải có đơn giá mới trình được (máy chủ cũng chặn).
  const unpriced = included.filter((l) => !(Number(l.unitPrice) > 0));
  const proposals = new Set(lines.map((l) => l.proposalId));
  const schools = new Set(lines.map((l) => l.school.id));

  async function save(values: Values): Promise<number | undefined> {
    const res: any = await onFinish({
      title: values.title,
      schoolYear: values.schoolYear?.id ? { id: values.schoolYear.id } : null,
      planDate: values.planDate,
      note: values.note,
      lines: values.lines.map((l) => ({ lineId: l.lineId, plannedQuantity: l.plannedQuantity, unitPrice: l.unitPrice })),
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
  const setPrice = (lineId: number, value: number | null) =>
    setLines(lines.map((l) => (l.lineId === lineId ? { ...l, unitPrice: value } : l)));
  // Kế hoạch gom nhiều trường: một thiết bị lặp ở nhiều đề xuất — gõ giá dự toán một lần, áp cho các dòng cùng thiết bị.
  const applyPrice = (catalogId: number, value: number) =>
    setLines(lines.map((l) => (l.catalog.id === catalogId ? { ...l, unitPrice: value } : l)));

  const [picking, setPicking] = useState(false);
  // Đề xuất đang thu gọn trong bảng dòng (bấm mũi tên ở dòng tiêu đề của đề xuất).
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  // Bảng dòng chia trang THEO ĐỀ XUẤT: một đề xuất nằm trọn một trang, không bị cắt đôi giữa hai trang.
  const groups = useMemo(() => {
    const m = new Map<number, PlanLine[]>();
    for (const l of lines) m.set(l.proposalId, [...(m.get(l.proposalId) ?? []), l]);
    return [...m.values()];
  }, [lines]);
  const paged = usePagedRows(groups, { sizeKey: "planLines", pageSizeLabel: "Số đề xuất mỗi trang", defaultSize: 5 });
  const toggleGroup = (proposalId: number) => setCollapsed((prev) => {
    const next = new Set(prev);
    if (next.has(proposalId)) next.delete(proposalId); else next.add(proposalId);
    return next;
  });
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
            <ViewFact label="Năm học">{plan.schoolYear ? `Năm học ${yearLabel(plan.schoolYear)}` : `Năm ngân sách ${plan.budgetYear}`}</ViewFact>
            <ViewFact label="Người lập">{plan.createdBy?.name ?? <span className="text-muted-foreground">Không rõ</span>}</ViewFact>
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
          <DateField control={control} name="planDate" label="Ngày lập" dateRule="PAST_OR_TODAY" rules={{ required: "Chọn ngày lập" }} />
          <RefField control={control} name="schoolYear" resource="school_years" label="Năm học" required labelField="name" current={plan?.schoolYear ?? undefined} />
          <div className="grid gap-2">
            <Label>Người lập</Label>
            <Input readOnly tabIndex={-1} className="bg-muted/60"
              value={plan ? (plan.createdBy?.name ?? "Không rõ") : (me?.fullName ?? me?.username ?? "")} />
          </div>
          <TextareaField control={control} name="note" label="Mô tả" rule="LONG_TEXT" max={1000} inGrid placeholder="Mục đích, phạm vi của kế hoạch" />
        </fieldset>
        )}
      </Card>

      <Card id="plan-lines" className="gap-0 overflow-hidden py-0">
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
          <CandidatesDialog planId={plan?.id} schoolYearId={yearId ?? null} exclude={proposals} extra={removed} onAdd={addCandidates}
            open={picking} onOpenChange={setPicking} />
        ) : null}
        {editable && lines.length === 0 ? (
          <AddLinesEmpty label="Thêm đề xuất" hint="Đề xuất đã duyệt của các trường" onClick={() => setPicking(true)} />
        ) : (
          <>
            <PlanLinesTable lines={lines} groups={paged.visible} editable={editable} onPlanned={setPlanned} onPrice={setPrice}
              onApplyPrice={applyPrice} onRemove={removeProposal} collapsed={collapsed} onToggle={toggleGroup} />
            {paged.pager}
          </>
        )}
      </Card>
    </>
  );

  // "Kiểm tra trước khi trình" — cùng kiểu các phiếu (CompletionList): mục thiếu chữ vàng, đạt chữ xanh; bấm mục thiếu
  // thì đưa tới đúng chỗ, ô viền đỏ kèm câu nhắc. Cùng luật máy chủ kiểm lúc trình (ProcurementPlanService).
  const values = useWatch({ control }) as Partial<Values>;
  const mark = (name: "title" | "planDate" | "schoolYear", message: string) => {
    form.setError(name, { type: MISSING, message });
    form.setFocus(name === "schoolYear" ? "schoolYear.id" as any : name);
    document.getElementsByName(name)[0]?.scrollIntoView({ block: "center", behavior: "smooth" });
  };
  const firstUnpriced = unpriced[0];
  const checklist: ChecklistItem[] = [
    { key: "title", label: "Tên kế hoạch", ok: !!values.title?.trim(), onClick: () => mark("title", "Nhập tên kế hoạch") },
    { key: "planDate", label: "Ngày lập", ok: !!values.planDate, onClick: () => mark("planDate", "Chọn ngày lập") },
    { key: "schoolYear", label: "Năm học", ok: !!values.schoolYear?.id, onClick: () => mark("schoolYear", "Chọn năm học") },
    {
      key: "lines", label: "Thiết bị đưa vào kế hoạch", ok: included.length > 0,
      hint: lines.length ? "Mọi dòng đang để 0" : "Thêm đề xuất đã duyệt của các trường",
      onClick: () => (lines.length ? document.getElementById("plan-lines")?.scrollIntoView({ block: "start", behavior: "smooth" }) : setPicking(true)),
    },
    {
      key: "price", label: "Đơn giá dự toán", ok: included.length > 0 && unpriced.length === 0,
      hint: unpriced.length ? `Còn ${unpriced.length} thiết bị chưa có giá` : undefined,
      onClick: () => {
        if (!firstUnpriced) return;
        // Lật tới trang có đề xuất chứa dòng đó; đề xuất đang thu gọn thì mở ra; đợi vẽ lại rồi mới tìm ô giá.
        paged.setPage(paged.pageOf(groups.findIndex((g) => g[0].proposalId === firstUnpriced.proposalId)));
        setCollapsed((prev) => {
          const next = new Set(prev);
          next.delete(firstUnpriced.proposalId);
          return next;
        });
        setTimeout(() => {
          const cell = document.getElementById(`plan-price-${firstUnpriced.lineId}`);
          cell?.scrollIntoView({ block: "center", behavior: "smooth" });
          cell?.querySelector("input")?.focus();
        }, 50);
      },
    },
  ];
  const missing = checklist.filter((i) => !i.ok);
  // Ô đã điền thì gỡ viền đỏ do bấm mục thiếu.
  const filled = { title: !!values.title?.trim(), planDate: !!values.planDate, schoolYear: !!values.schoolYear?.id };
  useEffect(() => {
    (Object.keys(filled) as (keyof typeof filled)[]).forEach((name) => {
      if (filled[name] && form.getFieldState(name).error?.type === MISSING) form.clearErrors(name);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filled.title, filled.planDate, filled.schoolYear, form]);

  const side = (
    <Card className="gap-0 py-0">
      <SideSection title="Kế hoạch mua sắm" aside={plan ? <PlanStatusBadge status={plan.status} /> : null}>
        <SideFact label="Mã">{plan?.code ? <span className="font-mono">{plan.code}</span> : <span className="text-muted-foreground font-normal">Cấp khi lưu</span>}</SideFact>
        {plan ? <SideFact label="Sở">{plan.managingBody.name}</SideFact> : null}
        {plan?.approvedAt ? <SideFact label="Duyệt lúc">{formatDateTime(plan.approvedAt)}</SideFact> : null}
      </SideSection>
      {/* Các khối thông tin liền nhau, không kẻ ngang — chỉ một đường ngăn trên cụm nút. */}
      <SideSection title="Tổng giá trị dự toán" className={FLAT}>
        <p className="text-2xl font-bold tabular-nums">{money.format(totalAmount)} đ</p>
        <p className="text-muted-foreground text-xs">Bằng chữ: {moneyInWords(totalAmount)}.</p>
      </SideSection>
      <SideSection title="Phạm vi" className={FLAT}>
        <SideFact label="Số đề xuất">{proposals.size}</SideFact>
        <SideFact label="Số trường">{schools.size}</SideFact>
        <SideFact label="Thiết bị đưa vào">{included.length} dòng · {money.format(totalQty)}</SideFact>
      </SideSection>
      {plan?.status === "APPROVED" && plan.approvalNote ? (
        <SideSection title="Ý kiến duyệt" className={FLAT}>
          <p className="text-sm">{plan.approvalNote}</p>
        </SideSection>
      ) : null}
      {editable ? (
        <SideSection title={missing.length ? `Cần hoàn thiện (${missing.length})` : "Kiểm tra trước khi trình"} className={FLAT}>
          <CompletionList items={checklist} showDone />
        </SideSection>
      ) : null}
      {editable ? (
        <SideSection className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant="outline" className="min-w-0" disabled={busy !== null} onClick={() => void onSave()}>
              {busy === "save" ? <Loader2 className="animate-spin" /> : <Save />}
              <span className="truncate">Lưu nháp</span>
            </Button>
            <Button type="button" className="min-w-0" disabled={busy !== null || missing.length > 0}
              onClick={() => setConfirmSubmit(true)}>
              {busy === "submit" ? <Loader2 className="animate-spin" /> : <Send />}
              <span className="truncate">Trình duyệt</span>
            </Button>
          </div>
          {/* Như nút "Quay lại" của form phiếu: về danh sách kế hoạch, có hỏi lại nếu đang sửa dở. */}
          <Button type="button" variant="outline" className="w-full" disabled={busy !== null}
            onClick={() => confirmDiscard(() => list(RESOURCE, "replace"))}>
            <ArrowLeft />
            Quay lại
          </Button>
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
          description={`${included.length} thiết bị, tổng ${money.format(totalAmount)} đ. Lãnh đạo Sở sẽ duyệt hoặc trả lại; trong lúc chờ không sửa được kế hoạch.`}
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
function PlanLinesTable({ lines, groups, editable, onPlanned, onPrice, onApplyPrice, onRemove, collapsed, onToggle }: {
  /** Mọi dòng của kế hoạch (để gợi ý áp chung giá cho cùng thiết bị). */
  lines: PlanLine[];
  /** Các đề xuất của TRANG đang xem, mỗi đề xuất một nhóm dòng. */
  groups: PlanLine[][];
  /** Đề xuất đang thu gọn (chỉ còn dòng tiêu đề) — giữ ở màn cha để "Kiểm tra trước khi trình" mở đúng nhóm. */
  collapsed: Set<number>;
  onToggle: (proposalId: number) => void;
  editable: boolean;
  onPlanned: (lineId: number, value: number) => void;
  /**
   * Sở nhập / sửa đơn giá DỰ TOÁN — trường không bắt buộc ghi giá lúc đề xuất. Giá thật (nguyên giá tài sản) do
   * trường ghi theo chứng từ ở phiếu ghi tăng.
   */
  onPrice: (lineId: number, value: number | null) => void;
  /** Áp một giá dự toán cho mọi dòng cùng thiết bị (nhiều trường xin cùng thiết bị). */
  onApplyPrice: (catalogId: number, value: number) => void;
  onRemove: (proposalId: number) => void;
}) {
  const cols = editable ? 6 : 5;
  return (
    <Table>
      <TableHeader className="bg-surface-subtle">
        <TableRow>
          {editable ? <TableHead className="w-10 ps-4" /> : null}
          <TableHead className={cn("text-overline text-muted-foreground", !editable && "ps-4")}>Thiết bị</TableHead>
          <TableHead className="text-overline text-muted-foreground w-24 text-right">SL đề nghị</TableHead>
          <TableHead className="text-overline text-muted-foreground w-40 pe-[3.25rem] text-right">SL đưa vào KH</TableHead>
          <TableHead className="text-overline text-muted-foreground w-44 text-right">Đơn giá dự toán</TableHead>
          <TableHead className="text-overline text-muted-foreground w-36 pe-4 text-right">Thành tiền</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {groups.length === 0 ? (
          <TableEmpty colSpan={cols} compact title={<>Kế hoạch chưa có đề xuất nào.</>} />
        ) : groups.map((g) => {
          const head = g[0];
          const closed = collapsed.has(head.proposalId);
          const groupIn = g.filter((l) => l.plannedQuantity > 0);
          const groupUnpriced = groupIn.filter((l) => !(Number(l.unitPrice) > 0)).length;
          const groupAmount = groupIn.reduce((s, l) => s + (Number(l.unitPrice) || 0) * l.plannedQuantity, 0);
          return [
            <TableRow key={`p${head.proposalId}`} className="bg-muted/40 hover:bg-muted/60 cursor-pointer"
              // Bấm dòng tiêu đề của đề xuất để thu gọn / mở các dòng thiết bị bên dưới.
              onClick={() => onToggle(head.proposalId)}>
              <TableCell colSpan={cols} className="ps-2 py-2">
                <div className="flex items-center gap-2 text-sm">
                  <Button type="button" variant="ghost" size="icon" className="size-7"
                    aria-expanded={!closed} aria-label={closed ? "Mở các dòng thiết bị" : "Thu gọn các dòng thiết bị"}
                    onClick={(e) => { e.stopPropagation(); onToggle(head.proposalId); }}>
                    <ChevronDown className={cn("transition-transform", closed && "-rotate-90")} />
                  </Button>
                  <Link className="text-primary font-mono text-xs font-medium hover:underline" to={`/purchase-proposals/show/${head.proposalId}`}
                    onClick={(e) => e.stopPropagation()}>
                    {head.proposalCode ?? "Đề xuất"}
                  </Link>
                  <span className="font-medium">{head.school.name}</span>
                  <span className="text-muted-foreground text-xs">· {g.length} thiết bị</span>
                  {/* Thu gọn thì tiêu đề nói đủ: đưa vào bao nhiêu dòng, còn thiếu giá không, thành tiền. */}
                  {closed ? (
                    <span className="text-muted-foreground text-xs tabular-nums">
                      · đưa vào {groupIn.length}/{g.length}
                      {groupUnpriced ? <span className="text-warning-text"> · {groupUnpriced} chưa có giá</span> : null}
                      {" · "}{money.format(groupAmount)} đ
                    </span>
                  ) : null}
                  {editable ? (
                    <Button type="button" variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive-text ms-auto h-7"
                      onClick={(e) => { e.stopPropagation(); onRemove(head.proposalId); }}>
                      <X />
                      Rút khỏi kế hoạch
                    </Button>
                  ) : null}
                </div>
              </TableCell>
            </TableRow>,
            ...(closed ? [] : g).map((l) => {
              const off = l.plannedQuantity === 0;
              const cut = l.requestedQuantity - l.plannedQuantity;
              const price = Number(l.unitPrice) > 0 ? Number(l.unitPrice) : null;
              // Dòng khác cùng thiết bị mà giá dự toán còn khác — gợi ý áp chung.
              const sameOthers = lines.filter((x) => x.catalog.id === l.catalog.id && x.lineId !== l.lineId && Number(x.unitPrice) !== price);
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
                      {l.catalog.code}
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {money.format(l.requestedQuantity)} <span className="text-muted-foreground text-xs">{l.unitName ?? ""}</span>
                  </TableCell>
                  <TableCell className="text-right">
                    {/* Ô số và ghi chú bớt / bỏ cùng MỘT hàng, ghi chú có chỗ cố định bên phải: dòng có ghi chú không
                        cao hơn dòng khác, ô số các dòng thẳng cột. */}
                    <div className="flex items-center justify-end gap-2">
                      {editable ? (
                        <Input type="number" min={0} max={l.requestedQuantity} step={1} value={l.plannedQuantity}
                          onChange={(e) => onPlanned(l.lineId, Math.max(0, Math.floor(Number(e.target.value || 0))))}
                          className="h-8 w-20 text-right tabular-nums" aria-label="Số đưa vào kế hoạch" />
                      ) : (
                        <span className="font-medium tabular-nums">{money.format(l.plannedQuantity)}</span>
                      )}
                      <span className="w-11 shrink-0 text-start text-[0.6875rem] leading-tight tabular-nums">
                        {/* Khung gợi ý của hệ thống (Tooltip), không dùng `title` mặc định của trình duyệt. */}
                        {off ? (
                          <Tooltip>
                            <TooltipTrigger asChild><span className="cursor-default">Bỏ</span></TooltipTrigger>
                            <TooltipContent>Không đưa vào kế hoạch</TooltipContent>
                          </Tooltip>
                        ) : cut > 0 ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-warning-text cursor-default font-medium">−{money.format(cut)}</span>
                            </TooltipTrigger>
                            <TooltipContent>Bớt {money.format(cut)} so với số trường đề nghị</TooltipContent>
                          </Tooltip>
                        ) : null}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell id={`plan-price-${l.lineId}`} className="text-right tabular-nums">
                    {editable ? (
                      <MoneyInput value={l.unitPrice} onChange={(v) => onPrice(l.lineId, v)} placeholder="Nhập giá"
                        aria-label="Đơn giá dự toán" aria-invalid={!off && !price ? true : undefined}
                        maxValue={numberMax("MONEY")} className="ms-auto h-8 w-full text-right" />
                    ) : l.unitPrice != null ? money.format(l.unitPrice) : <span className="text-muted-foreground text-xs">Chưa có giá</span>}
                    {editable && l.proposedUnitPrice != null && Number(l.unitPrice) !== Number(l.proposedUnitPrice) ? (
                      <span className="text-muted-foreground mt-1 block text-[0.6875rem]">Trường tham khảo {money.format(l.proposedUnitPrice)}</span>
                    ) : null}
                    {editable && price && sameOthers.length ? (
                      <button type="button" className="text-primary mt-1 block w-full text-right text-[0.6875rem] font-medium hover:underline"
                        onClick={() => onApplyPrice(l.catalog.id, price)}>
                        Áp cho {sameOthers.length} dòng cùng thiết bị
                      </button>
                    ) : null}
                  </TableCell>
                  <TableCell className="pe-4 text-right font-medium tabular-nums">{money.format((l.unitPrice ?? 0) * l.plannedQuantity)}</TableCell>
                </TableRow>
              );
            }),
          ];
        })}
      </TableBody>
    </Table>
  );
}

/**
 * Chọn đề xuất đã duyệt, chưa vào kế hoạch nào, của các trường Sở lập kế hoạch quản lý — cùng năm ngân sách với
 * năm học đang chọn trên màn (máy chủ lọc, lúc lưu cũng kiểm).
 */
function CandidatesDialog({ planId, schoolYearId, exclude, extra, onAdd, open, onOpenChange: setOpen }: {
  planId?: number;
  schoolYearId: number | null;
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
    queryKey: [RESOURCE, planId ?? "new", "candidates", schoolYearId],
    enabled: open,
    queryFn: ({ signal }) => kyInstance.get(planId ? `${RESOURCE}/${planId}/candidates` : `${RESOURCE}/candidates`, {
      signal, searchParams: schoolYearId != null ? { schoolYearId } : undefined,
    }).json<PlanCandidate[]>(),
  });
  const rows = [...extra, ...(Array.isArray(data) ? data : [])]
    .filter((c, i, all) => !exclude.has(c.proposal.id) && all.findIndex((x) => x.proposal.id === c.proposal.id) === i);
  const paged = usePagedRows(rows, { resetKey: String(open), sizeKey: "planCandidates", pageSizeLabel: "Số đề xuất mỗi trang" });
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
            <DialogDescription>Đề xuất đã được duyệt, chưa nằm trong kế hoạch nào, cùng năm ngân sách với năm học của kế hoạch. Bấm một dòng để chọn.</DialogDescription>
          </DialogHeader>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border">
          <div ref={paged.boxRef} className="min-h-0 flex-1 overflow-auto [&>[data-slot=table-container]]:overflow-visible [&_tbody_tr:last-child]:border-b">
            <Table>
              <TableHeader className="bg-surface-subtle sticky top-0">
                <TableRow>
                  <TableHead className="w-10" />
                  <TableHead className="text-overline text-muted-foreground">Số phiếu</TableHead>
                  <TableHead className="text-overline text-muted-foreground">Trường</TableHead>
                  <TableHead className="text-overline text-muted-foreground text-right">Thiết bị</TableHead>
                  <TableHead className="text-overline text-muted-foreground text-right">Giá tham khảo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableEmpty colSpan={5} compact loading={isLoading} title={<>Không có đề xuất nào đang chờ vào kế hoạch.</>} />
                ) : paged.visible.map((c) => (
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
          {paged.pager}
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
    approve: { label: "Duyệt", icon: <Check />, title: "Duyệt kế hoạch mua sắm?", desc: `${plan.proposalCount ?? 0} đề xuất trong kế hoạch sẽ hoàn tất; các trường lập phiếu ghi tăng theo số đưa vào kế hoạch khi hàng về. Đề xuất mọi dòng đều để 0 sẽ rời kế hoạch, về lại "Đã duyệt" để vào kế hoạch sau.`, ok: "Đã duyệt kế hoạch" },
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
          confirmDisabled={step === "return" && !!textError("REASON", "Lý do", note.trim() || "", 500, 5) || (step === "return" && !note.trim())}
          onConfirm={() => void run()}
        >
          <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} maxLength={maxLengthOf("NOTE")}
            placeholder={step === "return" ? "Lý do trả lại (bắt buộc)" : "Ý kiến (không bắt buộc)"} />
        </ConfirmContent>
      </AlertDialog>
    </>
  );
}

/** Xuất Excel: chi tiết theo dòng đề xuất và tổng hợp theo thiết bị (`GET /procurement_plans/{id}/export.xlsx`). */
export function ExportButton({ plan }: { plan: ProcurementPlan }) {
  const { open: notify } = useNotification();
  const menu = useRowActionsMenu();
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
      menu?.close();
    }
  };
  return (
    <Button type="button" variant="ghost" size="sm" className={ROW_ACTION_ITEM} disabled={busy} onClick={() => void run()}>
      {busy ? <Loader2 className="animate-spin" /> : <FileSpreadsheet />}
      Xuất Excel
    </Button>
  );
}
