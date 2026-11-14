package com.g123.sfems.module.school.facility;

import com.g123.sfems.module.school.facility.RoomCodeService.RuleView;
import com.g123.sfems.module.security.rowlevel.service.RowLevelPrincipalResolver;
import com.g123.sfems.shared.exception.FieldValidationException;
import com.g123.sfems.shared.security.rowlevel.RowLevelPrincipal;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * {@code /api/school_code_rules} — quy tắc mã PHÒNG của một trường (DM-04 khai, TC-02 dùng). Không theo
 * dialect danh sách: một trường có đúng một loại ở đây, trả về cả loại (chưa khai thì mang quy tắc mặc định,
 * {@code custom = false}). {@code school.id} vắng thì là trường của tài khoản đang đăng nhập.
 *
 * <p>Đường {@code /next} trả mã sẽ cấp cho phòng kế tiếp — form thêm phòng điền sẵn ô Mã từ đây.
 *
 * <p>Bản gốc đặt controller này trong {@code module/school/coderule}, cạnh bộ sinh mã tài sản. Ở đây nó nằm
 * cùng lát phòng vì nó chỉ phục vụ phòng: phần số của mã TÀI SẢN do
 * {@link com.g123.sfems.module.school.coderule.AssetCodeService} giữ, và hai bộ dùng chung bảng
 * {@code school_code_rules} theo {@code target} khác nhau ({@code rooms} và {@code equipment}) nên không dẫm
 * lên nhau.
 */
@RestController
@RequestMapping("/api/school_code_rules")
public class RoomCodeRuleController {

    private final RoomCodeService codes;
    private final RowLevelPrincipalResolver principals;

    public RoomCodeRuleController(RoomCodeService codes, RowLevelPrincipalResolver principals) {
        this.codes = codes;
        this.principals = principals;
    }

    public record RuleRequest(
            @Size(max = 20, message = "Ký hiệu tối đa 20 ký tự")
            @Pattern(
                    regexp = "^$|^[A-Za-z0-9._-]+$",
                    message = "Ký hiệu chỉ gồm chữ không dấu, số và . _ -")
            String prefix,
            @Min(value = 1, message = "Độ dài phần số từ 1 đến 6")
            @Max(value = 6, message = "Độ dài phần số từ 1 đến 6")
            Integer numberLength,
            @Min(value = 0, message = "Số bắt đầu không được âm")
            @Max(value = 999999, message = "Số bắt đầu tối đa 999.999")
            Integer startNumber) {
    }

    @GetMapping
    @PreAuthorize("hasAuthority('school_code_rules:read')")
    public List<RuleView> list(@RequestParam(name = "school.id", required = false) Long schoolId) {
        return codes.rulesOf(schoolOf(schoolId));
    }

    @PutMapping("/{target}")
    @PreAuthorize("hasAuthority('school_code_rules:write')")
    public RuleView save(
            @PathVariable String target,
            @RequestParam(name = "school.id", required = false) Long schoolId,
            @Valid @RequestBody RuleRequest request) {
        return codes.save(
                schoolOf(schoolId), target, request.prefix(), request.numberLength(), request.startNumber());
    }

    @DeleteMapping("/{target}")
    @PreAuthorize("hasAuthority('school_code_rules:write')")
    public RuleView reset(@PathVariable String target, @RequestParam(name = "school.id", required = false) Long schoolId) {
        return codes.reset(schoolOf(schoolId), target);
    }

    /** Mã kế tiếp cho form thêm mới — ai thêm được phòng ({@code rooms:write}) thì được hỏi. */
    @GetMapping("/next")
    @PreAuthorize("hasAuthority(#target + ':write')")
    public Map<String, String> next(
            @RequestParam String target, @RequestParam(name = "school.id", required = false) Long schoolId) {
        Map<String, String> body = new HashMap<>();
        body.put("code", codes.next(schoolOf(schoolId), target));
        return body;
    }

    private Long schoolOf(Long requested) {
        if (requested != null) {
            return requested;
        }
        return principals.current()
                .map(RowLevelPrincipal::schoolId)
                .orElseThrow(() -> new FieldValidationException("school", "Chọn trường"));
    }
}
