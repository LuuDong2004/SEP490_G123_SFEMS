import { useCan, useCustom, useInvalidate, useList, useNotification, useOne, type CrudFilter } from "@refinedev/core";
import { BookOpen, GraduationCap, ChevronDown, ChevronLeft, FileSpreadsheet, Loader2, Upload, ChevronRight, ChevronsLeft, ChevronsRight, CopyPlus, Ellipsis, ExternalLink, FileText, Pencil, Plus, Printer, Search, ShieldCheck, Trash2, FunnelX, CalendarRange, History, Undo2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { keepPreviousData } from "@tanstack/react-query";
import { useFormContext, useWatch, type Control } from "react-hook-form";
import { useNavigate } from "react-router";

import { API_URL } from "@/shared/api/constants";
import { FillBox } from "@/shared/components/layout/fill-box";
import { kyInstance, DOWNLOAD_TIMEOUT } from "@/shared/api/data";
import { errorMessage } from "@/shared/lib/api-error";
import { usePersistentState } from "@/shared/hooks/use-persistent-state";
import { cn } from "@/shared/lib/utils";
import { formatDateTime, formatPlainDate } from "@/shared/lib/format";
import { ListView, ListViewHeader } from "@/shared/components/views/list-view";
import { DeleteButton } from "@/shared/components/buttons/delete";
import { RefField } from "@/shared/components/catalog/ref-field";
import { FormDialog, type FormDialogState } from "@/shared/components/catalog/form-dialog";
import { AsyncCombobox } from "@/shared/components/form/async-combobox";
import { IconFilter } from "@/shared/components/data-table/icon-filter";
import { FormSection } from "@/shared/components/form/form-section";
import { AttachmentsPanel } from "@/shared/components/voucher/attachments-panel";
import { PrintSheet } from "@/shared/components/print/print-sheet";
import { SelectField, TextareaField, TextField } from "@/shared/components/form/simple-fields";
import { AlertDialog } from "@/shared/ui/alert-dialog";
import { ConfirmContent } from "@/shared/components/confirm/confirm-content";
import { Badge } from "@/shared/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/shared/ui/form";
import { Input } from "@/shared/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Sheet, SheetClose, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/shared/ui/sheet";
import { Skeleton } from "@/shared/ui/skeleton";
import { Segmented } from "@/shared/components/segmented";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import {
  DOCUMENT_ROLE_LABELS,
  REVISION_KIND_LABELS,
  LEVEL_GRADES,
  NORM_BASIS_LABELS,
  gradesLabel,
  quantityLabel,
  type EquipmentNorm,
  type NormSubjectGroup,
} from "@/domains/equipment-standard/types";
import { TRACKING_TYPE_LABELS } from "@/domains/equipment-catalog/types";

import { EquipmentCatalogDetail } from "./equipment-catalog-profile";
import { useLevelParam } from "./level-picker";
import { ReviseDialog, type ReviseTarget } from "./revise-dialog";
import { countsText, StandardChangesButton, useStandardChanges, type StandardChange } from "./standard-changes";
import { StandardProfileForm } from "./standard-profile-form";
import { LIFT_ROW } from "@/shared/lib/row-lift";
import { TableEmpty } from "@/shared/components/data-table/table-empty";

/* eslint-disable @typescript-eslint/no-explicit-any */

const ALL = "__all__";

type StandardStatus = "DRAFT" | "ACTIVE" | "RETIRED";
const STATUS_LABEL: Record<StandardStatus, string> = { DRAFT: "Bản nháp", ACTIVE: "Đang áp dụng", RETIRED: "Hết hiệu lực" };
const STATUS_VARIANT: Record<StandardStatus, "warning" | "success" | "neutral"> = { DRAFT: "warning", ACTIVE: "success", RETIRED: "neutral" };

const NORMS = "equipment_norms";

/**
 * Danh mục thiết bị dạy học tối thiểu — MỘT bảng gọn cho mỗi bộ (mỗi cấp học là một bộ, căn cứ TT 37 / 38 / 39 và
 * các văn bản sửa đổi). Đầu khung nói bộ nào, trạng thái, căn cứ; dưới là tìm, lọc môn / lớp và — ở bản nháp — "Thay
 * đổi" (chỉ dòng Mới / Đổi / Bỏ so với bộ đang dùng). Bảng gom theo môn, mỗi dòng một thiết bị: cần bao nhiêu, cho
 * ai, lớp nào, căn cứ văn bản nào. Bấm dòng mở ngăn bên phải; bản nháp sửa / bỏ dòng từ ngăn đó.
 */
export function MinimumCatalog() {
  const { result: standardsResult } = useList<any>({
    resource: "equipment_standards",
    pagination: { pageSize: 50 },
    sorters: [{ field: "sortOrder", order: "asc" }],
  });
  const standards = useMemo(() => standardsResult?.data ?? [], [standardsResult]);
  // Thông tư Sở chọn điều chỉnh khi Lập bộ mới: bộ ĐANG ÁP DỤNG của từng cấp, gọi theo thông tư gốc (TT 37 / 38 / 39).
  // Cấp đang có bản nháp chưa áp dụng thì không chọn được.
  const reviseTargets = useMemo<ReviseTarget[]>(() => standards
    .filter((s) => s.status === "ACTIVE")
    .map((s) => {
      const main = (s.documents ?? []).find((d: any) => d.documentRole === "main");
      return {
        id: s.id,
        circular: (main?.documentNo ?? s.code).replace(/\/TT-.*$/i, ""),
        level: s.educationLevel?.name ?? "",
        version: s.standardVersion ?? null,
        busy: standards.some((d) => d.status === "DRAFT" && d.previousStandard?.id === s.id),
      };
    })
    .sort((a, b) => a.circular.localeCompare(b.circular, "vi", { numeric: true })), [standards]);
  // Văn bản của MỌI bộ theo id — dòng bị bỏ thuộc bộ trước, căn cứ của nó nằm ở bộ đó.
  const docIndex = useMemo(() => {
    const map = new Map<number, StandardDoc>();
    for (const s of standards) for (const d of (s.documents ?? []) as StandardDoc[]) map.set(d.id, d);
    return map;
  }, [standards]);
  const levels = useMemo(() => {
    const seen = new Map<number, any>();
    for (const s of standards) if (s.educationLevel && !seen.has(s.educationLevel.id)) seen.set(s.educationLevel.id, s.educationLevel);
    return [...seen.values()];
  }, [standards]);
  const [levelId, setLevelId] = usePersistentState<number | null>("tbdh.level", null, "local");
  const [standardId, setStandardId] = usePersistentState<number | null>("tbdh.standard", null, "local");
  const levelOf = (s: any) => s?.educationLevel?.id ?? null;
  // Cấp học chọn ở menu xổ của TAB (?level=TH|THCS|THPT|outside). Địa chỉ không có cấp thì mở cấp xem lần trước.
  const remembered = levels.find((l) => l.id === levelId) ?? levels[0];
  const { outside, level: pickedLevel } = useLevelParam(levels, remembered?.code);
  const currentLevel = pickedLevel ?? remembered;
  const levelStandards = standards.filter((s) => levelOf(s) === currentLevel?.id);
  const standard =
    levelStandards.find((s) => s.id === standardId) ??
    levelStandards.find((s) => s.status === "ACTIVE") ??
    levelStandards[0];
  const status: StandardStatus = standard?.status ?? "ACTIVE";
  const editable = status === "DRAFT";
  const level: string | undefined = standard?.educationLevel?.code;

  const [q, setQ] = useState("");
  const [applied, setApplied] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setApplied(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);
  const [grade, setGrade] = useState(ALL);
  // Bản nháp: cả bộ, hay chỉ dòng Mới / Đổi / Bỏ so với bộ đang dùng.
  const [view, setView] = useState<"all" | "changes">("all");
  useEffect(() => {
    setGrade(ALL);
    setView("all");
  }, [standard?.id]);

  const filters: CrudFilter[] = useMemo(
    () => [
      { field: "standard.id", operator: "eq", value: standard?.id },
      ...(applied ? [{ field: "q", operator: "contains" as const, value: applied }] : []),
      ...(grade !== ALL ? [{ field: "gradeLevel", operator: "eq" as const, value: grade }] : []),
    ],
    [standard?.id, applied, grade],
  );
  const query: Record<string, string> = { "standard.id": String(standard?.id ?? "") };
  if (applied) query.q = applied;
  if (grade !== ALL) query.gradeLevel = grade;
  const { result: groupsResult, query: groupsQuery } = useCustom<NormSubjectGroup[]>({
    url: `${API_URL}/${NORMS}/groups`,
    method: "get",
    config: { query },
    queryOptions: { enabled: !!standard?.id },
  });
  const groupsData = groupsResult?.data;
  const groups: NormSubjectGroup[] = useMemo(
    () => (Array.isArray(groupsData) ? (groupsData as NormSubjectGroup[]) : []),
    [groupsData],
  );
  const total = groups.reduce((n, g) => n + g.count, 0);
  const devices = groups.reduce((n, g) => n + (g.catalogs ?? g.count), 0);
  const filtering = !!applied || grade !== ALL;

  const [subjectKey, setSubjectKey] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = usePersistentState<number>("tbdh.pageSize", PAGE, "local");
  const [rowTotal, setRowTotal] = useState(0);
  useEffect(() => setPage(1), [standard?.id, subjectKey, applied, grade]);
  const allSubjects = subjectKey === null || subjectKey === ALL;
  const subject = allSubjects ? undefined : groups.find((g) => String(g.subjectId) === subjectKey);
  useEffect(() => {
    if (!pickedLevel || pickedLevel.id === levelId) return;
    setLevelId(pickedLevel.id);
    setStandardId(null);
    setSubjectKey(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickedLevel?.id]);
  const subjectFilters: CrudFilter[] = subject ? [...filters, { field: "subject.id", operator: "eq", value: subject.subjectId ?? "none" }] : filters;

  // Thay đổi của bản nháp so với bộ nó thay — nhãn Mới / Đổi / Bỏ trên từng dòng.
  const tracksChanges = editable && !!standard?.previousStandard;
  const changes = useStandardChanges(standard?.id, tracksChanges);
  const changeById = useMemo(() => {
    const map = new Map<number, StandardChange>();
    for (const c of changes.rows) if (c.normId != null) map.set(c.normId, c);
    return map;
  }, [changes.rows]);
  const changeCount = changes.rows.length;
  const showChanges = tracksChanges && view === "changes";

  const mayCreate = useCan({ resource: NORMS, action: "create" }).data?.can ?? false;
  const mayEditStandard = useCan({ resource: "equipment_standards", action: "edit" }).data?.can ?? false;
  // Dòng đang mở ở ngăn bên phải (id dòng; dòng bị bỏ là id của bộ trước).
  const [opened, setOpened] = useState<number | null>(null);
  const [viewingCatalog, setViewingCatalog] = useState<CatalogView | null>(null);
  const [form, setForm] = useState<FormDialogState>({ open: false });
  const [profile, setProfile] = useState<ProfileMode>(null);

  const invalidate = useInvalidate();
  const { open: notify } = useNotification();
  const [lifecycle, setLifecycle] = useState<"revise" | "apply" | "discard" | null>(null);
  const applyDiff = useStandardChanges(standard?.id, lifecycle === "apply");
  // Ngày văn bản lần sửa có hiệu lực (đính chính không ghi thì ngày ban hành) — còn ở tương lai thì chưa áp dụng được.
  const revisionDoc: StandardDoc | undefined = ((standard?.documents ?? []) as StandardDoc[]).find((d) => d.id === standard?.revisionDocumentId);
  const notInForce = useMemo(() => {
    const from: string | null = revisionDoc?.effectiveDate ?? revisionDoc?.issueDate ?? null;
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    return from && from > today ? from : null;
  }, [revisionDoc]);
  const [busy, setBusy] = useState(false);
  const activeOfLevel = levelStandards.find((s) => s.status === "ACTIVE");
  const siblingDrafts = useMemo(() => {
    const docNo = (s: any) => (s.documents ?? []).find((d: any) => d.id === s.revisionDocumentId)?.documentNo;
    const mine = standard?.status === "DRAFT" ? docNo(standard) : undefined;
    if (!mine) return [];
    return standards
      .filter((s) => s.status === "DRAFT" && s.id !== standard?.id && docNo(s) === mine)
      .map((s) => s.educationLevel?.name ?? s.code);
  }, [standards, standard]);
  const docsLine = ((standard?.documents ?? []) as StandardDoc[]).map((d) => d.documentNo).join(", ");

  const exportQuery: Record<string, string> = { ...query, ...(subject ? { "subject.id": String(subject.subjectId ?? "none") } : {}) };
  const [printRows, setPrintRows] = useState<EquipmentNorm[] | null>(null);
  const [transfer, setTransfer] = useState<"xlsx" | "pdf" | "import" | null>(null);
  const importInput = useRef<HTMLInputElement>(null);
  const levelName: string = standard?.educationLevel?.name ?? "";

  const exportXlsx = async () => {
    setTransfer("xlsx");
    try {
      const blob = await kyInstance.get("equipment_norms/export.xlsx", { searchParams: exportQuery, timeout: DOWNLOAD_TIMEOUT }).blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Danh mục tối thiểu - ${standard?.educationLevel?.code ?? "Bộ"}.xlsx`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      notify?.({ type: "error", message: await errorMessage(error), description: "Không xuất được Excel" });
    } finally {
      setTransfer(null);
    }
  };

  /** PDF = "In → Lưu thành PDF" của trình duyệt trên bản in (PrintSheet): đọc HẾT các dòng đang lọc rồi in. */
  const exportPdf = async () => {
    setTransfer("pdf");
    try {
      const rows = await kyInstance
        .get("equipment_norms", { searchParams: { ...exportQuery, _start: "0", _end: "3000", _sort: "sortOrder", _order: "asc" } })
        .json<EquipmentNorm[]>();
      setPrintRows(rows);
    } catch (error) {
      notify?.({ type: "error", message: await errorMessage(error), description: "Không tạo được bản in" });
      setTransfer(null);
    }
  };
  useEffect(() => {
    if (!printRows) return;
    const done = () => {
      setPrintRows(null);
      setTransfer(null);
    };
    window.addEventListener("afterprint", done, { once: true });
    const t = setTimeout(() => window.print(), 50);
    return () => {
      clearTimeout(t);
      window.removeEventListener("afterprint", done);
    };
  }, [printRows]);

  /** Nhập từ Excel vào BỘ NHÁP — cùng khuôn cột với file xuất; tất cả hoặc không gì. */
  const importXlsx = async (file: File) => {
    if (!standard) return;
    setTransfer("import");
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("standardId", String(standard.id));
      const res = await kyInstance.post("equipment_norms/import", { body }).json<{ created: number }>();
      notify?.({ type: "success", message: `Đã nhập ${res.created} dòng vào bản nháp.` });
      invalidate({ resource: NORMS, invalidates: ["list"] });
      invalidate({ resource: "equipment_catalogs", invalidates: ["list"] });
    } catch (error) {
      notify?.({ type: "error", message: await errorMessage(error), description: "Không nhập được, chưa có dòng nào được ghi" });
    } finally {
      setTransfer(null);
      if (importInput.current) importInput.current.value = "";
    }
  };

  const afterLifecycle = () => {
    invalidate({ resource: "equipment_standards", invalidates: ["list", "detail"] });
    invalidate({ resource: NORMS, invalidates: ["list"] });
    invalidate({ resource: "equipment_catalogs", invalidates: ["list"] });
    setLifecycle(null);
  };
  const runLifecycle = async () => {
    if (!standard || !lifecycle || lifecycle === "revise") return;
    setBusy(true);
    try {
      if (lifecycle === "apply") {
        await kyInstance.post(`equipment_standards/${standard.id}/apply`);
        notify?.({ type: "success", message: "Đã áp dụng bộ mới. Bộ cũ hết hiệu lực." });
      } else {
        await kyInstance.delete(`equipment_standards/${standard.id}`);
        setStandardId(activeOfLevel?.id ?? null);
        notify?.({ type: "success", message: "Đã xoá bộ nháp." });
      }
      afterLifecycle();
    } catch (error) {
      notify?.({ type: "error", message: await errorMessage(error), description: "Không thực hiện được" });
    } finally {
      setBusy(false);
    }
  };

  const ctx: RowContext = { level, docIndex, status, revisionDocId: standard?.revisionDocumentId ?? null, changeById };
  const cols = editable ? EDITABLE_COLS : EDITABLE_COLS - 1;
  const subjectItems = groups.map((g) => ({ key: String(g.subjectId), label: g.subjectName ?? "Chưa gắn môn", count: g.catalogs ?? g.count }));
  const clearFilters = () => {
    setQ("");
    setGrade(ALL);
    setSubjectKey(null);
  };

  return (
    <ListView className="print:[&>*:not([data-print-sheet])]:hidden">
      {printRows ? (
        <div data-print-sheet>
          <PrintSheet
            title={`Danh mục thiết bị dạy học tối thiểu cấp ${levelName.toLowerCase()}`}
            subtitle={docsLine ? `Nguồn: ${docsLine}` : undefined}
            table={{
              headers: ["STT", "Môn học", "Chủ đề dạy học", "Tên thiết bị", "Mục đích sử dụng", "Mô tả chi tiết", "Đối tượng", "Đơn vị", "Số lượng", "Ghi chú"],
              rows: printRows.map((r, i) => [
                i + 1,
                r.subject?.name ?? "",
                topicOf(r) ?? "",
                r.name,
                <span key="p" className="whitespace-pre-line">{r.purpose ?? ""}</span>,
                <span key="d" className="whitespace-pre-line">{r.description ?? ""}</span>,
                [r.forTeacher ? "Giáo viên" : null, r.forStudent ? "Học sinh" : null].filter(Boolean).join(", "),
                r.unit?.name ?? r.unitText ?? "",
                quantityLabel(r),
                r.note ?? "",
              ]),
            }}
          />
        </div>
      ) : null}
      <ListViewHeader canCreate={false} title="Danh mục thiết bị dạy học tối thiểu" />

      {outside ? (
        <OutsideCatalog onOpen={(id) => setViewingCatalog({ id })} />
      ) : (
        <>
          {status === "RETIRED" && standard ? (
            <RetiredNotice onBackToActive={activeOfLevel ? () => { setStandardId(activeOfLevel.id); setSubjectKey(null); } : undefined} />
          ) : null}
          <FillBox>
            <div className="bg-card shadow-e1 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border">
              {/* Hàng 1: bộ nào, trạng thái, căn cứ — và việc làm được với bộ. */}
              <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b px-4 py-2">
                {standard ? (
                  <p className="me-auto min-w-0 truncate text-[0.9375rem]">
                    <span className="font-semibold">{levelName}</span>
                    {" · "}<span className={cn("font-semibold", STATUS_TEXT[status])}>{STATUS_LABEL[status]}</span>
                    <span className="text-muted-foreground text-[0.8125rem]">
                      {" · "}{whoLine(standard, status, notInForce)}
                      {siblingDrafts.length ? ` · cùng văn bản còn nháp: ${siblingDrafts.join(", ")}` : ""}
                    </span>
                  </p>
                ) : (
                  <Skeleton className="me-auto h-6 w-72" />
                )}
                {standard && mayEditStandard && status === "DRAFT" ? (
                  <>
                    {mayCreate ? (
                      <Button variant="outline" size="sm" onClick={() => setForm({ open: true })}>
                        <Plus />
                        Thêm
                      </Button>
                    ) : null}
                    <span title={notInForce ? `Văn bản có hiệu lực từ ${formatPlainDate(notInForce)}` : undefined}>
                      <Button size="sm" disabled={notInForce != null} onClick={() => setLifecycle("apply")}>
                        <ShieldCheck />
                        Áp dụng
                      </Button>
                    </span>
                  </>
                ) : standard && mayEditStandard && status === "ACTIVE" ? (
                  <Button variant="outline" size="sm" onClick={() => setLifecycle("revise")}>
                    <CopyPlus />
                    Lập bộ mới
                  </Button>
                ) : null}
                {editable && mayCreate ? (
                  <input ref={importInput} type="file" accept=".xlsx" className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void importXlsx(f);
                    }} />
                ) : null}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button type="button" variant="outline" size="icon-sm" aria-label="Thao tác khác" title="Thao tác khác" disabled={!standard}>
                      {transfer !== null ? <Loader2 className="animate-spin" /> : <Ellipsis />}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-64">
                    <DropdownMenuItem onSelect={() => setProfile("view")}>
                      <FileText />
                      Hồ sơ bộ
                    </DropdownMenuItem>
                    {editable && mayEditStandard ? (
                      <DropdownMenuItem onSelect={() => setProfile("edit")}>
                        <Pencil />
                        Sửa văn bản căn cứ
                      </DropdownMenuItem>
                    ) : null}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem disabled={transfer !== null} onSelect={() => void exportXlsx()}>
                      <FileSpreadsheet />
                      Xuất Excel (.xlsx)
                    </DropdownMenuItem>
                    <DropdownMenuItem disabled={transfer !== null} onSelect={() => void exportPdf()}>
                      <Printer />
                      In / lưu PDF
                    </DropdownMenuItem>
                    {editable && mayCreate ? (
                      <DropdownMenuItem disabled={transfer !== null} onSelect={() => importInput.current?.click()}>
                        <Upload />
                        Nhập Excel vào bản nháp
                      </DropdownMenuItem>
                    ) : null}
                    {levelStandards.length > 1 ? (
                      <DropdownMenuSub>
                        <DropdownMenuSubTrigger>
                          <History />
                          Phiên bản của bộ
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent className="max-w-[28rem]">
                          <DropdownMenuRadioGroup value={String(standard?.id ?? "")}
                            onValueChange={(v) => { setStandardId(Number(v)); setSubjectKey(null); }}>
                            {levelStandards.map((v) => (
                              <DropdownMenuRadioItem key={v.id} value={String(v.id)}>
                                <span className="min-w-0 truncate">{v.standardVersion ?? v.code}</span>
                                <Badge variant={STATUS_VARIANT[(v.status ?? "ACTIVE") as StandardStatus]} className="ms-auto shrink-0">
                                  {STATUS_LABEL[(v.status ?? "ACTIVE") as StandardStatus]}
                                </Badge>
                              </DropdownMenuRadioItem>
                            ))}
                          </DropdownMenuRadioGroup>
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>
                    ) : null}
                    {editable && mayEditStandard ? (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive" onSelect={() => setLifecycle("discard")}>
                          <Trash2 />
                          Xoá bản nháp
                        </DropdownMenuItem>
                      </>
                    ) : null}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Hàng 2: tìm, lọc môn / lớp; bản nháp thêm Tất cả / Thay đổi. */}
              <div className="flex shrink-0 flex-wrap items-center gap-2 border-b px-4 py-2.5">
                <div className="relative min-w-0 max-w-[20rem] grow basis-[12rem]">
                  <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
                  <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm thiết bị…" className="h-8 pl-8" />
                </div>
                <IconFilter labeled icon={<BookOpen />} label="môn" allLabel="Mọi môn" total={devices} fallback="Môn đã chọn"
                  value={allSubjects ? null : subjectKey} onChange={setSubjectKey} groups={[{ items: subjectItems }]} />
                <IconFilter labeled icon={<GraduationCap />} label="lớp" allLabel="Mọi lớp"
                  value={grade === ALL ? null : grade} onChange={(v) => setGrade(v ?? ALL)}
                  groups={[{ items: (level ? LEVEL_GRADES[level] ?? [] : []).map((g) => ({ key: String(g), label: `Lớp ${g}` })) }]} />
                {[q.trim() !== "", grade !== ALL, !allSubjects].filter(Boolean).length >= 2 ? (
                  <Button type="button" variant="ghost" size="icon-sm" aria-label="Xoá lọc" title="Xoá lọc"
                    className="text-muted-foreground hover:text-foreground" onClick={clearFilters}>
                    <FunnelX />
                  </Button>
                ) : null}
                {tracksChanges ? (
                  <Segmented label="Dòng của bản nháp" value={view} onChange={setView}
                    options={[
                      { value: "all", label: "Tất cả" },
                      { value: "changes", label: `Thay đổi · ${changes.loading ? "…" : changeCount}` },
                    ]} />
                ) : null}
              </div>

              <div className="min-h-0 flex-1 overflow-auto [&>[data-slot=table-container]]:overflow-visible">
                <Table className="min-w-[76rem] table-fixed">
                  <TableHeader sticky>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-12 text-center">STT</TableHead>
                      {/* Tên giữ tối thiểu 18rem: màn hẹp thì bảng cuộn ngang, không bóp tên còn vài chữ một dòng. */}
                      <TableHead className="min-w-[18rem]">Thiết bị</TableHead>
                      <TableHead className="w-28 text-center">Số lượng cần</TableHead>
                      {/* Định mức tính cho bao nhiêu (số) — gì (đối tượng): "1" · "giáo viên", "6" · "học sinh". */}
                      <TableHead className="w-28 text-center">Số đối tượng</TableHead>
                      <TableHead className="w-28">Đối tượng</TableHead>
                      <TableHead className="w-20">Lớp</TableHead>
                      <TableHead className="w-24">Người dùng</TableHead>
                      <TableHead className="w-20">Đơn vị</TableHead>
                      <TableHead className="w-40">Căn cứ</TableHead>
                      <TableHead className="w-28">Ngày lập</TableHead>
                      <TableHead className="w-28">Ngày áp dụng</TableHead>
                      {editable ? <TableHead className="w-12" /> : null}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {!standard || (groupsQuery.isLoading && !showChanges) ? (
                      <TableEmpty colSpan={cols} loading />
                    ) : showChanges ? (
                      <ChangedRows standard={standard} filters={subjectFilters} changes={changes.rows} loading={changes.loading}
                        ctx={ctx} cols={cols} opened={opened} onOpen={setOpened}
                        onEdit={(id) => setForm({ open: true, id })}
                        empty={
                          filtering || !allSubjects
                            ? <TableEmpty colSpan={cols} filtered title="Không có thay đổi nào khớp bộ lọc." />
                            : <TableEmpty colSpan={cols} title="Chưa sửa thiết bị nào" description="Bản nháp đang giống bộ đang dùng."
                                action={mayCreate ? <Button size="sm" onClick={() => setForm({ open: true })}><Plus />Thêm thiết bị</Button> : undefined} />
                        } />
                    ) : groups.length === 0 || (!allSubjects && !subject) ? (
                      <TableEmpty colSpan={cols} filtered={filtering}
                        title={filtering ? "Không có thiết bị nào khớp bộ lọc." : "Bộ này chưa có thiết bị nào."} />
                    ) : (
                      <PagedRows filters={subjectFilters} page={page} pageSize={pageSize} onTotal={setRowTotal}
                        ctx={ctx} cols={cols} opened={opened} onOpen={setOpened} onEdit={(id) => setForm({ open: true, id })} />
                    )}
                  </TableBody>
                </Table>
              </div>
              {showChanges ? (
                <div className="text-muted-foreground border-t px-4 py-3 text-sm">
                  {countsText(changes.counts) || "Chưa có thay đổi"} · so với {standard?.previousStandard?.name ?? "bộ đang dùng"}
                </div>
              ) : standard && groups.length ? (
                <Pager page={page} pageSize={pageSize} total={rowTotal} onPage={setPage}
                  onPageSize={(n) => { setPageSize(n); setPage(1); }} />
              ) : null}
            </div>
          </FillBox>
        </>
      )}

      {standard ? (
        <StandardProfileDialog standard={standard} rows={filtering ? null : total} devices={devices} subjects={groups.length}
          canEdit={mayEditStandard && status !== "RETIRED"} mode={profile} onMode={setProfile} />
      ) : null}

      <ReviseDialog targets={reviseTargets} initialId={standard?.id ?? null} open={lifecycle === "revise"}
        onOpenChange={(o) => !o && setLifecycle(null)}
        onCreated={(drafts) => {
          const here = drafts.find((d) => levelStandards.some((s) => s.id === d.id) || d.educationLevel?.name === currentLevel?.name);
          if (here) setStandardId(here.id);
          notify?.({
            type: "success",
            message: `Đã lập bản nháp: ${drafts.map((d) => d.educationLevel?.name ?? "").filter(Boolean).join(", ")}. Sửa thiết bị rồi bấm Áp dụng từng bộ.`,
          });
          afterLifecycle();
        }} />

      <AlertDialog open={lifecycle === "apply" || lifecycle === "discard"} onOpenChange={(o) => !o && !busy && setLifecycle(null)}>
        <ConfirmContent
          tone={lifecycle === "discard" ? "danger" : lifecycle === "apply" ? "warning" : "neutral"}
          title={lifecycle === "apply" ? "Áp dụng bộ này?" : "Xoá bản nháp?"}
          description={
            <div className="space-y-3">
              {lifecycle === "apply" ? (
                <p>
                  Từ hôm nay, đủ / thiếu của các trường tính theo bộ này.
                  {activeOfLevel ? (
                    <> Bộ <span className="text-foreground font-medium">{activeOfLevel.standardVersion ?? activeOfLevel.code}</span> ngừng.</>
                  ) : null}
                </p>
              ) : null}
              {lifecycle === "apply" && standard?.previousStandard ? (
                <p>
                  So với bộ đang áp dụng:{" "}
                  <span className="text-foreground font-medium">
                    {applyDiff.loading ? "đang so…" : countsText(applyDiff.counts) || "chưa khác gì"}
                  </span>
                  .{standard.revisionKind === "AMENDMENT" ? " Dòng mới và dòng đổi lấy văn bản sửa đổi làm căn cứ." : null}
                </p>
              ) : lifecycle === "discard" ? (
                <p>Bản nháp và mọi thiết bị trong đó bị xoá hẳn. Bộ đang áp dụng không bị ảnh hưởng.</p>
              ) : null}
            </div>
          }
          cancelLabel={lifecycle === "discard" ? "Không xoá" : "Chưa, để sau"}
          confirmLabel={lifecycle === "apply" ? "Áp dụng" : "Xoá bản nháp"}
          busy={busy}
          keepOpen
          onConfirm={() => void runLifecycle()}
        />
      </AlertDialog>

      <NormDrawer id={opened} ctx={ctx} editable={editable && mayEditStandard}
        onClose={() => setOpened(null)}
        onEdit={(id) => {
          setOpened(null);
          setForm({ open: true, id });
        }}
        onOpenCatalog={(id, normId) => setViewingCatalog({ id, normId })}
        onChanged={() => void changes.refetch()} />
      <CatalogDetailDialog
        view={viewingCatalog}
        editableNorm={false}
        onClose={() => setViewingCatalog(null)}
        onEditNorm={() => undefined}
      />
      {standard ? (
        <NormFormDialog state={form} standard={standard}
          onOpenChange={(open) => {
            setForm((f) => ({ ...f, open }));
            // Thêm / sửa xong: nhãn Mới / Đổi và số "Thay đổi" tính lại.
            if (!open && tracksChanges) void changes.refetch();
          }} />
      ) : null}
    </ListView>
  );
}


/**
 * Các văn bản căn cứ của bộ — vai trò, số hiệu, tên, cơ quan ban hành, ngày ban hành / hiệu lực, liên
 * kết văn bản gốc — và TỆP của từng văn bản (bản PDF thông tư, xem ngay trong trình duyệt). Tệp gắn
 * theo văn bản (`equipment_standard_documents`); thêm / xoá tệp cần quyền sửa bộ tiêu chuẩn.
 */
function LegalDocuments({ docs }: { docs: any[] }) {
  const mayWrite = useCan({ resource: "equipment_standards", action: "edit" }).data?.can ?? false;
  // Bảng: một văn bản một dòng — số hiệu, vai trò, tên, ngày; tệp PDF của văn bản ở cột cuối.
  return (
    <div className="bg-card shadow-e1 overflow-hidden rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Số hiệu</TableHead>
            <TableHead>Vai trò</TableHead>
            <TableHead>Tên văn bản</TableHead>
            <TableHead>Ban hành</TableHead>
            <TableHead>Hiệu lực</TableHead>
            <TableHead>Tệp</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {!docs.length ? <TableEmpty colSpan={6} compact title="Bộ chưa khai văn bản căn cứ." /> : docs.map((d) => (
            <TableRow key={d.id}>
              <TableCell className="font-medium whitespace-nowrap">
                {d.url ? (
                  <a href={d.url} target="_blank" rel="noreferrer" className="text-primary inline-flex items-center gap-1 hover:underline">
                    {d.documentNo}<ExternalLink className="size-3.5" />
                  </a>
                ) : d.documentNo}
              </TableCell>
              <TableCell><Badge variant="neutral">{DOCUMENT_ROLE_LABELS[d.documentRole] ?? d.documentRole}</Badge></TableCell>
              <TableCell className="min-w-[14rem] whitespace-normal">{d.documentName ?? "—"}</TableCell>
              <TableCell className="tabular-nums">{d.issueDate ? formatPlainDate(d.issueDate) : "—"}</TableCell>
              <TableCell className="tabular-nums">{d.effectiveDate ? formatPlainDate(d.effectiveDate) : "—"}</TableCell>
              <TableCell className="min-w-[12rem] whitespace-normal">
                <AttachmentsPanel resource="equipment_standard_documents" recordId={d.id} canWrite={mayWrite} field compact title="" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/** Một ô "nhãn trên, giá trị dưới" của lưới hồ sơ bộ; `wide` chiếm cả hàng (ghi chú, bộ được thay). */
function Fact({ label, wide, children }: { label: string; wide?: boolean; children?: ReactNode }) {
  return (
    <div className={cn("min-w-0", wide && "col-span-full")}>
      <dt className="text-muted-foreground text-xs">{label}:</dt>
      <dd className="mt-0.5 font-medium break-words">{children ?? <span className="text-muted-foreground font-normal">—</span>}</dd>
    </div>
  );
}

/** Hộp Hồ sơ bộ: thông tin bộ, con số, văn bản căn cứ kèm tệp; sửa tại chỗ. */
/** Hộp Hồ sơ bộ: đóng, đang xem, hay đang sửa tại chỗ. */
type ProfileMode = null | "view" | "edit";

function StandardProfileDialog({ standard, rows, devices, subjects, canEdit, mode, onMode }: {
  standard: any;
  rows: number | null;
  devices: number;
  subjects: number;
  /** Có quyền sửa bộ: nút "Sửa" ở chân hộp — chính hộp chuyển sang ô nhập. */
  canEdit: boolean;
  /** Màn cha giữ: menu ⋯ mở xem ("Hồ sơ bộ") hoặc mở thẳng chế độ sửa ("Sửa văn bản căn cứ"). */
  mode: ProfileMode;
  onMode: (mode: ProfileMode) => void;
}) {
  // Sửa mở thẳng từ dải vàng thì Huỷ / Lưu đóng hộp; sửa từ hồ sơ đang xem thì về lại hồ sơ.
  const [editFromView, setEditFromView] = useState(false);
  const prevMode = useRef<ProfileMode>(mode);
  useEffect(() => {
    if (mode === "edit" && prevMode.current !== "edit") setEditFromView(prevMode.current === "view");
    prevMode.current = mode;
  }, [mode]);
  const leaveEdit = () => onMode(editFromView ? "view" : null);
  const docs: any[] = standard.documents ?? [];
  const revisionDoc = docs.find((d) => d.id === standard.revisionDocumentId);
  const status: StandardStatus = standard.status ?? "ACTIVE";
  const figures = [
    { label: "Thiết bị", value: devices },
    { label: "Dòng phụ lục", value: rows ?? "—" },
    { label: "Môn / hoạt động", value: subjects },
    { label: "Văn bản căn cứ", value: docs.length },
  ];
  // Hồ sơ bộ trong hộp thoại — cùng khuôn với "Hồ sơ trường": đầu, dải con số, các nhóm nhãn — giá trị.
  return (
      <Dialog open={mode !== null} onOpenChange={(o) => onMode(o ? "view" : null)}>
        <DialogContent size={mode === "edit" && standard.status !== "DRAFT" ? "formFit" : "wideFit"} className="overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-2">
              {/* Tiêu đề nói việc đang làm: xem hồ sơ thì tên bộ; sửa thì "Sửa bản nháp" / "Năm học áp dụng" kèm cấp. */}
              {mode === "edit"
                ? `${standard.status === "DRAFT" ? "Sửa bản nháp" : "Năm học áp dụng"} · ${standard.educationLevel?.name ?? standard.name}`
                : standard.name}
              <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>
            </DialogTitle>
            <DialogDescription className="sr-only">Hồ sơ bộ danh mục tối thiểu</DialogDescription>
          </DialogHeader>
          {mode === "edit" && canEdit ? (
            <StandardProfileForm standard={standard} onCancel={leaveEdit} onSaved={leaveEdit} />
          ) : (
          <>
          <div className="space-y-5">
            {/* Mỗi thông tin một lần: trạng thái ở tiêu đề; mã, cấp, phiên bản, hiệu lực, con số trong một lưới. */}
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-lg border p-4 text-sm sm:grid-cols-4">
              <Fact label="Mã bộ"><span className="font-mono">{standard.code}</span></Fact>
              <Fact label="Cấp học">{standard.educationLevel?.name}</Fact>
              <Fact label="Phiên bản">{standard.standardVersion}</Fact>
              {standard.appliedAt ? <Fact label="Áp dụng từ">{formatDateTime(standard.appliedAt)}</Fact> : null}
              {standard.retiredAt ? <Fact label="Hết hiệu lực từ">{formatDateTime(standard.retiredAt)}</Fact> : null}
              <Fact label="Năm học áp dụng">
                {standard.startSchoolYear || standard.endSchoolYear
                  ? `${standard.startSchoolYear?.code ?? "…"} → ${standard.endSchoolYear?.code ?? "nay"}` : null}
              </Fact>
              {figures.map((f) => (
                <Fact key={f.label} label={f.label}><span className="text-base font-semibold tabular-nums">{f.value}</span></Fact>
              ))}
              {standard.previousStandard ? <Fact label="Thay thế bộ" wide>{standard.previousStandard.name}</Fact> : null}
              {standard.revisionKind ? (
                <Fact label="Lần sửa" wide>
                  {REVISION_KIND_LABELS[standard.revisionKind] ?? standard.revisionKind}
                  {revisionDoc ? ` theo ${revisionDoc.documentNo}` : ""}
                  {standard.revisionNote ? ` — ${standard.revisionNote}` : ""}
                </Fact>
              ) : null}
              {standard.note ? <Fact label="Ghi chú" wide>{standard.note}</Fact> : null}
            </dl>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold">Văn bản căn cứ</h3>
              <LegalDocuments docs={docs} />
            </section>
          </div>
          <DialogFooter>
            <div className="sm:me-auto">
              <StandardChangesButton standardId={standard.id} hasPrevious={!!standard.previousStandard} />
            </div>
            <DialogClose asChild>
              <Button type="button" variant="outline">Đóng</Button>
            </DialogClose>
            {canEdit ? (
              <Button type="button" onClick={() => onMode("edit")}>
                {standard.status === "DRAFT" ? <Pencil /> : <CalendarRange />}
                {standard.status === "DRAFT" ? "Sửa" : "Đặt năm học áp dụng"}
              </Button>
            ) : null}
          </DialogFooter>
          </>
          )}
        </DialogContent>
      </Dialog>
  );
}

/** Số dòng mỗi trang mặc định. */
const PAGE = 20;

/** Một văn bản căn cứ của bộ (`EquipmentStandardResponse.Document`). */
type StandardDoc = {
  id: number;
  documentRole: string;
  documentNo: string;
  documentName: string | null;
  issueDate: string | null;
  effectiveDate: string | null;
  url: string | null;
};

const STATUS_TEXT: Record<StandardStatus, string> = { DRAFT: "text-warning-text", ACTIVE: "text-success-text", RETIRED: "text-muted-foreground" };

/** "37/2021/TT-BGDĐT" → "TT 37/2021"; văn bản khác giữ nguyên số hiệu. */
function docShort(no: string | null | undefined): string {
  if (!no) return "—";
  const tt = /^(.+?)\/TT-/i.exec(no);
  return tt ? `TT ${tt[1]}` : no;
}

/** Dòng phụ đầu khung: căn cứ của bộ và mốc thời gian theo trạng thái. */
function whoLine(standard: any, status: StandardStatus, notInForce: string | null): string {
  const docs = ((standard.documents ?? []) as StandardDoc[])
    .filter((d) => d.documentRole === "main" || d.documentRole === "amendment" || d.documentRole === "correction")
    .sort((a, b) => (a.issueDate ?? "").localeCompare(b.issueDate ?? ""));
  const basis = docs.length ? docs.map((d) => docShort(d.documentNo)).join(" + ") : (standard.standardVersion ?? standard.code);
  const day = (v: string | null | undefined) => (v ? formatPlainDate(v.slice(0, 10)) : null);
  const parts = [basis];
  if (status === "DRAFT") {
    if (standard.createdAt) parts.push(`lập ${day(standard.createdAt)}`);
    parts.push(notInForce ? `áp dụng được từ ${day(notInForce)}` : "áp dụng được ngay");
  } else if (status === "ACTIVE") {
    if (standard.appliedAt) parts.push(`áp dụng từ ${day(standard.appliedAt)}`);
    else if (standard.startSchoolYear) parts.push(`áp dụng từ năm học ${standard.startSchoolYear.code}`);
  } else if (standard.retiredAt) {
    parts.push(`hết hiệu lực từ ${day(standard.retiredAt)}`);
  }
  return parts.join(" · ");
}

/** Phần dùng chung của mọi dòng: cấp học, văn bản theo id, trạng thái bộ, thay đổi của bản nháp. */
type RowContext = {
  level?: string;
  docIndex: Map<number, StandardDoc>;
  status: StandardStatus;
  /** Văn bản của lần sửa (bản nháp) — dòng theo văn bản này chưa áp dụng. */
  revisionDocId: number | null;
  changeById: Map<number, StandardChange>;
};

/** Số cột của bảng khi có cột nút Sửa. */
const EDITABLE_COLS = 12;

const PER_LABEL: Record<string, string> = {
  per_class: "lớp",
  per_teacher: "giáo viên",
  per_student: "học sinh",
  per_school: "trường",
  per_room: "phòng bộ môn",
};

/** "1 lớp", "6 học sinh" — số lượng cần tính cho bao nhiêu gì. */
/** Số đối tượng mà định mức tính cho — ít nhất 1. */
function basisCount(row: EquipmentNorm): number {
  return row.basisSize && row.basisSize > 1 ? row.basisSize : 1;
}

function applyTo(row: EquipmentNorm): string | null {
  if (row.minQuantity == null) return null;
  return `${row.basisSize && row.basisSize > 1 ? row.basisSize : 1} ${PER_LABEL[row.normBasis] ?? ""}`.trim();
}

function usersOf(row: EquipmentNorm): string | null {
  return [row.forTeacher ? "GV" : null, row.forStudent ? "HS" : null].filter(Boolean).join(", ") || null;
}

/** Lớp ngắn cho cột: "1–3", "1, 2", "Mọi lớp". */
function gradesShort(row: EquipmentNorm, level?: string): string {
  return gradesLabel(row.gradeLevels, level).replace(/^Lớp /, "");
}

const KIND_TAG: Record<StandardChange["kind"], { label: string; className: string }> = {
  ADDED: { label: "Mới", className: "bg-success-subtle text-success-text" },
  CHANGED: { label: "Đổi", className: "bg-warning-subtle text-warning-text" },
  REMOVED: { label: "Bỏ", className: "bg-destructive-subtle text-destructive-text" },
};

function ChangeTag({ kind }: { kind?: StandardChange["kind"] }) {
  if (!kind) return null;
  const t = KIND_TAG[kind];
  return <span className={cn("ms-1.5 inline-block rounded-full px-2 align-[1px] text-[0.71875rem] leading-[1.2rem] font-semibold", t.className)}>{t.label}</span>;
}

const KIND_BAR: Partial<Record<StandardChange["kind"], string>> = {
  ADDED: "shadow-[inset_3px_0_0_var(--success)]",
  CHANGED: "shadow-[inset_3px_0_0_var(--warning)]",
};

/** Một dòng của bảng — cùng cột cho chế độ Tất cả và Thay đổi. */
function NormRow({ row, index, kind, ctx, editable, selected, onOpen, onEdit }: {
  row: EquipmentNorm;
  index: number;
  kind?: StandardChange["kind"];
  ctx: RowContext;
  editable: boolean;
  selected: boolean;
  onOpen: (id: number) => void;
  onEdit: (id: number) => void;
}) {
  const doc = row.sourceDocument ? ctx.docIndex.get(row.sourceDocument.id) : undefined;
  const removed = kind === "REMOVED";
  const pending = ctx.status === "DRAFT" && doc != null && doc.id === ctx.revisionDocId;
  const muted = <span className="text-muted-foreground">—</span>;
  return (
    <TableRow onClick={() => onOpen(row.id)}
      className={cn("group/row", LIFT_ROW, "cursor-pointer", selected && "bg-primary/5", removed && "text-muted-foreground")}>
      <TableCell className={cn("text-muted-foreground text-center tabular-nums", kind && KIND_BAR[kind])}>{index}</TableCell>
      <TableCell className="whitespace-normal">
        <div className={cn("font-medium", removed && "line-through")}>
          {row.name}
          <ChangeTag kind={kind} />
          {row.optional ? <Badge variant="neutral" className="ms-1.5 align-middle">Tự chọn</Badge> : null}
        </div>
      </TableCell>
      <TableCell className="text-center">
        {row.minQuantity == null
          ? <span className="text-muted-foreground text-xs" title={row.quantityText ?? undefined}>Không ghi</span>
          : <span className="text-[0.9375rem] font-semibold tabular-nums">{row.minQuantity}</span>}
      </TableCell>
      <TableCell className="text-center tabular-nums">{row.minQuantity == null ? muted : basisCount(row)}</TableCell>
      <TableCell>{row.minQuantity == null ? muted : PER_LABEL[row.normBasis] ?? muted}</TableCell>
      <TableCell>{gradesShort(row, ctx.level)}</TableCell>
      <TableCell>{usersOf(row) ?? muted}</TableCell>
      <TableCell>{row.unit?.name ?? row.unitText ?? muted}</TableCell>
      <TableCell className="text-muted-foreground truncate">{docShort(doc?.documentNo ?? row.sourceDocument?.documentNo)}</TableCell>
      <TableCell className="text-muted-foreground tabular-nums">{doc?.issueDate ? formatPlainDate(doc.issueDate) : "—"}</TableCell>
      <TableCell className="tabular-nums">
        {pending ? <span className="text-muted-foreground">Chưa</span>
          : (doc?.effectiveDate ?? doc?.issueDate) ? formatPlainDate((doc.effectiveDate ?? doc.issueDate)!) : muted}
      </TableCell>
      {editable ? (
        <TableCell className="py-1">
          {!removed ? (
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Sửa" title="Sửa"
              className="text-muted-foreground hover:text-primary"
              onClick={(e) => { e.stopPropagation(); onEdit(row.id); }}>
              <Pencil />
            </Button>
          ) : null}
        </TableCell>
      ) : null}
    </TableRow>
  );
}

type RowsProps = {
  ctx: RowContext;
  cols: number;
  opened: number | null;
  onOpen: (id: number) => void;
  onEdit: (id: number) => void;
};

function renderRows(rows: { row: EquipmentNorm; kind?: StandardChange["kind"] }[], offset: number, p: RowsProps) {
  return rows.map(({ row, kind }, i) => (
    <NormRow key={`${kind ?? ""}${row.id}`} row={row} index={offset + i + 1} kind={kind} ctx={p.ctx}
      editable={p.cols === EDITABLE_COLS} selected={p.opened === row.id} onOpen={p.onOpen} onEdit={p.onEdit} />
  ));
}

/** Chế độ Tất cả: các dòng của bộ, phân trang ở máy chủ; bản nháp gắn nhãn Mới / Đổi. */
function PagedRows({ filters, page, pageSize, onTotal, ...p }: RowsProps & {
  filters: CrudFilter[];
  page: number;
  pageSize: number;
  onTotal: (total: number) => void;
}) {
  const { result, query } = useList<EquipmentNorm>({
    resource: NORMS,
    filters,
    sorters: [{ field: "sortOrder", order: "asc" }],
    pagination: { currentPage: page, pageSize },
    // Giữ trang cũ trong lúc tải trang mới: bảng không co lại thành dòng "đang tải" rồi giãn ra (nhảy).
    queryOptions: { placeholderData: keepPreviousData },
  });
  const rows = (result?.data ?? []) as EquipmentNorm[];
  const total = result?.total ?? 0;
  useEffect(() => {
    if (!query.isLoading) onTotal(total);
  }, [total, query.isLoading, onTotal]);
  if (query.isLoading && !rows.length) return <TableEmpty colSpan={p.cols} loading />;
  return <>{renderRows(rows.map((row) => ({ row, kind: p.ctx.changeById.get(row.id)?.kind })), (page - 1) * pageSize, p)}</>;
}

/** Số dòng tối đa đọc một lần ở chế độ Thay đổi — cả bộ THCS chưa tới 800 dòng. */
const ALL_ROWS = 3000;

/**
 * Chế độ Thay đổi: chỉ dòng Mới / Đổi (của bản nháp) và Bỏ (của bộ trước), cùng bộ lọc tìm / môn / lớp — đọc cả hai bộ
 * theo bộ lọc rồi giữ dòng có trong danh sách thay đổi.
 */
function ChangedRows({ standard, filters, changes, loading, empty, ...p }: RowsProps & {
  standard: any;
  filters: CrudFilter[];
  changes: StandardChange[];
  loading: boolean;
  empty: ReactNode;
}) {
  const previousId = standard.previousStandard?.id;
  const rest = filters.filter((f) => !("field" in f) || f.field !== "standard.id");
  const read = (id: number | undefined) => ({
    resource: NORMS,
    filters: [{ field: "standard.id", operator: "eq" as const, value: id }, ...rest],
    sorters: [{ field: "sortOrder", order: "asc" as const }],
    pagination: { currentPage: 1, pageSize: ALL_ROWS },
    queryOptions: { enabled: id != null && changes.length > 0 },
  });
  const now = useList<EquipmentNorm>(read(standard.id));
  const before = useList<EquipmentNorm>(read(previousId));
  const rows = useMemo(() => {
    const index = new Map<number, EquipmentNorm>();
    for (const r of (now.result?.data ?? []) as EquipmentNorm[]) index.set(r.id, r);
    const old = new Map<number, EquipmentNorm>();
    for (const r of (before.result?.data ?? []) as EquipmentNorm[]) old.set(r.id, r);
    return changes
      .map((c) => ({ row: c.normId == null ? undefined : (c.kind === "REMOVED" ? old : index).get(c.normId), kind: c.kind }))
      .filter((x): x is { row: EquipmentNorm; kind: StandardChange["kind"] } => x.row != null);
  }, [changes, now.result, before.result]);
  if (loading || (changes.length > 0 && (now.query.isLoading || before.query.isLoading))) return <TableEmpty colSpan={p.cols} loading />;
  if (!rows.length) return <>{empty}</>;
  return <>{renderRows(rows, 0, p)}</>;
}

/** Một hàng "nhãn — giá trị" trong ngăn. */
function DrawerRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] items-center gap-3">
      <span className="text-muted-foreground text-[0.8125rem]">{label}</span>
      <div className="min-w-0 font-medium">{children}</div>
    </div>
  );
}

/**
 * Ngăn bên phải của một dòng: cần bao nhiêu, cho ai, lớp nào; đơn vị, thiết bị trong danh mục; mục đích và mô tả (gập);
 * căn cứ — có từ văn bản nào, bản nháp thêm / đổi / bỏ gì. Bản nháp sửa (mở form) hoặc bỏ dòng ngay từ đây.
 */
function NormDrawer({ id, ctx, editable, onClose, onEdit, onOpenCatalog, onChanged }: {
  id: number | null;
  ctx: RowContext;
  editable: boolean;
  onClose: () => void;
  onEdit: (id: number) => void;
  onOpenCatalog: (catalogId: number, normId: number) => void;
  onChanged: () => void;
}) {
  const { result: r, query } = useOne<EquipmentNorm>({ resource: NORMS, id: id ?? "", queryOptions: { enabled: id != null } });
  const change = id != null ? ctx.changeById.get(id) : undefined;
  const doc = r?.sourceDocument ? ctx.docIndex.get(r.sourceDocument.id) : undefined;
  const revision = ctx.revisionDocId != null ? ctx.docIndex.get(ctx.revisionDocId) : undefined;
  const removed = change?.kind === "REMOVED";
  const canChange = editable && !removed;
  const day = (v?: string | null) => (v ? formatPlainDate(v) : "—");
  const log: { tone: string; text: ReactNode; sub?: ReactNode }[] = [];
  if (r) {
    const fromRevision = doc != null && doc.id === ctx.revisionDocId && ctx.status === "DRAFT";
    if (doc && !fromRevision) {
      log.push({ tone: "bg-muted-foreground/40", text: <>Có từ {docShort(doc.documentNo)}</>, sub: <>ban hành {day(doc.issueDate)} · áp dụng từ {day(doc.effectiveDate ?? doc.issueDate)}</> });
    }
    const by = revision ? ` theo ${docShort(revision.documentNo)}` : "";
    if (change?.kind === "ADDED") log.push({ tone: "bg-success", text: <>Thêm{by}</>, sub: "chưa áp dụng" });
    if (change?.kind === "CHANGED") {
      log.push({
        tone: "bg-warning",
        text: <>Đổi{by}{change.fields ? `: ${change.fields}` : ""}</>,
        sub: change.before ? <>trước: {change.before} → nay: {change.after}</> : "chưa áp dụng",
      });
    }
    if (change?.kind === "REMOVED") log.push({ tone: "bg-destructive", text: <>Bỏ{by}</>, sub: "chưa áp dụng" });
  }
  return (
    <Sheet open={id != null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full gap-0 sm:max-w-[32rem]" aria-describedby={undefined}>
        <SheetHeader className="px-6 pt-5 pb-3 pe-12">
          <SheetTitle className="text-[1.0625rem] leading-snug">
            {r?.name ?? "Thiết bị"}
            <ChangeTag kind={change?.kind} />
          </SheetTitle>
          {r ? <p className="text-muted-foreground text-[0.8125rem]">{[r.subject?.name, topicOf(r)].filter(Boolean).join(" · ")}</p> : null}
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-5">
          {query.isLoading || !r ? (
            <Skeleton className="h-60 w-full" />
          ) : (
            <div className="divide-y [&>section]:grid [&>section]:gap-3 [&>section]:py-4">
              <section className="border-t">
                <DrawerRow label="Số lượng cần">
                  {r.minQuantity == null
                    ? <span className="text-muted-foreground font-normal">Phụ lục không ghi số — không tính đủ / thiếu</span>
                    : <span className="text-xl font-semibold tabular-nums">{r.minQuantity}</span>}
                </DrawerRow>
                <DrawerRow label="Áp dụng cho">{applyTo(r) ?? "—"}</DrawerRow>
                <DrawerRow label="Lớp">{gradesLabel(r.gradeLevels, ctx.level)}</DrawerRow>
                <DrawerRow label="Người dùng">
                  {[r.forTeacher ? "Giáo viên" : null, r.forStudent ? "Học sinh" : null].filter(Boolean).join(", ") || "—"}
                </DrawerRow>
                {r.optional ? <p className="text-muted-foreground text-[0.8125rem]">Tự chọn — không tính đủ / thiếu.</p> : null}
              </section>
              <section>
                <DrawerRow label="Đơn vị">{r.unit?.name ?? r.unitText ?? "—"}</DrawerRow>
                {r.catalog ? (
                  <DrawerRow label="Danh mục">
                    <button type="button" className="text-primary text-start hover:underline" onClick={() => onOpenCatalog(r.catalog!.id, r.id)}>
                      {r.catalog.code} · {r.catalog.name}
                    </button>
                  </DrawerRow>
                ) : null}
              </section>
              <section>
                <details className="group/details">
                  <summary className="text-primary cursor-pointer list-none text-[0.8125rem] [&::-webkit-details-marker]:hidden">
                    Mục đích và mô tả <ChevronDown className="inline size-3.5 transition-transform group-open/details:rotate-180" />
                  </summary>
                  <div className="text-foreground/85 mt-2 space-y-3 text-[0.8125rem] leading-relaxed whitespace-pre-line">
                    <p><span className="font-semibold">Mục đích:</span> {r.purpose || "—"}</p>
                    <p>{r.description || "—"}</p>
                  </div>
                </details>
              </section>
              <section>
                <div className="grid gap-2 text-[0.8125rem]">
                  {log.map((l, i) => (
                    <div key={i} className="flex gap-2">
                      <i className={cn("mt-1.5 size-2 shrink-0 rounded-full", l.tone)} />
                      <span>{l.text}{l.sub ? <><br /><span className="text-muted-foreground">{l.sub}</span></> : null}</span>
                    </div>
                  ))}
                </div>
                <p className="text-muted-foreground text-xs">Phụ lục ghi: {r.quantityText || "—"}{r.itemNo ? ` · mục ${r.itemNo}` : ""}</p>
                {r.note ? <p className="text-muted-foreground text-xs">Ghi chú: {r.note}</p> : null}
              </section>
            </div>
          )}
        </div>
        <SheetFooter className="flex-row gap-2 border-t px-6 py-3">
          {canChange && id != null ? (
            <DeleteButton resource={NORMS} recordItemId={id} variant="outline" className="text-destructive hover:text-destructive"
              onSuccess={() => { onChanged(); onClose(); }}>
              Bỏ
            </DeleteButton>
          ) : null}
          <span className="flex-1" />
          <SheetClose asChild>
            <Button type="button" variant="outline">Đóng</Button>
          </SheetClose>
          {canChange && id != null ? (
            <Button type="button" onClick={() => onEdit(id)}>
              <Pencil />
              Sửa
            </Button>
          ) : null}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

/** Bộ đã hết hiệu lực: dải đỏ gọn, có lối về bộ đang áp dụng. */
function RetiredNotice({ onBackToActive }: { onBackToActive?: () => void }) {
  return (
    <div className="bg-destructive-subtle text-destructive-text flex w-fit max-w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-lg py-1.5 ps-4 pe-1.5 text-sm">
      <p className="min-w-0 font-medium">Bộ đã hết hiệu lực — chỉ xem lại.</p>
      {onBackToActive ? (
        <Button type="button" variant="ghost" size="sm" className="text-destructive-text hover:bg-card hover:text-destructive-text h-7" onClick={onBackToActive}>
          <Undo2 />
          Về bộ đang áp dụng
        </Button>
      ) : null}
    </div>
  );
}

/** Thanh phân trang dưới bảng — cùng hình với thanh phân trang của các danh sách khác. */
function Pager({ page, pageSize, total, onPage, onPageSize }: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
  onPageSize: (size: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const nav = (label: string, target: number, icon: ReactNode, disabled: boolean) => (
    <Button type="button" variant="outline" size="icon-sm" aria-label={label} disabled={disabled} onClick={() => onPage(target)}>
      {icon}
    </Button>
  );
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 text-sm">
      <span className="text-muted-foreground">
        Hiển thị <span className="text-foreground font-medium tabular-nums">{from}–{to}</span> / <span className="text-foreground font-medium tabular-nums">{total}</span> dòng
      </span>
      <div className="flex items-center gap-3">
        <span className="text-muted-foreground">Số dòng mỗi trang</span>
        <Select value={String(pageSize)} onValueChange={(v) => onPageSize(Number(v))}>
          <SelectTrigger className="h-8 w-20" aria-label="Số dòng mỗi trang">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[10, 20, 50, 100].map((n) => (
              <SelectItem key={n} value={String(n)}>
                {n}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="font-medium tabular-nums">Trang {page} / {pages}</span>
        <div className="flex gap-1">
          {nav("Trang đầu", 1, <ChevronsLeft />, page <= 1)}
          {nav("Trang trước", page - 1, <ChevronLeft />, page <= 1)}
          {nav("Trang sau", page + 1, <ChevronRight />, page >= pages)}
          {nav("Trang cuối", pages, <ChevronsRight />, page >= pages)}
        </div>
      </div>
    </div>
  );
}

/** Chủ đề dạy học: cột chủ đề, không thì phần "Chủ đề …" trong tiêu đề nhóm (Tiếng Việt ghi chủ đề ở đó). */
function topicOf(row: EquipmentNorm): string | null {
  if (row.topic) return row.topic;
  const part = (row.sectionName ?? "").split(" › ").find((p) => /^chủ đề/i.test(p.trim()));
  return part?.trim() ?? null;
}


export type CatalogView = { id: number; /** Dòng phụ lục đã mở nó — có thì bộ nháp sửa / xoá được dòng đó. */ normId?: number };

/**
 * Hồ sơ một thiết bị — CÙNG khuôn trang chi tiết của Danh mục thiết bị (`EquipmentCatalogDetail`: thẻ đầu, mô tả,
 * các dòng phụ lục đòi nó, thuộc tính). Mở từ một dòng phụ lục thì bộ nháp còn nút sửa / xoá dòng đó.
 * Không có nút sửa thiết bị: màn này nói thông tư ĐÒI gì; thiết lập quản lý của thiết bị làm ở Danh mục thiết bị.
 */
export function CatalogDetailDialog({ view, editableNorm, onClose, onEditNorm }: {
  view: CatalogView | null;
  editableNorm: boolean;
  onClose: () => void;
  onEditNorm: (normId: number) => void;
}) {
  const { result: r, query } = useOne<any>({ resource: "equipment_catalogs", id: view?.id ?? "", queryOptions: { enabled: view != null } });
  const mayEditNorm = useCan({ resource: NORMS, action: "edit" }).data?.can ?? false;
  const normId = view?.normId;
  return (
    <Dialog open={view != null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="wide" className="bg-background overflow-y-auto">
        <DialogHeader className="sr-only">
          <DialogTitle>{r?.name ?? "Thiết bị"}</DialogTitle>
        </DialogHeader>
        {query.isLoading || !r ? <Skeleton className="h-60 w-full" /> : <EquipmentCatalogDetail record={r} />}
        <DialogFooter>
          {editableNorm && normId != null ? (
            <DeleteButton resource={NORMS} recordItemId={normId} variant="outline" className="sm:me-auto" onSuccess={onClose} />
          ) : null}
          <DialogClose asChild>
            <Button type="button" variant="outline">Đóng</Button>
          </DialogClose>
          {editableNorm && mayEditNorm && normId != null ? (
            <Button type="button" variant="outline" onClick={() => onEditNorm(normId)}>
              <Pencil />
              Sửa dòng phụ lục
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Tab "Ngoài danh mục": thiết bị KHÔNG thuộc danh mục tối thiểu — Sở thêm ngoài thông tư, hoặc trường tự thêm lúc
 * ghi tăng / nhập dữ liệu (`NDM-…`, chỉ trường đó và cơ quan quản lý thấy). Bấm dòng mở hồ sơ thiết bị.
 */
export function OutsideCatalog({ onOpen }: { onOpen: (id: number) => void }) {
  const navigate = useNavigate();
  const mayCreate = useCan({ resource: "equipment_catalogs", action: "create" }).data?.can ?? false;
  const [q, setQ] = useState("");
  const [applied, setApplied] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setApplied(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);
  const [owner, setOwner] = useState<"all" | "official" | "school">("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = usePersistentState<number>("tbdh.outside.pageSize", PAGE, "local");
  useEffect(() => setPage(1), [applied, owner]);
  const { result, query } = useList<any>({
    resource: "equipment_catalogs",
    filters: [
      { field: "minimumRequired", operator: "eq", value: "false" },
      ...(applied ? [{ field: "q", operator: "contains" as const, value: applied }] : []),
      ...(owner !== "all" ? [{ field: "ownership", operator: "eq" as const, value: owner }] : []),
    ],
    sorters: [{ field: "code", order: "asc" }],
    pagination: { currentPage: page, pageSize },
  });
  const rows = result?.data ?? [];
  const total = result?.total ?? 0;
  return (
    <>
      <div className="bg-card flex flex-wrap items-center gap-2 rounded-lg border p-3">
        <div className="relative min-w-0 flex-1 sm:max-w-md">
          <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm thiết bị, mã DM thiết bị…" className="pl-8" />
        </div>
        <Select value={owner} onValueChange={(v) => setOwner(v as typeof owner)}>
          <SelectTrigger className="w-48" aria-label="Thêm bởi">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Mọi nguồn</SelectItem>
            <SelectItem value="official">Sở thêm</SelectItem>
            <SelectItem value="school">Trường tự thêm</SelectItem>
          </SelectContent>
        </Select>
        {mayCreate ? (
          <Button size="sm" className="ms-auto" onClick={() => navigate("/equipment-catalogs/create")}>
            <Plus />
            Thêm thiết bị
          </Button>
        ) : null}
      </div>
      <div className="bg-card overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-40">Mã DM thiết bị</TableHead>
              <TableHead>Tên thiết bị</TableHead>
              <TableHead className="w-44">Loại thiết bị</TableHead>
              <TableHead className="w-28">Đơn vị</TableHead>
              <TableHead className="w-44">Cách quản lý</TableHead>
              <TableHead className="w-56">Thêm bởi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {query.isLoading ? (
              <TableRow>
                <TableCell colSpan={6}><Skeleton className="h-6 w-full" /></TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableEmpty colSpan={6} compact title={applied || owner !== "all" ? "Không có thiết bị nào khớp bộ lọc." : "Chưa có thiết bị ngoài danh mục."} />
            ) : (
              rows.map((r) => (
                <TableRow key={r.id} className={cn("group/row", LIFT_ROW, "cursor-pointer")} onClick={() => onOpen(r.id)}>
                  <TableCell className="font-mono text-xs">{r.code}</TableCell>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell>{r.equipmentType?.name ?? "—"}</TableCell>
                  <TableCell>{r.unit?.name ?? "—"}</TableCell>
                  <TableCell>{TRACKING_TYPE_LABELS[r.trackingType] ?? "—"}</TableCell>
                  <TableCell>{r.ownerSchool ? r.ownerSchool.name : "Sở"}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        {total ? (
          <Pager page={page} pageSize={pageSize} total={total} onPage={setPage}
            onPageSize={(n) => { setPageSize(n); setPage(1); }} />
        ) : null}
      </div>
    </>
  );
}



const BASIS_OPTIONS = Object.entries(NORM_BASIS_LABELS).map(([value, label]) => ({ value, label }));

/** Thêm / sửa một dòng. Mã do máy chủ cấp; bộ tiêu chuẩn là bộ đang xem. */
function NormFormDialog({ state, onOpenChange, standard }: {
  state: FormDialogState;
  onOpenChange: (open: boolean) => void;
  standard: any;
}) {
  return (
    <FormDialog
      resource={NORMS}
      title="thiết bị vào danh mục tối thiểu"
      state={state}
      onOpenChange={onOpenChange}
      size="wide"
      defaultValues={{
        standard: { id: standard.id },
        name: "",
        active: true,
        note: "",
        catalog: { id: null },
        subject: { id: null },
        unit: { id: null },
        sectionName: "",
        topic: "",
        itemNo: "",
        quantityText: "",
        minQuantity: null,
        normBasis: "per_teacher",
        basisSize: null,
        gradeLevels: "",
        forTeacher: true,
        forStudent: false,
        optional: false,
        purpose: "",
        description: "",
      }}
    >
      {(control, record) => <NormFields control={control} record={record} level={standard.educationLevel?.code} />}
    </FormDialog>
  );
}

function NormFields({ control, record, level }: { control: Control<any>; record?: any; level?: string }) {
  const { setValue, getValues } = useFormContext();
  const basis = useWatch({ control, name: "normBasis" });
  // Chọn thiết bị trong danh mục khi ô tên còn trống: lấy tên của thiết bị, khỏi gõ lại.
  const catalogId = useWatch({ control, name: "catalog.id" });
  const { result: picked } = useOne<any>({
    resource: "equipment_catalogs",
    id: catalogId ?? "",
    queryOptions: { enabled: !!catalogId && catalogId !== record?.catalog?.id },
  });
  useEffect(() => {
    if (picked?.name && !getValues("name")) setValue("name", picked.name, { shouldDirty: true });
  }, [picked, getValues, setValue]);
  return (
    <div className="space-y-5">
      <FormSection title="Thiết bị" compact>
        <div className="grid items-start gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <TextField control={control} name="name" label="Tên thiết bị" className="sm:col-span-2" rule="NAME"
            rules={{ required: "Nhập tên thiết bị" }} />
          <FormField
            control={control}
            name="catalog.id"
            render={({ field }) => (
              <FormItem className="sm:col-span-2">
                <FormLabel>Trong danh mục thiết bị</FormLabel>
                <AsyncCombobox<any>
                  resource="equipment_catalogs"
                  value={field.value}
                  onChange={(id) => field.onChange(id)}
                  labelOf={(c) => `${c.code} · ${c.name}`}
                  fallbackLabel={record?.catalog ? `${record.catalog.code} · ${record.catalog.name}` : null}
                  placeholder="Vui lòng chọn thiết bị, để trống nếu chưa có"
                  searchPlaceholder="Tìm theo tên hoặc mã DM thiết bị…"
                  clearable
                  clearLabel="Không gắn"
                />
                <FormMessage />
              </FormItem>
            )}
          />
          <RefField control={control} name="subject" resource="subjects" label="Môn / hoạt động" current={record?.subject} />
          <TextField control={control} name="sectionName" label="Nhóm trong phụ lục" rule="NOTE" placeholder="Thiết bị dùng chung › Tranh ảnh" />
          <TextField control={control} name="topic" label="Chủ đề dạy học" className="sm:col-span-2" rule="NOTE" />
        </div>
      </FormSection>
      <FormSection title="Định mức" compact>
        <div className="grid items-start gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <TextField control={control} name="minQuantity" label="Số lượng tối thiểu" type="number" step="any"
            numberRule="DECIMAL_QUANTITY" />
          <SelectField control={control} name="normBasis" label="Tính theo" options={BASIS_OPTIONS} />
          {basis === "per_student" || basis === "per_class" ? (
            <TextField control={control} name="basisSize" label={basis === "per_student" ? "Cỡ nhóm học sinh" : "Số lớp dùng chung"}
              type="number" numberRule="COUNT" placeholder={basis === "per_student" ? "6 — một bộ / 6 HS" : "5 — một bộ / 5 lớp"} />
          ) : (
            <div className="hidden lg:block" />
          )}
          <RefField control={control} name="unit" resource="units" label="Đơn vị tính" current={record?.unit} />
          <TextField control={control} name="quantityText" label="Số lượng (theo phụ lục)" placeholder="01/4 đến 6HS" rule="SHORT_TEXT" max={100} />
          <GradeLevelsField control={control} level={level} />
          <AudienceField control={control} />
          <FormField
            control={control}
            name="optional"
            render={({ field }) => (
              <FormItem className="sm:col-span-2">
                <FormLabel>Nhóm tự chọn</FormLabel>
                <label className="flex min-h-9 items-center gap-2 text-sm">
                  <Checkbox checked={!!field.value} onCheckedChange={(v) => field.onChange(v === true)} />
                  Môn hoặc phương án trường tự chọn, không tính vào đủ / thiếu
                </label>
              </FormItem>
            )}
          />
        </div>
      </FormSection>
      <FormSection title="Mục đích và mô tả" compact>
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <TextareaField control={control} name="purpose" label="Mục đích sử dụng" rows={6} rule="LONG_TEXT" max={20000} />
          <TextareaField control={control} name="description" label="Mô tả chi tiết" rows={6} rule="LONG_TEXT" max={20000} />
        </div>
      </FormSection>
      <FormSection title="Căn cứ" compact>
        <div className="grid items-start gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <TextField control={control} name="itemNo" label="Số thứ tự trong phụ lục" placeholder="1.2" rule="SHORT_TEXT" max={20} />
          <TextField control={control} name="note" label="Ghi chú" className="sm:col-span-3" rule="NOTE" />
        </div>
      </FormSection>
    </div>
  );
}

/** Lớp áp dụng: ô đánh dấu từng lớp của cấp học; không chọn lớp nào là mọi lớp. */
function GradeLevelsField({ control, level }: { control: Control<any>; level?: string }) {
  const grades = level ? LEVEL_GRADES[level] ?? [] : [];
  return (
    <FormField
      control={control}
      name="gradeLevels"
      render={({ field }) => {
        const picked = new Set<number>(String(field.value ?? "").split(",").filter(Boolean).map(Number));
        const toggle = (g: number) => {
          const next = new Set(picked);
          if (next.has(g)) next.delete(g);
          else next.add(g);
          field.onChange([...next].sort((a, b) => a - b).join(","));
        };
        return (
          <FormItem>
            <FormLabel>Lớp áp dụng</FormLabel>
            <FormControl>
              <div className="flex min-h-9 flex-wrap items-center gap-x-3 gap-y-1">
                {grades.map((g) => (
                  <label key={g} className="flex items-center gap-1.5 text-sm">
                    <Checkbox checked={picked.has(g)} onCheckedChange={() => toggle(g)} />
                    {g}
                  </label>
                ))}
              </div>
            </FormControl>
            <p className="text-muted-foreground text-xs">Không chọn lớp nào là mọi lớp.</p>
          </FormItem>
        );
      }}
    />
  );
}

function AudienceField({ control }: { control: Control<any> }) {
  return (
    <FormItem>
      <FormLabel>Đối tượng sử dụng</FormLabel>
      <div className="flex min-h-9 items-center gap-4">
        {(
          [
            ["forTeacher", "Giáo viên"],
            ["forStudent", "Học sinh"],
          ] as const
        ).map(([name, label]) => (
          <FormField
            key={name}
            control={control}
            name={name}
            render={({ field }) => (
              <label className="flex items-center gap-1.5 text-sm">
                <Checkbox checked={!!field.value} onCheckedChange={(v) => field.onChange(v === true)} />
                {label}
              </label>
            )}
          />
        ))}
      </div>
    </FormItem>
  );
}

