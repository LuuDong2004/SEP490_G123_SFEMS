import { useList, useNotification } from "@refinedev/core";
import { Loader2, Plus, Search } from "lucide-react";
import { useEffect, useState } from "react";

import { kyInstance } from "@/shared/api/data";
import { AsyncCombobox } from "@/shared/components/form/async-combobox";
import { errorMessage } from "@/shared/lib/api-error";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import type { RefValue } from "@/features/organization/equipment-intakes/fields";
import {
  ASSET_CATEGORY_LABELS,
  CATALOG_ORIGIN_LABELS,
  TRACKING_LABELS,
  type EquipmentCatalog,
} from "@/domains/equipment-catalog/types";

/** Thiết bị được chọn, đủ cho một dòng phiếu mới. */
export type PickedCatalog = {
  id: number;
  code: string | null;
  name: string;
  trackingType: "SERIAL" | "BULK";
  unit: { id: number; name: string } | null;
  physicalOrDigital: string | null;
};

const toPicked = (c: EquipmentCatalog): PickedCatalog => ({
  id: c.id,
  code: c.code,
  name: c.name,
  trackingType: c.trackingType,
  unit: c.unit ? { id: c.unit.id, name: c.unit.name } : null,
  physicalOrDigital: c.physicalOrDigital,
});

/**
 * "Chọn thiết bị từ danh mục" (PN-01 bước 3): tìm, tick nhiều thiết bị, chọn phòng nhận chung, bấm Thêm.
 * Danh mục máy chủ trả về đã gồm thiết bị của Sở và thiết bị riêng của trường mình. Không thấy thì
 * "Thêm thiết bị ngoài danh mục" (luồng 3a).
 */
export function CatalogPicker({ open, onOpenChange, onAdd }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (items: PickedCatalog[], room: RefValue) => void;
}) {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<Map<number, PickedCatalog>>(new Map());
  const [room, setRoom] = useState<RefValue>({ id: null });
  const [offCatalog, setOffCatalog] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setQuery(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => {
    if (!open) {
      setSearch("");
      setPicked(new Map());
      setRoom({ id: null });
    }
  }, [open]);

  const { result, query: list } = useList<EquipmentCatalog>({
    resource: "equipment_catalogs",
    pagination: { pageSize: 30 },
    filters: query ? [{ field: "q", operator: "eq", value: query }] : [],
    sorters: [{ field: "name", order: "asc" }],
    queryOptions: { enabled: open },
  });
  const rows = (result?.data ?? []).filter((c) => c.active !== false);

  const toggle = (c: EquipmentCatalog) =>
    setPicked((prev) => {
      const next = new Map(prev);
      if (next.has(c.id)) next.delete(c.id);
      else next.set(c.id, toPicked(c));
      return next;
    });

  const add = (items: PickedCatalog[]) => {
    onAdd(items, room);
    onOpenChange(false);
  };

  return (
    <>
      <Dialog open={open && !offCatalog} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Chọn thiết bị từ danh mục</DialogTitle>
            <DialogDescription>Tick một hoặc nhiều thiết bị; mỗi thiết bị thành một dòng của phiếu.</DialogDescription>
          </DialogHeader>
          <div className="relative">
            <Search className="text-muted-foreground absolute top-2.5 left-2.5 size-4" />
            <Input autoFocus className="pl-8" placeholder="Tìm theo mã, tên thiết bị" value={search}
              onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="max-h-80 min-h-40 overflow-y-auto rounded-md border">
            {list.isLoading ? (
              <div className="text-muted-foreground flex h-40 items-center justify-center gap-2 text-sm">
                <Loader2 className="size-4 animate-spin" /> Đang tải
              </div>
            ) : rows.length === 0 ? (
              <p className="text-muted-foreground px-4 py-10 text-center text-sm">
                Không thấy thiết bị nào. Có thể thêm thiết bị ngoài danh mục.
              </p>
            ) : (
              <ul className="divide-y">
                {rows.map((c) => (
                  <li key={c.id}>
                    <label className="hover:bg-muted/60 flex cursor-pointer items-start gap-3 px-3 py-2">
                      <Checkbox className="mt-0.5" checked={picked.has(c.id)} onCheckedChange={() => toggle(c)} />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2 text-sm font-medium">
                          {c.name}
                          {c.ownerSchool ? <Badge variant="outline">Của trường</Badge> : null}
                        </span>
                        <span className="text-muted-foreground block text-xs">
                          {[c.code, c.unit?.name, TRACKING_LABELS[c.trackingType]?.split(",")[0], c.subject?.name]
                            .filter(Boolean).join(" · ")}
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="grid gap-1.5">
            <Label>Phòng nhận cho các dòng này</Label>
            <AsyncCombobox<{ id: number; code?: string | null; name: string }>
              resource="rooms"
              value={room.id}
              fallbackLabel={room.name}
              clearable
              clearLabel="Kho"
              onChange={(id) => setRoom(id == null ? { id: null } : { ...room, id })}
              onPick={(item) => setRoom({ id: item.id, name: item.name, code: item.code ?? null })}
              labelOf={(item) => (item.code ? `${item.code} · ${item.name}` : item.name)}
              placeholder="Trống = nhập kho"
            />
          </div>
          <DialogFooter className="sm:justify-between">
            <Button type="button" variant="ghost" onClick={() => setOffCatalog(true)}>
              <Plus />
              Thêm thiết bị ngoài danh mục
            </Button>
            <Button type="button" disabled={picked.size === 0} onClick={() => add([...picked.values()])}>
              {picked.size ? `Thêm ${picked.size} thiết bị` : "Thêm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <OffCatalogDialog
        open={open && offCatalog}
        onOpenChange={(o) => setOffCatalog(o)}
        onCreated={(c) => {
          setOffCatalog(false);
          add([...picked.values(), toPicked(c)]);
        }}
      />
    </>
  );
}

type Ref = { id: number | null; name?: string | null };

/**
 * Thêm thiết bị ngoài danh mục (PN-01 luồng 3a): thiết bị riêng của trường, lưu vào danh mục của trường
 * (`POST /equipment_catalogs/school-items`) rồi thành một dòng của phiếu. Trùng tên với danh mục của Sở
 * hoặc của trường thì máy chủ từ chối (MSG30).
 */
function OffCatalogDialog({ open, onOpenChange, onCreated }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (item: EquipmentCatalog) => void;
}) {
  const { open: notify } = useNotification();
  const [name, setName] = useState("");
  const [type, setType] = useState<Ref>({ id: null });
  const [unit, setUnit] = useState<Ref>({ id: null });
  const [subject, setSubject] = useState<Ref>({ id: null });
  const [category, setCategory] = useState("");
  const [origin, setOrigin] = useState("");
  const [tracking, setTracking] = useState("SERIAL");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(""); setType({ id: null }); setUnit({ id: null }); setSubject({ id: null });
      setCategory(""); setOrigin(""); setTracking("SERIAL"); setError(null);
    }
  }, [open]);

  const ready = name.trim() && type.id && unit.id && category && origin;
  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const created = await kyInstance.post("equipment_catalogs/school-items", {
        json: {
          name: name.trim(),
          equipmentType: { id: type.id },
          unit: { id: unit.id },
          subject: subject.id ? { id: subject.id } : null,
          assetCategory: category,
          origin,
          trackingType: tracking,
        },
      }).json<EquipmentCatalog>();
      notify?.({ type: "success", message: `Đã thêm "${created.name}" vào danh mục của trường` });
      onCreated(created);
    } catch (e) {
      setError(await errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const combo = (resource: string, value: Ref, set: (r: Ref) => void, placeholder: string, clearable = false) => (
    <AsyncCombobox<{ id: number; code?: string | null; name: string }>
      resource={resource}
      value={value.id}
      fallbackLabel={value.name}
      clearable={clearable}
      onChange={(id) => set(id == null ? { id: null } : { ...value, id })}
      onPick={(item) => set({ id: item.id, name: item.name })}
      labelOf={(item) => item.name}
      placeholder={placeholder}
    />
  );
  const select = (value: string, set: (v: string) => void, labels: Record<string, string>, placeholder: string) => (
    <Select value={value} onValueChange={(v) => v && set(v)}>
      <SelectTrigger className="w-full"><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>
        {Object.entries(labels).map(([k, label]) => <SelectItem key={k} value={k}>{label}</SelectItem>)}
      </SelectContent>
    </Select>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Thêm thiết bị ngoài danh mục</DialogTitle>
          <DialogDescription>Thiết bị riêng của trường; sau này chọn lại được ở các phiếu khác.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5 sm:col-span-2">
            <Label>Tên thiết bị</Label>
            <Input value={name} maxLength={255} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid gap-1.5"><Label>Loại thiết bị</Label>{combo("equipment_types", type, setType, "Chọn loại")}</div>
          <div className="grid gap-1.5"><Label>Đơn vị tính</Label>{combo("units", unit, setUnit, "Chọn đơn vị")}</div>
          <div className="grid gap-1.5"><Label>Nguồn gốc</Label>{select(origin, setOrigin, CATALOG_ORIGIN_LABELS, "Chọn nguồn gốc")}</div>
          <div className="grid gap-1.5"><Label>Phân loại tài sản</Label>{select(category, setCategory, ASSET_CATEGORY_LABELS, "Chọn phân loại")}</div>
          <div className="grid gap-1.5"><Label>Cách quản lý</Label>{select(tracking, setTracking, TRACKING_LABELS, "Chọn")}</div>
          <div className="grid gap-1.5"><Label>Môn học</Label>{combo("subjects", subject, setSubject, "Trống = dùng chung", true)}</div>
        </div>
        {error ? <p className="text-destructive text-sm">{error}</p> : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Quay lại</Button>
          <Button type="button" disabled={!ready || busy} onClick={() => void save()}>
            {busy ? <Loader2 className="animate-spin" /> : null}
            Thêm vào phiếu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
