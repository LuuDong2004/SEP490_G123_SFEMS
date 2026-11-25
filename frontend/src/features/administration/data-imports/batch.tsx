import { useCan, useGo, useNotification } from "@refinedev/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, DoorOpen, Download, FileSpreadsheet, GraduationCap, History, MoreHorizontal, Package, RefreshCw, School, Trash2, Undo2, Upload, Users, MapPin } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router";
import { toast } from "sonner";

import { kyInstance } from "@/shared/api/data";
import { useLiquid } from "@/shared/hooks/use-liquid";
import { ConfirmContent } from "@/shared/components/confirm/confirm-content";
import { ShowView, ShowViewHeader } from "@/shared/components/views/show-view";
import { errorMessage } from "@/shared/lib/api-error";
import { formatDateTime } from "@/shared/lib/format";
import { TAB_ACTIVE, TAB_IDLE, TAB_ITEM, TAB_STRIP } from "@/shared/lib/tab-style";
import { cn } from "@/shared/lib/utils";
import { AlertDialog } from "@/shared/ui/alert-dialog";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/shared/ui/dropdown-menu";
import {
  CREATED_LABELS,
  IMPORT_BATCH_STATUS,
  type ImportBatch,
  type ImportRow,
  type ImportSheetInfo,
  type ImportSheetKey,
  UNDO_HOURS,
} from "@/domains/data-import/types";

import { QuickFixButton } from "./quick-fix";
import { CatalogPreviewBar } from "./catalog-preview";
import { EditHistory } from "./edit-history";
import { BATCHES_KEY, download } from "./download";
import { ImportGrid, type RowEdit } from "./import-grid";
import { matches, nextSort, searchWords, sortRows, type SortState } from "./view";

type Filter = "all" | "ERROR" | "WARNING" | "OK" | "EXISTS" | "SKIPPED";

const SHEET_ICON: Record<string, React.ReactNode> = {
  campus: <School />,
  staff: <Users />,
  building: <Building2 />,
  room: <DoorOpen />,
  class: <GraduationCap />,
  equipment: <Package />,
  schools: <School />,
  wards: <MapPin />,
};

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "Tất cả" },
  { key: "ERROR", label: "Lỗi" },
  { key: "WARNING", label: "Có lưu ý" },
  { key: "OK", label: "Hợp lệ" },
  { key: "EXISTS", label: "Đã có" },
  { key: "SKIPPED", label: "Bỏ qua" },
];

/** Màu nút lọc theo trạng thái — cùng màu với cột "Kết quả" của lưới. Đang chọn thì tô đặc, chưa chọn thì tô nhạt. */
/** Màu số đếm của từng bộ lọc — cùng màu với ô "Kết quả" trên lưới. */
const FILTER_COUNT: Partial<Record<Filter, string>> = {
  ERROR: "bg-destructive-subtle text-destructive-text",
  WARNING: "bg-warning-subtle text-warning-text",
  OK: "bg-success-subtle text-success-text",
  EXISTS: "bg-info-subtle text-info-text",
};

/** Nền nút lọc ĐANG CHỌN theo màu trạng thái — chọn "Lỗi" thì nút đỏ, không phải xanh chung cho mọi nút. */
const FILTER_ON: Partial<Record<Filter, string>> = {
  ERROR: "bg-destructive text-destructive-foreground",
  WARNING: "bg-warning text-warning-foreground",
  OK: "bg-success text-success-foreground",
  EXISTS: "bg-info text-info-foreground",
  SKIPPED: "bg-neutral-subtle text-neutral-text ring-1 ring-border",
};

/** Một lô nhập: các trang của tệp, sửa trên vùng chờ, ghi vào hệ thống, hoàn tác. */
export const DataImportBatch = () => {
  const { id } = useParams();
  const go = useGo();
  const { open: notify } = useNotification();
  const queryClient = useQueryClient();
  const mayWrite = useCan({ resource: "data_imports", action: "edit" }).data?.can ?? false;
  const mayDelete = useCan({ resource: "data_imports", action: "delete" }).data?.can ?? false;
  const [sheetKey, setSheetKey] = useState<ImportSheetKey | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  /** Các lần sửa đi lần lượt — lần dán sau không chạy đè lần trước. */
  const queue = useRef<Promise<void>>(Promise.resolve());
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<"commit" | "rollback" | "delete" | null>(null);
  /** Tiến độ lượt ghi đang chạy (máy chủ báo, `GET data_imports/{id}/progress`) — null khi chưa bắt đầu ghi. */
  const [writing, setWriting] = useState<{ step: string; done: number; total: number } | null>(null);
  // "So sánh với tệp gốc" của TRANG đang mở: thay bảng bằng diff của đúng trang đó (bấm lại để về bảng).
  const [compare, setCompare] = useState(false);
  /** Dòng cần đến sau khi bấm toast lỗi — lưới của đúng trang cuộn tới và chọn ô lỗi. */
  const [jump, setJump] = useState<{ sheet: ImportSheetKey; rowNo: number; n: number } | null>(null);

  const batchKey = ["data_imports", "batch", id];
  const { data: batch } = useQuery({
    queryKey: batchKey,
    queryFn: ({ signal }) => kyInstance.get(`data_imports/${id}`, { signal }).json<ImportBatch>(),
  });
  // Giá trị chọn được cho các ô — tính lại khi dữ liệu lô đổi, vì mã phòng / cán bộ vừa thêm cũng chọn được.
  const { data: choices } = useQuery({
    queryKey: ["data_imports", id, "choices", JSON.stringify(batch?.sheets)],
    queryFn: ({ signal }) => kyInstance.get(`data_imports/${id}/choices`, { signal }).json<Record<string, Record<string, string[]>>>(),
    enabled: !!batch,
    placeholderData: (prev) => prev,
  });
  const { data: sheets } = useQuery({
    queryKey: ["data_imports", "sheets"],
    queryFn: ({ signal }) => kyInstance.get("data_imports/sheets", { signal }).json<ImportSheetInfo[]>(),
    staleTime: Infinity,
  });
  // Lô chưa ghi: hiện MỌI trang của mẫu, kể cả trang chưa có dòng — tải tệp mẫu trống lên (hoặc tệp thiếu trang) vẫn
  // điền tiếp được trên lưới. Lô đã ghi chỉ còn các trang có dòng.
  const hasRows = (batch?.sheets ?? []).some((s) => s.total > 0);
  const present = batch?.status === "DRAFT" ? (batch?.sheets ?? []) : (batch?.sheets ?? []).filter((s) => s.total > 0);
  const active = sheetKey ?? present.find((s) => s.error > 0)?.sheet ?? present[0]?.sheet ?? null;
  // Ghim trang mở mặc định (trang đầu còn lỗi): sửa hết lỗi trang này thì không tự nhảy sang trang lỗi kế tiếp.
  useEffect(() => {
    if (sheetKey == null && active != null) setSheetKey(active);
  }, [sheetKey, active]);
  const sheet = (Array.isArray(sheets) ? sheets : []).find((s) => s.key === active);
  // Viên của trang đang mở trượt sang trang mới (cùng chuyển động với thanh tab của app).
  const [sheetBox, sheetInd] = useLiquid<HTMLDivElement>(active, { selector: '[role="tab"][aria-selected="true"]' });
  const rowsKey = ["data_imports", "rows", id, active];
  const { data: rowsData, isFetching } = useQuery({
    queryKey: rowsKey,
    // Ghi kèm trang: lúc đổi trang, bộ đệm còn trả dữ liệu của trang CŨ cho tới khi trang mới về — chụp tập
    // dòng (bên dưới) vào lúc đó là chụp nhầm và lưới trống.
    queryFn: async () => ({ sheet: active, rows: await kyInstance.get(`data_imports/${id}/rows?sheet=${active}`).json<ImportRow[]>() }),
    enabled: !!active,
  });
  const rows = useMemo(
    () => (rowsData?.sheet === active && Array.isArray(rowsData.rows) ? rowsData.rows : []),
    [rowsData, active],
  );
  // Lọc, tìm, sắp xếp như Excel: làm xong thì tập dòng và thứ tự ĐỨNG YÊN — sửa hết lỗi một dòng không làm nó
  // biến mất hay nhảy chỗ (ô đang sửa dở sẽ rơi vào dòng khác). Bấm lại nút lọc / tiêu đề cột mới làm lại.
  // Dòng thêm mới luôn hiện ở cuối.
  const [applied, setApplied] = useState(0);
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setTerm(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);
  const [sort, setSort] = useState<SortState>(null);
  // Vùng dòng đang hiện của lưới — "1–21 / 171 dòng" ở chân trang, cùng hàng với tab trang tính.
  const [visibleRows, setVisibleRows] = useState({ first: 0, count: 0 });
  const onVisibleChange = useCallback((first: number, count: number) =>
    setVisibleRows((v) => (v.first === first && v.count === count ? v : { first, count })), []);
  const viewKey = `${active}|${filter}|${applied}|${term}|${sort?.key ?? ""}|${sort?.dir ?? ""}`;
  const [view, setView] = useState<{ key: string; ids: number[]; maxId: number } | null>(null);
  if (rows.length && view?.key !== viewKey) {
    const words = searchWords(term);
    setView({
      key: viewKey,
      ids: sortRows(rows.filter((r) => (filter === "all" || r.status === filter) && matches(r, words)), sort).map((r) => r.id),
      maxId: Math.max(...rows.map((r) => r.id)),
    });
  }
  const shown = useMemo(() => {
    if (!view || view.key !== viewKey) return [];
    const byId = new Map(rows.map((r) => [r.id, r]));
    const kept = view.ids.map((rowId) => byId.get(rowId)).filter((r): r is ImportRow => !!r);
    return [...kept, ...rows.filter((r) => r.id > view.maxId)];
  }, [rows, view, viewKey]);
  const pickFilter = (f: Filter) => { setFilter(f); setApplied((n) => n + 1); };
  const draft = batch?.status === "DRAFT";
  const editable = draft && mayWrite;

  /** Tải lại dòng, lịch sử sửa và danh sách lô — sau mọi thao tác, trừ sửa ô (xem `editRows`). */
  const reloadRows = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["data_imports", "rows", id] });
    await queryClient.invalidateQueries({ queryKey: ["data_imports", "edits", id] });
    await queryClient.invalidateQueries({ queryKey: BATCHES_KEY });
  }, [queryClient, id]);
  const reloadTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(reloadTimer.current), []);

  /** Ghi cả lô; trong lúc chờ, hỏi tiến độ mỗi giây để hiện thanh tiến độ. */
  function commitWithProgress() {
    const timer = setInterval(() => {
      void kyInstance.get(`data_imports/${id}/progress`)
        .then(async (res) => { if (res.status === 200) setWriting(await res.json()); })
        .catch(() => undefined);
    }, 1000);
    return kyInstance.post(`data_imports/${id}/commit`, { timeout: 900_000 }).json<ImportBatch>()
      .finally(() => { clearInterval(timer); setWriting(null); });
  }

  async function act(request: () => Promise<ImportBatch>, success?: string | ((b: ImportBatch) => string), reload: "now" | "later" = "now") {
    setBusy(true);
    try {
      const updated = await request();
      queryClient.setQueryData(batchKey, updated);
      if (reload === "now") {
        clearTimeout(reloadTimer.current);
        await reloadRows();
      } else {
        // Sửa ô: số liệu của lô (đếm lỗi) đã về cùng PATCH, giá trị ô đã ghi sẵn vào bộ đệm (`editRows`).
        // Tải lại cả trang tính (trạng thái, lời nhắn của từng dòng) MỘT lần khi người dùng ngừng sửa, chứ
        // không sau mỗi ô — tệp vài nghìn dòng là vài MB mỗi lần.
        clearTimeout(reloadTimer.current);
        reloadTimer.current = setTimeout(() => {
          queue.current = queue.current.then(reloadRows);
        }, 1200);
      }
      if (success) notify?.({ type: "success", message: typeof success === "function" ? success(updated) : success });
    } catch (error) {
      notifyError(await errorMessage(error));
      // Lần sửa không lên được: bỏ giá trị đã ghi sẵn vào bộ đệm, đọc lại bản thật. Cập nhật bị từ chối vì còn
      // lỗi: máy chủ vừa kiểm lại và lưu kết quả — đọc lại số liệu của lô và các dòng để lỗi hiện lên bảng.
      void queryClient.invalidateQueries({ queryKey: batchKey });
      void reloadRows();
    } finally {
      setBusy(false);
    }
  }

  /** Mở trang tính, bỏ lọc / tìm / sắp xếp (dòng cần đến có thể đang bị ẩn), rồi đến dòng hoặc lọc dòng lỗi. */
  const goTo = (sheetTo: ImportSheetKey, rowNo: number | null, to: Filter = "all") => {
    setCompare(false);
    setSheetKey(sheetTo);
    setFilter(to);
    setApplied((n) => n + 1);
    setSort(null);
    setSearch("");
    setTerm("");
    if (rowNo != null) setJump({ sheet: sheetTo, rowNo, n: Date.now() });
  };

  /**
   * Lỗi của máy chủ nói chỗ ("Trang Thiết bị, dòng 8: …", "Còn 3 dòng lỗi …") thì toast bấm được: đến đúng dòng /
   * lọc dòng lỗi. Lỗi khác hiện như mọi toast.
   */
  const notifyError = (message: string) => {
    const at = /Trang\s+(.+?),\s*dòng\s+(\d+)/i.exec(message);
    const atSheet = at ? present.find((s) => s.title.trim().toLowerCase() === at[1].trim().toLowerCase()) : undefined;
    const withErrors = /Còn\s+\d+\s+(dòng\s+)?lỗi/i.test(message) ? present.find((s) => s.error > 0) : undefined;
    const target = atSheet ? () => goTo(atSheet.sheet, Number(at![2]))
      : withErrors ? () => goTo(withErrors.sheet, null, "ERROR")
      : null;
    if (!target) {
      notify?.({ type: "error", message });
      return;
    }
    const label = atSheet ? `Đến dòng ${at![2]}` : "Xem dòng lỗi";
    const toastId = toast.error(
      <button type="button" className="cursor-pointer text-left hover:underline"
        onClick={() => { target(); toast.dismiss(toastId); }}>
        {message}
      </button>,
      {
        duration: 15_000,
        action: { label, onClick: target },
        classNames: { icon: "!text-destructive" },
      },
    );
  };

  const editRows = (edits: RowEdit[]) => {
    // Ghi ngay vào bộ đệm dòng: lưới hiện giá trị mới tức thì, không chờ tải lại cả trang tính. Huỷ lần tải
    // đang chạy trước — nó mang dữ liệu từ trước lần sửa này và sẽ ghi đè ô vừa gõ.
    void queryClient.cancelQueries({ queryKey: rowsKey });
    const byId = new Map(edits.map((e) => [e.rowId, e]));
    queryClient.setQueryData<{ sheet: string | null; rows: ImportRow[] }>(rowsKey, (current) =>
      current && Array.isArray(current.rows)
        ? {
            ...current,
            rows: current.rows.map((r) => {
              const e = byId.get(r.id);
              return e ? { ...r, data: e.data ? { ...r.data, ...e.data } : r.data, skipped: e.skipped ?? r.skipped } : r;
            }),
          }
        : current);
    queue.current = queue.current.then(() =>
      act(() => kyInstance.patch(`data_imports/${id}/rows`, { json: { edits }, timeout: 120_000 }).json<ImportBatch>(), undefined, "later"));
  };

  /** Thêm các phòng còn thiếu vào trang Phòng (gợi ý sửa) — lần lượt, máy chủ kiểm lại cả lô sau mỗi dòng. */
  const addRooms = (list: Record<string, string>[]) => {
    queue.current = queue.current.then(() => act(async () => {
      let last: ImportBatch | undefined;
      for (const data of list) {
        last = await kyInstance.post(`data_imports/${id}/rows`, { json: { sheet: "room", data, source: "rule" }, timeout: 60_000 }).json<ImportBatch>();
      }
      return last!;
    }, `Đã thêm ${list.length} phòng vào trang Phòng`));
  };

  if (!batch) {
    return <ShowView><ShowViewHeader resource="data_imports" title="Nhập dữ liệu đầu vào" actions={<></>} /></ShowView>;
  }

  const warnings = batch.sheets.reduce((n, s) => n + s.warning, 0);
  // Hộp xác nhận nói lô sẽ THÊM gì, theo từng trang — "140 dòng" không cho biết sắp có gì trên hệ thống.
  const adding = batch.sheets.map((s) => ({ s, n: s.ok + s.warning })).filter((x) => x.n > 0)
    .map(({ s, n }) => `${n.toLocaleString("vi-VN", { useGrouping: false })} ${s.sheet === "equipment" ? "dòng thiết bị" : s.title.toLowerCase()}`);
  const existing = batch.sheets.reduce((n, s) => n + s.exists, 0);
  // Hoàn tác chỉ trong UNDO_HOURS giờ sau khi ghi — máy chủ kiểm lại (OnboardingService.UNDO_HOURS).
  const undoUntil = batch.committedAt ? new Date(batch.committedAt).getTime() + UNDO_HOURS * 3_600_000 : 0;
  const canUndo = !draft && Date.now() < undoUntil;
  const isEquipment = active === "equipment";
  const catalog = batch.kind !== "school_data";
  const subject = batch.school?.name ?? batch.kindTitle;
  const pv = batch.preview;

  return (
    <ShowView>
      {/* Tiêu đề là TRƯỜNG của lô (tên tệp thường viết không dấu, nối gạch — to lên khó đọc); tên tệp đứng nhỏ cạnh trạng thái. */}
      {/* Thiếu chỗ thì tên trường cắt trước (rê xem đủ), nhãn trạng thái giữ nguyên. */}
      <ShowViewHeader resource="data_imports" headerClassName="[&_h1]:shrink-[100]"
        title={subject}
        meta={<span className="me-3 flex min-w-0 items-center gap-x-3 overflow-hidden whitespace-nowrap">
          {/* Màn hẹp (laptop) chỉ còn biểu tượng tệp — rê chuột xem tên; chừa chỗ cho tên trường và trạng thái. */}
          <span className="text-muted-foreground flex max-w-80 min-w-4 shrink items-center gap-1 text-sm" title={batch.fileName}>
            <FileSpreadsheet className="size-4 shrink-0" />
            <span className="hidden min-w-0 truncate min-[1800px]:inline">{batch.fileName}</span>
          </span>
          <Badge variant={draft ? "info" : "success"} className="shrink-0">{IMPORT_BATCH_STATUS[batch.status]}</Badge>
          {draft && !hasRows ? <Badge variant="info" className="shrink-0">Chưa có dòng — thêm dòng trên lưới</Badge> : draft ? (
            batch.errors > 0
              ? <Badge variant="destructive" className="shrink-0">Còn {batch.errors.toLocaleString("vi-VN", { useGrouping: false })} dòng lỗi</Badge>
              : <Badge variant={warnings ? "warning" : "success"}
                  title={`Bấm "Cập nhật" để ghi. Cập nhật rồi vẫn hoàn tác được trong ${UNDO_HOURS} giờ nếu dữ liệu chưa được dùng.`}>
                  Hết lỗi{warnings ? ` · ${warnings.toLocaleString("vi-VN", { useGrouping: false })} dòng cần xem lại` : ""}
                </Badge>
          ) : (
            <span className="text-muted-foreground max-w-96 truncate text-sm"
              title={`${Object.entries(batch.created).map(([k, n]) => `${n.toLocaleString("vi-VN", { useGrouping: false })} ${CREATED_LABELS[k] ?? k}`).join(" · ")}. ${canUndo ? `Cần sửa thì bấm "Hoàn tác" trước ${formatDateTime(new Date(undoUntil).toISOString())}, khi dữ liệu chưa được dùng.` : `Đã quá ${UNDO_HOURS} giờ, không hoàn tác được nữa.`}`}>
              Đã ghi {formatDateTime(batch.committedAt ?? "")}{batch.committedBy ? ` · ${batch.committedBy}` : ""}
            </span>
          )}
        </span>}
        more={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" size="icon" aria-label="Thao tác khác" disabled={busy}>
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onSelect={() => void download(`data_imports/${id}/export`, `Dữ liệu đã chuẩn hoá lô ${id}.xlsx`)}>
                <Download />
                Tải dữ liệu đã chuẩn hoá
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void download(`data_imports/${id}/report`, `Kết quả kiểm tra lô ${id}.xlsx`)}>
                <Download />
                Tải kết quả kiểm tra
              </DropdownMenuItem>
              {editable && mayDelete ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onSelect={() => setConfirm("delete")}>
                    <Trash2 />
                    Xoá lô
                  </DropdownMenuItem>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        }
        actions={<>
          {editable ? (
            <Button type="button" variant="outline" disabled={busy}
              onClick={() => void act(() => kyInstance.post(`data_imports/${id}/recheck`, { timeout: 60_000 }).json<ImportBatch>(), "Đã kiểm tra lại")}>
              <RefreshCw />
              Kiểm tra lại
            </Button>
          ) : null}
          {mayWrite && draft && hasRows ? (
            <Button type="button" disabled={busy || batch.errors > 0} onClick={() => setConfirm("commit")}>
              <Upload />
              Cập nhật
            </Button>
          ) : null}
          {mayWrite && canUndo ? (
            <Button type="button" variant="outline" disabled={busy} onClick={() => setConfirm("rollback")}
              title={`Hoàn tác được tới ${formatDateTime(new Date(undoUntil).toISOString())}`}>
              <Undo2 />
              Hoàn tác
            </Button>
          ) : null}
        </>} />

      {catalog && pv ? (
        <CatalogPreviewBar batchId={id!} kind={batch.kind} preview={pv} editable={editable} busy={busy}
          onToggle={(on) => act(() => kyInstance.post(`data_imports/${id}/options?deactivateMissing=${on}`, { timeout: 120_000 }).json<ImportBatch>())} />
      ) : null}
      <div>
      <Card className="gap-0 overflow-hidden py-0">
        {compare && sheet ? (
          <EditHistory batchId={id!} sheet={sheet} rows={rows} onClose={() => setCompare(false)} />
        ) : sheet ? (
          <ImportGrid key={active} viewKey={viewKey} sheet={sheet} rows={shown} editable={editable} isEquipment={isEquipment}
            focus={jump && jump.sheet === active ? jump : null}
            choices={choices?.[active]}
            onEdit={editRows}
            onAddRow={() => act(() => kyInstance.post(`data_imports/${id}/rows`, { json: { sheet: active, data: {} }, timeout: 60_000 }).json<ImportBatch>())}
            onDeleteRows={(rowIds) => { queue.current = queue.current.then(() => act(() =>
              kyInstance.post(`data_imports/${id}/rows/delete`, { json: { rowIds }, timeout: 60_000 }).json<ImportBatch>(),
              `Đã xoá ${rowIds.length} dòng`)); }}
            sort={sort} onSort={(k) => setSort((cur) => nextSort(cur, k))}
            search={search} onSearch={setSearch}
            onVisibleChange={onVisibleChange}
            // Bộ lọc trạng thái là MỘT nhóm nút liền ngay cạnh ô tìm (chọn một), số đếm tô màu theo trạng thái; bên
            // phải chỉ còn việc làm. Năm nút viền màu rời nhau cạnh bốn nút việc làm thì không biết nút nào là lọc.
            filters={
              <div role="radiogroup" aria-label="Lọc theo kết quả" className="bg-muted/60 inline-flex shrink-0 flex-wrap gap-0.5 rounded-full border p-0.5">
                {FILTERS.map((f) => {
                  const count = f.key === "all" ? rows.length : rows.filter((r) => r.status === f.key).length;
                  if (f.key !== "all" && count === 0) return null;
                  const on = filter === f.key;
                  return (
                    <button key={f.key} type="button" role="radio" aria-checked={on} onClick={() => pickFilter(f.key)}
                      className={cn("flex h-8 items-center gap-1.5 rounded-full px-3 text-sm transition-[color,background-color,scale] duration-200 active:scale-[0.96]",
                        on ? cn("font-semibold shadow-e1", FILTER_ON[f.key] ?? "bg-brand-gradient") : "text-foreground/75 font-medium hover:bg-card hover:text-foreground")}>
                      {f.label}
                      <span className={cn("rounded-full px-1.5 text-xs tabular-nums",
                        on ? "bg-white/20" : FILTER_COUNT[f.key] ?? "text-muted-foreground")}>
                        {count.toLocaleString("vi-VN", { useGrouping: false })}
                      </span>
                    </button>
                  );
                })}
              </div>
            }
            toolbar={<>
              {isFetching || busy ? <span className="text-muted-foreground text-xs">Đang kiểm tra…</span> : null}
              {editable && !catalog && sheet.key !== "staff" ? <QuickFixButton batchId={id!} sheet={sheet} rows={rows} onApply={editRows} onAddRooms={addRooms} /> : null}
              <Button type="button" size="sm" variant="outline" className="px-2" onClick={() => setCompare(true)}
                title="So sánh với tệp gốc — xem trang này đã đổi gì" aria-label="So sánh với tệp gốc">
                <History />
              </Button>
            </>} />
        ) : null}
      </Card>
        {/* Các trang của tệp: dải viên dưới bảng, cùng dáng thanh tab của app — viên đang chọn trượt sang trang mới. */}
        <div className="flex items-center gap-3 pt-2">
        <div role="tablist" ref={sheetBox} className={cn(TAB_STRIP, "flex min-w-0 overflow-x-auto [scrollbar-width:none]")}>
          <span ref={sheetInd} aria-hidden className="pill-on pointer-events-none absolute rounded-full opacity-0" />
          {present.map((s) => {
            const on = s.sheet === active;
            return (
              <button key={s.sheet} type="button" role="tab" aria-selected={on}
                title={`${s.total.toLocaleString("vi-VN", { useGrouping: false })} dòng${s.error ? ` · ${s.error} lỗi` : ""}${s.warning ? ` · ${s.warning} lưu ý` : ""}${s.exists ? ` · ${s.exists} đã có` : ""}`}
                onClick={() => { setSheetKey(s.sheet); setFilter("all"); setSort(null); setSearch(""); setTerm(""); }}
                className={cn(TAB_ITEM, "[&>svg]:hidden min-[1440px]:[&>svg]:block", on ? TAB_ACTIVE : TAB_IDLE)}>
                {SHEET_ICON[s.sheet]}
                {s.title}
                <span className="tabular-nums opacity-70">{s.total.toLocaleString("vi-VN", { useGrouping: false })}</span>
                {s.error ? <span className={cn("text-destructive-text rounded-full px-1.5 font-semibold tabular-nums", on && "bg-white/90")}>{s.error}</span> : null}
                {s.warning ? <span className={cn("text-warning-text rounded-full px-1.5 font-semibold tabular-nums", on && "bg-white/90")}>{s.warning}</span> : null}
              </button>
            );
          })}
        </div>
        {shown.length && !compare ? (
          <span className="text-muted-foreground ms-auto pe-1 text-xs whitespace-nowrap tabular-nums">
            {Math.min(shown.length, visibleRows.first + 1).toLocaleString("vi-VN", { useGrouping: false })}–{Math.min(shown.length, visibleRows.first + visibleRows.count).toLocaleString("vi-VN", { useGrouping: false })}
            {" "}/ {shown.length.toLocaleString("vi-VN", { useGrouping: false })} dòng
          </span>
        ) : null}
        </div>
      </div>

      <AlertDialog open={confirm !== null} onOpenChange={(o) => { if (!o) setConfirm(null); }}>
        {confirm === "commit" ? (
          <ConfirmContent tone="neutral" title={catalog ? `Cập nhật ${batch.kindTitle.toLowerCase()} vào hệ thống?` : `Cập nhật dữ liệu của ${subject} vào hệ thống?`}
            description={<div className="grid gap-1.5">
              {catalog && pv ? (
                <ul className="list-disc ps-5">
                  <li>Thêm mới {pv.created.toLocaleString("vi-VN", { useGrouping: false })}</li>
                  <li>Cập nhật {pv.updated.toLocaleString("vi-VN", { useGrouping: false })}</li>
                  {pv.deactivateMissing ? <li>Ngừng {pv.deactivated.toLocaleString("vi-VN", { useGrouping: false })} (không có trong tệp)</li> : null}
                  <li>Không đổi {pv.unchanged.toLocaleString("vi-VN", { useGrouping: false })}</li>
                </ul>
              ) : adding.length ? (
                <div>
                  Thêm mới:
                  <ul className="mt-0.5 list-disc ps-5">
                    {adding.map((a) => <li key={a}>{a}</li>)}
                  </ul>
                </div>
              ) : <div>Không có dòng mới.</div>}
              {existing ? <div>{existing.toLocaleString("vi-VN", { useGrouping: false })} dòng đã có trên hệ thống giữ nguyên.</div> : null}
              <div>Quá trình có thể mất vài phút, vui lòng không đóng trang.</div>
              <div>Nếu sai, bấm Hoàn tác trong {UNDO_HOURS} giờ để gỡ lại, khi dữ liệu chưa được dùng.</div>
              {busy ? <WriteProgress writing={writing} /> : null}
            </div>}
            cancelLabel="Chưa, để sau" confirmLabel="Cập nhật" busy={busy} keepOpen
            onConfirm={() => void act(commitWithProgress,
              // Nói luôn đã tạo gì — trước đây chỉ thấy khi rê chuột vào dòng "Đã ghi …" ở đầu trang.
              (b) => {
                const made = Object.entries(b.created ?? {}).filter(([, n]) => n > 0)
                  .map(([k, n]) => `${n.toLocaleString("vi-VN", { useGrouping: false })} ${CREATED_LABELS[k] ?? k}`).join(", ");
                return made ? `Đã cập nhật dữ liệu vào hệ thống: ${made}` : "Đã cập nhật dữ liệu vào hệ thống";
              }).then(() => setConfirm(null))} />
        ) : confirm === "rollback" ? (
          <ConfirmContent tone="warning" title="Hoàn tác lô nhập này?"
            description="Dữ liệu lô này đã ghi sẽ bị gỡ khỏi hệ thống và lô quay về để sửa. Không hoàn tác được nếu dữ liệu đã được dùng, ví dụ đã lập phiếu hoặc đã cấp tài khoản."
            cancelLabel="Giữ dữ liệu" confirmLabel="Hoàn tác" destructive busy={busy} keepOpen
            onConfirm={() => void act(() => kyInstance.post(`data_imports/${id}/rollback`, { timeout: 300_000 }).json<ImportBatch>(),
              "Đã hoàn tác, lô trở về chờ ghi").then(() => setConfirm(null))} />
        ) : confirm === "delete" ? (
          <ConfirmContent tone="danger" title="Xoá lô nhập này?"
            description="Chỉ xoá dữ liệu đang chờ; hệ thống không có gì thay đổi."
            cancelLabel="Không xoá" confirmLabel="Xoá" busy={busy} keepOpen
            onConfirm={() => {
              setBusy(true);
              void kyInstance.delete(`data_imports/${id}`).then(async () => {
                await queryClient.invalidateQueries({ queryKey: BATCHES_KEY });
                go({ to: "/data-imports" });
              }).catch(async (error) => notify?.({ type: "error", message: await errorMessage(error) }))
                .finally(() => { setBusy(false); setConfirm(null); });
            }} />
        ) : null}
      </AlertDialog>
    </ShowView>
  );
};

/** Thanh tiến độ của lượt ghi. Máy chủ chưa báo (đang kiểm lại cả lô trước khi ghi) thì nói đang kiểm. */
function WriteProgress({ writing }: { writing: { step: string; done: number; total: number } | null }) {
  const pct = writing && writing.total > 0 ? Math.min(100, Math.round((writing.done / writing.total) * 100)) : 0;
  return (
    <div className="mt-1 grid gap-1.5" role="status" aria-live="polite">
      <div className="text-foreground flex items-baseline justify-between gap-3 text-xs">
        <span>{writing ? writing.step : "Đang kiểm lại cả lô trước khi ghi…"}</span>
        {writing ? (
          <span className="tabular-nums">
            {writing.done.toLocaleString("vi-VN", { useGrouping: false })} / {writing.total.toLocaleString("vi-VN", { useGrouping: false })} · {pct}%
          </span>
        ) : null}
      </div>
      <div className="bg-muted h-2 overflow-hidden rounded-full">
        <div className="bg-primary h-full rounded-full transition-[width] duration-700 ease-out" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
