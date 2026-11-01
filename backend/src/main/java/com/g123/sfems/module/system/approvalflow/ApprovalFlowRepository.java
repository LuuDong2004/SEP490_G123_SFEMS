package com.g123.sfems.module.system.approvalflow;

import com.g123.sfems.domain.system.approvalflow.ApprovalFlow;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Cấu hình luồng phê duyệt — một bảng cấu hình hệ thống, không thuộc trường nào, nên không qua phạm vi
 * dòng: ai đọc được ({@code approval_flows:read}) là đọc cả bảng.
 */
public interface ApprovalFlowRepository extends JpaRepository<ApprovalFlow, Long> {

    Optional<ApprovalFlow> findByResource(String resource);
}
