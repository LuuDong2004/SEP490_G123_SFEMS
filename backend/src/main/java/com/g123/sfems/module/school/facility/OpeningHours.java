package com.g123.sfems.module.school.facility;

import com.g123.sfems.shared.exception.FieldValidationException;
import java.time.DayOfWeek;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

/**
 * Lịch mở cửa của phòng (206, QLTB-656): thứ trong tuần theo ISO (1 = Thứ 2 … 7 = Chủ nhật) và buổi (SANG, CHIEU,
 * TOI). Lưu chuỗi cách dấu phẩy; trống = không giới hạn. Phiếu mượn phòng và màn Trạng thái phòng dùng chung luật này.
 */
public final class OpeningHours {

    public static final List<String> SESSIONS = List.of("SANG", "CHIEU", "TOI");
    private static final Set<String> KNOWN = Set.copyOf(SESSIONS);

    private OpeningHours() {
    }

    /** Danh sách thứ → chuỗi lưu; rỗng hoặc đủ bảy ngày → {@code null}. */
    public static String joinDays(List<Integer> days) {
        if (days == null || days.isEmpty()) {
            return null;
        }
        List<String> out = new ArrayList<>();
        for (int d = 1; d <= 7; d++) {
            if (days.contains(d)) {
                out.add(String.valueOf(d));
            }
        }
        for (Integer d : days) {
            if (d == null || d < 1 || d > 7) {
                throw new FieldValidationException("openDays", "Thứ không hợp lệ");
            }
        }
        return out.size() == 7 ? null : String.join(",", out);
    }

    /** Danh sách buổi → chuỗi lưu; rỗng hoặc đủ ba buổi → {@code null}. */
    public static String joinSessions(List<String> sessions) {
        if (sessions == null || sessions.isEmpty()) {
            return null;
        }
        for (String s : sessions) {
            if (!KNOWN.contains(s)) {
                throw new FieldValidationException("openSessions", "Buổi không hợp lệ");
            }
        }
        List<String> out = SESSIONS.stream().filter(sessions::contains).toList();
        return out.size() == SESSIONS.size() ? null : String.join(",", out);
    }

    public static List<Integer> days(String stored) {
        if (stored == null || stored.isBlank()) {
            return List.of();
        }
        List<Integer> out = new ArrayList<>();
        for (String p : stored.split(",")) {
            out.add(Integer.valueOf(p.trim()));
        }
        return out;
    }

    public static List<String> sessions(String stored) {
        return stored == null || stored.isBlank() ? List.of() : List.of(stored.split(","));
    }

    /** Mở vào thứ này không. */
    public static boolean openOn(String storedDays, DayOfWeek day) {
        return storedDays == null || storedDays.isBlank() || days(storedDays).contains(day.getValue());
    }

    /** Mở vào buổi này không. */
    public static boolean openAt(String storedSessions, String session) {
        return storedSessions == null || storedSessions.isBlank() || sessions(storedSessions).contains(session);
    }

    /** "Thứ 2" … "Chủ nhật". */
    public static String dayName(DayOfWeek day) {
        return day == DayOfWeek.SUNDAY ? "Chủ nhật" : "Thứ " + (day.getValue() + 1);
    }

    public static String sessionName(String session) {
        return switch (session) {
            case "SANG" -> "buổi sáng";
            case "CHIEU" -> "buổi chiều";
            default -> "buổi tối";
        };
    }
}
