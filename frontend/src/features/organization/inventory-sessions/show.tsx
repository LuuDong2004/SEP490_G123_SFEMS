import { useShow } from "@refinedev/core";

import { VoucherShowShell } from "@/shared/components/voucher/voucher-show-shell";
import { StepTitle, VoucherLinesCard } from "@/shared/components/voucher/voucher-layout";
import { formatPlainDate } from "@/shared/lib/format";
import { Badge } from "@/shared/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { CONDITION_LABELS } from "@/domains/equipment/types";
import { DISCREPANCY_LABELS, type InventoryLine, type InventorySession } from "@/domains/inventory/types";

/** Sổ ghi tài sản ở đâu, tình trạng gì. */
function RegisterCell({ line }: { line: InventoryLine }) {
  const room = line.expectedRoom?.name ?? "Kho (chưa xếp phòng)";
  const condition = line.expectedCondition ? CONDITION_LABELS[line.expectedCondition] : null;
  return (
    <span>
      {room}
      {condition ? <span className="text-muted-foreground"> · {condition}</span> : null}
    </span>
  );
}

/** Kết quả kiểm của một dòng: chưa kiểm, khớp sổ, hoặc các loại chênh lệch. */
function ResultCell({ line }: { line: InventoryLine }) {
  if (line.found == null) return <span className="text-muted-foreground">Chưa kiểm</span>;
  if (line.discrepancies.length === 0) return <Badge variant="success">Khớp</Badge>;
  return (
    <div className="flex flex-wrap gap-1">
      {line.discrepancies.map((d) => (
        <Badge key={d} variant={d === "MISSING" ? "destructive" : "warning"}>{DISCREPANCY_LABELS[d]}</Badge>
      ))}
    </div>
  );
}

function LinesTable({ session }: { session: InventorySession }) {
  const { checked, total } = session.summary;
  return (
    <VoucherLinesCard>
      <div className="px-4 py-3">
        <StepTitle title="Tài sản cần kiểm" aside={`Đã kiểm ${checked}/${total}`} />
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10 text-right">#</TableHead>
            <TableHead>Mã tài sản</TableHead>
            <TableHead>Tên tài sản</TableHead>
            <TableHead>Sổ ghi</TableHead>
            <TableHead>Kết quả kiểm</TableHead>
            <TableHead>Ghi chú</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {session.lines.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-muted-foreground py-6 text-center">
                Không có tài sản nào trên sổ trong phạm vi kiểm kê
              </TableCell>
            </TableRow>
          ) : (
            session.lines.map((line) => (
              <TableRow key={line.id}>
                <TableCell className="text-muted-foreground text-right tabular-nums">{line.lineNo}</TableCell>
                <TableCell className="font-mono text-xs">{line.equipment.code}</TableCell>
                <TableCell className="font-medium">{line.equipment.name}</TableCell>
                <TableCell><RegisterCell line={line} /></TableCell>
                <TableCell><ResultCell line={line} /></TableCell>
                <TableCell className="text-muted-foreground">{line.note}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </VoucherLinesCard>
  );
}

/** Chi tiết phiếu kiểm kê (KK-03): thông tin phiếu, các tài sản chụp từ sổ, và các nút của vòng duyệt. */
export const InventorySessionShow = () => {
  const { query } = useShow<InventorySession>();
  const r = query.data?.data;
  return (
    <VoucherShowShell
      resource="inventory_sessions"
      kind="Phiếu kiểm kê"
      record={r}
      loading={query.isLoading}
      facts={[
        { label: "Tên đợt", value: r?.title },
        { label: "Ngày kiểm kê", value: formatPlainDate(r?.inventoryDate) },
        { label: "Phạm vi", value: r ? (r.room?.name ?? "Cả trường") : null },
        { label: "Đợt kiểm kê", value: r?.campaign?.name },
        { label: "Tổ kiểm kê", value: r?.council },
        { label: "Kết luận", value: r?.conclusion },
      ]}
    >
      {r ? <LinesTable session={r} /> : null}
    </VoucherShowShell>
  );
};
