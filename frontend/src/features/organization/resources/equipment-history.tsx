import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useInvalidate, useOne } from "@refinedev/core";
import { ClipboardCheck, FilePen, History, Loader2, PackagePlus, RefreshCw, Settings } from "lucide-react";
import { Fragment, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router";

import { kyInstance } from "@/shared/api/data";
import { Segmented } from "@/shared/components/segmented";
import { Timeline, TimelineItem, type TimelineTone } from "@/shared/components/timeline";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";
import { cn } from "@/shared/lib/utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/shared/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import {
  EQUIPMENT_HISTORY_ACTION_LABELS,
  EQUIPMENT_HISTORY_FIELD_LABELS,
  VOUCHER_ROUTES,
  type EquipmentHistoryRow,
} from "@/domains/equipment/types";

import {
  buildEntries,
  entryGroup,
  fullDateTime,
  HISTORY_GROUP_LABELS,
  monthOf,
  shortActor,
  shortDateTime,
  summarize,
  tidyNotes,
  type EntrySummary,
  type HistoryEntryData,
  type HistoryGroupKey,
} from "./history-entries";
import { EmptyState } from "@/shared/components/data-table/table-empty";
import { LoadingText } from "@/shared/components/spinner";

/** Biểu tượng theo loại việc; màu nền theo nhóm việc (`ACTION_TONES`) — cùng khuôn hộp "Quá trình duyệt". */
const ACTION_ICONS: Record<string, ReactNode> = {
  GHI_TANG: <PackagePlus />,
  CAP_NHAT: <FilePen />,
  KIEM_KE: <ClipboardCheck />,
};
const iconOf = (action: string) => ACTION_ICONS[action] ?? <History />;

/** Vào sổ xanh lá; hồ sơ, kiểm kê xám. */
const ACTION_TONES: Record<string, TimelineTone> = { GHI_TANG: "success" };
const toneOf = (action: string) => ACTION_TONES[action] ?? "neutral";

/** Tài sản đang thế nào — đọc từ hồ sơ, cho khối "Hiện tại" ghim đầu lịch sử. */
type CurrentEquipment = {
  status: string;
  room?: { name: string } | null;
  manager?: { name: string } | null;
  school?: { name: string } | null;
};

/**
 * Lịch sử của một tài sản (theo mockup "Lịch sử tài sản"):
 * - khối "Hiện tại": trạng thái là chip có màu DUY NHẤT trên màn, kèm chỗ để / người giữ;
 * - nút lọc ba nhóm việc, mục gom theo tháng, mỗi phiếu một mục (`history-entries.ts`);
 * - mỗi mục: tên việc · ngày giờ, một dòng kết quả ngắn khi cần, người làm · số phiếu; trạng thái cũ → mới và các
 *   bước giấu sau "Chi tiết ▸".
 *
 * <p>Số phiếu là một liên kết: câu hỏi tiếp theo sau "máy này chuyển phòng hôm nào" gần như luôn là "theo phiếu
 * nào, ai duyệt".
 */
export function EquipmentHistoryPanel({ equipmentId, bare }: { equipmentId: number | undefined; bare?: boolean }) {
  const { data, isLoading } = useQuery({
    queryKey: ["equipment_history", equipmentId],
    enabled: equipmentId != null,
    queryFn: ({ signal }) => kyInstance.get(`equipment/${equipmentId}/history`, { signal }).json<EquipmentHistoryRow[]>(),
  });
  // Cùng khoá với màn chi tiết thiết bị nên thường đã có sẵn, không tốn thêm yêu cầu.
  const { result: current } = useOne<CurrentEquipment>({
    resource: "equipment",
    id: equipmentId ?? "",
    queryOptions: { enabled: equipmentId != null },
  });
  const rows = Array.isArray(data) ? data : [];
  const entries = buildEntries(rows);
  const body = isLoading ? (
    <LoadingText />
  ) : rows.length === 0 ? (
    <EmptyState title="Chưa có thay đổi nào được ghi lại" icon={<History />} />
  ) : (
    <HistoryBody entries={entries} current={current} fill={bare} />
  );
  if (bare) return body; // Trong hộp thoại: hộp thoại lo khung và thanh cuộn.

  return (
    <Card className="gap-0">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <History className="size-4" />
          Lịch sử thiết bị
          {entries.length ? <Badge variant="neutral">{entries.length}</Badge> : null}
        </CardTitle>
      </CardHeader>
      {/* Cao tối đa rồi cuộn bên trong: một tài sản kiểm kê mỗi kỳ tích lại hàng chục mục. */}
      <CardContent className="scrollbar-fade max-h-[30rem] overflow-y-auto">{body}</CardContent>
    </Card>
  );
}

/**
 * Thân lịch sử: dải lọc theo nhóm việc đứng yên, danh sách theo tháng cuộn bên dưới (`fill`: trong hộp thoại cỡ cố
 * định — chỉ danh sách cuộn, tiêu đề tháng dính đầu vùng cuộn). Không còn khối "Hiện tại": trạng thái, chỗ để,
 * người giữ đã có ngay trên hồ sơ thiết bị phía sau hộp.
 */
function HistoryBody({ entries, current, fill }: { entries: HistoryEntryData[]; current?: CurrentEquipment; fill?: boolean }) {
  const [filter, setFilter] = useState<HistoryGroupKey | "all">("all");
  const count = (k: HistoryGroupKey) => entries.filter((e) => entryGroup(e) === k).length;
  const shown = filter === "all" ? entries : entries.filter((e) => entryGroup(e) === filter);
  const months: { key: string; label: string; entries: HistoryEntryData[] }[] = [];
  for (const e of shown) {
    const m = monthOf(e.rows[0].createdAt);
    const last = months[months.length - 1];
    if (last?.key === m.key) last.entries.push(e);
    else months.push({ ...m, entries: [e] });
  }
  const school = current?.school?.name;
  // Khung giữ chiều cao của "Tất cả" (lúc nhiều mục nhất): lọc sang nhóm ít mục thì danh sách đổi, khung và các
  // nút lọc đứng yên, không co lại theo. Đo liên tục khi đang ở "Tất cả" vì mở / đóng "Chi tiết" đổi chiều cao.
  const listRef = useRef<HTMLDivElement>(null);
  const [allHeight, setAllHeight] = useState<number>();
  useLayoutEffect(() => {
    const el = listRef.current;
    if (filter !== "all" || !el) return;
    const observer = new ResizeObserver(() => setAllHeight(el.offsetHeight));
    observer.observe(el);
    return () => observer.disconnect();
  }, [filter]);

  return (
    // Đứng giữa khung, rộng vừa đọc: trên màn rộng ngày giờ không bị đẩy ra tận mép phải, vạch tháng không kéo dài.
    <div className={cn("w-full max-w-4xl min-w-0", fill ? "flex min-h-0 flex-1 flex-col gap-4" : "space-y-4")}>
      {/* Nút chọn dùng chung (viên trượt, bo tròn) như mọi nút chọn khác của app; số đếm đi kèm từng nhóm. */}
      <div className="-mx-1 shrink-0 overflow-x-auto px-1 pb-1">
      <Segmented label="Lọc lịch sử" size="sm" value={filter} onChange={setFilter}
        options={[
          { value: "all" as const, hint: "Mọi sự kiện của thiết bị", label: <>Tất cả <span className="font-semibold tabular-nums opacity-80">{entries.length}</span></> },
          ...(Object.keys(HISTORY_GROUP_LABELS) as HistoryGroupKey[]).map((k) => ({
            value: k,
            hint: `Chỉ các sự kiện ${HISTORY_GROUP_LABELS[k].toLowerCase()}`,
            label: <>{HISTORY_GROUP_LABELS[k]} <span className="font-semibold tabular-nums opacity-80">{count(k)}</span></>,
          })),
        ]} />
      </div>
      <div className={cn(fill && "scrollbar-fade -mx-1 min-h-0 flex-1 overflow-y-auto px-1")}>
      <div ref={listRef} className="flex min-h-full flex-col gap-5" style={fill || filter === "all" ? undefined : { minHeight: allHeight }}>
        {months.length === 0 ? (
          <EmptyState filtered title="Không có sự kiện" description="Nhóm này chưa có sự kiện nào của thiết bị." />
        ) : null}
        {months.map((m) => (
          <section key={m.key}>
            <div className={cn("text-overline text-muted-foreground mb-3 flex items-center gap-3", fill && "bg-background sticky top-0 z-[1] py-1")}>
              {m.label}
              <span aria-hidden className="bg-border h-px flex-1" />
            </div>
            <Timeline>
              {m.entries.map((e) =>
                e.repeat ? (
                  <RepeatEntry key={e.rows[0].id} rows={e.rows} school={school} />
                ) : (
                  <VoucherEntry key={e.rows[0].id} rows={e.rows} school={school} />
                ),
              )}
            </Timeline>
          </section>
        ))}
      </div>
      </div>
    </div>
  );
}


/** Nút mở / đóng phần chi tiết, nằm cuối hàng người làm · số phiếu. */
function DetailToggle({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <button type="button" onClick={onToggle} className="text-primary mt-1 block text-xs hover:underline">
      {open ? "Thu gọn ▾" : "Chi tiết ▸"}
    </button>
  );
}

/** "—" trong lịch sử là ô bị xoá trống: nói thành chữ. */
const shown = (v: string) => (v === "—" ? "trống" : v);

/** Chuỗi giá trị trong chi tiết: cũ gạch ngang, giữa để thường, mới đậm — "~~Trong kho~~ → Đang sử dụng → **Mất**". */
function Chain({ values }: { values: string[] }) {
  const list = values[0] === "—" ? values.slice(1) : values;
  return (
    <>
      {list.map((v, i) => (
        <Fragment key={i}>
          {i > 0 ? " → " : null}
          {i === list.length - 1 ? (
            <b className="font-semibold">{shown(v)}</b>
          ) : i === 0 ? (
            <s className="text-muted-foreground">{shown(v)}</s>
          ) : (
            <span>{shown(v)}</span>
          )}
        </Fragment>
      ))}
    </>
  );
}

function DetailBox({ children }: { children: ReactNode }) {
  return <div className="bg-surface-subtle mt-2 space-y-0.5 rounded-lg border px-3 py-2.5 text-sm">{children}</div>;
}

/** Trường lưu số tiền thô ("3600000.00") — hiện "3.600.000 đ". */
const MONEY_FIELDS = new Set(["remainingValue"]);
const money = (v: string) => (v === "—" || Number.isNaN(Number(v)) ? v : `${Number(v).toLocaleString("vi-VN")} đ`);

function Details({ summary }: { summary: EntrySummary }) {
  return (
    <DetailBox>
      {summary.changes.map((c) => (
        <p key={c.field}>
          <span className="text-muted-foreground">{EQUIPMENT_HISTORY_FIELD_LABELS[c.field] ?? c.field}:</span>{" "}
          <Chain values={MONEY_FIELDS.has(c.field) ? c.values.map(money) : c.values} />
        </p>
      ))}
      {summary.steps ? <p className="text-muted-foreground pt-1 text-[0.8125rem]">{summary.steps}</p> : null}
    </DetailBox>
  );
}

/** Một phiếu, một mục: tên việc · ngày giờ, dòng kết quả (khi cần), người làm · số phiếu · Chi tiết. */
function VoucherEntry({ rows, school }: { rows: EquipmentHistoryRow[]; school?: string }) {
  const [open, setOpen] = useState(false);
  const latest = rows[0];
  const summary = summarize([...rows].reverse());
  const hasDetails = summary.changes.length > 0 || !!summary.steps;
  return (
    <TimelineItem icon={iconOf(latest.action)} tone={toneOf(latest.action)} title={summary.title}
      time={fullDateTime(latest.createdAt)} by={<ByLine row={latest} school={school} />}>
      {summary.result ? (
        <p className={cn("mt-1 text-sm", summary.bad && "text-destructive-text font-medium")}>{summary.result}</p>
      ) : null}
      {hasDetails ? <DetailToggle open={open} onToggle={() => setOpen((o) => !o)} /> : null}
      {open && hasDetails ? <Details summary={summary} /> : null}
    </TimelineItem>
  );
}

/** Dòng thứ hai của mục, như hộp "Quá trình duyệt": người làm · số phiếu. */
function ByLine({ row, school }: { row: EquipmentHistoryRow; school?: string }) {
  return (
    <>
      {shortActor(row.actorName ?? "Hệ thống", school)}
      {row.voucherCode ? (
        <>
          <span aria-hidden className="mx-1.5">·</span>
          <VoucherLink row={row} />
        </>
      ) : null}
    </>
  );
}

function VoucherLink({ row }: { row: EquipmentHistoryRow }) {
  const route = row.voucherResource ? VOUCHER_ROUTES[row.voucherResource] : undefined;
  return row.voucherCode && route && row.voucherId ? (
    <Link className="text-primary tabular-nums hover:underline" to={`${route}/show/${row.voucherId}`}>
      {row.voucherCode}
    </Link>
  ) : (
    <span className="tabular-nums">{row.voucherCode}</span>
  );
}

/** Nhiều lần giống hệt nhau liền nhau (mỗi lần một phiếu) — vd. kiểm kê khớp sổ mỗi kỳ: một mục "N lần". */
function RepeatEntry({ rows, school }: { rows: EquipmentHistoryRow[]; school?: string }) {
  const [open, setOpen] = useState(false);
  const row = rows[0];
  const { title } = tidyNotes(EQUIPMENT_HISTORY_ACTION_LABELS[row.action] ?? row.action, row.note ? [row.note] : [], !!row.field);
  return (
    <TimelineItem icon={iconOf(row.action)} tone={toneOf(row.action)} title={title}
      time={fullDateTime(row.createdAt)} by={<ByLine row={row} school={school} />}>
      <p className="mt-1 text-sm">{rows.length} lần</p>
      <DetailToggle open={open} onToggle={() => setOpen((o) => !o)} />
      {open ? (
        <DetailBox>
          {rows.map((r) => (
            <p key={r.id} className="flex gap-3 text-[0.8125rem]">
              <VoucherLink row={r} />
              <span className="text-muted-foreground min-w-0 flex-1 truncate">{shortActor(r.actorName ?? "Hệ thống", school)}</span>
              <span className="text-muted-foreground shrink-0 tabular-nums">{shortDateTime(r.createdAt)}</span>
            </p>
          ))}
        </DetailBox>
      ) : null}
    </TimelineItem>
  );
}

/**
 * Đầu hồ sơ thiết bị: nút biểu tượng "Lịch sử" (mở hộp thoại, đứng sau nút Sửa) và menu ⚙ với Tải lại. Lịch sử
 * mở trong hộp thoại — thứ tra khi cần ("máy này chuyển phòng hôm nào"), không đọc mỗi lần mở hồ sơ.
 */
export function EquipmentMoreMenu({ record }: { record: { id: number } }) {
  const [open, setOpen] = useState(false);
  // Như nút ⚙ của bảng (`DataTableMoreActions`): quay một vòng mỗi lần mở, quay liên tục khi đang tải lại.
  const [spin, setSpin] = useState(0);
  const [reloading, setReloading] = useState(false);
  const invalidate = useInvalidate();
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: ["equipment_history", record.id],
    queryFn: ({ signal }) => kyInstance.get(`equipment/${record.id}/history`, { signal }).json<EquipmentHistoryRow[]>(),
  });
  const n = Array.isArray(data) ? buildEntries(data).length : undefined;
  const reload = async () => {
    setReloading(true);
    try {
      await Promise.all([
        invalidate({ resource: "equipment", id: record.id, invalidates: ["detail"] }),
        queryClient.invalidateQueries({ queryKey: ["equipment_history", record.id] }),
        queryClient.invalidateQueries({ queryKey: ["attachments", "equipment", record.id] }),
      ]);
    } finally {
      setReloading(false);
    }
  };
  return (
    <>
      {/* Chỉ biểu tượng, đứng SAU nút Sửa (đúng thứ tự trong `more` của ShowView); số sự kiện là chấm nhỏ ở góc. */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button type="button" variant="outline" size="icon" className="relative" aria-label={`Lịch sử${n ? ` (${n})` : ""}`}
            onClick={() => setOpen(true)}>
            <History />
            {n ? (
              <span className="bg-primary text-primary-foreground ring-background absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[0.625rem] leading-none font-semibold tabular-nums ring-2">
                {n > 99 ? "99+" : n}
              </span>
            ) : null}
          </Button>
        </TooltipTrigger>
        <TooltipContent>Lịch sử thiết bị</TooltipContent>
      </Tooltip>
      <DropdownMenu onOpenChange={(o) => o && setSpin((n) => n + 1)}>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" size="icon" aria-label="Thao tác khác">
                {reloading ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <Settings key={spin} className={cn(spin > 0 && "animate-[spin_0.6s_ease-in-out_1]")} />
                )}
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>Thao tác khác</TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="end" className="min-w-48">
          <DropdownMenuItem onSelect={() => void reload()}>
            <RefreshCw />
            Tải lại
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={open} onOpenChange={setOpen}>
        {/* Cỡ cố định (`form`): hộp không co giãn theo số mục; chỉ danh sách cuộn, đầu hộp và dải lọc đứng yên. */}
        <DialogContent size="form" className="gap-4 overflow-x-hidden"
          onOpenAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="text-muted-foreground size-4" />
              Lịch sử thiết bị
              {n ? <Badge variant="neutral">{n}</Badge> : null}
            </DialogTitle>
            <DialogDescription className="sr-only">Ghi tăng, kiểm kê, cập nhật hồ sơ theo từng phiếu, mới nhất trước.</DialogDescription>
          </DialogHeader>
          <div className="flex min-h-0 flex-1 flex-col">
            <EquipmentHistoryPanel equipmentId={record.id} bare />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
