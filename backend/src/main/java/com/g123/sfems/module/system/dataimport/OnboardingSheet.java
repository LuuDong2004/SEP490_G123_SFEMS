package com.g123.sfems.module.system.dataimport;

import java.util.List;
import java.util.Set;

/**
 * Các trang của tệp dữ liệu đầu vào, theo THỨ TỰ GHI: trang sau tham chiếu mã của trang trước (khối nhà
 * cần cơ sở và cán bộ phụ trách, phòng cần khối nhà, lớp cần phòng và giáo viên, thiết bị cần phòng và người
 * quản lý). Cán bộ đứng trước khối nhà vì khối nhà, phòng đều có cột "Mã cán bộ phụ trách".
 *
 * <p>Trang được nhận ra theo DÒNG TIÊU ĐỀ (đủ các cột bắt buộc), không theo tên trang: trường đổi tên trang,
 * xếp lại thứ tự hay chèn dòng ghi chú lên đầu đều không sao. Mỗi cột nhận thêm các tên hay gặp ở tệp của
 * trường và tệp xuất từ phần mềm cũ (MISA…) — so sau khi bỏ dấu, bỏ phần trong ngoặc như "(đ)", "(*)".
 */
public enum OnboardingSheet {

    CAMPUS("Cơ sở", List.of(
            col("code", "Mã cơ sở", true, "Mã do trường đặt, vd CS1", "Mã điểm trường", "Mã CS"),
            col("name", "Tên cơ sở", true, "Vd Cơ sở chính; Điểm trường Ấp 2", "Tên điểm trường", "Điểm trường"),
            col("address", "Địa chỉ", false, "Số nhà, đường, phường/xã", "Địa chỉ cơ sở"),
            col("phone", "Số điện thoại", false, "", "Điện thoại", "SĐT", "ĐT"),
            col("primary", "Cơ sở chính", false, "Có hoặc Không. Mỗi trường một cơ sở chính",
                    "Là cơ sở chính", "Điểm chính", "Trường chính"),
            col("note", "Ghi chú", false, "", "Ghi chú khác"))),

    STAFF("Cán bộ – giáo viên", List.of(
            col("code", "Mã cán bộ", true, "Mã do trường đặt (hoặc mã trên phần mềm cũ), vd CB0001",
                    "Mã CB", "Mã giáo viên", "Mã GV", "Mã nhân viên", "Mã NV", "Mã CBGV", "Mã định danh",
                    "Số hiệu cán bộ"),
            col("name", "Họ và tên", true, "Họ và tên đầy đủ, có dấu", "Họ tên", "Tên cán bộ", "Tên giáo viên",
                    "Họ tên cán bộ", "Họ tên giáo viên", "Họ và tên cán bộ", "Họ và tên giáo viên"),
            col("type", "Loại", false, "Giáo viên hoặc Cán bộ. Để trống thì suy theo chức vụ",
                    "Loại cán bộ", "Đối tượng"),
            col("position", "Chức vụ", false, "Hiệu trưởng; Phó hiệu trưởng; Tổ trưởng chuyên môn; Giáo viên; "
                    + "Cán bộ thiết bị; Nhân viên thư viện; Kế toán; Thủ kho; Văn thư; Nhân viên; Khác",
                    "Chức danh", "Vị trí việc làm", "Vị trí"),
            col("team", "Tổ bộ môn", false, "Vd Tổ Khoa học tự nhiên. Tổ chưa có thì hệ thống tạo",
                    "Tổ chuyên môn", "Tổ", "Tổ CM"),
            col("mainSubject", "Môn chính", false, "Môn dạy chính của giáo viên", "Môn dạy chính", "Chuyên môn"),
            col("subjects", "Môn giảng dạy", false, "Các môn dạy, ngăn bằng dấu ; hoặc ,", "Môn dạy",
                    "Các môn dạy", "Môn phụ trách"),
            col("department", "Phòng ban / bộ phận", false, "Với cán bộ, nhân viên", "Tổ / bộ phận", "Bộ phận",
                    "Phòng ban", "Tổ văn phòng"),
            col("phone", "Số điện thoại", false, "", "Điện thoại", "SĐT", "ĐT", "Di động"),
            col("email", "Email", false, "", "Thư điện tử", "E-mail", "Địa chỉ email"),
            col("note", "Ghi chú", false, ""))),

    BUILDING("Khối nhà", List.of(
            col("code", "Mã khối nhà", true, "Mã do trường đặt, vd KA", "Mã nhà", "Mã dãy nhà", "Mã tòa nhà",
                    "Mã khu nhà", "Mã công trình"),
            col("name", "Tên khối nhà", true, "Vd Khối A; Nhà đa năng", "Tên nhà", "Tên dãy nhà", "Tên tòa nhà",
                    "Tên khu nhà", "Tên công trình", "Khối nhà"),
            col("campus", "Mã cơ sở", false, "Theo trang Cơ sở. Trường một cơ sở thì để trống được",
                    "Mã điểm trường", "Cơ sở", "Điểm trường"),
            col("floors", "Số tầng", true, "Tầng của phòng không vượt số này", "Số tầng nhà", "Tầng cao"),
            col("year", "Năm đưa vào sử dụng", false, "Năm bốn chữ số, vd 2015", "Năm sử dụng", "Năm xây dựng",
                    "Năm XD", "Năm đưa vào SD", "Năm SD"),
            col("area", "Diện tích sàn (m²)", false, "", "Diện tích", "Diện tích sàn", "Diện tích xây dựng"),
            col("condition", "Hiện trạng", false, "Tốt; Bình thường; Cần sửa chữa; Xuống cấp; Hư hỏng nặng",
                    "Tình trạng", "Hiện trạng sử dụng"),
            col("manager", "Mã cán bộ phụ trách", false, "Theo trang Cán bộ – giáo viên", "Người phụ trách",
                    "Cán bộ phụ trách", "Mã người phụ trách"),
            col("note", "Ghi chú", false, ""))),

    ROOM("Phòng", List.of(
            col("code", "Mã phòng", true, "Mã do trường đặt: chữ, số, dấu chấm, gạch nối, vd A.101", "Số phòng",
                    "Mã phòng học", "Ký hiệu phòng", "Phòng số"),
            col("name", "Tên phòng", true, "Vd Phòng 101; Phòng thí nghiệm Hóa học", "Tên phòng học"),
            col("building", "Mã khối nhà", false, "Theo trang Khối nhà. Sân, cổng, khu vệ sinh… để trống", "Mã nhà",
                    "Khối nhà", "Dãy nhà", "Tòa nhà", "Mã dãy nhà", "Mã tòa nhà", "Thuộc khối nhà", "Nhà"),
            col("floor", "Tầng", false, "Không vượt số tầng của khối nhà", "Tầng số", "Vị trí tầng", "Thuộc tầng"),
            col("roomType", "Loại CSVC", true, "Theo danh mục CSVC của Sở: Phòng học; Phòng học bộ môn Tin học; Thư viện; "
                    + "Phòng thiết bị giáo dục; Sân chơi chung… Thiết bị ở Phòng thiết bị giáo dục tính là trong kho",
                    "Loại phòng", "Loại", "Chức năng", "Công năng", "Mục đích sử dụng", "Loại phòng/Nhà",
                    "Loại phòng / Nhà", "Loại hạng mục"),
            col("structure", "Kết cấu", false, "Kiên cố; Bán kiên cố; Tạm; Nhờ, mượn, thuê", "Kết cấu công trình",
                    "Loại công trình"),
            col("subject", "Môn (phòng học bộ môn)", false, "Chỉ ghi cho phòng học bộ môn, vd Hóa học", "Môn",
                    "Bộ môn", "Môn học"),
            col("area", "Diện tích (m²)", false, "", "Diện tích"),
            col("capacity", "Sức chứa (chỗ)", false, "Số chỗ ngồi tối đa", "Sức chứa", "Số chỗ", "Số chỗ ngồi"),
            col("condition", "Hiện trạng", false, "Tốt; Bình thường; Cần sửa chữa; Xuống cấp; Hư hỏng nặng",
                    "Tình trạng"),
            col("usage", "Tình trạng sử dụng", false, "Đang sử dụng; Bỏ trống; Đang sửa chữa; Ngừng sử dụng",
                    "Trạng thái", "Trạng thái sử dụng"),
            col("manager", "Mã cán bộ phụ trách", false, "Theo trang Cán bộ – giáo viên", "Người phụ trách",
                    "Cán bộ phụ trách", "Mã người phụ trách"),
            col("unit", "Đơn vị quản lý", false, "Tổ, bộ phận quản lý phòng", "Bộ phận quản lý", "Tổ quản lý"),
            col("note", "Ghi chú", false, ""))),

    CLASS("Lớp học", List.of(
            col("code", "Tên lớp", true, "Chữ, số, khoảng trắng và . _ - /, vd 6A1, 1/1", "Lớp", "Mã lớp", "Lớp học"),
            col("grade", "Khối lớp", true, "Vd Lớp 6", "Khối", "Khối học"),
            col("year", "Năm học", true, "Vd 2026-2027", "Niên khóa"),
            col("students", "Sĩ số", true, "Số học sinh của lớp", "Số học sinh", "Số HS", "Tổng số học sinh",
                    "Tổng số HS", "Sĩ số lớp"),
            col("teacher", "Mã giáo viên chủ nhiệm", false, "Theo trang Cán bộ – giáo viên", "Giáo viên chủ nhiệm",
                    "GVCN", "Mã GVCN", "Chủ nhiệm"),
            col("room", "Mã phòng học", false, "Theo trang Phòng", "Phòng học", "Mã phòng", "Phòng"),
            col("note", "Ghi chú", false, ""))),

    EQUIPMENT("Thiết bị", List.of(
            col("legacy", "Mã cũ", false, "Mã cũ trên tem hoặc phần mềm cũ — giữ để tra cứu; mã chuẩn do hệ thống cấp",
                    "Mã tài sản", "Mã TS", "Mã số tài sản", "Số hiệu", "Số hiệu tài sản", "Mã cá biệt", "Số thẻ",
                    "Mã quản lý", "Mã vạch"),
            col("name", "Tên thiết bị", true, "Tên gọi trên sổ", "Tên tài sản", "Tên TB", "Tên TS",
                    "Tên thiết bị dạy học", "Tên đồ dùng", "Tên thiết bị, đồ dùng", "Tên hàng hóa", "Tên vật tư",
                    "Tên hóa chất", "Danh mục thiết bị", "Tên tài sản, thiết bị", "Tên, nhãn hiệu, quy cách"),
            col("catalog", "Mã DM thiết bị", true, "Mã trong Danh mục thiết bị, hoặc mã của phần mềm cũ (MISA…): "
                    + "hệ thống tự ghép theo mã đã biết, tên, công thức hóa học; không ghép được thì thành thiết bị "
                    + "ngoài danh mục của trường",
                    "Mã TB danh mục", "Mã TB", "Mã danh mục", "Mã loại", "Mã loại tài sản", "Mã loại thiết bị", "Mã hàng",
                    "Mã thiết bị dạy học", "Mã DM"),
            col("quantity", "Số lượng", false, "Để trống = 1. Thiết bị bền khai gộp thì mỗi cái một hồ sơ; "
                    + "vật tư, hóa chất là một hồ sơ mang số lượng", "SL", "Số lượng thực tế", "Số lượng hiện có",
                    "Số lượng tồn", "Số lượng hiện còn"),
            col("unit", "Đơn vị tính", false, "Bắt buộc với hóa chất, vật tư ngoài danh mục; vd g, ml, lọ", "ĐVT",
                    "Đơn vị", "Đ.vị tính", "Đ.V.T"),
            col("tracking", "Cách quản lý", false, "Chỉ cho thiết bị ngoài danh mục: Từng cái hoặc Theo lô. "
                    + "Để trống thì hệ thống đoán (hoá chất, đơn vị đo lường → theo lô)", "Hình thức quản lý"),
            col("serial", "Số serial", false, "Chỉ ghi khi số lượng là 1", "Serial", "Số seri", "Số sê-ri",
                    "Số máy", "S/N", "Số khung"),
            col("room", "Mã phòng", false, "Theo trang Phòng. Để trống = trong kho", "Phòng", "Phòng sử dụng",
                    "Vị trí", "Nơi đặt", "Nơi để", "Vị trí đặt", "Bộ phận sử dụng", "Nơi sử dụng"),
            col("manager", "Mã cán bộ quản lý", false, "Theo trang Cán bộ – giáo viên", "Người quản lý",
                    "Cán bộ quản lý", "Người sử dụng", "Người giữ", "Người phụ trách", "Mã người quản lý"),
            col("originalValue", "Nguyên giá (đ)", false, "Giá của MỘT cái. Không bắt buộc",
                    "Nguyên giá", "Đơn giá", "Giá", "Giá trị", "Giá mua", "Nguyên giá một cái"),
            col("receivedDate", "Ngày tiếp nhận", false, "dd/mm/yyyy. Để trống thì lấy 01/01 của năm đưa vào sử dụng",
                    "Ngày nhận", "Ngày ghi tăng", "Ngày tăng", "Ngày mua", "Ngày nhập", "Ngày đưa vào sử dụng",
                    "Ngày sử dụng", "Ngày bắt đầu sử dụng"),
            col("year", "Năm đưa vào sử dụng", false, "Năm bốn chữ số; mỗi dòng một năm", "Năm sử dụng",
                    "Năm SD", "Năm đưa vào SD", "Năm cấp", "Năm mua", "Năm nhận", "Năm trang bị", "Năm"),
            col("origin", "Nguồn hình thành", false,
                    "Kế hoạch mua sắm; Được cấp phát, bàn giao; Được tặng, tài trợ; Kiểm kê thừa; Đơn vị tự làm; Khác",
                    "Nguồn gốc", "Hình thức hình thành", "Nguồn cấp", "Nguồn"),
            col("funding", "Nguồn kinh phí", false, "Ngân sách; Học phí; Nguồn thu sự nghiệp; "
                    + "Quỹ phát triển sự nghiệp; Tài trợ; Nguồn khác; Chưa xác định nguồn. Để trống = Chưa xác định nguồn",
                    "Nguồn vốn", "Nguồn KP", "Kinh phí"),
            col("condition", "Tình trạng", false, "Tốt; Khá; Trung bình; Kém; Hỏng; Không sử dụng "
                    + "(nhận cả Bình thường, Hỏng nhẹ, Hỏng nặng). Để trống = Tốt", "Hiện trạng",
                    "Tình trạng sử dụng", "Chất lượng", "Tình trạng hiện tại"),
            col("note", "Ghi chú", false, "", "Ghi chú khác")));

    /**
     * Cột bắt buộc trong DỮ LIỆU nhưng không bắt buộc có trên TỆP: thiếu cột này trang vẫn được nhận, ô trống thì
     * bộ kiểm báo hoặc tự suy (thiết bị không có cột mã → ghép theo tên).
     */
    /** Cột bắt buộc mà máy tự điền được nên không cần để nhận ra trang: mã phòng (tệp mẫu CSDL HCM không có — 201). */
    private static final Set<String> INFERABLE = Set.of("EQUIPMENT.catalog", "ROOM.code");

    /** Một cột: khoá trong dữ liệu, nhãn trên tệp, có bắt buộc không, hướng dẫn, các nhãn khác cũng nhận. */
    public record Column(String key, String label, boolean required, String hint, List<String> aliases) {
    }

    private final String title;
    private final List<Column> columns;

    OnboardingSheet(String title, List<Column> columns) {
        this.title = title;
        this.columns = columns;
    }

    public String title() {
        return title;
    }

    public List<Column> columns() {
        return columns;
    }

    /** Các cột phải có trên dòng tiêu đề để nhận ra trang. */
    public List<Column> detectColumns() {
        return columns.stream().filter(c -> c.required() && !INFERABLE.contains(name() + "." + c.key())).toList();
    }

    /** Tên trang dùng trong API và URL: {@code campus}, {@code staff}… */
    public String key() {
        return name().toLowerCase();
    }

    public static OnboardingSheet of(String key) {
        for (OnboardingSheet s : values()) {
            if (s.key().equalsIgnoreCase(key)) {
                return s;
            }
        }
        return null;
    }

    private static Column col(String key, String label, boolean required, String hint, String... aliases) {
        return new Column(key, label, required, hint, List.of(aliases));
    }
}
