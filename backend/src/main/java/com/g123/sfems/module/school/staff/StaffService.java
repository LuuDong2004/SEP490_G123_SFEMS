package com.g123.sfems.module.school.staff;

import com.g123.sfems.domain.catalog.enums.StaffPosition;
import com.g123.sfems.domain.catalog.subject.Subject;
import com.g123.sfems.domain.school.staff.Staff;
import com.g123.sfems.domain.school.staff.StaffType;
import com.g123.sfems.domain.security.user.User;
import com.g123.sfems.module.catalog.base.CatalogSpecifications;
import com.g123.sfems.module.catalog.base.dto.IdRef;
import com.g123.sfems.module.catalog.subject.SubjectService;
import com.g123.sfems.module.organization.school.service.SchoolService;
import com.g123.sfems.module.school.base.SchoolOwnedService;
import com.g123.sfems.module.security.rowlevel.service.RowLevelPrincipalResolver;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import com.g123.sfems.shared.exception.FieldValidationException;
import com.g123.sfems.shared.exception.ResourceNotFoundException;
import com.g123.sfems.shared.security.CurrentUser;
import com.g123.sfems.shared.security.rowlevel.Action;
import com.g123.sfems.shared.web.ListParams;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Cán bộ, giáo viên. Quy tắc riêng: môn chính phải nằm trong các môn giảng dạy
 * — chọn môn chính mà chưa tích nó thì tự thêm vào, thay vì bắt người dùng tích
 * hai lần.
 */
@Service
public class StaffService extends SchoolOwnedService<Staff, StaffRequest, StaffPatchRequest> {

    private final SubjectService subjects;
    private final StaffRepository repository;
    private final RowLevelSecurity scopes;

    public StaffService(
            StaffRepository repository,
            RowLevelSecurity rowLevel,
            SchoolService schools,
            RowLevelPrincipalResolver principals,
            SubjectService subjects) {
        super(repository, rowLevel, Staff.class, Staff::new, "Cán bộ", schools, principals);
        this.subjects = subjects;
        this.repository = repository;
        this.scopes = rowLevel;
    }

    /** Cán bộ trong phạm vi GHI của người gọi — ngoài phạm vi là 404, như mọi lối sửa khác. */
    @Transactional(readOnly = true)
    public Staff getWritable(Long id) {
        return repository.findOne(scopes.byId(Staff.class, Action.WRITE, id))
                .orElseThrow(() -> new ResourceNotFoundException("Staff", id));
    }

    /** Gắn tài khoản đăng nhập vừa cấp cho cán bộ — chỉ {@code StaffAccountService} gọi. */
    @Transactional
    public Staff linkAccount(Long staffId, User account) {
        Staff staff = getWritable(staffId);
        staff.setAccount(account);
        return repository.persist(staff);
    }

    /**
     * Đổi chức vụ lãnh đạo theo CẢ HAI chiều đều cần quyền riêng. Người chỉ có {@code staff:write}
     * vẫn sửa được thông tin liên hệ của hiệu trưởng khi giữ nguyên chức vụ. Không có người gọi
     * (tác vụ hệ thống) thì không chặn, như phạm vi dòng.
     */
    private static void requireMayAssignPosition(StaffPosition wanted, StaffPosition current) {
        boolean leadershipChange = wanted != current && (isLeadership(wanted) || isLeadership(current));
        if (!leadershipChange || CurrentUser.id().isEmpty()) {
            return;
        }
        if (!CurrentUser.has("staff:assign_leadership")) {
            throw new FieldValidationException("position",
                    "Chỉ người có quyền quản lý chức vụ lãnh đạo mới đổi được chức vụ Hiệu trưởng / Phó hiệu trưởng");
        }
    }

    private static boolean isLeadership(StaffPosition position) {
        return position == StaffPosition.HIEU_TRUONG || position == StaffPosition.PHO_HIEU_TRUONG;
    }

    /**
     * Chức vụ phải hợp với Loại: giáo viên chỉ mang chức vụ đứng lớp (Giáo viên, Tổ trưởng chuyên
     * môn), cán bộ chỉ mang chức vụ không đứng lớp. Tổ trưởng phải chọn từ danh sách giáo viên và
     * chủ nhiệm phải là giáo viên, nên "cán bộ — tổ trưởng" là một hồ sơ không làm được việc nào.
     * Hiệu trưởng / Phó hiệu trưởng không ràng buộc theo Loại (vẫn có thể đứng lớp). Chức vụ bỏ trống
     * thì không kiểm.
     */
    private static void requireTypeMatchesPosition(StaffType type, StaffPosition position) {
        if (position == null || position == StaffPosition.HIEU_TRUONG || position == StaffPosition.PHO_HIEU_TRUONG) {
            return;
        }
        boolean teaching = position == StaffPosition.GIAO_VIEN || position == StaffPosition.TO_TRUONG;
        if (teaching && type != StaffType.TEACHER) {
            throw new FieldValidationException("position",
                    "Chức vụ " + position.label() + " chỉ dành cho loại Giáo viên — chọn loại Giáo viên hoặc đổi chức vụ");
        }
        if (!teaching && type == StaffType.TEACHER) {
            throw new FieldValidationException("position",
                    "Loại Giáo viên không thể mang chức vụ " + position.label() + " — chọn loại Cán bộ hoặc đổi chức vụ");
        }
    }

    /** Môn chính và môn giảng dạy chỉ của giáo viên: cán bộ không dạy nên không mang môn nào. */
    private static void requireNoTeachingSubjects(List<IdRef> subjects, IdRef mainSubject) {
        boolean hasSubjects = subjects != null && subjects.stream().anyMatch(s -> s != null && s.id() != null);
        boolean hasMain = mainSubject != null && mainSubject.id() != null;
        if (hasSubjects || hasMain) {
            throw new FieldValidationException(hasMain ? "mainSubject" : "subjects",
                    "Môn giảng dạy chỉ dành cho loại Giáo viên — cán bộ không chọn môn");
        }
    }

    /**
     * Đang nhập từ tệp (nhập dữ liệu đầu vào): tệp chưa có cột Môn chính, Chức vụ để trống được — các ô bắt buộc
     * của form không áp ở đây; kiểm trùng (Hiệu trưởng, email, SĐT) và các luật khác vẫn áp.
     */
    private static final ThreadLocal<Boolean> IMPORTING = ThreadLocal.withInitial(() -> false);

    /** Tạo cán bộ từ một dòng tệp nhập — chỉ {@code StaffImport} gọi. */
    @Transactional
    public Staff createImported(StaffRequest request) {
        IMPORTING.set(true);
        try {
            return create(request);
        } finally {
            IMPORTING.remove();
        }
    }

    /** Giáo viên phải có môn chính — định mức thiết bị theo giáo viên tính theo môn chính. */
    private static void requireMainSubject(StaffType type, boolean hasMain) {
        if (IMPORTING.get()) {
            return;
        }
        if (type == StaffType.TEACHER && !hasMain) {
            throw new FieldValidationException("mainSubject", "Môn chính là bắt buộc với giáo viên");
        }
    }

    /**
     * Mỗi trường một Hiệu trưởng; email và số điện thoại không trùng với cán bộ khác cùng trường (trưởng nhóm,
     * 12/11/2026). Số điện thoại so sau khi bỏ dấu cách, chấm, gạch, ngoặc — "0912 345 678" trùng "0912345678".
     * Chỉ kiểm giá trị ĐỔI ({@code changed*}): hồ sơ cũ vốn trùng vẫn sửa được ô khác.
     */
    private void requireUnique(Staff item, StaffPosition position, String email, String phone,
            boolean changedPosition, boolean changedEmail, boolean changedPhone) {
        Long schoolId = item.getSchool().getId();
        long self = item.getId() == null ? -1L : item.getId();
        if (changedPosition && position == StaffPosition.HIEU_TRUONG
                && repository.existsBySchoolIdAndPositionAndIdNot(schoolId, position, self)) {
            throw new FieldValidationException("position", "Trường đã có Hiệu trưởng — mỗi trường chỉ một Hiệu trưởng");
        }
        if (changedEmail && email != null && repository.existsBySchoolIdAndEmailIgnoreCaseAndIdNot(schoolId, email, self)) {
            throw new FieldValidationException("email", "Email đã dùng cho cán bộ khác của trường");
        }
        String digits = phoneDigits(phone);
        if (changedPhone && digits != null && repository.findBySchoolIdAndPhoneIsNotNullAndIdNot(schoolId, self).stream()
                .anyMatch(s -> digits.equals(phoneDigits(s.getPhone())))) {
            throw new FieldValidationException("phone", "Số điện thoại đã dùng cho cán bộ khác của trường");
        }
    }

    private static String phoneDigits(String phone) {
        if (phone == null) {
            return null;
        }
        String d = phone.replaceAll("[ .()-]", "");
        if (d.startsWith("+84")) {
            d = "0" + d.substring(3);
        }
        return d.isEmpty() ? null : d;
    }

    /** Mã cán bộ khoá sau khi tạo (trưởng nhóm, 12/11/2026) — như mã phòng. Gửi lại đúng mã đang có thì bỏ qua. */
    @Override
    @Transactional
    public Staff update(Long id, StaffPatchRequest request) {
        if (request.code() != null && !request.code().trim().equalsIgnoreCase(getWritable(id).getCode())) {
            throw new FieldValidationException("code", "Mã cán bộ không đổi được sau khi tạo");
        }
        return super.update(id, request);
    }

    @Override
    protected void applyCreateOwned(Staff item, StaffRequest request) {
        requireMayAssignPosition(request.position(), null);
        StaffType createdType = request.staffType();
        requireTypeMatchesPosition(createdType, request.position());
        if (createdType == StaffType.STAFF) {
            requireNoTeachingSubjects(request.subjects(), request.mainSubject());
        }
        requireMainSubject(createdType, request.mainSubject() != null && request.mainSubject().id() != null);
        requireUnique(item, request.position(), blankToNull(request.email()), blankToNull(request.phone()), true, true, true);
        item.setStaffType(request.staffType());
        item.setPosition(request.position());
        item.setDepartment(blankToNull(request.department()));
        item.setPhone(blankToNull(request.phone()));
        item.setEmail(blankToNull(request.email()));
        if (request.subjects() != null) {
            syncSubjects(item, request.subjects());
        }
        setMainSubject(item, request.mainSubject());
    }

    @Override
    protected void applyUpdateOwned(Staff item, StaffPatchRequest request) {
        // Chỉ kiểm khi Loại hoặc Chức vụ ĐỔI: hồ sơ cũ mang cặp lệch vẫn sửa được số điện thoại.
        StaffType newType = request.staffType() != null ? request.staffType() : item.getStaffType();
        StaffPosition newPosition = request.position() != null ? request.position() : item.getPosition();
        if (newType != item.getStaffType() || newPosition != item.getPosition()) {
            requireTypeMatchesPosition(newType, newPosition);
        }
        // Đổi sang Cán bộ: môn đã có bị gỡ đi, và không nhận môn mới gửi kèm. Hồ sơ cũ là cán bộ mà
        // vẫn mang môn (Loại không đổi) thì để yên — form sửa gửi lại nguyên giá trị đang có.
        boolean changedToStaff = newType == StaffType.STAFF && item.getStaffType() != StaffType.STAFF;
        if (changedToStaff) {
            requireNoTeachingSubjects(request.subjects(), request.mainSubject());
        }
        // Chức vụ, môn chính bắt buộc (12/11/2026): xét giá trị SAU khi sửa, gồm cả phần không gửi lên.
        if (newPosition == null) {
            throw new FieldValidationException("position", "Chức vụ là bắt buộc");
        }
        boolean hasMain = request.mainSubject() != null
                ? request.mainSubject().id() != null
                : item.getMainSubject() != null;
        requireMainSubject(newType, hasMain);
        String newEmail = request.email() != null ? blankToNull(request.email()) : item.getEmail();
        String newPhone = request.phone() != null ? blankToNull(request.phone()) : item.getPhone();
        requireUnique(item, newPosition, newEmail, newPhone,
                newPosition != item.getPosition(),
                newEmail != null && !newEmail.equalsIgnoreCase(item.getEmail()),
                newPhone != null && !Objects.equals(phoneDigits(newPhone), phoneDigits(item.getPhone())));
        if (request.staffType() != null) {
            item.setStaffType(request.staffType());
        }
        if (request.position() != null) {
            requireMayAssignPosition(request.position(), item.getPosition());
            item.setPosition(request.position());
        }
        if (request.department() != null) {
            item.setDepartment(blankToNull(request.department()));
        }
        if (request.phone() != null) {
            item.setPhone(blankToNull(request.phone()));
        }
        if (request.email() != null) {
            item.setEmail(blankToNull(request.email()));
        }
        if (request.subjects() != null) {
            syncSubjects(item, request.subjects());
        }
        if (request.mainSubject() != null) {
            setMainSubject(item, request.mainSubject());
        }
        if (changedToStaff) {
            item.getSubjects().clear();
            item.setMainSubject(null);
        }
    }

    /** Lọc thêm: {@code mainSubject.id}, {@code staffType=teacher|staff}. */
    @Override
    protected Specification<Staff> ownedFilters(ListParams params) {
        return CatalogSpecifications.<Staff>referenceFilter(params, "mainSubject").and(typeFilter(params));
    }

    /** {@code staffType=teacher}: ô giáo viên chủ nhiệm chỉ liệt kê giáo viên. Giá trị lạ lọc ra rỗng. */
    private static Specification<Staff> typeFilter(ListParams params) {
        List<Specification<Staff>> specs = params.filters().stream()
                .filter(c -> c.field().equals("staffType") && c.value() != null)
                .map(c -> {
                    StaffType type;
                    try {
                        type = StaffType.from(c.value());
                    } catch (IllegalArgumentException e) {
                        type = null;
                    }
                    StaffType wanted = type;
                    return (Specification<Staff>) (root, q, cb) ->
                            wanted == null ? cb.disjunction() : cb.equal(root.get("staffType"), wanted);
                })
                .toList();
        return Specification.allOf(specs);
    }

    private void syncSubjects(Staff item, List<IdRef> refs) {
        Set<Long> ids = refs.stream()
                .filter(Objects::nonNull)
                .map(IdRef::id)
                .filter(Objects::nonNull)
                .collect(Collectors.toCollection(LinkedHashSet::new));
        item.getSubjects().removeIf(s -> !ids.contains(s.getId()));
        Set<Long> have = item.getSubjects().stream().map(Subject::getId).collect(Collectors.toSet());
        for (Long id : ids) {
            if (!have.contains(id)) {
                item.getSubjects().add(subjects.get(id));
            }
        }
    }

    private void setMainSubject(Staff item, IdRef ref) {
        Subject main = ref == null || ref.id() == null ? null : subjects.get(ref.id());
        item.setMainSubject(main);
        if (main != null && item.getSubjects().stream().noneMatch(s -> s.getId().equals(main.getId()))) {
            item.getSubjects().add(main);
        }
    }
}
