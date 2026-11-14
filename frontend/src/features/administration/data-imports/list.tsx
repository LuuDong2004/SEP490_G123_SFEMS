import { useCan, useGo, useList } from "@refinedev/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CloudUpload, Download, FileSpreadsheet, Inbox, Upload, X } from "lucide-react";
import { useRef, useState, type DragEvent } from "react";

import { kyInstance } from "@/shared/api/data";
import { FillBox } from "@/shared/components/layout/fill-box";
import { ListView, ListViewHeader } from "@/shared/components/views/list-view";
import { errorMessage } from "@/shared/lib/api-error";
import { formatDateTime } from "@/shared/lib/format";
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
import { TableEmpty } from "@/shared/components/data-table/table-empty";

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
  const kinds = useKinds();
  // Tab loại dữ liệu: lọc bảng, và là loại của "Tải tệp mẫu" / "Tải tệp lên" — không chọn lại trong menu nút.
  const [tab, setTab] = useState<ImportKind>("school_data");
  const kind = kinds.includes(tab) ? tab : "school_data";
  const [upload, setUpload] = useState<{ seq: number; open: boolean }>({ seq: 0, open: false });
  const { data, isLoading } = useQuery({
    queryKey: BATCHES_KEY,
    queryFn: ({ signal }) => kyInstance.get("data_imports", { signal }).json<ImportBatch[]>(),
  });
  const all = Array.isArray(data) ? data : [];
  const kindOf = (b: ImportBatch): ImportKind => b.kind ?? "school_data";
  const batches = all.filter((b) => kindOf(b) === kind);
  const schoolCol = kind === "school_data";
  const cols = schoolCol ? 6 : 5;

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
      {kinds.length > 1 ? (
        <Tabs value={kind} onValueChange={(v) => setTab(v as ImportKind)} className="pb-3">
          <TabsList aria-label="Loại dữ liệu">
            {kinds.map((k) => {
              const n = all.filter((b) => kindOf(b) === k).length;
              return (
                <TabsTrigger key={k} value={k} title={KIND_HINT[k]}>
                  {KIND_SHORT[k]}
                  {n ? <span className="tabular-nums opacity-70">{n.toLocaleString("vi-VN")}</span> : null}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>
      ) : null}
      <Card className="min-h-0 flex-1 py-0">
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
                        ? <span className="text-success-text" title={created.map(([k, n]) => `${n.toLocaleString("vi-VN")} ${CREATED_LABELS[k] ?? k}`).join(" · ")}>Thành công</span>
                        : b.errors > 0
                          ? <span className="text-destructive-text">{b.errors} lỗi</span>
                          : <span className="text-success-text">Sẵn sàng ghi</span>}
                    </TableCell>
                    <TableCell>
                      <Badge variant={b.status === "COMMITTED" ? "success" : "info"}>{IMPORT_BATCH_STATUS[b.status]}</Badge>
                    </TableCell>
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
      </Card>
      </FillBox>
    </ListView>
  );
};
