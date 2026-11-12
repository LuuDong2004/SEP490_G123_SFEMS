import { useCan, useNotification } from "@refinedev/core";
import { ChevronDown, Download, FileSpreadsheet, Printer } from "lucide-react";
import { useState } from "react";

import { kyInstance } from "@/shared/api/data";
import { Button } from "@/shared/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/shared/ui/dropdown-menu";

export type ReportExportQuery = {
  report: "ASSETS" | "ADEQUACY" | "PURCHASE" | "INVENTORY";
  search?: string;
  fromDate?: string;
  toDate?: string;
  schoolId?: string;
  subjectId?: string;
  equipmentTypeId?: string;
  status?: string;
  originId?: string;
  year?: string;
  equipmentId?: string;
  campaignId?: string;
  gradeId?: string;
};
export type ReportExportColumn = { label: string; type: "text" | "number" | "money" | "date" };

export function ReportExportMenu({ query }: { query: ReportExportQuery }) {
  const mayExport = useCan({ resource: "reports", action: "export" }).data?.can ?? false;
  const { open } = useNotification();
  const [busy, setBusy] = useState(false);
  if (!mayExport) return null;

  const download = async (format: "xlsx" | "csv") => {
    setBusy(true);
    try {
      const response = await kyInstance.post(`reports/export-${format}`, { json: query });
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      const filename = {
        ASSETS: "bao-cao-tai-san-thiet-bi",
        ADEQUACY: "bao-cao-dap-ung-dinh-muc",
        PURCHASE: "bao-cao-nhu-cau-mua-sam",
        INVENTORY: "bao-cao-ket-qua-kiem-ke",
      }[query.report];
      anchor.download = `${filename}.${format}`;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      open?.({ type: "success", message: format === "csv" ? "Đã xuất tệp CSV." : "Đã xuất tệp Excel." });
    } catch (error) {
      console.error(`Không thể xuất báo cáo ${format}`, error);
      open?.({ type: "error", message: "Không thể xuất báo cáo. Vui lòng thử lại hoặc kiểm tra quyền xuất." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" size="sm" className="shrink-0 rounded-full" disabled={busy}>
          <Download className="size-4" /> Xuất <ChevronDown className="size-4 opacity-70" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-48">
        <DropdownMenuItem disabled={busy} onSelect={() => void download("xlsx")}><FileSpreadsheet /> Excel (.xlsx)</DropdownMenuItem>
        <DropdownMenuItem disabled={busy} onSelect={() => void download("csv")}><FileSpreadsheet /> CSV (.csv)</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => window.print()}><Printer /> In / Lưu PDF</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
