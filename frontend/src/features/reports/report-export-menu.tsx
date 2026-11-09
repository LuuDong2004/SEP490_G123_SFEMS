import { useCan } from "@refinedev/core";
import { ChevronDown, Download, FileSpreadsheet, Printer } from "lucide-react";

import { Button } from "@/shared/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/shared/ui/dropdown-menu";

export type ReportExportData = {
  filename: string;
  headers: string[];
  rows: (string | number | null | undefined)[][];
};

export function ReportExportMenu({ data }: { data: ReportExportData }) {
  const mayExport = useCan({ resource: "reports", action: "export" }).data?.can ?? false;
  if (!mayExport) return null;

  const exportCsv = () => {
    const escape = (value: string | number | null | undefined) => {
      const text = value == null ? "" : String(value);
      return `"${text.replace(/"/g, '""')}"`;
    };
    const content = "\uFEFF" + [data.headers, ...data.rows]
      .map((row) => row.map(escape).join(","))
      .join("\r\n");
    const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${data.filename}.csv`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" size="sm" className="shrink-0 rounded-full">
          <Download className="size-4" /> Xuất <ChevronDown className="size-4 opacity-70" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-48">
        <DropdownMenuItem onSelect={exportCsv}><FileSpreadsheet /> CSV / Excel (.csv)</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => window.print()}><Printer /> In / Lưu PDF</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
