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
    record Shape(List<String> rooms, List<String> equipment, List<Lines> lines, List<String> campuses) {

        static Shape of(List<String> rooms, List<String> equipment, Lines... lines) {
            return new Shape(rooms, equipment, List.of(lines), List.of());
        }
    }

    /** Theo {@code campusShape()} của từng service phiếu — đổi một bên thì đổi bên kia. */
    static final Map<String, Shape> SHAPES = Map.ofEntries(
            Map.entry("equipment_intakes", Shape.of(List.of(), List.of(),
                    new Lines("equipment_intake_lines", "intake_id", List.of("room_id"), List.of()))),
            Map.entry("inventory_sessions", Shape.of(List.of("room_id"), List.of(),
                    new Lines("inventory_lines", "session_id", List.of("expected_room_id", "found_room_id"),
                            List.of("equipment_id")),
                    new Lines("inventory_surplus", "session_id", List.of("room_id"), List.of()))),
            Map.entry("purchase_proposals", new Shape(List.of(), List.of(), List.of(), List.of("campus_id"))));

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
        for (String col : shape.campuses()) {
            any.add(alias + "." + col + " = " + c);
        }
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
        }
        return any.isEmpty() ? " AND FALSE " : " AND (" + String.join(" OR ", any) + ") ";
    }

    private static String equipmentIn(String expr, String rooms, long school, boolean main) {
        return "EXISTS (SELECT 1 FROM equipment ce WHERE ce.id = " + expr + " AND (ce.room_id IN " + rooms
                + (main ? " OR (ce.room_id IS NULL AND ce.school_id = " + school + ")" : "") + "))";
    }

    /** Phiếu của trường không trỏ tới phòng, thiết bị nào — thuộc cơ sở chính. */
    private static String noAnchor(Shape shape, String alias, long school) {
        List<String> none = new ArrayList<>();
        none.add(alias + ".school_id = " + school);
        for (String col : shape.campuses()) {
            none.add(alias + "." + col + " IS NULL");
        }
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
