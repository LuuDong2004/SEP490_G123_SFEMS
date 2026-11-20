import { useCan, useCustom, useInvalidate, useList, useNotification, useOne, type CrudFilter } from "@refinedev/core";
import { ArrowLeftRight, BookOpen, Check, CheckCheck, CopyPlus, FileUp, ListChecks, Trash2, CircleStop, GraduationCap, ChevronDown, ChevronLeft, FileSpreadsheet, Loader2, ChevronRight, ChevronsLeft, ChevronsRight, Ellipsis, FileText, Pencil, Plus, Printer, Search, Timer, FunnelX, History, Undo2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { keepPreviousData } from "@tanstack/react-query";
import { useFormContext, useFormState, useWatch, type Control } from "react-hook-form";
import { useNavigate, useSearchParams } from "react-router";

import { API_URL } from "@/shared/api/constants";
import { FillBox } from "@/shared/components/layout/fill-box";
import { kyInstance, DOWNLOAD_TIMEOUT } from "@/shared/api/data";
import { errorMessage } from "@/shared/lib/api-error";
import { usePersistentState } from "@/shared/hooks/use-persistent-state";
import { cn } from "@/shared/lib/utils";
import { formatPlainDate } from "@/shared/lib/format";
import { ListView, ListViewHeader } from "@/shared/components/views/list-view";
import { DeleteButton } from "@/shared/components/buttons/delete";
import { RefField } from "@/shared/components/catalog/ref-field";
import { FormDialog, type FormDialogState } from "@/shared/components/catalog/form-dialog";
import { IconFilter } from "@/shared/components/data-table/icon-filter";
import { PrintSheet } from "@/shared/components/print/print-sheet";
import { SelectField, TextareaField, TextField } from "@/shared/components/form/simple-fields";
import { Badge } from "@/shared/ui/badge";
import { AlertDialog } from "@/shared/ui/alert-dialog";
import { ConfirmContent } from "@/shared/components/confirm/confirm-content";
import { NORM_VALIDITY_VARIANTS } from "@/shared/lib/status-variants";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { FormControl, FormField, FormItem, FormLabel } from "@/shared/ui/form";
import { Input } from "@/shared/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Sheet, SheetClose, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/shared/ui/sheet";
import { Skeleton } from "@/shared/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import {
  ADJUST_KIND_LABELS,
  LEVEL_GRADES,
  NORM_BASIS_LABELS,
  NORM_VALIDITY_LABELS,
  gradesLabel,
  quantityLabel,
  ratioLabel,
  type EquipmentNorm,
  type NormSubjectGroup,
  type NormValidity,
} from "@/domains/equipment-standard/types";
import { TRACKING_TYPE_LABELS } from "@/domains/equipment-catalog/types";

import { EquipmentCatalogDetail } from "./equipment-catalog-profile";
import { OUTSIDE, useLevelParam } from "./level-picker";
import { LegalDocDialog, type LegalDocDialogState } from "./legal-doc-dialog";
import { useLegalDocs, useLegalEffectiveFrom } from "./legal-doc-picker";
import { LegalBasisField, NormChangeLog } from "./norm-audit";
import {
  AdjustableBadge,
  AdjustmentFields,
  AdjustmentView,
  DeleteUnusedNormDialog,
  EMPTY_ADJUSTMENT,
  KV,
  StopNormDialog,
  effectiveNow,
  stopYearText,
  useNormUsage,
  useSchoolYears,
} from "./norm-adjustment";
import { countsText, useStandardChanges, type StandardChange } from "./standard-changes";
import { NormDocumentImport, type NormDocumentImportHandle } from "./norm-document-import";
import { ReviseDialog, type ReviseTarget } from "./revise-dialog";
import { LIFT_ROW } from "@/shared/lib/row-lift";
import { TableEmpty } from "@/shared/components/data-table/table-empty";

/* eslint-disable @typescript-eslint/no-explicit-any */

const ALL = "__all__";

type StandardStatus = "DRAFT" | "ACTIVE" | "RETIRED";

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
  // Văn bản của MỌI bộ theo id — dòng bị bỏ thuộc bộ trước, căn cứ của nó nằm ở bộ đó.
  const docIndex = useMemo(() => {
    const map = new Map<number, StandardDoc>();
    for (const s of standards) for (const d of (s.documents ?? []) as StandardDoc[]) map.set(d.id, d);
    return map;
  }, [standards]);
  // Căn cứ của một dòng là CHUỖI thông tư (trưởng nhóm 17/11/2026: "từ thông tư + TT bổ sung, không chỉ cái ngọn"):
  // thông tư gốc của bộ + các thông tư sửa đổi ban hành tới văn bản của dòng. Văn bản hợp nhất (VBHN) chỉ gom nội dung,
  // không phải căn cứ — dòng ghi theo VBHN thì căn cứ là gốc + mọi sửa đổi trước nó.
  const chainIndex = useMemo(() => {
    const map = new Map<number, StandardDoc[]>();
    for (const s of standards) {
      const docs = (s.documents ?? []) as StandardDoc[];
      const legal = docs.filter((d) => /^(main|amendment)$/i.test(d.documentRole))
        .sort((a, b) => String(a.issueDate ?? "").localeCompare(String(b.issueDate ?? "")));
      for (const d of docs) {
        const upTo = String(d.issueDate ?? "9999");
        const chain = legal.filter((x) => x.id === d.id || String(x.issueDate ?? "") <= upTo);
        map.set(d.id, chain.length ? chain : [d]);
      }
    }
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
  // Cấp học chọn ở tên bộ trên đầu bảng (LevelSwitch) (?level=TH|THCS|THPT|outside). Địa chỉ không có cấp thì mở cấp xem lần trước.
  const remembered = levels.find((l) => l.id === levelId) ?? levels[0];
  const { outside, level: pickedLevel } = useLevelParam(levels, remembered?.code);
  const currentLevel = pickedLevel ?? remembered;
  const levelStandards = standards.filter((s) => levelOf(s) === currentLevel?.id);
  const standard =
    levelStandards.find((s) => s.id === standardId) ??
    levelStandards.find((s) => s.status === "ACTIVE") ??
    levelStandards[0];
  const status: StandardStatus = standard?.status ?? "ACTIVE";
  // Danh sách phẳng (trưởng nhóm 17/11/2026): bộ đang áp dụng thêm / sửa / xoá trực tiếp, nhật ký ghi lại mọi lần.
  // Bản nháp (Lập bộ mới theo thông tư sửa đổi / đính chính) sửa được tới khi Áp dụng.
  const editable = status === "ACTIVE" || status === "DRAFT";
  const draftOfLevel = levelStandards.find((s) => s.status === "DRAFT");
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

  // Lọc theo căn cứ: thông tư của dòng (gốc / sửa đổi) — trưởng nhóm 17/11/2026.
  const [basisDoc, setBasisDoc] = useState<string | null>(null);
  useEffect(() => setBasisDoc(null), [standard?.id]);
  // Điều chỉnh (được phép / không) và hiệu lực (mặc định: đang hiệu lực) — changelog 276.
  const [adjust, setAdjust] = useState<string | null>(null);
  const [validity, setValidity] = useState<NormValidity>("active");
  const filters: CrudFilter[] = useMemo(
    () => [
      { field: "standard.id", operator: "eq", value: standard?.id },
      ...(applied ? [{ field: "q", operator: "contains" as const, value: applied }] : []),
      ...(grade !== ALL ? [{ field: "gradeLevel", operator: "eq" as const, value: grade }] : []),
      ...(basisDoc ? [{ field: "sourceDocument.id", operator: "eq" as const, value: basisDoc }] : []),
      ...(adjust ? [{ field: "adjustable", operator: "eq" as const, value: adjust }] : []),
      ...(validity !== "all" ? [{ field: "validity", operator: "eq" as const, value: validity }] : []),
    ],
    [standard?.id, applied, grade, basisDoc, adjust, validity],
  );
  const query: Record<string, string> = { "standard.id": String(standard?.id ?? "") };
  if (applied) query.q = applied;
  if (grade !== ALL) query.gradeLevel = grade;
  if (basisDoc) query["sourceDocument.id"] = basisDoc;
  if (adjust) query.adjustable = adjust;
  if (validity !== "all") query.validity = validity;
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
  const devices = groups.reduce((n, g) => n + (g.catalogs ?? g.count), 0);
  const filtering = !!applied || grade !== ALL || !!basisDoc || !!adjust || validity !== "active";

  const [subjectKey, setSubjectKey] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = usePersistentState<number>("tbdh.pageSize", PAGE, "local");
  const [rowTotal, setRowTotal] = useState(0);
  useEffect(() => setPage(1), [standard?.id, subjectKey, applied, grade, basisDoc, adjust, validity]);
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
  const tracksChanges = status === "DRAFT" && !!standard?.previousStandard;
  const changes = useStandardChanges(standard?.id, tracksChanges);
  const changeById = useMemo(() => {
    const map = new Map<number, StandardChange>();
    for (const c of changes.rows) if (c.normId != null) map.set(c.normId, c);
    return map;
  }, [changes.rows]);
  const showChanges = tracksChanges && view === "changes";

  const mayCreate = useCan({ resource: NORMS, action: "create" }).data?.can ?? false;
  const mayEditStandard = useCan({ resource: "equipment_standards", action: "edit" }).data?.can ?? false;
  // Dòng đang mở ở ngăn bên phải (id dòng; dòng bị bỏ là id của bộ trước).
  const [opened, setOpened] = useState<number | null>(null);
  const [viewingCatalog, setViewingCatalog] = useState<CatalogView | null>(null);
  const [form, setForm] = useState<FormDialogState>({ open: false });
  // Bấm số hiệu ở cột Căn cứ: mở hộp XEM của danh mục Văn bản căn cứ (cùng hộp với màn Văn bản căn cứ — có tệp, nút
  // Hết hiệu lực, Sửa).
  const { data: legalDocs } = useQuery({
    queryKey: ["legal_documents", "picker"],
    queryFn: () => kyInstance.get("legal_documents", { searchParams: { _start: "0", _end: "500" } }).json<{ id: number; code: string }[]>(),
  });
  const [legalView, setLegalView] = useState<LegalDocDialogState>(null);
  const openDoc = (d: StandardDoc) => {
    const legal = (legalDocs ?? []).find((x) => x.code === d.documentNo);
    if (legal) setLegalView({ mode: "view", id: legal.id });
  };

  const invalidate = useInvalidate();
  const { open: notify } = useNotification();
  const activeOfLevel = levelStandards.find((s) => s.status === "ACTIVE");
  const docsLine = ((standard?.documents ?? []) as StandardDoc[]).map((d) => d.documentNo).join(", ");

  const exportQuery: Record<string, string> = { ...query, ...(subject ? { "subject.id": String(subject.subjectId ?? "none") } : {}) };
  const [printRows, setPrintRows] = useState<EquipmentNorm[] | null>(null);
  const [transfer, setTransfer] = useState<"xlsx" | "pdf" | "import" | null>(null);
  const importInput = useRef<HTMLInputElement>(null);
  const levelName: string = standard?.educationLevel?.name ?? "";
  const docImport = useRef<NormDocumentImportHandle>(null);
  const [revising, setRevising] = useState(false);
  const [confirming, setConfirming] = useState<"apply" | "discard" | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  // Thông tư Sở chọn điều chỉnh: bộ đang áp dụng của từng cấp; cấp đang có bản nháp thì không chọn lại được.
  const reviseTargets: ReviseTarget[] = useMemo(
    () => standards.filter((s) => s.status === "ACTIVE").map((s) => {
      const main = ((s.documents ?? []) as StandardDoc[]).find((d) => /^main$/i.test(d.documentRole));
      return {
        id: s.id,
        circular: /^(.+?)\/TT-/i.exec(main?.documentNo ?? "")?.[1] ?? main?.documentNo ?? s.code,
        level: s.educationLevel?.name ?? "",
        version: s.standardVersion ?? null,
        busy: standards.some((d) => d.status === "DRAFT" && d.previousStandard?.id === s.id),
      };
    }),
    [standards],
  );
  const refreshAll = () => {
    invalidate({ resource: "equipment_standards", invalidates: ["list"] });
    invalidate({ resource: NORMS, invalidates: ["list"] });
    invalidate({ resource: "equipment_catalogs", invalidates: ["list"] });
    void groupsQuery.refetch();
    if (tracksChanges) void changes.refetch();
  };
  /** Áp dụng bản nháp (bộ cũ cùng cấp hết hiệu lực) hoặc xoá bản nháp — cả hai hỏi lại trước. */
  const runConfirm = async () => {
    if (!standard || !confirming) return;
    setConfirmBusy(true);
    try {
      if (confirming === "apply") {
        await kyInstance.post(`equipment_standards/${standard.id}/apply`);
        notify?.({ type: "success", message: `Đã áp dụng bộ mới cấp ${levelName.toLowerCase()}.` });
      } else {
        await kyInstance.delete(`equipment_standards/${standard.id}`);
        notify?.({ type: "success", message: "Đã xoá bản nháp." });
      }
      setStandardId(null);
      setConfirming(null);
      refreshAll();
    } catch (error) {
      notify?.({ type: "error", message: await errorMessage(error), description: confirming === "apply" ? "Chưa áp dụng được" : "Không xoá được" });
    } finally {
      setConfirmBusy(false);
    }
  };

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
      refreshAll();
    } catch (error) {
      notify?.({ type: "error", message: await errorMessage(error), description: "Không nhập được, chưa có dòng nào được ghi" });
    } finally {
      setTransfer(null);
      if (importInput.current) importInput.current.value = "";
    }
  };


  const [deleting, setDeleting] = useState<EquipmentNorm | null>(null);
  const [stopping, setStopping] = useState<EquipmentNorm | null>(null);
  const { data: schoolYears } = useSchoolYears();
  const ctx: RowContext = {
    level, docIndex, chainOf: (id) => (id != null ? chainIndex.get(id) ?? [] : []), status,
    revisionDocId: standard?.revisionDocumentId ?? null, changeById, onDoc: openDoc,
    onDelete: setDeleting, onStop: setStopping,
    stopText: (to) => stopYearText(to, schoolYears),
  };
  const cols = editable && mayCreate ? EDITABLE_COLS : EDITABLE_COLS - 1;
  const subjectItems = groups.map((g) => ({ key: String(g.subjectId), label: g.subjectName ?? "Chưa gắn môn", count: g.catalogs ?? g.count }));
  const clearFilters = () => {
    setQ("");
    setBasisDoc(null);
    setGrade(ALL);
    setSubjectKey(null);
    setAdjust(null);
    setValidity("active");
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
        <>
          <div className="mb-3 text-[0.9375rem]">
            <LevelSwitch levels={levels} current={OUTSIDE} />
          </div>
          <OutsideCatalog onOpen={(id) => setViewingCatalog({ id })} />
        </>
      ) : (
        <>
          {status === "RETIRED" && standard ? (
            <RetiredNotice onBackToActive={activeOfLevel ? () => { setStandardId(activeOfLevel.id); setSubjectKey(null); } : undefined} />
          ) : null}
          <FillBox>
            <div className="bg-card shadow-e1 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border">
              {/* Hàng 1: bộ nào (bấm tên cấp để đổi cấp — thay cho menu xổ trên tab), trạng thái, căn cứ; việc làm với bộ. */}
              <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b px-4 py-2">
                {standard ? (
                  <div className="me-auto flex min-w-0 items-center gap-1 text-[0.9375rem]">
                    <LevelSwitch levels={levels} current={currentLevel?.code} />
                    <span className={cn("truncate font-semibold", STATUS_TONE[status])}>{" · "}{STATUS_TEXT[status]}</span>
                    <span className="text-muted-foreground truncate text-[0.8125rem]">{" · "}{basisLine(standard)}</span>
                  </div>
                ) : (
                  <Skeleton className="me-auto h-6 w-72" />
                )}
                {status === "ACTIVE" && draftOfLevel ? (
                  <Button type="button" variant="outline" size="sm" onClick={() => { setStandardId(draftOfLevel.id); setSubjectKey(null); }}>
                    <FileText />
                    Bản nháp
                  </Button>
                ) : null}
                {status === "DRAFT" && activeOfLevel ? (
                  <Button type="button" variant="ghost" size="sm" onClick={() => { setStandardId(activeOfLevel.id); setSubjectKey(null); }}>
                    <Undo2 />
                    Bộ đang áp dụng
                  </Button>
                ) : null}
                {tracksChanges ? (
                  <Button type="button" variant={view === "changes" ? "secondary" : "outline"} size="sm" aria-pressed={view === "changes"}
                    onClick={() => setView(view === "changes" ? "all" : "changes")}>
                    <ListChecks />
                    {changes.loading ? "Thay đổi" : `Thay đổi: ${countsText(changes.counts) || "chưa có"}`}
                  </Button>
                ) : null}
                {standard && editable && mayCreate ? (
                  <Button size="sm" variant={status === "DRAFT" ? "outline" : "default"} onClick={() => setForm({ open: true })}>
                    <Plus />
                    Thêm thiết bị
                  </Button>
                ) : null}
                {status === "DRAFT" && mayEditStandard ? (
                  <Button type="button" size="sm" onClick={() => setConfirming("apply")}>
                    <CheckCheck />
                    Áp dụng
                  </Button>
                ) : null}
                {status === "DRAFT" && mayCreate ? (
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
                    <DropdownMenuItem disabled={transfer !== null} onSelect={() => void exportXlsx()}>
                      <FileSpreadsheet />
                      Xuất Excel (.xlsx)
                    </DropdownMenuItem>
                    <DropdownMenuItem disabled={transfer !== null} onSelect={() => void exportPdf()}>
                      <Printer />
                      In / lưu PDF
                    </DropdownMenuItem>
                    {mayEditStandard && status !== "RETIRED" ? (
                      <>
                        <DropdownMenuSeparator />
                        {status === "ACTIVE" && !draftOfLevel ? (
                          <DropdownMenuItem onSelect={() => setRevising(true)}>
                            <CopyPlus />
                            Lập bộ mới
                          </DropdownMenuItem>
                        ) : null}
                        {status === "DRAFT" && mayCreate ? (
                          <DropdownMenuItem disabled={transfer !== null} onSelect={() => importInput.current?.click()}>
                            <FileSpreadsheet />
                            Nhập Excel vào bản nháp
                          </DropdownMenuItem>
                        ) : null}
                        <DropdownMenuItem disabled={transfer !== null} onSelect={() => docImport.current?.pick()}>
                          <FileUp />
                          {status === "DRAFT" ? "Đọc phụ lục Word vào bản nháp" : "Đọc phụ lục Word, so với bộ"}
                        </DropdownMenuItem>
                        {status === "DRAFT" ? (
                          <DropdownMenuItem variant="destructive" onSelect={() => setConfirming("discard")}>
                            <Trash2 />
                            Xoá bản nháp
                          </DropdownMenuItem>
                        ) : null}
                      </>
                    ) : null}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              {/* Hàng 2: tìm, lọc môn / lớp / căn cứ. */}
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
                <IconFilter labeled icon={<FileText />} label="căn cứ" allLabel="Mọi căn cứ"
                  value={basisDoc} onChange={setBasisDoc}
                  groups={[{ items: basisDocs(standard).map((d) => ({ key: String(d.id), label: docShort(d.documentNo) })) }]} />
                <IconFilter labeled icon={<ArrowLeftRight />} label="điều chỉnh" prefix="Điều chỉnh" allLabel="Tất cả"
                  value={adjust} onChange={setAdjust}
                  groups={[{ items: [{ key: "true", label: "Được phép" }, { key: "false", label: "Không được phép" }] }]} />
                <IconFilter labeled icon={<Timer />} label="hiệu lực" baseline="active"
                  value={validity} onChange={(v) => setValidity((v ?? "active") as NormValidity)}
                  groups={[{ items: (Object.keys(NORM_VALIDITY_LABELS) as NormValidity[]).map((k) => ({ key: k, label: NORM_VALIDITY_LABELS[k] })) }]} />
                {[q.trim() !== "", grade !== ALL, !allSubjects, basisDoc != null, adjust != null, validity !== "active"].filter(Boolean).length >= 2 ? (
                  <Button type="button" variant="ghost" size="icon-sm" aria-label="Xoá lọc" title="Xoá lọc"
                    className="text-muted-foreground hover:text-foreground" onClick={clearFilters}>
                    <FunnelX />
                  </Button>
                ) : null}
              </div>

              <div className="min-h-0 flex-1 overflow-auto [&>[data-slot=table-container]]:overflow-visible">
                <Table className="min-w-[72rem] table-fixed">
                  <TableHeader sticky>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-12 text-center">STT</TableHead>
                      <TableHead className="w-32">Mã thiết bị</TableHead>
                      {/* Tên giữ tối thiểu 18rem: màn hẹp thì bảng cuộn ngang, không bóp tên còn vài chữ một dòng. */}
                      <TableHead className="min-w-[18rem]">Thiết bị</TableHead>
                      {/* Định mức tách 4 cột: cần có (số + ĐVT) cho mỗi (số đối tượng + đối tượng) — "1 Bộ / 1 giáo viên". */}
                      <TableHead className="w-20 text-center">Cần có</TableHead>
                      <TableHead className="w-16">ĐVT</TableHead>
                      <TableHead className="w-28 text-center">Số đối tượng</TableHead>
                      <TableHead className="w-28">Đối tượng</TableHead>
                      <TableHead className="w-20">Lớp</TableHead>
                      <TableHead className="w-36">Điều chỉnh</TableHead>
                      <TableHead className="w-28">Căn cứ</TableHead>
                      {editable && mayCreate ? <TableHead className="w-12" /> : null}
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

      <LegalDocDialog state={legalView} onClose={() => setLegalView(null)} />
      {standard && mayEditStandard && status !== "RETIRED" ? (
        <NormDocumentImport standardId={standard.id} editable={status === "DRAFT"} handle={docImport}
          onBusy={(b) => setTransfer(b ? "import" : null)} onImported={refreshAll} />
      ) : null}
      <ReviseDialog targets={reviseTargets} initialId={standard?.id ?? null} open={revising} onOpenChange={setRevising}
        onCreated={(drafts) => {
          setRevising(false);
          notify?.({ type: "success", message: drafts.length > 1 ? `Đã lập ${drafts.length} bộ nháp.` : "Đã lập bộ nháp." });
          invalidate({ resource: "equipment_standards", invalidates: ["list"] });
          const mine = drafts.find((d) => d.educationLevel?.name === levelName) ?? drafts[0];
          if (mine) { setStandardId(mine.id); setSubjectKey(null); }
        }} />
      <AlertDialog open={confirming !== null} onOpenChange={(o) => !o && !confirmBusy && setConfirming(null)}>
        {confirming === "discard" ? (
          <ConfirmContent tone="danger" title={`Xoá bản nháp cấp ${levelName.toLowerCase()}?`}
            description="Các dòng đã sửa trong bản nháp bị xoá. Bộ đang áp dụng giữ nguyên."
            cancelLabel="Không xoá" confirmLabel="Xoá bản nháp" busy={confirmBusy} keepOpen onConfirm={() => void runConfirm()} />
        ) : (
          <ConfirmContent tone="warning" icon={<CheckCheck />}
            title={`Áp dụng bộ mới cấp ${levelName.toLowerCase()}?`}
            description={`Bộ đang áp dụng chuyển hết hiệu lực. Từ năm học này đủ / thiếu và báo cáo tính theo bộ mới${tracksChanges && changes.rows.length ? ` (${countsText(changes.counts)})` : ""}.`}
            cancelLabel="Chưa áp dụng" confirmLabel="Áp dụng" busy={confirmBusy} keepOpen onConfirm={() => void runConfirm()} />
        )}
      </AlertDialog>
      <DeleteUnusedNormDialog row={deleting} onClose={() => setDeleting(null)} onDeleted={() => setOpened(null)} />
      <StopNormDialog row={stopping} onClose={() => setStopping(null)} />



      <NormDrawer id={opened} ctx={ctx} editable={editable && mayEditStandard} standardId={standard?.id}
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


const STATUS_TEXT: Record<StandardStatus, string> = { ACTIVE: "Đang áp dụng", DRAFT: "Bản nháp", RETIRED: "Hết hiệu lực" };
const STATUS_TONE: Record<StandardStatus, string> = { ACTIVE: "text-success-text", DRAFT: "text-warning-text", RETIRED: "text-destructive-text" };

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


/** "37/2021/TT-BGDĐT" → "TT 37/2021"; văn bản khác giữ nguyên số hiệu. */
/** Thông tư căn cứ của bộ (gốc + sửa đổi, đính chính) theo ngày ban hành — không gồm văn bản hợp nhất. */
function basisDocs(standard: any): StandardDoc[] {
  return ((standard?.documents ?? []) as StandardDoc[])
    .filter((d) => /^(main|amendment|correction)$/i.test(d.documentRole))
    .sort((a, b) => (a.issueDate ?? "").localeCompare(b.issueDate ?? ""));
}

const basisLine = (standard: any) => basisDocs(standard).map((d) => docShort(d.documentNo)).join(" + ");

/**
 * Tên bộ trên đầu bảng, bấm để đổi cấp (Tiểu học / THCS / THPT; "Ngoài danh mục" không nằm ở đây) — trưởng nhóm 17/11/2026: chọn
 * cấp ở đây, không ở menu xổ trên tab. Ghi `?level=` lên địa chỉ.
 */
function LevelSwitch({ levels, current }: { levels: any[]; current?: string }) {
  const [, setParams] = useSearchParams();
  const pick = (code: string) => setParams((p) => {
    const next = new URLSearchParams(p);
    next.set("level", code);
    return next;
  });
  const name = current === OUTSIDE ? null : levels.find((l) => l.code === current)?.name;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="hover:text-primary inline-flex min-w-0 items-center gap-1 font-semibold">
          <span className="truncate">{name ? `Bộ danh mục thiết bị tối thiểu cấp ${name}` : "Thiết bị ngoài danh mục tối thiểu"}</span>
          <ChevronDown className="size-4 shrink-0" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[22rem]">
        {levels.map((l) => (
          <DropdownMenuItem key={l.id} onSelect={() => pick(l.code)}>
            Bộ danh mục thiết bị tối thiểu cấp {l.name}
            {current === l.code ? <Check className="text-primary ms-auto size-4" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function docShort(no: string | null | undefined): string {
  if (!no) return "—";
  const tt = /^(.+?)\/TT-/i.exec(no);
  return tt ? `TT ${tt[1]}` : no;
}


/** Phần dùng chung của mọi dòng: cấp học, văn bản theo id, trạng thái bộ, thay đổi của bản nháp. */
type RowContext = {
  level?: string;
  docIndex: Map<number, StandardDoc>;
  /** Chuỗi căn cứ của văn bản ghi trên dòng: thông tư gốc + các thông tư sửa đổi tới nó. */
  chainOf: (docId: number | null | undefined) => StandardDoc[];
  status: StandardStatus;
  /** Văn bản của lần sửa (bản nháp) — dòng theo văn bản này chưa áp dụng. */
  revisionDocId: number | null;
  changeById: Map<number, StandardChange>;
  /** Bấm số hiệu ở cột Căn cứ: mở hộp xem văn bản (thông tin + tệp PDF). */
  onDoc?: (doc: StandardDoc) => void;
  /** Xoá khỏi danh mục — chỉ dòng chưa được dùng (hỏi lại; nhật ký giữ lần xoá). */
  onDelete?: (row: EquipmentNorm) => void;
  /** Ngừng áp dụng từ một năm học (hỏi lại, kèm văn bản căn cứ). */
  onStop?: (row: EquipmentNorm) => void;
  /** "2026–2027" — năm học bắt đầu ngừng của một ngày thôi áp dụng. */
  stopText: (effectiveTo: string) => string;
};

/** Nhãn đỏ cạnh tên của dòng ngừng / hết hiệu lực: "Ngừng từ 2026–2027", "Hết hiệu lực". */
function EndTag({ row, ctx }: { row: EquipmentNorm; ctx: RowContext }) {
  if (!row.effectiveTo) return null;
  const text = row.endDocument ? `Ngừng từ ${ctx.stopText(row.effectiveTo)}` : "Hết hiệu lực";
  return (
    <span className="bg-destructive-subtle text-destructive-text ms-1.5 inline-block rounded-full px-2 align-[1px] text-[0.71875rem] leading-[1.2rem] font-semibold whitespace-nowrap no-underline">
      {text}
    </span>
  );
}

/** Số cột của bảng khi có cột nút Sửa. */
const EDITABLE_COLS = 11;

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
  // Dòng bị bỏ (bản nháp) hay đã thôi áp dụng (Sở ngừng / hết hiệu lực): mờ, gạch tên.
  const removed = kind === "REMOVED" || !effectiveNow(row);
  const muted = <span className="text-muted-foreground">—</span>;
  return (
    <TableRow onClick={() => onOpen(row.id)}
      className={cn("group/row", LIFT_ROW, "cursor-pointer", selected && "bg-primary/5", removed && "text-muted-foreground [&>td]:text-muted-foreground")}>
      <TableCell className={cn("text-muted-foreground text-center tabular-nums", kind && KIND_BAR[kind])}>{index}</TableCell>
      <TableCell className="truncate font-mono text-xs">{row.catalog?.code ?? muted}</TableCell>
      <TableCell className="whitespace-normal">
        <div className="font-medium">
          <span className={cn(removed && "line-through")}>{row.name}</span>
          <ChangeTag kind={kind} />
          <EndTag row={row} ctx={ctx} />
        </div>
      </TableCell>
      <TableCell className="text-center">
        {row.minQuantity == null
          ? <span className="text-muted-foreground text-xs" title={row.quantityText ?? undefined}>Không ghi</span>
          : <span className="text-[0.9375rem] font-semibold tabular-nums">{row.minQuantity}</span>}
      </TableCell>
      <TableCell>{row.unit?.name ?? row.unitText ?? muted}</TableCell>
      <TableCell className="text-center tabular-nums">{row.minQuantity == null ? muted : basisCount(row)}</TableCell>
      <TableCell>{row.minQuantity == null ? muted : PER_LABEL[row.normBasis] ?? muted}</TableCell>
      <TableCell>{gradesShort(row, ctx.level)}</TableCell>
      <TableCell><AdjustableBadge row={row} /></TableCell>
      <TableCell className="truncate" onClick={(e) => e.stopPropagation()}>
        {doc ? (
          // Chỉ thông tư của CHÍNH dòng (gốc, hay thông tư sửa đổi mục này) — chuỗi đầy đủ ở hộp chi tiết của dòng.
          <button type="button" className="text-primary max-w-full truncate hover:underline" title="Xem văn bản"
            onClick={() => ctx.onDoc?.(doc)}>
            {docShort(doc.documentNo)}
          </button>
        ) : <span className="text-muted-foreground">{docShort(row.sourceDocument?.documentNo)}</span>}
      </TableCell>
      {editable ? (
        <TableCell className="py-1" onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="ghost" size="icon-sm" aria-label="Thao tác" title="Thao tác"
                className="text-muted-foreground hover:text-primary">
                <Ellipsis />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onSelect={() => onEdit(row.id)}>
                <Pencil />
                Sửa
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onOpen(row.id)}>
                <History />
                Lịch sử thay đổi
              </DropdownMenuItem>
              {!row.endDocument ? (
                <DropdownMenuItem variant="destructive" onSelect={() => ctx.onStop?.(row)}>
                  <CircleStop />
                  Ngừng áp dụng
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
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

/** Nhãn môn mở đầu mỗi nhóm dòng cùng môn (viên màu chính, chữ hoa nhỏ). */
function SubjectRow({ name, cols }: { name: string; cols: number }) {
  return (
    <TableRow className="hover:bg-transparent">
      <TableCell colSpan={cols} className="py-2">
        <span className="bg-primary text-primary-foreground rounded-md px-2.5 py-1 text-xs font-semibold tracking-wide uppercase">
          {name}
        </span>
      </TableCell>
    </TableRow>
  );
}

function renderRows(rows: { row: EquipmentNorm; kind?: StandardChange["kind"] }[], offset: number, p: RowsProps) {
  let last: string | undefined;
  return rows.flatMap(({ row, kind }, i) => {
    const subject = row.subject?.name ?? "Chưa gắn môn";
    const head = subject !== last
      ? [<SubjectRow key={`s${i}-${subject}`} name={subject} cols={p.cols} />]
      : [];
    last = subject;
    return [...head,
      <NormRow key={`${kind ?? ""}${row.id}`} row={row} index={offset + i + 1} kind={kind} ctx={p.ctx}
        editable={p.cols === EDITABLE_COLS} selected={p.opened === row.id} onOpen={p.onOpen} onEdit={p.onEdit} />];
  });
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

/** Tiêu đề một khối của ngăn chi tiết. */
function DrawerSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <p className="text-muted-foreground mt-4 mb-1.5 text-xs font-semibold tracking-wide uppercase">{title}</p>
      <dl className="grid grid-cols-[8.5rem_minmax(0,1fr)] gap-x-3 gap-y-2.5 border-b pt-1 pb-3.5 text-sm">{children}</dl>
    </section>
  );
}

/**
 * Ngăn bên phải của một dòng — bốn khối cùng khuôn nhãn – giá trị: Định mức (cần có, lớp, môn, nhóm phụ lục, mã thiết
 * bị), Căn cứ (văn bản, hiệu lực, ghi chú), Điều chỉnh, Lịch sử. Chân: Xoá (dòng chưa được dùng) hoặc Ngừng áp dụng (dòng đã dùng)
 * bên trái; Đóng · Sửa bên phải.
 */
function NormDrawer({ id, ctx, editable, standardId, onClose, onEdit, onOpenCatalog }: {
  id: number | null;
  ctx: RowContext;
  editable: boolean;
  standardId?: number;
  onClose: () => void;
  onEdit: (id: number) => void;
  onOpenCatalog: (catalogId: number, normId: number) => void;
  onChanged: () => void;
}) {
  const { result: r, query } = useOne<EquipmentNorm>({ resource: NORMS, id: id ?? "", queryOptions: { enabled: id != null } });
  const { data: usage } = useNormUsage(editable ? id : null);
  const change = id != null ? ctx.changeById.get(id) : undefined;
  const doc = r?.sourceDocument ? ctx.docIndex.get(r.sourceDocument.id) : undefined;
  const removed = change?.kind === "REMOVED";
  const canChange = editable && !removed;
  const day = (v?: string | null) => (v ? formatPlainDate(v) : "—");
  const origin: { text: ReactNode; sub?: ReactNode }[] = [];
  if (r && doc) {
    const [first, ...amends] = ctx.chainOf(doc.id);
    const root = first ?? doc;
    origin.push({ text: <>Có từ {docShort(root.documentNo)}</>, sub: <>ban hành {day(root.issueDate)} · áp dụng từ {day(root.effectiveDate ?? root.issueDate)}</> });
    for (const a of amends) {
      origin.push({ text: <>Sửa đổi, bổ sung theo {docShort(a.documentNo)}</>, sub: <>ban hành {day(a.issueDate)} · áp dụng từ {day(a.effectiveDate ?? a.issueDate)}</> });
    }
  }
  const unit = r ? (r.unit?.name ?? r.unitText ?? "") || null : null;
  const grades = r?.gradeLevels ? r.gradeLevels.split(",").join(", ") : "Mọi lớp";
  // Nhãn hiệu lực: Sở đã ngừng (kể cả ngừng từ năm học sau) → "Ngừng từ …"; quá ngày thôi áp dụng → "Hết hiệu lực".
  const validity: "active" | "stopped" | "expired" | null = !r ? null
    : r.endDocument && r.effectiveTo ? "stopped" : effectiveNow(r) ? "active" : "expired";
  return (
    <Sheet open={id != null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full gap-0 sm:max-w-[32rem]" aria-describedby={undefined}>
        <SheetHeader className="border-b px-6 pt-5 pb-3 pe-12">
          <SheetTitle className="text-[1.0625rem] leading-snug">
            {r?.name ?? "Thiết bị"}
            <ChangeTag kind={change?.kind} />
          </SheetTitle>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-5">
          {query.isLoading || !r ? (
            <Skeleton className="mt-4 h-60 w-full" />
          ) : (
            <>
              <DrawerSection title="Định mức">
                <KV label="Cần có">
                  {r.minQuantity == null
                    ? <span className="text-muted-foreground">Phụ lục không ghi số</span>
                    : <b>{ratioLabel(r.minQuantity, unit, r.basisSize, r.normBasis)}</b>}
                </KV>
                <KV label="Lớp">{grades}</KV>
                <KV label="Môn">{r.subject?.name ?? "—"}</KV>
                {r.sectionName || r.itemNo ? (
                  <KV label="Nhóm phụ lục">{[r.sectionName, r.itemNo ? `mục ${r.itemNo}` : null].filter(Boolean).join(" · ")}</KV>
                ) : null}
                <KV label="Mã thiết bị">
                  {r.catalog ? (
                    <button type="button" className="text-primary text-start hover:underline" onClick={() => onOpenCatalog(r.catalog!.id, r.id)}>
                      {r.catalog.code}
                    </button>
                  ) : "—"}
                </KV>
              </DrawerSection>
              <DrawerSection title="Căn cứ">
                <KV label="Văn bản">
                  {doc ? (
                    <button type="button" className="text-primary text-start hover:underline" onClick={() => ctx.onDoc?.(doc)}>
                      {doc.documentNo}
                    </button>
                  ) : r.sourceDocument?.documentNo ?? "—"}
                </KV>
                <KV label="Hiệu lực">
                  <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
                    Từ {day(r.effectiveFrom)}
                    {validity ? (
                      <Badge variant={NORM_VALIDITY_VARIANTS[validity]}>
                        {validity === "stopped" && r.effectiveTo ? `Ngừng từ ${ctx.stopText(r.effectiveTo)}` : NORM_VALIDITY_LABELS[validity]}
                      </Badge>
                    ) : null}
                  </span>
                </KV>
                {r.endDocument ? <KV label="Căn cứ ngừng">{r.endDocument.documentNo}</KV> : null}
                {r.note ? (
                  <KV label="Ghi chú">
                    <span className="border-border bg-surface-subtle text-foreground/80 block rounded-sm border-s-[3px] px-2.5 py-1 italic">{r.note}</span>
                  </KV>
                ) : null}
              </DrawerSection>
              <DrawerSection title="Điều chỉnh">
                <AdjustmentView row={r} standardId={standardId} />
              </DrawerSection>
              <section>
                <p className="text-muted-foreground mt-4 mb-2 text-xs font-semibold tracking-wide uppercase">Lịch sử</p>
                <div className="grid gap-3 text-[0.8125rem]">
                  <NormChangeLog id={r.id} format={(field, v) => {
                    const ref = /^#(\d+)$/.exec(v);
                    if (ref && (field === "sourceDocument" || field === "endDocument")) {
                      const d = ctx.docIndex.get(Number(ref[1]));
                      return d ? docShort(d.documentNo) : undefined;
                    }
                    if (field === "normBasis" || field === "adjustBasis") {
                      return PER_LABEL[v.toLowerCase()] ? `theo ${PER_LABEL[v.toLowerCase()]}` : undefined;
                    }
                    if (field === "adjustKind") return ADJUST_KIND_LABELS[v as keyof typeof ADJUST_KIND_LABELS];
                    return undefined;
                  }} />
                  {origin.map((l, i) => (
                    <div key={i} className="flex gap-2">
                      <i className="bg-muted-foreground/40 mt-1.5 size-2 shrink-0 rounded-full" />
                      <span>{l.text}{l.sub ? <><br /><span className="text-muted-foreground">{l.sub}</span></> : null}</span>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}
        </div>
        <SheetFooter className="flex-row gap-2 border-t px-6 py-3">
          {/* Dòng chưa dùng chỉ Xoá; dòng đã dùng chỉ Ngừng áp dụng (trưởng nhóm 20/11/2026). */}
          {canChange && r && !r.endDocument && usage?.inUse ? (
            <Button type="button" variant="outline" className="text-destructive-text hover:text-destructive-text"
              onClick={() => ctx.onStop?.(r)}>
              Ngừng áp dụng
            </Button>
          ) : null}
          {canChange && r && usage && !usage.inUse ? (
            <Button type="button" variant="outline" className="text-destructive-text hover:text-destructive-text"
              onClick={() => ctx.onDelete?.(r)}>
              Xoá
            </Button>
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
        legalDocument: { id: null },
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
        purpose: "",
        description: "",
        adjustment: EMPTY_ADJUSTMENT,
      }}
    >
      {(control, record) => <NormFields control={control} record={record} standard={standard} />}
    </FormDialog>
  );
}

function NormFields({ control, record, standard }: { control: Control<any>; record?: any; standard: any }) {
  const level: string | undefined = standard?.educationLevel?.code;
  const basis = useWatch({ control, name: "normBasis" });
  const legalId = useWatch({ control, name: "legalDocument.id" });
  // Sửa: văn bản căn cứ điền sẵn theo căn cứ đang ghi trên dòng (khớp số hiệu) — đổi thì chọn lại.
  const { setValue, getValues } = useFormContext();
  const { data: legalDocs } = useLegalDocs();
  const sourceNo: string | undefined = record?.sourceDocument?.documentNo;
  useEffect(() => {
    if (!sourceNo || getValues("legalDocument.id")) return;
    const hit = (legalDocs ?? []).find((d) => d.code.trim().toLowerCase() === sourceNo.trim().toLowerCase());
    // Đánh dấu "đã sửa": lần nạp bản ghi (reset giữ ô đã sửa) chạy SAU hiệu ứng này, không thì nó xoá mất.
    if (hit) setValue("legalDocument.id", hit.id, { shouldDirty: true });
  }, [sourceNo, legalDocs, getValues, setValue]);
  const appliesFrom = useLegalEffectiveFrom(legalId);
  const qty = useWatch({ control, name: "minQuantity" });
  // Chọn trước rồi mới điền sau (trưởng nhóm 17/11/2026): chưa chọn văn bản căn cứ thì mọi ô khác khoá; chưa ghi "Cần
  // có" thì ĐVT / Đối tượng / Số đối tượng khoá (dòng chỉ ghi chữ theo phụ lục); có số thì hai ô kia bắt buộc.
  const noBasis = !legalId;
  const hasQty = qty !== null && qty !== undefined && String(qty).trim() !== "";
  const perGroup = basis === "per_student" || basis === "per_class";
  return (
    <div className="space-y-4">
      {/* Một màn, không cuộn (trưởng nhóm 17/11/2026): bỏ tiêu đề nhóm, căn cứ đứng cùng hàng với mã và môn. Thêm / sửa
          phải có văn bản căn cứ; ngày áp dụng lấy theo hiệu lực của văn bản. */}
      <div className="grid items-start gap-x-4 gap-y-4 sm:grid-cols-[minmax(0,18rem)_9rem_9rem_minmax(0,14rem)]">
        <LegalBasisField control={control} block />
        <FormItem>
          <FormLabel>Áp dụng từ</FormLabel>
          <div className="bg-muted/40 text-muted-foreground flex h-9 items-center rounded-full border px-3.5 text-sm tabular-nums">
            {appliesFrom ? formatPlainDate(appliesFrom) : "—"}
          </div>
        </FormItem>
        {/* Danh mục tối thiểu là cấp cao nhất: dòng tự gắn thiết bị chuẩn của nó (thêm mới thì mã tự cấp) — chỉ hiện mã. */}
        <FormItem>
          <FormLabel>Mã thiết bị</FormLabel>
          <div className="bg-muted/40 text-muted-foreground flex h-9 items-center rounded-full border px-3.5 font-mono text-sm">
            {record?.catalog?.code ?? "Tự cấp"}
          </div>
        </FormItem>
        <RefField control={control} name="subject" resource="subjects" label="Môn / hoạt động" current={record?.subject} required
          disabledHint={noBasis ? "Chọn văn bản căn cứ trước" : undefined} />
      </div>
      <fieldset disabled={noBasis} className="min-w-0 space-y-4 disabled:opacity-60">
      <div className="grid items-start gap-x-4 gap-y-4 sm:grid-cols-[minmax(0,28rem)_minmax(0,1fr)_minmax(0,1fr)]">
        <TextField control={control} name="name" label="Tên thiết bị" rule="NAME" rules={{ required: "Nhập tên thiết bị" }} />
        <TextField control={control} name="sectionName" label="Nhóm trong phụ lục" rule="NOTE" placeholder="Tranh ảnh" />
        <TextField control={control} name="topic" label="Chủ đề dạy học" rule="NOTE" />
      </div>
      <div className="border-t pt-4">
        <div className="flex flex-wrap items-start gap-x-4 gap-y-4">
          <TextField control={control} name="minQuantity" label="Cần có" type="number" step="any" className="w-24"
            numberRule="DECIMAL_QUANTITY"
            rules={{ validate: (v: any) => v === null || v === undefined || String(v).trim() === "" || Number(v) > 0 || "Phải lớn hơn 0" }} />
          <RefField control={control} name="unit" resource="units" label="ĐVT" current={record?.unit} className="w-36"
            required={hasQty} disabledHint={!hasQty ? "Ghi Cần có trước" : undefined}
            validate={(v: any) => !hasQty || v != null || "Chọn ĐVT"} />
          <fieldset disabled={!hasQty} className="contents">
            <SelectField control={control} name="normBasis" label="Đối tượng" options={BASIS_OPTIONS} className="w-48"
              rules={{ validate: (v: any) => !hasQty || !!v || "Chọn đối tượng" }} />
            {perGroup ? (
              <TextField control={control} name="basisSize" label="Số đối tượng" type="number" numberRule="COUNT" className="w-28"
                placeholder="1"
                // Để trống là 1 (máy chủ lưu 1 thành trống) — "01/HS" của phụ lục.
                rules={{ validate: (v: any) => !hasQty || v === null || v === undefined || String(v).trim() === "" || Number(v) >= 1
                  || "Ít nhất là 1" }} />
            ) : null}
          </fieldset>
          <TextField control={control} name="quantityText" label="Số lượng (theo phụ lục)" placeholder="01/4 đến 6HS"
            rule="SHORT_TEXT" max={100} className="w-44" />
          <GradeLevelsField control={control} level={level} />
        </div>
        <div className="mt-4 flex flex-wrap items-start gap-x-6 gap-y-4">
          <AudienceField control={control} />
          <TextField control={control} name="note" label="Ghi chú" rule="NOTE" className="min-w-[16rem] flex-1" />
        </div>
      </div>
      <div className="border-t pt-4">
        <div className="grid items-start gap-x-4 gap-y-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <TextareaField control={control} name="purpose" label="Mục đích sử dụng" rows={3} className="max-w-none" boxClassName="h-[4.5rem] max-h-[4.5rem]" rule="LONG_TEXT" max={20000} />
          <TextareaField control={control} name="description" label="Mô tả chi tiết" rows={3} className="max-w-none" boxClassName="h-[4.5rem] max-h-[4.5rem]" rule="LONG_TEXT" max={20000} />
        </div>
      </div>
      <AdjustmentFields control={control} record={record} standard={standard} />
      </fieldset>
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
            <FormLabel title="Không chọn lớp nào là mọi lớp">Lớp áp dụng</FormLabel>
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
            rules={name === "forTeacher"
              ? { validate: (v: any, values: any) => !!v || !!values?.forStudent || "Chọn giáo viên hoặc học sinh" }
              : undefined}
            render={({ field }) => (
              <label className="flex items-center gap-1.5 text-sm">
                <Checkbox checked={!!field.value} onCheckedChange={(v) => field.onChange(v === true)} />
                {label}
              </label>
            )}
          />
        ))}
      </div>
      <AudienceError control={control} />
    </FormItem>
  );
}

function AudienceError({ control }: { control: Control<any> }) {
  const { errors } = useFormState({ control, name: "forTeacher" });
  const message = (errors?.forTeacher as { message?: string } | undefined)?.message;
  return message ? <p className="text-destructive text-sm">{message}</p> : null;
}

