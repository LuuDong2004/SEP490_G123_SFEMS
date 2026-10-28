import { useResourceParams } from "@refinedev/core";
import { CircleHelp, Lightbulb, Workflow } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";

import { Button } from "@/shared/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/shared/ui/sheet";

/** Trợ giúp của một màn (`meta.help` của resource): màn để làm gì, các bước, mẹo, lối tới trang Quy trình. */
export type ScreenHelp = {
  title: string;
  summary?: string;
  steps?: { title: string; maker?: string; approver?: string; result?: string }[];
  tips?: string[];
  /** Trang Quy trình của phân hệ chứa màn này. */
  processPath?: string;
};

/** Mẹo dùng chung cho mọi màn danh sách — để màn chưa có trợ giúp riêng vẫn có cái để đọc. */
const COMMON_TIPS = [
  "Ô tìm kiếm ở đầu bảng tìm theo mã, tên; các ô lọc bên cạnh thu hẹp danh sách, đếm và xuất Excel theo đúng bộ lọc.",
  "Nút bánh răng bên phải bảng: Làm mới, chọn cột hiển thị, Nhập / Xuất dữ liệu.",
  "Nút \"⋯\" cuối mỗi dòng: Xem, Sửa, Xoá — chỉ hiện việc tài khoản được làm với dòng đó.",
  "Trên form phiếu, khung \"Cần hoàn thiện\" bên phải liệt kê ô còn thiếu; bấm vào để tới đúng ô.",
];

/**
 * Nút "?" trên thanh đầu trang (QLTB-513): mở bảng trợ giúp của màn đang xem — đọc `meta.help` của resource hiện tại
 * (nội dung khai ở `app/resources`, các màn nghiệp vụ lấy từ chính các bước Quy trình của phân hệ). Màn chưa có trợ
 * giúp riêng thì hiện các mẹo chung.
 */
export function HelpButton() {
  const { resource } = useResourceParams();
  const [open, setOpen] = useState(false);
  const help = resource?.meta?.help as ScreenHelp | undefined;
  const screen = (resource?.meta?.tabLabel ?? resource?.meta?.label) as string | undefined;

  return (
    <>
      <Button type="button" variant="ghost" size="icon" aria-label="Trợ giúp" title="Trợ giúp cho màn này"
        onClick={() => setOpen(true)}>
        <CircleHelp />
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{help?.title ?? (screen ? `Trợ giúp: ${screen}` : "Trợ giúp")}</SheetTitle>
            {help?.summary ? <SheetDescription>{help.summary}</SheetDescription> : null}
          </SheetHeader>
          <div className="space-y-5 px-4 pb-6 text-sm">
            {help?.steps?.length ? (
              <section className="space-y-2">
                <h3 className="text-overline text-muted-foreground">Các bước</h3>
                <ol className="space-y-2">
                  {help.steps.map((s, i) => (
                    <li key={i} className="rounded-md border px-3 py-2">
                      <div className="font-medium">{i + 1}. {s.title}</div>
                      <div className="text-muted-foreground mt-0.5 space-y-0.5 text-xs">
                        {s.maker ? <div>Ai làm: {s.maker}</div> : null}
                        <div>Duyệt: {s.approver ?? "Không cần duyệt"}</div>
                        {s.result ? <div>Kết quả: {s.result}</div> : null}
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
            ) : null}
            {help?.tips?.length ? (
              <section className="space-y-2">
                <h3 className="text-overline text-muted-foreground">Cần biết</h3>
                <ul className="list-disc space-y-1.5 ps-5">
                  {help.tips.map((t, i) => <li key={i}>{t}</li>)}
                </ul>
              </section>
            ) : null}
            <section className="space-y-2">
              <h3 className="text-overline text-muted-foreground flex items-center gap-1.5"><Lightbulb className="size-3.5" />Mẹo chung</h3>
              <ul className="text-muted-foreground list-disc space-y-1.5 ps-5">
                {COMMON_TIPS.map((t, i) => <li key={i}>{t}</li>)}
              </ul>
            </section>
            {help?.processPath ? (
              <Link to={help.processPath} onClick={() => setOpen(false)}
                className="text-primary inline-flex items-center gap-1.5 font-medium hover:underline">
                <Workflow className="size-4" />
                Xem cả quy trình của phân hệ
              </Link>
            ) : null}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
