package com.g123.sfems.module.system.activity;

import com.g123.sfems.domain.system.activity.ActivityLog;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.repository.Repository;

/** Chỉ đọc: nhật ký được ghi bằng lệnh trần ở {@link ActivityLogInterceptor}, và không bao giờ sửa. */
public interface ActivityLogRepository extends Repository<ActivityLog, Long>, JpaSpecificationExecutor<ActivityLog> {
}
