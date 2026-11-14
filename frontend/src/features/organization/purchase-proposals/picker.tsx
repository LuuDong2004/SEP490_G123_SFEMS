import { useState } from "react";

import { CatalogPickerDialog } from "@/features/organization/equipment-intakes/catalog-picker";
import type { PickedCatalog } from "@/domains/equipment-catalog/types";
import { Segmented } from "@/shared/components/segmented";
import { Button } from "@/shared/ui/button";
import type { NormRow, SchoolAdequacy } from "@/domains/procurement/types";

import { AdequacyTable } from "./adequacy-table";
import { overlapQuantity, type OverlapIndex } from "./overlap";

/** Một thiết bị được chọn để thêm thành dòng đề xuất. */
export type PickedForProposal = { catalogId: number; label: string; quantity: number };

type Tab = "norm" | "catalog";

/**
 * Số lượng gợi ý cho thiết bị chọn theo định mức: phần còn thiếu trừ phần đã xin ở phiếu khác (số lớn hơn
 * giữa cột "Đề xuất" của bảng — không tính nháp — và các đề xuất còn hiệu lực khác — có tính nháp). Đã xin
 * đủ, hoặc chưa tính được số thiếu, thì 1: người lập chọn tức là muốn mua, sửa lại số ở dòng.
 */
function suggestedQuantity(row: NormRow, overlaps: OverlapIndex) {
  const proposed = Math.max(row.proposed, overlapQuantity(overlaps.get(row.catalogId!)));
  return Math.max((row.shortage ?? 0) - proposed, 1);
}

/**
 * Hộp "Chọn thiết bị cần mua" của đề xuất mua sắm — cùng khuôn với hộp chọn thiết bị của phiếu ghi tăng
 * (chính là hộp đó, thêm một tab). Tab "Theo định mức" là bảng định mức của trường, lọc sẵn "Còn thiếu",
 * tích nhiều thiết bị một lượt; tab "Toàn bộ danh mục" để mua thiết bị ngoài định mức (thay cái hỏng…).
 */
export function ProposalPickerDialog({ open, onOpenChange, schoolId, adequacy, overlaps, exclude, onPick }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schoolId: number | null;
  adequacy: SchoolAdequacy | undefined;
  overlaps: OverlapIndex;
  /** Thiết bị đã có dòng trên phiếu — vẫn hiện nhưng không tích được. */
  exclude: Set<number>;
  onPick: (rows: PickedForProposal[]) => void;
}) {
  const [tab, setTab] = useState<Tab>("norm");
  const [selected, setSelected] = useState<Map<number, NormRow>>(new Map());

  const close = (o: boolean) => {
    if (!o) {
      setSelected(new Map());
      setTab("norm");
    }
    onOpenChange(o);
  };

  const toggle = (row: NormRow) =>
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(row.catalogId!)) next.delete(row.catalogId!);
      else next.set(row.catalogId!, row);
      return next;
    });

  const confirmNorm = () => {
    onPick([...selected.values()].map((r) => ({
      catalogId: r.catalogId!,
      label: `${r.catalogCode} · ${r.normName}`,
      quantity: suggestedQuantity(r, overlaps),
    })));
    close(false);
  };

  const tabs = (
    <Segmented label="Nguồn thiết bị" value={tab} onChange={setTab}
      options={[{ value: "norm" as const, label: "Theo định mức", hint: "Thiết bị trường còn thiếu so với định mức" },
        { value: "catalog" as const, label: "Toàn bộ danh mục", hint: "Chọn bất kỳ thiết bị nào trong danh mục" }]} />
  );

  const normBody = (
    <>
      {/* Chiều cao cố định như tab danh mục: đổi tab không làm hộp co giãn. */}
      <div className="h-[min(32rem,60vh)] overflow-y-auto pe-1">
        <AdequacyTable
          data={adequacy}
          collapsed
          select={{
            selected: new Set(selected.keys()),
            onToggle: toggle,
            disabled: (r) => (exclude.has(r.catalogId!) ? "Phiếu đã có dòng cho thiết bị này" : null),
          }}
        />
      </div>
      <div className="flex flex-wrap items-center gap-3 border-t pt-4">
        <p className="text-muted-foreground text-xs">
          Số lượng tự điền phần còn thiếu, đã trừ số đã đề xuất ở phiếu khác. Sửa lại được ở từng dòng.
        </p>
        <div className="ms-auto flex items-center gap-3">
          <span className="text-muted-foreground text-sm">
            Đã chọn <span className="text-foreground font-semibold tabular-nums">{selected.size}</span>
          </span>
          <Button type="button" variant="outline" onClick={() => close(false)}>Huỷ</Button>
          <Button type="button" className="min-w-28" disabled={selected.size === 0} onClick={confirmNorm}>
            Thêm {selected.size > 0 ? selected.size : ""} thiết bị
          </Button>
        </div>
      </div>
    </>
  );

  return (
    <CatalogPickerDialog
      open={open}
      onOpenChange={close}
      schoolId={schoolId}
      exclude={exclude}
      title="Chọn thiết bị cần mua"
      description="Chọn thiết bị theo định mức còn thiếu hoặc từ toàn bộ danh mục để thêm vào đề xuất mua sắm."
      header={tabs}
      body={tab === "norm" ? normBody : undefined}
      onPick={(rows: PickedCatalog[]) => {
        onPick(rows.map((c) => ({ catalogId: c.id, label: `${c.code} · ${c.name}`, quantity: 1 })));
        close(false);
      }}
    />
  );
}
