package com.g123.sfems.shared.web.portal;

import static com.g123.sfems.shared.web.portal.Portal.ADMIN;
import static com.g123.sfems.shared.web.portal.Portal.SCHOOL;
import static com.g123.sfems.shared.web.portal.Portal.SO;

import java.util.EnumSet;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;

/**
 * BẢNG PHÂN CỔNG — tài nguyên nào mở ở cổng nào, đọc hay ghi. Ba cổng: Admin · Sở · Trường (đồ án không có cấp
 * UBND). Khoá là đoạn đầu sau {@code /api/} của đường dẫn controller; {@link PortalHandlerMapping} đăng ký thêm
 * {@code /api/<cổng>/<đường dẫn cũ>} cho đúng các cổng ở đây — một controller, nhiều cổng, không nhân bản code.
 *
 * <p>Cổng Admin mở MỌI tài nguyên (đọc, và ghi những gì có cổng ghi được) — quản trị dùng được toàn bộ chức năng;
 * các cột dưới đây khai cho ba cổng nghiệp vụ.
 *
 * <p>Đây là lớp chặn THỨ NHẤT (theo loại tài khoản). Sau nó vẫn là mã quyền {@code resource:action} và phạm vi dòng —
 * bảng này chỉ hẹp lại, không bao giờ nới quyền. Thêm controller mới mà quên khai ở đây thì
 * {@code PortalRoutesTest} báo đỏ.
 *
 * <p>Đọc = GET / HEAD; ghi = mọi phương thức khác.
 */
public final class PortalRoutes {

    /** Cổng của một tài nguyên: ai đọc, ai ghi. */
    public record Rule(Set<Portal> read, Set<Portal> write) {
    }

    /** Không qua cổng — dùng trước khi biết loại tài khoản (đăng nhập, 2 lớp, tra trường lúc đăng nhập, khoá API). */
    public static final Set<String> UNGATED = Set.of("auth");

    private static final Set<Portal> NONE = EnumSet.noneOf(Portal.class);
    private static final Set<Portal> ALL = EnumSet.allOf(Portal.class);
    /** Hai cổng nghiệp vụ. */
    private static final Set<Portal> BUSINESS = EnumSet.of(SO, SCHOOL);
    private static final Set<Portal> ADMIN_ONLY = EnumSet.of(ADMIN);

    private static final Map<String, Rule> RULES = new LinkedHashMap<>();

    /**
     * Khai cổng cho các tài nguyên. Cổng Admin luôn được đọc, và được ghi mọi thứ mà một cổng nào đó ghi được —
     * quản trị dùng được toàn bộ chức năng (theo trưởng nhóm, 12/11/2026). Tài nguyên chỉ đọc vẫn chỉ đọc.
     */
    /** Như {@link #put} nhưng KHÔNG mở thêm cổng Admin — tài nguyên gắn với đơn vị của người gọi. */
    private static void own(Set<Portal> read, Set<Portal> write, String... segments) {
        for (String segment : segments) {
            if (RULES.put(segment, new Rule(Set.copyOf(read), Set.copyOf(write))) != null) {
                throw new IllegalStateException("Khai trùng cổng cho /api/" + segment);
            }
        }
    }

    private static void put(Set<Portal> read, Set<Portal> write, String... segments) {
        Set<Portal> r = EnumSet.copyOf(read.isEmpty() ? ADMIN_ONLY : read);
        r.add(ADMIN);
        Set<Portal> w = write.isEmpty() ? NONE : EnumSet.copyOf(write);
        if (!w.isEmpty()) {
            w.add(ADMIN);
        }
        for (String segment : segments) {
            if (RULES.put(segment, new Rule(Set.copyOf(r), Set.copyOf(w))) != null) {
                throw new IllegalStateException("Khai trùng cổng cho /api/" + segment);
            }
        }
    }

    static {
        // Quản trị hệ thống — chỉ cổng Admin.
        put(ADMIN_ONLY, ADMIN_ONLY, "users", "roles", "permissions", "row_level_policies", "approval_flows",
                "ai_settings", "data_changes", "system_status");
        // Quy tắc mã: Admin quản lý; mọi form lập mới đọc "mã kế tiếp" (code_rules/next).
        put(ALL, ADMIN_ONLY, "code_rules");
        // Nhật ký: Admin xem; mọi người ghi lần xuất dữ liệu (activity_logs/exports).
        put(ADMIN_ONLY, ALL, "activity_logs");
        // Mọi người đã đăng nhập.
        put(ALL, ALL, "notifications");
        put(ALL, NONE, "enum_catalogs");
        // Danh bạ đơn vị: Admin đọc để gán tài khoản vào trường / cơ quan.
        put(EnumSet.of(ADMIN, SO, SCHOOL), EnumSet.of(SO), "schools", "departments_of_education", "wards",
                "education_levels");
        // Danh mục, chuẩn: Sở ghi, mọi cổng nghiệp vụ đọc.
        put(BUSINESS, EnumSet.of(SO), "acquisition_methods", "equipment_catalogs", "equipment_configs",
                "equipment_norms", "equipment_standards", "equipment_types", "facility_groups",
                "facility_standard_rules", "grades", "legal_documents", "movement_reasons", "room_types", "school_years", "semesters",
                "subject_groups", "subjects", "units");
        put(BUSINESS, NONE, "origin_sources", "voucher_forms");
        // Dữ liệu của trường: trường ghi, Sở xem toàn ngành.
        put(BUSINESS, EnumSet.of(SCHOOL), "buildings", "campuses", "rooms", "facility_info", "facility_todo",
                "equipment", "equipment_items", "inventory_sessions", "school_classes", "staff", "subject_teams",
                "data_transfer");
        // Hai bên cùng ghi (lập ở trường, duyệt ở trường / Sở).
        put(BUSINESS, BUSINESS, "equipment_intakes", "purchase_proposals", "attachments", "report_snapshots",
                "reports");
        // Sở lập, trường xem.
        put(BUSINESS, EnumSet.of(SO), "inventory_campaigns", "procurement_plans");
        // Chỉ xem.
        // Đánh giá CSVC theo chuẩn của một trường: trường xem trường mình, Sở xem toàn ngành.
        put(BUSINESS, NONE, "facility-standard");
        put(BUSINESS, NONE, "school_overview", "voucher_events", "voucher_holds", "voucher_links");
        // Riêng trường — lối của lãnh đạo trường trên CHÍNH trường mình (trường lấy từ người gọi); quản trị không gắn
        // trường nên không mở ở cổng Admin (tài khoản do màn Người dùng quản lý).
        own(EnumSet.of(SCHOOL), EnumSet.of(SCHOOL), "school_users", "school_code_rules", "school_profile");
        // Nhập dữ liệu đầu vào: trường nhập của mình, Sở nhập danh sách trường.
        put(EnumSet.of(SO, SCHOOL), EnumSet.of(SO, SCHOOL), "data_imports");
    }

    /**
     * Lối GHI riêng của một đường dẫn con, rộng hơn luật của đoạn đầu. Danh mục thiết bị chỉ Sở ghi, nhưng trường thêm /
     * sửa thiết bị NGOÀI danh mục của chính mình lúc ghi tăng ({@code /api/equipment_catalogs/school-items}, gác bằng
     * {@code equipment_intakes:write} / {@code equipment:write} và chỉ ghi đồ của trường người gọi). Thiếu dòng này thì
     * cổng trường không có đường POST / PATCH tới đó (405) — nút "Lưu và chọn" của trường không bao giờ chạy.
     */
    private static final Map<String, Set<Portal>> EXTRA_WRITE = Map.of(
            "/api/equipment_catalogs/school-items", EnumSet.of(SCHOOL));

    /** Cổng ghi thêm cho đường dẫn controller {@code pattern} (chính nó hoặc nằm dưới một khoá của {@link #EXTRA_WRITE}). */
    public static Set<Portal> extraWrite(String pattern) {
        for (Map.Entry<String, Set<Portal>> e : EXTRA_WRITE.entrySet()) {
            if (pattern.equals(e.getKey()) || pattern.startsWith(e.getKey() + "/")) {
                return e.getValue();
            }
        }
        return NONE;
    }

    private PortalRoutes() {
    }

    /** Luật của đoạn đầu {@code segment}, hoặc null nếu chưa khai. */
    public static Rule rule(String segment) {
        return RULES.get(segment);
    }

    /** Toàn bộ bảng — cho test và tài liệu. */
    public static Map<String, Rule> all() {
        return Map.copyOf(RULES);
    }
}
