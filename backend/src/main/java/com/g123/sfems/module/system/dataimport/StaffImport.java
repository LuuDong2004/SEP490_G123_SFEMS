package com.g123.sfems.module.system.dataimport;

import com.g123.sfems.shared.validation.FieldRule;
import com.g123.sfems.domain.catalog.enums.StaffPosition;
import com.g123.sfems.domain.school.staff.StaffType;
import com.g123.sfems.module.catalog.base.dto.IdRef;
import com.g123.sfems.module.school.staff.StaffRequest;
import com.g123.sfems.module.school.staff.StaffService;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/** Nhập danh sách cán bộ, giáo viên của trường. */
@Component
public class StaffImport implements ImportTarget<StaffRequest> {

    private static final Map<StaffType, String> TYPE = Map.of(StaffType.STAFF, "Cán bộ", StaffType.TEACHER, "Giáo viên");

    private final JdbcTemplate jdbc;
    private final StaffService staff;

    public StaffImport(JdbcTemplate jdbc, StaffService staff) {
        this.jdbc = jdbc;
        this.staff = staff;
    }

    @Override
    public String name() {
        return "staff";
    }

    @Override
    public String permission() {
        return "staff:write";
    }

    @Override
    public String title() {
        return "Cán bộ, giáo viên";
    }

    @Override
    public List<Column> columns() {
        return List.of(
                new Column("code", "Mã cán bộ", true, "Duy nhất trong trường"),
                new Column("name", "Họ tên", true, ""),
                new Column("type", "Loại", false, "Cán bộ hoặc Giáo viên"),
                new Column("position", "Chức vụ", false, "Hiệu trưởng, Giáo viên, Cán bộ thiết bị..."),
                new Column("department", "Tổ / bộ phận", false, ""),
                new Column("phone", "Điện thoại", false, ""),
                new Column("email", "Email", false, ""),
                new Column("note", "Ghi chú", false, ""));
    }

    @Override
    public Parsed<StaffRequest> parse(Map<String, String> row, Long schoolId) {
        List<String> errors = new ArrayList<>();
        ImportValues v = new ImportValues(row, errors);
        String code = v.text("code", "mã cán bộ", true, 20);
        if (code != null && !code.matches("^[A-Za-z0-9._-]+$")) {
            errors.add("Mã chỉ gồm chữ, số, dấu chấm, gạch dưới và gạch nối");
        }
        String name = v.text("name", "họ tên", true, 50);
        if (name != null && name.strip().length() < 2) {
            errors.add("Họ tên tối thiểu 2 ký tự");
        }
        ruled(name, "Họ tên", FieldRule.PERSON_NAME, errors);
        StaffType type = v.choice("type", "Loại", StaffType.class, TYPE::get);
        StaffPosition position = v.choice("position", "Chức vụ", StaffPosition.class, StaffPosition::label);
        String department = v.text("department", "Tổ / bộ phận", false, 255);
        String phone = ruled(v.text("phone", "Điện thoại", false, 30), "Điện thoại", FieldRule.PHONE, errors);
        String email = ruled(v.text("email", "Email", false, 254), "Email", FieldRule.EMAIL, errors);
        String note = v.text("note", "Ghi chú", false, 500);
        if (!errors.isEmpty()) {
            return new Parsed<>(null, errors, code);
        }
        if (type == null) {
            type = position == StaffPosition.GIAO_VIEN || position == StaffPosition.TO_TRUONG
                    ? StaffType.TEACHER : StaffType.STAFF;
        }
        return new Parsed<>(new StaffRequest(code, name, null, true, note, new IdRef(schoolId), type, position,
                department, phone, email, null, null), errors, code);
    }

    @Override
    public boolean exists(Long schoolId, String code) {
        return !jdbc.queryForList("SELECT id FROM staff WHERE school_id = ? AND UPPER(code) = UPPER(?)", Long.class,
                schoolId, code).isEmpty();
    }

    @Override
    public void create(StaffRequest request) {
        staff.createImported(request);
    }

    /** Cùng luật với form nhập tay ({@link FieldRule}); trả giá trị đã chuẩn hoá (SĐT bỏ dấu ngăn cách). */
    private static String ruled(String value, String label, FieldRule rule, List<String> errors) {
        String problem = rule.violation(value, 0);
        if (problem != null) {
            errors.add(label + " " + problem);
            return value;
        }
        return rule.normalize(value);
    }
}
