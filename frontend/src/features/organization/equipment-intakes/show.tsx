import { useShow } from "@refinedev/core";

import { VoucherShowShell } from "@/shared/components/voucher/voucher-show-shell";
import { StepTitle, VoucherLinesCard } from "@/shared/components/voucher/voucher-layout";
import { formatDate } from "@/shared/lib/format";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { formatVnd } from "@/features/organization/equipment-intakes/money";
import { FUNDING_SOURCE_LABELS, type EquipmentIntake, type EquipmentIntakeLine } from "@/domains/equipment-intake/types";

function LinesTable({ lines, total, writtenUp }: { lines: EquipmentIntakeLine[]; total: number; writtenUp: boolean }) {
  return (
    <VoucherLinesCard>
      <div className="px-4 py-3">
        <StepTitle title="Thiết bị nhập" aside={`${lines.length} dòng · ${formatVnd(total)}`} />
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10 text-right">#</TableHead>
            <TableHead>Thiết bị</TableHead>
            <TableHead className="text-right">SL chứng từ</TableHead>
            <TableHead className="text-right">SL thực nhận</TableHead>
            <TableHead className="text-right">Đơn giá</TableHead>
            <TableHead className="text-right">Thành tiền</TableHead>
            <TableHead>Phòng nhận</TableHead>
            {writtenUp ? <TableHead className="text-right">Tài sản đã sinh</TableHead> : null}
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
                    {[l.catalog?.code, l.model, l.manufacturer].filter(Boolean).join(" · ")}
                  </div>
                  {l.varianceReason ? <div className="text-warning-text text-xs">Chênh lệch: {l.varianceReason}</div> : null}
                </TableCell>
                <TableCell className="text-right tabular-nums">{l.documentQuantity}</TableCell>
                <TableCell className="text-right tabular-nums">{l.receivedQuantity}{l.unit ? ` ${l.unit.name}` : ""}</TableCell>
                <TableCell className="text-right tabular-nums">{formatVnd(l.unitPrice)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatVnd(l.amount)}</TableCell>
                <TableCell>{l.room?.name ?? <span className="text-muted-foreground">Kho</span>}</TableCell>
                {writtenUp ? <TableCell className="text-right tabular-nums">{l.generatedCount}</TableCell> : null}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </VoucherLinesCard>
  );
}

/** Chi tiết phiếu nhập thiết bị (PN-01): thông tin phiếu, các dòng, và các nút của vòng duyệt. */
export const EquipmentIntakeShow = () => {
  const { query } = useShow<EquipmentIntake>();
  const r = query.data?.data;
  return (
    <VoucherShowShell
      resource="equipment_intakes"
      kind="Phiếu nhập thiết bị"
      record={r}
      loading={query.isLoading}
      facts={[
        { label: "Ngày nhập", value: formatDate(r?.intakeDate) },
        { label: "Nhà cung cấp", value: r?.supplier },
        { label: "Năm học", value: r?.schoolYear?.name },
        { label: "Số chứng từ", value: r?.documentNo },
        { label: "Ngày chứng từ", value: r?.documentDate ? formatDate(r.documentDate) : null },
        { label: "Nguồn kinh phí", value: r?.fundingSource ? FUNDING_SOURCE_LABELS[r.fundingSource] : null },
        { label: "Nguồn hình thành", value: r?.originSource?.name },
        { label: "Phương thức hình thành", value: r?.acquisitionMethod?.name },
        { label: "Bảo hành", value: r?.warrantyMonths != null ? `${r.warrantyMonths} tháng` : null },
      ]}
    >
      {r ? <LinesTable lines={r.lines ?? []} total={r.totalAmount} writtenUp={r.status === "COMPLETED"} /> : null}
    </VoucherShowShell>
  );
};
