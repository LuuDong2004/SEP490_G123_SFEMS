import { RotateCcw, Search } from "lucide-react";

import { ListToolbar } from "@/shared/components/views/list-view";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { ReportExportMenu, type ReportExportData } from "./report-export-menu";

/** Thanh tìm kiếm và bộ lọc theo cùng bố cục với các danh sách nghiệp vụ. */
export function ReportFilterToolbar({
  search,
  onSearchChange,
  searchPlaceholder,
  filters,
  onReset,
  searchClassName,
  firstRow,
  secondRow,
  exportData,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  filters?: React.ReactNode;
  onReset: () => void;
  searchClassName?: string;
  firstRow?: React.ReactNode;
  secondRow?: React.ReactNode;
  exportData?: ReportExportData;
}) {
  const searchInput = (
    <div className="relative min-w-0">
      <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
      <Input
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder={searchPlaceholder}
        aria-label={searchPlaceholder}
        className="h-9 rounded-full ps-9"
      />
    </div>
  );
  const resetButton = (
    <Button variant="ghost" size="sm" className="shrink-0 rounded-full" onClick={onReset}>
      <RotateCcw className="size-4" />
      Xóa lọc
    </Button>
  );

  if (firstRow !== undefined || secondRow !== undefined) {
    return (
      <Card className="gap-0 p-3">
        <div className="space-y-2">
          <div className="grid grid-cols-1 items-center gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(250px,1fr)_max-content_max-content]">
            <div className="min-w-0 sm:col-span-2 lg:col-span-1">{searchInput}</div>
            {firstRow}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {secondRow}
            {exportData ? <ReportExportMenu data={exportData} /> : null}
            {resetButton}
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="gap-0 p-3">
      <ListToolbar
        search={searchInput}
        filters={filters}
        actions={<div className="flex items-center gap-2">{exportData ? <ReportExportMenu data={exportData} /> : null}{resetButton}</div>}
        searchClassName={searchClassName ?? "min-w-[200px] sm:min-w-[260px]"}
      />
    </Card>
  );
}
