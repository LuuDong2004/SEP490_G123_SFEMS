import { useShow } from "@refinedev/core";

import { ShowView, ShowViewHeader } from "@/shared/components/views/show-view";
import { formatPlainDate } from "@/shared/lib/format";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import type { InventoryCampaign } from "@/domains/inventory/types";
import { CampaignStateBadge } from "@/features/organization/inventory-campaigns/campaign-state-badge";

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="text-sm font-medium">
      <div className="text-muted-foreground text-xs font-normal">{label}</div>
      {children}
    </div>
  );
}

/** Màn chi tiết một đợt kiểm kê: cơ quan phát động, tên, ngày chốt, hạn nộp, hướng dẫn gửi các trường. */
export function CampaignShow() {
  const { result: record } = useShow<InventoryCampaign>({ resource: "inventory_campaigns" });

  return (
    <ShowView>
      <ShowViewHeader canEdit={record?._can?.write ?? false} canDelete={record?._can?.delete ?? false} />
      <Card>
        <CardHeader>
          <CardDescription>{record?.managingBody.name}</CardDescription>
          <CardTitle className="flex flex-wrap items-center gap-2 text-xl">
            {record?.title}
            {record ? <CampaignStateBadge closed={record.closed} /> : null}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <Fact label="Chốt số liệu">{formatPlainDate(record?.cutoffDate)}</Fact>
          <Fact label="Hạn nộp">
            <span className={record?.overdue ? "text-destructive" : undefined}>{formatPlainDate(record?.deadline)}</span>
          </Fact>
          {record?.note ? <div className="text-sm whitespace-pre-line sm:col-span-3">{record.note}</div> : null}
        </CardContent>
      </Card>
    </ShowView>
  );
}
