package com.g123.sfems.module.system.dataimport;

import com.anthropic.errors.AnthropicServiceException;
import com.anthropic.errors.RateLimitException;
import com.anthropic.models.messages.MessageCreateParams;
import com.anthropic.models.messages.StructuredMessage;
import com.anthropic.models.messages.StructuredMessageCreateParams;
import com.g123.sfems.module.system.ai.AiSettingsService;
import com.g123.sfems.shared.exception.ConflictException;
import com.g123.sfems.shared.exception.FieldValidationException;
import com.g123.sfems.shared.security.CurrentUser;
import com.fasterxml.jackson.annotation.JsonPropertyDescription;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import tools.jackson.databind.ObjectMapper;

/**
 * AI gợi ý sửa dòng lỗi / cảnh báo ở vùng chờ nhập dữ liệu. CHỈ GỢI Ý: trả về "ô nào, giá trị cũ → mới, vì sao";
 * người dùng nhận thì đi qua đúng {@code PATCH /data_imports/{id}/rows} như sửa tay, nên bộ kiểm cả lô vẫn là chỗ
 * duy nhất quyết định dòng nào hợp lệ. AI không có đường ghi nào.
 *
 * <p>Ba lớp giữ cho gợi ý không bịa: (1) mỗi dòng gửi kèm DANH SÁCH GIÁ TRỊ ĐƯỢC PHÉP — thiết bị ứng viên trong danh
 * mục, đơn vị tính, mã phòng của lô và của trường; (2) đầu ra là JSON theo lược đồ (structured output); (3) máy chủ
 * kiểm lại từng gợi ý — ô phải là cột của trang, mã thiết bị / đơn vị / phòng phải nằm trong danh sách đã gửi.
 *
 * <p>Ngoài dòng lỗi, AI còn xem dòng thiết bị "Không có trong danh mục" (chỉ là lưu ý): tìm trong các ứng viên gần tên
 * xem có đúng thiết bị đó không — việc ghép danh mục là chỗ AI có ích nhất. Dòng như vậy mà không có ứng viên nào thì
 * không gửi (không tốn tiền vô ích).
 *
 * <p>Dữ liệu gửi đi: chỉ các ô của dòng được chọn và lời báo lỗi của nó. Trang Cán bộ – giáo viên không dùng AI (họ
 * tên, số điện thoại, email là dữ liệu cá nhân). Bật / tắt, khoá, mô hình: màn "Cấu hình AI" ({@link AiSettingsService}).
 */
@Service
public class OnboardingAiService {

    private static final Logger log = LoggerFactory.getLogger(OnboardingAiService.class);

    /** Trang được dùng AI — không có dữ liệu cá nhân. */
    static final Set<OnboardingSheet> SHEETS = EnumSet.of(OnboardingSheet.EQUIPMENT, OnboardingSheet.ROOM,
            OnboardingSheet.CLASS, OnboardingSheet.BUILDING, OnboardingSheet.CAMPUS);
    /** Số dòng tối đa mỗi lần gọi — giữ thời gian chờ và chi phí một lần bấm trong tầm. */
    public static final int MAX_ROWS = 30;
    /** Số dòng tối đa AI xem trong MỘT lần bấm (màn hình chia thành các đợt {@link #MAX_ROWS}); còn thì bấm lại. */
    public static final int MAX_ROWS_PER_CLICK = 150;
    private static final int CANDIDATES = 8;
    /** Lưu ý của bộ kiểm khi thiết bị không ghép được danh mục — AI được hỏi cho dòng này. */
    static final String OUT_OF_CATALOG = "Không có trong danh mục";

    /**
     * Một gợi ý. Người dùng luôn xem và sửa được trước khi áp dụng, nên gợi ý không cần chắc chắn mới được đưa ra.
     *
     * @param fieldLabel tên ô khi gợi ý sửa dòng của TRANG KHÁC (đổi mã khối nhà khi đang xem trang Phòng); còn lại null
     * @param rowNo      số dòng khi gợi ý sửa dòng của trang khác; còn lại null
     * @param review     phỏng đoán, người dùng phải tự xem: không tích sẵn
     * @param options    các giá trị hợp lệ của ô, nếu ô chỉ nhận một danh sách — màn hình cho chọn
     */
    public record Suggestion(long rowId, String field, String from, String to, String reason, String fieldLabel,
            Integer rowNo, boolean review, List<String> options) {

        public Suggestion(long rowId, String field, String from, String to, String reason) {
            this(rowId, field, from, to, reason, null, null, false, List.of());
        }
    }

    /** Đầu ra của mô hình — lược đồ JSON sinh từ record (structured output). */
    record AiFix(
            @JsonPropertyDescription("id của dòng, đúng như trong dữ liệu gửi vào") long rowId,
            @JsonPropertyDescription("khoá của ô cần sửa, đúng như trong dữ liệu gửi vào") String field,
            @JsonPropertyDescription("giá trị mới của ô") String value,
            @JsonPropertyDescription("một câu ngắn bằng tiếng Việt: vì sao sửa như vậy") String reason) {
    }

    record AiResult(List<AiFix> fixes) {
    }

    record Catalog(String code, String name, String unit, String subject, String norm) {
    }

    private final JdbcTemplate jdbc;
    private final OnboardingService onboarding;
    private final ObjectMapper mapper;
    private final AiSettingsService settings;

    public OnboardingAiService(JdbcTemplate jdbc, OnboardingService onboarding, ObjectMapper mapper, AiSettingsService settings) {
        this.jdbc = jdbc;
        this.onboarding = onboarding;
        this.mapper = mapper;
        this.settings = settings;
    }

    /** Màn hình hỏi để biết có vẽ nút "AI gợi ý" không. */
    public boolean available() {
        return settings.available();
    }

    public List<Suggestion> suggest(long batchId, String sheetKey, List<Long> rowIds) {
        if (!available()) {
            throw new ConflictException("Chưa bật AI gợi ý — quản trị viên cần cấu hình khoá API");
        }
        OnboardingSheet sheet = OnboardingSheet.of(sheetKey);
        if (sheet == null || !SHEETS.contains(sheet)) {
            throw new FieldValidationException("sheet", "Trang này không dùng AI gợi ý");
        }
        if (rowIds == null || rowIds.isEmpty()) {
            throw new FieldValidationException("rowIds", "Chọn dòng cần gợi ý");
        }
        if (rowIds.size() > MAX_ROWS) {
            throw new FieldValidationException("rowIds", "Mỗi lần gợi ý tối đa %d dòng".formatted(MAX_ROWS));
        }
        Set<Long> wanted = new HashSet<>(rowIds);
        // `rows` kiểm lô có trong phạm vi người gọi thấy không (404 nếu không).
        List<OnboardingService.StagedRow> picked = onboarding.rows(batchId, sheet.key()).stream()
                .filter(r -> wanted.contains(r.id()) && !r.skipped() && !fixableFields(sheet, r).isEmpty())
                .toList();
        if (picked.isEmpty()) {
            return List.of();
        }
        long schoolId = onboarding.get(batchId).school().id();
        List<Catalog> catalogs = sheet == OnboardingSheet.EQUIPMENT ? catalogs(schoolId) : List.of();
        Map<Long, List<Catalog>> candidatesOf = new HashMap<>();
        if (sheet == OnboardingSheet.EQUIPMENT) {
            picked.forEach(r -> candidatesOf.put(r.id(), candidates(catalogs, r.data().get("name"), r.data().get("catalog"))));
        }
        // Dòng chỉ cần ghép danh mục mà không có ứng viên nào thì AI cũng không làm được gì — không gửi.
        List<OnboardingService.StagedRow> rows = picked.stream()
                .filter(r -> !errorFields(r).isEmpty() || !candidatesOf.getOrDefault(r.id(), List.of()).isEmpty())
                .toList();
        if (rows.isEmpty()) {
            return List.of();
        }
        // Ngân sách tháng và số lần mỗi giờ — kiểm sau khi biết có dòng thật để gửi, trước khi tốn tiền.
        settings.requireQuota();

        Set<String> columns = sheet.columns().stream().map(OnboardingSheet.Column::key).collect(Collectors.toSet());
        // Đơn vị nhận theo tên hoặc mã ("Gam" / "g", "Mililít" / "ml") — giống bộ kiểm; gợi ý được đưa về tên đầy đủ.
        Map<String, String> unitByKey = new HashMap<>();
        jdbc.query("SELECT code, name FROM units WHERE active ORDER BY name", rs -> {
            unitByKey.putIfAbsent(OnboardingValidator.norm(rs.getString("name")), rs.getString("name"));
            unitByKey.putIfAbsent(OnboardingValidator.norm(rs.getString("code")), rs.getString("name"));
        });
        List<String> units = unitByKey.values().stream().distinct().sorted().toList();
        Set<String> rooms = codes(batchId, schoolId, "rooms", OnboardingSheet.ROOM);
        // Danh sách giá trị được phép cho các cột tham chiếu / cố định của trang — gửi kèm, và kiểm lại gợi ý theo nó.
        // Cán bộ chỉ gửi MÃ, không gửi họ tên.
        Map<String, List<String>> allowedLists = new LinkedHashMap<>();
        switch (sheet) {
            case CLASS -> {
                allowedLists.put("grade", jdbc.queryForList("SELECT name FROM grades ORDER BY code", String.class));
                allowedLists.put("year", jdbc.queryForList("SELECT code FROM school_years ORDER BY code", String.class));
                allowedLists.put("teacher", sorted(codes(batchId, schoolId, "staff", OnboardingSheet.STAFF)));
                allowedLists.put("room", sorted(rooms));
            }
            case ROOM -> {
                allowedLists.put("building", sorted(codes(batchId, schoolId, "buildings", OnboardingSheet.BUILDING)));
                allowedLists.put("subject", jdbc.queryForList("SELECT name FROM subjects WHERE active ORDER BY name", String.class));
                allowedLists.put("manager", sorted(codes(batchId, schoolId, "staff", OnboardingSheet.STAFF)));
            }
            case BUILDING -> {
                allowedLists.put("campus", sorted(codes(batchId, schoolId, "campuses", OnboardingSheet.CAMPUS)));
                allowedLists.put("manager", sorted(codes(batchId, schoolId, "staff", OnboardingSheet.STAFF)));
            }
            case EQUIPMENT -> {
                allowedLists.put("room", sorted(rooms));
                allowedLists.put("manager", sorted(codes(batchId, schoolId, "staff", OnboardingSheet.STAFF)));
            }
            default -> {
            }
        }

        // Dữ liệu gửi đi: mỗi dòng — id, ô có giá trị, lời báo lỗi; dòng thiết bị kèm ứng viên trong danh mục.
        Map<Long, Set<String>> allowedCatalog = new LinkedHashMap<>();
        List<Map<String, Object>> payload = new ArrayList<>();
        for (OnboardingService.StagedRow r : rows) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("rowId", r.id());
            item.put("row", r.rowNo());
            Map<String, String> cells = new LinkedHashMap<>();
            r.data().forEach((k, v) -> {
                if (v != null && !v.isBlank() && columns.contains(k)) {
                    cells.put(k, v);
                }
            });
            item.put("cells", cells);
            // LỖI, và lưu ý "ngoài danh mục" — các lưu ý khác ("hồ sơ chưa chuẩn"…) không sửa được bằng ô của dòng.
            item.put("problems", r.messages().stream()
                    .filter(m -> "error".equals(m.level()) || isOutOfCatalog(sheet, m))
                    .map(m -> Map.of("field", Objects.toString(m.field(), ""), "text", m.text()))
                    .toList());
            if (sheet == OnboardingSheet.EQUIPMENT) {
                List<Catalog> picks = candidatesOf.getOrDefault(r.id(), List.of());
                allowedCatalog.put(r.id(), picks.stream().map(Catalog::code).collect(Collectors.toSet()));
                item.put("catalogCandidates", picks.stream()
                        .map(c -> Map.of("code", c.code(), "name", c.name(), "unit", Objects.toString(c.unit(), ""),
                                "subject", Objects.toString(c.subject(), "")))
                        .toList());
            }
            payload.add(item);
        }

        Map<String, Object> context = new LinkedHashMap<>();
        context.put("sheet", sheet.title());
        context.put("columns", sheet.columns().stream()
                .map(c -> Map.of("key", c.key(), "label", c.label(), "hint", c.hint()))
                .toList());
        context.put("units", units);
        context.put("allowedValues", allowedLists);
        context.put("rows", payload);

        String json;
        try {
            json = mapper.writeValueAsString(context);
        } catch (RuntimeException e) {
            throw new ConflictException("Không dựng được dữ liệu gửi AI");
        }

        String model = settings.model();
        String reference = "Lô #" + batchId + " · " + sheet.title();
        StructuredMessageCreateParams<AiResult> params = MessageCreateParams.builder()
                .model(model)
                .maxTokens(16000L)
                .system(SYSTEM)
                .outputConfig(AiResult.class)
                .addUserMessage(json)
                .build();
        StructuredMessage<AiResult> response;
        try {
            response = settings.client().messages().create(params);
        } catch (RateLimitException e) {
            settings.record("DATA_IMPORT", reference, model, rows.size(), 0, 0, 0, e.getMessage());
            throw new ConflictException("AI đang quá tải — thử lại sau ít phút");
        } catch (AnthropicServiceException e) {
            log.warn("AI gợi ý lỗi (lô {}): {}", batchId, e.getMessage());
            settings.record("DATA_IMPORT", reference, model, rows.size(), 0, 0, 0, e.getMessage());
            throw new ConflictException("AI không trả lời được lúc này — thử lại sau");
        }
        log.info("AI gợi ý: lô {}, trang {}, {} dòng, người gọi {}, token vào {} ra {}", batchId, sheet.key(), rows.size(),
                CurrentUser.username().orElse("?"), response.usage().inputTokens(), response.usage().outputTokens());

        // Kiểm lại từng gợi ý: đúng dòng đã gửi, đúng cột của trang, giá trị trong danh sách được phép, có thay đổi thật.
        Map<Long, OnboardingService.StagedRow> byId = rows.stream()
                .collect(Collectors.toMap(OnboardingService.StagedRow::id, r -> r));
        Map<String, Map<String, String>> allowedByKey = new HashMap<>();
        allowedLists.forEach((field, values) -> {
            Map<String, String> m = new HashMap<>();
            values.forEach(v -> m.putIfAbsent(OnboardingValidator.norm(v), v));
            allowedByKey.put(field, m);
        });
        List<Suggestion> result = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        int[] returned = {0};
        response.content().stream()
                .flatMap(block -> block.text().stream())
                .flatMap(typed -> typed.text().fixes() == null ? Stream.<AiFix>empty() : typed.text().fixes().stream())
                .forEach(fix -> {
                    returned[0]++;
                    OnboardingService.StagedRow row = byId.get(fix.rowId());
                    if (row == null || fix.field() == null || !columns.contains(fix.field()) || fix.value() == null) {
                        return;
                    }
                    // Chỉ sửa ô đang báo lỗi của chính dòng đó (mã thiết bị và đơn vị tính đi kèm nhau).
                    Set<String> allowed = fixableFields(sheet, row);
                    if (!allowed.contains(fix.field())
                            && !(Set.of("catalog", "unit").contains(fix.field()) && (allowed.contains("catalog") || allowed.contains("unit")))) {
                        return;
                    }
                    String typed = "unit".equals(fix.field())
                            ? unitByKey.getOrDefault(OnboardingValidator.norm(fix.value().trim()), "")
                            : fix.value().trim();
                    // Cột có danh sách được phép (khối, năm học, khối nhà, cơ sở, cán bộ, môn, phòng): phải nằm trong
                    // danh sách, đưa về đúng cách ghi của danh sách.
                    Map<String, String> list = allowedByKey.get(fix.field());
                    String value = list == null || typed.isEmpty() ? typed : list.get(OnboardingValidator.norm(typed));
                    if (value == null) {
                        return;
                    }
                    String from = Objects.toString(row.data().get(fix.field()), "");
                    if (value.equals(from.trim()) || !seen.add(fix.rowId() + "|" + fix.field())) {
                        return;
                    }
                    switch (fix.field()) {
                        case "catalog" -> {
                            if (!allowedCatalog.getOrDefault(fix.rowId(), Set.of()).contains(value)) {
                                return;
                            }
                        }
                        case "unit" -> {
                            if (value.isEmpty()) {
                                return;
                            }
                        }
                        default -> {
                        }
                    }
                    String reason = Objects.toString(fix.reason(), "").trim();
                    if ("catalog".equals(fix.field())) {
                        // Người xem cần thấy TÊN thiết bị trong danh mục, không chỉ mã.
                        String target = value;
                        String catalogName = candidatesOf.getOrDefault(fix.rowId(), List.of()).stream()
                                .filter(c -> c.code().equals(target)).map(Catalog::name).findFirst().orElse("");
                        reason = catalogName.isEmpty() ? reason : catalogName + (reason.isEmpty() ? "" : " — " + reason);
                    }
                    result.add(new Suggestion(fix.rowId(), fix.field(), from, value, reason));
                });
        if (returned[0] != result.size()) {
            log.info("AI gợi ý: lô {}, trang {}: AI trả {} gợi ý, máy chủ giữ {}", batchId, sheet.key(), returned[0], result.size());
        }
        settings.record("DATA_IMPORT", reference, model, rows.size(), result.size(),
                response.usage().inputTokens(), response.usage().outputTokens(), null);
        return result;
    }

    /** Ô AI được sửa ở một dòng: ô đang báo lỗi, và mã thiết bị khi dòng thiết bị nằm ngoài danh mục. */
    static Set<String> fixableFields(OnboardingSheet sheet, OnboardingService.StagedRow r) {
        Set<String> out = new HashSet<>(errorFields(r));
        if (r.messages().stream().anyMatch(m -> isOutOfCatalog(sheet, m))) {
            out.add("catalog");
        }
        return out;
    }

    private static boolean isOutOfCatalog(OnboardingSheet sheet, OnboardingValidator.Message m) {
        return sheet == OnboardingSheet.EQUIPMENT && "warning".equals(m.level()) && "catalog".equals(m.field())
                && m.text() != null && m.text().startsWith(OUT_OF_CATALOG);
    }

    /** Mã của một loại (phòng, khối nhà, cơ sở, cán bộ): đã có trên hệ thống của trường, cộng trang tương ứng trong lô. */
    private Set<String> codes(long batchId, long schoolId, String table, OnboardingSheet sheet) {
        Set<String> out = new HashSet<>(jdbc.queryForList("SELECT code FROM " + table + " WHERE school_id = ?",
                String.class, schoolId));
        onboarding.rows(batchId, sheet.key()).forEach(r -> {
            String code = r.data().get("code");
            if (code != null && !code.isBlank() && !r.skipped()) {
                out.add(code.trim());
            }
        });
        return out;
    }

    private static List<String> sorted(Set<String> s) {
        return s.stream().sorted().toList();
    }

    /** Các ô đang báo LỖI của một dòng. */
    private static Set<String> errorFields(OnboardingService.StagedRow r) {
        return r.messages().stream()
                .filter(m -> "error".equals(m.level()) && m.field() != null)
                .map(OnboardingValidator.Message::field)
                .collect(Collectors.toSet());
    }

    /** Thiết bị trường được ghi tăng: danh mục của cấp học của trường (kể cả gắn thêm) và thiết bị ngoài danh mục của trường. */
    private List<Catalog> catalogs(long schoolId) {
        return jdbc.query("""
                SELECT c.code, c.name, u.name AS unit, sj.name AS subject
                FROM equipment_catalogs c
                JOIN schools s ON s.id = ?
                LEFT JOIN units u ON u.id = c.unit_id
                LEFT JOIN subjects sj ON sj.id = c.subject_id
                WHERE c.active
                  AND (c.owner_school_id = s.id
                       OR (c.owner_school_id IS NULL AND (c.education_level_id = s.education_level_id
                           OR EXISTS (SELECT 1 FROM equipment_catalog_levels l
                                      WHERE l.catalog_id = c.id AND l.education_level_id = s.education_level_id))))
                """, (rs, i) -> new Catalog(rs.getString("code"), rs.getString("name"), rs.getString("unit"),
                rs.getString("subject"), OnboardingValidator.norm(rs.getString("name"))), schoolId);
    }

    /** Ứng viên cho một dòng: thiết bị chung nhiều từ (đã chuẩn hoá) với tên trên dòng nhất, cộng mã đang ghi nếu trùng. */
    static List<Catalog> candidates(List<Catalog> all, String name, String code) {
        Set<String> words = words(name);
        String typed = code == null ? "" : code.trim().toUpperCase();
        return all.stream()
                .map(c -> Map.entry(c, (c.code().equalsIgnoreCase(typed) ? 100 : 0) + overlap(words, words(c.name()))
                        + abbreviations(name, orderedWords(c.name()))))
                .filter(e -> e.getValue() > 0)
                .sorted(Map.Entry.<Catalog, Integer>comparingByValue(Comparator.reverseOrder())
                        .thenComparing(e -> e.getKey().code()))
                .limit(CANDIDATES)
                .map(Map.Entry::getKey)
                .toList();
    }

    private static Set<String> words(String s) {
        if (s == null || s.isBlank()) {
            return Set.of();
        }
        Set<String> out = new HashSet<>();
        for (String w : OnboardingValidator.norm(s).split("_+")) {
            if (w.length() > 1) {
                out.add(w);
            }
        }
        return out;
    }

    /**
     * Điểm giống nhau giữa tên trên dòng và tên trong danh mục: mỗi từ trùng 2 điểm; từ (từ 3 chữ) là ĐẦU một từ trong
     * danh mục 1 điểm — tên cắt ngắn trên sổ vẫn ra ứng viên.
     */
    private static int overlap(Set<String> a, Set<String> b) {
        int n = 0;
        for (String w : a) {
            if (b.contains(w)) {
                n += 2;
            } else if (w.length() >= 3 && b.stream().anyMatch(x -> x.startsWith(w))) {
                n++;
            }
        }
        return n;
    }

    /** Từ viết tắt trên dòng là CHỮ ĐẦU của các từ liền nhau trong tên danh mục ("TN" = "thí nghiệm", "MT" = "máy tính"). */
    static int abbreviations(String rowName, List<String> catalogWords) {
        if (rowName == null || catalogWords.size() < 2) {
            return 0;
        }
        StringBuilder initials = new StringBuilder();
        catalogWords.forEach(w -> initials.append(w.charAt(0)));
        int n = 0;
        for (String w : OnboardingValidator.norm(rowName).split("_+")) {
            if (w.length() >= 2 && w.length() <= 4 && w.chars().allMatch(Character::isLetter)
                    && initials.indexOf(w) >= 0) {
                n++;
            }
        }
        return n;
    }

    private static List<String> orderedWords(String s) {
        List<String> out = new ArrayList<>();
        for (String w : OnboardingValidator.norm(s).split("_+")) {
            if (!w.isEmpty()) {
                out.add(w);
            }
        }
        return out;
    }

    private static final String SYSTEM = """
            Bạn giúp cán bộ thiết bị của một trường học sửa các dòng lỗi / cảnh báo khi nhập dữ liệu ban đầu (cơ sở,
            khối nhà, phòng, lớp, thiết bị) vào hệ thống quản lý thiết bị trường học.

            Dữ liệu vào là JSON: tên trang, các cột (key, nhãn, hướng dẫn — hướng dẫn liệt kê giá trị được phép nếu có),
            danh sách đơn vị tính, allowedValues (giá trị được phép của các cột tham chiếu), và các dòng cần sửa. Mỗi dòng có rowId, các ô đang có giá trị
            (cells), các lỗi (problems: field, text) và — với trang thiết bị — catalogCandidates: các
            thiết bị trong danh mục có tên gần giống.

            Với mỗi dòng, đề xuất sửa những ô đang báo lỗi. Quy tắc:
            - Chỉ sửa đúng ô có tên trong problems (field). Không đụng ô khác — gợi ý cho ô khác bị bỏ.
            - "catalog" (mã DM thiết bị): chỉ chọn một mã trong catalogCandidates của CHÍNH dòng đó, khi tên thiết bị
              trên dòng rõ ràng là thiết bị đó. Không chắc thì không đề xuất.
              Dòng có problem "Không có trong danh mục…" là thiết bị hệ thống chưa ghép được: tên trên sổ thường viết
              tắt, sai chính tả hoặc kèm quy cách ("Bộ TN Lý 6", "MT để bàn Dell"). Chọn ứng viên khi đó đúng là cùng
              một thiết bị (cùng loại, cùng môn / lớp nếu tên có ghi). Ứng viên chỉ gần nghĩa (khác loại, khác lớp,
              một bộ khác một chi tiết của bộ) thì bỏ qua — để thành thiết bị ngoài danh mục là đúng.
            - "unit" (đơn vị tính): chỉ chọn trong danh sách units; ưu tiên đơn vị của thiết bị ứng viên đã chọn.
              Hoá chất thiếu đơn vị: chất rắn, kim loại, muối, bột → Gam; chất lỏng, dung dịch, axit, nước → Mililít
              (ghi "lít" trong tên thì Lít, "kg" thì Kg). Đây là việc nên làm, không cần thêm căn cứ nào khác.
            - allowedValues: với mỗi cột có trong đó (room, building, campus, manager, teacher, grade, year, subject),
              chỉ chọn một giá trị trong danh sách, khi giá trị trên dòng rõ ràng là viết khác / viết sai của giá trị đó.
            - Ô có giá trị cố định (loại phòng, hiện trạng, tình trạng, nguồn hình thành, nguồn kinh phí, khối lớp…):
              chọn đúng một giá trị trong hướng dẫn của cột.
            - Định dạng: năm là 4 chữ số (ghi "2019-2020" thì lấy năm đầu), ngày dd/mm/yyyy, số lượng là số > 0,
              mã chỉ gồm chữ, số, dấu chấm, gạch dưới, gạch nối (bỏ dấu cách, ngoặc).
            - Người dùng xem và sửa được mọi gợi ý trước khi áp dụng, nên ô đang báo LỖI thì đề xuất giá trị hợp lý nhất,
              kể cả khi chưa thật chắc; ghi rõ điều chưa chắc trong "reason". Chỉ bỏ qua khi không có căn cứ nào.
            - Không bịa giá trị ngoài danh sách được phép. Riêng "catalog" vẫn theo quy tắc chặt ở trên.
            - "reason": một câu ngắn, tiếng Việt, nói sự việc (vd "Tên khớp thiết bị THCS-27-012 trong danh mục").
            Trả về danh sách fixes (có thể rỗng).
            """;
}
