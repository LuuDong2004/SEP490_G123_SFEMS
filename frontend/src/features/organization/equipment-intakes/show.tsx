import { useCustom, useShow } from "@refinedev/core";
import { Check, PackageCheck } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";

import { API_URL } from "@/shared/api/constants";
import { VoucherShowShell } from "@/shared/components/voucher/voucher-show-shell";
import { SideFact, SideSection, StepTitle, VoucherLinesCard } from "@/shared/components/voucher/voucher-layout";
import { formatDate } from "@/shared/lib/format";
import { cn } from "@/shared/lib/utils";
import { Card } from "@/shared/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { DropdownMenuItem } from "@/shared/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { formatVnd } from "@/features/organization/equipment-intakes/money";
import {
  FUNDING_SOURCE_LABELS,
  INSPECTION_RESULT_LABELS,
  type EquipmentIntake,
  type EquipmentIntakeLine,
  type WrittenUpAsset,
} from "@/domains/equipment-intake/types";

/** Dải bước Lập › Trình › Duyệt › Ghi tăng (hình 30 của đặc tả). */
function StepStrip({ r }: { r: EquipmentIntake }) {
  const reached = r.status === "COMPLETED" ? 4 : r.status === "APPROVED" ? 3 : r.status === "PENDING" ? 2 : 1;
  const stopped = r.status === "REJECTED" || r.status === "CANCELLED";
  const steps = ["Lập phiếu", "Trình", "Duyệt", "Ghi tăng"];
  return (
    <Card className="px-4 py-3">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        {steps.map((s, i) => {
          const done = !stopped && i + 1 < reached || r.status === "COMPLETED";
          const current = !stopped && i + 1 === reached && r.status !== "COMPLETED";
          return (
            <li key={s} className="flex items-center gap-2">
              <span className={cn(
                "flex size-5 items-center justify-center rounded-full border text-xs tabular-nums",
                done && "bg-primary border-primary text-primary-foreground",
                current && "border-primary text-primary font-semibold",
              )}>
                {done ? <Check className="size-3" strokeWidth={3} /> : i + 1}
              </span>
              <span className={cn(current ? "font-semibold" : done ? "" : "text-muted-foreground")}>{s}</span>
              {i < steps.length - 1 ? <span className="text-muted-foreground">›</span> : null}
            </li>
          );
        })}
        {stopped ? (
          <li className="text-destructive ms-2 font-medium">{r.status === "REJECTED" ? "Bị từ chối" : "Đã huỷ"}</li>
        ) : null}
      </ol>
    </Card>
  );
}

function LinesTable({ lines, total, writtenUp }: { lines: EquipmentIntakeLine[]; total: number; writtenUp: boolean }) {
  return (
    <VoucherLinesCard>
      <div className="px-4 py-3">
        <StepTitle title="Thiết bị nhận" aside={`${lines.length} dòng · ${formatVnd(total)}`} />
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10 text-right">#</TableHead>
            <TableHead>Thiết bị</TableHead>
            <TableHead className="text-right">SL thực nhận</TableHead>
            <TableHead className="text-right">Đơn giá</TableHead>
            <TableHead className="text-right">Thành tiền</TableHead>
            <TableHead>Vị trí</TableHead>
            <TableHead>Chứng từ</TableHead>
            {writtenUp ? <TableHead className="text-right">Hồ sơ đã sinh</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {lines.length === 0 ? (
            <TableRow>
              <TableCell colSpan={writtenUp ? 8 : 7} className="text-muted-foreground py-6 text-center">Phiếu chưa có dòng nào</TableCell>
            </TableRow>
          ) : (
            lines.map((l) => (
              <TableRow key={l.id}>
                <TableCell className="text-muted-foreground text-right tabular-nums">{l.lineNo}</TableCell>
                <TableCell>
                  <div className="font-medium">{l.name}</div>
                  <div className="text-muted-foreground text-xs">
                    {[l.catalog?.code, l.movementReason?.name, l.model, l.manufacturer].filter(Boolean).join(" · ")}
                  </div>
                  {l.varianceReason ? <div className="text-warning-text text-xs">Lệch số lượng: {l.varianceReason}</div> : null}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {l.receivedQuantity}{l.unit ? ` ${l.unit.name}` : ""}
                  {l.documentQuantity !== l.receivedQuantity ? (
                    <div className="text-warning-text text-xs">HĐ: {l.documentQuantity}</div>
                  ) : null}
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatVnd(l.unitPrice)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatVnd(l.amount)}</TableCell>
                <TableCell>{l.room?.name ?? <span className="text-muted-foreground">Kho</span>}</TableCell>
                <TableCell className="text-xs">
                  {[l.supplier, l.documentNo, l.documentDate ? formatDate(l.documentDate) : null,
                    l.fundingSource ? FUNDING_SOURCE_LABELS[l.fundingSource] : null].filter(Boolean).join(" · ")
                    || <span className="text-muted-foreground">Theo đầu phiếu</span>}
                </TableCell>
                {writtenUp ? <TableCell className="text-right tabular-nums">{l.generatedCount}</TableCell> : null}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </VoucherLinesCard>
  );
}

const ASSET_STATUS_LABELS: Record<string, string> = { IN_STOCK: "Trong kho", IN_USE: "Đang sử dụng" };

/** "Xem tài sản đã ghi tăng" — các hồ sơ phiếu đã sinh, mỗi dòng mở hồ sơ thiết bị. */
function AssetsDialog({ id, open, onOpenChange }: { id: number; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { result, query } = useCustom<WrittenUpAsset[]>({
    url: `${API_URL}/equipment_intakes/${id}/assets`,
    method: "get",
    queryOptions: { enabled: open },
  });
  const rows = Array.isArray(result?.data) ? result.data : [];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Tài sản đã ghi tăng</DialogTitle>
          <DialogDescription>{query.isLoading ? "Đang tải" : `${rows.length} hồ sơ tài sản sinh từ phiếu này`}</DialogDescription>
        </DialogHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Mã tài sản</TableHead>
              <TableHead>Tên</TableHead>
              <TableHead className="text-right">Số lượng</TableHead>
              <TableHead>Vị trí</TableHead>
              <TableHead>Trạng thái</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((a) => (
              <TableRow key={a.id}>
                <TableCell>
                  <Link to={`/equipment/show/${a.id}`} className="text-primary font-mono text-xs hover:underline">{a.code}</Link>
                </TableCell>
                <TableCell>{a.name}</TableCell>
                <TableCell className="text-right tabular-nums">{Number(a.quantity).toLocaleString("vi-VN")}</TableCell>
                <TableCell>{a.room ?? <span className="text-muted-foreground">Kho</span>}</TableCell>
                <TableCell>{ASSET_STATUS_LABELS[a.status] ?? a.status}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DialogContent>
    </Dialog>
  );
}

/** Chi tiết phiếu nhập (PN-02, PN-03): thông tin phiếu, biên bản giao nhận, các dòng, và vòng duyệt. */
export const EquipmentIntakeShow = () => {
  const { query } = useShow<EquipmentIntake>();
  const r = query.data?.data;
  const [assetsOpen, setAssetsOpen] = useState(false);
  const completed = r?.status === "COMPLETED";
  return (
    <>
      <VoucherShowShell
        resource="equipment_intakes"
        kind="Phiếu ghi tăng"
        record={r}
        loading={query.isLoading}
        actions={{
          text: {
            approve: {
              label: "Duyệt và ghi tăng",
              title: "Duyệt và ghi tăng tài sản?",
              description: `Hệ thống sẽ ghi tăng ${r?.expectedAssets ?? 0} hồ sơ tài sản vào sổ của trường, mỗi hồ sơ một mã định danh. Sau đó phiếu không sửa được nữa.`,
              confirm: "Duyệt và ghi tăng",
              done: "Đã duyệt và ghi tăng tài sản",
            },
          },
        }}
        menuItems={completed ? (
          <DropdownMenuItem onSelect={() => setAssetsOpen(true)}>
            <PackageCheck />
            Xem tài sản đã ghi tăng
          </DropdownMenuItem>
        ) : null}
        facts={[
          { label: "Ngày nhập", value: formatDate(r?.intakeDate) },
          { label: "Người giao", value: r?.deliverer },
          { label: "Năm học", value: r?.schoolYear?.name },
          { label: "Nguồn hình thành", value: r?.originSource?.name },
          { label: "Hình thức mua sắm", value: r?.acquisitionMethod?.name },
          { label: "Nguồn kinh phí", value: r?.fundingSource ? FUNDING_SOURCE_LABELS[r.fundingSource] : null },
          { label: "Nhà cung cấp", value: r?.supplier },
          { label: "Số hoá đơn, hợp đồng", value: r?.documentNo },
          { label: "Ngày hoá đơn", value: r?.documentDate ? formatDate(r.documentDate) : null },
          { label: "Bảo hành", value: r?.warrantyMonths != null ? `${r.warrantyMonths} tháng` : null },
        ]}
        side={r ? (
          <Card className="gap-0 py-0">
            <SideSection title="Tổng">
              <SideFact label="Tổng tiền"><span className="tabular-nums">{formatVnd(r.totalAmount)}</span></SideFact>
              <SideFact label="Số lượng nhận"><span className="tabular-nums">{r.totalReceived}</span></SideFact>
              <SideFact label={completed ? "Hồ sơ đã sinh" : "Hồ sơ sẽ sinh"}>
                <span className="tabular-nums">{completed ? r.generatedCount : r.expectedAssets}</span>
              </SideFact>
            </SideSection>
            {r.handoverNo || r.delivererRepresentative || r.receiver || r.storekeeper || r.inspectionResult ? (
              <SideSection title="Biên bản giao nhận">
                <SideFact label="Số biên bản">{r.handoverNo}</SideFact>
                <SideFact label="Đại diện bên giao">{r.delivererRepresentative}</SideFact>
                <SideFact label="Người nhận">{[r.receiver, r.receiverPosition].filter(Boolean).join(", ") || null}</SideFact>
                <SideFact label="Thủ kho">{r.storekeeper}</SideFact>
                <SideFact label="Kết quả kiểm tra">{r.inspectionResult ? INSPECTION_RESULT_LABELS[r.inspectionResult] : null}</SideFact>
              </SideSection>
            ) : null}
          </Card>
        ) : null}
      >
        {r ? <StepStrip r={r} /> : null}
        {r ? <LinesTable lines={r.lines ?? []} total={r.totalAmount} writtenUp={completed} /> : null}
      </VoucherShowShell>
      {r ? <AssetsDialog id={r.id} open={assetsOpen} onOpenChange={setAssetsOpen} /> : null}
    </>
  );
};
