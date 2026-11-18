package com.g123.sfems.module.organization.school.security;

import com.g123.sfems.domain.catalog.educationlevel.EducationLevel;
import com.g123.sfems.domain.catalog.ward.Ward;
import com.g123.sfems.domain.organization.DepartmentOfEducation;
import com.g123.sfems.domain.organization.OrgStatus;
import com.g123.sfems.domain.organization.School;
import com.g123.sfems.shared.security.rowlevel.DefaultScope;
import com.g123.sfems.shared.security.rowlevel.FieldDescriptor;
import com.g123.sfems.shared.security.rowlevel.RowLevelPolicySet;
import java.time.Instant;
import java.util.List;
import java.util.Set;
import org.springframework.stereotype.Component;

/**
 * Một chính sách phân quyền dòng trên {@code schools} được phép nói gì.
 *
 * <p>Đây là resource quan trọng nhất của hệ thống về mặt phân quyền: luật tự
 * nhiên ở đây là {@code id = user.schoolId} — "tôi chỉ thấy trường của tôi" —
 * và đó là lý do {@code id} nằm trong tập trường chính sách chứ không chỉ là
 * khoá chính. Giống {@code organizations} trước đây, đây là một trong số ít
 * resource mà một phạm vi đặt trên chính định danh là luật đúng chứ không phải
 * dấu hiệu có gì đó sai.
 *
 * <p>Hệ quả cần nhớ: thu hẹp việc ai thấy trường nào KHÔNG tự nó nói gì về
 * thiết bị hay phiếu của trường đó. Một phạm vi lọc GỐC của resource đang được
 * phục vụ và không đi theo khoá ngoại — mỗi bảng nghiệp vụ sau này cần chính
 * sách riêng của nó, viết {@code school.id = user.schoolId}.
 */
@Component
public class SchoolRowLevelPolicies implements RowLevelPolicySet<School> {

    @Override
    public String resource() {
        return "schools";
    }

    @Override
    public Class<School> entityClass() {
        return School.class;
    }

    /**
     * {@code NONE}: một vai trò không có phạm vi thì KHÔNG thấy gì.
     *
     * <p>Nền này mặc định {@code FULL} cho resource được đưa vào diện quản lý
     * khi nó đã chạy sẵn — để ngày bật lên không ai mất dòng nào. Ở đây không
     * có cái giá đó để trả: dự án chưa lên production và bảng còn trống.
     *
     * <p>Và {@code FULL} chính là hình dạng của bẫy đã cắn ở bản Jmix. Ở đó,
     * {@code tenantId = NULL} nghĩa là "mọi người đều thấy", nên một bản ghi
     * do admin tạo mà quên đóng dấu sẽ rò sang trường khác, im lặng. {@code
     * FULL} làm đúng như vậy một tầng cao hơn: một vai trò ai đó quên viết
     * chính sách cho sẽ KHÔNG bị giới hạn. Dưới {@code NONE}, quên chính sách
     * là một màn hình trống có người báo trong một giờ.
     */
    @Override
    public DefaultScope defaultScope() {
        return DefaultScope.NONE;
    }

    /**
     * Tập trường đóng mà một chính sách được viết trên.
     *
     * <p>{@code code}, {@code name}, {@code address}, {@code shortCode} và
     * {@code primaryColor} cố ý vắng mặt: văn bản tự do mà người ta sửa không
     * phải là ranh giới bảo mật, và một phạm vi viết trên đó sẽ hỏng ngay lần
     * đầu có người sửa lỗi chính tả.
     *
     * <p>{@code ward} thì CÓ, và giờ là một KHOÁ NGOẠI chứ không còn là chuỗi.
     * Đó là điều kiện để "các trường trên địa bàn phường này" trở thành một
     * phạm vi viết được: so sánh theo id thì không hỏng khi ai đó sửa lỗi
     * chính tả, còn so sánh theo chữ thì hỏng.
     *
     * <p>{@code wardText} — địa bàn gõ tay còn sót lại từ trước khi có danh
     * mục — cũng CÓ, vì nó là vô hướng CHO PHÉP RỖNG duy nhất còn lại ở đây.
     * Đó là chỗ {@code CompilerAgreementTest} kiểm chứng hai trình biên dịch
     * đồng ý với nhau trên một giá trị vô hướng rỗng, cùng loại câu hỏi mà
     * {@code educationLevel} kiểm trên một khoá ngoại rỗng.
     */
    @Override
    public List<FieldDescriptor> fields() {
        return List.of(
                FieldDescriptor.id("id"),
                FieldDescriptor.column("status", OrgStatus.class, false),
                FieldDescriptor.reference("ward", Ward.class),
                FieldDescriptor.column("wardText", String.class),
                FieldDescriptor.column("createdAt", Instant.class, false),
                FieldDescriptor.reference("departmentOfEducation", DepartmentOfEducation.class),
                FieldDescriptor.reference("educationLevel", EducationLevel.class));
    }

    /**
     * Trường chỉ có giá trị SAU khi lưu, nên không dùng được ở vế
     * {@code WITH CHECK} trên một bản ghi vừa tạo.
     */
    @Override
    public Set<String> notCheckSafe() {
        return Set.of("id", "createdAt", "updatedAt");
    }
}
