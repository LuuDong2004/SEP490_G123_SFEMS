import { useCan, useNotification, useOne } from "@refinedev/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil } from "lucide-react";
import { useEffect, useState } from "react";

import { getAuthorities } from "@/shared/api/session";
import { FillBox } from "@/shared/components/layout/fill-box";
import { kyInstance } from "@/shared/api/data";
import { SchoolPickerField } from "@/shared/components/catalog/school-picker";
import { ListView, ListViewHeader } from "@/shared/components/views/list-view";
import { usePersistentState } from "@/shared/hooks/use-persistent-state";
import { errorMessage } from "@/shared/lib/api-error";
import { maxLengthOf } from "@/shared/lib/field-rules";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Skeleton } from "@/shared/ui/skeleton";
import { LIFT_ROW } from "@/shared/lib/row-lift";
import { cn } from "@/shared/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { ROW_ACTION_ITEM, RowActions } from "@/shared/components/data-table/row-actions";
import type { SchoolCodeRule } from "@/features/organization/resources/school-code";
import type { School } from "@/domains/school/types";

/** Quy tắc mã của trường — dùng chung cho màn quản lý và "Thêm nhanh". */
export function useSchoolCodeRules(schoolId: number, enabled = true) {
  const mayRead = useCan({ resource: "school_code_rules", action: "list" }).data?.can ?? false;
  const { data, isLoading } = useQuery({
    queryKey: ["school-code-rules", schoolId],
    enabled: enabled && mayRead && schoolId > 0,
    queryFn: () =>
      kyInstance.get("school_code_rules", { searchParams: { "school.id": String(schoolId) } }).json<SchoolCodeRule[]>(),
  });
  const byTarget = Object.fromEntries((data ?? []).map((r) => [r.target, r])) as Partial<Record<SchoolCodeRule["target"], SchoolCodeRule>>;
  return { rules: data ?? [], byTarget, mayRead, isLoading };
}

const pad = (n: number, len: number) => String(n).padStart(len, "0");

/** Hộp thoại sửa MỘT quy tắc: ba ô, xem trước mã ngay dưới. */
function EditRuleDialog({ rule, schoolId, onClose }: { rule: SchoolCodeRule | null; schoolId: number; onClose: () => void }) {
  const [prefix, setPrefix] = useState("");
  const [len, setLen] = useState(4);
  const [start, setStart] = useState("1");
  const [busy, setBusy] = useState(false);
  const { open: notify } = useNotification();
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!rule) return;
    setPrefix(rule.prefix ?? "");
    setLen(rule.numberLength);
    setStart(String(rule.startNumber));
  }, [rule]);

  async function run(action: "save" | "reset") {
    if (!rule) return;
    setBusy(true);
    try {
      const opts = { searchParams: { "school.id": String(schoolId) } };
      if (action === "save") {
        await kyInstance.put(`school_code_rules/${rule.target}`, {
          ...opts,
          json: { prefix, numberLength: len, startNumber: Number(start) || 0 },
        });
      } else {
        await kyInstance.delete(`school_code_rules/${rule.target}`, opts);
      }
      notify?.({ type: "success", message: action === "save" ? `Đã lưu quy tắc mã ${rule.label.toLowerCase()}` : "Đã về cách đặt mặc định" });
      await queryClient.invalidateQueries({ queryKey: ["school-code-rules", schoolId] });
      onClose();
    } catch (e) {
      notify?.({ type: "error", message: await errorMessage(e) });
    } finally {
      setBusy(false);
    }
  }

  const n = Number(start) || 0;
  return (
    <Dialog open={!!rule} onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Quy tắc mã — {rule?.label}</DialogTitle>
          <DialogDescription>Mã gồm ký hiệu và số thứ tự, tiếp theo mã lớn nhất đang có. Chỉ áp dụng cho mã cấp từ nay.</DialogDescription>
        </DialogHeader>
        <div className="grid items-start gap-4 sm:grid-cols-3">
          <div className="grid gap-2 sm:col-span-3">
            <Label htmlFor="rule-prefix">Ký hiệu đầu mã</Label>
            <Input id="rule-prefix" value={prefix} placeholder="Không có ký hiệu" maxLength={maxLengthOf("CODE", 20)}
              onChange={(e) => setPrefix(e.target.value.replace(/[^A-Za-z0-9._-]/g, "").slice(0, 20))} />
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label>Độ dài phần số</Label>
            <Select value={String(len)} onValueChange={(v) => setLen(Number(v))}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5, 6].map((k) => <SelectItem key={k} value={String(k)}>{k} chữ số</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="rule-start">Bắt đầu từ số</Label>
            <Input id="rule-start" inputMode="numeric" value={start} onChange={(e) => setStart(e.target.value.replace(/\D/g, "").slice(0, 6))} />
          </div>
        </div>
        <div className="bg-surface-subtle rounded-lg border px-3 py-2.5 text-sm">
          <span className="text-muted-foreground">Ví dụ: </span>
          <span className="font-mono font-medium">{prefix}{pad(n, len)}, {prefix}{pad(n + 1, len)}, {prefix}{pad(n + 2, len)}…</span>
        </div>
        <DialogFooter className="sm:justify-between">
          {rule?.custom ? (
            <Button type="button" variant="ghost" disabled={busy} onClick={() => void run("reset")}>Về mặc định</Button>
          ) : <span />}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Huỷ</Button>
            <Button type="button" disabled={busy} onClick={() => void run("save")}>Lưu</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Các loại mã của MỘT trường — bảng cùng khuôn với mọi danh sách khác của hệ thống (khung thẻ, dải tiêu đề cột,
 * menu "⋯" ở cuối dòng); bấm dòng hoặc "Sửa" mở hộp thoại.
 */
function RulesTable({ schoolId, toolbar }: { schoolId: number; toolbar: React.ReactNode }) {
  const { rules, isLoading } = useSchoolCodeRules(schoolId);
  const canWrite = useCan({ resource: "school_code_rules", action: "edit" }).data?.can ?? false;
  const [editing, setEditing] = useState<SchoolCodeRule | null>(null);
  return (
    <>
      <FillBox>
      <div className="bg-card shadow-e1 flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border">
        <div className="shrink-0 border-b px-3 py-3">{toolbar}</div>
        <div className="min-h-0 flex-1 overflow-auto [&>[data-slot=table-container]]:overflow-visible [&_tbody_tr:last-child]:border-b">
        <Table>
          <TableHeader sticky>
            <TableRow>
              <TableHead className="w-14 text-center">STT</TableHead>
              <TableHead>Loại mã</TableHead>
              <TableHead>Ký hiệu</TableHead>
              <TableHead>Phần số</TableHead>
              <TableHead>Bắt đầu từ</TableHead>
              <TableHead>Mã kế tiếp</TableHead>
              <TableHead>Cách đặt</TableHead>
              {canWrite ? <TableHead className="w-14" /> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading
              ? Array.from({ length: 6 }, (_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={canWrite ? 8 : 7}><Skeleton className="h-5 w-full" /></TableCell>
                  </TableRow>
                ))
              : rules.map((r, i) => (
                  <TableRow key={r.target} className={cn("group/row", LIFT_ROW, canWrite ? "cursor-pointer" : "cursor-default")}
                    onClick={canWrite ? () => setEditing(r) : undefined}>
                    <TableCell className="text-muted-foreground text-center tabular-nums">{i + 1}</TableCell>
                    <TableCell className="font-medium">{r.label}</TableCell>
                    <TableCell className="font-mono">{r.prefix || <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="tabular-nums">{r.numberLength} chữ số</TableCell>
                    <TableCell className="tabular-nums">{r.startNumber}</TableCell>
                    <TableCell className="font-mono font-semibold">{r.next ?? "—"}</TableCell>
                    <TableCell>
                      {r.custom ? <Badge variant="info">Riêng của trường</Badge> : <Badge variant="neutral">Mặc định</Badge>}
                    </TableCell>
                    {canWrite ? (
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <RowActions>
                          <Button type="button" variant="ghost" size="sm" className={ROW_ACTION_ITEM} onClick={() => setEditing(r)}>
                            <Pencil />
                            Sửa
                          </Button>
                        </RowActions>
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
          </TableBody>
        </Table>
        </div>
      </div>
      </FillBox>
      <EditRuleDialog rule={editing} schoolId={schoolId} onClose={() => setEditing(null)} />
    </>
  );
}

/** Trường đang xem — một dòng chữ cạnh ô chọn trường, không phải một khối riêng. */
function SchoolLine({ schoolId }: { schoolId: number }) {
  const { result: school } = useOne<School>({ resource: "schools", id: schoolId });
  if (!school) return <Skeleton className="h-5 w-56" />;
  const meta = [school.code, school.educationLevel?.name, school.departmentOfEducation?.name].filter(Boolean);
  return (
    <p className="min-w-0 truncate text-sm">
      <span className="font-medium">{school.name}</span>
      {meta.length ? <span className="text-muted-foreground"> · {meta.join(" · ")}</span> : null}
    </p>
  );
}

/**
 * Trang "Mã tự tăng của trường" (Quản trị hệ thống). Tài khoản trường thấy thẳng trường mình; tài khoản thấy nhiều
 * trường chọn trong hộp có ô tìm (hơn nghìn trường) — trường đã chọn được nhớ trong tab.
 */
export function SchoolCodeRulesPage() {
  const ownSchool = getAuthorities()?.schoolId ?? null;
  const [picked, setPicked] = usePersistentState<{ id: number; name: string } | null>("school-code-rules:school", null);
  const schoolId = ownSchool ?? picked?.id ?? null;
  const mayRead = useCan({ resource: "school_code_rules", action: "list" }).data?.can ?? false;

  const picker = ownSchool ? null : (
    <div className="w-80 max-w-full shrink-0">
      <SchoolPickerField value={picked} onChange={setPicked} placeholder="Chọn trường" />
    </div>
  );

  return (
    <ListView>
      <ListViewHeader />
      {!mayRead ? (
        <Card className="text-muted-foreground p-10 text-center text-sm">Bạn không có quyền xem quy tắc mã.</Card>
      ) : schoolId ? (
        <RulesTable schoolId={schoolId}
          toolbar={<div className="flex flex-wrap items-center gap-3">{picker}<SchoolLine schoolId={schoolId} /></div>} />
      ) : (
        <FillBox>
          <div className="bg-card shadow-e1 min-h-0 flex-1 overflow-hidden rounded-lg border">
            <div className="border-b px-3 py-3">{picker}</div>
            <p className="text-muted-foreground px-3 py-12 text-center text-sm">Chọn một trường để xem quy tắc mã.</p>
          </div>
        </FillBox>
      )}
    </ListView>
  );
}
