import { useCan } from "@refinedev/core";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BookCheck } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";

import { kyInstance } from "@/shared/api/data";
import { HelpHint } from "@/shared/components/form/help-hint";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Skeleton } from "@/shared/ui/skeleton";
import type { NormRow } from "@/domains/procurement/types";

/** Màn "Đối chiếu tối thiểu" đang tạm ẩn (theo trưởng nhóm) — bật lại cùng tab trong `modules.tsx`. */
const ADEQUACY_SCREEN_ENABLED: boolean = true;

type NormLine = {
  code: string;
  levelCode: string;
  levelName: string;
  itemNo: string | null;
  section: string | null;
  topic: string | null;
  gradeLevels: string | null;
  quantityText: string | null;
  forTeacher: boolean;
  forStudent: boolean;
  optional: boolean;
};

type CatalogStandard = {
  status: "MINIMUM" | "OTHER_LEVEL" | "NOT_MINIMUM" | "SCHOOL_ITEM";
  catalogCode: string;
  catalogName: string;
  typeName: string | null;
  subjectName: string | null;
  legalBasis: string | null;
  schoolLevel: string | null;
  norms: NormLine[];
  adequacy: NormRow | null;
};

const STATUS: Record<CatalogStandard["status"], { label: (s: CatalogStandard) => string; variant: "success" | "warning" | "neutral" }> = {
  MINIMUM: { label: (s) => `Thuộc danh mục tối thiểu${s.schoolLevel ? ` · ${s.schoolLevel}` : ""}`, variant: "success" },
  OTHER_LEVEL: { label: () => "Thuộc danh mục tối thiểu của cấp học khác", variant: "warning" },
  NOT_MINIMUM: { label: () => "Ngoài danh mục tối thiểu", variant: "neutral" },
  SCHOOL_ITEM: { label: () => "Thiết bị ngoài danh mục (trường tự thêm)", variant: "neutral" },
};

/** Một ô của dải ba số: nhãn ngắn, con số, và (nếu có) một ghi chú đứng cùng hàng với số. */
function Stat({ label, value, note, tone }: { label: string; value: ReactNode; note?: ReactNode; tone?: "ok" | "short" | "unknown" }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 px-4 py-3 first:ps-0">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="flex min-w-0 flex-wrap items-baseline gap-x-2">
        <span
          className={cn(
            "text-xl font-semibold tabular-nums",
            tone === "ok" && "text-success-text",
            tone === "short" && "text-destructive-text",
            tone === "unknown" && "text-warning-text text-base",
          )}
        >
          {value}
        </span>
        {note ? <span className="text-muted-foreground text-xs">{note}</span> : null}
      </span>
    </div>
  );
}

const audience = (n: NormLine) => [n.forTeacher ? "giáo viên" : null, n.forStudent ? "học sinh" : null].filter(Boolean).join(", ");

/** Một dòng phụ lục nói bằng lời: "01 bộ/5 lớp · mọi lớp · dùng cho giáo viên". */
const normText = (n: NormLine, showLevel: boolean) =>
  [
    showLevel ? n.levelName : null,
    n.quantityText,
    n.gradeLevels ? `lớp ${n.gradeLevels.replaceAll(",", ", ")}` : "mọi lớp",
    audience(n) ? `dùng cho ${audience(n)}` : null,
  ].filter(Boolean).join(" · ");

/**
 * Tài sản này so với CHUẨN (danh mục thiết bị dạy học tối thiểu, TT 37/38/39), đọc từ trên xuống: nhãn
 * "thuộc danh mục hay không", một dải ba số (phải có · đang có · kết quả), rồi định mức của thông tư
 * viết thành một dòng. Mã, loại, môn của thiết bị KHÔNG lặp lại ở đây — hồ sơ ngay phía trên đã có;
 * căn cứ pháp lý nằm sau dấu "?" cạnh tiêu đề. Đọc `GET /equipment/{id}/standard`.
 */
/** Đọc chuẩn của thiết bị — cùng khoá với thẻ đầy đủ nên không gọi máy chủ hai lần. */
function useEquipmentStandard(equipmentId: number) {
  return useQuery({
    queryKey: ["equipment", equipmentId, "standard"],
    queryFn: ({ signal }) => kyInstance.get(`equipment/${equipmentId}/standard`, { signal }).json<CatalogStandard>(),
    staleTime: 60_000,
  });
}

/** Một dòng tóm tắt cho dải thông tin đầu hồ sơ: "Đủ 24 / 2 · thừa 22", "Thiếu 3", "Ngoài danh mục". */
export function EquipmentStandardSummary({ equipmentId }: { equipmentId: number }) {
  const { data, isLoading } = useEquipmentStandard(equipmentId);
  if (isLoading) return <Skeleton className="h-4 w-24" />;
  if (!data) return <span className="text-muted-foreground">—</span>;
  const a = data.adequacy;
  if (!a || data.status !== "MINIMUM") {
    return <span className="text-muted-foreground font-normal">{data.status === "OTHER_LEVEL" ? "Cấp học khác" : "Ngoài danh mục"}</span>;
  }
  if (a.optional) return <span>Tự chọn</span>;
  if (a.shortage == null || a.required == null) return <span className="text-muted-foreground font-normal">Chưa tính được</span>;
  return (
    <span title={`Trường phải có ${a.required}, đang có ${a.current} dùng được`}>
      <span className={a.shortage === 0 ? "text-success-text" : "text-destructive-text"}>{a.shortage === 0 ? "Đủ" : `Thiếu ${a.shortage}`}</span>
      <span className="text-muted-foreground font-normal"> (cần có {a.required}, đang có {a.current})</span>
    </span>
  );
}

/** Thẻ nhỏ ở tab Tổng quan của hồ sơ: ba ô Cần có / Đang có / Thừa hoặc Thiếu, định mức một dòng. */
export function EquipmentStandardMini({ equipmentId }: { equipmentId: number }) {
  const { data, isLoading } = useEquipmentStandard(equipmentId);
  const mayOpenAdequacy = useCan({ resource: "equipment_adequacy", action: "list" }).data?.can ?? false;
  if (isLoading) return <Skeleton className="h-24 w-full" />;
  if (!data) return null;
  const a = data.adequacy;
  const minimum = data.status === "MINIMUM";
  const norm = data.norms.find((n) => !minimum || n.levelName === data.schoolLevel) ?? data.norms[0];
  if (!a || !minimum) {
    return <p className="text-muted-foreground text-sm">{STATUS[data.status].label(data)}. Không có định mức, không tính đủ hay thiếu.</p>;
  }
  const diff = a.shortage == null ? null : a.shortage > 0 ? -a.shortage : (a.surplus ?? 0);
  // Mỗi ô một màu: Cần có (định mức) vàng đồng, Đang có xanh dương, Thừa xanh lá / Thiếu đỏ.
  const box = "rounded-lg py-2.5 text-center";
  return (
    <div className="flex h-full flex-col gap-3">
      <div className="grid grid-cols-3 gap-2">
        <div className={cn(box, "bg-gold-subtle")}><div className="text-gold-text text-xl font-bold">{a.required ?? "—"}</div><div className="text-muted-foreground text-xs">Cần có</div></div>
        <div className={cn(box, "bg-info-subtle")}><div className="text-info-text text-xl font-bold">{a.current}</div><div className="text-muted-foreground text-xs">Đang có</div></div>
        <div className={cn(box, diff != null && diff < 0 ? "bg-destructive-subtle" : diff != null ? "bg-success-subtle" : "bg-surface-subtle")}>
          <div className={cn("text-xl font-bold", diff != null && diff < 0 ? "text-destructive-text" : "text-success-text")}>
            {diff == null ? "—" : diff > 0 ? `+${diff}` : diff}
          </div>
          <div className="text-muted-foreground text-xs">{diff != null && diff < 0 ? "Thiếu" : "Thừa"}</div>
        </div>
      </div>
      <div className="mt-auto space-y-1 text-sm">
        {norm ? <p className="text-muted-foreground text-xs">Định mức: {normText(norm, !minimum)}</p> : null}
        {ADEQUACY_SCREEN_ENABLED && mayOpenAdequacy ? (
          <Link to="/equipment-minimum" className="text-primary inline-flex items-center gap-1 font-medium hover:underline">
            Chuẩn tối thiểu của trường<ArrowRight className="size-3.5" />
          </Link>
        ) : null}
      </div>
    </div>
  );
}

export function EquipmentStandardCard({ equipmentId }: { equipmentId: number; catalogId?: number | null }) {
  const { data, isLoading } = useEquipmentStandard(equipmentId);
  const mayOpenAdequacy = useCan({ resource: "equipment_adequacy", action: "list" }).data?.can ?? false;

  if (isLoading) return <Skeleton className="h-28 w-full" />;
  if (!data) return null;
  const st = STATUS[data.status];
  const a = data.adequacy;
  const minimum = data.status === "MINIMUM";
  const own = data.norms.filter((n) => !minimum || n.levelName === data.schoolLevel);
  const all = own.length ? own : data.norms;
  const lines = all.slice(0, 4);
  const more = all.length - lines.length;
  const surplus = a?.surplus ?? 0;

  return (
    <Card className="gap-3">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <BookCheck className="text-muted-foreground size-4" />
          Chuẩn thiết bị dạy học tối thiểu
          {data.legalBasis ? <HelpHint label="Căn cứ pháp lý">Căn cứ: {data.legalBasis}</HelpHint> : null}
        </CardTitle>
        <Badge variant={st.variant}>{st.label(data)}</Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        {a ? (
          <div className="grid divide-y sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            <Stat
              label="Trường phải có"
              value={a.required ?? "Chưa tính được"}
              note={a.required == null ? a.warning : undefined}
              tone={a.required == null ? "unknown" : undefined}
            />
            <Stat label="Đang có, dùng được" value={a.current} note={a.proposed ? `đang đề xuất mua thêm ${a.proposed}` : undefined} />
            <Stat
              label="Kết quả"
              value={a.optional ? "Tự chọn" : a.shortage == null ? "—" : a.shortage === 0 ? "Đủ" : `Thiếu ${a.shortage}`}
              note={a.optional ? "chỉ trang bị khi trường chọn phương án / môn này" : surplus > 0 ? `thừa ${surplus}` : undefined}
              tone={a.optional || a.shortage == null ? undefined : a.shortage === 0 ? "ok" : "short"}
            />
          </div>
        ) : data.status === "NOT_MINIMUM" || data.status === "SCHOOL_ITEM" ? (
          <p className="text-muted-foreground text-sm">
            Thiết bị này không có trong thông tư nên không có định mức, không tính đủ hay thiếu.
          </p>
        ) : null}

        {lines.length ? (
          <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2 border-t pt-3 text-sm">
            <div className="min-w-0 space-y-1">
              {lines.map((n, i) => (
                <p key={n.code} className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-muted-foreground shrink-0">{i === 0 ? "Định mức theo thông tư:" : "và"}</span>
                  <span>
                    {normText(n, !minimum)}
                    {n.topic ? <span className="text-muted-foreground"> ({n.topic})</span> : null}
                  </span>
                  {n.optional ? <Badge variant="neutral">Tự chọn</Badge> : null}
                </p>
              ))}
              {more > 0 ? <p className="text-muted-foreground text-xs">và {more} dòng khác trong danh mục thiết bị.</p> : null}
            </div>
            {ADEQUACY_SCREEN_ENABLED && minimum && mayOpenAdequacy ? (
              <Link to="/equipment-minimum" className="text-primary inline-flex shrink-0 items-center gap-1 font-medium hover:underline">
                Chuẩn tối thiểu của trường
                <ArrowRight className="size-3.5" />
              </Link>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
