import { Badge } from "@/shared/ui/badge";
import { ORG_STATUS_VARIANTS as STATUS_VARIANTS } from "@/shared/lib/status-variants";
import type { School } from "@/domains/school/types";
import { STATUS_LABELS } from "@/domains/school/types";

export type SchoolPerson = { id: number; name: string; phone?: string | null };

/** Người giữ một chức vụ; quá hai người thì gộp "+N người khác" — đủ danh sách ở tab Cán bộ. */
function People({ people }: { people?: SchoolPerson[] }) {
  if (!people?.length) return <span className="text-muted-foreground">Chưa khai báo</span>;
  const shown = people.slice(0, 2);
  return (
    <ul className="space-y-0.5">
      {shown.map((p) => (
        <li key={p.id}>
          {p.name}
          {p.phone ? <span className="text-muted-foreground ms-1.5 text-xs font-normal">{p.phone}</span> : null}
        </li>
      ))}
      {people.length > shown.length ? (
        <li className="text-muted-foreground text-xs font-normal">+{people.length - shown.length} người khác</li>
      ) : null}
    </ul>
  );
}

const count = new Intl.NumberFormat("vi-VN");

/** Một dòng "nhãn — giá trị" của danh sách hồ sơ. */
function Row({ label, children }: { label: string; children?: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[9.5rem_minmax(0,1fr)] gap-3 border-b py-2.5 text-sm last:border-b-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium break-words">{children ?? <span className="text-muted-foreground font-normal">—</span>}</dd>
    </div>
  );
}

function Block({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={className}>
      <h3 className="text-overline text-muted-foreground mb-1">{title}</h3>
      <dl>{children}</dl>
    </section>
  );
}

/**
 * Hồ sơ trường trong hộp thoại "Hồ sơ trường" — dạng HỒ SƠ chứ không phải form: đầu là ảnh, tên và
 * nhãn; một dải bốn con số quy mô; rồi các nhóm "nhãn — giá trị" chia hai cột. Thông tin chỉ để
 * đọc thì vẽ như văn bản, không vẽ như ô nhập — ô nhập là lời mời gõ vào.
 */
export function SchoolInfoSections({
  record,
  leaders,
  scale,
  photo,
  year,
}: {
  record?: School;
  /** Lấy từ danh sách cán bộ theo chức vụ — trường không có cột "hiệu trưởng" riêng. */
  leaders?: { principal: SchoolPerson[]; vice: SchoolPerson[]; equipment: SchoolPerson[] };
  scale?: { classes: number; students: number; staff: number; rooms: number };
  photo?: React.ReactNode;
  year?: string;
}) {
  const figures = scale
    ? [
        { label: "Lớp học", value: scale.classes },
        { label: "Học sinh", value: scale.students },
        { label: "Cán bộ, giáo viên", value: scale.staff },
        { label: "Phòng", value: scale.rooms },
      ]
    : [];
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start gap-5">
        {photo ? <div className="w-32 shrink-0">{photo}</div> : null}
        <div className="min-w-0 flex-1 space-y-2 pt-1">
          <h2 className="text-2xl font-semibold tracking-tight">{record?.name ?? "—"}</h2>
          <div className="flex flex-wrap items-center gap-2">
            <span className="bg-muted rounded-md px-2 py-0.5 font-mono text-xs font-medium">{record?.code ?? "—"}</span>
            <SchoolStatusBadge record={record} />
          </div>
          <p className="text-muted-foreground text-sm">
            {[record?.educationLevel?.name, year, record?.ward?.name ?? record?.wardText].filter(Boolean).join(" · ")}
          </p>
        </div>
      </div>

      {figures.length ? (
        <div className="grid grid-cols-2 divide-y rounded-lg border sm:grid-cols-4 sm:divide-x sm:divide-y-0">
          {figures.map((f) => (
            <div key={f.label} className="px-4 py-3">
              <div className="text-muted-foreground text-xs">{f.label}</div>
              <div className="text-xl font-semibold tabular-nums">{count.format(f.value)}</div>
            </div>
          ))}
        </div>
      ) : null}

      <div className="grid gap-x-10 gap-y-6 md:grid-cols-2">
        <Block title="Thông tin trường">
          <Row label="Mã trường">{record?.code}</Row>
          <Row label="Mã trường của Bộ">{record?.moetCode || null}</Row>
          <Row label="Mã hai ký tự">{record?.shortCode || null}</Row>
          <Row label="Cấp học">{record?.educationLevel?.name}</Row>
          <Row label="Loại hình trường">{record?.schoolType?.name}</Row>
          <Row label="Năm học hiện hành">{year}</Row>
        </Block>
        <Block title="Địa bàn">
          <Row label="Phường/Xã">
            {record?.ward ? (
              record.ward.name
            ) : record?.wardText ? (
              <span className="text-warning-text">{record.wardText} · chưa chuẩn hoá</span>
            ) : null}
          </Row>
          <Row label="Cơ quan quản lý">{record?.departmentOfEducation?.name}</Row>
          <Row label="Địa chỉ">{record?.address || null}</Row>
        </Block>
        {leaders ? (
          <Block title="Ban giám hiệu" className="md:col-span-2">
            <div className="grid gap-x-10 md:grid-cols-2">
              <div>
                <Row label="Hiệu trưởng"><People people={leaders.principal} /></Row>
                <Row label="Phó hiệu trưởng"><People people={leaders.vice} /></Row>
              </div>
              <div>
                <Row label="Cán bộ thiết bị"><People people={leaders.equipment} /></Row>
              </div>
            </div>
          </Block>
        ) : null}
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
