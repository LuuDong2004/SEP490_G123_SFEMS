import { AlertTriangle, MapPin, School as SchoolIcon } from "lucide-react";
import { Link } from "react-router";

import { EmptyState } from "@/features/organization/resources/table-empty";
import { Badge } from "@/shared/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";
import { cn } from "@/shared/lib/utils";
import type { School } from "@/domains/school/types";
import {
  DEPARTMENT_SOURCE_LABELS,
  DEPARTMENT_SOURCE_UNCERTAIN,
  STATUS_LABELS,
} from "@/domains/school/types";
import { ORG_STATUS_VARIANTS as STATUS_VARIANTS } from "@/shared/lib/status-variants";

/**
 * Dạng KHỐI của danh sách trường.
 *
 * <p>Bảng trả lời "so sánh và lọc" — mười cột thẳng hàng, mắt chạy dọc một cột
 * là thấy ngay cái lệch. Khối trả lời "lướt xem có gì": tên trường dài nên
 * trong bảng luôn bị cắt, còn ở thẻ thì xuống dòng và đọc được trọn vẹn.
 *
 * <p>Nhận sẵn các dòng của TRANG HIỆN TẠI từ `DataTable`, nên bộ lọc, thứ tự
 * và phân trang vẫn là của bảng — đổi cách nhìn không đổi thứ được nhìn.
 */
export function SchoolCards({ schools }: { schools: School[] }) {
  if (schools.length === 0) {
    return <EmptyState className="h-full" filtered title="Không có trường nào" />;
  }
  return (
    <div className="grid gap-3 p-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {schools.map((s) => {
        const uncertain =
          s.departmentSource && DEPARTMENT_SOURCE_UNCERTAIN.includes(s.departmentSource);
        return (
          <Link
            key={s.id}
            to={`/schools/show/${s.id}`}
            className={cn(
              "bg-card text-card-foreground flex min-w-0 flex-col gap-2",
              "border-border hover:border-primary/40 hover:shadow-e2 rounded-lg",
              "border p-3 shadow-e1 transition-colors"
            )}
          >
            <div className="flex items-start gap-2">
              <span
                aria-hidden
                className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded"
                style={
                  s.primaryColor
                    ? { backgroundColor: `${s.primaryColor}1a`, color: s.primaryColor }
                    : undefined
                }
              >
                {/* Vàng là màu của tầng "trường" ở cây Tổng quan; trường nào
                    có màu riêng thì màu ấy thắng, vì nó là màu của chính
                    trường đó chứ không phải của tầng. */}
                <SchoolIcon className={cn("size-4", !s.primaryColor && "text-gold-600")} />
              </span>
              <span className="min-w-0 flex-1 text-sm leading-snug font-medium">{s.name}</span>
            </div>

            <div className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
              <span className="font-mono">{s.code}</span>
              {s.educationLevel ? (
                <Badge variant="neutral">{s.educationLevel.shortName ?? s.educationLevel.name}</Badge>
              ) : null}
              <Badge variant={STATUS_VARIANTS[s.status] ?? "secondary"}>
                {STATUS_LABELS[s.status] ?? s.status}
              </Badge>
            </div>

            {s.departmentOfEducation ? (
              <div className="text-muted-foreground mt-auto flex items-start gap-1.5 text-xs">
                <MapPin className="mt-0.5 size-3.5 shrink-0" />
                <span className="min-w-0 flex-1">{s.departmentOfEducation.name}</span>
                {/* Nhãn nhỏ, không phải chữ: thẻ nào cũng có cơ quan quản lý,
                    nên thứ cần nổi lên là việc cơ quan ấy có chắc hay không. */}
                {uncertain ? (
                  <Tooltip delayDuration={200}>
                    <TooltipTrigger asChild>
                      <AlertTriangle
                        className="text-warning mt-0.5 size-3.5 shrink-0"
                        aria-label="Chưa xác nhận cơ quan quản lý"
                      />
                    </TooltipTrigger>
                    <TooltipContent side="bottom" tone="light" className="max-w-80">
                      Chưa xác nhận cơ quan quản lý. {DEPARTMENT_SOURCE_LABELS[s.departmentSource!]} Cần Sở xác nhận lại.
                    </TooltipContent>
                  </Tooltip>
                ) : null}
              </div>
            ) : (
              <div className="text-warning-text mt-auto flex items-center gap-1.5 text-xs">
                <AlertTriangle className="size-3.5 shrink-0" />
                Chưa có cơ quan quản lý
              </div>
            )}
          </Link>
        );
      })}
    </div>
  );
}
