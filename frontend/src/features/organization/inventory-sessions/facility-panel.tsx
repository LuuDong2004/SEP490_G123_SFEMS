import { useInvalidate, useNotification } from "@refinedev/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, ClipboardCheck, ListPlus } from "lucide-react";
import { useEffect, useState } from "react";

import { kyInstance } from "@/shared/api/data";
import { ConfirmContent } from "@/shared/components/confirm/confirm-content";
import { AddLinesEmpty } from "@/shared/components/voucher/add-lines";
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
 * Hạng mục CSVC của biên bản kiểm kê (QLTB-654, 655): khối nhà và phòng / hạng mục trong phạm vi phiếu, kết cấu và
 * hiện trạng trên sổ → thấy thực tế. Phiếu còn nháp thì ghi ngay từng ô; biên bản đã duyệt thì "Áp dụng vào hồ sơ CSVC"
 * ghi phần khác sổ vào hồ sơ (cán bộ áp → chờ lãnh đạo xác nhận).
 */
export function InventoryFacilityPanel({ record }: { record: InventorySession }) {
  const queryClient = useQueryClient();
  const invalidate = useInvalidate();
  const { open } = useNotification();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const { data } = useQuery({
    queryKey: [...key(record.id), record.status],
    queryFn: ({ signal }) => kyInstance.get(`inventory_sessions/${record.id}/facility-lines`, { signal }).json<InventoryFacilityLines>(),
  });
  if (!data) return null;
  const editable = data.editable && record._actions?.includes("count");
  // Biên bản cũ (lập trước khi có phần này) không có hạng mục nào và không sửa được nữa: không vẽ gì.
  if (data.total === 0 && !editable) return null;
  const set = (next: InventoryFacilityLines) => queryClient.setQueryData([...key(record.id), record.status], next);

  async function generate() {
    setBusy(true);
    try {
      set(await kyInstance.post(`inventory_sessions/${record.id}/facility-lines/generate`).json<InventoryFacilityLines>());
    } catch (error) {
      open?.({ type: "error", message: await errorMessage(error) });
    } finally {
      setBusy(false);
    }
  }

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

  const changed = (l: InventoryFacilityLine) =>
    l.checked && ((!!l.structureFound && l.structureFound !== l.structureBefore) || (!!l.conditionFound && l.conditionFound !== l.conditionBefore));
  const aside = data.total ? `${data.checked}/${data.total} đã kiểm${data.changed ? ` · ${data.changed} khác sổ` : ""}` : undefined;

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <CardContent className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
        <StepTitle title="Hạng mục CSVC" aside={aside} />
        <div className="flex flex-wrap items-center gap-2">
          {data.applied ? <span className="text-muted-foreground text-xs">Đã áp dụng {data.applied} hạng mục</span> : null}
          {editable && data.total ? (
            <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void generate()}>
              <ListPlus /> Bổ sung hạng mục
            </Button>
          ) : null}
          {data.applicable ? (
            <Button type="button" size="sm" disabled={busy} onClick={() => setConfirming(true)}>
              <ClipboardCheck /> Áp dụng vào hồ sơ CSVC
            </Button>
          ) : null}
        </div>
      </CardContent>
      {data.total === 0 ? (
        <AddLinesEmpty label="Lập danh sách hạng mục" icon={<Building2 />} disabled={busy} onClick={() => void generate()}
          hint={record.room ? `Kiểm ${record.room.name}: kết cấu, hiện trạng` : "Khối nhà, phòng, hạng mục của trường: kết cấu, hiện trạng"} />
      ) : (
        <div className="max-h-[min(32rem,60vh)] overflow-auto border-t [&>[data-slot=table-container]]:overflow-visible">
          <Table className={cn("table-fixed", editable ? "min-w-[62rem]" : "min-w-[52rem]")}>
            <colgroup>
              <col className="w-24" />
              <col />
              <col className="w-32" />
              <col className="w-40" />
              <col className="w-40" />
              <col className="w-20" />
              <col className="w-44" />
            </colgroup>
            <TableHeader sticky>
              <TableRow className={EDGE}>
                <TableHead>Mã</TableHead>
                <TableHead>Tên</TableHead>
                <TableHead>Loại</TableHead>
                <TableHead title="Hệ thống ghi → thấy thực tế">Kết cấu</TableHead>
                <TableHead title="Hệ thống ghi → thấy thực tế">Hiện trạng</TableHead>
                <TableHead align="center">Đã kiểm</TableHead>
                <TableHead>Ghi chú</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.lines.map((l) => (
                <TableRow key={l.id} className={cn(EDGE, !editable && cn("group/row", LIFT_ROW), changed(l) && "bg-warning-subtle/40")}>
                  <TableCell className="text-muted-foreground truncate font-mono text-xs">{l.code}</TableCell>
                  <TableCell className="truncate" title={l.buildingName ? `${l.name} — ${l.buildingName}` : l.name}>
                    {l.name}
                    {l.buildingName ? <span className="text-muted-foreground"> · {l.buildingName}</span> : null}
                  </TableCell>
                  <TableCell className="text-muted-foreground truncate text-sm">{l.typeName}</TableCell>
                  <TableCell className={editable ? "py-1" : undefined}>
                    {editable ? (
                      <FoundSelect label={`Kết cấu ${l.name}`} before={l.structureBefore} found={l.structureFound} labels={STRUCTURE_LABELS}
                        onChange={(v) => void save(l, { structureFound: v })} />
                    ) : (
                      <Change before={l.structureBefore} found={l.checked ? l.structureFound : null} labels={STRUCTURE_LABELS} />
                    )}
                  </TableCell>
                  <TableCell className={editable ? "py-1" : undefined}>
                    {editable ? (
                      <FoundSelect label={`Hiện trạng ${l.name}`} before={l.conditionBefore} found={l.conditionFound} labels={CONDITION_LABELS}
                        onChange={(v) => void save(l, { conditionFound: v })} />
                    ) : (
                      <Change before={l.conditionBefore} found={l.checked ? l.conditionFound : null} labels={CONDITION_LABELS} />
                    )}
                  </TableCell>
                  <TableCell align="center">
                    {editable ? (
                      <Checkbox aria-label={`Đã kiểm ${l.name}`} checked={l.checked} onCheckedChange={(on) => void save(l, { checked: on === true })} />
                    ) : l.checked ? (
                      <span className="text-success-text text-sm">Đã kiểm</span>
                    ) : (
                      <span className="text-muted-foreground text-sm">Chưa</span>
                    )}
                  </TableCell>
                  <TableCell className={editable ? "py-1" : "text-muted-foreground truncate"}>
                    {editable ? <NoteInput value={l.note} onSave={(v) => void save(l, { note: v })} /> : (l.note ?? "—")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <ConfirmContent
          title="Áp dụng kết quả vào hồ sơ CSVC?"
          description="Kết cấu, hiện trạng thấy thực tế được ghi vào hồ sơ khối nhà, phòng, hạng mục. Cán bộ áp dụng thì chờ lãnh đạo xác nhận."
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
