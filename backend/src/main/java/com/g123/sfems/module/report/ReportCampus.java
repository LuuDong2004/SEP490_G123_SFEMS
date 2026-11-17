package com.g123.sfems.module.report;

import com.g123.sfems.module.school.facility.CampusScope;
import com.g123.sfems.module.school.facility.FacilityCounting;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Lọc theo CƠ SỞ cho SQL thuần của báo cáo (giai đoạn 3) — cùng luật với màn hình: bản ghi gắn phòng theo cơ sở
 * thực của phòng ({@link FacilityCounting#roomInCampusSql}), không phòng → cơ sở chính; phiếu theo đúng hình dạng
 * của {@code VoucherCampus} (phiếu CHẠM cơ sở khi phòng / thiết bị ở đầu phiếu hoặc trên một dòng thuộc cơ sở; không
 * phòng, không thiết bị → cơ sở chính), viết lại bằng SQL trên tên bảng / cột.
 *
 * <p>Mọi vế chỉ ghép id số ({@code long}), có khoảng trắng hai đầu; {@code campusId == null} thì rỗng.
 */
final class ReportCampus {

    /** Một tập dòng của phiếu: bảng, cột trỏ về phiếu, các cột phòng, các cột thiết bị. */
    record Lines(String table, String fk, List<String> rooms, List<String> equipment) {
    }

    /** Hình dạng SQL của một loại phiếu — bản song song của {@code VoucherCampus.Shape} cho từng bảng. */
    record Shape(List<String> rooms, List<String> equipment, List<Lines> lines, String targetSchool,
            String targetRoom) {

        static Shape of(List<String> rooms, List<String> equipment, Lines... lines) {
            return new Shape(rooms, equipment, List.of(lines), null, null);
        }

        static Shape lines(String table, String fk) {
            return of(List.of(), List.of(), new Lines(table, fk, List.of(), List.of("equipment_id")));
        }
    }

    /** Theo {@code campusShape()} của từng service phiếu — đổi một bên thì đổi bên kia. */
    static final Map<String, Shape> SHAPES = Map.ofEntries(
            Map.entry("equipment_intakes", Shape.of(List.of(), List.of(),
                    new Lines("equipment_intake_lines", "intake_id", List.of("room_id"), List.of()))),
            Map.entry("equipment_allocations", Shape.of(List.of("room_id"), List.of(),
                    new Lines("equipment_allocation_lines", "allocation_id", List.of(),
                            List.of("equipment_id", "transferred_equipment_id")))),
            Map.entry("equipment_transfers", new Shape(List.of(), List.of(),
                    List.of(new Lines("equipment_transfer_lines", "transfer_id", List.of(),
                            List.of("equipment_id", "transferred_equipment_id"))),
                    "target_school_id", "received_room_id")),
            Map.entry("equipment_loans", Shape.of(List.of("usage_room_id"), List.of(),
                    new Lines("equipment_loan_lines", "loan_id", List.of("room_before_id"), List.of("equipment_id")))),
            Map.entry("damage_reports", Shape.lines("damage_report_lines", "report_id")),
            Map.entry("inventory_sessions", Shape.of(List.of("room_id"), List.of(),
                    new Lines("inventory_lines", "session_id", List.of("expected_room_id", "found_room_id"),
                            List.of("equipment_id")),
                    new Lines("inventory_surplus", "session_id", List.of("room_id"), List.of()))),
            Map.entry("disposals", Shape.lines("disposal_lines", "disposal_id")),
            Map.entry("purchase_proposals", Shape.of(List.of(), List.of())),
            Map.entry("repair_orders", Shape.lines("repair_order_lines", "order_id")),
            Map.entry("warranty_claims", Shape.lines("warranty_claim_lines", "claim_id")),
            Map.entry("maintenance_orders", Shape.lines("maintenance_order_lines", "order_id")),
            Map.entry("stock_issues", Shape.of(List.of(), List.of(),
                    new Lines("stock_issue_lines", "issue_id", List.of("room_id"), List.of()))),
            Map.entry("storage_orders", Shape.of(List.of("storage_room_id"), List.of(),
                    new Lines("storage_order_lines", "order_id", List.of(), List.of("equipment_id")))),
            Map.entry("depreciation_orders", Shape.lines("depreciation_order_lines", "order_id")),
            Map.entry("consumption_records", Shape.of(List.of("room_id"), List.of("equipment_id"))),
            Map.entry("room_bookings", Shape.of(List.of("room_id"), List.of(),
                    new Lines("room_booking_lines", "booking_id", List.of(), List.of("equipment_id")))));

    private final CampusScope campuses;

    ReportCampus(CampusScope campuses) {
        this.campuses = campuses;
    }

    /** Bản ghi gắn phòng {@code roomIdExpr} (trống = cơ sở chính) của trường {@code schoolIdExpr}. */
    static String room(String roomIdExpr, String schoolIdExpr, Long campusId) {
        if (campusId == null) {
            return " ";
        }
        return FacilityCounting.roomInCampusSql(roomIdExpr, schoolIdExpr, String.valueOf(campusId.longValue()));
    }

    /** Bản ghi mang cơ sở của chính nó (khối nhà, cơ sở): cơ sở ghi trên nó nếu còn dùng, không thì cơ sở chính. */
    static String own(String campusIdExpr, String schoolIdExpr, Long campusId) {
        if (campusId == null) {
            return " ";
        }
        return FacilityCounting.ownCampusInSql(campusIdExpr, schoolIdExpr, String.valueOf(campusId.longValue()));
    }

    /** Phiếu bảng {@code table} (bí danh {@code alias}) chạm cơ sở {@code campusId}. */
    String voucher(String table, String alias, Long campusId) {
        if (campusId == null) {
            return " ";
        }
        Shape shape = SHAPES.get(table);
        Long school = campuses.schoolOfCampus(campusId);
        if (shape == null || school == null) {
            return " AND FALSE ";
        }
        long c = campusId;
        boolean main = campuses.isMainCampus(c);
        String rooms = "(SELECT x.room_id FROM (" + FacilityCounting.ROOM_CAMPUS + ") x WHERE x.campus_id = " + c + ")";
        List<String> any = new ArrayList<>();
        for (String col : shape.rooms()) {
            any.add(alias + "." + col + " IN " + rooms);
        }
        for (String col : shape.equipment()) {
            any.add(equipmentIn(alias + "." + col, rooms, school, main));
        }
        for (Lines l : shape.lines()) {
            List<String> hit = new ArrayList<>();
            for (String col : l.rooms()) {
                hit.add("cl." + col + " IN " + rooms);
            }
            for (String col : l.equipment()) {
                hit.add("(cl." + col + " IS NOT NULL AND " + equipmentIn("cl." + col, rooms, school, main) + ")");
            }
            any.add("EXISTS (SELECT 1 FROM " + l.table() + " cl WHERE cl." + l.fk() + " = " + alias + ".id AND ("
                    + String.join(" OR ", hit) + "))");
        }
        if (main) {
            any.add(noAnchor(shape, alias, school));
            if (shape.targetSchool() != null) {
                any.add("(" + alias + "." + shape.targetRoom() + " IS NULL AND " + alias + "." + shape.targetSchool()
                        + " = " + school + ")");
            }
        }
        if (shape.targetRoom() != null) {
            any.add(alias + "." + shape.targetRoom() + " IN " + rooms);
        }
        return any.isEmpty() ? " AND FALSE " : " AND (" + String.join(" OR ", any) + ") ";
    }

    /**
     * Kế hoạch bảo trì (bí danh {@code alias}) thuộc cơ sở — như {@code CampusScope.maintenancePlans}: phòng, không
     * thì khối nhà; kế hoạch theo thiết bị thì có ÍT NHẤT một thiết bị của cơ sở; không gì cả → cơ sở chính.
     */
    String maintenancePlan(String alias, Long campusId) {
        if (campusId == null) {
            return " ";
        }
        Long school = campuses.schoolOfCampus(campusId);
        if (school == null) {
            return " AND FALSE ";
        }
        long c = campusId;
        boolean main = campuses.isMainCampus(c);
        String rooms = "(SELECT x.room_id FROM (" + FacilityCounting.ROOM_CAMPUS + ") x WHERE x.campus_id = " + c + ")";
        String buildings = "(SELECT x.building_id FROM (" + FacilityCounting.BUILDING_CAMPUS + ") x WHERE x.campus_id = "
                + c + ")";
        String equipment = "(EXISTS (SELECT 1 FROM maintenance_plan_equipment cm WHERE cm.plan_id = " + alias + ".id AND "
                + equipmentIn("cm.equipment_id", rooms, school, main) + ")"
                + (main ? " OR NOT EXISTS (SELECT 1 FROM maintenance_plan_equipment cm WHERE cm.plan_id = " + alias
                        + ".id)" : "") + ")";
        return " AND (" + alias + ".room_id IN " + rooms
                + " OR (" + alias + ".room_id IS NULL AND " + alias + ".building_id IN " + buildings + ")"
                + " OR (" + alias + ".room_id IS NULL AND " + alias + ".building_id IS NULL AND " + equipment + ")) ";
    }

    private static String equipmentIn(String expr, String rooms, long school, boolean main) {
        return "EXISTS (SELECT 1 FROM equipment ce WHERE ce.id = " + expr + " AND (ce.room_id IN " + rooms
                + (main ? " OR (ce.room_id IS NULL AND ce.school_id = " + school + ")" : "") + "))";
    }

    /** Phiếu của trường không trỏ tới phòng, thiết bị nào — thuộc cơ sở chính. */
    private static String noAnchor(Shape shape, String alias, long school) {
        List<String> none = new ArrayList<>();
        none.add(alias + ".school_id = " + school);
        for (String col : shape.rooms()) {
            none.add(alias + "." + col + " IS NULL");
        }
        for (String col : shape.equipment()) {
            none.add(alias + "." + col + " IS NULL");
        }
        for (Lines l : shape.lines()) {
            List<String> set = new ArrayList<>();
            l.rooms().forEach(col -> set.add("cl." + col + " IS NOT NULL"));
            l.equipment().forEach(col -> set.add("cl." + col + " IS NOT NULL"));
            none.add("NOT EXISTS (SELECT 1 FROM " + l.table() + " cl WHERE cl." + l.fk() + " = " + alias + ".id AND ("
                    + String.join(" OR ", set) + "))");
        }
        return "(" + String.join(" AND ", none) + ")";
    }
}
