import { useCan, useInvalidate, useList, useNotification, type CrudFilter } from "@refinedev/core";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useForm, useWatch } from "react-hook-form";

import { kyInstance } from "@/shared/api/data";
import { errorMessage } from "@/shared/lib/api-error";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Form } from "@/shared/ui/form";
import { Label } from "@/shared/ui/label";
import { CatalogFormDialog, CatalogShowDialog } from "@/shared/components/catalog/pages";
import type { CatalogConfig, CatalogExtra } from "@/shared/components/catalog/types";
import type { FormDialogState } from "@/shared/components/catalog/form-dialog";
import { DateField, SelectField, TextField } from "@/shared/components/form/simple-fields";
import { FACILITY_WORK_TYPE_LABELS } from "@/domains/facility/types";
import { Plus, Wrench } from "lucide-react";
import { formatPlainDate } from "@/shared/lib/format";
import { CompactSection } from "@/features/organization/resources/compact-section";
import { PlaceFields, REPAIR_FUNDING_OPTIONS, endNotBeforeStart, fixedPlaceWorkFields, workPlace } from "@/features/organization/resources/work-extra";

/* eslint-disable @typescript-eslint/no-explicit-any */

type Level = "room" | "building" | "campus";

const TYPE_OPTIONS = Object.entries(FACILITY_WORK_TYPE_LABELS).map(([value, label]) => ({ value, label }));

/** Vị trí điền sẵn khi ghi sửa chữa TỪ hồ sơ một phòng / khối nhà / cơ sở — đủ cả các tầng bên trên. */
function placeOf(level: Level, record: any) {
  const id = (v: any) => ({ id: v?.id ?? null });
  if (level === "room") return { room: id(record), building: id(record.building), campus: id(record.campus) };
  if (level === "building") return { room: { id: null }, building: id(record), campus: id(record.campus) };
  return { room: { id: null }, building: { id: null }, campus: id(record) };
}

/**
 * Lịch sử sửa chữa, cải tạo NGAY TRONG hồ sơ phòng, khối nhà, cơ sở (QLTB-473), cùng nút "Ghi sửa chữa"
 * điền sẵn chỗ đang xem (QLTB-469) — không phải về Tổng quan trường, mở "Lịch sử sửa chữa" rồi mới ghi
 * được. Khối nhà gồm cả việc của các phòng trong nó (máy chủ tự điền khối nhà khi chọn phòng), cơ sở
 * cũng vậy.
 */
const money = new Intl.NumberFormat("vi-VN");

/**
 * Một lần sửa chữa thành một dòng gọn: tên việc; mã · loại · (vị trí) · ngày xong; chi phí. Dùng cho khối lịch sử
 * trong hồ sơ phòng / khối nhà / cơ sở và hộp "Lịch sử sửa chữa" của Tổng quan trường. Không ô tìm: vài năm mới
 * sửa một lần, danh sách luôn ngắn.
 */
export const workRow = (showPlace: boolean) => (r: any) => ({
  title: r.name,
  meta: [r.code, FACILITY_WORK_TYPE_LABELS[r.workType], showPlace ? workPlace(r) : null,
    r.endDate ? `xong ${formatPlainDate(r.endDate)}` : "đang làm"].filter(Boolean).join(" · "),
  aside: r.cost != null ? `${money.format(r.cost)} đ` : null,
});

/** Dòng vị trí của chỗ đang xem: "Cơ sở chính › Nhà B › Phòng mỹ thuật". */
function placeText(level: Level, record: any) {
  if (level === "room") return [record?.campus?.name, record?.building?.name, record?.name].filter(Boolean).join(" › ");
  if (level === "building") return [record?.campus?.name, record?.name].filter(Boolean).join(" › ");
  return record?.name ?? "";
}

function WorkHistory({ level, record, config }: { level: Level; record: any; config: CatalogConfig }) {
  const mayCreate = useCan({ resource: "facility_works", action: "create" }).data?.can ?? false;
  const [form, setForm] = useState<FormDialogState>({ open: false });
  const [viewing, setViewing] = useState<number | null>(null);
  const place = placeText(level, record);
  // Ghi / sửa từ hồ sơ chỗ này: vị trí cố định, form không hiện ba ô Cơ sở / Khối nhà / Phòng.
  const fixedConfig = useMemo<CatalogConfig>(() => ({
    ...config,
    extra: config.extra ? { ...config.extra, Fields: fixedPlaceWorkFields(place) } : config.extra,
  }), [config, place]);
  const schoolId = record?.school?.id;
  if (!record?.id || !schoolId) return null;
  const filters: CrudFilter[] = [
    { field: "school.id", operator: "eq", value: schoolId },
    { field: `${level}.id`, operator: "eq", value: record.id },
  ];
  return (
    <>
      <CompactSection title="Lịch sử sửa chữa, cải tạo" resource="facility_works" filters={filters}
        sorters={[{ field: "id", order: "desc" }]}
        emptyText="Chưa ghi lần sửa chữa, cải tạo nào."
        emptyIcon={<Wrench />}
        action={mayCreate ? (
          <Button type="button" variant="outline" size="sm" onClick={() => setForm({ open: true })}>
            <Plus />
            Ghi sửa chữa
          </Button>
        ) : null}
        onOpen={(r) => setViewing(r.id)}
        // Hồ sơ phòng không cần nhắc lại vị trí; khối nhà / cơ sở thì nói việc ở phòng nào.
        row={workRow(level !== "room")} />
      <CatalogFormDialog config={fixedConfig} state={form} onOpenChange={(open) => setForm((d) => ({ ...d, open }))}
        presets={{ school: { id: schoolId }, ...placeOf(level, record) }} />
      <CatalogShowDialog config={config} id={viewing} onOpenChange={(open) => !open && setViewing(null)}
        onEdit={(id) => {
          setViewing(null);
          setForm({ open: true, id });
        }} />
    </>
  );
}

/** Gắn khối lịch sử sửa chữa vào trước phần `ShowBelow` sẵn có (tệp đính kèm) của phòng, khối nhà, cơ sở. */
export function withWorkHistory(level: Level, config: CatalogConfig, below?: (props: { record: any }) => ReactNode) {
  // Đã bọc rồi (registry chạy lại — vd. Vite nạp lại module) thì giữ nguyên, không lồng thêm một khối lịch sử nữa.
  if (below && (below as { withWorks?: boolean }).withWorks) return below;
  const Below = below;
  const wrapped = function FacilityShowBelow({ record }: { record: any }) {
    return (
      <div className="space-y-5">
        <WorkHistory level={level} record={record} config={config} />
        {Below ? <Below record={record} /> : null}
      </div>
    );
  };
  return Object.assign(wrapped, { withWorks: true });
}

/** Tab "Lịch sử sửa chữa" của hộp xem phòng / khối nhà / cơ sở — đứng trước tab tệp. */
export function withWorkHistoryTab(level: Level, config: CatalogConfig, tabs: NonNullable<CatalogExtra["ShowTabs"]> = []) {
  const tab = {
    key: "works",
    label: "Lịch sử sửa chữa",
    Content: function WorksTab({ record }: { record: any }) {
      return <WorkHistory level={level} record={record} config={config} />;
    },
  };
  // Chỉ gắn một lần: registry chạy lại thì tab đã có — hai tab trùng khoá `works` làm một tab hiện hai khối lịch sử.
  if (tabs.some((t) => t.key === "works")) return tabs;
  const files = tabs.findIndex((t) => t.key === "files");
  return files < 0 ? [...tabs, tab] : [...tabs.slice(0, files), tab, ...tabs.slice(files)];
}

const NO_ROOMS: any[] = [];

const EMPTY = {
  name: "",
  workType: "REPAIR",
  campus: { id: null },
  building: { id: null },
  room: { id: null },
  startDate: null,
  endDate: null,
  cost: null,
  fundingSource: null,
  contractor: "",
};

/**
 * "Ghi nhanh" (QLTB-472): trường hay sửa một loạt phòng cùng lúc (sơn lại cả dãy nhà A) — chọn khối nhà, tích
 * các phòng được làm, khai nội dung một lần. Mỗi phòng thành một bản ghi riêng (`POST /facility_works/bulk`)
 * để hồ sơ từng phòng có đủ lịch sử; không tích phòng nào là một bản ghi cho cả khối nhà (hoặc cơ sở, cả trường).
 */
export function QuickWorkDialog({ schoolId, open, onOpenChange }: { schoolId: number; open: boolean; onOpenChange: (o: boolean) => void }) {
  const form = useForm<any>({ defaultValues: { ...EMPTY, school: { id: schoolId } } });
  const { open: notify } = useNotification();
  const invalidate = useInvalidate();
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const campusId = useWatch({ control: form.control, name: "campus.id" });
  const buildingId = useWatch({ control: form.control, name: "building.id" });

  useEffect(() => {
    if (!open) return;
    form.reset({ ...EMPTY, school: { id: schoolId } });
    setPicked(new Set());
    setError(null);
  }, [open, schoolId, form]);

  // Phòng để tích: của khối nhà đang chọn, không thì của cơ sở. Chưa chọn chỗ nào thì không liệt kê cả trường.
  const scope: CrudFilter[] = buildingId
    ? [{ field: "building.id", operator: "eq", value: buildingId }]
    : campusId ? [{ field: "campus.id", operator: "eq", value: campusId }] : [];
  const { result } = useList<any>({
    resource: "rooms",
    filters: [{ field: "school.id", operator: "eq", value: schoolId }, ...scope],
    pagination: { pageSize: 200 },
    sorters: [{ field: "sortOrder", order: "asc" }],
    queryOptions: { enabled: open && scope.length > 0 },
  });
  const rooms: any[] = useMemo(() => (scope.length && result?.data ? result.data : NO_ROOMS), [result, scope.length]);
  // Đổi khối nhà / cơ sở là đổi danh sách phòng: bỏ các phòng đã tích không còn trong đó.
  useEffect(() => {
    setPicked((p) => {
      const kept = [...p].filter((id) => rooms.some((r: any) => r.id === id));
      return kept.length === p.size ? p : new Set(kept);
    });
  }, [rooms]);

  const toggle = (id: number) => setPicked((p) => {
    const n = new Set(p);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    return n;
  });
  const allPicked = rooms.length > 0 && rooms.every((r: any) => picked.has(r.id));
  const where = buildingId ? "cả khối nhà" : campusId ? "cả cơ sở" : "cả trường";

  async function submit(values: any) {
    setError(null);
    try {
      const work = { ...values, code: null, room: { id: null }, school: { id: schoolId } };
      const created: any[] = await kyInstance
        .post("facility_works/bulk", { json: { work, rooms: [...picked].map((id) => ({ id })) } })
        .json();
      notify?.({ type: "success", message: created.length > 1 ? `Đã ghi ${created.length} phòng` : "Đã ghi sửa chữa" });
      await invalidate({ resource: "facility_works", invalidates: ["list"] });
      onOpenChange(false);
    } catch (e) {
      setError(await errorMessage(e));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Ghi nhanh sửa chữa, cải tạo</DialogTitle>
          <DialogDescription className="sr-only">
            Chọn khối nhà rồi tích các phòng được làm — mỗi phòng một dòng trong lịch sử. Không tích phòng nào là ghi cho {where}.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(submit)} className="space-y-5">
            <div className="@container grid items-start gap-x-4 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
              <TextField control={form.control} name="name" label="Nội dung công việc" className="sm:col-span-2"
                placeholder="VD: Sơn lại tường, chống thấm" rules={{ required: "Nhập nội dung công việc" }} rule="SHORT_TEXT" />
              <SelectField control={form.control} name="workType" label="Loại công việc" options={TYPE_OPTIONS} />
              <PlaceFields control={form.control} rooms={false} />
            </div>
            {scope.length ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label>Phòng được làm {picked.size ? <span className="text-muted-foreground font-normal">· đã chọn {picked.size}</span> : null}</Label>
                  {rooms.length ? (
                    <Button type="button" variant="ghost" size="sm" onClick={() => setPicked(allPicked ? new Set() : new Set(rooms.map((r: any) => r.id)))}>
                      {allPicked ? "Bỏ chọn tất cả" : "Chọn tất cả"}
                    </Button>
                  ) : null}
                </div>
                {rooms.length ? (
                  <div className="grid max-h-56 gap-1 overflow-y-auto rounded-md border p-2 sm:grid-cols-3">
                    {rooms.map((r: any) => (
                      <label key={r.id} className="hover:bg-muted flex min-w-0 cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm">
                        <Checkbox checked={picked.has(r.id)} onCheckedChange={() => toggle(r.id)} />
                        <span className="truncate">{r.name}</span>
                        <span className="text-muted-foreground ms-auto shrink-0 text-xs">{r.code}</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground rounded-md border border-dashed p-3 text-sm">Chưa có phòng nào ở đây.</p>
                )}
              </div>
            ) : null}
            <div className="grid items-start gap-x-4 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
              <DateField control={form.control} name="startDate" label="Ngày bắt đầu" />
              <DateField control={form.control} name="endDate" label="Ngày hoàn thành" description="Để trống nếu đang làm."
          rules={{ validate: { range: endNotBeforeStart } }} />
              <TextField control={form.control} name="cost" label={picked.size > 1 ? "Chi phí mỗi phòng (đ)" : "Chi phí (đ)"} type="money" />
              <SelectField control={form.control} name="fundingSource" label="Nguồn kinh phí" options={REPAIR_FUNDING_OPTIONS}
                placeholder="Vui lòng chọn nguồn kinh phí" />
              <TextField control={form.control} name="contractor" label="Đơn vị thực hiện" className="sm:col-span-2" placeholder="Nhà thầu, tổ sửa chữa…" rule="SHORT_TEXT" />
            </div>
            {error ? <p className="text-destructive text-sm">{error}</p> : null}
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">Huỷ</Button>
              </DialogClose>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Đang lưu…" : picked.size > 1 ? `Ghi cho ${picked.size} phòng` : "Lưu"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
