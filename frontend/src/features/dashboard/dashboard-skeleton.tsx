import { RefreshCw, TriangleAlert } from "lucide-react";

import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Skeleton } from "@/shared/ui/skeleton";
import { LoadingText } from "@/shared/components/spinner";

/**
 * Màn Tổng hợp lúc CHƯA có số liệu: cùng bố cục với màn thật (đầu trang, bốn thẻ số, các khối biểu đồ) nhưng là các
 * khối chờ có vệt sáng lướt qua — không vẽ khung thẻ trống, trông như đã tải xong mà không có gì.
 */
export function DashboardSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-live="polite" aria-label="Đang tải số liệu tổng hợp">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Tổng hợp
          <LoadingText className="ms-3 align-middle font-normal" />
        </h1>
        <Skeleton className="h-4 w-36" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Card key={i} className="gap-0 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 space-y-3">
                <Skeleton className="h-3.5 w-28" />
                <Skeleton className="h-7 w-24" />
              </div>
              <Skeleton className="size-9 rounded-lg" />
            </div>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <BlockSkeleton className="xl:col-span-2" rows />
        <BlockSkeleton rows />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <BlockSkeleton donut />
        <BlockSkeleton bars />
      </div>
    </div>
  );
}

function BlockSkeleton({ className, rows, donut, bars }: { className?: string; rows?: boolean; donut?: boolean; bars?: boolean }) {
  return (
    <Card className={`gap-0 p-0 ${className ?? ""}`}>
      <div className="border-b px-5 py-4">
        <Skeleton className="h-4 w-44" />
      </div>
      <div className="p-5">
        {donut ? (
          <div className="flex items-center gap-8">
            <Skeleton className="size-40 shrink-0 rounded-full" />
            <div className="flex-1 space-y-3">
              {Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-4 w-full" />)}
            </div>
          </div>
        ) : bars ? (
          <div className="flex h-48 items-end gap-3">
            {[40, 65, 30, 80, 55, 70, 45, 90, 35, 60, 50, 75].map((h, i) => (
              <Skeleton key={i} className="flex-1 rounded-sm" style={{ height: `${h}%` }} />
            ))}
          </div>
        ) : rows ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-5 w-full" />)}
          </div>
        ) : null}
      </div>
    </Card>
  );
}

/** Không tải được số liệu (máy chủ chưa lên, mất mạng): nói thẳng và cho thử lại, không để màn trống. */
export function DashboardError({ onRetry, retrying }: { onRetry: () => void; retrying: boolean }) {
  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-3 text-center">
      <span className="bg-warning-subtle text-warning-text flex size-12 items-center justify-center rounded-full">
        <TriangleAlert className="size-6" />
      </span>
      <p className="text-base font-semibold">Chưa tải được số liệu tổng hợp</p>
      <p className="text-muted-foreground text-sm">Máy chủ chưa phản hồi. Thử lại sau giây lát.</p>
      <Button type="button" variant="outline" onClick={onRetry} disabled={retrying}>
        <RefreshCw className={retrying ? "animate-spin" : undefined} />
        Thử lại
      </Button>
    </div>
  );
}
