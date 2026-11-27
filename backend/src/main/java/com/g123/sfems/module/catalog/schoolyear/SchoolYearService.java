package com.g123.sfems.module.catalog.schoolyear;

import com.g123.sfems.domain.catalog.schoolyear.SchoolYear;
import com.g123.sfems.module.catalog.base.CatalogService;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import com.g123.sfems.shared.exception.FieldValidationException;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;

/**
 * Năm học. Phần chung ở {@link CatalogService}; lớp này giữ ba quy tắc.
 *
 * <p><b>Ngày kết thúc phải sau ngày bắt đầu</b> — kiểm trên giá trị SAU KHI
 * GỘP với bản ghi đã lưu, vì một PATCH có thể chỉ gửi một trong hai ngày.
 * Vi phạm là 422 gắn vào đúng ô {@code endDate}, để form hiện lỗi dưới ô đó.
 *
 * <p><b>Chỉ một năm hiện hành.</b> Đánh dấu một năm là hiện hành thì bỏ cờ của
 * năm cũ trong CÙNG transaction. Thứ tự quan trọng: phải bỏ cờ năm cũ TRƯỚC
 * khi đặt cờ năm mới — lệnh cập nhật hàng loạt làm Hibernate đẩy các thay đổi
 * đang chờ xuống database trước, và nếu năm mới đã mang cờ lúc đó thì unique
 * index sẽ thấy hai năm hiện hành và từ chối.
 *
 * <p><b>Năm đã kết thúc không làm hiện hành được</b> — cả khi bật cờ, lẫn khi lùi
 * ngày kết thúc của năm đang hiện hành về trước hôm nay. Lỗi gắn vào ô {@code current}.
 *
 * <p><b>Tên và ngày khớp nhau</b> (trưởng nhóm 27/11/2026 — năm học "@@@@@123" từ 27/11 đến 01/12 từng lưu được và
 * thành hiện hành): tên đúng dạng "Năm học YYYY-YYYY" với năm sau = năm trước + 1; ngày bắt đầu trong năm đầu, ngày kết
 * thúc trong năm sau; dài 6–12 tháng; không chồng ngày với năm học khác.
 *
 * <p><b>Năm hiện hành</b> phải đang diễn ra hoặc sắp bắt đầu trong {@value #CURRENT_LEAD_DAYS} ngày (chuẩn bị đầu
 * năm); bỏ cờ của năm đang hiện hành mà không chọn năm khác thì bị chặn — hệ thống luôn có một năm hiện hành.
 *
 * <p>Một năm vừa thành hiện hành thì phát {@link SchoolYearActivated} — hồ sơ năm học báo các trường khai dữ liệu đầu
 * năm.
 */
@Service
public class SchoolYearService
        extends CatalogService<SchoolYear, SchoolYearRequest, SchoolYearPatchRequest> {

    @Override
    protected boolean codeLocked() {
        return true;
    }

    /** Tên năm học: "Năm học 2026-2027" (gạch nối hoặc gạch ngang). */
    private static final Pattern NAME = Pattern.compile("^Năm học (\\d{4})\\s*[-–]\\s*(\\d{4})$");
    /** Năm học ngắn nhất / dài nhất (ngày). Thực tế: 05/09 → 31/05 ≈ 268 ngày. */
    private static final int MIN_DAYS = 180;
    private static final int MAX_DAYS = 366;
    /** Năm chưa bắt đầu được chọn làm hiện hành nếu bắt đầu trong chừng này ngày tới. */
    static final int CURRENT_LEAD_DAYS = 90;
    /** "Hôm nay" theo giờ Việt Nam, không theo múi giờ của máy chủ. */
    private static final java.time.ZoneId VIETNAM = java.time.ZoneId.of("Asia/Ho_Chi_Minh");

    /** Id không bao giờ tồn tại — "bỏ cờ của TẤT CẢ" khi năm mới chưa có id. */
    private static final long NO_ID = -1L;

    private final SchoolYearRepository repository;
    private final ApplicationEventPublisher events;

    public SchoolYearService(SchoolYearRepository repository, RowLevelSecurity rowLevel,
            ApplicationEventPublisher events) {
        super(repository, rowLevel, SchoolYear.class, SchoolYear::new, "Năm học");
        this.repository = repository;
        this.events = events;
    }

    @Override
    protected void applyCreate(SchoolYear item, SchoolYearRequest request) {
        requireRange(request.startDate(), request.endDate());
        item.setName(requireConsistent(NO_ID, request.name(), request.startDate(), request.endDate()));
        item.setStartDate(request.startDate());
        item.setEndDate(request.endDate());
        if (Boolean.TRUE.equals(request.current())) {
            requireNotEnded(request.endDate());
            requireStartingSoon(request.startDate());
            repository.clearCurrentExcept(NO_ID);
            item.setCurrent(true);
            events.publishEvent(new SchoolYearActivated(item));
        }
    }

    @Override
    protected void applyUpdate(SchoolYear item, SchoolYearPatchRequest request) {
        LocalDate start = request.startDate() != null ? request.startDate() : item.getStartDate();
        LocalDate end = request.endDate() != null ? request.endDate() : item.getEndDate();
        requireRange(start, end);
        item.setName(requireConsistent(item.getId(), item.getName(), start, end));
        boolean wasCurrent = Boolean.TRUE.equals(item.getCurrent());
        if (wasCurrent && Boolean.FALSE.equals(request.active())) {
            throw new FieldValidationException("active", "Năm học đang hiện hành không ngừng dùng được — chọn năm khác làm hiện hành trước");
        }
        if (wasCurrent && Boolean.FALSE.equals(request.current())) {
            throw new FieldValidationException("current",
                    "Phải luôn có một năm học hiện hành — chọn năm khác làm hiện hành thay vì bỏ cờ năm này");
        }
        boolean turningOn = Boolean.TRUE.equals(request.current()) && !wasCurrent;
        boolean endMovedOnCurrent = wasCurrent && !Boolean.FALSE.equals(request.current())
                && request.endDate() != null && !request.endDate().equals(item.getEndDate());
        if (turningOn || endMovedOnCurrent) {
            requireNotEnded(end);
        }
        if (turningOn) {
            requireStartingSoon(start);
        }
        item.setStartDate(start);
        item.setEndDate(end);

        if (request.current() != null) {
            if (request.current() && !Boolean.TRUE.equals(item.getCurrent())) {
                repository.clearCurrentExcept(item.getId());
                events.publishEvent(new SchoolYearActivated(item));
            }
            item.setCurrent(request.current());
        }
    }

    /**
     * Năm học của một ngày: năm học chứa ngày đó, ngày rơi ngoài mọi năm học đã khai thì năm học hiện
     * hành, chưa khai năm học nào thì {@code null}. Dùng để điền sẵn năm học cho chứng từ.
     */
    public SchoolYear forDate(LocalDate day) {
        if (day != null) {
            List<SchoolYear> found = repository.containing(day);
            if (!found.isEmpty()) {
                return found.get(0);
            }
        }
        return repository.currentYears().stream().findFirst().orElse(null);
    }

    private static void requireRange(LocalDate start, LocalDate end) {
        if (start != null && end != null && !end.isAfter(start)) {
            throw new FieldValidationException("endDate", "Ngày kết thúc phải sau ngày bắt đầu");
        }
    }

    /**
     * Tên, ngày, độ dài khớp nhau và không chồng năm khác; trả tên đã chuẩn hoá ("Năm học 2026-2027"). Kiểm sau khi gộp
     * với bản đã lưu (PATCH có thể chỉ gửi một ô).
     */
    private String requireConsistent(Long selfId, String rawName, LocalDate start, LocalDate end) {
        String name = rawName == null ? "" : rawName.strip().replaceAll("\\s+", " ");
        Matcher m = NAME.matcher(name);
        if (!m.matches()) {
            throw new FieldValidationException("name", "Tên năm học phải có dạng \"Năm học 2026-2027\"");
        }
        int first = Integer.parseInt(m.group(1));
        int second = Integer.parseInt(m.group(2));
        if (second != first + 1) {
            throw new FieldValidationException("name", "Năm sau phải bằng năm trước cộng 1 (vd. Năm học 2026-2027)");
        }
        if (first < 2000 || first > 2099) {
            throw new FieldValidationException("name", "Năm học phải từ 2000 đến 2099");
        }
        if (start != null && start.getYear() != first) {
            throw new FieldValidationException("startDate", "Ngày bắt đầu phải thuộc năm " + first + " (theo tên năm học)");
        }
        if (end != null && end.getYear() != second) {
            throw new FieldValidationException("endDate", "Ngày kết thúc phải thuộc năm " + second + " (theo tên năm học)");
        }
        if (start != null && end != null) {
            long days = ChronoUnit.DAYS.between(start, end);
            if (days < MIN_DAYS || days > MAX_DAYS) {
                throw new FieldValidationException("endDate", "Năm học phải dài từ 6 đến 12 tháng");
            }
            List<SchoolYear> clash = repository.overlapping(selfId, start, end);
            if (!clash.isEmpty()) {
                throw new FieldValidationException("startDate",
                        "Trùng thời gian với " + clash.get(0).getName() + " — các năm học không được chồng ngày nhau");
            }
        }
        return "Năm học " + first + "-" + second;
    }

    private static void requireStartingSoon(LocalDate start) {
        if (start != null && start.isAfter(LocalDate.now(VIETNAM).plusDays(CURRENT_LEAD_DAYS))) {
            throw new FieldValidationException("current", "Chỉ chọn làm hiện hành năm học đang diễn ra hoặc bắt đầu trong "
                    + CURRENT_LEAD_DAYS + " ngày tới");
        }
    }

    private static void requireNotEnded(LocalDate end) {
        if (end != null && end.isBefore(LocalDate.now(VIETNAM))) {
            throw new FieldValidationException("current", "Năm học đã kết thúc, không chọn làm năm hiện hành được");
        }
    }

    @Override
    protected boolean uniqueName() {
        return true;
    }
}
