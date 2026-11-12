import { ArrowDownRight, ArrowUpLeft } from "lucide-react";
import { Link } from "react-router";

import { VOUCHER_STATUS_VARIANTS } from "@/shared/lib/status-variants";
import { Badge } from "@/shared/ui/badge";
import { Card } from "@/shared/ui/card";
import { StepTitle } from "@/shared/components/voucher/voucher-layout";
import { VOUCHER_ROUTES } from "@/domains/equipment/types";
import { humanizeResource } from "@/domains/permission/types";
import { voucherStatusText, type VoucherStatus } from "@/domains/voucher/types";

/** Một phiếu liên quan: phiếu gốc đã sinh ra phiếu này, hoặc phiếu sinh ra từ nó. */
export type VoucherLink = {
  direction: "source" | "child";
  resource: string;
  id: number;
  code: string | null;
  status: VoucherStatus | null;
  name: string | null;
};

/** Đường dẫn màn chi tiết của một phiếu liên quan — kế hoạch bảo trì không phải phiếu nên không nằm trong VOUCHER_ROUTES. */
const routeOf = (resource: string) => (resource === "maintenance_plans" ? "/maintenance-plans" : VOUCHER_ROUTES[resource]);

function Row({ link }: { link: VoucherLink }) {
  const route = routeOf(link.resource);
  const title = `${humanizeResource(link.resource)} ${link.code ?? (link.direction === "child" ? "(nháp)" : `#${link.id}`)}`;
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
      {link.direction === "source"
        ? <ArrowUpLeft className="text-muted-foreground size-4 shrink-0" aria-label="Phiếu gốc" />
        : <ArrowDownRight className="text-muted-foreground size-4 shrink-0" aria-label="Phiếu sinh ra" />}
      {route ? (
        <Link className="text-primary font-medium hover:underline" to={`${route}/show/${link.id}`}>{title}</Link>
      ) : (
        <span className="font-medium">{title}</span>
      )}
      {link.name ? <span className="text-muted-foreground truncate">{link.name}</span> : null}
      {link.status ? (
        <Badge variant={VOUCHER_STATUS_VARIANTS[link.status] ?? "neutral"} className="ms-auto">
          {voucherStatusText(link.status, null, false)}
        </Badge>
      ) : null}
    </li>
  );
}

/**
 * Phiếu liên quan của một phiếu: phiếu GỐC đã sinh ra nó (đề xuất mua sắm → ghi tăng, kiểm kê → ghi tăng) và các
 * phiếu sinh ra TỪ nó. Màn phiếu truyền `links` lấy từ bản ghi (vd. `source` của phiếu ghi tăng). Không có phiếu
 * nào liên quan thì không vẽ gì.
 */
export function RelatedVouchers({ links }: { links: VoucherLink[] }) {
  if (links.length === 0) {
    return null;
  }
  const sources = links.filter((l) => l.direction === "source");
  const children = links.filter((l) => l.direction === "child");
  return (
    <Card className="gap-3 px-4 py-4">
      <StepTitle title="Phiếu liên quan" />
      {sources.length ? (
        <div className="space-y-1.5">
          <div className="text-overline text-muted-foreground">Lập từ</div>
          <ul className="divide-y rounded-md border text-sm">{sources.map((l) => <Row key={`s-${l.resource}-${l.id}`} link={l} />)}</ul>
        </div>
      ) : null}
      {children.length ? (
        <div className="space-y-1.5">
          <div className="text-overline text-muted-foreground">Phiếu sinh ra từ phiếu này</div>
          <ul className="divide-y rounded-md border text-sm">{children.map((l) => <Row key={`c-${l.resource}-${l.id}`} link={l} />)}</ul>
        </div>
      ) : null}
    </Card>
  );
}
