import { useList } from "@refinedev/core";
import { ArrowRight, Printer, ScanLine, Search } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";

import { ListView, ListViewHeader } from "@/shared/components/views/list-view";
import { FACILITY_CONDITION_VARIANTS } from "@/shared/lib/status-variants";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { CONDITION_LABELS, STRUCTURE_LABELS, USAGE_STATUS_LABELS } from "@/domains/facility/types";

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Đường dẫn tem QR của một phòng / hạng mục CSVC — mở màn tra cứu theo mã (QLTB-636). */
export function facilityLookupUrl(code: string) {
  return `${window.location.origin}/facility-lookup?code=${encodeURIComponent(code)}`;
}

/**
 * Mã QR của phòng / hạng mục CSVC trên màn xem (QLTB-636): cùng cơ chế với tem tài sản — QR mang đường dẫn tra cứu
 * theo mã. "In tem" mở trang in một tem.
 */
export function FacilityQr({ record, stacked }: {
  record: any;
  /** Cột hẹp (cột phải tab Thông tin của hộp xem phòng): QR trên, mã và nút In tem dưới, QR nhỏ hơn. */
  stacked?: boolean;
}) {
  const box = useRef<HTMLDivElement>(null);
  if (!record?.code) return null;
  const print = () => {
    const svg = box.current?.querySelector("svg")?.outerHTML ?? "";
    const w = window.open("", "_blank", "width=420,height=520");
    if (!w) return;
    const esc = (v: string) => v.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c);
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(record.code)}</title>
      <style>body{font-family:system-ui,sans-serif;margin:0;display:flex;justify-content:center}
      .tem{border:1px solid #999;border-radius:8px;padding:16px;margin:16px;text-align:center;width:240px}
      .tem svg{width:200px;height:200px}.c{font-family:monospace;font-size:16px;font-weight:600;margin-top:8px}
      .n{font-size:13px;margin-top:4px}.s{font-size:11px;color:#555;margin-top:2px}</style></head>
      <body><div class="tem">${svg}<div class="c">${esc(record.code)}</div><div class="n">${esc(record.name ?? "")}</div>
      <div class="s">${esc(record.school?.name ?? "")}</div></div>
      <script>window.onload=function(){window.print()}</script></body></html>`);
    w.document.close();
  };
  if (stacked) {
    // Gọn trong dải đầu hộp phòng: chỉ mã QR nhỏ và nút In tem — không khung, không tiêu đề (mã phòng đã ở cạnh tên).
    return (
      <div className="flex flex-col items-center gap-1.5">
        <div ref={box} className="rounded-md border bg-white p-1" title={`Mã QR của ${record.code}`}>
          <QRCodeSVG value={facilityLookupUrl(record.code)} size={72} />
        </div>
        <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={print}>
          <Printer />
          In tem
        </Button>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-5">
      <div ref={box} className="rounded-lg border bg-white p-3">
        <QRCodeSVG value={facilityLookupUrl(record.code)} size={148} />
      </div>
      <div className="min-w-0 space-y-2">
        <p className="font-mono text-base font-semibold">{record.code}</p>
        <p className="text-muted-foreground text-sm">Quét mã để xem hiện trạng của {record.name ?? "hạng mục"}.</p>
        <Button type="button" variant="outline" size="sm" onClick={print}>
          <Printer />
          In tem
        </Button>
      </div>
    </div>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className="truncate text-sm font-medium">{children}</div>
    </div>
  );
}

/**
 * Tra cứu phòng / hạng mục CSVC theo mã — nơi tem QR trỏ về (QLTB-636). Hiện ngay hiện trạng (loại, vị trí, kết cấu,
 * tình trạng, xác nhận), "Mở hồ sơ" để xem đủ.
 */
export const FacilityLookup = () => {
  const [params, setParams] = useSearchParams();
  const code = (params.get("code") ?? "").trim();
  const [term, setTerm] = useState(code);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.focus(), []);
  const { result, query } = useList<any>({
    resource: "rooms",
    filters: [{ field: "q", operator: "eq", value: code }],
    pagination: { currentPage: 1, pageSize: 10 },
    queryOptions: { enabled: code.length > 0 },
  });
  const rows = code ? (result?.data ?? []) : [];
  // Mã khớp đúng đứng đầu, rồi tới các phòng có tên / mã chứa chữ đã gõ.
  const sorted = [...rows].sort((a, b) => Number((b.code ?? "").toLowerCase() === code.toLowerCase()) - Number((a.code ?? "").toLowerCase() === code.toLowerCase()));

  return (
    <ListView>
      <ListViewHeader title="Tra cứu CSVC" canCreate={false} />
      <div className="grid max-w-3xl gap-4">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setParams(term.trim() ? { code: term.trim() } : {});
          }}
        >
          <div className="relative flex-1">
            <ScanLine className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input ref={input} value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Quét hoặc gõ mã phòng, hạng mục" className="pl-9" />
          </div>
          <Button type="submit"><Search />Tra cứu</Button>
        </form>
        {query.isLoading && code ? <p className="text-muted-foreground text-sm">Đang tìm…</p> : null}
        {code && !query.isLoading && sorted.length === 0 ? (
          <p className="text-muted-foreground text-sm">Không có phòng, hạng mục nào mã “{code}” trong phạm vi của bạn.</p>
        ) : null}
        {sorted.map((r) => (
          <Card key={r.id} className="gap-4 px-5 py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-mono text-sm">{r.code}</p>
                <p className="text-lg font-semibold">{r.name}</p>
                <p className="text-muted-foreground text-sm">{[r.school?.name, r.roomType?.name].filter(Boolean).join(" · ")}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {r.condition ? <Badge variant={FACILITY_CONDITION_VARIANTS[r.condition] ?? "neutral"}>{CONDITION_LABELS[r.condition]}</Badge> : null}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
              <Fact label="Khối nhà">{r.building?.name ?? "—"}</Fact>
              <Fact label="Tầng">{r.floor ? `Tầng ${r.floor}` : "—"}</Fact>
              <Fact label="Kết cấu">{STRUCTURE_LABELS[r.structure] ?? "—"}</Fact>
              <Fact label="Diện tích">{r.area != null ? `${r.area} m²` : "—"}</Fact>
              <Fact label="Sử dụng">{USAGE_STATUS_LABELS[r.usageStatus] ?? "—"}</Fact>
              <Fact label="Sức chứa">{r.capacity ?? "—"}</Fact>
              <Fact label="Phụ trách">{r.managingStaff?.name ?? r.managingUnit ?? "—"}</Fact>
            </div>
            <div>
              <Button asChild variant="outline" size="sm">
                <Link to={`/rooms/show/${r.id}`}>Mở hồ sơ <ArrowRight /></Link>
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </ListView>
  );
};
