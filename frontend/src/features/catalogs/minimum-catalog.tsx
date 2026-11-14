import { useCan, useCustom, useInvalidate, useList, useNotification, useOne, type CrudFilter } from "@refinedev/core";
import { BookOpen, BookOpenCheck, GraduationCap, Tags, ChevronDown, ChevronLeft, FileDown, FileSpreadsheet, Loader2, Upload, ChevronRight, ChevronsLeft, ChevronsRight, CopyPlus, ExternalLink, FileText, MoreHorizontal, Pencil, Plus, Search, ShieldCheck, Trash2 } from "lucide-react";
import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useFormContext, useWatch, type Control } from "react-hook-form";
import { Link, useNavigate } from "react-router";

import { API_URL } from "@/shared/api/constants";
import { FillBox } from "@/shared/components/layout/fill-box";
import { Segmented } from "@/shared/components/segmented";
import { kyInstance, DOWNLOAD_TIMEOUT } from "@/shared/api/data";
import { errorMessage } from "@/shared/lib/api-error";
import { usePersistentState } from "@/shared/hooks/use-persistent-state";
import { maxLengthOf, textError } from "@/shared/lib/field-rules";
import { cn } from "@/shared/lib/utils";
import { formatDateTime, formatPlainDate, formatEditedAt } from "@/shared/lib/format";
import { ListView, ListViewHeader } from "@/shared/components/views/list-view";
import { DeleteButton } from "@/shared/components/buttons/delete";
import { RefField } from "@/shared/components/catalog/ref-field";
import { FormDialog, type FormDialogState } from "@/shared/components/catalog/form-dialog";
import type { CatalogConfig } from "@/shared/components/catalog/types";
import { AsyncCombobox } from "@/shared/components/form/async-combobox";
import { IconFilter, type IconFilterGroup } from "@/shared/components/data-table/icon-filter";
import { FormSection } from "@/shared/components/form/form-section";
import { AttachmentsPanel } from "@/shared/components/voucher/attachments-panel";
import { PrintSheet } from "@/shared/components/print/print-sheet";
import { ReadField } from "@/shared/components/form/read-field";
import { SelectField, TextareaField, TextField } from "@/shared/components/form/simple-fields";
import { AlertDialog } from "@/shared/ui/alert-dialog";
import { ConfirmContent } from "@/shared/components/confirm/confirm-content";
import { Badge } from "@/shared/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/shared/ui/dropdown-menu";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/shared/ui/form";
import { Input } from "@/shared/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Skeleton } from "@/shared/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import {
  DOCUMENT_ROLE_LABELS,
  LEVEL_GRADES,
  NORM_BASIS_LABELS,
  gradesLabel,
  quantityLabel,
  type EquipmentNorm,
  type NormSubjectGroup,
  type TopicOption,
} from "@/domains/equipment-standard/types";
import { TRACKING_TYPE_LABELS } from "@/domains/equipment-catalog/types";

import { EquipmentCatalogDetail } from "./equipment-catalog-profile";
import { LIFT_ROW } from "@/shared/lib/row-lift";
import { TableEmpty } from "@/shared/components/data-table/table-empty";

/* eslint-disable @typescript-eslint/no-explicit-any */

const ALL = "__all__";

type StandardStatus = "DRAFT" | "ACTIVE" | "RETIRED";
const STATUS_LABEL: Record<StandardStatus, string> = { DRAFT: "Bản nháp", ACTIVE: "Đang áp dụng", RETIRED: "Hết hiệu lực" };
const STATUS_VARIANT: Record<StandardStatus, "warning" | "success" | "neutral"> = { DRAFT: "warning", ACTIVE: "success", RETIRED: "neutral" };

const NORMS = "equipment_norms";

/**
 * Danh mục thiết bị dạy học tối thiểu — MỘT màn cho cả "Bộ tiêu chuẩn theo cấp học" lẫn "Định mức
 * thiết bị theo môn" (QLTB-354). Trên cùng chọn cấp học (mỗi cấp là một bộ tiêu chuẩn, căn cứ
 * TT 37 / 38 / 39 sửa đổi bởi TT 26/2023), dưới là bảng thiết bị của bộ đó nhóm theo MÔN, mỗi môn
 * tải khi mở (THCS hơn 700 dòng, mô tả dài) — cùng kiểu nhóm của màn Phòng theo khối nhà và
 * "Theo kho/phòng" của màn Thiết bị. Bấm dòng mở hồ sơ trong hộp thoại; thêm, sửa cũng trong hộp
 * thoại.
 */
export function MinimumCatalog({ config }: { config: CatalogConfig }) {
  const { result: standardsResult, query: standardsQuery } = useList<any>({
    resource: "equipment_standards",
    pagination: { pageSize: 50 },
    sorters: [{ field: "sortOrder", order: "asc" }],
  });
  const standards = useMemo(() => standardsResult?.data ?? [], [standardsResult]);
  // Chọn CẤP HỌC rồi chọn BỘ của cấp đó (mặc định bộ đang áp dụng). Một cấp có thể có nhiều bộ: bộ
  // đang áp dụng, các bộ đã hết hiệu lực, và một bản nháp đang soạn theo văn bản mới.
  const levels = useMemo(() => {
    const seen = new Map<number, any>();
    for (const s of standards) if (s.educationLevel && !seen.has(s.educationLevel.id)) seen.set(s.educationLevel.id, s.educationLevel);
    return [...seen.values()];
  }, [standards]);
  const [levelId, setLevelId] = usePersistentState<number | null>("tbdh.level", null, "local");
  const [standardId, setStandardId] = usePersistentState<number | null>("tbdh.standard", null, "local");
  const levelOf = (s: any) => s?.educationLevel?.id ?? null;
  const currentLevel = levels.find((l) => l.id === levelId) ?? levels[0];
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
  const [target, setTarget] = useState(ALL);
  // Chủ đề: "topic:<chủ đề>" hoặc "section:<nhóm phụ lục>" — giá trị lấy từ /topics.
  const [topic, setTopic] = useState<string | null>(null);
  useEffect(() => {
    setGrade(ALL);
    setTopic(null);
  }, [standard?.id]);
  const topicFilter = topic ? { field: topic.startsWith("topic:") ? "topic" : "sectionName", value: topic.slice(topic.indexOf(":") + 1) } : null;

  const filters: CrudFilter[] = useMemo(
    () => [
      { field: "standard.id", operator: "eq", value: standard?.id },
      ...(applied ? [{ field: "q", operator: "contains" as const, value: applied }] : []),
      ...(grade !== ALL ? [{ field: "gradeLevel", operator: "eq" as const, value: grade }] : []),
      ...(target !== ALL ? [{ field: "target", operator: "eq" as const, value: target }] : []),
      ...(topicFilter ? [{ field: topicFilter.field, operator: "eq" as const, value: topicFilter.value }] : []),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [standard?.id, applied, grade, target, topic],
  );
  const query: Record<string, string> = { "standard.id": String(standard?.id ?? "") };
  if (applied) query.q = applied;
  if (grade !== ALL) query.gradeLevel = grade;
  if (target !== ALL) query.target = target;
  if (topicFilter) query[topicFilter.field] = topicFilter.value;
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
  // `useCustom` dựng `result` mới mỗi lần vẽ — effect phải bám vào thứ ổn định, không thì vòng lặp vẽ.
  const total = groups.reduce((n, g) => n + g.count, 0);
  const devices = groups.reduce((n, g) => n + (g.catalogs ?? g.count), 0);
  const filtering = !!applied || grade !== ALL || target !== ALL || !!topic;

  // Môn đang xem (cột trái). Môn không còn trong kết quả lọc thì rơi về môn đầu tiên.
  const [subjectKey, setSubjectKey] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = usePersistentState<number>("tbdh.pageSize", PAGE, "local");
  const [rowTotal, setRowTotal] = useState(0);
  // Đổi bộ, môn hay bộ lọc là về trang đầu.
  useEffect(() => setPage(1), [standard?.id, subjectKey, applied, grade, target, topic]);
  // Mặc định cả bộ — như phụ lục; chọn một môn ở ô Môn học để thu hẹp.
  const allSubjects = subjectKey === null || subjectKey === ALL;
  const subject = allSubjects ? undefined : groups.find((g) => String(g.subjectId) === subjectKey);

  const mayCreate = useCan({ resource: NORMS, action: "create" }).data?.can ?? false;
  const mayEditStandard = useCan({ resource: "equipment_standards", action: "edit" }).data?.can ?? false;
  const [viewing, setViewing] = useState<number | null>(null);
  // Hồ sơ thiết bị (cùng khuôn trang Danh mục thiết bị) — mở từ dòng phụ lục có thiết bị, hoặc từ tab Ngoài danh mục.
  const [viewingCatalog, setViewingCatalog] = useState<CatalogView | null>(null);
  // Tab "Ngoài danh mục": thiết bị không thuộc danh mục tối thiểu — Sở thêm ngoài thông tư, trường tự thêm.
  const [outside, setOutside] = usePersistentState<boolean>("tbdh.outside", false, "local");
  const [form, setForm] = useState<FormDialogState>({ open: false });
  const navigate = useNavigate();

  const invalidate = useInvalidate();
  const { open: notify } = useNotification();
  const [lifecycle, setLifecycle] = useState<"revise" | "apply" | "discard" | null>(null);
  const [newVersion, setNewVersion] = useState("");
  const [busy, setBusy] = useState(false);
  const activeOfLevel = levelStandards.find((s) => s.status === "ACTIVE");
  const docsLine = ((standard?.documents ?? []) as any[]).map((d) => d.documentNo).join(", ");

  // Xuất / nhập / in đi theo ĐÚNG bộ lọc đang xem (bộ, môn, tìm, lớp, đối tượng, chủ đề).
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
      const form = new FormData();
      form.append("file", file);
      form.append("standardId", String(standard.id));
      const res = await kyInstance.post("equipment_norms/import", { body: form }).json<{ created: number }>();
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

  /** Lập bộ mới / áp dụng / xoá bản nháp — ba bước của vòng đời bộ, mỗi bước một xác nhận. */
  // `StandardReviseRequest.standardVersion`: SHORT_TEXT, tối đa 50.
  const versionError = textError("SHORT_TEXT", "Phiên bản", newVersion, 50);
  const runLifecycle = async () => {
    if (!standard || !lifecycle) return;
    if (lifecycle === "revise" && versionError) return;
    setBusy(true);
    try {
      if (lifecycle === "revise") {
        const created = await kyInstance
          .post(`equipment_standards/${standard.id}/revise`, { json: { standardVersion: newVersion.trim() || null } })
          .json<{ id: number }>();
        setStandardId(created.id);
        notify?.({ type: "success", message: "Đã lập bộ nháp. Sửa thiết bị và văn bản căn cứ rồi bấm Áp dụng." });
      } else if (lifecycle === "apply") {
        await kyInstance.post(`equipment_standards/${standard.id}/apply`);
        notify?.({ type: "success", message: "Đã áp dụng bộ mới. Bộ cũ hết hiệu lực." });
      } else {
        await kyInstance.delete(`equipment_standards/${standard.id}`);
        setStandardId(activeOfLevel?.id ?? null);
        notify?.({ type: "success", message: "Đã xoá bộ nháp." });
      }
      invalidate({ resource: "equipment_standards", invalidates: ["list", "detail"] });
      invalidate({ resource: NORMS, invalidates: ["list"] });
      invalidate({ resource: "equipment_catalogs", invalidates: ["list"] });
      setLifecycle(null);
      setNewVersion("");
    } catch (error) {
      notify?.({ type: "error", message: await errorMessage(error), description: "Không thực hiện được" });
    } finally {
      setBusy(false);
    }
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
      {/* Tiêu đề chỉ cho trình đọc màn hình (thanh tab đã gọi tên màn); nút của bộ nằm cùng hàng cấp học. */}
      <ListViewHeader canCreate={false} title="Danh mục thiết bị dạy học tối thiểu" />

      <div className="flex flex-wrap items-center gap-2" data-print="hide">
        {/* Chỉ MỘT cấp học (tài khoản của trường chỉ thấy danh mục của cấp mình) thì không vẽ dải chọn cấp:
            một nút duy nhất không chọn được gì, chỉ chiếm chỗ. */}
        {standardsQuery.isLoading ? <Skeleton className="h-9 w-72 rounded-xl" /> : levels.length ? (
          <Segmented label="Cấp học" value={outside ? "outside" : String(currentLevel?.id ?? "")}
            options={[...levels.map((l) => ({ value: String(l.id), label: l.name, hint: `Danh mục thiết bị tối thiểu cấp ${l.name}` })),
              { value: "outside", label: "Ngoài danh mục", hint: "Thiết bị trường có nhưng không nằm trong danh mục tối thiểu" }]}
            onChange={(v) => {
              if (v === "outside") {
                setOutside(true);
                return;
              }
              setOutside(false);
              setLevelId(Number(v));
              setStandardId(null);
              setSubjectKey(null);
            }} />
        ) : null}
        {standard && !outside ? (
          <div className="ms-auto flex flex-wrap items-center gap-2">
            <StandardSummary
              standard={standard}
              versions={levelStandards}
              onPick={(id) => {
                setStandardId(id);
                setSubjectKey(null);
              }}
              rows={filtering ? null : total}
              devices={devices}
              subjects={groups.length}
            />
            {mayEditStandard && status === "ACTIVE" ? (
              // Hai việc hiếm làm với bộ đang áp dụng gập vào MỘT nút "⋯": hàng chỉ còn trạng thái, phiên bản
              // và "Hồ sơ bộ" — ba nút to cạnh nhau cho một bộ tiêu chuẩn ít khi đổi là quá nặng.
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon-sm" aria-label="Thao tác khác với bộ" title="Thao tác khác">
                    <MoreHorizontal />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <DropdownMenuItem onSelect={() => navigate(`${config.path}/edit/${standard.id}`)}>
                    <Pencil />
                    Sửa thông tin bộ
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setLifecycle("revise")}>
                    <CopyPlus />
                    Lập bộ mới theo văn bản mới
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : mayEditStandard && status === "DRAFT" ? (
              <>
                {mayCreate ? (
                  <Button variant="outline" size="sm" onClick={() => setForm({ open: true })}>
                    <Plus />
                    Thêm thiết bị
                  </Button>
                ) : null}
                <Button size="sm" onClick={() => setLifecycle("apply")}>
                  <ShieldCheck />
                  Áp dụng bộ này
                </Button>
              </>
            ) : null}
          </div>
        ) : null}
      </div>

      {outside ? (
        <OutsideCatalog onOpen={(id) => setViewingCatalog({ id })} />
      ) : (
      <>
      {standard ? (
        <StandardNotice
          status={status}
          canWrite={mayEditStandard}
          onEditDocuments={() => navigate(`${config.path}/edit/${standard.id}`)}
          onDiscard={() => setLifecycle("discard")}
        />
      ) : null}

      {/* Tìm và lọc ở TRÊN, trải hết bề ngang — áp cho cả cột môn lẫn bảng (số đếm của môn đổi theo). */}
      <div className="bg-card flex flex-wrap items-center gap-2 rounded-lg border p-3">
        {/* Ô tìm giữ tối thiểu 16rem: hàng chật thì các nút lọc xuống dòng, không bóp ô tìm còn vài chữ. */}
        <div className="relative min-w-64 flex-1 sm:max-w-md">
          <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm thiết bị, chủ đề…" className="pl-8" />
        </div>
        {/* Hàng này rộng: bộ lọc hiện chữ — lớp, môn là nút có chữ; đối tượng (2 lựa chọn) là dải chọn. */}
        <IconFilter labeled icon={<GraduationCap />} label="lớp" allLabel="Tất cả lớp"
          value={grade === ALL ? null : grade} onChange={(v) => setGrade(v ?? ALL)}
          groups={[{ items: (level ? LEVEL_GRADES[level] ?? [] : []).map((g) => ({ key: String(g), label: `Lớp ${g}` })) }]} />
        <Segmented label="Lọc theo đối tượng" value={target} onChange={setTarget}
          options={[{ value: ALL, label: "Mọi đối tượng" }, { value: "teacher", label: "Giáo viên dùng" }, { value: "student", label: "Học sinh dùng" }]} />
        <IconFilter labeled icon={<BookOpen />} label="môn học" allLabel="Tất cả môn" total={devices} fallback="Môn đã chọn"
          value={allSubjects ? null : subjectKey}
          onChange={(v) => {
            setSubjectKey(v);
            setTopic(null);
          }}
          groups={[{ items: groups.map((g) => ({
            key: String(g.subjectId),
            label: g.subjectName ?? "Chưa gắn môn",
            count: g.catalogs ?? g.count,
          })) }]} />
        {standard ? <TopicFilter standardId={standard.id} subjectKey={allSubjects ? null : subjectKey} value={topic} onChange={setTopic} /> : null}
        <div className="ms-auto flex flex-wrap items-center gap-2">
          {filtering ? (
            <span className="text-muted-foreground text-sm tabular-nums">
              {devices} thiết bị khớp · {groups.length} môn
            </span>
          ) : null}
          {editable && mayCreate ? (
            <>
              <input ref={importInput} type="file" accept=".xlsx" className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void importXlsx(f);
                }} />
              <Button type="button" variant="outline" disabled={transfer !== null} onClick={() => importInput.current?.click()}
                title="Nhập thiết bị từ Excel vào bản nháp. Dùng đúng mẫu cột của file xuất.">
                {transfer === "import" ? <Loader2 className="animate-spin" /> : <Upload />}
                Nhập Excel
              </Button>
            </>
          ) : null}
          {/* Một nút Xuất, chọn định dạng lúc xuất. */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" disabled={transfer !== null || !standard}>
                {transfer === "xlsx" || transfer === "pdf" ? <Loader2 className="animate-spin" /> : <FileDown />}
                Xuất
                <ChevronDown className="opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-48">
              <DropdownMenuItem onSelect={() => void exportXlsx()}>
                <FileSpreadsheet />
                Excel (.xlsx)
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void exportPdf()}>
                <FileText />
                PDF (in / lưu PDF)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Bảng kiểu phụ lục, trải hết bề ngang; môn chọn ở ô Môn học trên dải lọc. */}
        <FillBox>
        <div className="bg-card flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border">
          <div className="flex shrink-0 flex-wrap items-baseline gap-x-3 gap-y-1 border-b px-4 py-3">
            <h3 className="text-base font-semibold">{subject ? subject.subjectName ?? "Chưa gắn môn" : "Tất cả môn"}</h3>
            <span className="text-muted-foreground text-sm tabular-nums">
              {subject
                ? (subject.catalogs ?? subject.count) === subject.count
                  ? `${subject.count} thiết bị`
                  : `${subject.catalogs} thiết bị · ${subject.count} dòng phụ lục`
                : `${devices} thiết bị · ${total} dòng phụ lục`}
            </span>
            {docsLine ? <span className="text-muted-foreground ms-auto text-xs italic">Nguồn: {docsLine}</span> : null}
          </div>
          <div className="min-h-0 flex-1 overflow-auto [&>[data-slot=table-container]]:overflow-visible [&_tbody_tr:last-child]:border-b">
            <Table className="min-w-[80rem] table-fixed">
              {/* Hàng tiêu đề nổi hẳn lên: nền màu thương hiệu nhạt, chữ đậm màu thương hiệu, gạch đậm dưới. */}
              <TableHeader sticky className="border-primary/40 border-b-2 [&_th]:bg-[color-mix(in_oklab,var(--primary)_10%,var(--card))] [&_th]:text-primary [&_th]:h-11 [&_th]:font-bold">
                <TableRow className="hover:bg-transparent [&>th]:border-primary/15 [&>th]:border-r [&>th]:last:border-r-0">
                  <TableHead className="text-overline text-muted-foreground w-12 text-center">STT</TableHead>
                  {allSubjects ? <TableHead className="text-overline text-muted-foreground w-24">Môn học</TableHead> : null}
                  <TableHead className="text-overline text-muted-foreground w-32">Chủ đề dạy học</TableHead>
                  <TableHead className="text-overline text-muted-foreground w-40">Tên thiết bị</TableHead>
                  <TableHead className="text-overline text-muted-foreground w-48">Mục đích sử dụng</TableHead>
                  <TableHead className="text-overline text-muted-foreground">Mô tả chi tiết</TableHead>
                  <TableHead className="text-overline text-muted-foreground w-24 text-center">Đối tượng</TableHead>
                  <TableHead className="text-overline text-muted-foreground w-16 text-center">Đơn vị</TableHead>
                  <TableHead className="text-overline text-muted-foreground w-24 text-center">Số lượng</TableHead>
                  <TableHead className="text-overline text-muted-foreground w-32">Ghi chú</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groupsQuery.isLoading || !standard ? (
                  <TableRow>
                    <TableCell colSpan={allSubjects ? 10 : 9}>
                      <Skeleton className="h-6 w-full" />
                    </TableCell>
                  </TableRow>
                ) : groups.length === 0 || (!allSubjects && !subject) ? (
                  <TableEmpty colSpan={allSubjects ? 10 : 9} title={filtering ? "Không có thiết bị nào khớp bộ lọc." : "Bộ này chưa có thiết bị nào."} />
                ) : (
                  <AppendixRows
                    filters={subject ? [...filters, { field: "subject.id", operator: "eq", value: subject.subjectId ?? "none" }] : filters}
                    level={level}
                    showSubject={allSubjects}
                    cols={allSubjects ? 10 : 9}
                    page={page}
                    pageSize={pageSize}
                    onTotal={setRowTotal}
                    onOpenRow={(row) => (row.catalog ? setViewingCatalog({ id: row.catalog.id, normId: row.id }) : setViewing(row.id))}
                  />
                )}
              </TableBody>
            </Table>
          </div>
          {standard && groups.length ? (
            <Pager page={page} pageSize={pageSize} total={rowTotal} onPage={setPage}
              onPageSize={(n) => { setPageSize(n); setPage(1); }} />
          ) : null}
        </div>
        </FillBox>
      </>
      )}

      <AlertDialog open={lifecycle !== null} onOpenChange={(o) => !o && !busy && setLifecycle(null)}>
        <ConfirmContent
          tone={lifecycle === "discard" ? "danger" : lifecycle === "apply" ? "warning" : "neutral"}
          title={lifecycle === "revise" ? "Lập bộ mới theo văn bản mới?" : lifecycle === "apply" ? "Áp dụng bộ này?" : "Xoá bản nháp?"}
          description={
            <div className="space-y-3">
                {lifecycle === "revise" ? (
                  <>
                    <p>
                      Tạo bản nháp từ bộ đang áp dụng, gồm văn bản căn cứ và {devices} thiết bị. Sửa bản nháp theo văn bản mới rồi bấm
                      Áp dụng. Bộ đang áp dụng giữ nguyên tới lúc đó.
                    </p>
                  </>
                ) : lifecycle === "apply" ? (
                  <p>
                    Bộ này sẽ là bộ <span className="text-foreground font-medium">đang áp dụng</span> của cấp học, dùng để tính đủ / thiếu.
                    {activeOfLevel ? (
                      <>
                        {" "}Bộ hiện hành <span className="text-foreground font-medium">{activeOfLevel.standardVersion ?? activeOfLevel.code}</span> sẽ
                        hết hiệu lực, vẫn xem lại được.
                      </>
                    ) : null}{" "}
                    Áp dụng rồi thì không sửa được thiết bị trong bộ.
                  </p>
                ) : (
                  <p>Bản nháp và mọi thiết bị trong đó bị xoá hẳn. Bộ đang áp dụng không bị ảnh hưởng.</p>
                )}
              </div>
          }
          cancelLabel={lifecycle === "discard" ? "Không xoá" : "Chưa, để sau"}
          confirmLabel={lifecycle === "revise" ? "Lập bộ nháp" : lifecycle === "apply" ? "Áp dụng" : "Xoá bản nháp"}
          busy={busy}
          keepOpen
          onConfirm={() => void runLifecycle()}
        >
          {lifecycle === "revise" ? (
                    <div className="space-y-1.5">
                      <span className="text-foreground text-sm font-medium">Phiên bản của bộ mới</span>
                      <Input value={newVersion} onChange={(e) => setNewVersion(e.target.value)} placeholder="VD: 2026, theo Thông tư 12/2026/TT-BGDĐT"
                        maxLength={maxLengthOf("SHORT_TEXT", 50)} aria-invalid={!!versionError} />
                      {versionError ? <p className="text-destructive text-sm">{versionError}</p> : null}
                    </div>
          ) : null}
        </ConfirmContent>
      </AlertDialog>

      <NormDetailDialog
        id={viewing}
        level={level}
        editable={editable}
        onOpenChange={(open) => !open && setViewing(null)}
        onEdit={(id) => {
          setViewing(null);
          setForm({ open: true, id });
        }}
      />
      <CatalogDetailDialog
        view={viewingCatalog}
        editableNorm={editable && !outside}
        onClose={() => setViewingCatalog(null)}
        onEditNorm={(id) => {
          setViewingCatalog(null);
          setForm({ open: true, id });
        }}
      />
      {standard ? (
        <NormFormDialog state={form} onOpenChange={(open) => setForm((f) => ({ ...f, open }))} standard={standard} />
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
  if (!docs.length) return <p className="text-muted-foreground text-sm">Bộ chưa khai văn bản căn cứ.</p>;
  return (
    <div className="space-y-3">
      {docs.map((d) => (
        <section key={d.id} className="space-y-3 rounded-lg border p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <FileText className="text-muted-foreground size-4" />
                <span className="font-semibold">{d.documentNo}</span>
                <Badge variant="neutral">{DOCUMENT_ROLE_LABELS[d.documentRole] ?? d.documentRole}</Badge>
              </div>
              {d.documentName ? <p className="text-sm">{d.documentName}</p> : null}
              <p className="text-muted-foreground text-xs">
                {[
                  d.issuingAuthority,
                  d.issueDate ? `Ban hành ${formatPlainDate(d.issueDate)}` : null,
                  d.effectiveDate ? `Hiệu lực ${formatPlainDate(d.effectiveDate)}` : null,
                ].filter(Boolean).join(" · ")}
              </p>
            </div>
            {d.url ? (
              <Button asChild variant="ghost" size="sm" className="h-7">
                <a href={d.url} target="_blank" rel="noreferrer">
                  <ExternalLink />
                  Văn bản gốc
                </a>
              </Button>
            ) : null}
          </div>
          <AttachmentsPanel
            resource="equipment_standard_documents"
            recordId={d.id}
            canWrite={mayWrite}
            compact
            title="Tệp văn bản"
            description="Tệp PDF của văn bản. Bấm biểu tượng con mắt để xem."
          />
        </section>
      ))}
    </div>
  );
}

/** Một dòng "nhãn — giá trị" của hồ sơ bộ (cùng hình với hồ sơ trường). */
function ProfileRow({ label, children }: { label: string; children?: ReactNode }) {
  return (
    <div className="grid grid-cols-[9.5rem_minmax(0,1fr)] gap-3 border-b py-2.5 text-sm last:border-b-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium break-words">{children ?? <span className="text-muted-foreground font-normal">—</span>}</dd>
    </div>
  );
}

/**
 * Dải của BỘ đang xem — gọn như đầu bàn làm việc của trường: tên, trạng thái, một dòng phiên bản và
 * quy mô, ô chọn phiên bản khác (khi cấp học có nhiều bộ), và nút "Hồ sơ bộ" mở hộp thoại đầy đủ:
 * thông tin bộ, bốn con số, và các văn bản căn cứ kèm tệp PDF. Bộ nháp có thêm dải nhắc màu vàng.
 */
function StandardSummary({ standard, versions, onPick, rows, devices, subjects }: {
  standard: any;
  versions: any[];
  onPick: (id: number) => void;
  rows: number | null;
  devices: number;
  subjects: number;
}) {
  const [open, setOpen] = useState(false);
  const docs: any[] = standard.documents ?? [];
  const status: StandardStatus = standard.status ?? "ACTIVE";
  const figures = [
    { label: "Thiết bị", value: devices },
    { label: "Dòng phụ lục", value: rows ?? "—" },
    { label: "Môn / hoạt động", value: subjects },
    { label: "Văn bản căn cứ", value: docs.length },
  ];
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>
      {versions.length > 1 ? (
        <Select value={String(standard.id)} onValueChange={(v) => onPick(Number(v))}>
          <SelectTrigger className="h-8 w-auto min-w-56 text-sm" aria-label="Phiên bản của bộ">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {versions.map((v) => (
              <SelectItem key={v.id} value={String(v.id)}>
                {v.standardVersion ?? v.code} — {STATUS_LABEL[(v.status ?? "ACTIVE") as StandardStatus]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : standard.standardVersion ? (
        <span className="text-muted-foreground text-sm">Phiên bản {standard.standardVersion}</span>
      ) : null}
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <FileText />
        Hồ sơ bộ
      </Button>

      {/* Hồ sơ bộ trong hộp thoại — cùng khuôn với "Hồ sơ trường": đầu, dải con số, các nhóm nhãn — giá trị. */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent size="wide" className="overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Hồ sơ bộ tiêu chuẩn</DialogTitle>
            <DialogDescription className="sr-only">{standard.name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            <div className="flex flex-wrap items-start gap-5">
              <span className="bg-primary/10 text-primary flex size-16 shrink-0 items-center justify-center rounded-xl">
                <BookOpenCheck className="size-7" />
              </span>
              <div className="min-w-0 flex-1 space-y-2 pt-1">
                <h2 className="text-2xl font-semibold tracking-tight">{standard.name}</h2>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="bg-muted rounded-md px-2 py-0.5 font-mono text-xs font-medium">{standard.code}</span>
                  <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>
                </div>
                <p className="text-muted-foreground text-sm">
                  {[standard.educationLevel?.name, standard.standardVersion ? `Phiên bản ${standard.standardVersion}` : null].filter(Boolean).join(" · ")}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 divide-y rounded-lg border sm:grid-cols-4 sm:divide-x sm:divide-y-0">
              {figures.map((f) => (
                <div key={f.label} className="px-4 py-3">
                  <div className="text-muted-foreground text-xs">{f.label}</div>
                  <div className="text-xl font-semibold tabular-nums">{f.value}</div>
                </div>
              ))}
            </div>

            <div className="grid gap-x-10 gap-y-6 md:grid-cols-2">
              <section>
                <h3 className="text-overline text-muted-foreground mb-1">Thông tin bộ</h3>
                <dl>
                  <ProfileRow label="Mã bộ">{standard.code}</ProfileRow>
                  <ProfileRow label="Cấp học">{standard.educationLevel?.name}</ProfileRow>
                  <ProfileRow label="Phiên bản">{standard.standardVersion}</ProfileRow>
                  <ProfileRow label="Trạng thái">{STATUS_LABEL[status]}</ProfileRow>
                </dl>
              </section>
              <section>
                <h3 className="text-overline text-muted-foreground mb-1">Hiệu lực</h3>
                <dl>
                  <ProfileRow label="Năm học bắt đầu">{standard.startSchoolYear?.name}</ProfileRow>
                  <ProfileRow label="Năm học kết thúc">{standard.endSchoolYear?.name}</ProfileRow>
                  <ProfileRow label="Thay thế bộ">{standard.previousStandard?.name ?? null}</ProfileRow>
                  <ProfileRow label="Ghi chú">{standard.note || null}</ProfileRow>
                </dl>
              </section>
            </div>

            <section className="space-y-2">
              <h3 className="text-overline text-muted-foreground">Căn cứ pháp lý · {docs.length} văn bản</h3>
              <LegalDocuments docs={docs} />
            </section>

            {status === "ACTIVE" ? (
              <p className="text-muted-foreground text-xs">
                Bộ đang áp dụng không sửa được thiết bị. Có văn bản mới thì lập bộ mới.
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">Đóng</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Dải nhắc dưới hàng cấp học — chỉ khi bộ đang xem là bản nháp hoặc đã hết hiệu lực. */
function StandardNotice({ status, canWrite, onEditDocuments, onDiscard }: {
  status: StandardStatus;
  canWrite: boolean;
  onEditDocuments: () => void;
  onDiscard: () => void;
}) {
  if (status === "DRAFT") {
    return (
      <div className="bg-warning-subtle text-warning-text flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg px-4 py-2 text-sm">
        <p className="min-w-0 flex-1">
          Bản nháp, chưa dùng để tính đủ / thiếu. Sửa xong văn bản căn cứ và thiết bị thì bấm{" "}
          <span className="font-medium">Áp dụng bộ này</span>.
        </p>
        {canWrite ? (
          <div className="flex shrink-0 gap-1">
            <Button type="button" variant="ghost" size="sm" className="h-7" onClick={onEditDocuments}>
              <Pencil />
              Sửa văn bản căn cứ
            </Button>
            <Button type="button" variant="ghost" size="sm" className="text-destructive hover:text-destructive h-7" onClick={onDiscard}>
              <Trash2 />
              Xoá bản nháp
            </Button>
          </div>
        ) : null}
      </div>
    );
  }
  if (status === "RETIRED") {
    return <p className="bg-surface-subtle text-muted-foreground rounded-lg px-4 py-2 text-sm">Bộ đã hết hiệu lực, đã có bộ mới thay thế. Chỉ còn để xem lại.</p>;
  }
  return null;
}

/** Số dòng mỗi trang mặc định — mỗi dòng kèm mô tả dài. */
const PAGE = 20;

/**
 * Các dòng của môn đang chọn (hoặc cả bộ), trình bày như phụ lục thông tư: STT · (Môn) · Chủ đề dạy
 * học · Tên thiết bị · Mục đích sử dụng · Mô tả chi tiết · Đối tượng · Đơn vị · Số lượng · Ghi chú —
 * chữ đầy đủ, không cắt. PHÂN TRANG ở máy chủ (mô tả dài, ứng dụng phục vụ vài nghìn người cùng lúc).
 * Khi NHÓM của phụ lục đổi thì chen một dòng nhóm: nhãn nhóm dạng thẻ, phần còn lại là chủ đề.
 */
function AppendixRows({ filters, level, showSubject, cols, page, pageSize, onTotal, onOpenRow }: {
  filters: CrudFilter[];
  level?: string;
  /** Đang xem cả bộ: thêm cột Môn học. */
  showSubject: boolean;
  cols: number;
  page: number;
  pageSize: number;
  onTotal: (total: number) => void;
  onOpenRow: (row: EquipmentNorm) => void;
}) {
  const { result, query } = useList<EquipmentNorm>({
    resource: NORMS,
    filters,
    sorters: [{ field: "sortOrder", order: "asc" }],
    pagination: { currentPage: page, pageSize },
  });
  const rows = (result?.data ?? []) as EquipmentNorm[];
  const total = result?.total ?? 0;
  useEffect(() => {
    if (!query.isLoading) onTotal(total);
  }, [total, query.isLoading, onTotal]);
  if (query.isLoading) {
    return (
      <TableRow>
        <TableCell colSpan={cols}>
          <Skeleton className="h-6 w-full" />
        </TableCell>
      </TableRow>
    );
  }
  const offset = (page - 1) * pageSize;
  const cell = "border-r align-top whitespace-normal last:border-r-0";
  return (
    <>
      {rows.map((row, i) => {
        const startsSection = row.sectionName && (i === 0 || rows[i - 1].sectionName !== row.sectionName);
        const [groupName, ...rest] = (row.sectionName ?? "").split(" › ");
        const grades = gradesLabel(row.gradeLevels, level);
        // Ghi chú của phụ lục đã thường là "Dùng cho lớp 1, 2" — có thì dùng nguyên, không thì dựng từ lớp áp dụng.
        const remark = row.note || (grades && grades !== "Mọi lớp" ? `Dùng cho ${grades.charAt(0).toLowerCase()}${grades.slice(1)}` : "");
        return (
          <Fragment key={row.id}>
            {startsSection ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={cols} className="bg-card py-2.5 ps-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="bg-primary text-primary-foreground rounded px-2 py-0.5 text-xs font-semibold tracking-wide uppercase">
                      {groupName}
                    </span>
                    {rest.length ? <span className="text-foreground text-sm font-semibold">{rest.join(" › ")}</span> : null}
                  </div>
                </TableCell>
              </TableRow>
            ) : null}
            <TableRow className={cn("group/row", LIFT_ROW, "cursor-pointer text-[0.8125rem] leading-relaxed")} onClick={() => onOpenRow(row)}>
              <TableCell className={cn(cell, "text-muted-foreground text-center tabular-nums")}>{offset + i + 1}</TableCell>
              {showSubject ? <TableCell className={cell}>{row.subject?.name ?? "—"}</TableCell> : null}
              <TableCell className={cell}>{topicOf(row) ?? <span className="text-muted-foreground">—</span>}</TableCell>
              <TableCell className={cn(cell, "font-medium")}>
                {row.name}
                {row.optional ? <Badge variant="neutral" className="ms-1.5 align-middle">Tự chọn</Badge> : null}
              </TableCell>
              <TableCell className={cn(cell, "whitespace-pre-line")}>{row.purpose ?? <span className="text-muted-foreground">—</span>}</TableCell>
              <TableCell className={cn(cell, "whitespace-pre-line")}>{row.description ?? <span className="text-muted-foreground">—</span>}</TableCell>
              <TableCell className={cn(cell, "text-center")}>
                <AudienceLabel teacher={row.forTeacher} student={row.forStudent} />
              </TableCell>
              <TableCell className={cn(cell, "text-center")}>{row.unit?.name ?? row.unitText ?? <span className="text-muted-foreground">—</span>}</TableCell>
              <TableCell className={cn(cell, "text-center tabular-nums")}>
                {row.minQuantity == null && !row.quantityText ? <span className="text-muted-foreground">Không ghi</span> : quantityLabel(row)}
              </TableCell>
              <TableCell className={cell}>{remark || <span className="text-muted-foreground">—</span>}</TableCell>
            </TableRow>
          </Fragment>
        );
      })}
    </>
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

function AudienceLabel({ teacher, student }: { teacher: boolean; student: boolean }) {
  if (!teacher && !student) return <span className="text-muted-foreground">—</span>;
  return <span>{[teacher ? "Giáo viên" : null, student ? "Học sinh" : null].filter(Boolean).join(", ")}</span>;
}

type CatalogView = { id: number; /** Dòng phụ lục đã mở nó — có thì bộ nháp sửa / xoá được dòng đó. */ normId?: number };

/**
 * Hồ sơ một thiết bị — CÙNG khuôn trang chi tiết của Danh mục thiết bị (`EquipmentCatalogDetail`: thẻ đầu, mô tả,
 * các dòng phụ lục đòi nó, thuộc tính). Mở từ một dòng phụ lục thì bộ nháp còn nút sửa / xoá dòng đó.
 */
function CatalogDetailDialog({ view, editableNorm, onClose, onEditNorm }: {
  view: CatalogView | null;
  editableNorm: boolean;
  onClose: () => void;
  onEditNorm: (normId: number) => void;
}) {
  const navigate = useNavigate();
  const { result: r, query } = useOne<any>({ resource: "equipment_catalogs", id: view?.id ?? "", queryOptions: { enabled: view != null } });
  const mayEditCatalog = useCan({ resource: "equipment_catalogs", action: "edit" }).data?.can ?? false;
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
          {mayEditCatalog && view ? (
            <Button type="button" onClick={() => navigate(`/equipment-catalogs/edit/${view.id}`)}>
              <Pencil />
              Sửa thiết bị
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
function OutsideCatalog({ onOpen }: { onOpen: (id: number) => void }) {
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

/** Hồ sơ một dòng: cùng nhóm, cùng thứ tự với form thêm / sửa — bấm Sửa thì ô nằm nguyên chỗ. */
function NormDetailDialog({ id, level, editable, onOpenChange, onEdit }: {
  id: number | null;
  level?: string;
  /** Chỉ bộ NHÁP sửa / xoá được thiết bị — bộ đang áp dụng đổi theo văn bản mới. */
  editable: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (id: number) => void;
}) {
  const { result: r, query } = useOne<EquipmentNorm>({ resource: NORMS, id: id ?? "", queryOptions: { enabled: id != null } });
  const mayEdit = useCan({ resource: NORMS, action: "edit" }).data?.can ?? false;
  return (
    <Dialog open={id != null} onOpenChange={onOpenChange}>
      <DialogContent size="wide" className="overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{r?.name ?? "Thiết bị"}</DialogTitle>
        </DialogHeader>
        {query.isLoading || !r ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <div className="space-y-5">
            <FormSection title="Thiết bị" compact>
              <div className="grid items-start gap-5 sm:grid-cols-2 lg:grid-cols-4">
                <ReadField label="Tên thiết bị" className="sm:col-span-2">{r.name}</ReadField>
                <ReadField label="Trong danh mục thiết bị">
                  {r.catalog ? (
                    <Link to={`/equipment-catalogs/show/${r.catalog.id}`} title="Mở thiết bị trong Danh mục thiết bị"
                      className="text-primary inline-flex items-center gap-1.5 font-medium tabular-nums hover:underline">
                      {r.catalog.code}
                      <ExternalLink className="size-3.5" />
                    </Link>
                  ) : null}
                </ReadField>
                <ReadField label="Môn / hoạt động">{r.subject?.name}</ReadField>
                <ReadField label="Nhóm trong phụ lục" className="sm:col-span-2">{r.sectionName}</ReadField>
                <ReadField label="Chủ đề dạy học" className="sm:col-span-2">{topicOf(r)}</ReadField>
              </div>
            </FormSection>
            <FormSection title="Định mức" compact>
              <div className="grid items-start gap-5 sm:grid-cols-2 lg:grid-cols-4">
                <ReadField label="Số lượng (theo phụ lục)">{r.quantityText}</ReadField>
                <ReadField label="Tính theo">
                  {r.minQuantity == null ? (
                    <span className="text-muted-foreground">Phụ lục không ghi số nên không tính đủ / thiếu</span>
                  ) : (
                    <>
                      {r.minQuantity} {r.unit?.name ?? ""} · {NORM_BASIS_LABELS[r.normBasis] ?? r.normBasis}
                      {r.basisSize && r.basisSize > 1 ? ` (${r.basisSize})` : ""}
                    </>
                  )}
                </ReadField>
                <ReadField label="Lớp áp dụng">{gradesLabel(r.gradeLevels, level)}</ReadField>
                <ReadField label="Đối tượng sử dụng">
                  <AudienceLabel teacher={r.forTeacher} student={r.forStudent} />
                </ReadField>
                {r.optional ? (
                  <ReadField label="Tự chọn" className="sm:col-span-2 lg:col-span-4">
                    Trường chọn môn hoặc phương án nào thì trang bị theo đó. Không tính vào đủ / thiếu.
                  </ReadField>
                ) : null}
              </div>
            </FormSection>
            <FormSection title="Mục đích và mô tả" compact>
              <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
                <LongText label="Mục đích sử dụng" text={r.purpose} />
                <LongText label="Mô tả chi tiết" text={r.description} />
              </div>
            </FormSection>
            <FormSection title="Căn cứ" compact>
              <div className="grid items-start gap-5 sm:grid-cols-2 lg:grid-cols-4">
                <ReadField label="Văn bản">{r.sourceDocument?.documentNo}</ReadField>
                <ReadField label="Số thứ tự trong phụ lục">{r.itemNo}</ReadField>
                <ReadField label="Ghi chú" className="sm:col-span-2">{r.note || null}</ReadField>
              </div>
            </FormSection>
            <p className="text-muted-foreground flex flex-wrap gap-x-6 text-xs">
              <span>Mã dòng <span className="text-foreground tabular-nums">{r.code}</span></span>
              <span>Tạo lúc <span className="text-foreground">{r.createdAt ? formatDateTime(r.createdAt) : "—"}</span></span>
              <span>Sửa lần cuối <span className="text-foreground">{formatEditedAt(r)}</span></span>
            </p>
          </div>
        )}
        <DialogFooter>
          {editable && id != null ? (
            <DeleteButton resource={NORMS} recordItemId={id} variant="outline" className="sm:me-auto" onSuccess={() => onOpenChange(false)} />
          ) : null}
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Đóng
            </Button>
          </DialogClose>
          {editable && mayEdit && id != null ? (
            <Button type="button" onClick={() => onEdit(id)}>
              <Pencil />
              Sửa
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Đoạn văn dài của phụ lục — giữ xuống dòng như văn bản gốc. */
function LongText({ label, text }: { label: string; text: string | null }) {
  return (
    <div className="grid min-w-0 gap-2">
      <span className="text-sm font-medium">{label}</span>
      <div className="bg-surface-subtle rounded-md border px-3 py-2 text-sm leading-relaxed break-words whitespace-pre-line">
        {text || <span className="text-muted-foreground">—</span>}
      </div>
    </div>
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

/**
 * Nút lọc Chủ đề: chủ đề dạy học và nhóm của phụ lục của bộ đang xem, chia theo môn, gõ để tìm — một cấp có tới vài trăm chủ
 * đề. Đã chọn môn thì chỉ còn chủ đề của môn đó.
 */
function TopicFilter({ standardId, subjectKey, value, onChange }: {
  standardId: number;
  subjectKey: string | null;
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  const { result } = useCustom<TopicOption[]>({
    url: `${API_URL}/${NORMS}/topics`,
    method: "get",
    config: { query: { "standard.id": String(standardId) } },
    queryOptions: { staleTime: 5 * 60_000 },
  });
  const data = result?.data;
  const groups = useMemo(() => {
    const options = Array.isArray(data) ? (data as TopicOption[]) : [];
    const map = new Map<string, IconFilterGroup["items"]>();
    for (const o of options) {
      if (subjectKey && String(o.subjectId) !== subjectKey) continue;
      const key = o.subjectName ?? "Chưa gắn môn";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push({ key: `${o.kind}:${o.value}`, label: o.value, count: o.count });
    }
    // Đã chọn một môn thì tên môn trên mỗi nhóm là thừa.
    return [...map.entries()].map(([heading, items]) => ({ heading: subjectKey ? undefined : heading, items }));
  }, [data, subjectKey]);
  return (
    <IconFilter icon={<Tags />} label="chủ đề" allLabel="Mọi chủ đề" value={value} onChange={onChange} groups={groups}
      fallback={value ? value.slice(value.indexOf(":") + 1) : undefined} />
  );
}
