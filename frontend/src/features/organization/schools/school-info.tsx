import { CalendarDays, DoorOpen, GraduationCap, LayoutGrid, MapPin, School as SchoolIcon, UserRound, Users, UsersRound } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/badge";
import { ORG_STATUS_VARIANTS as STATUS_VARIANTS } from "@/shared/lib/status-variants";
import type { School } from "@/domains/school/types";
import { STATUS_LABELS } from "@/domains/school/types";

export type SchoolPerson = { id: number; name: string; phone?: string | null };

/** Người giữ một chức vụ; quá hai người thì gộp "+N người khác" — đủ danh sách ở tab Cán bộ. */
function People({ people }: { people?: SchoolPerson[] }) {
  if (!people?.length) return <span className="text-muted-foreground font-normal">Chưa khai báo</span>;
  const shown = people.slice(0, 2);
  return (
    <ul className="space-y-0.5">
      {shown.map((p) => (
        <li key={p.id}>
          {p.name}
          {p.phone ? <span className="text-muted-foreground ms-1.5 text-xs font-normal tabular-nums">{p.phone}</span> : null}
        </li>
      ))}
      {people.length > shown.length ? (
        <li className="text-muted-foreground text-xs font-normal">+{people.length - shown.length} người khác</li>
      ) : null}
    </ul>
  );
}

const count = new Intl.NumberFormat("vi-VN");

/** Một ô "nhãn nhỏ — giá trị" — cùng dáng với màn xem danh mục (`CatalogDetailSections`). */
function Fact({ label, children, className }: { label: string; children?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0", className)}>
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium break-words">
        {children ?? <span className="text-muted-foreground font-normal">—</span>}
      </dd>
    </div>
  );
}

/**
 * Một khối hồ sơ: thẻ viền mảnh, tiêu đề có biểu tượng (nút phụ bên phải tiêu đề), thân là lưới các ô `Fact` — hoặc
 * thân tự do (`bare`: bảng, ô số) cho các khối khác trên tab Hồ sơ trường đứng cùng một dáng.
 */
export function ProfileBlock({ icon, title, children, className, cols = "sm:grid-cols-2", action, bare }: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  className?: string;
  cols?: string;
  action?: React.ReactNode;
  bare?: boolean;
}) {
  return (
    <section className={cn("bg-card shadow-e1 flex flex-col rounded-lg border", className)}>
      <div className="flex min-h-11 items-center justify-between gap-2 border-b px-4 py-1.5">
        <h3 className="[&_svg]:text-primary flex items-center gap-2 text-sm font-semibold [&_svg]:size-4">
          {icon}
          {title}
        </h3>
        {action}
      </div>
      {bare ? <div className="flex-1 px-4 py-3.5">{children}</div> : <dl className={cn("grid gap-x-6 gap-y-4 px-4 py-3.5", cols)}>{children}</dl>}
    </section>
  );
}
const Block = ProfileBlock;

/**
 * Hồ sơ trường trong hộp thoại "Hồ sơ trường" — dạng HỒ SƠ chứ không phải form: đầu là ảnh, tên và
 * nhãn; dải bốn con số quy mô (cùng `StatStrip` với màn Tổng quan); rồi các khối "nhãn nhỏ — giá trị"
 * như màn xem danh mục. Thông tin chỉ để đọc thì vẽ như văn bản, không vẽ như ô nhập.
 */
export function SchoolInfoSections({
  record,
  leaders,
  scale,
  photo,
  year,
  action,
  extra,
}: {
  record?: School;
  /** Lấy từ danh sách cán bộ theo chức vụ — trường không có cột "hiệu trưởng" riêng. */
  leaders?: { principal: SchoolPerson[]; vice: SchoolPerson[]; equipment: SchoolPerson[] };
  scale?: { classes: number; students: number; staff: number; rooms: number };
  photo?: React.ReactNode;
  year?: string;
  /** Nút bên phải tên trường (vd. Sửa). */
  action?: React.ReactNode;
  /** Khối thêm đứng sau Ban giám hiệu trong cùng lưới (vd. Số liệu chung CSVC, Cơ sở). */
  extra?: React.ReactNode;
}) {
  const ward = record?.ward?.name ?? record?.wardText;
  // Gọn một màn, không cuộn: đầu hồ sơ (ảnh, tên, nút; bốn số quy mô cùng hàng) rồi một hàng ba khối — Thông tin trường
  // (gộp địa bàn), Ban giám hiệu, và khối thêm của bên gọi (Số liệu chung CSVC).
  return (
    <div className="space-y-4">
      <div className="bg-card shadow-e1 flex flex-wrap items-center gap-x-6 gap-y-4 rounded-lg border px-4 py-3.5">
        {photo ? <div className="w-20 shrink-0">{photo}</div> : null}
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl leading-tight font-semibold tracking-tight break-words">{record?.name ?? "—"}</h2>
            <SchoolStatusBadge record={record} />
          </div>
          <p className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-sm [&_svg]:size-3.5 [&_svg]:shrink-0">
            {record?.educationLevel?.name ? (
              <span className="flex items-center gap-1.5"><GraduationCap />{record.educationLevel.name}</span>
            ) : null}
            {year ? <span className="flex items-center gap-1.5"><CalendarDays />{year}</span> : null}
            {ward ? <span className="flex items-center gap-1.5"><MapPin />{ward}</span> : null}
          </p>
        </div>
        {scale ? (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            {[
              { icon: <LayoutGrid />, label: "Lớp", value: scale.classes },
              { icon: <Users />, label: "Học sinh", value: scale.students },
              { icon: <UserRound />, label: "Cán bộ, GV", value: scale.staff },
              { icon: <DoorOpen />, label: "Phòng", value: scale.rooms },
            ].map((f) => (
              <div key={f.label} className="flex items-center gap-2">
                <span className="text-primary flex shrink-0 [&_svg]:size-5">{f.icon}</span>
                <div>
                  <p className="text-muted-foreground text-xs leading-tight">{f.label}</p>
                  <p className="text-lg leading-tight font-bold tabular-nums">{count.format(f.value)}</p>
                </div>
              </div>
            ))}
          </div>
        ) : null}
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>

      <div className="grid items-stretch gap-4 lg:grid-cols-3">
        <Block icon={<SchoolIcon />} title="Thông tin trường">
          <Fact label="Mã trường"><span className="font-mono">{record?.code}</span></Fact>
          <Fact label="Mã trường của Bộ">{record?.moetCode || null}</Fact>
          <Fact label="Mã hai ký tự">{record?.shortCode || null}</Fact>
          <Fact label="Loại hình trường">{record?.schoolType?.name}</Fact>
          <Fact label="Phường/Xã">
            {record?.ward ? (
              record.ward.name
            ) : record?.wardText ? (
              <span className="text-warning-text">{record.wardText} · chưa chuẩn hoá</span>
            ) : null}
          </Fact>
          <Fact label="Cơ quan quản lý">{record?.departmentOfEducation?.name}</Fact>
          <Fact label="Địa chỉ" className="sm:col-span-2">{record?.address || null}</Fact>
        </Block>
        {leaders ? (
          <Block icon={<UsersRound />} title="Ban giám hiệu" cols="grid-cols-1">
            <Fact label="Hiệu trưởng"><People people={leaders.principal} /></Fact>
            <Fact label="Phó hiệu trưởng"><People people={leaders.vice} /></Fact>
            <Fact label="Cán bộ thiết bị"><People people={leaders.equipment} /></Fact>
          </Block>
        ) : null}
        {extra}
      </div>
    </div>
  );
}

/** Trạng thái của trường dạng nhãn — cho đầu hộp thoại hồ sơ. */
export function SchoolStatusBadge({ record }: { record?: School }) {
  return record ? (
    <Badge variant={STATUS_VARIANTS[record.status] ?? "secondary"}>{STATUS_LABELS[record.status] ?? record.status}</Badge>
  ) : null;
}
