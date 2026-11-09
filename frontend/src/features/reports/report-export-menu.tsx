import { useCan } from "@refinedev/core";
import { ChevronDown, Download, FileSpreadsheet, Printer } from "lucide-react";

import { kyInstance } from "@/shared/api/data";
import { Button } from "@/shared/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/shared/ui/dropdown-menu";

export type ReportExportColumn = { label: string; type: "text" | "number" | "money" | "date" };
export type ReportExportData = {
  filename: string;
  title: string;
  subtitle: string;
  columns: ReportExportColumn[];
  rows: (string | number | null | undefined)[][];
};

export function ReportExportMenu({ data }: { data: ReportExportData }) {
  const mayExport = useCan({ resource: "reports", action: "export" }).data?.can ?? false;
  if (!mayExport) return null;

  const exportXlsx = async () => {
    try {
      const response = await kyInstance.post("reports/export-xlsx", { json: data });
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${data.filename}.xlsx`;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      console.error("Không thể xuất báo cáo Excel", error);
      window.alert("Không thể xuất báo cáo Excel. Vui lòng thử lại hoặc kiểm tra quyền xuất báo cáo.");
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" size="sm" className="shrink-0 rounded-full">
          <Download className="size-4" /> Xuất <ChevronDown className="size-4 opacity-70" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-48">
        <DropdownMenuItem onSelect={() => void exportXlsx()}><FileSpreadsheet /> Excel (.xlsx)</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => window.print()}><Printer /> In / Lưu PDF</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
