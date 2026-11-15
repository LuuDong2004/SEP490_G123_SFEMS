import { useCan, useCustom, useInvalidate, useList, useNotification, useOne, type CrudFilter } from "@refinedev/core";
import { BookOpen, GraduationCap, Tags, ChevronLeft, FileSpreadsheet, Loader2, Upload, ChevronRight, ChevronsLeft, ChevronsRight, CopyPlus, ExternalLink, FileText, Settings, Pencil, Plus, Search, ShieldCheck, Trash2, Users, FunnelX, CalendarRange, History, Undo2 } from "lucide-react";
import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useFormContext, useWatch, type Control } from "react-hook-form";
import { Link, useNavigate } from "react-router";

import { API_URL } from "@/shared/api/constants";
import { FillBox } from "@/shared/components/layout/fill-box";
import { kyInstance, DOWNLOAD_TIMEOUT } from "@/shared/api/data";
import { errorMessage } from "@/shared/lib/api-error";
import { usePersistentState } from "@/shared/hooks/use-persistent-state";
import { cn } from "@/shared/lib/utils";
import { formatDateTime, formatPlainDate, formatEditedAt } from "@/shared/lib/format";
import { ListView, ListViewHeader } from "@/shared/components/views/list-view";
import { DeleteButton } from "@/shared/components/buttons/delete";
import { RefField } from "@/shared/components/catalog/ref-field";
import { FormDialog, type FormDialogState } from "@/shared/components/catalog/form-dialog";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
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
import { Skeleton } from "@/shared/ui/skeleton";
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
  type TopicOption,
} from "@/domains/equipment-standard/types";
import { TRACKING_TYPE_LABELS } from "@/domains/equipment-catalog/types";

import { EquipmentCatalogDetail } from "./equipment-catalog-profile";
import { useLevelParam } from "./level-picker";
import { ReviseDialog, type ReviseTarget } from "./revise-dialog";
import { countsText, StandardChangesButton, useStandardChanges } from "./standard-changes";
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
 * Danh mục thiết bị dạy học tối thiểu — MỘT màn cho cả "Bộ tiêu chuẩn theo cấp học" lẫn "Định mức
 * thiết bị theo môn" (QLTB-354). Trên cùng chọn cấp học (mỗi cấp là một bộ tiêu chuẩn, căn cứ
 * TT 37 / 38 / 39 sửa đổi bởi TT 26/2023), dưới là bảng thiết bị của bộ đó nhóm theo MÔN, mỗi môn
 * tải khi mở (THCS hơn 700 dòng, mô tả dài) — cùng kiểu nhóm của màn Phòng theo khối nhà và
 * "Theo kho/phòng" của màn Thiết bị. Bấm dòng mở hồ sơ trong hộp thoại; thêm, sửa cũng trong hộp
 * thoại.
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
        busy: standards.some((d) => d.status === "DRAFT" && d.previousStandard?.id === s.id),
      };
    })
    .sort((a, b) => a.circular.localeCompare(b.circular, "vi", { numeric: true })), [standards]);
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
  // Đổi cấp học (từ menu của tab): nhớ cấp, về bộ mặc định của cấp, cả bộ.
  useEffect(() => {
    if (!pickedLevel || pickedLevel.id === levelId) return;
    setLevelId(pickedLevel.id);
    setStandardId(null);
    setSubjectKey(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickedLevel?.id]);

  const mayCreate = useCan({ resource: NORMS, action: "create" }).data?.can ?? false;
  const mayEditStandard = useCan({ resource: "equipment_standards", action: "edit" }).data?.can ?? false;
  const [viewing, setViewing] = useState<number | null>(null);
  // Hồ sơ thiết bị (cùng khuôn trang Danh mục thiết bị) — mở từ dòng phụ lục có thiết bị, hoặc từ tab Ngoài danh mục.
  const [viewingCatalog, setViewingCatalog] = useState<CatalogView | null>(null);
  const [form, setForm] = useState<FormDialogState>({ open: false });
  // Hộp Hồ sơ bộ: đóng / xem / sửa tại chỗ (cùng một hộp, sửa xong quay về xem).
  const [profile, setProfile] = useState<ProfileMode>(null);

  const invalidate = useInvalidate();
  const { open: notify } = useNotification();
  const [lifecycle, setLifecycle] = useState<"revise" | "apply" | "discard" | null>(null);
  // Hộp Áp dụng nói trước bản nháp khác bộ đang áp dụng bao nhiêu dòng — chỉ hỏi máy chủ khi hộp mở.
  const applyDiff = useStandardChanges(standard?.id, lifecycle === "apply");
  const [busy, setBusy] = useState(false);
  const activeOfLevel = levelStandards.find((s) => s.status === "ACTIVE");
  // Bản nháp ở cấp khác lập theo cùng văn bản với bản nháp đang xem (một văn bản sửa chung nhiều thông tư).
  const siblingDrafts = useMemo(() => {
    const docNo = (s: any) => (s.documents ?? []).find((d: any) => d.id === s.revisionDocumentId)?.documentNo;
    const mine = standard?.status === "DRAFT" ? docNo(standard) : undefined;
    if (!mine) return [];
    return standards
      .filter((s) => s.status === "DRAFT" && s.id !== standard?.id && docNo(s) === mine)
      .map((s) => s.educationLevel?.name ?? s.code);
  }, [standards, standard]);
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

  /** Áp dụng / xoá bản nháp — mỗi bước một xác nhận. Lập bộ mới đi hộp riêng (`ReviseDialog`): phải khai căn cứ. */
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


      {outside ? (
        <OutsideCatalog onOpen={(id) => setViewingCatalog({ id })} />
      ) : (
      <>
      {standard ? (
        <StandardNotice
          status={status}
          siblings={siblingDrafts}
          onBackToActive={activeOfLevel ? () => { setStandardId(activeOfLevel.id); setSubjectKey(null); } : undefined}
          canWrite={mayEditStandard}
          onEditDocuments={() => setProfile("edit")}
          onDiscard={() => setLifecycle("discard")}
        />
      ) : null}

      {/* Tìm và lọc ở TRÊN, trải hết bề ngang — áp cho cả cột môn lẫn bảng (số đếm của môn đổi theo). */}
      <div className="bg-card flex flex-wrap items-center gap-2 rounded-lg border p-3">
        {/* Ô tìm giữ tối thiểu 16rem: hàng chật thì các nút lọc xuống dòng, không bóp ô tìm còn vài chữ. */}
        <div className="relative min-w-0 max-w-[26rem] grow basis-[9rem]">
          <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm thiết bị…" title="Tìm theo tên thiết bị, chủ đề" className="h-8 pl-8" />
        </div>
        {/* Hàng này rộng: bộ lọc hiện chữ — lớp, môn là nút có chữ; đối tượng (2 lựa chọn) là dải chọn. */}
        <IconFilter labeled icon={<GraduationCap />} label="lớp" allLabel="Tất cả lớp"
          value={grade === ALL ? null : grade} onChange={(v) => setGrade(v ?? ALL)}
          groups={[{ items: (level ? LEVEL_GRADES[level] ?? [] : []).map((g) => ({ key: String(g), label: `Lớp ${g}` })) }]} />
        <IconFilter labeled icon={<Users />} label="đối tượng" allLabel="Mọi đối tượng"
          value={target === ALL ? null : target} onChange={(v) => setTarget(v ?? ALL)}
          groups={[{ items: [{ key: "teacher", label: "Giáo viên dùng" }, { key: "student", label: "Học sinh dùng" }] }]} />
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
        {/* Từ hai điều kiện lọc trở lên: một nút gỡ hết, khỏi mở từng ô. */}
        {[q.trim() !== "", grade !== ALL, target !== ALL, !allSubjects, topic !== null].filter(Boolean).length >= 2 ? (
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Xoá lọc" title="Xoá lọc"
            className="text-muted-foreground hover:text-foreground"
            onClick={() => {
              setQ("");
              setGrade(ALL);
              setTarget(ALL);
              setSubjectKey(null);
              setTopic(null);
            }}>
            <FunnelX />
          </Button>
        ) : null}
        <div className="ms-auto flex flex-wrap items-center gap-2">
          {/* Bộ đang xem: trạng thái, phiên bản, Hồ sơ bộ và thao tác với bộ — cùng hàng công cụ, trước Xuất. */}
          {standard && !outside ? (
            <>
              <StandardSummary
                standard={standard}
                rows={filtering ? null : total}
                devices={devices}
                subjects={groups.length}
                actions={
                  mayEditStandard && status === "DRAFT" ? (
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
                  ) : mayEditStandard && status === "ACTIVE" ? (
                    <Button variant="outline" size="sm" title="Lập bộ mới theo văn bản mới" onClick={() => setLifecycle("revise")}>
                      <CopyPlus />
                      Lập bộ mới
                    </Button>
                  ) : null
                }
                // Sửa thông tin bộ / văn bản căn cứ ngay trong hộp Hồ sơ bộ — xem thấy sai thì sửa tại chỗ.
                canEdit={mayEditStandard && status !== "RETIRED"}
                mode={profile}
                onMode={setProfile}
              />
            </>
          ) : null}
          {editable && mayCreate ? (
            <>
              <input ref={importInput} type="file" accept=".xlsx" className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void importXlsx(f);
                }} />
            </>
          ) : null}
          {/* Thao tác khác — MỘT nút bánh răng: xuất và nhập vào bản nháp. */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" size="icon-sm" aria-label="Thao tác khác" title="Thao tác khác" disabled={!standard}>
                {transfer !== null ? <Loader2 className="animate-spin" /> : <Settings />}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuItem disabled={transfer !== null} onSelect={() => void exportXlsx()}>
                <FileSpreadsheet />
                Xuất Excel (.xlsx)
              </DropdownMenuItem>
              <DropdownMenuItem disabled={transfer !== null} onSelect={() => void exportPdf()}>
                <FileText />
                Xuất PDF (in / lưu PDF)
              </DropdownMenuItem>
              {editable && mayCreate ? (
                <DropdownMenuItem disabled={transfer !== null} onSelect={() => importInput.current?.click()}>
                  <Upload />
                  Nhập Excel vào bản nháp
                </DropdownMenuItem>
              ) : null}
              {/* Phiên bản khác của bộ (bộ đã hết hiệu lực, bản nháp) — xem lại lịch sử, không phải việc hằng ngày. */}
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
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Bảng kiểu phụ lục, trải hết bề ngang; môn chọn ở ô Môn học trên dải lọc. */}
        <FillBox>
        <div className="bg-card flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border">
          <div className="flex shrink-0 flex-wrap items-baseline gap-x-3 gap-y-1 border-b px-4 py-3">
            {/* Môn đang lọc đã hiện trên nút Môn học — tiêu đề khung chỉ nói khung này là gì. */}
            <h3 className="text-base font-semibold">Nội dung</h3>
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

      <ReviseDialog targets={reviseTargets} initialId={standard?.id ?? null} open={lifecycle === "revise"}
        onOpenChange={(o) => !o && setLifecycle(null)}
        onCreated={(drafts) => {
          const here = drafts.find((d) => levelStandards.some((s) => s.id === d.id) || d.educationLevel?.name === currentLevel?.name);
          if (here) setStandardId(here.id);
          notify?.({
            type: "success",
            message: `Đã lập bản nháp: ${drafts.map((d) => d.educationLevel?.name ?? "").filter(Boolean).join(", ")}. Kiểm tra, sửa thiết bị rồi bấm Áp dụng từng bộ.`,
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
                    Từ lúc bấm Áp dụng, bộ này là bộ <span className="text-foreground font-medium">đang áp dụng</span> của cấp học: đủ / thiếu
                    và báo cáo tính theo nó.
                    {activeOfLevel ? (
                      <>
                        {" "}Bộ hiện hành <span className="text-foreground font-medium">{activeOfLevel.standardVersion ?? activeOfLevel.code}</span> sẽ
                        hết hiệu lực, vẫn xem lại được.
                      </>
                    ) : null}{" "}
                    Áp dụng rồi thì không sửa được thiết bị trong bộ.
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
                ) : (
                  <p>Bản nháp và mọi thiết bị trong đó bị xoá hẳn. Bộ đang áp dụng không bị ảnh hưởng.</p>
                )}
              </div>
          }
          cancelLabel={lifecycle === "discard" ? "Không xoá" : "Chưa, để sau"}
          confirmLabel={lifecycle === "apply" ? "Áp dụng" : "Xoá bản nháp"}
          busy={busy}
          keepOpen
          onConfirm={() => void runLifecycle()}
        />
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

/**
 * Dải của BỘ đang xem — gọn như đầu bàn làm việc của trường: tên, trạng thái, một dòng phiên bản và
 * quy mô, ô chọn phiên bản khác (khi cấp học có nhiều bộ), và nút "Hồ sơ bộ" mở hộp thoại đầy đủ:
 * thông tin bộ, bốn con số, và các văn bản căn cứ kèm tệp PDF. Bộ nháp có thêm dải nhắc màu vàng.
 */
/** Hộp Hồ sơ bộ: đóng, đang xem, hay đang sửa tại chỗ. */
type ProfileMode = null | "view" | "edit";

function StandardSummary({ standard, rows, devices, subjects, actions, canEdit, mode, onMode }: {
  standard: any;
  rows: number | null;
  devices: number;
  subjects: number;
  /** Nút thêm / sửa của bộ — đứng trước "Hồ sơ bộ". */
  actions?: ReactNode;
  /** Có quyền sửa bộ: nút "Sửa" ở chân hộp — chính hộp chuyển sang ô nhập. */
  canEdit: boolean;
  /** Màn cha giữ: dải vàng của bộ nháp ("Sửa văn bản căn cứ") mở thẳng chế độ sửa. */
  mode: ProfileMode;
  onMode: (mode: ProfileMode) => void;
}) {
  const docs: any[] = standard.documents ?? [];
  const revisionDoc = docs.find((d) => d.id === standard.revisionDocumentId);
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
      {actions}
      <Button variant="outline" size="sm" onClick={() => onMode("view")}>
        <FileText />
        Hồ sơ bộ
      </Button>

      {/* Hồ sơ bộ trong hộp thoại — cùng khuôn với "Hồ sơ trường": đầu, dải con số, các nhóm nhãn — giá trị. */}
      <Dialog open={mode !== null} onOpenChange={(o) => onMode(o ? "view" : null)}>
        <DialogContent size={mode === "edit" && standard.status !== "DRAFT" ? "formFit" : "wideFit"} className="overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-2">
              {standard.name}
              <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>
            </DialogTitle>
            <DialogDescription className="sr-only">Hồ sơ bộ danh mục tối thiểu</DialogDescription>
          </DialogHeader>
          {mode === "edit" && canEdit ? (
            <StandardProfileForm standard={standard} onCancel={() => onMode("view")} onSaved={() => onMode("view")} />
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
    </div>
  );
}

/** Dải nhắc dưới hàng cấp học — chỉ khi bộ đang xem là bản nháp hoặc đã hết hiệu lực. */
function StandardNotice({ status, siblings, onBackToActive, canWrite, onEditDocuments, onDiscard }: {
  /** Đang xem bộ cũ / bản nháp: về bộ đang áp dụng (chọn phiên bản ở menu ⚙). */
  onBackToActive?: () => void;
  status: StandardStatus;
  /** Cấp khác còn bản nháp theo CÙNG văn bản — nhắc để không quên áp dụng. */
  siblings: string[];
  canWrite: boolean;
  onEditDocuments: () => void;
  onDiscard: () => void;
}) {
  if (status === "DRAFT") {
    return (
      <div className="bg-warning-subtle text-warning-text flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg px-4 py-2 text-sm">
        <p className="min-w-0 flex-1">
          Bản nháp, chưa dùng để tính đủ / thiếu. Kiểm tra, sửa xong thiết bị thì bấm{" "}
          <span className="font-medium">Áp dụng bộ này</span> — tính từ lúc đó.
          {siblings.length ? <> Cùng văn bản còn bản nháp ở: <span className="font-medium">{siblings.join(", ")}</span>.</> : null}
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
    return (
      // Vừa nội dung, không kéo hết bề ngang; đỏ — đang xem bộ KHÔNG còn dùng để tính đủ / thiếu.
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
    <IconFilter labeled icon={<Tags />} label="chủ đề" allLabel="Mọi chủ đề" value={value} onChange={onChange} groups={groups}
      fallback={value ? value.slice(value.indexOf(":") + 1) : undefined} />
  );
}
