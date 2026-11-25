import { useMemo } from "react";
import { useCan, useList, useShow } from "@refinedev/core";
import { Link } from "react-router";

import { FormPanel } from "@/shared/components/form/form-panel";
import { FormSection } from "@/shared/components/form/form-section";
import { ReadField } from "@/shared/components/form/read-field";
import { LoadingOverlay } from "@/shared/components/layout/loading-overlay";
import {
  ShowView,
  ShowViewHeader,
} from "@/shared/components/views/show-view";
import { isRecordMissing, RecordNotFound } from "@/shared/components/views/record-not-found";
import { Badge } from "@/shared/ui/badge";
import { Skeleton } from "@/shared/ui/skeleton";
import type { Role } from "@/domains/role/types";
import {
  ACTION_LABELS,
  ACTION_VARIANTS,
  humanizeResource,
  splitPermissionCode,
  type Permission,
} from "@/domains/permission/types";

export const PermissionShow = () => {
  const { result: record, query } = useShow<Permission>({});
  const { isLoading } = query;

  // Which roles grant this code — the question the catalogue actually raises,
  // and the reason this page exists rather than a tooltip on the list row.
  //
  // Answered client-side from the role list, because the payload already
  // carries each role's permissions and there is no endpoint that filters
  // roles by permission. That holds only while the role list is small enough
  // to fetch whole; a deployment with hundreds of roles wants an endpoint
  // instead of a wider page size here.
  const { data: canReadRoles } = useCan({ resource: "roles", action: "list" });
  const mayReadRoles = canReadRoles?.can ?? false;

  const {
    result: roleResult,
    query: { isLoading: rolesLoading },
  } = useList<Role>({
    resource: "roles",
    pagination: { pageSize: 200 },
    sorters: [{ field: "code", order: "asc" }],
    queryOptions: { enabled: mayReadRoles },
  });

  const grantedBy = useMemo(() => {
    if (!record) return [];
    return (roleResult?.data ?? []).filter((role) =>
      role.permissions.some((permission) => permission.id === record.id)
    );
  }, [record, roleResult?.data]);

  const { resource, action } = splitPermissionCode(record?.code ?? "");

  // Mở thẳng một id không có (gõ tay, liên kết cũ, ngoài phạm vi): báo "Không tìm thấy", không vẽ trang trống.
  if (isRecordMissing(query)) {
    return (
      <ShowView>
        <ShowViewHeader canEdit={false} canDelete={false} />
        <RecordNotFound what="quyền" />
      </ShowView>
    );
  }

  return (
    <ShowView>
      <ShowViewHeader />
      <LoadingOverlay loading={isLoading}>
        <FormPanel contentClassName="@container space-y-6">
          <FormSection title="Thông tin quyền" compact>
            <div className="grid items-start gap-5 @md:grid-cols-2 @3xl:grid-cols-4">
              <ReadField label="Mã">
                <span className="font-mono">{record?.code}</span>
              </ReadField>
              <ReadField label="Tên" className="@3xl:col-span-2">{record?.name}</ReadField>
              <ReadField label="Loại">
                {record ? (
                  record.systemPermission ? <Badge variant="secondary">Hệ thống</Badge> : <Badge variant="outline">Tuỳ biến</Badge>
                ) : null}
              </ReadField>
              <ReadField label="Tài nguyên">{humanizeResource(resource)}</ReadField>
              <ReadField label="Hành động">
                <Badge variant={ACTION_VARIANTS[action] ?? "outline"}>{ACTION_LABELS[action] ?? (action || "—")}</Badge>
              </ReadField>
              <ReadField label="Mô tả" className="@md:col-span-2">{record?.description || null}</ReadField>
            </div>
          </FormSection>

          <FormSection title="Được cấp bởi" compact>
                {/*
                  Reading roles is a separate grant from reading the catalogue,
                  so this section explains its absence rather than rendering an
                  empty list that reads as "no role grants this".
                */}
                {!mayReadRoles ? (
                  <p className="text-muted-foreground text-sm">
                    Bạn chưa có quyền xem vai trò nên không xem được mục này.
                  </p>
                ) : rolesLoading ? (
                  <Skeleton className="h-6 w-48" />
                ) : grantedBy.length === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    Chưa có vai trò nào được cấp quyền này.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {grantedBy.map((role) => (
                      <Link key={role.id} to={`/roles/show/${role.id}`}>
                        <Badge
                          variant="outline"
                          className="hover:bg-accent cursor-pointer"
                        >
                          {role.name}
                        </Badge>
                      </Link>
                    ))}
                  </div>
                )}
          </FormSection>
        </FormPanel>
      </LoadingOverlay>
    </ShowView>
  );
};
