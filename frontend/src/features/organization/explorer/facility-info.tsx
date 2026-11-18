import { useCan, useList } from "@refinedev/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil } from "lucide-react";
import { useState } from "react";

import { kyInstance } from "@/shared/api/data";
import { errorMessage } from "@/shared/lib/api-error";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { Fact as ProfileFact, InlineEdit, PROFILE_GRID, ProfileSection, SourceLink } from "@/features/organization/schools/school-info";
import { DetailTable, type DetailColumn } from "@/shared/components/data-table/detail-table";
import { TableEmpty } from "@/shared/components/data-table/table-empty";
import { QueryError } from "@/shared/components/query-error";
import { LoadingText } from "@/shared/components/spinner";
import { numberError } from "@/shared/lib/field-rules";

/** Thông tin chung CSVC của một trường như `GET /api/facility_info/{id}` trả. */
export type FacilityInfo = {
  schoolId: number;
  landArea: number | null;
  constructionArea: number | null;
  /** null = chưa có lớp năm học hiện hành. Học sinh chỉ cộng lớp đã có sĩ số. */
  studentCount: number | null;
  classCount: number | null;
  /** Số lớp năm nay chưa có sĩ số (trống hoặc 0). */
  classesMissingSize: number;
  landPerStudent: number | null;
  /** Học sinh / lớp của cơ sở: tính từ phòng học của lớp, chỉ đọc. */
  campuses: { id: number; code: string; name: string; kind: "MAIN" | "BRANCH" | "POINT"; studentCount: number | null; classCount: number | null }[];
  rooms: number;
  areas: number;
  buildings: number;
  noStructure: number;
  diningSeats: number;
  boardingSeats: number;
  librarySeats: number;
  /** Số hạng mục theo khối CSVC; `id` null = chưa phân loại. */
  groups: { id: number | null; code: string | null; name: string; count: number; area: number | null }[];
  /** Số hạng mục, diện tích theo kết cấu; `key` null = chưa khai. */
  structures: { key: string | null; count: number; area: number }[];
  totalArea: number;
};

export const facilityInfoKey = (schoolId: number) => ["facility_info", schoolId];

const num = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 });
const KIND: Record<string, string> = { MAIN: "Trường chính", BRANCH: "Phân hiệu", POINT: "Điểm trường" };

/** Diện tích gõ kiểu Việt ("1.250,5" hoặc "1250,5") → số; rỗng → null (xoá). */
function parseArea(text: string): number | null {
  const s = text.trim().replace(/\s/g, "");
  if (s === "") return null;
  return Number(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s);
}

/** Lỗi của ô diện tích theo luật chuẩn AREA (field-rules) — cùng luật máy chủ kiểm. */
function areaError(label: string, text: string): string | undefined {
  const n = parseArea(text);
  if (n == null) return undefined;
  return numberError("AREA", label, Number.isNaN(n) ? text : n);
}

/** Danh sách làm nên một số tự tính của khối Số liệu chung CSVC. */
type FacilityDetailKind =
  | { kind: "rooms"; typeCode: string; title: string; seats: string; beds?: boolean }
  | { kind: "classes"; title: string };

const DETAILS = {
  dining: { kind: "rooms", typeCode: "NHA_AN", title: "Chỗ nhà ăn", seats: "Sức chứa" },
  boarding: { kind: "rooms", typeCode: "NHA_O_NOI_TRU", title: "Chỗ nội trú", seats: "Số giường", beds: true },
  library: { kind: "rooms", typeCode: "THU_VIEN", title: "Chỗ thư viện", seats: "Sức chứa" },
  classes: { kind: "classes", title: "Lớp năm học hiện hành" },
} satisfies Record<string, FacilityDetailKind>;

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * "Xem chi tiết" của một số tự tính: hộp `DetailTable` (khuôn chung của hộp xem danh sách chi tiết) liệt kê đúng các
 * phòng / lớp được cộng vào số đó — phòng đang dùng của loại tương ứng, hoặc lớp của năm học hiện hành.
 */
function FacilityDetailDialog({ schoolId, kind, onClose }: { schoolId: number; kind: FacilityDetailKind; onClose: () => void }) {
  const rooms = kind.kind === "rooms";
  const { result: years } = useList<any>({ resource: "school_years", pagination: { pageSize: 50 }, queryOptions: { enabled: !rooms } });
  const yearId = (years?.data ?? []).find((y: any) => y.current)?.id;
  const { result, query } = useList<any>({
    resource: rooms ? "rooms" : "school_classes",
    filters: [
      { field: "school.id", operator: "eq", value: schoolId },
      ...(!rooms && yearId ? [{ field: "schoolYear.id", operator: "eq" as const, value: yearId }] : []),
    ],
    pagination: { pageSize: 1000 },
    queryOptions: { enabled: rooms || !!yearId },
  });
  const all = result?.data ?? [];
  const rows = rooms
    ? all.filter((r: any) => r.roomType?.code === kind.typeCode && r.active !== false)
    : all.filter((c: any) => c.active !== false);
  const columns: DetailColumn[] = rooms
    ? [
      { key: "code", label: "Mã" },
      { key: "name", label: "Tên phòng" },
      { key: "building", label: "Khối nhà" },
      { key: "seats", label: kind.seats, numeric: true },
    ]
    : [
      { key: "name", label: "Lớp" },
      { key: "grade", label: "Khối" },
      { key: "studentCount", label: "Sĩ số", numeric: true },
      { key: "room", label: "Phòng học" },
    ];
  const seatsOf = (r: any) => {
    const beds = kind.kind === "rooms" && kind.beds ? Number(r.params?.beds) : NaN;
    return Number.isFinite(beds) ? beds : r.capacity;
  };
  const text = (row: any, c: DetailColumn): string => {
    switch (c.key) {
      case "building": return row.building?.name ?? "";
      case "grade": return row.grade?.name ?? "";
      case "room": return row.room?.name ?? "";
      case "seats": { const v = seatsOf(row); return v == null ? "" : num.format(v); }
      case "studentCount": return row.studentCount == null ? "" : num.format(row.studentCount);
      default: return row[c.key] == null ? "" : String(row[c.key]);
    }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="wide" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>{kind.title}</DialogTitle>
          <DialogDescription>
            {rooms ? `Các phòng đang dùng được cộng vào số này (${rows.length} phòng).` : `${rows.length} lớp — học sinh là tổng sĩ số các lớp.`}
          </DialogDescription>
        </DialogHeader>
        {query.isLoading ? <LoadingText className="py-6" /> : (
          <DetailTable columns={columns} rows={rows} context={[kind.title]} text={text}
            searchPlaceholder={rooms ? "Tìm theo mã hoặc tên phòng…" : "Tìm lớp…"} />
        )}
      </DialogContent>
    </Dialog>
  );
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export function useFacilityInfo(schoolId: number) {
  return useQuery({
    queryKey: facilityInfoKey(schoolId),
    queryFn: ({ signal }) => kyInstance.get(`facility_info/${schoolId}`, { signal }).json<FacilityInfo>(),
  });
}

/** Dòng nhắc khi số học sinh / lớp chưa đủ: chưa có lớp năm nay, hoặc có lớp chưa nhập sĩ số. */
function ClassWarning({ info }: { info: FacilityInfo }) {
  const text = info.classCount == null ? "Chưa có danh sách lớp năm học hiện hành"
    : info.classesMissingSize > 0 ? `${num.format(info.classesMissingSize)} lớp chưa có sĩ số` : null;
  return text ? <p className="text-warning-text text-xs">{text}</p> : null;
}

/**
 * Một ô "nhãn nhỏ — giá trị" như khối hồ sơ trường. `onFill`: ô trường tự nhập — còn trống thì hiện "Chưa khai ·
 * Nhập" màu cam ngay tại ô (nhắc nhẹ, không chèn khung cảnh báo). `source`: ô tự tính — dòng nguồn nhỏ dưới số.
 */
function Fact({ label, value, unit, onFill, source, empty = "Chưa có" }: {
  label: string;
  value: number | null | undefined;
  unit?: string;
  onFill?: () => void;
  source?: React.ReactNode;
  /** Chữ khi chưa có số (không để "—" — trưởng nhóm 12/11/2026), vd. "Cần diện tích đất". */
  empty?: string;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-muted-foreground truncate text-xs">{label}:</dt>
      <dd className="mt-0.5 text-sm font-medium tabular-nums">
        {value == null ? (
          onFill ? (
            <button type="button" onClick={onFill} title="Nhập" className="text-warning-text hover:text-warning-text/80 inline-flex items-center gap-1.5 text-[0.8125rem] font-medium">
              Chưa khai
              <Pencil className="size-3.5" />
            </button>
          ) : <span className="text-muted-foreground text-[0.8125rem] font-normal">{empty}</span>
        ) : num.format(value)}
        {value != null && unit ? <span className="text-muted-foreground ms-1 text-xs font-normal">{unit}</span> : null}
      </dd>
      {source ? <div className="mt-0.5 grid">{source}</div> : null}
    </div>
  );
}

/** Một ô số: nhãn nhỏ trên, số to dưới. */
function Stat({ label, value, unit, tone }: { label: string; value: number | null | undefined; unit?: string; tone?: "warn" }) {
  return (
    <div className="bg-surface-subtle min-w-0 rounded-lg border px-3 py-2.5">
      <div className="text-muted-foreground truncate text-xs">{label}</div>
      <div className={tone === "warn" && value ? "text-warning-text text-lg font-semibold tabular-nums" : "text-lg font-semibold tabular-nums"}>
        {value == null ? <span className="text-muted-foreground text-sm font-normal">Chưa có</span> : num.format(value)}
        {value != null && unit ? <span className="text-muted-foreground ml-1 text-xs font-normal">{unit}</span> : null}
      </div>
    </div>
  );
}

/**
 * Thông tin chung CSVC của trường — phần A của biểu số liệu Sở: diện tích đất / xây dựng, học sinh, lớp,
 * trường chính / phân hiệu / điểm trường, số chỗ nhà ăn / nội trú / thư viện; kèm số mục chưa khai kết cấu, chờ xác
 * nhận để trường biết còn thiếu gì trước khi lập biểu.
 */
export function FacilityInfoPanel({ schoolId, general, onGo }: {
  schoolId: number;
  general?: boolean;
  /** Mở tab / mục nguồn của một số tự tính ("classes", "rooms"…). */
  onGo?: (tab: string) => void;
}) {
  const query = useFacilityInfo(schoolId);
  const { data, isLoading } = query;
  const mayEdit = useCan({ resource: "rooms", action: "edit" }).data?.can ?? false;
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<FacilityDetailKind | null>(null);
  const queryClient = useQueryClient();
  // Lỗi thì nói lỗi, không để "Đang tải..." quay mãi.
  if (query.isError) return <QueryError error={query.error} onRetry={() => void query.refetch()} retrying={query.isFetching} />;
  if (isLoading || !data) return <LoadingText className="py-6" />;
  if (general) {
    const go = (tab: string) => (onGo ? () => onGo(tab) : undefined);
    const classes = data.classCount == null ? "lớp" : `${num.format(data.classCount)} lớp`;
    const saveArea = (field: "landArea" | "constructionArea") => async (next: string) => {
      try {
        await kyInstance.patch(`facility_info/${schoolId}`, { json: { [field]: parseArea(next) } }).json();
      } catch (error) {
        throw new Error(await errorMessage(error));
      }
      await queryClient.invalidateQueries({ queryKey: facilityInfoKey(schoolId) });
    };
    const area = (field: "landArea" | "constructionArea", label: string) => {
      const value = data[field];
      return mayEdit ? (
        <div className="min-w-0">
          <dt className="text-muted-foreground truncate text-xs">{label}:</dt>
          <dd className="mt-0.5 text-sm font-medium tabular-nums">
            <InlineEdit value={value == null ? null : String(value).replace(".", ",")} label={label} inputMode="decimal"
              display={<>{num.format(value ?? 0)}<span className="text-muted-foreground ms-1 text-xs font-normal">m²</span></>}
              check={(d) => areaError(label, d)} onSave={saveArea(field)} />
          </dd>
        </div>
      ) : <Fact label={label} value={value} unit="m²" />;
    };
    const more = (kind: FacilityDetailKind) => <SourceLink onClick={() => setDetail(kind)}>Xem chi tiết</SourceLink>;
    // Tab Hồ sơ trường (phương án A, 13/11/2026): HAI phần cùng dáng các phần hồ sơ — tám số chung lưới 4 cột, rồi bảng
    // cơ sở / điểm trường. Diện tích sửa ngay tại ô (không hộp thoại); số tự tính có "Xem chi tiết" mở danh sách.
    return (
      <>
        <ProfileSection k="campuses" title="Cơ sở, điểm trường">
          {/* Cùng dáng các phần khác (nhãn: giá trị, lưới 4 cột) — mỗi cơ sở một hàng, không bảng riêng. */}
          {data.campuses.length === 0 ? (
            <p className="text-muted-foreground text-sm">Chưa có cơ sở nào.</p>
          ) : (
            <div className="space-y-4">
              {data.campuses.map((c) => (
                <dl key={c.id} className={PROFILE_GRID}>
                  <ProfileFact label="Tên">{c.name}</ProfileFact>
                  <ProfileFact label="Loại">{KIND[c.kind]}</ProfileFact>
                  <ProfileFact label="Học sinh">{c.studentCount == null ? null : num.format(c.studentCount)}</ProfileFact>
                  <ProfileFact label="Lớp">{c.classCount == null ? null : num.format(c.classCount)}</ProfileFact>
                </dl>
              ))}
            </div>
          )}
        </ProfileSection>
        <ProfileSection k="csvc" title="Số liệu chung CSVC">
          <dl className={PROFILE_GRID}>
            {area("landArea", "Diện tích đất")}
            {area("constructionArea", "Diện tích xây dựng")}
            <Fact label="Đất / học sinh" value={data.landPerStudent} unit="m²" empty="Cần diện tích đất"
              source={data.landPerStudent == null ? undefined : <SourceLink>đất ÷ học sinh</SourceLink>} />
            <Fact label="Học sinh" value={data.studentCount} source={<SourceLink onClick={go("classes")}>{`sĩ số ${classes}`}</SourceLink>} />
            <Fact label="Chỗ nhà ăn" value={data.diningSeats} source={more(DETAILS.dining)} />
            <Fact label="Chỗ nội trú" value={data.boardingSeats} source={more(DETAILS.boarding)} />
            <Fact label="Chỗ thư viện" value={data.librarySeats} source={more(DETAILS.library)} />
            <Fact label="Lớp" value={data.classCount} source={more(DETAILS.classes)} />
          </dl>
          {detail ? <FacilityDetailDialog schoolId={schoolId} kind={detail} onClose={() => setDetail(null)} /> : null}
          <div className="mt-2"><ClassWarning info={data} /></div>
        </ProfileSection>
      </>
    );
  }
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-end gap-2">
        {mayEdit ? (
          <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
            <Pencil />
            Sửa số liệu chung
          </Button>
        ) : null}
      </div>
      <div className={general ? "grid grid-cols-2 gap-3 sm:grid-cols-4" : "grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6"}>
        <Stat label="Diện tích đất" value={data.landArea} unit="m²" />
        <Stat label="Diện tích xây dựng" value={data.constructionArea} unit="m²" />
        <Stat label="Đất / học sinh" value={data.landPerStudent} unit="m²" />
        <Stat label="Học sinh" value={data.studentCount} />
        <Stat label="Lớp" value={data.classCount} />
        {general ? null : (
          <>
            <Stat label="Khối nhà" value={data.buildings} />
            <Stat label="Phòng, nhà" value={data.rooms} />
            <Stat label="Khu vực, công trình" value={data.areas} />
          </>
        )}
        <Stat label="Chỗ nhà ăn" value={data.diningSeats} />
        <Stat label="Chỗ nội trú" value={data.boardingSeats} />
        <Stat label="Chỗ thư viện" value={data.librarySeats} />
        {general ? null : <Stat label="Chưa khai kết cấu" value={data.noStructure} tone="warn" />}
      </div>
      <ClassWarning info={data} />
      <div className="bg-card overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cơ sở</TableHead>
              <TableHead>Loại</TableHead>
              <TableHead className="text-right">Học sinh</TableHead>
              <TableHead className="text-right">Lớp</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.campuses.length === 0 ? (
              <TableEmpty colSpan={4} compact title={<>Chưa có cơ sở nào.</>} />
            ) : data.campuses.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell>{c.kind === "MAIN" ? <Badge variant="info">{KIND[c.kind]}</Badge> : KIND[c.kind]}</TableCell>
                <TableCell className="text-right tabular-nums">{c.studentCount == null ? "—" : num.format(c.studentCount)}</TableCell>
                <TableCell className="text-right tabular-nums">{c.classCount == null ? "—" : num.format(c.classCount)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {open ? <EditDialog info={data} onClose={() => setOpen(false)} /> : null}
    </div>
  );
}

function EditDialog({ info, onClose }: { info: FacilityInfo; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [v, setV] = useState({
    landArea: info.landArea?.toString() ?? "",
    constructionArea: info.constructionArea?.toString() ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const toNum = (s: string) => (s.trim() === "" ? null : Number(s.replace(",", ".")));
  const bad = Object.values(v).some((s) => s.trim() !== "" && (Number.isNaN(Number(s.replace(",", "."))) || Number(s.replace(",", ".")) < 0));
  async function save() {
    setBusy(true);
    setProblem(null);
    try {
      // Chỉ gửi ô đã đổi: ô vắng là để nguyên, null là xoá.
      const json: Record<string, number | null> = {};
      if (toNum(v.landArea) !== info.landArea) json.landArea = toNum(v.landArea);
      if (toNum(v.constructionArea) !== info.constructionArea) json.constructionArea = toNum(v.constructionArea);
      await kyInstance.patch(`facility_info/${info.schoolId}`, { json }).json();
      await queryClient.invalidateQueries({ queryKey: facilityInfoKey(info.schoolId) });
      onClose();
    } catch (error) {
      setProblem(await errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  const field = (key: keyof typeof v, label: string) => (
    <div className="grid gap-2">
      <Label htmlFor={`fi-${key}`}>{label}</Label>
      <Input id={`fi-${key}`} inputMode="decimal" value={v[key]} onChange={(e) => setV({ ...v, [key]: e.target.value })} />
    </div>
  );
  return (
    <Dialog open onOpenChange={(o) => (o ? null : onClose())}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Số liệu chung</DialogTitle>
          <DialogDescription>Diện tích dùng cho phần A của biểu số liệu CSVC.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4">
          {field("landArea", "Diện tích đất (m²)")}
          {field("constructionArea", "Diện tích xây dựng (m²)")}
        </div>
        {/* Số học sinh, số lớp không nhập ở đây: tính từ danh sách lớp đã khai của năm học hiện tại. */}
        <p className="text-muted-foreground text-xs">
          Số học sinh {info.studentCount == null ? "—" : num.format(info.studentCount)} · số lớp {info.classCount == null ? "—" : num.format(info.classCount)}: tính từ danh sách lớp năm học hiện hành.
        </p>
        {bad ? <p className="text-destructive-text text-xs">Nhập số không âm.</p> : null}
        {problem ? <p role="alert" className="text-destructive-text text-xs">{problem}</p> : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Huỷ</Button>
          <Button type="button" disabled={busy || bad} onClick={() => void save()}>{busy ? "Đang lưu…" : "Lưu"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
