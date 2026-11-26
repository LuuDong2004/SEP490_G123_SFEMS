import { useIsMobile } from "@/shared/hooks/use-mobile";
import { useInvalidate, useNotification } from "@refinedev/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ClipboardCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { kyInstance } from "@/shared/api/data";
import { ConfirmContent } from "@/shared/components/confirm/confirm-content";
import { DataTablePagination } from "@/shared/components/data-table/data-table-pagination";
import { StepTitle } from "@/shared/components/voucher/voucher-layout";
import { errorMessage } from "@/shared/lib/api-error";
import { maxLengthOf } from "@/shared/lib/field-rules";
import { LIFT_ROW } from "@/shared/lib/row-lift";
import { cn } from "@/shared/lib/utils";
import { AlertDialog } from "@/shared/ui/alert-dialog";
import { Button } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { Checkbox } from "@/shared/ui/checkbox";
import { Input } from "@/shared/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { CONDITION_LABELS, STRUCTURE_LABELS } from "@/domains/facility/types";
import type { InventoryFacilityLine, InventoryFacilityLines, InventorySession } from "@/domains/inventory/types";

const SAME = "__same__";
/** Ô đầu và ô cuối của dòng thẳng mép với chữ trong thẻ. */
const EDGE = "[&>*:first-child]:ps-4 [&>*:last-child]:pe-4";

const key = (id: number) => ["inventory_facility_lines", id];

type Patch = Partial<Pick<InventoryFacilityLine, "structureFound" | "conditionFound" | "checked" | "note">>;

/** "Kiên cố → Tạm" khi thấy khác sổ; như sổ thì chỉ giá trị sổ. */
function Change({ before, found, labels }: { before: string | null; found: string | null; labels: Record<string, string> }) {
  const was = before ? labels[before] ?? before : "Chưa khai";
  if (!found || found === before) return <span className={cn(!before && "text-muted-foreground")}>{was}</span>;
  return (
    <span className="whitespace-nowrap">
      <span className="text-muted-foreground">{was}</span> → <span className="text-warning-text font-medium">{labels[found] ?? found}</span>
    </span>
  );
}

/** Ô chọn giá trị thấy thực tế: lựa chọn đầu là giá trị trên sổ (trống = như sổ). */
function FoundSelect({ before, found, labels, onChange, label }: {
  before: string | null;
  found: string | null;
  labels: Record<string, string>;
  onChange: (v: string | null) => void;
  label: string;
}) {
  return (
    <Select value={found && found !== before ? found : SAME} onValueChange={(v) => onChange(v === SAME ? null : v)}>
      <SelectTrigger aria-label={label} className="h-8 w-full [&_[data-suffix]]:hidden"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value={SAME}>{before ? labels[before] : "Chưa khai"} <span data-suffix className="text-muted-foreground">(đúng hệ thống)</span></SelectItem>
        {Object.entries(labels).filter(([k]) => k !== before).map(([k, v]) => (
          <SelectItem key={k} value={k}>{v}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Ô ghi chú lưu khi rời ô — không gọi máy chủ ở mỗi phím. */
function NoteInput({ value, onSave }: { value: string | null; onSave: (v: string) => void }) {
  const [text, setText] = useState(value ?? "");
  useEffect(() => setText(value ?? ""), [value]);
  return (
    <Input className="h-8" value={text} placeholder="Ghi chú" maxLength={maxLengthOf("NOTE")} aria-label="Ghi chú"
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        if (text.trim() !== (value ?? "")) onSave(text);
      }} />
  );
}

/**
 * Hạng mục CSVC của biên bản kiểm kê: khối nhà và phòng / hạng mục trong phạm vi phiếu, kết cấu và
 * hiện trạng trên sổ → thấy thực tế. Phiếu còn nháp thì ghi ngay từng ô; biên bản đã duyệt thì "Áp dụng vào hồ sơ CSVC"
 * ghi phần khác sổ thẳng vào hồ sơ CSVC (InventoryFacilityService — bước chờ lãnh đạo xác nhận đã bỏ ở 240).
 */
export function InventoryFacilityPanel({ record }: { record: InventorySession }) {
  const queryClient = useQueryClient();
  const invalidate = useInvalidate();
  const { open } = useNotification();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const mobile = useIsMobile();
  // Phân trang 20 hạng mục một trang — bảng cao theo số dòng, không cuộn trong khung.
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const { data } = useQuery({
    queryKey: [...key(record.id), record.status],
    queryFn: ({ signal }) => kyInstance.get(`inventory_sessions/${record.id}/facility-lines`, { signal }).json<InventoryFacilityLines>(),
  });
  // Biên bản nháp chưa có hạng mục: TỰ lập danh sách (khối nhà, phòng của trường / phòng của phiếu) — không bắt người
  // dùng bấm "Lập danh sách hạng mục". Mỗi biên bản gọi một lần.
  const canGenerate = !!data?.editable && !!record._actions?.includes("count") && data?.total === 0;
  const generated = useRef<number | null>(null);
  const [generatedFor, setGeneratedFor] = useState<number | null>(null);
  useEffect(() => {
    if (!canGenerate || generated.current === record.id) return;
    generated.current = record.id;
    void kyInstance.post(`inventory_sessions/${record.id}/facility-lines/generate`).json<InventoryFacilityLines>()
      .then((next) => queryClient.setQueryData([...key(record.id), record.status], next))
      .finally(() => setGeneratedFor(record.id))
      .catch(async (error) => open?.({ type: "error", message: await errorMessage(error) }));
  }, [canGenerate, record.id, record.status, queryClient, open]);
  if (!data) return null;
  const editable = data.editable && record._actions?.includes("count");
  // Biên bản cũ (lập trước khi có phần này) không có hạng mục nào và không sửa được nữa: không vẽ gì.
  if (data.total === 0 && !editable) return null;
  const set = (next: InventoryFacilityLines) => queryClient.setQueryData([...key(record.id), record.status], next);

  async function save(line: InventoryFacilityLine, patch: Patch) {
    const next = { structureFound: line.structureFound, conditionFound: line.conditionFound, checked: true, note: line.note, ...patch };
    try {
      set(await kyInstance.put(`inventory_sessions/${record.id}/facility-lines/${line.id}`, { json: next }).json<InventoryFacilityLines>());
    } catch (error) {
      open?.({ type: "error", message: await errorMessage(error) });
    }
  }

  async function apply() {
    setBusy(true);
    try {
      const r = await kyInstance.post(`inventory_sessions/${record.id}/facility-lines/apply`).json<{ count: number }>();
      open?.({
        type: "success",
        message: `Đã ghi ${r.count} hạng mục vào hồ sơ CSVC`,
      });
      setConfirming(false);
      await queryClient.invalidateQueries({ queryKey: key(record.id) });
      await Promise.all([
        invalidate({ resource: "rooms", invalidates: ["list", "detail"] }),
        invalidate({ resource: "buildings", invalidates: ["list", "detail"] }),
      ]);
    } catch (error) {
      open?.({ type: "error", message: await errorMessage(error) });
    } finally {
      setBusy(false);
    }
  }

  const pageCount = Math.max(1, Math.ceil(data.lines.length / pageSize));
  const pageLines = data.lines.slice((Math.min(page, pageCount) - 1) * pageSize, Math.min(page, pageCount) * pageSize);
  const changed = (l: InventoryFacilityLine) =>
    l.checked && ((!!l.structureFound && l.structureFound !== l.structureBefore) || (!!l.conditionFound && l.conditionFound !== l.conditionBefore));
  const aside = data.total ? `${data.checked}/${data.total} đã kiểm${data.changed ? ` · ${data.changed} khác sổ` : ""}` : undefined;

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <CardContent className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
        <StepTitle title="Hạng mục CSVC" aside={aside} open={expanded} onToggle={() => setExpanded(!expanded)} />
        <div className="flex flex-wrap items-center gap-2">
          {data.applied ? <span className="text-muted-foreground text-xs">Đã áp dụng {data.applied} hạng mục</span> : null}
          {data.applicable ? (
            <Button type="button" size="sm" disabled={busy} onClick={() => setConfirming(true)}>
              <ClipboardCheck /> Áp dụng vào hồ sơ CSVC
            </Button>
          ) : null}
        </div>
      </CardContent>
      {!expanded ? null : data.total === 0 ? (
        <p className="text-muted-foreground border-t px-4 py-6 text-center text-sm">
          {generatedFor === record.id ? "Trường chưa khai khối nhà, phòng nào để kiểm." : "Đang lập danh sách hạng mục…"}
        </p>
      ) : (
        <div className="border-t">
          {/* Không cuộn ngang: mã và loại về dòng phụ dưới tên; "Đã kiểm" đứng trước — tích rồi mới khai kết quả. */}
          <Table className="table-fixed">
            {mobile ? null : (
            <colgroup>
              <col />
              <col className="w-20" />
              <col className="w-36" />
              <col className="w-36" />
              <col className="w-44" />
            </colgroup>
            )}
            <TableHeader className={mobile ? "hidden" : undefined}>
              <TableRow className={EDGE}>
                <TableHead>Hạng mục</TableHead>
                <TableHead align="center">Đã kiểm</TableHead>
                <TableHead title="Chỉ khai được khi hồ sơ chưa có kết cấu">Kết cấu</TableHead>
                <TableHead title="Hệ thống ghi → thấy thực tế">Hiện trạng</TableHead>
                <TableHead>Ghi chú</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageLines.map((l) => mobile ? (
                // Điện thoại: một thẻ xếp dọc — tên, ô "Đã kiểm" to; tích rồi mới hiện kết cấu (nếu chưa khai), hiện trạng, ghi chú.
                <TableRow key={l.id} className={cn("hover:bg-transparent", changed(l) && "bg-warning-subtle/40")}>
                  <TableCell colSpan={5} className="space-y-2 !px-4 py-3 whitespace-normal">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-medium break-words">{l.name}</div>
                        <div className="text-muted-foreground text-xs">
                          <span className="font-mono">{l.code}</span>{l.typeName ? ` · ${l.typeName}` : ""}
                        </div>
                        <div className="text-muted-foreground text-xs">
                          Kết cấu: <Change before={l.structureBefore} found={l.checked ? l.structureFound : null} labels={STRUCTURE_LABELS} />
                        </div>
                      </div>
                      {editable ? (
                        <label className="flex shrink-0 items-center gap-2 text-sm">
                          <Checkbox aria-label={`Đã kiểm ${l.name}`} checked={l.checked}
                            onCheckedChange={(on) => void save(l, on === true ? { checked: true } : { checked: false, structureFound: null, conditionFound: null, note: null })} />
                          Đã kiểm
                        </label>
                      ) : (
                        <span className={cn("shrink-0 text-sm", l.checked ? "text-success-text" : "text-muted-foreground")}>{l.checked ? "Đã kiểm" : "Chưa"}</span>
                      )}
                    </div>
                    {editable && l.checked ? (
                      <div className="grid grid-cols-2 gap-2">
                        {!l.structureBefore ? (
                          <FoundSelect label={`Kết cấu ${l.name}`} before={null} found={l.structureFound} labels={STRUCTURE_LABELS}
                            onChange={(v) => void save(l, { structureFound: v })} />
                        ) : null}
                        <div className={l.structureBefore ? "col-span-2" : undefined}>
                          <FoundSelect label={`Hiện trạng ${l.name}`} before={l.conditionBefore} found={l.conditionFound} labels={CONDITION_LABELS}
                            onChange={(v) => void save(l, { conditionFound: v })} />
                        </div>
                        <div className="col-span-2"><NoteInput value={l.note} onSave={(v) => void save(l, { note: v })} /></div>
                      </div>
                    ) : !editable && l.checked ? (
                      <div className="text-muted-foreground text-xs">
                        Hiện trạng: <Change before={l.conditionBefore} found={l.conditionFound} labels={CONDITION_LABELS} />
                        {l.note ? ` · ${l.note}` : ""}
                      </div>
                    ) : null}
                  </TableCell>
                </TableRow>
              ) : (
                <TableRow key={l.id} className={cn(EDGE, !editable && cn("group/row", LIFT_ROW), changed(l) && "bg-warning-subtle/40")}>
                  <TableCell>
                    <div className="truncate font-medium" title={l.buildingName ? `${l.name} — ${l.buildingName}` : l.name}>
                      {l.name}
                      {l.buildingName ? <span className="text-muted-foreground font-normal"> · {l.buildingName}</span> : null}
                    </div>
                    <div className="text-muted-foreground truncate text-xs">
                      <span className="font-mono">{l.code}</span>{l.typeName ? ` · ${l.typeName}` : ""}
                    </div>
                  </TableCell>
                  <TableCell align="center">
                    {editable ? (
                      <Checkbox aria-label={`Đã kiểm ${l.name}`} checked={l.checked}
                        onCheckedChange={(on) => void save(l, on === true ? { checked: true } : { checked: false, structureFound: null, conditionFound: null, note: null })} />
                    ) : l.checked ? (
                      <span className="text-success-text text-sm">Đã kiểm</span>
                    ) : (
                      <span className="text-muted-foreground text-sm">Chưa</span>
                    )}
                  </TableCell>
                  {/* Kết cấu: hồ sơ ĐÃ khai thì chỉ xem; chưa khai thì tích "Đã kiểm" rồi khai bổ sung. */}
                  <TableCell className={editable && l.checked && !l.structureBefore ? "py-1" : undefined}>
                    {editable && l.checked && !l.structureBefore ? (
                      <FoundSelect label={`Kết cấu ${l.name}`} before={null} found={l.structureFound} labels={STRUCTURE_LABELS}
                        onChange={(v) => void save(l, { structureFound: v })} />
                    ) : (
                      <Change before={l.structureBefore} found={l.checked ? l.structureFound : null} labels={STRUCTURE_LABELS} />
                    )}
                  </TableCell>
                  {/* Hiện trạng, ghi chú: chỉ hiện ô khi đã tích "Đã kiểm". */}
                  <TableCell className={editable && l.checked ? "py-1" : undefined}>
                    {editable && l.checked ? (
                      <FoundSelect label={`Hiện trạng ${l.name}`} before={l.conditionBefore} found={l.conditionFound} labels={CONDITION_LABELS}
                        onChange={(v) => void save(l, { conditionFound: v })} />
                    ) : l.checked ? (
                      <Change before={l.conditionBefore} found={l.conditionFound} labels={CONDITION_LABELS} />
                    ) : (
                      <span className="text-muted-foreground text-sm">Chưa kiểm</span>
                    )}
                  </TableCell>
                  <TableCell className={editable && l.checked ? "py-1" : "text-muted-foreground truncate text-sm"}>
                    {editable && l.checked ? <NoteInput value={l.note} onSave={(v) => void save(l, { note: v })} />
                      : l.checked ? (l.note ?? "Không có ghi chú") : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {data.lines.length > pageSize || pageSize !== 20 ? (
            <div className="bg-surface-subtle border-t px-4 py-2">
              <DataTablePagination compact currentPage={Math.min(page, pageCount)} pageCount={pageCount} setCurrentPage={setPage}
                pageSize={pageSize} setPageSize={(n) => { setPageSize(n); setPage(1); }} total={data.lines.length} pageSizeLabel="Số dòng mỗi trang" />
            </div>
          ) : null}
        </div>
      )}
      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <ConfirmContent
          title="Áp dụng kết quả vào hồ sơ CSVC?"
          description="Kết cấu, hiện trạng thấy thực tế được ghi ngay vào hồ sơ khối nhà, phòng, hạng mục."
          cancelLabel="Chưa áp dụng"
          confirmLabel="Áp dụng"
          busy={busy}
          keepOpen
          onConfirm={() => void apply()}
        />
      </AlertDialog>
    </Card>
  );
}
