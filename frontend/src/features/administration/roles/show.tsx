import { useMemo } from "react";
import { useShow } from "@refinedev/core";

import { FormPanel } from "@/shared/components/form/form-panel";
import { FormSection } from "@/shared/components/form/form-section";
import { ReadField } from "@/shared/components/form/read-field";
import { LoadingOverlay } from "@/shared/components/layout/loading-overlay";
import { ShowView, ShowViewHeader } from "@/shared/components/views/show-view";
import { Badge } from "@/shared/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import {
  ACTION_VARIANTS,
  PERMISSION_ACTIONS,
  actionLabel,
  humanizeResource,
  splitPermissionCode,
  type PermissionSummary,
  type Role,
} from "@/domains/role/types";

/** Chi tiết vai trò (HT-05): thông tin và các quyền đã cấp, xếp theo từng chức năng. */
export const RoleShow = () => {
  const { result: record, query } = useShow<Role>({});
  const { isLoading } = query;

  // Gom theo chức năng giống cách ma trận gom, để đọc ở đây và sửa ở kia khớp nhau.
  const groups = useMemo(() => {
    const byResource = new Map<string, PermissionSummary[]>();
    for (const permission of record?.permissions ?? []) {
      const { resource } = splitPermissionCode(permission.code);
      const bucket = byResource.get(resource);
      if (bucket) bucket.push(permission);
      else byResource.set(resource, [permission]);
    }
    // Trong một nhóm, xếp theo thứ tự thao tác (đọc, ghi, xoá, duyệt...) như cột của ma trận,
    // không theo mã, vì mã xếp "delete" lên trước "read".
    const rank = (code: string) => {
      const index = (PERMISSION_ACTIONS as readonly string[]).indexOf(splitPermissionCode(code).action);
      return index === -1 ? PERMISSION_ACTIONS.length : index;
    };
    for (const bucket of byResource.values()) {
      bucket.sort((a, b) => rank(a.code) - rank(b.code));
    }
    return [...byResource.entries()].sort(([a], [b]) =>
      humanizeResource(a).localeCompare(humanizeResource(b), "vi"),
    );
  }, [record?.permissions]);

  return (
    <ShowView>
      <ShowViewHeader />
      <LoadingOverlay loading={isLoading}>
        <FormPanel contentClassName="@container space-y-6">
          <FormSection title="Thông tin vai trò" compact>
            <div className="grid items-start gap-x-4 gap-y-5 @md:grid-cols-2 @3xl:grid-cols-4">
              <ReadField label="Mã">
                <span className="font-mono">{record?.code}</span>
              </ReadField>
              <ReadField label="Tên" className="@3xl:col-span-2">
                {record?.name}
              </ReadField>
              <ReadField label="Loại">
                {record ? (
                  record.systemRole ? (
                    <Badge variant="secondary">Hệ thống</Badge>
                  ) : (
                    <Badge variant="outline">Tuỳ biến</Badge>
                  )
                ) : null}
              </ReadField>
              <ReadField label="Mô tả" className="@md:col-span-2 @3xl:col-span-4">
                {record?.description || null}
              </ReadField>
            </div>
          </FormSection>
        </FormPanel>
      </LoadingOverlay>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Vai trò này được làm gì
            <Badge variant="secondary" className="tabular-nums">
              {record?.permissions?.length ?? 0}
            </Badge>
          </CardTitle>
          <CardDescription>Các quyền đã cấp, xếp theo từng chức năng.</CardDescription>
        </CardHeader>
        <CardContent>
          <LoadingOverlay loading={isLoading}>
            {groups.length === 0 ? (
              <p className="text-muted-foreground text-sm">Vai trò này chưa được cấp quyền nào.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {groups.map(([resource, permissions]) => (
                  <div key={resource} className="flex flex-col gap-2 rounded-lg border p-3">
                    <span className="flex flex-col">
                      <span className="text-sm font-semibold">{humanizeResource(resource)}</span>
                      <span className="text-muted-foreground font-mono text-[11px]">{resource}</span>
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {permissions.map((permission) => {
                        const { action } = splitPermissionCode(permission.code);
                        return (
                          <Badge
                            key={permission.id}
                            variant={ACTION_VARIANTS[action] ?? "outline"}
                            title={permission.code}
                          >
                            {actionLabel(action)}
                          </Badge>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </LoadingOverlay>
        </CardContent>
      </Card>
    </ShowView>
  );
};
