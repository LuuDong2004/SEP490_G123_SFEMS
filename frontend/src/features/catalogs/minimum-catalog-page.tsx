import { useCan, useCustom, useList, useNotification, useResourceParams, type CrudFilter } from "@refinedev/core";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";

import { API_URL } from "@/shared/api/constants";
import { kyInstance } from "@/shared/api/data";
import { errorMessage } from "@/shared/lib/api-error";
import { TAB_IDLE, TAB_ITEM, TAB_STRIP } from "@/shared/lib/tab-style";
import { cn } from "@/shared/lib/utils";
import { ReadField } from "@/shared/components/form/read-field";
import { ListView, ListViewHeader } from "@/shared/components/views/list-view";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { CatalogFormDialog } from "@/features/catalogs/catalog-form-dialog";
import { CatalogShowDialog } from "@/features/catalogs/catalog-show-dialog";
import { equipmentStandardConfig } from "@/features/catalogs/extras/equipment-standard";
import type { StandardDocument } from "@/features/catalogs/extras/standard-documents";
import { OutsideCatalog } from "@/features/catalogs/outside-catalog";

type Standard = {
  id: number; code: string; name: string; status: "DRAFT" | "ACTIVE" | "RETIRED";
  standardVersion: string | null; previousStandard: { name: string } | null;
  documents: StandardDocument[];
};
type Group = { subjectId: number | null; subjectName: string | null; count: number; catalogs: number };
type Topic = { subjectId: number | null; subjectName: string | null; kind: "topic" | "section"; value: string; count: number };
type Norm = {
  id: number; code: string; name: string; itemNo: string | null; sectionName: string | null;
  topic: string | null; purpose: string | null; description: string | null; note: string | null;
  subject: { name: string } | null; gradeLevels: string | null; catalog: { name: string } | null;
  sourceDocument: { documentNo: string } | null; unit: { name: string } | null; unitText: string | null;
  minQuantity: number | null; quantityText: string | null; normBasis: string;
  forTeacher: boolean; forStudent: boolean; optional: boolean;
};

const STATUS = { DRAFT: "Bản nháp", ACTIVE: "Đang áp dụng", RETIRED: "Hết hiệu lực" } as const;
const BASIS: Record<string, string> = {
  PER_CLASS: "Theo lớp", PER_SCHOOL: "Theo trường", PER_STUDENT: "Theo học sinh",
  PER_TEACHER: "Theo giáo viên", PER_ROOM: "Theo phòng",
};
const ALL = "all";
const PAGE_SIZE = 20;

function escapeHtml(value: unknown) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

export function MinimumCatalogPage() {
  const { action, id } = useResourceParams();
  const { result: standardsResult } = useList<Standard>({
    resource: "equipment_standards", pagination: { pageSize: 100 },
    sorters: [{ field: "sortOrder", order: "asc" }],
  });
  const standards = standardsResult.data ?? [];
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const standard = standards.find((item) => item.id === selectedId)
    ?? standards.find((item) => item.status === "ACTIVE") ?? standards[0];
  const [search, setSearch] = useState("");
  const [queryText, setQueryText] = useState("");
  const [subject, setSubject] = useState(ALL);
  const [grade, setGrade] = useState(ALL);
  const [target, setTarget] = useState(ALL);
  const [topic, setTopic] = useState(ALL);
  const [page, setPage] = useState(1);
  const [viewing, setViewing] = useState<Norm | null>(null);
  // Tab "Ngoài danh mục": thiết bị không thuộc danh mục tối thiểu — Sở thêm ngoài thông tư, trường tự thêm.
  const [outside, setOutside] = useState(false);
  const [busy, setBusy] = useState<"xlsx" | "pdf" | "import" | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const { open } = useNotification();
  const mayWrite = useCan({ resource: "equipment_norms", action: "create" }).data?.can ?? false;

  useEffect(() => { const timer = setTimeout(() => setQueryText(search.trim()), 300); return () => clearTimeout(timer); }, [search]);
  useEffect(() => { setPage(1); }, [standard?.id, subject, grade, target, topic, queryText]);
  useEffect(() => { setSubject(ALL); setTopic(ALL); }, [standard?.id]);

  const filters = useMemo<CrudFilter[]>(() => standard ? [
    { field: "standard.id", operator: "eq", value: standard.id },
    ...(subject !== ALL ? [{ field: "subject.id", operator: "eq" as const, value: subject }] : []),
    ...(grade !== ALL ? [{ field: "gradeLevel", operator: "eq" as const, value: grade }] : []),
    ...(target !== ALL ? [{ field: "target", operator: "eq" as const, value: target }] : []),
    ...(topic !== ALL ? [{ field: topic.startsWith("topic:") ? "topic" : "sectionName",
      operator: "eq" as const, value: topic.slice(topic.indexOf(":") + 1) }] : []),
    ...(queryText ? [{ field: "q", operator: "contains" as const, value: queryText }] : []),
  ] : [], [standard, subject, grade, target, topic, queryText]);
  const query = useMemo(() => {
    const params: Record<string, string> = { "standard.id": String(standard?.id ?? "") };
    if (subject !== ALL) params["subject.id"] = subject;
    if (grade !== ALL) params.gradeLevel = grade;
    if (target !== ALL) params.target = target;
    if (topic !== ALL) params[topic.startsWith("topic:") ? "topic" : "sectionName"] = topic.slice(topic.indexOf(":") + 1);
    if (queryText) params.q = queryText;
    return params;
  }, [standard?.id, subject, grade, target, topic, queryText]);
  const groupQuery = useMemo(() => {
    const { "subject.id": _subject, topic: _topic, sectionName: _section, ...rest } = query;
    void _subject; void _topic; void _section;
    return rest;
  }, [query]);

  const { result: groupsResult, query: groupsQuery } = useCustom<Group[]>({
    url: `${API_URL}/equipment_norms/groups`, method: "get",
    config: { query: groupQuery }, queryOptions: { enabled: !!standard?.id },
  });
  const groups = useMemo(() => Array.isArray(groupsResult?.data) ? groupsResult.data : [], [groupsResult]);
  const { result: topicsResult } = useCustom<Topic[]>({
    url: `${API_URL}/equipment_norms/topics`, method: "get",
    config: { query: { "standard.id": String(standard?.id ?? "") } },
    queryOptions: { enabled: !!standard?.id },
  });
  const topics = Array.isArray(topicsResult?.data) ? topicsResult.data : [];
  const { result: normsResult, query: normsQuery } = useList<Norm>({
    resource: "equipment_norms", filters,
    sorters: [{ field: "sortOrder", order: "asc" }],
    pagination: { currentPage: page, pageSize: PAGE_SIZE },
    queryOptions: { enabled: !!standard?.id },
  });
  const rows = normsResult.data ?? [];
  const total = normsResult.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const groupCount = groups.reduce((sum, group) => sum + group.count, 0);

  async function exportXlsx() {
    if (!standard) return;
    setBusy("xlsx");
    try {
      const blob = await kyInstance.get("equipment_norms/export.xlsx", { searchParams: query }).blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `dinh-muc-thpt-${standard.code}.xlsx`;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { open?.({ type: "error", message: "Không xuất được tệp Excel" }); }
    finally { setBusy(null); }
  }

  async function importFile(file: File) {
    if (!standard || standard.status !== "DRAFT") return;
    setBusy("import");
    try {
      const form = new FormData();
      form.append("standardId", String(standard.id));
      form.append("file", file);
      const response = await kyInstance.post("equipment_norms/import", { body: form }).json<{ created: number }>();
      await Promise.all([normsQuery.refetch(), groupsQuery.refetch()]);
      open?.({ type: "success", message: `Đã nhập ${response.created} dòng định mức` });
    } catch (error) { open?.({ type: "error", message: await errorMessage(error) }); }
    finally { setBusy(null); if (fileInput.current) fileInput.current.value = ""; }
  }

  async function printPdf() {
    if (!standard) return;
    const popup = window.open("", "_blank");
    if (!popup) { open?.({ type: "error", message: "Trình duyệt đang chặn cửa sổ in" }); return; }
    setBusy("pdf");
    try {
      const all: Norm[] = [];
      for (let start = 0; start < 10000; start += 1000) {
        const batch = await kyInstance.get("equipment_norms", {
          searchParams: { ...query, _start: String(start), _end: String(start + 1000), _sort: "sortOrder", _order: "asc" },
        }).json<Norm[]>();
        all.push(...batch);
        if (batch.length < 1000) break;
      }
      const body = all.map((row, index) => `<tr><td>${index + 1}</td><td>${escapeHtml(row.subject?.name)}</td><td>${escapeHtml(row.itemNo)}</td><td>${escapeHtml(row.name)}</td><td>${escapeHtml(row.purpose)}</td><td>${escapeHtml(row.unit?.name ?? row.unitText)}</td><td>${escapeHtml(row.quantityText ?? row.minQuantity)}</td><td>${escapeHtml(row.note)}</td></tr>`).join("");
      popup.document.write(`<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>Danh mục tối thiểu THPT</title><style>body{font-family:Arial,sans-serif;padding:20px}h1{font-size:18px}p{font-size:12px}table{border-collapse:collapse;width:100%;font-size:10px}th,td{border:1px solid #777;padding:5px;vertical-align:top}th{background:#eee}@page{size:A4 landscape;margin:12mm}</style></head><body><h1>${escapeHtml(standard.name)}</h1><p>${escapeHtml(standard.standardVersion)} · ${all.length} dòng</p><table><thead><tr><th>STT</th><th>Môn</th><th>Mục</th><th>Thiết bị</th><th>Mục đích</th><th>Đơn vị</th><th>Số lượng</th><th>Ghi chú</th></tr></thead><tbody>${body}</tbody></table></body></html>`);
      popup.document.close();
      popup.focus();
      popup.print();
    } catch { popup.close(); open?.({ type: "error", message: "Không tạo được bản in PDF" }); }
    finally { setBusy(null); }
  }

  return <>
    <ListView>
      <ListViewHeader actions={standard && !outside ? <Button variant="outline" asChild><Link to={`/catalogs/equipment-standards/show/${standard.id}`}>Hồ sơ bộ tiêu chuẩn</Link></Button> : null} />
      <div role="tablist" aria-label="Cấp học" className={TAB_STRIP}>
        {[
          { value: false, label: "THPT", hint: "Danh mục thiết bị tối thiểu cấp THPT" },
          { value: true, label: "Ngoài danh mục", hint: "Thiết bị trường có nhưng không nằm trong danh mục tối thiểu" },
        ].map((tab) => (
          <button key={tab.label} type="button" role="tab" title={tab.hint} aria-selected={outside === tab.value}
            className={cn(TAB_ITEM, outside === tab.value ? "bg-primary text-primary-foreground" : TAB_IDLE)}
            onClick={() => setOutside(tab.value)}>
            {tab.label}
          </button>
        ))}
      </div>
      {outside ? <OutsideCatalog /> : <>
      {standard ? <section className="space-y-4 rounded-xl border p-4">
        <div className="flex flex-wrap items-center gap-3">
          <Select value={String(standard.id)} onValueChange={(value) => setSelectedId(Number(value))}>
            <SelectTrigger className="w-full max-w-lg" aria-label="Chọn bộ tiêu chuẩn"><SelectValue /></SelectTrigger>
            <SelectContent>{standards.map((item) => <SelectItem key={item.id} value={String(item.id)}>{item.standardVersion ?? item.code} · {STATUS[item.status]}</SelectItem>)}</SelectContent>
          </Select>
          <Badge variant={standard.status === "ACTIVE" ? "success" : "secondary"}>{STATUS[standard.status]}</Badge>
          <span className="text-sm text-muted-foreground">{groupCount} dòng · {groups.length} môn</span>
        </div>
        <p className="text-sm text-muted-foreground">Căn cứ: {standard.documents?.map((document) => document.documentNo).join(", ") || "Chưa khai văn bản"}</p>
        <div className="flex flex-wrap gap-2">
          {mayWrite && standard.status === "DRAFT" ? <Button size="sm" asChild><Link to="/catalogs/equipment-norms/create">Thêm dòng định mức</Link></Button> : null}
          <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => void exportXlsx()}>Xuất Excel</Button>
          <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => void printPdf()}>In / lưu PDF</Button>
          {mayWrite && standard.status === "DRAFT" ? <><input ref={fileInput} type="file" accept=".xlsx,.csv" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importFile(file); }} />
            <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => fileInput.current?.click()}>Nhập Excel</Button></> : null}
        </div>
      </section> : <p className="text-muted-foreground">Chưa có bộ tiêu chuẩn THPT.</p>}

      {standard ? <section className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Input className="w-56" aria-label="Tìm thiết bị" placeholder="Tìm thiết bị, mã, chủ đề…" value={search} onChange={(event) => setSearch(event.target.value)} />
          <Select value={subject} onValueChange={setSubject}><SelectTrigger className="w-48" aria-label="Lọc môn học"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value={ALL}>Mọi môn học</SelectItem>{groups.filter((group) => group.subjectId != null).map((group) => <SelectItem key={group.subjectId} value={String(group.subjectId)}>{group.subjectName} ({group.count})</SelectItem>)}</SelectContent></Select>
          <Select value={grade} onValueChange={setGrade}><SelectTrigger className="w-36" aria-label="Lọc khối lớp"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value={ALL}>Mọi khối</SelectItem>{[10, 11, 12].map((number) => <SelectItem key={number} value={String(number)}>Khối {number}</SelectItem>)}</SelectContent></Select>
          <Select value={target} onValueChange={setTarget}><SelectTrigger className="w-44" aria-label="Lọc đối tượng"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value={ALL}>Mọi đối tượng</SelectItem><SelectItem value="teacher">Giáo viên</SelectItem><SelectItem value="student">Học sinh</SelectItem></SelectContent></Select>
          <Select value={topic} onValueChange={setTopic}><SelectTrigger className="w-64" aria-label="Lọc chủ đề"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value={ALL}>Mọi chủ đề / nhóm</SelectItem>{topics.filter((entry) => subject === ALL || String(entry.subjectId) === subject).map((entry) =>
              <SelectItem key={`${entry.kind}:${entry.subjectId}:${entry.value}`} value={`${entry.kind}:${entry.value}`}>{entry.value} ({entry.count})</SelectItem>)}</SelectContent></Select>
        </div>
        <div className="overflow-x-auto rounded-lg border">
          <Table className="min-w-[1050px]"><TableHeader><TableRow>
            <TableHead className="w-14">STT</TableHead><TableHead className="w-36">Môn học</TableHead>
            <TableHead className="w-24">Mục</TableHead><TableHead className="w-52">Thiết bị</TableHead>
            <TableHead>Chủ đề / mục đích</TableHead><TableHead className="w-24">Khối</TableHead>
            <TableHead className="w-28">Đơn vị</TableHead><TableHead className="w-28">Số lượng</TableHead>
            <TableHead className="w-20">Xem</TableHead>
          </TableRow></TableHeader><TableBody>
            {rows.map((row, index) => <TableRow key={row.id}>
              <TableCell>{(page - 1) * PAGE_SIZE + index + 1}</TableCell>
              <TableCell>{row.subject?.name ?? "Dùng chung"}</TableCell>
              <TableCell>{row.itemNo ?? "—"}</TableCell>
              <TableCell className="font-medium">{row.name}{row.optional ? <Badge variant="secondary" className="ms-1">Tự chọn</Badge> : null}</TableCell>
              <TableCell><div className="space-y-1"><p className="font-medium">{row.sectionName ?? row.topic}</p><p className="text-muted-foreground line-clamp-2">{row.purpose}</p></div></TableCell>
              <TableCell>{row.gradeLevels ?? "10–12"}</TableCell>
              <TableCell>{row.unit?.name ?? row.unitText ?? "—"}</TableCell>
              <TableCell>{row.quantityText ?? row.minQuantity ?? "—"}</TableCell>
              <TableCell><Button size="sm" variant="outline" onClick={() => setViewing(row)}>Chi tiết</Button></TableCell>
            </TableRow>)}
            {!normsQuery.isLoading && rows.length === 0 ? <TableRow><TableCell colSpan={9} className="py-8 text-center text-muted-foreground">Không có dòng định mức phù hợp.</TableCell></TableRow> : null}
            {normsQuery.isLoading ? <TableRow><TableCell colSpan={9} className="py-8 text-center">Đang tải phụ lục…</TableCell></TableRow> : null}
          </TableBody></Table>
        </div>
        <div className="flex items-center justify-between text-sm"><span>{total} dòng phù hợp</span><div className="flex items-center gap-2">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Trước</Button>
          <span>Trang {page}/{pages}</span>
          <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage((current) => current + 1)}>Sau</Button>
        </div></div>
      </section> : null}
      </>}
    </ListView>

    <Dialog open={viewing !== null} onOpenChange={(value) => { if (!value) setViewing(null); }}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl"><DialogHeader><DialogTitle>{viewing?.name}</DialogTitle>
        <DialogDescription>{viewing?.code} · {viewing?.subject?.name ?? "Dùng chung"}</DialogDescription></DialogHeader>
        {viewing ? <div className="grid gap-4 sm:grid-cols-2">
          <ReadField label="Mục phụ lục">{viewing.itemNo}</ReadField><ReadField label="Khối lớp">{viewing.gradeLevels ?? "Mọi khối THPT"}</ReadField>
          <ReadField label="Nhóm phụ lục">{viewing.sectionName}</ReadField><ReadField label="Chủ đề">{viewing.topic}</ReadField>
          <ReadField label="Mục đích" className="sm:col-span-2">{viewing.purpose}</ReadField>
          <ReadField label="Mô tả" className="sm:col-span-2">{viewing.description}</ReadField>
          <ReadField label="Đối tượng">{[viewing.forTeacher && "Giáo viên", viewing.forStudent && "Học sinh"].filter(Boolean).join(", ")}</ReadField>
          <ReadField label="Đơn vị">{viewing.unit?.name ?? viewing.unitText}</ReadField>
          <ReadField label="Số lượng">{viewing.quantityText ?? viewing.minQuantity}</ReadField><ReadField label="Căn cứ tính">{BASIS[viewing.normBasis]}</ReadField>
          <ReadField label="Thiết bị danh mục">{viewing.catalog?.name}</ReadField><ReadField label="Văn bản">{viewing.sourceDocument?.documentNo}</ReadField>
          <ReadField label="Ghi chú" className="sm:col-span-2">{viewing.note}</ReadField>
          {mayWrite && standard?.status === "DRAFT" ? <div className="sm:col-span-2"><Button asChild><Link to={`/catalogs/equipment-norms/edit/${viewing.id}`}>Sửa dòng định mức</Link></Button></div> : null}
        </div> : null}
      </DialogContent>
    </Dialog>
    {action === "create" || action === "edit" ? <CatalogFormDialog key={`${action}-${id ?? ""}`} config={equipmentStandardConfig} action={action} id={id} /> : null}
    {action === "show" ? <CatalogShowDialog key={`show-${id}`} config={equipmentStandardConfig} id={id} /> : null}
  </>;
}
