import { useInvalidate, useSelect } from "@refinedev/core";
import { Plus } from "lucide-react";
import { useState } from "react";

import { kyInstance } from "@/shared/api/data";
import { errorMessage } from "@/shared/lib/api-error";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { FACILITY_KIND_LABELS, type FacilityKind, type RoomTypeRecord } from "@/domains/facility/catalog";

/**
 * Trường thêm một loại CSVC NGOÀI DANH MỤC (QLTB-629) ngay trên form phòng: loại chỉ trường này dùng, không vào
 * danh mục chuẩn của Sở. Thêm xong thì chọn luôn loại đó cho phòng.
 */
export function CustomRoomTypeButton({ schoolId, onCreated }: { schoolId?: number | null; onCreated: (t: RoomTypeRecord) => void }) {
  const invalidate = useInvalidate();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [group, setGroup] = useState("");
  const [kind, setKind] = useState<FacilityKind>("ROOM");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const { options } = useSelect({
    resource: "facility_groups",
    optionLabel: "name",
    optionValue: "id",
    sorters: [{ field: "sortOrder", order: "asc" }],
    filters: [{ field: "active", operator: "eq", value: true }],
    pagination: { pageSize: 100 },
    queryOptions: { enabled: open },
  });

  async function save() {
    setBusy(true);
    setProblem(null);
    try {
      const created = await kyInstance.post("rooms/custom-types", {
        json: { schoolId: schoolId ?? null, name: name.trim(), groupId: group ? Number(group) : null, kind },
      }).json<RoomTypeRecord>();
      await invalidate({ resource: "room_types", invalidates: ["list", "many"] });
      onCreated(created);
      setOpen(false);
    } catch (error) {
      setProblem(await errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" className="text-primary inline-flex items-center gap-1 text-xs font-medium hover:underline"
        onClick={() => { setName(""); setGroup(""); setKind("ROOM"); setProblem(null); setOpen(true); }}>
        <Plus className="size-3.5" />
        Loại ngoài danh mục
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Thêm loại ngoài danh mục</DialogTitle>
            <DialogDescription>Chỉ trường này dùng. Danh mục chuẩn của Sở không đổi.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
            <div className="grid gap-2">
              <Label htmlFor="custom-type-name">Tên loại</Label>
              <Input id="custom-type-name" value={name} maxLength={255} placeholder="Phòng STEM"
                onChange={(e) => setName(e.target.value)} />
            </div>
            {/* Khối và Dạng cùng một hàng — ba ô ngắn xếp dọc trải hết bề ngang chỉ để lại khoảng trống. */}
            <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid min-w-0 gap-2">
              <Label>Khối</Label>
              <Select value={group} onValueChange={setGroup}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Vui lòng chọn khối" /></SelectTrigger>
                <SelectContent>
                  {(options ?? []).map((o: { label: string; value: unknown }) => (
                    <SelectItem key={String(o.value)} value={String(o.value)}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid min-w-0 gap-2">
              <Label>Dạng</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as FacilityKind)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(FACILITY_KIND_LABELS) as FacilityKind[]).map((k) => (
                    <SelectItem key={k} value={k}>{FACILITY_KIND_LABELS[k]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            </div>
            {problem ? <p role="alert" className="text-destructive-text text-xs">{problem}</p> : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Đóng</Button>
            <Button type="button" disabled={busy || !name.trim() || !group} onClick={() => void save()}>
              {busy ? "Đang lưu…" : "Thêm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
