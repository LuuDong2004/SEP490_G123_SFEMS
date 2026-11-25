package com.g123.sfems.module.system.dataimport;

import com.g123.sfems.domain.catalog.enums.FundingSource;
import com.g123.sfems.domain.catalog.originsource.OriginRule;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.TreeMap;
import java.util.stream.Collectors;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import com.g123.sfems.shared.validation.FieldRule;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/**
 * "Sửa nhanh" ở vùng chờ nhập dữ liệu — chuẩn hoá dữ liệu bằng LUẬT trong code, cho những lỗi có cách sửa chắc chắn:
 * mã trùng (thêm hậu tố), mã sai dạng (bỏ dấu, dấu cách, ngoặc — kèm đổi luôn ở các dòng đang tham chiếu), tham
 * chiếu phòng viết khác mã thật (hoa thường, dấu cách), phòng còn thiếu (gợi ý thêm vào trang Phòng, khối nhà / tầng
 * / loại phòng chép từ phòng có mã gần nhất), năm ghi "2019-2020", số lượng 0 (bỏ dòng), mã khối nhà lệch giữa hai
 * trang, cách ghi hiện trạng / tình trạng / loại phòng / nguồn kinh phí ngoài danh sách, cán bộ không có. Người dùng xem, sửa tay được, rồi nhận thì đi qua PATCH như sửa
 * tay — nên chỗ không chắc vẫn gợi ý, đánh dấu {@code review} để không tích sẵn.
 */
@Service
public class OnboardingQuickFix {

    /** Ô giả: nhận gợi ý này là BỎ dòng (skipped), không sửa ô nào. */
    public static final String SKIP = "_skip";
    /** Ô giả: dòng được GIỮ NGUYÊN trong một nhóm trùng mã — chỉ để hộp gợi ý liệt kê đủ nhóm, áp dụng thì không làm gì. */
    public static final String KEEP = "_keep";

    private static final Pattern CODE = Pattern.compile("^[A-Za-z0-9._-]+$");
    private static final Pattern YEAR = Pattern.compile("(19|20)\\d{2}");
    private static final Pattern NUMBERED = Pattern.compile("^(.*?)(\\d+)$");
    /** Trang có cột "Mã phòng" tham chiếu sang trang Phòng. */
    private static final Set<OnboardingSheet> ROOM_REFS = Set.of(OnboardingSheet.EQUIPMENT, OnboardingSheet.CLASS);

    /** Một phòng nên thêm vào trang Phòng vì có dòng đang dùng mã đó; khối nhà / tầng / loại chép từ {@code basedOn}. */
    public record NewRoom(String code, String building, String floor, String roomType, String basedOn, int usedBy) {
    }

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

    public record Result(List<Suggestion> suggestions, List<NewRoom> newRooms) {
    }

    /** Một mã khối nhà trên trang Phòng khớp một dòng của trang Khối nhà. */
    private record BuildingAlias(OnboardingService.StagedRow building, String code, List<Long> rooms) {
    }

    private static final List<String> FACILITY_CONDITIONS = List.of("Tốt", "Bình thường", "Cần sửa chữa", "Xuống cấp", "Hư hỏng nặng");
    private static final List<String> EQUIPMENT_CONDITIONS = List.of("Tốt", "Trung bình", "Kém");
    private static final Pattern DAMAGE_WORDS = Pattern.compile("THAM|DOT|NUT|BONG|ROP|MOC|XUONG_CAP");
    private static final Pattern BROKEN_WORDS = Pattern.compile("HU_NANG|HU_HONG|HONG_NANG|KHONG_SU_DUNG|NGUY_HIEM|SAP");
    /** Hoá chất thường ở thể lỏng theo tên; còn lại (muối, kim loại, oxit, bột) tính theo gam. */
    private static final Pattern LIQUID_WORDS = Pattern.compile(
            "^(DUNG_DICH|NUOC|AXIT|ACID|THUOC_THU|AXETON|CON_|ETANOL|ETHANOL)");
    /** Có từ hoá chất nhưng không đo bằng khối lượng hay thể tích: để người dùng chọn. */
    private static final Pattern COUNTED_WORDS = Pattern.compile("^GIAY_");

    private final OnboardingService onboarding;
    private final JdbcTemplate jdbc;

    public OnboardingQuickFix(OnboardingService onboarding, JdbcTemplate jdbc) {
        this.onboarding = onboarding;
        this.jdbc = jdbc;
    }

    public Result fixes(long batchId, String sheetKey) {
        OnboardingSheet sheet = OnboardingSheet.of(sheetKey);
        if (sheet == null) {
            return new Result(List.of(), List.of());
        }
        // `rows` kiểm phạm vi người gọi (404 nếu không thấy lô).
        List<OnboardingService.StagedRow> rows = onboarding.rows(batchId, sheet.key()).stream().filter(r -> !r.skipped()).toList();
        List<Suggestion> out = new ArrayList<>();
        Set<String> taken = new HashSet<>();

        boolean hasCode = sheet.columns().stream().anyMatch(c -> c.key().equals("code"));
        if (hasCode) {
            rows.forEach(r -> {
                String c = r.data().get("code");
                if (c != null) {
                    taken.add(c.trim().toUpperCase());
                }
            });
            codeFixes(rows, taken, out);
        }

        if (sheet == OnboardingSheet.BUILDING || sheet == OnboardingSheet.ROOM) {
            buildingFixes(batchId, sheet, out);
        }

        for (OnboardingService.StagedRow r : rows) {
            for (OnboardingValidator.Message m : r.messages()) {
                if (!"error".equals(m.level())) {
                    continue;
                }
                if ("condition".equals(m.field())) {
                    conditionFix(sheet, r, out);
                } else if ("unit".equals(m.field()) && m.text().startsWith("Hoá chất ngoài danh mục")) {
                    out.add(chemicalUnitFix(r));
                } else if ("roomType".equals(m.field())) {
                    roomTypeFix(r, out);
                } else if ("funding".equals(m.field())) {
                    out.add(fundingFix(r));
                } else if (("manager".equals(m.field()) || "teacher".equals(m.field())) && m.text().startsWith("Không có cán bộ")) {
                    String v = Objects.toString(r.data().get(m.field()), "").trim();
                    out.add(new Suggestion(r.id(), m.field(), v, "",
                            "Không có cán bộ mã \"" + v + "\" — để trống, khai sau"));
                } else if ("year".equals(m.field()) && sheet == OnboardingSheet.CLASS) {
                    // Năm học: bộ kiểm đã tự đọc mọi cách ghi ("2026/2027", "Năm học 26-27"…); còn lỗi nghĩa là
                    // năm học chưa có trên hệ thống — không lấy "năm đầu" như cột năm sử dụng.
                    continue;
                } else if ("year".equals(m.field())) {
                    String v = Objects.toString(r.data().get("year"), "");
                    Matcher y = YEAR.matcher(v);
                    if (y.find() && !y.group().equals(v.trim())) {
                        out.add(new Suggestion(r.id(), "year", v, y.group(), "Lấy năm đầu tiên trong \"" + v + "\""));
                    }
                } else if ("phone".equals(m.field())) {
                    String v = Objects.toString(r.data().get("phone"), "");
                    String to = phoneFix(v);
                    if (to != null && !to.equals(v.trim())) {
                        out.add(new Suggestion(r.id(), "phone", v, to, PHONE_FIX));
                    }
                } else if ("quantity".equals(m.field()) && m.text().startsWith("Số lượng phải lớn hơn 0")) {
                    out.add(new Suggestion(r.id(), SKIP, Objects.toString(r.data().get("quantity"), ""), "Bỏ dòng",
                            "Số lượng bằng 0 — không còn thiết bị này"));
                }
            }
        }

        if (sheet == OnboardingSheet.ROOM) {
            followRenames(batchId, rows, out, OnboardingSheet.EQUIPMENT, "room", "Mã phòng ở trang Thiết bị");
            followRenames(batchId, rows, out, OnboardingSheet.CLASS, "room", "Mã phòng ở trang Lớp học");
        } else if (sheet == OnboardingSheet.BUILDING) {
            followRenames(batchId, rows, out, OnboardingSheet.ROOM, "building", "Mã khối nhà ở trang Phòng");
        }
        List<NewRoom> newRooms = ROOM_REFS.contains(sheet) ? roomRefFixes(batchId, rows, out) : List.of();
        return new Result(out, newRooms);
    }

    /**
     * Trang Phòng ghi mã khối nhà không có, trang Khối nhà có khối "giống": viết tắt (KA = Khu A), hoặc chỉ khác dấu
     * cách, dấu gạch. Sửa ở khối nhà (đổi mã theo cách trang Phòng đang ghi) vì chỉ một dòng là hết lỗi cho cả chục
     * phòng. Ở trang Phòng, gợi ý trỏ sang dòng của trang Khối nhà.
     */
    private void buildingFixes(long batchId, OnboardingSheet sheet, List<Suggestion> out) {
        List<OnboardingService.StagedRow> buildings = onboarding.rows(batchId, OnboardingSheet.BUILDING.key()).stream()
                .filter(r -> !r.skipped() && r.data().get("code") != null).toList();
        List<OnboardingService.StagedRow> rooms = onboarding.rows(batchId, OnboardingSheet.ROOM.key()).stream()
                .filter(r -> !r.skipped()).toList();
        List<BuildingAlias> aliases = buildingAliases(buildings, rooms);
        String reason = "Trang Phòng ghi mã khối nhà khác trang Khối nhà — đổi mã khối nhà cho khớp";
        for (BuildingAlias a : aliases) {
            OnboardingService.StagedRow b = a.building();
            String from = b.data().get("code").trim();
            if (sheet == OnboardingSheet.BUILDING) {
                // Thay gợi ý chuẩn hoá ("Khu A" → "Khu-A"): chuẩn hoá xong thì phòng vẫn không khớp.
                out.removeIf(s -> s.rowId() == b.id() && "code".equals(s.field()));
                out.add(new Suggestion(b.id(), "code", from, a.code(), reason));
            } else {
                out.add(new Suggestion(b.id(), "code", from, a.code(),
                        "%s (%d phòng hết lỗi)".formatted(reason, aliases.stream().mapToInt(x -> x.rooms().size()).sum()),
                        "Mã khối nhà", b.rowNo(), false, List.of()));
            }
        }
    }

    /**
     * Đổi mã ở trang này thì các dòng trang khác đang ghi mã cũ phải đổi theo trong CÙNG lần áp dụng, không thì vừa sửa
     * xong lại sinh lỗi "không có phòng". Một mã cũ tách thành nhiều mã (ba phòng cùng ghi "Khu E (tầng 1)"): không biết
     * thiết bị ở phòng nào, nên chọn phòng có chữ "kho" trong tên; không có thì chọn phòng đầu và để người dùng xem lại.
     */
    private void followRenames(long batchId, List<OnboardingService.StagedRow> rows, List<Suggestion> out,
            OnboardingSheet other, String field, String fieldLabel) {
        Map<Long, OnboardingService.StagedRow> byId = rows.stream()
                .collect(Collectors.toMap(OnboardingService.StagedRow::id, r -> r));
        Map<String, List<Suggestion>> renamed = new LinkedHashMap<>();
        for (Suggestion s : out) {
            if ("code".equals(s.field()) && byId.containsKey(s.rowId()) && !s.from().equals(s.to())) {
                renamed.computeIfAbsent(s.from(), k -> new ArrayList<>()).add(s);
            }
        }
        if (renamed.isEmpty()) {
            return;
        }
        List<Suggestion> follow = new ArrayList<>();
        for (OnboardingService.StagedRow r : onboarding.rows(batchId, other.key())) {
            String value = Objects.toString(r.data().get(field), "").trim();
            List<Suggestion> targets = renamed.get(value);
            if (r.skipped() || targets == null) {
                continue;
            }
            List<Suggestion> stores = targets.stream()
                    .filter(t -> OnboardingValidator.norm(Objects.toString(byId.get(t.rowId()).data().get("name"), ""))
                            .matches("(^|.*_)KHO(_.*|$)"))
                    .toList();
            boolean sure = targets.size() == 1 || stores.size() == 1;
            String to = (stores.size() == 1 ? stores.get(0) : targets.get(0)).to();
            follow.add(new Suggestion(r.id(), field, value, to,
                    "%s: các dòng đang ghi mã cũ \"%s\"".formatted(fieldLabel, value), fieldLabel, r.rowNo(), !sure, List.of()));
        }
        out.addAll(follow);
    }

    /** Hoá chất ngoài danh mục thiếu đơn vị: lỏng → Mililít, còn lại → Gam; loại đếm được thì để người dùng chọn. */
    private Suggestion chemicalUnitFix(OnboardingService.StagedRow r) {
        List<String> units = jdbc.queryForList("SELECT name FROM units WHERE active ORDER BY name", String.class);
        String kind = chemicalUnit(Objects.toString(r.data().get("name"), ""));
        if (kind == null) {
            return new Suggestion(r.id(), "unit", "", "", "Chưa có đơn vị tính — chọn đơn vị", null, null, true, units);
        }
        String to = units.stream().filter(u -> OnboardingValidator.fold(u).equals(OnboardingValidator.fold(kind))).findFirst().orElse("");
        return new Suggestion(r.id(), "unit", "", to,
                "Hoá chất chưa có đơn vị tính — theo tên gợi ý " + kind + ", xem lại số lượng có đúng đơn vị này không",
                null, null, to.isEmpty(), units);
    }

    /** Đơn vị gợi ý theo tên hoá chất; {@code null} khi không đoán được. */
    static String chemicalUnit(String name) {
        String f = OnboardingValidator.fold(name.strip());
        if (COUNTED_WORDS.matcher(f).find()) {
            return null;
        }
        return LIQUID_WORDS.matcher(f).find() ? "Mililít" : "Gam";
    }

    /** Mỗi mã lạ trên trang Phòng khớp đúng một khối nhà thì mới ghép; hai mã cùng khớp một khối thì thôi. */
    private static List<BuildingAlias> buildingAliases(List<OnboardingService.StagedRow> buildings, List<OnboardingService.StagedRow> rooms) {
        Set<String> known = buildings.stream().map(b -> b.data().get("code").trim().toUpperCase()).collect(Collectors.toSet());
        Map<String, List<Long>> unknown = new LinkedHashMap<>();
        for (OnboardingService.StagedRow r : rooms) {
            String ref = Objects.toString(r.data().get("building"), "").trim();
            boolean error = r.messages().stream().anyMatch(m -> "error".equals(m.level()) && "building".equals(m.field()));
            if (error && !ref.isEmpty() && !known.contains(ref.toUpperCase())) {
                unknown.computeIfAbsent(ref, k -> new ArrayList<>()).add(r.id());
            }
        }
        List<BuildingAlias> out = new ArrayList<>();
        Set<Long> used = new HashSet<>();
        unknown.forEach((ref, ids) -> {
            List<OnboardingService.StagedRow> hits = buildings.stream()
                    .filter(b -> sameBuilding(ref, b.data().get("code")) || sameBuilding(ref, b.data().get("name"))).toList();
            if (hits.size() == 1 && CODE.matcher(ref).matches() && used.add(hits.get(0).id())) {
                out.add(new BuildingAlias(hits.get(0), ref, ids));
            }
        });
        return out;
    }

    /** "KA" với "Khu A" (chữ đầu các từ), "Khu-A" với "Khu A" (chỉ khác dấu). */
    static boolean sameBuilding(String ref, String text) {
        if (text == null || text.isBlank()) {
            return false;
        }
        String wanted = key(ref);
        if (wanted.equals(key(text))) {
            return true;
        }
        String initials = Arrays.stream(normalizeCode(text).split("[^A-Za-z0-9]+"))
                .filter(w -> !w.isEmpty()).map(w -> w.substring(0, 1)).collect(Collectors.joining());
        return initials.length() >= 2 && wanted.equals(initials.toUpperCase());
    }

    /** Hiện trạng / tình trạng ghi theo mô tả: đưa về giá trị của danh sách; mô tả chép sang ghi chú để không mất. */
    private static void conditionFix(OnboardingSheet sheet, OnboardingService.StagedRow r, List<Suggestion> out) {
        String v = Objects.toString(r.data().get("condition"), "").trim();
        boolean equipment = sheet == OnboardingSheet.EQUIPMENT;
        String to = equipment ? equipmentCondition(v) : facilityCondition(v);
        if (to == null) {
            return;
        }
        String label = equipment ? "Tình trạng" : "Hiện trạng";
        out.add(new Suggestion(r.id(), "condition", v, to, label + " ghi ngoài danh sách — đưa về giá trị của hệ thống",
                null, null, false, equipment ? EQUIPMENT_CONDITIONS : FACILITY_CONDITIONS));
        if (!equipment && Objects.toString(r.data().get("note"), "").isBlank()) {
            String note = v.matches(".*\\(.+\\).*") ? v.replaceAll(".*\\((.+)\\).*", "$1").trim() : v;
            out.add(new Suggestion(r.id(), "note", "", note, "Giữ mô tả " + label.toLowerCase() + " vào ghi chú"));
        }
    }

    static String facilityCondition(String text) {
        String f = OnboardingValidator.fold(text);
        if (BROKEN_WORDS.matcher(f).find()) {
            return "Hư hỏng nặng";
        }
        if (DAMAGE_WORDS.matcher(f).find()) {
            return f.contains("NANG") ? "Xuống cấp" : "Cần sửa chữa";
        }
        return f.startsWith("TOT") ? "Tốt" : f.startsWith("BINH_THUONG") ? "Bình thường" : null;
    }

    static String equipmentCondition(String text) {
        String f = OnboardingValidator.fold(text);
        return BROKEN_WORDS.matcher(f).find() || f.startsWith("HU") || f.startsWith("HONG") ? "Kém" : f.startsWith("TOT") ? "Tốt" : null;
    }

    /** Loại phòng: danh mục có đúng một loại chung từ khoá (bỏ chữ "phòng") với chữ đã ghi — "Phòng Kho" → "Nhà kho". */
    private void roomTypeFix(OnboardingService.StagedRow r, List<Suggestion> out) {
        String v = Objects.toString(r.data().get("roomType"), "").trim();
        List<String> types = jdbc.queryForList("SELECT name FROM room_types WHERE active AND school_id IS NULL ORDER BY name",
                String.class);
        Set<String> words = Arrays.stream(OnboardingValidator.fold(v).split("_+"))
                .filter(w -> w.length() > 1 && !"PHONG".equals(w)).collect(Collectors.toSet());
        List<String> hits = types.stream()
                .filter(t -> Arrays.stream(OnboardingValidator.fold(t).split("_+")).anyMatch(words::contains)).toList();
        out.add(new Suggestion(r.id(), "roomType", v, hits.size() == 1 ? hits.get(0) : "",
                "Loại phòng ghi ngoài danh mục — chọn loại đúng", null, null, hits.size() != 1, types));
    }

    /**
     * Nguồn kinh phí không dùng được. Nguồn hình thành cho phép thì "Chưa xác định nguồn" là đúng sự thật. Không cho
     * phép (Mua sắm bắt buộc có nguồn) thì đây là PHỎNG ĐOÁN: không tích sẵn, người dùng chọn lại cho đúng.
     */
    private static Suggestion fundingFix(OnboardingService.StagedRow r) {
        String v = Objects.toString(r.data().get("funding"), "").trim();
        String originText = OnboardingValidator.fold(Objects.toString(r.data().get("origin"), ""));
        OriginRule origin = Arrays.stream(OriginRule.values())
                // Theo tên hoặc theo mã — tệp ghi tên cũ "Mua sắm" (mã MUA_SAM) vẫn nhận ra "Kế hoạch mua sắm".
                .filter(o -> OnboardingValidator.fold(o.label()).equals(originText) || o.name().equals(originText))
                .findFirst().orElse(null);
        List<String> options = (origin == null ? Arrays.asList(FundingSource.values()) : origin.fundingSources()).stream()
                .map(FundingSource::label).toList();
        if (origin == null || origin.allows(FundingSource.UNDETERMINED)) {
            return new Suggestion(r.id(), "funding", v, FundingSource.UNDETERMINED.label(),
                    "Nguồn kinh phí \"" + v + "\" không có trong danh sách — ghi chưa xác định", null, null, false,
                    origin == null ? options : append(options, FundingSource.UNDETERMINED.label()));
        }
        String guess = options.contains(FundingSource.REVENUE.label()) ? FundingSource.REVENUE.label() : options.get(0);
        return new Suggestion(r.id(), "funding", v, guess,
                "Nguồn kinh phí \"" + v + "\" không có trong danh sách — chọn nguồn đúng cho " + origin.label(), null, null, true, options);
    }

    private static List<String> append(List<String> list, String value) {
        List<String> out = new ArrayList<>(list);
        if (!out.contains(value)) {
            out.add(value);
        }
        return out;
    }

    /**
     * Mã sai dạng → chuẩn hoá. Mã trùng → xét từng nhóm cùng mã:
     * <ul>
     *   <li>các dòng GIỐNG HỆT nhau (mọi ô như nhau) là nhập trùng: giữ dòng đầu, BỎ các dòng còn lại;</li>
     *   <li>các dòng khác nhau (khác tên, khác khối…) là nhiều thứ dùng chung một mã: đổi mã từng dòng, thêm hậu tố
     *       "-1", "-2"… (không đụng mã đã có ở dòng khác).</li>
     * </ul>
     * Mọi dòng của nhóm đều có một gợi ý — kể cả dòng giữ nguyên ({@link #KEEP}) — để hộp gợi ý liệt kê đủ cả nhóm:
     * bộ kiểm báo lỗi trùng cho mọi dòng, dòng nào không hiện thì người sửa không biết nó được giữ.
     */
    private static void codeFixes(List<OnboardingService.StagedRow> rows, Set<String> taken, List<Suggestion> out) {
        Map<String, List<OnboardingService.StagedRow>> groups = new LinkedHashMap<>();
        Map<Long, String> target = new HashMap<>();
        for (OnboardingService.StagedRow r : rows) {
            String c = r.data().get("code");
            if (c == null || c.isBlank()) {
                continue;
            }
            // Chỉ chuẩn hoá khi bộ kiểm báo sai dạng — tên lớp (6A1, 10CĐIA) được phép có chữ có dấu, dấu cách.
            boolean badFormat = r.messages().stream().anyMatch(m -> "code".equals(m.field()) && m.text().contains("chỉ gồm"));
            String fixed = badFormat ? normalizeCode(c) : c.trim();
            if (fixed.isEmpty()) {
                continue;
            }
            target.put(r.id(), fixed);
            groups.computeIfAbsent(fixed.toUpperCase(), k -> new ArrayList<>()).add(r);
        }
        for (List<OnboardingService.StagedRow> group : groups.values()) {
            OnboardingService.StagedRow head = group.get(0);
            String code = head.data().get("code").trim();
            if (group.size() == 1) {
                String to = target.get(head.id());
                if (!to.equals(code)) {
                    out.add(new Suggestion(head.id(), "code", code, to, BAD_FORMAT));
                }
                continue;
            }
            String reason = "Mã \"" + code + "\" lặp lại ở các dòng "
                    + group.stream().map(g -> String.valueOf(g.rowNo())).collect(Collectors.joining(", "));
            // Gom các dòng giống hệt nhau: dòng đầu mỗi cụm là "đại diện", các dòng sau là bản nhập thừa.
            Map<String, OnboardingService.StagedRow> firstOf = new LinkedHashMap<>();
            List<OnboardingService.StagedRow> extras = new ArrayList<>();
            for (OnboardingService.StagedRow r : group) {
                if (firstOf.putIfAbsent(sameness(r), r) != null) {
                    extras.add(r);
                }
            }
            List<OnboardingService.StagedRow> keep = new ArrayList<>(firstOf.values());
            for (int i = 0; i < keep.size(); i++) {
                OnboardingService.StagedRow r = keep.get(i);
                String from = r.data().get("code").trim();
                String to = target.get(r.id());
                if (keep.size() > 1) {
                    // Nhiều thứ khác nhau cùng một mã: mỗi cái một mã riêng.
                    String base = to;
                    int n = i + 1;
                    do {
                        to = base + "-" + n++;
                    } while (taken.contains(to.toUpperCase()));
                    taken.add(to.toUpperCase());
                }
                out.add(new Suggestion(r.id(), to.equals(from) ? KEEP : "code", from, to, reason));
            }
            for (OnboardingService.StagedRow r : extras) {
                OnboardingService.StagedRow same = firstOf.get(sameness(r));
                out.add(new Suggestion(r.id(), SKIP, r.data().get("code").trim(),
                        "Giống hệt dòng " + same.rowNo(), reason));
            }
        }
    }

    /** Lý do của gợi ý chuẩn hoá mã — một câu chung để hộp gợi ý gom các dòng sai dạng làm một nhóm. */
    private static final String PHONE_FIX = "Số điện thoại mất số 0 đầu (Excel bỏ số 0) hoặc ghi 84… — đưa về dạng 0…";

    /**
     * Số điện thoại sửa được chắc chắn: Excel lưu số dạng số nên mất số 0 đầu ("2838398506" → "02838398506",
     * "912345678" → "0912345678"); ghi "84…" không có dấu + → "0…". Bỏ dấu cách, chấm, ngoặc, gạch. Không ra số hợp lệ
     * thì trả null — để người dùng xử lý.
     */
    static String phoneFix(String raw) {
        String d = raw.replaceAll("[^0-9+]", "");
        if (d.startsWith("+84")) {
            d = "0" + d.substring(3);
        } else if (d.startsWith("84") && d.length() >= 11) {
            d = "0" + d.substring(2);
        } else if (!d.startsWith("0") && (d.length() == 9 || d.length() == 10)) {
            d = "0" + d;
        }
        return FieldRule.PHONE.violation(d, 0) == null ? d : null;
    }

    private static final String BAD_FORMAT ="Mã có dấu cách, ngoặc hoặc chữ có dấu — chỉ được chữ không dấu, số, . _ -";

    /** Hai dòng "giống hệt" khi mọi ô (đã bỏ khoảng trắng thừa, không phân biệt hoa thường) như nhau. */
    private static String sameness(OnboardingService.StagedRow r) {
        StringBuilder key = new StringBuilder();
        new TreeMap<>(r.data()).forEach((k, v) -> key.append(k).append('=')
                .append(v == null ? "" : v.trim().replaceAll("\\s+", " ").toUpperCase()).append('\u0001'));
        return key.toString();
    }

    /**
     * Cột "Mã phòng" trỏ tới phòng không có: nếu trang Phòng / hệ thống có mã viết khác (hoa thường, dấu cách, ngoặc)
     * thì gợi ý mã đó; còn không thì đề xuất THÊM phòng vào trang Phòng, chép khối nhà / tầng / loại từ phòng có mã
     * gần nhất cùng tiền tố (A.014 theo A.013 / A.015).
     */
    private List<NewRoom> roomRefFixes(long batchId, List<OnboardingService.StagedRow> rows, List<Suggestion> out) {
        List<OnboardingService.StagedRow> roomRows = onboarding.rows(batchId, OnboardingSheet.ROOM.key()).stream()
                .filter(r -> !r.skipped() && r.data().get("code") != null).toList();
        long schoolId = onboarding.get(batchId).school().id();
        Map<String, String> known = new LinkedHashMap<>();
        roomRows.forEach(r -> known.putIfAbsent(key(r.data().get("code")), r.data().get("code").trim()));
        jdbc.queryForList("SELECT code FROM rooms WHERE school_id = ?", String.class, schoolId)
                .forEach(c -> known.putIfAbsent(key(c), c));

        Map<String, Integer> missing = new LinkedHashMap<>();
        for (OnboardingService.StagedRow r : rows) {
            boolean roomError = r.messages().stream().anyMatch(m -> "error".equals(m.level()) && "room".equals(m.field()));
            String room = r.data().get("room");
            if (!roomError || room == null || room.isBlank()) {
                continue;
            }
            String match = known.get(key(room));
            if (match != null && !match.equals(room.trim())) {
                out.add(new Suggestion(r.id(), "room", room, match, "Trang Phòng có mã \"" + match + "\""));
                continue;
            }
            if (match != null) {
                continue;
            }
            // Ghi theo TÊN phòng (thường là mã cũ trước khi đổi): tên phòng mở đầu bằng chữ đã ghi.
            String wanted = OnboardingValidator.norm(room);
            List<OnboardingService.StagedRow> byName = roomRows.stream()
                    .filter(x -> x.data().get("name") != null && OnboardingValidator.norm(x.data().get("name")).startsWith(wanted))
                    .toList();
            // Nhiều phòng cùng tên đầu: ưu tiên phòng TÊN có chữ "kho", rồi phòng LOẠI kho — thiết bị chưa xếp thường ở kho.
            List<OnboardingService.StagedRow> namedStores = byName.stream()
                    .filter(x -> OnboardingValidator.norm(x.data().get("name")).matches("(^|.*_)KHO(_.*|$)")).toList();
            List<OnboardingService.StagedRow> typedStores = byName.stream()
                    .filter(x -> OnboardingValidator.norm(Objects.toString(x.data().get("roomType"), "")).startsWith("KHO")).toList();
            OnboardingService.StagedRow pick = byName.size() == 1 ? byName.get(0)
                    : namedStores.size() == 1 ? namedStores.get(0)
                    : typedStores.size() == 1 ? typedStores.get(0) : null;
            if (pick != null) {
                String code = pick.data().get("code").trim();
                out.add(new Suggestion(r.id(), "room", room, code, byName.size() == 1
                        ? "Phòng \"" + pick.data().get("name") + "\" mang mã " + code
                        : "\"" + room.trim() + "\" có " + byName.size() + " phòng — chọn phòng kho \"" + pick.data().get("name") + "\""));
            } else {
                missing.merge(room.trim(), 1, Integer::sum);
            }
        }

        List<NewRoom> result = new ArrayList<>();
        missing.forEach((code, used) -> {
            String fixed = CODE.matcher(code).matches() ? code : normalizeCode(code);
            OnboardingService.StagedRow near = nearest(roomRows, fixed);
            if (near != null) {
                result.add(new NewRoom(fixed, near.data().get("building"), near.data().get("floor"), near.data().get("roomType"),
                        near.data().get("code"), used));
            }
        });
        return result;
    }

    /** Phòng có mã gần nhất: cùng tiền tố (phần trước dãy số cuối), số chênh ít nhất. */
    private static OnboardingService.StagedRow nearest(List<OnboardingService.StagedRow> rooms, String code) {
        Matcher m = NUMBERED.matcher(code);
        if (!m.matches()) {
            return null;
        }
        String prefix = m.group(1).toUpperCase();
        long n = Long.parseLong(m.group(2).length() > 12 ? m.group(2).substring(0, 12) : m.group(2));
        return rooms.stream()
                .filter(r -> r.data().get("building") != null)
                .map(r -> {
                    Matcher x = NUMBERED.matcher(r.data().get("code").trim());
                    if (!x.matches() || !x.group(1).equalsIgnoreCase(prefix) || x.group(2).length() > 12) {
                        return null;
                    }
                    return Map.entry(r, Math.abs(Long.parseLong(x.group(2)) - n));
                })
                .filter(Objects::nonNull)
                .min(Map.Entry.<OnboardingService.StagedRow, Long>comparingByValue()
                        .thenComparing(e -> e.getKey().rowNo(), Comparator.naturalOrder()))
                .map(Map.Entry::getKey)
                .orElse(null);
    }

    /** Khoá so khớp mã: bỏ dấu, chỉ giữ chữ số và chữ, không phân biệt hoa thường ("Khu E (tầng 1)" ≡ "KHU-E-TANG-1"). */
    private static String key(String code) {
        return normalizeCode(code).replaceAll("[^A-Za-z0-9]", "").toUpperCase();
    }

    /** Mã hợp lệ gần nhất: bỏ dấu tiếng Việt, cụm ký tự không hợp lệ thành một dấu gạch nối. */
    static String normalizeCode(String code) {
        if (code == null) {
            return "";
        }
        String s = Normalizer.normalize(code.trim(), Normalizer.Form.NFD).replaceAll("\\p{M}", "")
                .replace('đ', 'd').replace('Đ', 'D');
        return s.replaceAll("[^A-Za-z0-9._-]+", "-").replaceAll("^-+|-+$", "").replaceAll("-{2,}", "-");
    }
}
