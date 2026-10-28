package com.g123.sfems.module.organization.school.api.dto;

import com.g123.sfems.domain.organization.OrgStatus;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * Payload của {@code POST /schools}.
 *
 * <p>Hai tham chiếu là ĐỐI TƯỢNG LỒNG chứ không phải id trần, theo đúng cách
 * {@code DepartmentRequest} nhận {@code organization}: ô chọn của form ghi vào
 * {@code departmentOfEducation.id}, và ở màn sửa thì bản ghi nạp lên mang theo
 * cả đối tượng. Dùng id trần sẽ buộc frontend phải dẹt hoá payload bằng tay ở
 * mỗi màn.
 */
public record SchoolRequest(
        // Để trống: hệ thống tự cấp theo quy tắc sinh mã "schools" (TR0001…, changelog 093).
        @Size(max = 64, message = "Mã trường tối đa 64 ký tự")
        @Pattern(
                regexp = "^$|^[A-Za-z0-9._-]+$",
                message = "Mã trường chỉ gồm chữ, số, dấu chấm, gạch dưới và gạch nối")
        String code,

        @NotBlank(message = "Tên trường là bắt buộc")
        @Size(max = 255, message = "Tên trường tối đa 255 ký tự")
        String name,

        /**
         * Cơ quan quản lý — tuỳ chọn, và vắng nghĩa là CHƯA XÁC ĐỊNH.
         *
         * <p>Trước đây vắng thì lấy Sở mặc định, từ hồi hệ thống chỉ có một cơ
         * quan. Giờ có 169, và Sở không quản lý trực tiếp cấp 1, cấp 2, nên
         * mặc định ấy sẽ ghi sai phân cấp cho mọi trường tiểu học tạo mới.
         * Chưa biết thì để trống, đừng đoán.
         */
        @Valid
        DepartmentOfEducationRef departmentOfEducation,

        /**
         * Cấp học. Cho phép rỗng: có trường liên cấp và có dữ liệu nhập về
         * chưa xác định cấp — bắt buộc ở đây sẽ chặn việc nhập liệu vì một lý
         * do mang tính hình thức.
         */
        EducationLevelRef educationLevel,

        /**
         * Mã hai ký tự của trường, hoặc để trống.
         *
         * <p>Dùng làm thành phần TR khi sinh mã tài sản. KHÔNG phải mã
         * định danh của Bộ GD&ĐT — mã đó dài 20 ký tự, xem moetCode.
         *
         * <p>Nhánh {@code ^$} không phải để cho đẹp: một ô tuỳ chọn chưa nhập
         * được form gửi lên là CHUỖI RỖNG, không phải {@code null}. Viết
         * {@code @Size(min = 2)} thì mọi lần tạo trường mà không điền mã này
         * đều bị 422 — và lỗi đó chỉ lộ ra lúc chạy, không có kiểm tra tĩnh
         * nào thấy được.
         */
        @Pattern(
                regexp = "^$|^[A-Za-z0-9]{2}$",
                message = "Mã hai ký tự của trường phải đúng 2 ký tự chữ hoặc số")
        String shortCode,

        /**
         * Mã định danh cơ sở giáo dục của Bộ GD&ĐT, 20 ký tự, hoặc để trống.
         *
         * <p>Trống được vì trường vừa khai báo chưa chắc đã có mã trên CSDL
         * ngành. Đây là khoá liên thông, nên khi có thì phải đúng.
         */
        @Size(max = 20, message = "Mã định danh Bộ GD&ĐT tối đa 20 ký tự")
        String moetCode,

        // Tham chiếu tới phường/xã, không phải chữ: @Size trên một record không có bộ kiểm nào và làm
        // MỌI lần tạo / sửa trường đổ 500 (HV000030) — từ hồi ô này còn là chuỗi tên phường.
        WardRef ward,

        @Size(max = 500, message = "Địa chỉ tối đa 500 ký tự")
        String address,

        // Cùng lý do với shortCode: ô màu chưa chọn gửi lên chuỗi rỗng.
        @Pattern(
                regexp = "^$|^#[0-9A-Fa-f]{6}$",
                message = "Màu chủ đạo phải có dạng #RRGGBB")
        String primaryColor,

        @jakarta.validation.constraints.PositiveOrZero(message = "Số lớp không âm")
        Integer classCount,

        @jakarta.validation.constraints.PositiveOrZero(message = "Số học sinh không âm")
        Integer studentCount,

        OrgStatus status) {
}
