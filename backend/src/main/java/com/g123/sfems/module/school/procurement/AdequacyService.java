package com.g123.sfems.module.school.procurement;

import com.g123.sfems.module.organization.school.service.VisibleSchools;
import com.g123.sfems.module.school.facility.CampusScope;
import com.g123.sfems.module.school.facility.FacilityCounting;
import com.g123.sfems.shared.exception.ResourceNotFoundException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.TreeMap;
import java.util.TreeSet;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.Consumer;
import java.util.stream.Collectors;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Mức độ đáp ứng Danh mục thiết bị dạy học tối thiểu: với mỗi THIẾT BỊ trong danh mục tối thiểu
 * của cấp học của trường, phụ lục đòi bao nhiêu, trường đang có bao nhiêu cái DÙNG ĐƯỢC, thiếu bao
 * nhiêu.
 *
 * <p>"Dùng được" là trong kho, đang dùng hoặc đang cho mượn — hỏng, đang sửa, chờ thanh lý hay báo
 * mất đều không tính, vì định mức hỏi lớp học có thiết bị để dạy hay không, không hỏi sổ còn ghi
 * bao nhiêu dòng. Vật tư tiêu hao cộng theo số lượng.
 *
 * <p>Đối chiếu theo THIẾT BỊ ({@code equipment_norms.catalog_id}, 095), không theo loại: bộ thí
 * nghiệm Hoá không đáp ứng định mức Vật lý. Một thiết bị có nhiều dòng định mức (cùng thiết bị cho
 * nhiều chủ đề / nhiều lớp) thì lấy dòng đòi NHIỀU NHẤT — thiết bị dùng chung giữa các chủ đề, cộng
 * dồn là bắt trường mua trùng. Dòng định mức cũ chưa gắn thiết bị thì còn đối chiếu theo loại.
 *
 * <p>Số yêu cầu tính theo căn cứ, chỉ trên các lớp áp dụng ({@code grade_levels}; trống là mọi
 * lớp), từ lớp học của năm học hiện hành:
 * <ul>
 *   <li>theo lớp: số lớp ÷ cỡ (01 bộ/5 lớp), làm tròn lên, × số lượng;</li>
 *   <li>theo học sinh: từng lớp ⌈sĩ số ÷ cỡ nhóm⌉ cộng lại × số lượng (01/6HS là nhóm 6 em);</li>
 *   <li>theo giáo viên: số giáo viên dạy môn × số lượng; chưa khai giáo viên môn thì KHÔNG đoán —
 *       trừ môn tiểu học do giáo viên chủ nhiệm dạy, ở đó số giáo viên chính là số lớp;</li>
 *   <li>theo phòng bộ môn: số lượng × số phòng bộ môn của môn đó ({@code rooms.subject_id}, 100);
 *       trường chưa khai phòng của môn thì tính MỘT phòng — danh mục "tính cho 01 phòng học bộ môn"
 *       là thứ trường phải có, không khai phòng không làm định mức biến mất;</li>
 *   <li>theo trường: đúng số lượng.</li>
 * </ul>
 * Có nhiều hơn số phải có thì phần dư là THỪA ({@code surplus}) — cùng một con số, nhìn từ phía kia;
 * cơ quan quản lý dùng nó để cân đối: thiết bị trường này thừa là thứ trường khác đang thiếu.
 * Số lớp / học sinh CHỈ lấy từ lớp năm học hiện hành ({@code FacilityCounting}); trường chưa có lớp
 * năm nay thì định mức theo lớp / học sinh không tính được. Không tính được thì trả
 * {@code required = null} kèm lý do, không đoán 0.
 *
 * <p>Hai bộ nhớ đệm 60 giây, vì ứng dụng phục vụ vài nghìn người cùng lúc và trang tổng quan nào
 * cũng hỏi tỷ lệ đáp ứng: danh mục định mức (gần 1.800 dòng, ít khi đổi) đọc một lần cho mọi yêu
 * cầu, và bản tổng hợp theo tập trường người xem thấy (toàn ngành ~1 giây) dùng chung giữa những
 * người cùng phạm vi. Sửa định mức hay ghi tăng thiết bị thì chậm nhất một phút sau mới thấy trên
 * tổng hợp — chấp nhận được với một con số tổng quan; màn chi tiết một trường không đệm.
 */
@Service
@Transactional(readOnly = true)
public class AdequacyService {

    private static final String USABLE = "('IN_STOCK', 'IN_USE', 'BORROWED', 'MAINTAINING')";
    static final Map<String, int[]> LEVEL_GRADES = Map.of(
            "TH", new int[] {1, 2, 3, 4, 5},
            "THCS", new int[] {6, 7, 8, 9},
            "THPT", new int[] {10, 11, 12});

    /**
     * Môn tiểu học do giáo viên chủ nhiệm dạy — Âm nhạc, Mĩ thuật, Ngoại ngữ, Tin, GDTC có giáo viên riêng.
     * Là MÃ MÔN (từ `113` mã môn chính là mã môn dạy học hai chữ số): Toán 01, Công nghệ 11, Tiếng Việt 15,
     * Đạo đức 16, Lịch sử và Địa lí 17, Hoạt động trải nghiệm 22, Khoa học 24, Tự nhiên và Xã hội 25.
     * Đổi mã một môn trong danh mục thì phải đổi ở đây.
     */
    private static final Set<String> HOMEROOM_SUBJECTS = Set.of("01", "11", "15", "16", "17", "22", "24", "25");

    private static final long TTL_MILLIS = 60_000;

    private final JdbcTemplate jdbc;
    private final VisibleSchools visibleSchools;

    private record Cached<T>(T value, long at) {

        boolean fresh() {
            return System.currentTimeMillis() - at < TTL_MILLIS;
        }
    }

    private volatile Cached<Map<String, List<Map<String, Object>>>> normsCache;
    private final Map<String, Cached<SummaryEntry>> summaryCache = new ConcurrentHashMap<>();
    private final Map<String, CompletableFuture<SummaryEntry>> computing = new ConcurrentHashMap<>();
    /** Tăng mỗi lần bỏ đệm: một phép tính bắt đầu trước đó không được ghi kết quả cũ vào lại. */
    private final AtomicLong summaryGeneration = new AtomicLong();
    private static final int MAX_SUMMARIES = 500;

    private final CampusScope campuses;

    public AdequacyService(JdbcTemplate jdbc, VisibleSchools visibleSchools, CampusScope campuses) {
        this.jdbc = jdbc;
        this.visibleSchools = visibleSchools;
        this.campuses = campuses;
    }

    /** Một thiết bị của danh mục tối thiểu, ở một trường. */
    public record NormRow(Long normId, String normCode, String normName, Long catalogId, String catalogCode,
            Long subjectId, String subjectName, Long typeId, String typeName, String basis,
            BigDecimal minQuantity, Integer basisSize, String quantityText, String gradeLevels, boolean optional,
            Integer required, int current, int proposed, Integer shortage, Integer surplus, String warning,
            Integer baseRequired, int baseCurrent, boolean adjustable, Adjustment adjustment) {

        /** Có vào thống kê đủ / thiếu không: dòng không ghi số hoặc dòng tự chọn thì không. */
        boolean counted() {
            return minQuantity != null && !optional;
        }
    }

    /**
     * Điều chỉnh ĐÃ DUYỆT đang có hiệu lực cho một thiết bị ở một trường (154). {@code required} / {@code current}
     * của dòng đã tính theo nó; {@code baseRequired} / {@code baseCurrent} là số theo chuẩn Bộ.
     *
     * @param method {@code QUANTITY} (đổi số phải có), {@code SUBSTITUTE} (thiết bị khác trong danh mục, Sở cho),
     *     {@code CUSTOM} (thiết bị ngoài danh mục của trường)
     * @param substituteCount số thiết bị thay thế đang dùng được, trước khi quy đổi
     */
    public record Adjustment(Long lineId, String method, Integer quantity, Long substituteId, String substituteCode,
            String substituteName, BigDecimal ratio, int substituteCount, String reason, String approvedAt) {
    }

    /** Một khối lớp của trường trong năm học hiện hành. */
    public record GradeInput(int grade, int classes, int students, int missingStudents) {
    }

    /**
     * Một môn của danh mục tối thiểu, nhìn từ phía dữ liệu nền: trường có mấy giáo viên dạy, mấy phòng
     * bộ môn, và có bao nhiêu thiết bị của môn tính theo giáo viên / theo phòng (để biết thiếu khai
     * thì ảnh hưởng tới đâu).
     */
    public record SubjectInput(Long subjectId, String subjectName, int teachers, int rooms, int perTeacher,
            int perRoom) {
    }

    /** Dữ liệu nền mà chuẩn của trường được tính từ đó. */
    public record Inputs(boolean classesDeclared, List<GradeInput> grades, int teachers,
            List<SubjectInput> subjects) {
    }

    public record SchoolAdequacy(Long schoolId, String schoolCode, String schoolName, String level,
            String levelCode, String district, Integer classCount, Integer studentCount, int norms, int met,
            int unknown, int shortItems, int shortageTotal, int surplusItems, int surplusTotal,
            boolean hasEquipment, Inputs inputs, List<NormRow> rows, int baseMet, int adjusted) {
    }

    /** Một dòng của bảng tổng hợp: một trường, không kèm từng định mức. */
    public record SchoolSummary(Long schoolId, String schoolCode, String schoolName, String level,
            String levelCode, String district, int norms, int met, int unknown, int shortItems,
            int shortageTotal, int surplusItems, int surplusTotal, boolean hasEquipment, int percent,
            int baseMet, int basePercent, int adjusted) {
    }

    /** Một cấp học trên địa bàn. */
    public record LevelSummary(String levelCode, String level, int schools, int withData, int fullyMet,
            int norms, int met, int percent, int shortageTotal, int surplusTotal) {
    }

    /**
     * Cân đối MỘT thiết bị trên địa bàn: tổng thiếu, tổng thừa, và phần có thể điều chuyển
     * ({@code min(thiếu, thừa)}) — thiết bị trường này thừa là thứ trường khác đang thiếu.
     */
    public record CatalogBalance(Long catalogId, String catalogCode, String name, String subjectName,
            String level, int shortage, int shortSchools, int surplus, int surplusSchools, int transferable) {
    }

    public record SubjectShortage(String subjectName, int shortage, int surplus, int schools) {
    }

    /** Số trường theo dải tỷ lệ đáp ứng. */
    public record Band(String key, String label, int schools) {
    }

    public record Summary(int schools, int withData, int fullyMet, int withShortage, int missingSize,
            int percent, int shortageTotal, int surplusTotal, int transferable, List<LevelSummary> levels,
            List<Band> bands, List<SubjectShortage> subjects, List<CatalogBalance> catalogs,
            List<SchoolSummary> rows) {
    }

    /** Một trường trong phép cân đối của một thiết bị. */
    public record CatalogSchool(Long schoolId, String schoolName, String level, String district,
            Integer required, int current, int shortage, int surplus) {
    }

    /** Ảnh chụp cho một dòng đề xuất: số đang dùng được của thiết bị, và định mức của nó. */
    public record Snapshot(int current, Integer required) {
    }

    /** Cả trường — số nộp Sở; điều chỉnh chuẩn (154) đọc đúng số này, không theo cơ sở. */
    public SchoolAdequacy forSchool(Long schoolId) {
        return forSchool(schoolId, null, false);
    }

    /**
     * Một trường, theo cơ sở: tài khoản bị giới hạn luôn là cơ sở của mình; tài khoản cả trường chọn được một cơ sở
     * của trường ({@code campusId}), không chọn = cả trường.
     */
    public SchoolAdequacy forSchool(Long schoolId, Long campusId) {
        return forSchool(schoolId, campusId, true);
    }

    private SchoolAdequacy forSchool(Long schoolId, Long campusId, boolean byCampus) {
        Set<Long> visible = visibleSchools();
        if (visible != null && !visible.contains(schoolId)) {
            throw new ResourceNotFoundException("School", schoolId);
        }
        List<SchoolAdequacy> result = compute(Set.of(schoolId), byCampus ? campusIn(schoolId, campusId) : null);
        if (result.isEmpty()) {
            throw new ResourceNotFoundException("School", schoolId);
        }
        return result.get(0);
    }

    /** Cơ sở áp cho một trường: cơ sở của tài khoản bị giới hạn, không thì cơ sở chọn nếu thuộc trường đó. */
    private Long campusIn(Long schoolId, Long requested) {
        Long pinned = campuses.pinnedCampusId();
        if (pinned != null) {
            return pinned;
        }
        return requested != null && Objects.equals(campuses.schoolOfCampus(requested), schoolId) ? requested : null;
    }

    /** Tổng hợp cả trường cho mọi trường người xem được thấy (điều chỉnh chuẩn đọc số này). */
    @Transactional(propagation = Propagation.SUPPORTS)
    public Summary summary() {
        return summaryEntry(null).summary();
    }

    /**
     * Tổng hợp theo cơ sở: tài khoản bị giới hạn LUÔN chỉ cơ sở của mình; tài khoản khác chọn một cơ sở
     * ({@code campusId}) thì chỉ trường của cơ sở đó, đếm trong cơ sở đó; không chọn = cả trường.
     */
    @Transactional(propagation = Propagation.SUPPORTS)
    public Summary summary(Long campusId) {
        return summaryEntry(campuses.effectiveFilter(campusId)).summary();
    }

    /**
     * Bản tổng hợp đã đệm của phạm vi người xem, tính lại khi hết hạn.
     *
     * <p>Một lần tính cho mỗi phạm vi tại một thời điểm (single-flight): lúc bản đệm hết hạn, người
     * tới đầu tính lại, người tới sau DÙNG BẢN CŨ nếu có (chậm thêm vài giây là chấp nhận được với một
     * con số tổng quan), chưa có bản nào thì chờ chung lần tính đó — không ai tự tính lần thứ hai.
     * Không có cơ chế này, toàn ngành (~1.670 trường) bị N người quản lý tính lại N lần cùng lúc, mỗi
     * lần giữ một kết nối. {@code SUPPORTS}: không tự mở giao dịch, nên người đang chờ không giữ kết
     * nối nào; các câu của phép tính mỗi câu mượn rồi trả kết nối.
     */
    private SummaryEntry summaryEntry(Long campusId) {
        Set<Long> visible = visibleSchools();
        if (campusId != null) {
            // Một cơ sở: chỉ trường của nó, trong phạm vi người xem (không nới).
            Long school = campuses.schoolOfCampus(campusId);
            visible = school == null || (visible != null && !visible.contains(school)) ? Set.of() : Set.of(school);
        }
        // Khoá đệm mang cơ sở: cùng tập trường mà khác cơ sở là con số khác.
        String key = (visible == null ? "*" : new TreeSet<>(visible).toString())
                + (campusId == null ? "" : "@" + campusId);
        Cached<SummaryEntry> hit = summaryCache.get(key);
        if (hit != null && hit.fresh()) {
            return hit.value();
        }
        CompletableFuture<SummaryEntry> mine = new CompletableFuture<>();
        CompletableFuture<SummaryEntry> running = computing.putIfAbsent(key, mine);
        if (running != null) {
            return hit != null ? hit.value() : await(running);
        }
        try {
            long generationAtStart = summaryGeneration.get();
            SummaryEntry fresh = computeSummary(visible, campusId);
            if (summaryGeneration.get() == generationAtStart) {
                if (summaryCache.size() >= MAX_SUMMARIES) {
                    evictOldestSummary();
                }
                summaryCache.put(key, new Cached<>(fresh, System.currentTimeMillis()));
            }
            mine.complete(fresh);
            return fresh;
        } catch (RuntimeException | Error e) {
            mine.completeExceptionally(e);
            throw e;
        } finally {
            computing.remove(key, mine);
        }
    }

    private static SummaryEntry await(CompletableFuture<SummaryEntry> running) {
        try {
            return running.join();
        } catch (CompletionException e) {
            if (e.getCause() instanceof RuntimeException runtime) {
                throw runtime;
            }
            throw e;
        }
    }

    /** Bỏ phạm vi cũ nhất thay vì xoá sạch: xoá sạch khi đầy là mọi phạm vi cùng trượt một lúc. */
    private void evictOldestSummary() {
        summaryCache.entrySet().stream()
                .min((x, y) -> Long.compare(x.getValue().at(), y.getValue().at()))
                .ifPresent(oldest -> summaryCache.remove(oldest.getKey(), oldest.getValue()));
    }

    /**
     * Bản tổng hợp kèm, cho từng thiết bị, các trường thiếu / thừa nó — để màn "cân đối theo thiết bị"
     * mở một dòng mà không tính lại định mức của mọi trường. Lưu gọn: mỗi thiết bị một mảng số
     * {@code [chỉ số trường, phải có, đang có, thiếu, thừa] × n}; thông tin trường lấy từ
     * {@code schools} theo chỉ số.
     */
    private record SummaryEntry(Summary summary, List<SchoolSummary> schools, Map<Long, int[]> catalogSchools) {
    }

    private SummaryEntry computeSummary(Set<Long> visible, Long campusId) {
        // Duyệt TỪNG TRƯỜNG rồi bỏ: chỉ giữ dòng tóm tắt và các bộ đếm, không giữ ~700 dòng định mức của
        // mọi trường cùng lúc (toàn ngành là hơn một triệu đối tượng NormRow sống tới cuối phép tính).
        List<SchoolSummary> unsorted = new ArrayList<>();
        Map<Long, int[]> perCatalog = new HashMap<>();
        Map<Long, NormRow> sample = new HashMap<>();
        Map<Long, String> sampleLevel = new HashMap<>();
        Map<String, int[]> perSubject = new LinkedHashMap<>();
        Map<Long, IntList> perCatalogSchools = new HashMap<>();
        computeEach(visible, campusId, a -> {
            int schoolIndex = unsorted.size();
            unsorted.add(new SchoolSummary(a.schoolId(), a.schoolCode(), a.schoolName(), a.level(), a.levelCode(),
                    a.district(), a.norms(), a.met(), a.unknown(), a.shortItems(), a.shortageTotal(),
                    a.surplusItems(), a.surplusTotal(), a.hasEquipment(), percent(a.met(), a.norms()),
                    a.baseMet(), percent(a.baseMet(), a.norms()), a.adjusted()));
            // Cân đối theo thiết bị và theo môn — chỉ trên các trường ĐÃ có thiết bị: trường chưa nhập gì
            // thì "thiếu" của nó là thiếu dữ liệu, cộng vào là mọi thiết bị đều thiếu vài trăm nghìn cái.
            if (!a.hasEquipment()) {
                return;
            }
            Set<String> touched = new HashSet<>();
            for (NormRow r : a.rows()) {
                if (!r.counted() || r.required() == null || r.catalogId() == null) {
                    continue;
                }
                int sh = r.shortage() == null ? 0 : r.shortage();
                int su = r.surplus() == null ? 0 : r.surplus();
                if (sh == 0 && su == 0) {
                    continue;
                }
                int[] c = perCatalog.computeIfAbsent(r.catalogId(), k -> new int[4]);
                c[0] += sh;
                c[1] += sh > 0 ? 1 : 0;
                c[2] += su;
                c[3] += su > 0 ? 1 : 0;
                sample.putIfAbsent(r.catalogId(), r);
                sampleLevel.putIfAbsent(r.catalogId(), a.level());
                perCatalogSchools.computeIfAbsent(r.catalogId(), k -> new IntList())
                        .add(schoolIndex, r.required(), r.current(), sh, su);
                String subject = r.subjectName() == null ? "Chưa gắn môn" : r.subjectName();
                int[] sj = perSubject.computeIfAbsent(subject, k -> new int[3]);
                sj[0] += sh;
                sj[1] += su;
                if (sh > 0 && touched.add(subject)) {
                    sj[2]++;
                }
            }
        });
        List<SchoolSummary> schoolsInOrder = List.copyOf(unsorted);
        List<SchoolSummary> rows = unsorted.stream()
                // Trường đã có thiết bị lên trước (thiếu nhiều nhất trước), trường chưa nhập gì xuống cuối:
                // 900 trường 0% chưa nhập liệu không được che ba trường thật sự đang thiếu.
                .sorted((x, y) -> x.hasEquipment() != y.hasEquipment() ? (x.hasEquipment() ? -1 : 1)
                        : Integer.compare(x.percent(), y.percent()))
                .toList();
        int fully = (int) rows.stream().filter(r -> r.norms() > 0 && r.met() == r.norms()).count();
        int shortage = (int) rows.stream().filter(r -> r.shortageTotal() > 0).count();
        int missingSize = (int) rows.stream().filter(r -> r.unknown() > 0).count();
        int withData = (int) rows.stream().filter(SchoolSummary::hasEquipment).count();
        int norms = rows.stream().mapToInt(SchoolSummary::norms).sum();
        int met = rows.stream().mapToInt(SchoolSummary::met).sum();

        // Theo cấp học.
        Map<String, List<SchoolSummary>> byLevel = new LinkedHashMap<>();
        for (String code : List.of("TH", "THCS", "THPT")) {
            byLevel.put(code, new ArrayList<>());
        }
        for (SchoolSummary r : rows) {
            byLevel.computeIfAbsent(r.levelCode() == null ? "?" : r.levelCode(), k -> new ArrayList<>()).add(r);
        }
        List<LevelSummary> levels = new ArrayList<>();
        byLevel.forEach((code, list) -> {
            if (list.isEmpty()) {
                return;
            }
            int n = list.stream().mapToInt(SchoolSummary::norms).sum();
            int m = list.stream().mapToInt(SchoolSummary::met).sum();
            levels.add(new LevelSummary(code, list.get(0).level(), list.size(),
                    (int) list.stream().filter(SchoolSummary::hasEquipment).count(),
                    (int) list.stream().filter(r -> r.norms() > 0 && r.met() == r.norms()).count(), n, m,
                    percent(m, n), list.stream().mapToInt(SchoolSummary::shortageTotal).sum(),
                    list.stream().mapToInt(SchoolSummary::surplusTotal).sum()));
        });

        // Phân bố trường theo tỷ lệ đáp ứng.
        int[] band = new int[5];
        for (SchoolSummary r : rows) {
            if (!r.hasEquipment()) {
                band[0]++;
            } else if (r.percent() < 50) {
                band[1]++;
            } else if (r.percent() < 80) {
                band[2]++;
            } else if (r.percent() < 100) {
                band[3]++;
            } else {
                band[4]++;
            }
        }
        List<Band> bands = List.of(new Band("none", "Chưa nhập thiết bị", band[0]),
                new Band("low", "Dưới 50%", band[1]), new Band("mid", "50 – 79%", band[2]),
                new Band("high", "80 – 99%", band[3]), new Band("full", "Đủ 100%", band[4]));

        List<CatalogBalance> catalogs = perCatalog.entrySet().stream()
                .map(e -> {
                    NormRow r = sample.get(e.getKey());
                    int[] c = e.getValue();
                    return new CatalogBalance(e.getKey(), r.catalogCode(), r.normName(), r.subjectName(),
                            sampleLevel.get(e.getKey()), c[0], c[1], c[2], c[3], Math.min(c[0], c[2]));
                })
                .sorted((x, y) -> x.transferable() != y.transferable()
                        ? Integer.compare(y.transferable(), x.transferable())
                        : Integer.compare(y.shortage(), x.shortage()))
                .limit(200)
                .toList();
        List<SubjectShortage> subjects = perSubject.entrySet().stream()
                .map(e -> new SubjectShortage(e.getKey(), e.getValue()[0], e.getValue()[1], e.getValue()[2]))
                .filter(x -> x.shortage() > 0 || x.surplus() > 0)
                .sorted((x, y) -> Integer.compare(y.shortage(), x.shortage()))
                .toList();
        int shortageTotal = perCatalog.values().stream().mapToInt(c -> c[0]).sum();
        int surplusTotal = perCatalog.values().stream().mapToInt(c -> c[2]).sum();
        int transferable = perCatalog.values().stream().mapToInt(c -> Math.min(c[0], c[2])).sum();
        Map<Long, int[]> catalogSchools = new HashMap<>();
        perCatalogSchools.forEach((catalog, list) -> catalogSchools.put(catalog, list.toArray()));
        return new SummaryEntry(new Summary(rows.size(), withData, fully, shortage, missingSize, percent(met, norms),
                shortageTotal, surplusTotal, transferable, levels, bands, subjects, catalogs, rows), schoolsInOrder,
                catalogSchools);
    }

    /** Mảng số nguyên tự giãn — năm số một trường, không một đối tượng mỗi trường. */
    private static final class IntList {
        private int[] values = new int[20];
        private int size;

        void add(int... more) {
            if (size + more.length > values.length) {
                values = Arrays.copyOf(values, Math.max(values.length * 2, size + more.length));
            }
            System.arraycopy(more, 0, values, size, more.length);
            size += more.length;
        }

        int[] toArray() {
            return Arrays.copyOf(values, size);
        }
    }

    /**
     * Một thiết bị, trường nào thiếu và trường nào thừa — cho cơ quan quản lý cân đối. Chỉ các trường
     * người xem được thấy và đã có thiết bị trên sổ; xếp trường thiếu trước, rồi trường thừa.
     */
    @Transactional(propagation = Propagation.SUPPORTS)
    public List<CatalogSchool> catalogSchools(Long catalogId) {
        // Đọc từ bản tổng hợp đã đệm của cùng phạm vi (cùng các trường đã có thiết bị, cùng phép tính),
        // không tính lại định mức của mọi trường cho mỗi cú bấm một dòng.
        SummaryEntry entry = summaryEntry(campuses.effectiveFilter(null));
        int[] packed = entry.catalogSchools().getOrDefault(catalogId, new int[0]);
        List<CatalogSchool> out = new ArrayList<>(packed.length / 5);
        for (int i = 0; i + 4 < packed.length; i += 5) {
            SchoolSummary school = entry.schools().get(packed[i]);
            out.add(new CatalogSchool(school.schoolId(), school.schoolName(), school.level(), school.district(),
                    packed[i + 1], packed[i + 2], packed[i + 3], packed[i + 4]));
        }
        out.sort((x, y) -> x.shortage() != y.shortage() ? Integer.compare(y.shortage(), x.shortage())
                : Integer.compare(y.surplus(), x.surplus()));
        return out;
    }

    /** Một dòng phụ lục đòi thiết bị này: cấp, nhóm, chủ đề, lớp, số lượng nguyên văn. */
    public record NormLine(String code, String levelCode, String levelName, String itemNo, String section,
            String topic, String gradeLevels, String quantityText, boolean forTeacher, boolean forStudent,
            boolean optional) {
    }

    /**
     * Thiết bị này đứng đâu so với chuẩn, ĐỐI VỚI một trường — cho hồ sơ tài sản.
     *
     * <p>{@code status}: {@code MINIMUM} (thuộc danh mục tối thiểu của cấp học của trường),
     * {@code OTHER_LEVEL} (thuộc danh mục tối thiểu, nhưng của cấp khác), {@code NOT_MINIMUM} (danh mục
     * của Sở, ngoài thông tư), {@code SCHOOL_ITEM} (thiết bị ngoài danh mục trường tự thêm).
     * {@code adequacy} chỉ có với {@code MINIMUM}: định mức tính cho trường, đang có, còn thiếu.
     */
    public record CatalogStandard(String status, String catalogCode, String catalogName, String typeName,
            String subjectName, String legalBasis, String schoolLevel, List<NormLine> norms, NormRow adequacy,
            // Đơn vị tính của thiết bị — số cần có / đang có đọc kèm đơn vị ("100 Gam", không phải "100").
            String unitName) {
    }

    public CatalogStandard forCatalog(Long schoolId, Long catalogId) {
        Map<String, Object> c = jdbc.queryForList("""
                SELECT c.code, c.name, c.owner_school_id, c.legal_basis, t.name AS type_name, sj.name AS subject_name,
                       u.name AS unit_name
                FROM equipment_catalogs c
                LEFT JOIN units u ON u.id = c.unit_id
                LEFT JOIN equipment_types t ON t.id = c.equipment_type_id
                LEFT JOIN subjects sj ON sj.id = c.subject_id
                WHERE c.id = ?""", catalogId).stream().findFirst()
                .orElseThrow(() -> new ResourceNotFoundException("EquipmentCatalog", catalogId));
        Map<String, Object> school = jdbc.queryForList("""
                SELECT lv.code, lv.name FROM schools s JOIN education_levels lv ON lv.id = s.education_level_id
                WHERE s.id = ?""", schoolId).stream().findFirst().orElse(Map.of());
        String levelCode = (String) school.get("code");
        List<NormLine> norms = jdbc.query("""
                SELECT n.code, lv.code AS level_code, lv.name AS level_name, n.item_no, n.section_name, n.topic,
                       n.grade_levels, n.quantity_text, n.for_teacher, n.for_student, n.optional
                FROM equipment_norms n
                JOIN equipment_standards sd ON sd.id = n.standard_id AND sd.active
                JOIN education_levels lv ON lv.id = sd.education_level_id
                WHERE n.active AND n.catalog_id = ? AND (n.effective_to IS NULL OR n.effective_to > CURRENT_DATE)
                ORDER BY (lv.code = ?) DESC, n.sort_order, n.id""",
                (rs, i) -> new NormLine(rs.getString("code"), rs.getString("level_code"), rs.getString("level_name"),
                        rs.getString("item_no"), rs.getString("section_name"), rs.getString("topic"),
                        rs.getString("grade_levels"), rs.getString("quantity_text"), rs.getBoolean("for_teacher"),
                        rs.getBoolean("for_student"), rs.getBoolean("optional")),
                catalogId, levelCode);
        boolean applies = levelCode != null && norms.stream().anyMatch(n -> levelCode.equals(n.levelCode()));
        String status = c.get("owner_school_id") != null ? "SCHOOL_ITEM"
                : applies ? "MINIMUM"
                : norms.isEmpty() ? "NOT_MINIMUM" : "OTHER_LEVEL";
        NormRow adequacy = null;
        if (applies) {
            adequacy = compute(Set.of(schoolId), campusIn(schoolId, null)).stream()
                    .flatMap(a -> a.rows().stream())
                    .filter(r -> catalogId.equals(r.catalogId()))
                    .findFirst().orElse(null);
        }
        return new CatalogStandard(status, (String) c.get("code"), (String) c.get("name"), (String) c.get("type_name"),
                (String) c.get("subject_name"), (String) c.get("legal_basis"), (String) school.get("name"), norms,
                adequacy, (String) c.get("unit_name"));
    }

    public Snapshot snapshot(Long schoolId, Long catalogId) {
        // Tài khoản một cơ sở: số đang có và định mức của cơ sở đó; còn lại cả trường.
        Long campus = campusIn(schoolId, null);
        Integer current = jdbc.queryForObject("""
                SELECT COALESCE(SUM(COALESCE(e.quantity, 1)), 0)::int FROM equipment e
                WHERE e.school_id = ? AND e.catalog_id = ? AND e.status IN %s%s""".formatted(USABLE,
                inCampus("e.room_id", "e.school_id", campus)),
                Integer.class, schoolId, catalogId);
        Integer required = null;
        List<SchoolAdequacy> rows = compute(Set.of(schoolId), campus);
        if (!rows.isEmpty()) {
            required = rows.get(0).rows().stream()
                    .filter(r -> catalogId.equals(r.catalogId()))
                    .map(NormRow::required)
                    .filter(r -> r != null)
                    .findFirst().orElse(null);
        }
        return new Snapshot(current == null ? 0 : current, required);
    }

    // ------------------------------------------------------------------ nội bộ

    /** Lớp học năm hiện hành của một trường: khối (số) và sĩ số. */
    record SchoolClass(int grade, Integer students) {
    }

    record School(Long id, String code, String name, String level, String levelCode, String district,
            Integer classCount, Integer studentCount) {
    }

    /** {@code schoolIds == null} là mọi trường; {@code campusId}: chỉ một cơ sở (null = cả trường). */
    private List<SchoolAdequacy> compute(Set<Long> schoolIds, Long campusId) {
        List<SchoolAdequacy> result = new ArrayList<>();
        computeEach(schoolIds, campusId, result::add);
        return result;
    }

    /** Vế lọc cơ sở trên phòng {@code roomIdExpr} (trống = cơ sở chính); rỗng khi không lọc. */
    private static String inCampus(String roomIdExpr, String schoolIdExpr, Long campusId) {
        return campusId == null ? "" : FacilityCounting.roomInCampusSql(roomIdExpr, schoolIdExpr,
                String.valueOf(campusId.longValue()));
    }

    /**
     * Như {@link #compute}, nhưng giao từng trường cho {@code sink} ngay khi tính xong thay vì gom cả
     * danh sách — phép tổng hợp toàn ngành chỉ cần giữ một trường một lúc.
     */
    private void computeEach(Set<Long> schoolIds, Long campusId, Consumer<SchoolAdequacy> sink) {
        if (schoolIds != null && schoolIds.isEmpty()) {
            return;
        }
        // Một cơ sở (giai đoạn 3): lớp theo phòng học của lớp, giáo viên theo cơ sở của cán bộ, phòng bộ môn và thiết
        // bị theo cơ sở của phòng (không phòng → cơ sở chính), đề xuất mua sắm thuộc cơ sở chính. Điều chỉnh chuẩn
        // là của cả trường: thay thế / ngoài danh mục áp ở mọi cơ sở (đếm thiết bị của cơ sở), ĐỔI SỐ LƯỢNG chỉ áp
        // ở cơ sở chính — số đã duyệt là cho cả trường, nhân nó lên từng cơ sở là đòi gấp đôi.
        if (campusId != null) {
            Long school = campuses.schoolOfCampus(campusId);
            if (school == null || (schoolIds != null && !schoolIds.contains(school))) {
                return;
            }
            schoolIds = Set.of(school);
        }
        String classCounts = campusId == null ? FacilityCounting.CLASS_COUNTS
                : "SELECT * FROM (" + FacilityCounting.CLASS_COUNTS_BY_CAMPUS + ") z WHERE z.campus_id = "
                        + campusId.longValue();
        String classCampus = inCampus("c.room_id", "c.school_id", campusId);
        String staffCampus = campusId == null ? "" : " AND (SELECT " + FacilityCounting.EFFECTIVE_CAMPUS
                + " FROM (SELECT 1) one" + FacilityCounting.campusJoins("a.campus_id", "a.school_id") + ") = "
                + campusId.longValue();
        String roomCampus = inCampus("r.id", "r.school_id", campusId);
        String eqCampus = inCampus("e.room_id", "e.school_id", campusId);
        String proposalCampus = inCampus("NULL", "p.school_id", campusId);
        boolean quantityAdjustments = campusId == null || campuses.isMainCampus(campusId);
        String ids = schoolIds == null ? null
                : schoolIds.stream().map(String::valueOf).collect(Collectors.joining(","));
        String schoolFilter = ids == null ? "" : " AND s.id IN (" + ids + ")";
        String eqFilter = ids == null ? "" : " AND e.school_id IN (" + ids + ")";

        List<School> schools = jdbc.query("""
                SELECT s.id, s.code, s.name, lv.name AS level, lv.code AS level_code,
                       -- Địa bàn là PHƯỜNG / XÃ hiện hành; cột quận cũ chỉ là chỗ dựa khi trường chưa gắn phường.
                       COALESCE(w.name, NULLIF(s.ward_text, ''), s.district) AS district,
                       -- Học sinh, lớp: CHỈ lớp năm học hiện hành (FacilityCounting) — không có lớp là null.
                       cl.classes::int AS class_count, cl.students::int AS student_count
                FROM schools s JOIN education_levels lv ON lv.id = s.education_level_id
                LEFT JOIN wards w ON w.id = s.ward_id
                LEFT JOIN (%s) cl ON cl.school_id = s.id
                WHERE s.status = 'ACTIVE'%s
                ORDER BY s.name""".formatted(classCounts, schoolFilter),
                (rs, i) -> new School(rs.getLong("id"), rs.getString("code"), rs.getString("name"),
                        rs.getString("level"), rs.getString("level_code"), rs.getString("district"),
                        (Integer) rs.getObject("class_count"), (Integer) rs.getObject("student_count")));
        if (schools.isEmpty()) {
            return;
        }

        Map<String, List<Map<String, Object>>> normsByLevel = normsByLevel();

        Map<Long, List<SchoolClass>> classes = new HashMap<>();
        jdbc.query("""
                SELECT c.school_id, g.code AS grade, c.student_count
                FROM school_classes c JOIN school_years y ON y.id = c.school_year_id AND y.is_current
                JOIN grades g ON g.id = c.grade_id
                WHERE c.active%s%s""".formatted(ids == null ? "" : " AND c.school_id IN (" + ids + ")", classCampus),
                rs -> {
            Integer grade = gradeNumber(rs.getString("grade"));
            if (grade != null) {
                classes.computeIfAbsent(rs.getLong("school_id"), k -> new ArrayList<>())
                        .add(new SchoolClass(grade, (Integer) rs.getObject("student_count")));
            }
        });

        // Giáo viên theo môn (môn chính hoặc môn dạy) theo PHÂN CÔNG của năm học hiện hành (277; điểm trường của
        // phân công) — và tổng số giáo viên cho thiết bị dùng chung.
        Map<Long, Map<Long, Integer>> teachers = new HashMap<>();
        Map<Long, Integer> allTeachers = new HashMap<>();
        jdbc.query("""
                SELECT st.school_id, x.subject_id, count(DISTINCT st.id) AS n
                FROM staff_assignments a
                JOIN school_years y ON y.id = a.school_year_id AND y.is_current
                JOIN staff st ON st.id = a.staff_id
                JOIN (SELECT id AS assignment_id, main_subject_id AS subject_id FROM staff_assignments
                      WHERE main_subject_id IS NOT NULL
                      UNION SELECT assignment_id, subject_id FROM staff_assignment_subjects) x ON x.assignment_id = a.id
                WHERE st.active AND st.staff_type = 'TEACHER'%s%s
                GROUP BY 1, 2""".formatted(ids == null ? "" : " AND st.school_id IN (" + ids + ")", staffCampus),
                rs -> {
            teachers.computeIfAbsent(rs.getLong("school_id"), k -> new HashMap<>())
                    .put(rs.getLong("subject_id"), rs.getInt("n"));
        });
        jdbc.query("""
                SELECT st.school_id, count(*) AS n FROM staff_assignments a
                JOIN school_years y ON y.id = a.school_year_id AND y.is_current
                JOIN staff st ON st.id = a.staff_id WHERE st.active AND st.staff_type = 'TEACHER'%s%s
                GROUP BY 1""".formatted(ids == null ? "" : " AND st.school_id IN (" + ids + ")", staffCampus),
                rs -> {
                    allTeachers.put(rs.getLong("school_id"), rs.getInt("n"));
                });

        // Phòng bộ môn theo môn (100) — cho định mức "tính cho 01 phòng học bộ môn". Phòng được tính theo
        // FacilityCounting: còn dùng, không ngừng sử dụng, đã xác nhận.
        Map<Long, Map<Long, Integer>> subjectRooms = new HashMap<>();
        jdbc.query("""
                SELECT r.school_id, r.subject_id, count(*) AS n FROM rooms r
                WHERE""" + FacilityCounting.COUNTED_ROOM + """
                AND r.subject_id IS NOT NULL%s%s
                GROUP BY 1, 2""".formatted(ids == null ? "" : " AND r.school_id IN (" + ids + ")", roomCampus),
                rs -> {
            subjectRooms.computeIfAbsent(rs.getLong("school_id"), k -> new HashMap<>())
                    .put(rs.getLong("subject_id"), rs.getInt("n"));
        });

        Map<Long, Map<Long, Integer>> byCatalog = new HashMap<>();
        Map<Long, Map<Long, Integer>> byType = new HashMap<>();
        jdbc.query("""
                SELECT e.school_id, e.catalog_id, c.equipment_type_id, SUM(COALESCE(e.quantity, 1))::int AS n
                FROM equipment e JOIN equipment_catalogs c ON c.id = e.catalog_id
                WHERE e.status IN %s%s%s GROUP BY 1, 2, 3""".formatted(USABLE, eqFilter, eqCampus), rs -> {
            long school = rs.getLong("school_id");
            byCatalog.computeIfAbsent(school, k -> new HashMap<>()).merge(rs.getLong("catalog_id"), rs.getInt("n"),
                    Integer::sum);
            Long type = (Long) rs.getObject("equipment_type_id");
            if (type != null) {
                byType.computeIfAbsent(school, k -> new HashMap<>()).merge(type, rs.getInt("n"), Integer::sum);
            }
        });
        Map<Long, Map<Long, Integer>> proposedByCatalog = new HashMap<>();
        jdbc.query("""
                SELECT p.school_id, l.catalog_id, SUM(l.quantity)::int AS n
                FROM purchase_proposals p JOIN purchase_proposal_lines l ON l.proposal_id = p.id
                WHERE p.status IN ('PENDING', 'APPROVED', 'COMPLETED') AND p.intake_id IS NULL%s%s
                GROUP BY 1, 2""".formatted(ids == null ? "" : " AND p.school_id IN (" + ids + ")", proposalCampus),
                rs -> {
            proposedByCatalog.computeIfAbsent(rs.getLong("school_id"), k -> new HashMap<>())
                    .merge(rs.getLong("catalog_id"), rs.getInt("n"), Integer::sum);
        });

        // Điều chỉnh chuẩn (154): thiết bị nào Sở cho điều chỉnh ở cấp nào, và dòng đã duyệt mới nhất của mỗi
        // (trường, thiết bị). Thiết bị thay thế đếm như thiết bị gốc: số dùng được ở trường.
        Map<String, Set<Long>> adjustableByLevel = new HashMap<>();
        jdbc.query("""
                SELECT lv.code, r.catalog_id FROM standard_adjustment_rules r
                JOIN education_levels lv ON lv.id = r.education_level_id""", rs -> {
            adjustableByLevel.computeIfAbsent(rs.getString(1), k -> new HashSet<>()).add(rs.getLong(2));
        });
        Map<Long, Map<Long, Adjustment>> adjustments = new HashMap<>();
        jdbc.query("""
                SELECT DISTINCT ON (a.school_id, l.catalog_id) a.school_id, l.catalog_id, l.id, l.method, l.quantity,
                       l.substitute_catalog_id, sc.code AS sub_code, sc.name AS sub_name, l.ratio, l.reason,
                       to_char(a.reviewed_at AT TIME ZONE 'Asia/Ho_Chi_Minh', 'DD/MM/YYYY') AS approved_at
                FROM standard_adjustment_lines l
                JOIN standard_adjustments a ON a.id = l.adjustment_id
                LEFT JOIN equipment_catalogs sc ON sc.id = l.substitute_catalog_id
                WHERE l.decision = 'APPROVED'%s
                ORDER BY a.school_id, l.catalog_id, a.reviewed_at DESC, l.id DESC""".formatted(
                ids == null ? "" : " AND a.school_id IN (" + ids + ")"), rs -> {
            long school = rs.getLong("school_id");
            Long sub = (Long) rs.getObject("substitute_catalog_id");
            int subCount = sub == null ? 0 : byCatalog.getOrDefault(school, Map.of()).getOrDefault(sub, 0);
            adjustments.computeIfAbsent(school, k -> new HashMap<>()).put(rs.getLong("catalog_id"),
                    new Adjustment(rs.getLong("id"), rs.getString("method"), (Integer) rs.getObject("quantity"), sub,
                            rs.getString("sub_code"), rs.getString("sub_name"), rs.getBigDecimal("ratio"), subCount,
                            rs.getString("reason"), rs.getString("approved_at")));
        });

        for (School s : schools) {
            Set<Long> adjustable = adjustableByLevel.getOrDefault(s.levelCode(), Set.of());
            Map<Long, Adjustment> ownAdjustments = adjustments.getOrDefault(s.id(), Map.of());
            List<SchoolClass> own = classes.getOrDefault(s.id(), List.of());
            Context ctx = new Context(s, own, LEVEL_GRADES.getOrDefault(s.levelCode(), new int[0]),
                    teachers.getOrDefault(s.id(), Map.of()), allTeachers.getOrDefault(s.id(), 0),
                    subjectRooms.getOrDefault(s.id(), Map.of()));
            // Dữ liệu nền theo môn: mỗi môn của danh mục cấp này, trường có mấy giáo viên, mấy phòng, và có
            // bao nhiêu dòng tính theo giáo viên / theo phòng.
            Map<Long, int[]> subjectUse = new LinkedHashMap<>();
            Map<Long, String> subjectNames = new HashMap<>();
            Map<Long, Integer> eqCatalog = byCatalog.getOrDefault(s.id(), Map.of());
            Map<Long, Integer> eqType = byType.getOrDefault(s.id(), Map.of());
            Map<Long, Integer> proposed = proposedByCatalog.getOrDefault(s.id(), Map.of());

            // Một dòng mỗi thiết bị: dòng định mức đòi nhiều nhất thắng.
            Map<String, NormRow> rows = new LinkedHashMap<>();
            for (Map<String, Object> n : normsByLevel.getOrDefault(s.levelCode(), List.of())) {
                Long catalogId = longOf(n.get("catalog_id"));
                Long typeId = longOf(n.get("equipment_type_id"));
                boolean optional = Boolean.TRUE.equals(n.get("optional"));
                Requirement req = ctx.required(n);
                int current = catalogId != null ? eqCatalog.getOrDefault(catalogId, 0)
                        : typeId == null ? 0 : eqType.getOrDefault(typeId, 0);
                int prop = catalogId == null ? 0 : proposed.getOrDefault(catalogId, 0);
                Adjustment adj = catalogId == null ? null : ownAdjustments.get(catalogId);
                if (adj != null && !quantityAdjustments && "QUANTITY".equals(adj.method())) {
                    adj = null;
                }
                Integer required = effectiveRequired(req.value(), adj);
                int have = current + substituted(adj);
                Integer shortage = required == null ? null : Math.max(0, required - have);
                Integer surplus = required == null ? null : Math.max(0, have - required);
                Long subjectId = longOf(n.get("subject_id"));
                if (subjectId != null && !optional && !"CHUNG".equals(n.get("subject_code"))) {
                    int[] use = subjectUse.computeIfAbsent(subjectId, k -> new int[2]);
                    subjectNames.put(subjectId, (String) n.get("subject_name"));
                    if ("PER_TEACHER".equals(n.get("norm_basis"))) {
                        use[0]++;
                    } else if ("PER_ROOM".equals(n.get("norm_basis"))) {
                        use[1]++;
                    }
                }
                NormRow row = new NormRow(longOf(n.get("id")), (String) n.get("code"),
                        (String) n.get("catalog_name"), catalogId, (String) n.get("catalog_code"),
                        longOf(n.get("subject_id")), (String) n.get("subject_name"), typeId,
                        (String) n.get("type_name"), (String) n.get("norm_basis"), (BigDecimal) n.get("min_quantity"),
                        (Integer) n.get("basis_size"), (String) n.get("quantity_text"),
                        (String) n.get("grade_levels"), optional, required, have, prop, shortage, surplus,
                        optional ? "Tự chọn — chỉ trang bị phương án / môn trường đã chọn"
                                : required != null && req.value() == null ? null : req.warning(),
                        req.value(), current, catalogId != null && adjustable.contains(catalogId), adj);
                String key = catalogId != null ? "c" + catalogId : "n" + row.normId();
                NormRow existing = rows.get(key);
                if (existing == null || stronger(row, existing)) {
                    rows.put(key, row);
                }
            }
            int met = 0;
            int unknown = 0;
            int shortageTotal = 0;
            int shortItems = 0;
            int surplusTotal = 0;
            int surplusItems = 0;
            int counted = 0;
            int baseMet = 0;
            int adjustedRows = 0;
            for (NormRow r : rows.values()) {
                if (r.counted() && r.baseRequired() != null && r.baseCurrent() >= r.baseRequired()) {
                    baseMet++;
                }
                if (r.adjustment() != null) {
                    adjustedRows++;
                }
                // Dòng phụ lục không ghi số (vd. "Bàn để máy tính") chỉ để biết — không vào thống kê, kẻo
                // trường nào cũng mang cờ "chưa tính được" vì một ô văn bản gốc để trống.
                if (!r.counted()) {
                    continue;
                }
                counted++;
                if (r.required() == null) {
                    unknown++;
                } else if (r.shortage() == 0) {
                    met++;
                    if (r.surplus() > 0) {
                        surplusItems++;
                        surplusTotal += r.surplus();
                    }
                } else {
                    shortItems++;
                    shortageTotal += r.shortage();
                }
            }
            Map<Integer, int[]> perGrade = new TreeMap<>();
            for (int g : ctx.levelGrades()) {
                perGrade.put(g, new int[3]);
            }
            for (SchoolClass c : own) {
                int[] g = perGrade.computeIfAbsent(c.grade(), k -> new int[3]);
                g[0]++;
                if (c.students() == null) {
                    g[2]++;
                } else {
                    g[1] += c.students();
                }
            }
            List<GradeInput> grades = perGrade.entrySet().stream()
                    .map(e -> new GradeInput(e.getKey(), e.getValue()[0], e.getValue()[1], e.getValue()[2])).toList();
            Map<Long, Integer> ownTeachers = teachers.getOrDefault(s.id(), Map.of());
            Map<Long, Integer> ownRooms = subjectRooms.getOrDefault(s.id(), Map.of());
            List<SubjectInput> subjectInputs = subjectUse.entrySet().stream()
                    .map(e -> new SubjectInput(e.getKey(), subjectNames.get(e.getKey()),
                            ownTeachers.getOrDefault(e.getKey(), 0), ownRooms.getOrDefault(e.getKey(), 0),
                            e.getValue()[0], e.getValue()[1]))
                    .sorted((x, y) -> x.subjectName().compareTo(y.subjectName()))
                    .toList();
            Inputs inputs = new Inputs(!own.isEmpty(), grades, allTeachers.getOrDefault(s.id(), 0), subjectInputs);
            sink.accept(new SchoolAdequacy(s.id(), s.code(), s.name(), s.level(), s.levelCode(), s.district(),
                    s.classCount(), s.studentCount(), counted, met, unknown, shortItems, shortageTotal,
                    surplusItems, surplusTotal, !eqCatalog.isEmpty(), inputs, new ArrayList<>(rows.values()), baseMet,
                    adjustedRows));
        }
    }

    /** Số phải có sau điều chỉnh: đổi số lượng thì lấy số đã duyệt, cách khác giữ chuẩn Bộ. */
    private static Integer effectiveRequired(Integer base, Adjustment adj) {
        return adj != null && "QUANTITY".equals(adj.method()) && adj.quantity() != null ? adj.quantity() : base;
    }

    /** Thiết bị thay thế quy về thiết bị gốc: {@code ⌊số thay thế ÷ tỉ lệ⌋}. */
    private static int substituted(Adjustment adj) {
        if (adj == null || "QUANTITY".equals(adj.method()) || adj.ratio() == null || adj.substituteCount() == 0) {
            return 0;
        }
        return BigDecimal.valueOf(adj.substituteCount()).divide(adj.ratio(), 0, RoundingMode.FLOOR).intValue();
    }

    /** Bỏ đệm tổng hợp — sau khi một đề nghị điều chỉnh được duyệt hoặc quy định đổi. */
    public void evictSummaries() {
        summaryGeneration.incrementAndGet();
        summaryCache.clear();
    }

    /** Định mức của từng cấp học — đọc một lần cho mọi trường cùng cấp, đệm 60 giây. */
    Map<String, List<Map<String, Object>>> normsByLevel() {
        Cached<Map<String, List<Map<String, Object>>>> hit = normsCache;
        if (hit != null && hit.fresh()) {
            return hit.value();
        }
        Map<String, List<Map<String, Object>>> byLevel = new HashMap<>();
        for (Map<String, Object> n : jdbc.queryForList("""
                SELECT lv.code AS level_code, n.id, n.code, n.name, n.catalog_id, c.code AS catalog_code,
                       COALESCE(c.name, n.name) AS catalog_name, n.subject_id, sj.name AS subject_name,
                       sj.code AS subject_code, n.equipment_type_id, t.name AS type_name, n.norm_basis,
                       n.min_quantity, n.basis_size, n.quantity_text, n.grade_levels, n.optional
                FROM equipment_norms n
                JOIN equipment_standards sd ON sd.id = n.standard_id AND sd.active
                JOIN education_levels lv ON lv.id = sd.education_level_id
                LEFT JOIN equipment_catalogs c ON c.id = n.catalog_id
                LEFT JOIN subjects sj ON sj.id = n.subject_id
                LEFT JOIN equipment_types t ON t.id = n.equipment_type_id
                WHERE n.active AND (n.effective_to IS NULL OR n.effective_to > CURRENT_DATE)
                ORDER BY n.sort_order, n.id""")) {
            byLevel.computeIfAbsent((String) n.get("level_code"), k -> new ArrayList<>()).add(n);
        }
        normsCache = new Cached<>(byLevel, System.currentTimeMillis());
        return byLevel;
    }

    /** Dòng nào "đòi" hơn: dòng bắt buộc hơn dòng tự chọn, có số hơn không số, số lớn hơn số nhỏ. */
    private static boolean stronger(NormRow a, NormRow b) {
        if (a.optional() != b.optional()) {
            return !a.optional();
        }
        if (b.required() == null) {
            return a.required() != null;
        }
        return a.required() != null && a.required() > b.required();
    }

    record Requirement(Integer value, String warning) {
    }

    /** Dữ liệu của một trường mà phép tính một dòng định mức cần. */
    record Context(School school, List<SchoolClass> classes, int[] levelGrades,
            Map<Long, Integer> subjectTeachers, int teachers, Map<Long, Integer> subjectRooms) {

        Requirement required(Map<String, Object> n) {
            BigDecimal qty = (BigDecimal) n.get("min_quantity");
            if (qty == null) {
                return new Requirement(null, "Phụ lục không ghi số lượng");
            }
            int size = n.get("basis_size") == null ? 1 : Math.max(1, (Integer) n.get("basis_size"));
            String grades = (String) n.get("grade_levels");
            Set<Integer> applies = grades == null ? null
                    : Arrays.stream(grades.split(",")).map(Integer::valueOf).collect(Collectors.toSet());
            List<SchoolClass> inGrades = classes.stream()
                    .filter(c -> applies == null || applies.contains(c.grade())).toList();
            String basis = (String) n.get("norm_basis");
            return switch (basis == null ? "PER_SCHOOL" : basis) {
                case "PER_CLASS" -> {
                    Integer count = classCount(inGrades);
                    yield count == null ? new Requirement(null, FacilityCounting.NO_CLASSES)
                            : new Requirement(times(qty, ceil(count, size)), null);
                }
                case "PER_STUDENT" -> {
                    if (classes.isEmpty()) {
                        yield new Requirement(null, FacilityCounting.NO_CLASSES);
                    }
                    if (inGrades.stream().anyMatch(c -> c.students() == null)) {
                        yield new Requirement(null, "Có lớp chưa nhập sĩ số");
                    }
                    int groups = inGrades.stream().mapToInt(c -> ceil(c.students(), size)).sum();
                    yield new Requirement(times(qty, groups), null);
                }
                case "PER_TEACHER" -> {
                    Long subject = n.get("subject_id") == null ? null : ((Number) n.get("subject_id")).longValue();
                    boolean shared = subject == null || "CHUNG".equals(n.get("subject_code"));
                    int count = shared ? teachers : subjectTeachers.getOrDefault(subject, 0);
                    if (count > 0) {
                        yield new Requirement(times(qty, count), null);
                    }
                    // Tiểu học: môn do giáo viên chủ nhiệm dạy thì số giáo viên chính là số lớp. Cấp
                    // khác thì đoán bằng số lớp là bắt trường Sử 24 lớp mua 24 bộ cho vài giáo viên.
                    if (homeroomTaught(n)) {
                        Integer classCount = classCount(inGrades);
                        if (classCount != null) {
                            yield new Requirement(times(qty, classCount),
                                    "Tiểu học: giáo viên chủ nhiệm dạy môn — tính mỗi lớp một giáo viên");
                        }
                    }
                    yield new Requirement(null, "Trường chưa khai giáo viên dạy môn");
                }
                case "PER_ROOM" -> {
                    Long subject = n.get("subject_id") == null ? null : ((Number) n.get("subject_id")).longValue();
                    int rooms = subject == null ? 0 : subjectRooms.getOrDefault(subject, 0);
                    // Chưa khai phòng của môn: vẫn đòi đủ cho MỘT phòng — danh mục là thứ trường phải có.
                    yield rooms > 0 ? new Requirement(times(qty, rooms), null)
                            : new Requirement(times(qty, 1), "Chưa khai phòng bộ môn của môn — tính một phòng");
                }
                default -> new Requirement(times(qty, 1), null);
            };
        }

        /** Môn tiểu học do giáo viên chủ nhiệm dạy (không phải môn có giáo viên chuyên). */
        private boolean homeroomTaught(Map<String, Object> n) {
            return "TH".equals(school.levelCode()) && HOMEROOM_SUBJECTS.contains((String) n.get("subject_code"));
        }

        /** Số lớp áp dụng; chưa có lớp năm học hiện hành thì null — không lấy số nào khác. */
        private Integer classCount(List<SchoolClass> inGrades) {
            return classes.isEmpty() ? null : inGrades.size();
        }
    }

    private static int ceil(int value, int size) {
        return (value + size - 1) / size;
    }

    private static int times(BigDecimal qty, int factor) {
        return qty.multiply(BigDecimal.valueOf(factor)).setScale(0, RoundingMode.CEILING).intValue();
    }

    static Integer gradeNumber(String code) {
        String digits = code == null ? "" : code.replaceAll("\\D", "");
        return digits.isEmpty() ? null : Integer.valueOf(digits);
    }

    static Long longOf(Object value) {
        return value == null ? null : ((Number) value).longValue();
    }

    Set<Long> visibleSchools() {
        return visibleSchools.current();
    }

    static int percent(int part, int whole) {
        return whole == 0 ? 0 : Math.round(part * 100f / whole);
    }
}
