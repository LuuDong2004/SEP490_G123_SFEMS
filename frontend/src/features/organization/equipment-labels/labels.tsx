import { useList, useNotification } from "@refinedev/core";
import { PackagePlus, Printer, Trash2, X } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";

import { kyInstance } from "@/shared/api/data";
import { getAuthorities } from "@/shared/api/session";
import { AsyncCombobox } from "@/shared/components/form/async-combobox";
import { ListView, ListViewHeader } from "@/shared/components/views/list-view";
import { EquipmentPickerDialog } from "@/shared/components/voucher/equipment-lines-field";
import { errorMessage } from "@/shared/lib/api-error";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Checkbox } from "@/shared/ui/checkbox";
import { Label } from "@/shared/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { ASSET_STATUS_LABELS, OFF_BOOK_STATUSES } from "@/domains/equipment/types";

type LabelRow = {
  id: number;
  code: string;
  name: string;
  school?: { name: string } | null;
  room?: { id?: number; name: string } | null;
  status?: string;
};

/** Tem chỉ dán lên thứ còn trên sổ — đã thanh lý, đã mất, đã dùng hết thì không in. */
const PRINTABLE = Object.keys(ASSET_STATUS_LABELS).filter((s) => !OFF_BOOK_STATUSES.includes(s));
/** Một lần thêm cả phòng / cả phiếu lấy tối đa ngần này tài sản. */
const BATCH = 500;

/** Ba cỡ tem: số cột trên khổ A4 đứng và cỡ mã QR. */
const SIZES = {
  small: { label: "Nhỏ · 4 cột", cols: "grid-cols-4", qr: 56, code: "text-[0.625rem]", name: "text-[0.5625rem]" },
  medium: { label: "Vừa · 3 cột", cols: "grid-cols-3", qr: 76, code: "text-xs", name: "text-[0.625rem]" },
  large: { label: "Lớn · 2 cột", cols: "grid-cols-2", qr: 104, code: "text-sm", name: "text-xs" },
} as const;
type Size = keyof typeof SIZES;

/** Đường dẫn mà tem trỏ tới: quét bằng điện thoại là mở thẳng màn tra cứu của tài sản đó. */
export function lookupUrl(code: string) {
  return `${window.location.origin}/equipment-lookup?code=${encodeURIComponent(code)}`;
}

/**
 * In tem mã QR cho tài sản.
 *
 * <p>Màn là TỜ TEM đang soạn: thêm tài sản bằng hộp chọn dùng chung của các phiếu (tìm, lọc trạng thái - vị trí
 * - loại, phân trang ở máy chủ) hoặc thêm cả một phòng, bỏ từng tem, chọn cỡ tem và thứ in trên tem; trang
 * giấy bên dưới là đúng thứ sẽ ra máy in. Mở từ một phiếu ghi tăng ({@code ?intake=}) hoặc một phòng
 * ({@code ?room=}) thì tờ tem có sẵn tài sản của phiếu / phòng đó.
 *
 * <p>Tem mang mã bằng chữ VÀ bằng QR. QR trỏ về màn tra cứu của chính hệ thống, nên điện thoại nào cũng quét
 * được, và người không có quyền xem thiết bị thì quét xong chỉ gặp màn đăng nhập.
 */
export const EquipmentLabels = () => {
  const [params] = useSearchParams();
  const { open: notify } = useNotification();
  const ownSchool = getAuthorities()?.schoolId ?? null;
  const [pickedSchool, setPickedSchool] = useState<number | null>(null);
  const schoolId = ownSchool ?? pickedSchool;

  const [rows, setRows] = useState<LabelRow[]>([]);
  const [picker, setPicker] = useState(false);
  const [busy, setBusy] = useState(false);
  const [size, setSize] = useState<Size>("medium");
  const [withSchool, setWithSchool] = useState(true);
  const [withRoom, setWithRoom] = useState(true);

  const { result: rooms } = useList<{ id: number; name: string }>({
    resource: "rooms",
    filters: [{ field: "school.id", operator: "eq", value: schoolId }],
    pagination: { currentPage: 1, pageSize: 500 },
    sorters: [{ field: "name", order: "asc" }],
    queryOptions: { enabled: !!schoolId },
  });

  const add = (more: LabelRow[]) =>
    setRows((prev) => {
      const have = new Set(prev.map((r) => r.id));
      return [...prev, ...more.filter((r) => !have.has(r.id))];
    });

  /** Thêm mọi tài sản khớp một bộ lọc (cả phòng, cả phiếu ghi tăng), xếp theo mã. */
  async function addAll(filter: Record<string, string | number>, what: string, empty = `${what} chưa có thiết bị nào`) {
    setBusy(true);
    try {
      const found = await kyInstance
        .get("equipment", { searchParams: { ...filter, status: PRINTABLE.join(","), _start: 0, _end: BATCH, _sort: "code", _order: "asc" } })
        .json<LabelRow[]>()
        // Hỏi theo id thì máy chủ trả thẳng bản ghi, bỏ qua bộ lọc trạng thái — lọc lại ở đây.
        .then((list) => list.filter((r) => !r.status || PRINTABLE.includes(r.status)));
      add(found);
      if (found.length === 0) notify?.({ type: "error", message: empty });
    } catch (error) {
      notify?.({ type: "error", message: await errorMessage(error) });
    } finally {
      setBusy(false);
    }
  }

  // Mở từ phiếu ghi tăng / từ một phòng / từ hồ sơ một tài sản: tờ tem có sẵn tài sản của nơi đó.
  const intake = params.get("intake");
  const room = params.get("room");
  const equipment = params.get("equipment");
  useEffect(() => {
    if (intake) void addAll({ "intake.id": intake }, "Phiếu ghi tăng này");
    else if (room) void addAll({ "room.id": room }, "Phòng này");
    else if (equipment) {
      // Một hay nhiều tài sản (chọn nhiều ở bảng Theo tài sản): `equipment=12,13,14`.
      const ids = equipment.split(",").filter(Boolean);
      void addAll(Object.fromEntries(ids.map((id, i) => [`ids[${i}]`, id])),
        ids.length > 1 ? `${ids.length} thiết bị đã chọn` : "Thiết bị này",
        ids.length > 1 ? "Các thiết bị đã chọn đều đã ra khỏi hệ thống, không in tem" : "Thiết bị này đã ra khỏi hệ thống, không in tem");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intake, room, equipment]);

  const s = SIZES[size];

  return (
    <ListView>
      <ListViewHeader
        actions={
          <Button type="button" onClick={() => window.print()} disabled={rows.length === 0}>
            <Printer />
            In {rows.length > 0 ? `${rows.length} tem` : "tem"}
          </Button>
        }
      />

      <Card data-print="hide" className="flex-row flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3">
        {ownSchool == null ? (
          <div className="w-64">
            <AsyncCombobox<{ id: number; name: string }>
              resource="schools"
              value={pickedSchool}
              onChange={(id) => {
                setPickedSchool(id);
                setRows([]);
              }}
              labelOf={(x) => x.name}
              placeholder="Vui lòng chọn trường"
              searchPlaceholder="Tìm trường…"
            />
          </div>
        ) : null}
        <Button type="button" variant="outline" disabled={!schoolId} onClick={() => setPicker(true)}>
          <PackagePlus />
          Thêm thiết bị
        </Button>
        {/* Thêm cả phòng: việc hay làm nhất — dán tem cho một phòng một lượt. */}
        <Select value="" disabled={!schoolId || busy} onValueChange={(id) => void addAll({ "school.id": schoolId as number, "room.id": id }, "Phòng này")}>
          <SelectTrigger className="w-48" aria-label="Thêm cả phòng">
            <SelectValue placeholder="Thêm cả phòng…" />
          </SelectTrigger>
          <SelectContent className="max-h-64">
            {(rooms?.data ?? []).map((r) => (
              <SelectItem key={r.id} value={String(r.id)}>
                {r.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="ms-auto flex flex-wrap items-center gap-x-4 gap-y-2">
          <Select value={size} onValueChange={(v) => setSize(v as Size)}>
            <SelectTrigger className="w-36" aria-label="Cỡ tem">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(SIZES).map(([key, v]) => (
                <SelectItem key={key} value={key}>
                  {v.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <Checkbox id="label-school" checked={withSchool} onCheckedChange={(c) => setWithSchool(c === true)} />
            <Label htmlFor="label-school">Tên trường</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="label-room" checked={withRoom} onCheckedChange={(c) => setWithRoom(c === true)} />
            <Label htmlFor="label-room">Vị trí</Label>
          </div>
          {rows.length ? (
            <Button type="button" variant="ghost" onClick={() => setRows([])}>
              <Trash2 />
              Bỏ hết
            </Button>
          ) : null}
        </div>
      </Card>

      {rows.length === 0 ? (
        <Card data-print="hide" className="text-muted-foreground px-4 py-14 text-center text-sm">
          {busy ? "Đang lấy thiết bị…" : schoolId ? "Tờ tem đang trống. Thêm thiết bị hoặc thêm cả một phòng để in." : "Chọn trường để bắt đầu."}
        </Card>
      ) : (
        // Trang giấy: trên màn hình là tờ A4 trắng có bóng; lúc in chỉ còn lưới tem.
        <div className="shadow-e2 mx-auto w-full max-w-[210mm] rounded-md border bg-white p-[8mm] text-black print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none">
          <div className={cn("grid gap-[2mm]", s.cols)}>
            {rows.map((row) => (
              <div key={row.id} className="group relative flex break-inside-avoid items-center gap-2 rounded border border-neutral-300 p-[2mm]">
                <QRCodeSVG value={lookupUrl(row.code)} size={s.qr} level="M" className="shrink-0" />
                <div className="min-w-0 space-y-0.5">
                  <div className={cn("font-mono leading-tight font-semibold break-all", s.code)}>{row.code}</div>
                  <div className={cn("line-clamp-2 leading-tight", s.name)}>{row.name}</div>
                  {(withSchool && row.school?.name) || withRoom ? (
                    <div className="truncate text-[0.5rem] leading-tight text-neutral-600">
                      {[withSchool ? row.school?.name : null, withRoom ? (row.room?.name ?? "Kho") : null].filter(Boolean).join(" · ")}
                    </div>
                  ) : null}
                </div>
                <button
                  type="button"
                  data-print="hide"
                  onClick={() => setRows((prev) => prev.filter((r) => r.id !== row.id))}
                  title="Bỏ tem này"
                  className="absolute top-0.5 right-0.5 hidden rounded bg-white p-0.5 text-neutral-500 group-hover:block hover:text-red-600"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <EquipmentPickerDialog skipHolds
        open={picker}
        onOpenChange={setPicker}
        schoolId={schoolId}
        statuses={PRINTABLE}
        exclude={new Set(rows.map((r) => r.id))}
        allowIncomplete
        addedLabel="Đã có trên tờ tem"
        onPick={(picked) => {
          add(picked as LabelRow[]);
          setPicker(false);
        }}
      />
    </ListView>
  );
};
