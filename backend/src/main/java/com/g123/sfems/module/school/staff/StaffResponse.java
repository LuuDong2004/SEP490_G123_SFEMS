package com.g123.sfems.module.school.staff;

import com.g123.sfems.domain.catalog.enums.StaffPosition;
import com.g123.sfems.domain.school.staff.Staff;
import com.g123.sfems.domain.school.staff.StaffType;
import com.g123.sfems.module.catalog.base.dto.RefSummary;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import com.g123.sfems.shared.security.CurrentUser;
import com.g123.sfems.shared.security.PersonalData;
import java.util.Objects;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.Instant;
import java.util.List;
import java.util.Map;

/** Hình dạng trên đường truyền của một cán bộ. */
public record StaffResponse(
        Long id,
        String code,
        String name,
        Integer sortOrder,
        Boolean active,
        String note,
        RefSummary school,
        StaffType staffType,
        StaffPosition position,
        String department,
        String phone,
        String email,
        List<RefSummary> subjects,
        RefSummary mainSubject,
        RefSummary campus,
        Account account,
        Instant createdAt,
        Instant updatedAt,
        @JsonProperty("_can") Map<String, Boolean> can) {

    /** Tài khoản đăng nhập đã cấp — tên và trạng thái, đủ cho cột "Tài khoản" của danh sách. */
    public record Account(Long id, String username, String status) {
        static Account of(Staff item) {
            var user = item.getAccount();
            return user == null ? null : new Account(user.getId(), user.getUsername(), user.getStatus().getValue());
        }
    }

    public static StaffResponse from(Staff item, RowLevelSecurity rowLevel) {
        var school = item.getSchool();
        Map<String, Boolean> can = rowLevel == null ? Map.of() : rowLevel.capabilities(item);
        // Số điện thoại, email xem ĐỦ khi: được sửa hồ sơ này (quyền + phạm vi dòng), hoặc là hồ sơ của chính mình.
        // Còn lại che bớt — giáo viên tra danh sách cán bộ vẫn nhận ra người, không lấy được số.
        boolean own = item.getAccount() != null
                && Objects.equals(item.getAccount().getId(), CurrentUser.id().orElse(null));
        boolean full = own || (CurrentUser.has("staff:write") && !Boolean.FALSE.equals(can.get("write")));
        return new StaffResponse(
                item.getId(), item.getCode(), item.getName(), item.getSortOrder(),
                item.getActive(), item.getNote(),
                new RefSummary(school.getId(), school.getCode(), school.getName()),
                item.getStaffType(), item.getPosition(), item.getDepartment(),
                full ? item.getPhone() : PersonalData.phone(item.getPhone()),
                full ? item.getEmail() : PersonalData.email(item.getEmail()),
                item.getSubjects().stream().map(RefSummary::of).toList(),
                RefSummary.of(item.getMainSubject()),
                RefSummary.of(item.getCampus()),
                Account.of(item),
                item.getCreatedAt(), item.getUpdatedAt(),
                can);
    }
}
