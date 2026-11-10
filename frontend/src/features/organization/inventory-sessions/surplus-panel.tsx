import { useInvalidate, useNotification } from "@refinedev/core";
import { Plus, Save, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

import { kyInstance } from "@/shared/api/data";
import { AsyncCombobox } from "@/shared/components/form/async-combobox";
import { StepTitle } from "@/shared/components/voucher/voucher-layout";
import { errorMessage } from "@/shared/lib/api-error";
import { Button } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import type { InventorySession } from "@/domains/inventory/types";

const RESOURCE = "inventory_sessions";

type Row = { catalog: string; catalogName?: string; name: string; quantity: number; note: string };

const GRID = "grid grid-cols-[2rem_minmax(12rem,2fr)_minmax(10rem,2fr)_6rem_minmax(10rem,2fr)_2.5rem] gap-x-2";

const toRows = (record: InventorySession): Row[] =>
  record.surplus.map((s) => ({ catalog: String(s.catalog.id), catalogName: s.catalog.name, name: s.name, quantity: s.quantity, note: s.note ?? "" }));

/** Lỗi đầu tiên của các dòng đã chọn thiết bị — cùng giới hạn với máy chủ. */
function rowError(r: Row): string | null {
  if (r.name.length > 255) return "Tên thực tế tối đa 255 ký tự";
  if (!Number.isInteger(r.quantity) || r.quantity < 1) return "Số lượng phải từ 1";
  if (r.quantity > 10000) return "Số lượng tối đa 10.000";
  if (r.note.length > 255) return "Ghi chú tối đa 255 ký tự";
  return null;
}

/** Tài sản thừa (KK-04): thấy thực tế mà sổ không có. Lưu cả danh sách một lần; dòng chưa chọn thiết bị bị bỏ. */
export function SurplusPanel({ record, editable }: { record: InventorySession; editable: boolean }) {
  const { open } = useNotification();
  const invalidate = useInvalidate();
  const [rows, setRows] = useState<Row[]>(() => toRows(record));
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setRows(toRows(record));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record.id, record.updatedAt, record.surplus]);

  async function save() {
    const picked = rows.filter((r) => r.catalog);
    const problem = picked.map(rowError).find(Boolean);
    if (problem) {
      open?.({ type: "error", message: problem });
      return;
    }
    setBusy(true);
    try {
      await kyInstance.patch(`${RESOURCE}/${record.id}`, {
        json: {
          surplus: picked.map((r) => ({
            catalog: { id: Number(r.catalog) }, name: r.name || null, quantity: Number(r.quantity) || 1, note: r.note || null,
          })),
        },
      });
      open?.({ type: "success", message: "Đã lưu danh sách tài sản thừa" });
      invalidate({ resource: RESOURCE, invalidates: ["detail", "list"], id: record.id });
    } catch (error) {
      open?.({ type: "error", message: await errorMessage(error) });
    } finally {
      setBusy(false);
    }
  }

  if (!editable && record.surplus.length === 0) return null;
  const update = (i: number, patch: Partial<Row>) => setRows((all) => all.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  return (
    <Card id="inventory-surplus" className="py-4">
      <CardContent className="space-y-3 px-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <StepTitle
            title="Tài sản thừa"
            aside={<span className="tabular-nums">{record.surplus.length} dòng</span>}
            hint="Có thật nhưng chưa có trên sổ"
          />
          {editable ? (
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setRows((r) => [...r, { catalog: "", name: "", quantity: 1, note: "" }])}>
                <Plus />
                Thêm dòng
              </Button>
              <Button type="button" size="sm" disabled={busy} onClick={() => void save()}>
                <Save />
                Lưu
              </Button>
            </div>
          ) : null}
        </div>
        {rows.length === 0 ? (
          <p className="text-muted-foreground rounded-md border border-dashed px-4 py-6 text-center text-sm">
            Chưa ghi tài sản thừa nào.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <div className="min-w-[44rem]">
              <div className={`bg-table-head text-overline text-table-head-text border-b px-3 py-2 ${GRID}`}>
                <span className="text-center">#</span>
                <span>Thiết bị (danh mục)</span>
                <span>Tên thực tế</span>
                <span className="pe-4 text-right">Số lượng</span>
                <span>Ghi chú</span>
                <span />
              </div>
              {rows.map((r, i) => (
                <div key={i} className={`items-center border-b px-3 py-2 text-sm last:border-b-0 ${GRID}`}>
                  <span className="text-muted-foreground text-center tabular-nums">{i + 1}</span>
                  {editable ? (
                    // Danh mục hơn một nghìn thiết bị: tìm ở máy chủ, không đổ sẵn cả danh sách.
                    <AsyncCombobox<{ id: number; code: string; name: string }>
                      resource="equipment_catalogs"
                      value={r.catalog ? Number(r.catalog) : null}
                      onChange={(id) => update(i, { catalog: id == null ? "" : String(id), catalogName: undefined })}
                      labelOf={(c) => `${c.code} · ${c.name}`}
                      fallbackLabel={r.catalogName}
                      placeholder="Vui lòng chọn thiết bị"
                      searchPlaceholder="Tìm theo mã hoặc tên…"
                    />
                  ) : (
                    <span className="truncate">{r.catalogName}</span>
                  )}
                  {editable ? (
                    <Input className="h-8" value={r.name} placeholder="= tên trong danh mục" maxLength={255} onChange={(e) => update(i, { name: e.target.value })} />
                  ) : (
                    <span className="truncate">{r.name || "—"}</span>
                  )}
                  {editable ? (
                    <Input className="h-8 text-right tabular-nums" type="number" min={1} value={r.quantity}
                      onChange={(e) => update(i, { quantity: Number(e.target.value) })} />
                  ) : (
                    <span className="pe-4 text-right tabular-nums">{r.quantity}</span>
                  )}
                  {editable ? (
                    <Input className="h-8" value={r.note} placeholder="Ghi chú" maxLength={255} onChange={(e) => update(i, { note: e.target.value })} />
                  ) : (
                    <span className="text-muted-foreground truncate">{r.note || "—"}</span>
                  )}
                  {editable ? (
                    <Button type="button" variant="ghost" size="icon-sm" aria-label="Xoá dòng"
                      className="text-muted-foreground hover:text-destructive" onClick={() => setRows((all) => all.filter((_, j) => j !== i))}>
                      <Trash2 />
                    </Button>
                  ) : <span />}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
