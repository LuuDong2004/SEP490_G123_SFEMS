import { useCan, useGo, useList, useNotification } from "@refinedev/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CloudUpload, Download, FileSpreadsheet, Inbox, LockKeyhole, Trash2, Upload, X } from "lucide-react";
import { useEffect, useRef, useState, type DragEvent } from "react";

import { kyInstance } from "@/shared/api/data";
import { CrossLink } from "@/shared/components/cross-link";
import { ConfirmContent } from "@/shared/components/confirm/confirm-content";
import { AlertDialog } from "@/shared/ui/alert-dialog";
import { FillBox } from "@/shared/components/layout/fill-box";
import { ListView, ListViewHeader } from "@/shared/components/views/list-view";
import { errorMessage } from "@/shared/lib/api-error";
import { formatDate, formatDateTime } from "@/shared/lib/format";
import { useOpeningBalance } from "@/shared/hooks/use-opening-balance";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Label } from "@/shared/ui/label";
import { SchoolPickerField } from "@/shared/components/catalog/school-picker";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { CREATED_LABELS, IMPORT_BATCH_STATUS, type ImportBatch, type ImportKind } from "@/domains/data-import/types";
import { Tabs, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { Checkbox } from "@/shared/ui/checkbox";

import { BATCHES_KEY, download } from "./download";
import { LIFT_ROW } from "@/shared/lib/row-lift";
import { DataTablePagination } from "@/shared/components/data-table/data-table-pagination";
import { TableEmpty } from "@/shared/components/data-table/table-empty";
import { usePersistentState } from "@/shared/hooks/use-persistent-state";

function fileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} byte`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}

/** Trần của máy chủ (`OnboardingController.MAX_UPLOAD`). */
const MAX_UPLOAD = 10 * 1024 * 1024;

/**
 * Kiểm tệp ngay khi chọn, khỏi tải lên mới biết. Xlsx là tệp zip nên hai byte đầu phải là "PK": tệp .xls hay tệp khác
 * đổi đuôi thành .xlsx bị bắt ở đây. Máy chủ vẫn kiểm lại, kể cả nội dung các trang tính.
 */
async function fileProblem(f: File): Promise<string | null> {
  if (!f.name.toLowerCase().endsWith(".xlsx")) return "Chỉ nhận tệp Excel .xlsx.";
  if (f.size === 0) return "Tệp trống.";
  if (f.size > MAX_UPLOAD) return `Tệp ${fileSize(f.size)}, tối đa 10 MB. Chia nhỏ tệp rồi tải lại.`;
  const head = new Uint8Array(await f.slice(0, 2).arrayBuffer());
  if (head[0] !== 0x50 || head[1] !== 0x4b) return "Tệp không phải Excel .xlsx thật. Mở bằng Excel rồi lưu lại dạng .xlsx.";
  return null;
}

/** Tên ngắn của loại dữ liệu trên bảng lô. */
const KIND_SHORT: Record<ImportKind, string> = {
  school_data: "Dữ liệu của trường",
  schools: "Danh sách trường",
  wards: "Phường/xã",
};

const KIND_HINT: Record<ImportKind, string> = {
  school_data: "Cơ sở, khối nhà, phòng, cán bộ, lớp, thiết bị của một trường.",
  schools: "Trường công lập Tiểu học, THCS, THPT do Sở cấp. Ghép theo mã Sở.",
  wards: "Danh mục phường/xã. Ghép theo mã đơn vị hành chính.",
};

const UPLOAD_TITLE: Record<ImportKind, string> = {
  school_data: "Tải dữ liệu của trường",
  schools: "Tải danh sách trường",
  wards: "Tải danh mục phường/xã",
};

/** Loại dữ liệu tài khoản được nhập: dữ liệu của trường luôn có; danh mục dùng chung khi có quyền sửa danh mục đó. */
function useKinds(): ImportKind[] {
  const canSchools = useCan({ resource: "schools", action: "create" }).data?.can ?? false;
  const canWards = useCan({ resource: "wards", action: "create" }).data?.can ?? false;
  return ["school_data", ...(canSchools ? ["schools" as const] : []), ...(canWards ? ["wards" as const] : [])];
}

function templateOf(kind: ImportKind) {
  return kind === "school_data"
    ? download("data_imports/template", "Mẫu dữ liệu đầu vào.xlsx")
    : download(`data_imports/template?kind=${kind}`, `Mẫu ${KIND_SHORT[kind].toLowerCase()}.xlsx`);
}

const DEACTIVATE_LABEL: Partial<Record<ImportKind, string>> = {
  schools: "Ngừng trường không có trong tệp",
  wards: "Ngừng phường/xã không có trong tệp",
};

/**
 * Tải tệp vào vùng chờ, rồi mở lô vừa tạo. LOẠI dữ liệu là tab đang chọn trên màn danh sách. Mỗi lần mở là một lần gắn mới (key), nên không còn sót tệp của lần trước.
 */
function UploadDialog({ kind, open, setOpen }: { kind: ImportKind; open: boolean; setOpen: (v: boolean) => void }) {
  const go = useGo();
  const queryClient = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [deactivate, setDeactivate] = useState(false);
  const [picked, setPicked] = useState<{ id: number; name: string } | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const catalog = kind !== "school_data";

  const pick = async (f: File | undefined) => {
    if (!f) return;
    const issue = await fileProblem(f);
    setProblem(issue);
    setFile(issue ? null : f);
  };
  const drop = (e: DragEvent) => {
    e.preventDefault();
    setDrag(false);
    if (ready) void pick(e.dataTransfer.files?.[0]);
  };

  // Chỉ để biết tài khoản thấy mấy trường: tài khoản của một trường thì trường nhận là chính trường đó.
  const { result: visible } = useList<{ id: number }>({ resource: "schools", pagination: { pageSize: 2 } });
  const onlySchool = visible?.total === 1 ? String(visible.data[0].id) : "";
  const school = picked ? String(picked.id) : onlySchool;
  const ready = catalog || !!school;

  async function send() {
    if (!file || !ready) return;
    setBusy(true);
    setProblem(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const query = catalog ? `kind=${kind}&deactivateMissing=${deactivate}` : `schoolId=${school}`;
      const batch = await kyInstance.post(`data_imports?${query}`, { body: form, timeout: 180_000 }).json<ImportBatch>();
      await queryClient.invalidateQueries({ queryKey: BATCHES_KEY });
      setOpen(false);
      go({ to: `/data-imports/${batch.id}` });
    } catch (error) {
      // Lỗi của tệp (không nhận ra trang nào…) hiện ngay dưới ô tệp, không phải thông báo góc màn hình.
      setProblem(await errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>{UPLOAD_TITLE[kind]}</DialogTitle>
            <DialogDescription>
              {KIND_HINT[kind]} Dữ liệu chưa ghi vào hệ thống, xem và sửa lỗi xong mới ghi.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
            {catalog || onlySchool ? null : (
              <div className="grid grid-cols-[minmax(0,1fr)] gap-2">
                <Label>Trường</Label>
                {/* Hơn nghìn trường: chọn trong hộp có ô tìm, lọc cấp học và phân trang, không phải danh sách xổ xuống. */}
                <SchoolPickerField value={picked} onChange={setPicked} />
                {/* Tệp mẫu điền sẵn của trường vừa chọn: danh mục thiết bị tối thiểu, dữ liệu trường đã có. */}
                {picked && kind === "school_data" ? (
                  <Button type="button" variant="link" size="sm" className="h-auto justify-self-start px-0"
                    onClick={() => void download(`data_imports/template?schoolId=${picked.id}`, `Mẫu dữ liệu đầu vào - ${picked.name}.xlsx`)}>
                    <Download />
                    Tải tệp mẫu điền sẵn của trường này
                  </Button>
                ) : null}
              </div>
            )}
            <div className="grid grid-cols-[minmax(0,1fr)] gap-2">
              <Label>Tệp Excel</Label>
              <input ref={input} type="file" accept=".xlsx" className="hidden"
                onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ""; }} />
              {file ? (
                <div className="bg-surface-subtle flex items-center gap-3 rounded-lg border px-3 py-2.5">
                  <span className="bg-success-subtle text-success-text flex size-10 shrink-0 items-center justify-center rounded-md">
                    <FileSpreadsheet className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium" title={file.name}>{file.name}</p>
                    <p className="text-muted-foreground text-xs tabular-nums">{fileSize(file.size)}</p>
                  </div>
                  <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => input.current?.click()}>Đổi tệp</Button>
                  <Button type="button" variant="ghost" size="icon-sm" disabled={busy} aria-label="Bỏ tệp" onClick={() => setFile(null)}>
                    <X />
                  </Button>
                </div>
              ) : (
                <button type="button" disabled={!ready} onClick={() => input.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); if (ready) setDrag(true); }}
                  onDragLeave={() => setDrag(false)}
                  onDrop={drop}
                  className={cn("group flex flex-col items-center gap-2 rounded-lg border-2 border-dashed px-4 py-7 text-center transition-colors",
                    "disabled:cursor-not-allowed disabled:opacity-60",
                    drag ? "border-primary bg-primary/5" : "bg-surface-subtle enabled:hover:border-primary/50 enabled:hover:bg-primary/5")}>
                  <span className="bg-primary/10 text-primary flex size-11 items-center justify-center rounded-full transition-transform group-hover:-translate-y-0.5">
                    <CloudUpload className="size-5" />
                  </span>
                  {ready ? (
                    <span className="text-sm"><span className="text-primary font-medium">Chọn tệp</span> hoặc kéo thả vào đây</span>
                  ) : (
                    <span className="text-sm font-medium">Chọn trường trước</span>
                  )}
                  <span className="text-muted-foreground text-xs">Excel .xlsx, tối đa 10 MB</span>
                </button>
              )}
              {problem ? <p role="alert" className="text-destructive-text text-xs">{problem}</p> : null}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              {DEACTIVATE_LABEL[kind] ? (
                <Label className="flex items-center gap-2 text-sm font-normal">
                  <Checkbox checked={deactivate} disabled={busy} onCheckedChange={(v) => setDeactivate(v === true)} />
                  {DEACTIVATE_LABEL[kind]}
                </Label>
              ) : <span />}
              <button type="button" className="text-primary inline-flex items-center gap-1 text-xs font-medium hover:underline"
                onClick={() => void templateOf(kind)}>
                <Download className="size-3.5" />
                Tệp mẫu
              </button>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Đóng</Button>
            <Button type="button" disabled={!file || !ready || busy} onClick={() => void send()}>
              {busy ? "Đang tải lên…" : "Tải lên"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * Nhập dữ liệu đầu vào: danh sách các lô. Mỗi lô là một tệp của một trường đã đọc vào vùng chờ — sửa được
 * trên hệ thống trước khi ghi, ghi rồi vẫn hoàn tác được khi dữ liệu chưa được dùng.
 */
export const DataImports = () => {
  const go = useGo();
  const mayWrite = useCan({ resource: "data_imports", action: "create" }).data?.can ?? false;
  const mayDelete = useCan({ resource: "data_imports", action: "delete" }).data?.can ?? false;
  const { open: notify } = useNotification();
  const queryClient = useQueryClient();
  // Lô đang chờ ghi muốn xoá (hộp xác nhận); lô đã ghi thì hoàn tác trong lô, không xoá ở đây.
  const [removing, setRemoving] = useState<ImportBatch | null>(null);
  const [removeBusy, setRemoveBusy] = useState(false);
  const kinds = useKinds();
  // Tab loại dữ liệu: lọc bảng, và là loại của "Tải tệp mẫu" / "Tải tệp lên" — không chọn lại trong menu nút.
  const [tab, setTab] = useState<ImportKind>("school_data");
  const kind = kinds.includes(tab) ? tab : "school_data";
  const [upload, setUpload] = useState<{ seq: number; open: boolean }>({ seq: 0, open: false });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = usePersistentState<number>("dataImports.pageSize", 20, "local");
  useEffect(() => setPage(1), [kind, pageSize]);
  const { data, isLoading } = useQuery<{ rows: ImportBatch[]; total: number }>({
    queryKey: [...BATCHES_KEY, kind, page, pageSize],
    // Lật trang thì trang cũ đứng yên tới khi trang mới về; đổi loại dữ liệu thì không giữ dòng của loại kia.
    placeholderData: (previous, query) => (query?.queryKey[BATCHES_KEY.length] === kind ? previous : undefined),
    queryFn: async ({ signal }) => {
      const res = await kyInstance.get("data_imports", { signal,
        searchParams: { kind, _start: String((page - 1) * pageSize), _end: String(page * pageSize) } });
      return { rows: await res.json<ImportBatch[]>(), total: Number(res.headers.get("X-Total-Count") ?? 0) };
    },
  });
  const { data: counts } = useQuery({
    queryKey: [...BATCHES_KEY, "counts"],
    enabled: kinds.length > 1,
    queryFn: ({ signal }) => kyInstance.get("data_imports/counts", { signal }).json<Partial<Record<ImportKind, number>>>(),
  });
  const batches = data?.rows ?? [];
  // Trường đã khoá khai thiết bị ban đầu: trang Thiết bị của tệp không ghi nữa (máy chủ đánh dấu bỏ qua từng dòng).
  const lockedAt = useOpeningBalance().data?.closedAt ?? null;
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  // Xoá lô cuối của trang cuối: lùi về trang còn dòng.
  useEffect(() => {
    if (data && page > pageCount) setPage(pageCount);
  }, [data, page, pageCount]);
  const schoolCol = kind === "school_data";
  const cols = (schoolCol ? 6 : 5) + (mayDelete ? 1 : 0);
  const remove = async () => {
    if (!removing) return;
    setRemoveBusy(true);
    try {
      await kyInstance.delete(`data_imports/${removing.id}`);
      notify?.({ type: "success", message: `Đã xoá lô ${removing.fileName}` });
      await queryClient.invalidateQueries({ queryKey: BATCHES_KEY });
      setRemoving(null);
    } catch (error) {
      notify?.({ type: "error", message: await errorMessage(error) });
    } finally {
      setRemoveBusy(false);
    }
  };

  return (
    <ListView>
      <ListViewHeader canCreate={false} actions={
        <>
          <Button type="button" variant="outline" onClick={() => void templateOf(kind)}><Download />Tải tệp mẫu</Button>
          {mayWrite ? (
            <>
              <Button type="button" onClick={() => setUpload((u) => ({ seq: u.seq + 1, open: true }))}><Upload />Tải tệp lên</Button>
              <UploadDialog key={upload.seq} kind={kind} open={upload.open}
                setOpen={(v) => setUpload((u) => ({ ...u, open: v }))} />
            </>
          ) : null}
        </>
      } />
      <FillBox>
      {lockedAt && kind === "school_data" ? (
        <div className="bg-info-subtle text-info-text mb-3 flex items-center gap-2 rounded-lg px-4 py-2 text-sm">
          <LockKeyhole className="size-4 shrink-0" />
          <span>
            Trường đã khoá khai thiết bị ban đầu từ {formatDate(lockedAt)}. Hệ thống không nhận trang Thiết bị của tệp tải
            lên, chỉ ghi cơ sở, cán bộ, khối nhà, phòng, lớp. Thiết bị mới lập{" "}
            <CrossLink to="/equipment-intakes/create" resource="equipment_intakes" action="create" plain
              className="font-medium underline">
              phiếu ghi tăng
            </CrossLink>.
          </span>
        </div>
      ) : null}
      {kinds.length > 1 ? (
        <Tabs value={kind} onValueChange={(v) => setTab(v as ImportKind)} className="pb-3">
          <TabsList aria-label="Loại dữ liệu">
            {kinds.map((k) => {
              const n = counts?.[k] ?? 0;
              return (
                <TabsTrigger key={k} value={k} title={KIND_HINT[k]}>
                  {KIND_SHORT[k]}
                  {n ? <span className="tabular-nums opacity-70">{n.toLocaleString("vi-VN", { useGrouping: false })}</span> : null}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>
      ) : null}
      <AlertDialog open={!!removing} onOpenChange={(o) => !o && !removeBusy && setRemoving(null)}>
        {removing ? (
          <ConfirmContent tone="danger" title={`Xoá lô ${removing.fileName}?`}
            description="Chỉ xoá dữ liệu đang chờ của lô này, hệ thống không có gì thay đổi. Xoá rồi không lấy lại được."
            cancelLabel="Không xoá" confirmLabel="Xoá" busy={removeBusy} keepOpen onConfirm={() => void remove()} />
        ) : null}
      </AlertDialog>
      <Card className="min-h-0 flex-1 gap-0 py-0">
        <CardContent className="flex min-h-0 flex-1 flex-col overflow-auto [&>[data-slot=table-container]]:overflow-visible [&_tbody_tr:last-child]:border-b px-0">
          <Table>
            <TableHeader sticky>
              <TableRow>
                {schoolCol ? <TableHead>Trường</TableHead> : null}
                <TableHead>Tệp</TableHead>
                <TableHead>Người tải lên</TableHead>
                <TableHead>Thời gian</TableHead>
                <TableHead>Kết quả</TableHead>
                <TableHead>Trạng thái</TableHead>
                {mayDelete ? <TableHead className="w-12"><span className="sr-only">Xoá</span></TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableEmpty colSpan={cols} loading />
              ) : batches.map((b) => {
                const created = Object.entries(b.created);
                return (
                  <TableRow key={b.id} className={cn("group/row", LIFT_ROW, "cursor-pointer")} onClick={() => go({ to: `/data-imports/${b.id}` })}>
                    {schoolCol ? <TableCell className="font-medium">{b.school?.name ?? "—"}</TableCell> : null}
                    <TableCell className="max-w-56 truncate">{b.fileName}</TableCell>
                    <TableCell className="text-muted-foreground max-w-56 truncate text-sm" title={b.createdBy ?? undefined}>{b.createdBy ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground text-sm whitespace-nowrap">{formatDateTime(b.createdAt)}</TableCell>
                    <TableCell className="max-w-72 text-sm whitespace-normal">
                      {b.status === "COMMITTED"
                        ? <span className="text-success-text" title={created.map(([k, n]) => `${n.toLocaleString("vi-VN", { useGrouping: false })} ${CREATED_LABELS[k] ?? k}`).join(" · ")}>Thành công</span>
                        : b.errors > 0
                          ? <span className="text-destructive-text">{b.errors} lỗi</span>
                          : <span className="text-success-text">Sẵn sàng ghi</span>}
                    </TableCell>
                    <TableCell>
                      <Badge variant={b.status === "COMMITTED" ? "success" : "info"}>{IMPORT_BATCH_STATUS[b.status]}</Badge>
                    </TableCell>
                    {mayDelete ? (
                      <TableCell className="w-12 text-right">
                        {/* Chỉ lô đang chờ ghi xoá được; lô đã ghi thì vào lô bấm Hoàn tác. */}
                        {b.status === "DRAFT" ? (
                          <Button type="button" variant="ghost" size="icon-sm" title="Xoá lô" aria-label={`Xoá lô ${b.fileName}`}
                            className="text-muted-foreground hover:text-destructive-text"
                            onClick={(e) => { e.stopPropagation(); setRemoving(b); }}>
                            <Trash2 />
                          </Button>
                        ) : null}
                      </TableCell>
                    ) : null}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {/* Trống: đứng giữa phần còn lại của khung, cùng kiểu ô trống của bảng chung. */}
          {!isLoading && batches.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 py-10 text-center">
              <span className="bg-accent text-muted-foreground mb-1 flex size-14 items-center justify-center rounded-full">
                <Inbox className="size-6" />
              </span>
              <p className="text-foreground text-base font-semibold">Chưa tải lên tệp nào</p>
              <p className="text-muted-foreground max-w-sm text-sm">Tải tệp mẫu, điền dữ liệu rồi bấm "Tải tệp lên".</p>
            </div>
          ) : null}
        </CardContent>
        {total > 10 ? (
          <div className="shrink-0 border-t px-3 py-1.5">
            <DataTablePagination currentPage={page} pageCount={pageCount} setCurrentPage={setPage} pageSize={pageSize}
              setPageSize={setPageSize} total={total} />
          </div>
        ) : null}
      </Card>
      </FillBox>
    </ListView>
  );
};
