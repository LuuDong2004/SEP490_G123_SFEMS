import { useList } from "@refinedev/core";
import { ChevronDown, X } from "lucide-react";
import { useState } from "react";
import type { Control } from "react-hook-form";

import { FormHint } from "@/shared/components/form/help-hint";
import { formatPlainDate } from "@/shared/lib/format";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/shared/ui/form";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import type { InventoryCampaign } from "@/domains/inventory/types";
import { LIFT_ROW } from "@/shared/lib/row-lift";
import { TableEmpty } from "@/shared/components/data-table/table-empty";

/* eslint-disable @typescript-eslint/no-explicit-any */

type Row = InventoryCampaign & { name?: string };
const nameOf = (c: Row) => c.title ?? c.name ?? "";

/**
 * Ô chọn đợt kiểm kê của Sở / UBND — mở hộp thoại liệt kê các đợt ĐANG MỞ kèm cơ quan phát động, ngày chốt
 * số liệu và hạn nộp. Danh sách xổ chỉ có tên thì người lập không biết đợt nào của ai, hạn bao giờ.
 *
 * Để trống là trường tự kiểm kê, nên ô trống hiện đúng câu đó chứ không hiện "Vui lòng chọn".
 */
export function CampaignPickerField({ control, name, label, hint, current, onPicked }: {
  control: Control<any>;
  name: string;
  label: string;
  hint?: string;
  /** Đợt đã chọn sẵn (mở form từ "Lập phiếu cho đợt này") — vẽ được tên trước khi danh sách tải xong. */
  current?: { id: number; name: string };
  onPicked?: (campaign: { id: number; name: string } | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const { result, query } = useList<Row>({
    resource: "inventory_campaigns",
    pagination: { currentPage: 1, pageSize: 50 },
    sorters: [{ field: "deadline", order: "asc" }],
  });
  const rows = (result?.data ?? []).filter((c) => !c.closed);

  return (
    <FormField
      control={control}
      name={`${name}.id`}
      render={({ field }) => {
        const chosen = rows.find((c) => c.id === field.value);
        const text = chosen ? nameOf(chosen) : current && current.id === field.value ? current.name : null;
        const pick = (c: Row | null) => {
          field.onChange(c?.id ?? null);
          onPicked?.(c ? { id: c.id, name: nameOf(c) } : null);
          setOpen(false);
        };
        return (
          <FormItem>
            <FormLabel>
              {label}
              {hint ? <FormHint>{hint}</FormHint> : null}
            </FormLabel>
            <FormControl>
              <button
                type="button"
                onClick={() => setOpen(true)}
                className="bg-field hover:border-primary/40 flex h-9 w-full min-w-0 items-center gap-2 overflow-hidden rounded-md border px-3 text-left text-sm transition-colors"
              >
                <span className={cn("min-w-0 flex-1 truncate", !text && "text-muted-foreground")}>{text ?? "Trường tự kiểm kê"}</span>
                <ChevronDown className="text-muted-foreground size-4 shrink-0 opacity-60" />
              </button>
            </FormControl>
            <FormMessage />

            <Dialog open={open} onOpenChange={setOpen}>
              <DialogContent size="picker">
                <DialogHeader>
                  <DialogTitle>Chọn đợt kiểm kê</DialogTitle>
                  <DialogDescription>Các đợt Sở đang mở. Bấm một dòng để chọn.</DialogDescription>
                </DialogHeader>
                <div className="min-h-0 flex-1 overflow-auto rounded-md border [&>[data-slot=table-container]]:overflow-visible [&_tbody_tr:last-child]:border-b">
                  <Table className="table-fixed">
                    <colgroup>
                      <col />
                      <col className="w-56" />
                      <col className="w-32" />
                      <col className="w-32" />
                    </colgroup>
                    <TableHeader sticky>
                      <TableRow>
                        <TableHead className="px-4">Tên đợt</TableHead>
                        <TableHead className="px-4">Cơ quan phát động</TableHead>
                        <TableHead className="px-4">Chốt số liệu</TableHead>
                        <TableHead className="px-4">Hạn nộp</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.length === 0 ? (
                        <TableEmpty colSpan={4} loading={query.isLoading} title={"Không có đợt nào đang mở."} />
                      ) : (
                        rows.map((c) => {
                          const active = c.id === field.value;
                          return (
                            <TableRow key={c.id} className={cn("group/row", LIFT_ROW, "h-12 cursor-pointer", active && "bg-primary/10 hover:bg-primary/10")} onClick={() => pick(c)}>
                              <TableCell className={cn("truncate px-4 font-medium", active && "text-primary")} title={nameOf(c)}>{nameOf(c)}</TableCell>
                              <TableCell className="text-muted-foreground truncate px-4" title={c.managingBody?.name}>{c.managingBody?.name ?? "—"}</TableCell>
                              <TableCell className="px-4 tabular-nums">{formatPlainDate(c.cutoffDate)}</TableCell>
                              <TableCell className={cn("px-4 tabular-nums", c.overdue && "text-destructive font-medium")}>
                                {formatPlainDate(c.deadline)}
                                {c.overdue ? " · quá hạn" : ""}
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
                <div className="flex items-center justify-end gap-3 border-t pt-4">
                  {field.value ? (
                    <Button type="button" variant="ghost" onClick={() => pick(null)}>
                      <X />
                      Bỏ chọn
                    </Button>
                  ) : null}
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                    Đóng
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </FormItem>
        );
      }}
    />
  );
}
