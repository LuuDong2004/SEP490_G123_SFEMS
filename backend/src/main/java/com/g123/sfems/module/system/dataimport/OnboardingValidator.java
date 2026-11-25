package com.g123.sfems.module.system.dataimport;

import com.g123.sfems.shared.validation.FieldRule;
import com.g123.sfems.shared.validation.TextNormalizer;
import com.g123.sfems.domain.catalog.enums.FundingSource;
import com.g123.sfems.domain.catalog.enums.StaffPosition;
import com.g123.sfems.domain.catalog.originsource.OriginRule;
import com.g123.sfems.domain.school.equipment.EquipmentEnums.EquipmentCondition;
import com.g123.sfems.domain.school.facility.FacilityCondition;
import com.g123.sfems.domain.school.facility.FacilityStructure;
import com.g123.sfems.domain.school.facility.RoomUsageStatus;
import com.g123.sfems.domain.school.staff.StaffType;
import com.g123.sfems.module.school.equipment.EquipmentService;
import com.g123.sfems.shared.security.CurrentUser;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Kiểm tra cả một lô dữ liệu đầu vào và hiểu từng dòng thành thứ ghi được.
 *
 * <p>Kiểm CẢ LÔ một lần chứ không từng dòng: mã ở trang sau tra trong trang trước của chính tệp (phòng nằm
 * trong khối nhà nào, thiết bị đặt ở phòng nào), cộng với dữ liệu trường đã có trên hệ thống. Sửa một ô là kiểm
 * lại cả lô — một mã phòng vừa đổi có thể làm hỏng hay chữa lành vài chục dòng thiết bị.
 *
 * <p>Hai mức: LỖI chặn việc ghi; CẢNH BÁO thì ghi được nhưng người nhập nên đọc (thiết bị sẽ thành ngoài danh
 * mục, hồ sơ thiếu nguyên giá, môn hệ thống chưa có…). Dòng mang mã đã có trên hệ thống là {@code EXISTS}: không
 * tạo lại, nhưng các trang sau vẫn tham chiếu được tới nó — nhờ vậy tệp gửi lại lần hai chỉ thêm phần mới.
 */
@Component
public class OnboardingValidator {

    public static final String OK = "OK";
    public static final String WARNING = "WARNING";
    public static final String ERROR = "ERROR";
    public static final String EXISTS = "EXISTS";
    public static final String SKIPPED = "SKIPPED";

    /** Thiết bị bền khai gộp tối đa ngần này cái một dòng — quá thì gần như chắc là gõ nhầm. */
    static final int MAX_COPIES = 9999;

    /** Số thứ tự trong mã tài sản có ba chữ số (`EquipmentCodeService.LAST_SEQUENCE`). */
    private static final int LAST_SEQUENCE = 9999;

    /** Đơn vị bao bì của vật tư dùng hết: ngoài danh mục, để trống Cách quản lý thì hiểu là theo lô. "Hộp" không vào —
     *  có hộp là thiết bị bền (hộp quả treo). */
    private static final Set<String> PACK_UNITS = Set.of("LO", "CHAI", "GOI", "TUI", "CUON", "BICH", "RAM", "VI", "TUYP");

    /** Một dòng của vùng chờ. */
    public record Staged(long id, OnboardingSheet sheet, int rowNo, Map<String, String> data, boolean skipped) {
    }

    public record Message(String level, String field, String text) {
    }

    /** Kết quả kiểm một dòng: trạng thái, lời nhắn, thứ hiện cho người nhập, và thứ để ghi. */
    public record Result(String status, List<Message> messages, Map<String, Object> resolved, Object payload) {
        /**
         * Lỗi đứng TRƯỚC lưu ý: dòng vừa có lưu ý vừa có lỗi từng hiện câu lưu ý ở đầu, lỗi thật bị khuất
         * phía sau — nhìn như một dòng "chỉ có lưu ý" mà vẫn không qua.
         */
        public Result {
            messages = messages.stream()
                    .sorted(Comparator.comparingInt((Message m) -> "error".equals(m.level()) ? 0 : 1))
                    .toList();
        }
    }

    // ------------------------------------------------------------------ thứ để ghi, mỗi trang một kiểu

    record CampusRow(String code, String name, String address, String phone, boolean primary, String note) {
    }

    record StaffRow(String code, String name, StaffType type, StaffPosition position, String team, Long mainSubject,
            List<Long> subjects, String department, String phone, String email, String note) {
    }

    record BuildingRow(String code, String name, String campus, Integer floors, Integer year, BigDecimal area,
            FacilityCondition condition, String manager, String note) {
    }

    record RoomRow(String code, String name, String building, String floor, Long roomType, Long subject,
            BigDecimal area, Integer capacity, FacilityCondition condition, RoomUsageStatus usage, String manager,
            String unit, String note, FacilityStructure structure) {
    }

    record ClassRow(String code, Long grade, Long year, Integer students, String teacher, String room, String note) {
    }

    /**
     * Một dòng thiết bị. {@code catalog} là thiết bị trong danh mục đã ghép; {@code null} thì {@code newItem} là
     * thiết bị ngoài danh mục sẽ tạo cho trường (nhiều dòng cùng tên dùng chung một thiết bị).
     */
    record EquipmentRow(String legacy, String name, Long catalog, NewItem newItem, String aliasCode,
            BigDecimal quantity, int copies, String serial, String room, String manager, BigDecimal originalValue,
            BigDecimal remainingValue, LocalDate receivedDate, Integer year, Long originSource, OriginRule origin,
            FundingSource funding, EquipmentCondition condition, String note) {
    }

    /** Thiết bị ngoài danh mục sẽ tạo: khoá là tên đã chuẩn hoá. */
    record NewItem(String key, String name, Long unit, boolean bulk, boolean chemical, Long subject) {
    }

    // ------------------------------------------------------------------ từ điển

    private static final Map<String, String> SUBJECT_ALIASES = Map.ofEntries(
            Map.entry("TOAN_HOC", "TOAN"),
            Map.entry("ANH_VAN", "TIENG_ANH"),
            Map.entry("NGOAI_NGU", "TIENG_ANH"),
            Map.entry("NGOAI_NGU_TIENG_ANH", "TIENG_ANH"),
            Map.entry("VAN", "NGU_VAN"),
            Map.entry("THE_DUC", "GIAO_DUC_THE_CHAT"),
            Map.entry("GDTC", "GIAO_DUC_THE_CHAT"),
            Map.entry("GIAO_DUC_KINH_TE_PHAP_LUAT", "GIAO_DUC_KINH_TE_VA_PHAP_LUAT"),
            Map.entry("GDKT_PL", "GIAO_DUC_KINH_TE_VA_PHAP_LUAT"),
            Map.entry("HOAT_DONG_TRAI_NGHIEM_HUONG_NGHIEP", "HOAT_DONG_TRAI_NGHIEM"),
            Map.entry("HOAT_DONG_TRAI_NGHIEM_VA_HUONG_NGHIEP", "HOAT_DONG_TRAI_NGHIEM"),
            Map.entry("TIENG_NHAT", "NGOAI_NGU_KHAC"),
            Map.entry("TIENG_TRUNG", "NGOAI_NGU_KHAC"),
            Map.entry("TIENG_PHAP", "NGOAI_NGU_KHAC"),
            Map.entry("TIENG_DUC", "NGOAI_NGU_KHAC"),
            Map.entry("TIENG_HAN", "NGOAI_NGU_KHAC"),
            Map.entry("TIENG_NGA", "NGOAI_NGU_KHAC"),
            Map.entry("GIAO_DUC_QUOC_PHONG", "GIAO_DUC_QUOC_PHONG_VA_AN_NINH"),
            Map.entry("GIAO_DUC_QUOC_PHONG_AN_NINH", "GIAO_DUC_QUOC_PHONG_VA_AN_NINH"),
            Map.entry("QUOC_PHONG", "GIAO_DUC_QUOC_PHONG_VA_AN_NINH"),
            Map.entry("QUOC_PHONG_AN_NINH", "GIAO_DUC_QUOC_PHONG_VA_AN_NINH"),
            Map.entry("GDQP", "GIAO_DUC_QUOC_PHONG_VA_AN_NINH"),
            Map.entry("GDQP_AN", "GIAO_DUC_QUOC_PHONG_VA_AN_NINH"),
            Map.entry("GDQPAN", "GIAO_DUC_QUOC_PHONG_VA_AN_NINH"));

    /** Cách ghi tình trạng thường gặp trên sổ cũ → tình trạng của hệ thống. Không có tình trạng hỏng: hư, hỏng ghi Kém. */
    private static final Map<String, EquipmentCondition> CONDITION_ALIASES = Map.ofEntries(
            Map.entry("KHA", EquipmentCondition.TRUNG_BINH),
            Map.entry("BINH_THUONG", EquipmentCondition.TRUNG_BINH),
            Map.entry("HONG_NHE", EquipmentCondition.KEM),
            Map.entry("HONG_NANG", EquipmentCondition.KEM),
            Map.entry("MOI", EquipmentCondition.TOT),
            Map.entry("MOI_100", EquipmentCondition.TOT),
            Map.entry("CON_TOT", EquipmentCondition.TOT),
            Map.entry("TOT_SU_DUNG_DUOC", EquipmentCondition.TOT),
            Map.entry("CON_SU_DUNG_DUOC", EquipmentCondition.TRUNG_BINH),
            Map.entry("SU_DUNG_DUOC", EquipmentCondition.TRUNG_BINH),
            Map.entry("DUNG_DUOC", EquipmentCondition.TRUNG_BINH),
            Map.entry("TB", EquipmentCondition.TRUNG_BINH),
            Map.entry("CU", EquipmentCondition.KEM),
            Map.entry("XUONG_CAP", EquipmentCondition.KEM),
            Map.entry("HONG", EquipmentCondition.KEM),
            Map.entry("HU", EquipmentCondition.KEM),
            Map.entry("HU_HONG", EquipmentCondition.KEM),
            Map.entry("HU_HONG_NANG", EquipmentCondition.KEM),
            Map.entry("HONG_HOAN_TOAN", EquipmentCondition.KEM),
            Map.entry("KHONG_SU_DUNG", EquipmentCondition.KEM),
            Map.entry("KHONG_SU_DUNG_DUOC", EquipmentCondition.KEM),
            Map.entry("KHONG_DUNG", EquipmentCondition.KEM),
            Map.entry("KHONG_SD", EquipmentCondition.KEM),
            Map.entry("NGUNG_SU_DUNG", EquipmentCondition.KEM));

    /**
     * Cách ghi hay gặp ở tệp của trường → tên hằng của lựa chọn, theo từng loại lựa chọn. Khoá đã bỏ dấu
     * ({@link #fold}). Không thấy ở đây và không khớp nhãn thì vẫn báo lỗi như cũ.
     */
    private static final Map<Class<?>, Map<String, String>> CHOICE_SYNONYMS = Map.of(
            OriginRule.class, pairs(
                    "MUA", "MUA_SAM", "MUA_MOI", "MUA_SAM", "MUA_SAM_MOI", "MUA_SAM", "TU_MUA", "MUA_SAM",
                    "TRUONG_MUA", "MUA_SAM", "CAP_PHAT", "PHAN_BO", "DUOC_CAP", "PHAN_BO", "SO_CAP", "PHAN_BO",
                    "CAP_TREN_CAP", "PHAN_BO", "TREN_CAP", "PHAN_BO", "PHONG_GD_CAP", "PHAN_BO",
                    "PHAN_BO", "PHAN_BO", "DIEU_CHUYEN", "PHAN_BO", "DUOC_SO_PHAN_BO", "PHAN_BO", "SO_PHAN_BO", "PHAN_BO", "TIEP_NHAN", "PHAN_BO",
                    "DUOC_DIEU_CHUYEN", "PHAN_BO", "BAN_GIAO", "PHAN_BO", "DUOC_BAN_GIAO", "PHAN_BO", "DUOC_CAP_PHAT", "PHAN_BO",
                    "CAP_TREN_BAN_GIAO", "PHAN_BO",
                    "TANG", "TANG_TAI_TRO", "DUOC_TANG", "TANG_TAI_TRO", "TAI_TRO", "TANG_TAI_TRO",
                    "XA_HOI_HOA", "TANG_TAI_TRO", "XHH", "TANG_TAI_TRO", "TAI_TRO_XA_HOI_HOA", "TANG_TAI_TRO",
                    "TU_LAM", "TU_LAM", "TU_TAO", "TU_LAM", "TU_CHE", "TU_LAM", "THUA", "KIEM_KE_THUA",
                    "PHAT_HIEN_THUA", "KIEM_KE_THUA"),
            FundingSource.class, pairs(
                    "NSNN", "STATE_BUDGET", "NS", "STATE_BUDGET", "NGAN_SACH_NHA_NUOC", "STATE_BUDGET",
                    "NGAN_SACH_CAP", "STATE_BUDGET", "NGUON_NGAN_SACH", "STATE_BUDGET", "VON_NGAN_SACH", "STATE_BUDGET",
                    "NGAN_SACH_DIA_PHUONG", "STATE_BUDGET", "NGAN_SACH_TINH", "STATE_BUDGET",
                    "NGAN_SACH_HUYEN", "STATE_BUDGET", "NSDP", "STATE_BUDGET",
                    "XA_HOI_HOA", "SPONSORSHIP", "XHH", "SPONSORSHIP", "NGUON_XA_HOI_HOA", "SPONSORSHIP",
                    "VAN_DONG", "SPONSORSHIP", "TAI_TRO", "SPONSORSHIP",
                    "HOC_PHI", "TUITION", "NGUON_HOC_PHI", "TUITION", "THU_SU_NGHIEP", "REVENUE",
                    "NGUON_THU", "REVENUE", "QUY_PTSN", "DEVELOPMENT_FUND", "QUY_PHAT_TRIEN", "DEVELOPMENT_FUND",
                    "CHUA_XAC_DINH", "UNDETERMINED", "KHONG_RO", "UNDETERMINED", "KHAC", "OTHER", "NGUON_KHAC", "OTHER"),
            FacilityCondition.class, pairs(
                    "CON_TOT", "TOT", "MOI", "TOT", "KHA", "BINH_THUONG", "TRUNG_BINH", "BINH_THUONG",
                    "SU_DUNG_DUOC", "BINH_THUONG", "ON_DINH", "BINH_THUONG", "CAN_SUA", "CAN_SUA_CHUA",
                    "HONG_NHE", "CAN_SUA_CHUA", "XUONG_CAP_NHE", "XUONG_CAP", "CU", "XUONG_CAP", "KEM", "XUONG_CAP",
                    "HONG", "HU_HONG_NANG", "HONG_NANG", "HU_HONG_NANG", "HU_HONG", "HU_HONG_NANG",
                    "NGUY_HIEM", "HU_HONG_NANG"),
            RoomUsageStatus.class, pairs(
                    "DANG_DUNG", "DANG_SU_DUNG", "SU_DUNG", "DANG_SU_DUNG", "CO_SU_DUNG", "DANG_SU_DUNG",
                    "HOAT_DONG", "DANG_SU_DUNG", "DANG_HOAT_DONG", "DANG_SU_DUNG",
                    "TRONG", "BO_TRONG", "CHUA_SU_DUNG", "BO_TRONG", "PHONG_TRONG", "BO_TRONG",
                    "SUA_CHUA", "DANG_SUA_CHUA", "DANG_SUA", "DANG_SUA_CHUA", "KHONG_SU_DUNG", "NGUNG_SU_DUNG",
                    "NGUNG_HOAT_DONG", "NGUNG_SU_DUNG"),
            StaffPosition.class, pairs(
                    "HT", "HIEU_TRUONG", "PHT", "PHO_HIEU_TRUONG", "P_HIEU_TRUONG", "PHO_HIEU_TRUONG",
                    "TTCM", "TO_TRUONG", "TO_TRUONG", "TO_TRUONG", "TO_TRUONG_CM", "TO_TRUONG", "TO_PHO", "GIAO_VIEN",
                    "TO_PHO_CHUYEN_MON", "GIAO_VIEN", "GV", "GIAO_VIEN", "GIAO_VIEN_BO_MON", "GIAO_VIEN",
                    "GIAO_VIEN_CHU_NHIEM", "GIAO_VIEN", "GVCN", "GIAO_VIEN", "TONG_PHU_TRACH", "GIAO_VIEN",
                    "NHAN_VIEN_THIET_BI", "CAN_BO_THIET_BI", "CB_THIET_BI", "CAN_BO_THIET_BI",
                    "THIET_BI", "CAN_BO_THIET_BI", "NV_THIET_BI", "CAN_BO_THIET_BI",
                    "THU_VIEN", "NHAN_VIEN_THU_VIEN", "CAN_BO_THU_VIEN", "NHAN_VIEN_THU_VIEN",
                    "NV_THU_VIEN", "NHAN_VIEN_THU_VIEN", "NHAN_VIEN_KE_TOAN", "KE_TOAN", "KE_TOAN_TRUONG", "KE_TOAN",
                    "NHAN_VIEN_VAN_THU", "VAN_THU", "VAN_THU_THU_QUY", "VAN_THU",
                    "NV", "NHAN_VIEN", "BAO_VE", "NHAN_VIEN", "PHUC_VU", "NHAN_VIEN", "Y_TE", "NHAN_VIEN",
                    "NHAN_VIEN_Y_TE", "NHAN_VIEN", "NHAN_VIEN_BAO_VE", "NHAN_VIEN", "NHAN_VIEN_PHUC_VU", "NHAN_VIEN",
                    "THU_QUY", "NHAN_VIEN", "TAP_VU", "NHAN_VIEN", "CAP_DUONG", "NHAN_VIEN"));

    private static Map<String, String> pairs(String... kv) {
        Map<String, String> m = new HashMap<>();
        for (int i = 0; i < kv.length; i += 2) {
            m.put(kv[i], kv[i + 1]);
        }
        return Map.copyOf(m);
    }

    private static final Map<EquipmentCondition, String> CONDITION_LABELS = Map.of(
            EquipmentCondition.TOT, "Tốt", EquipmentCondition.TRUNG_BINH, "Trung bình",
            EquipmentCondition.KEM, "Kém");

    /** Viết tắt đơn vị → tên đơn vị trong danh mục (đã chuẩn hoá). */
    private static final Map<String, String> UNIT_ALIASES = Map.of(
            "G", "GAM", "GRAM", "GAM", "ML", "MILILIT", "L", "LIT", "KILOGAM", "KG", "M", "MET", "CHIEC", "CHIEC");

    /** Đổi được giữa hai đơn vị: hệ số nhân để đổi từ đơn vị trái sang đơn vị phải. */
    private static final Map<String, BigDecimal> UNIT_FACTORS = Map.of(
            "KG>GAM", new BigDecimal("1000"), "GAM>KG", new BigDecimal("0.001"),
            "LIT>MILILIT", new BigDecimal("1000"), "MILILIT>LIT", new BigDecimal("0.001"));

    /** Tên bắt đầu bằng những chữ này là dụng cụ, dù có công thức trong tên ("Bộ dụng cụ điện phân CuSO4"). */
    private static final Pattern TOOL_WORDS = Pattern.compile(
            "^(BO|DUNG_CU|MO_HINH|TRANH|MAY|TU|ONG|BINH|COC|LO|GIA|HOP|BANG|THIET_BI|PHAN_MEM|VIDEO|PHIM)(_|$)");
    /** Tên hoá chất không ghi công thức: "Thuốc thử phenolphtalein", "Kali kim loại", "Nước cất". */
    private static final Pattern CHEMICAL_WORDS = Pattern.compile("^(THUOC_THU|DUNG_DICH|HOA_CHAT|AXIT|ACID|NUOC_CAT"
            + "|NUOC_JAVEN|NUOC_GIA_VEN|NUOC_VOI|CON_|ETHANOL|ETANOL|GLUCOZO|SACCAROZO|KALI|NATRI|CANXI|MAGIE|NHOM_"
            + "|BARI|AMONI|MANGAN|IOT|PHENOL|GIAY_DO_PH|DAU_|PARAFIN|VASELIN)");
    private static final Pattern CODE = Pattern.compile("^[A-Za-z0-9._-]+$");
    /** Tên lớp: 6A1, 10 CĐIA, và kiểu tiểu học 1/1, 2/3. */
    private static final Pattern CLASS_CODE = Pattern.compile("^[\\p{L}\\p{N}._-][\\p{L}\\p{N}._ /-]*$");
    /** Một công thức hoá học đứng riêng: NaOH, H2SO4, Ca(OH)2, CaCl2.6H2O, KI. */
    private static final Pattern FORMULA = Pattern.compile("(?<![\\p{L}\\d])((?:[A-Z][a-z]?\\d*|\\((?:[A-Z][a-z]?\\d*)+\\)\\d*)"
            + "(?:[A-Z][a-z]?\\d*|\\((?:[A-Z][a-z]?\\d*)+\\)\\d*|[.·]\\d*(?=[A-Z]))+)(?![\\p{L}\\d])");
    private static final Set<String> ELEMENTS = Set.of("H", "He", "Li", "Be", "B", "C", "N", "O", "F", "Ne", "Na", "Mg",
            "Al", "Si", "P", "S", "Cl", "Ar", "K", "Ca", "Cr", "Mn", "Fe", "Co", "Ni", "Cu", "Zn", "Br", "Ag", "Sn", "I",
            "Ba", "Pb", "Hg", "Sr", "Au", "Pt");
    /** Hai chữ hoa không số thường là viết tắt (HS, GV, CN); chỉ mấy chất này là công thức thật. */
    private static final Set<String> TWO_LETTER = Set.of("KI", "HI", "HF", "KF", "CO", "NO");
    private static final Pattern ELEMENT = Pattern.compile("[A-Z][a-z]?");
    private static final Pattern EXCEL_SERIAL = Pattern.compile("\\d{4,6}(\\.\\d+)?");
    private static final LocalDate EXCEL_EPOCH = LocalDate.of(1899, 12, 30);
    /**
     * Năm học về dạng mã "2026-2027": nhận "2026/2027", "2026 – 2027", "Năm học 2026-2027", "26-27", "2026"
     * (một năm = năm bắt đầu). Không ra được thì {@code null}.
     */
    static String schoolYearKey(String text) {
        Matcher full = Pattern.compile("((?:19|20)\\d{2})\\D{1,5}((?:19|20)\\d{2})").matcher(text);
        if (full.find()) {
            return full.group(1) + "-" + full.group(2);
        }
        Matcher shortForm = Pattern.compile("(?<!\\d)(\\d{2})\\s*[-–—/]\\s*(\\d{2})(?!\\d)").matcher(text);
        if (shortForm.find()) {
            return "20" + shortForm.group(1) + "-20" + shortForm.group(2);
        }
        Matcher one = Pattern.compile("(?<!\\d)((?:19|20)\\d{2})(?!\\d)").matcher(text);
        if (one.find()) {
            int y = Integer.parseInt(one.group(1));
            return y + "-" + (y + 1);
        }
        return null;
    }

    /**
     * Năm học như người dùng đọc và ghi trong tệp — cặp năm "2026-2027" lấy từ tên ("Năm học 2026-2027"), không phải mã
     * do quy tắc sinh mã đặt ("NH006"). Dùng cho danh sách chọn ở ô Năm học.
     */
    static String schoolYearLabel(String code, String name) {
        String key = name == null ? null : schoolYearKey(name);
        if (key == null && code != null) {
            key = schoolYearKey(code);
        }
        return key != null ? key : name != null ? name : code;
    }

    /** Số nguyên kèm chữ trước / sau: "3 tầng", "40 chỗ", "Năm 2015". Nhóm 1 là phần số. */
    private static final Pattern NUMBER_WITH_WORDS =
            Pattern.compile("^(?:\\p{L}[\\p{L}\\s]*\\s)?(-?\\d[\\d.,]*)(?:\\s*\\p{L}[\\p{L}\\s.²]*)?$");
    private static final Pattern NUMBER_TAIL = Pattern.compile("^(-?\\d[\\d.,]*)\\s*(.*)$");

    /** Một số đọc được từ ô, kèm phần chữ đã bỏ (để cảnh báo) — {@code null} khi không có chữ thừa. */
    record ParsedNumber(BigDecimal value, String droppedWords) {
    }

    /**
     * Đọc số kiểu Việt Nam lẫn kiểu Anh: "1.500.000", "1.500.000,5", "1,500,000.50", "1 500 000", "12,5 m²",
     * "15 triệu", "15tr", "200 nghìn", "1.500.000 đ". Chữ đơn vị tiền / diện tích bỏ lặng lẽ; chữ khác sau số
     * ("10 cái") thì bỏ và trả lại để cảnh báo. Không đọc được → {@code null}.
     */
    static ParsedNumber parseNumber(String raw) {
        String s = raw.strip().toLowerCase(Locale.ROOT).replaceAll("(?<=\\d)\\s+(?=\\d{3}(\\D|$))", "");
        String money = "\\s*(vnđ|vnd|đồng|đ|₫|m²|m2)\\.?$";
        s = s.replaceAll(money, "").strip();
        BigDecimal multiplier = BigDecimal.ONE;
        Matcher unit = Pattern.compile("^(.*?\\d)\\s*(tỷ|tỉ|triệu|tr|nghìn|ngàn|ng|k)\\.?$").matcher(s);
        if (unit.matches()) {
            String u = unit.group(2);
            multiplier = u.startsWith("t") && !u.equals("tr") && !u.equals("triệu") ? new BigDecimal("1000000000")
                    : u.equals("tr") || u.equals("triệu") ? new BigDecimal("1000000") : new BigDecimal("1000");
            s = unit.group(1);
        }
        s = s.replaceAll(money, "").strip();
        Matcher m = NUMBER_TAIL.matcher(s);
        if (!m.matches()) {
            return null;
        }
        String np = m.group(1);
        String words = m.group(2).strip();
        if (!words.isEmpty() && (words.matches(".*\\d.*") || !words.matches(".*\\p{L}.*"))) {
            return null;
        }
        int dot = np.lastIndexOf('.');
        int comma = np.lastIndexOf(',');
        if (dot >= 0 && comma >= 0) {
            char decimal = dot > comma ? '.' : ',';
            char group = decimal == '.' ? ',' : '.';
            np = np.replace(String.valueOf(group), "").replace(decimal, '.');
        } else if (dot >= 0 || comma >= 0) {
            char sep = dot >= 0 ? '.' : ',';
            long count = np.chars().filter(c -> c == sep).count();
            int after = np.length() - np.lastIndexOf(sep) - 1;
            boolean thousands = count > 1 || (after == 3 && multiplier.equals(BigDecimal.ONE)
                    && !np.matches("-?0[.,].*"));
            np = thousands ? np.replace(String.valueOf(sep), "") : np.replace(sep, '.');
        }
        try {
            BigDecimal value = new BigDecimal(np).multiply(multiplier);
            return new ParsedNumber(value, words.isEmpty() ? null : words);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private final JdbcTemplate jdbc;

    public OnboardingValidator(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    // ------------------------------------------------------------------ kiểm cả lô

    public Map<Long, Result> validate(long schoolId, List<Staged> rows) {
        Context ctx = new Context(schoolId);
        Map<Long, Result> results = new LinkedHashMap<>();
        Map<OnboardingSheet, List<Staged>> bySheet = new LinkedHashMap<>();
        for (OnboardingSheet s : OnboardingSheet.values()) {
            bySheet.put(s, new ArrayList<>());
        }
        rows.forEach(r -> bySheet.get(r.sheet()).add(r));

        // Mã của từng trang trong lô (bỏ dòng đã bỏ qua) — để trang sau tra tới, và để bắt trùng.
        for (OnboardingSheet s : OnboardingSheet.values()) {
            if (s == OnboardingSheet.EQUIPMENT) {
                continue;
            }
            for (Staged r : bySheet.get(s)) {
                if (!r.skipped()) {
                    String key = s == OnboardingSheet.CLASS ? classKey(r.data()) : upper(text(r.data(), "code"));
                    if (key != null) {
                        ctx.batchCodes.computeIfAbsent(s, k -> new LinkedHashMap<>())
                                .computeIfAbsent(key, k -> new ArrayList<>()).add(r.rowNo());
                    }
                }
            }
        }
        // Tên phòng trong cùng khối nhà — bước ghi (`RoomService.requireNameFree`) từ chối trùng, nên bắt ngay ở đây.
        for (Staged r : bySheet.get(OnboardingSheet.ROOM)) {
            String name = text(r.data(), "name");
            if (!r.skipped() && name != null) {
                ctx.batchRoomNames.computeIfAbsent(roomNameKey(text(r.data(), "building"), name), k -> new ArrayList<>())
                        .add(r.rowNo());
            }
        }
        // Số serial trong trang Thiết bị — trùng giữa hai dòng của lô cũng là lỗi.
        for (Staged r : bySheet.get(OnboardingSheet.EQUIPMENT)) {
            String serial = serialKey(text(r.data(), "serial"));
            if (!r.skipped() && serial != null) {
                ctx.batchSerials.computeIfAbsent(serial, k -> new ArrayList<>()).add(r.rowNo());
            }
        }
        int campusCount = ctx.existing(OnboardingSheet.CAMPUS).size()
                + ctx.batchCodes.getOrDefault(OnboardingSheet.CAMPUS, Map.of()).size();
        ctx.onlyCampus = campusCount == 1
                ? ctx.batchCodes.getOrDefault(OnboardingSheet.CAMPUS, Map.of()).keySet().stream().findFirst()
                        .orElse(ctx.existing(OnboardingSheet.CAMPUS).keySet().stream().findFirst().orElse(null))
                : null;

        for (OnboardingSheet s : OnboardingSheet.values()) {
            for (Staged r : bySheet.get(s)) {
                if (r.skipped()) {
                    results.put(r.id(), new Result(SKIPPED, List.of(), Map.of(), null));
                    continue;
                }
                Row row = new Row(r, ctx);
                Object payload = switch (s) {
                    case CAMPUS -> campus(row);
                    case STAFF -> staff(row);
                    case BUILDING -> building(row);
                    case ROOM -> room(row);
                    case CLASS -> schoolClass(row);
                    case EQUIPMENT -> equipment(row);
                };
                results.put(r.id(), row.result(payload));
            }
        }
        primaryCampus(bySheet.get(OnboardingSheet.CAMPUS), results, ctx);
        codeCapacity(results, ctx);
        return results;
    }

    // ------------------------------------------------------------------ từng trang

    private CampusRow campus(Row r) {
        String code = r.code("code", "Mã cơ sở");
        String name = r.name("name", "Tên cơ sở");
        String address = r.text("address", 500);
        if (address == null) {
            r.warn("address", "Chưa có địa chỉ");
        }
        String phone = r.ruled("phone", "Số điện thoại", FieldRule.PHONE);
        Boolean primary = r.yesNo("primary", "Cơ sở chính");
        r.existsIn(OnboardingSheet.CAMPUS, code);
        return new CampusRow(code, name, address, phone, Boolean.TRUE.equals(primary), r.text("note", 500));
    }

    private StaffRow staff(Row r) {
        String code = r.code("code", "Mã cán bộ");
        String name = r.required("name", "Họ và tên", 255);
        r.check("name", "Họ và tên", FieldRule.PERSON_NAME, name);
        StaffPosition position = r.choice("position", "Chức vụ", StaffPosition.values(), StaffPosition::label);
        // Chức vụ lãnh đạo cần quyền riêng (`155`, `StaffService.requireMayAssignPosition`). Cán bộ thiết bị đổ dữ liệu
        // không có quyền đó: tạo cán bộ với chức vụ trống thay vì để cả lô đổ ở bước ghi. Chữ trong ô giữ nguyên —
        // người có quyền kiểm lại / ghi thì chức vụ được giữ.
        if ((position == StaffPosition.HIEU_TRUONG || position == StaffPosition.PHO_HIEU_TRUONG)
                && CurrentUser.id().isPresent() && !CurrentUser.has("staff:assign_leadership")) {
            r.warn("position", "Chức vụ " + position.label() + " sẽ để trống vì bạn không có quyền đặt. Lãnh đạo trường đặt lại sau");
            position = null;
        }
        StaffType type = null;
        String typeText = r.text("type", 50);
        if (typeText != null) {
            String t = fold(typeText);
            type = t.startsWith("GIAO_VIEN") ? StaffType.TEACHER
                    : t.startsWith("CAN_BO") || t.startsWith("NHAN_VIEN") ? StaffType.STAFF : null;
            if (type == null) {
                r.error("type", "Loại phải là Giáo viên hoặc Cán bộ");
            }
        }
        if (type == null) {
            type = position == StaffPosition.GIAO_VIEN || position == StaffPosition.TO_TRUONG
                    || (position == null && r.text("mainSubject", 255) != null) ? StaffType.TEACHER : StaffType.STAFF;
        }
        // Cùng luật với màn cán bộ (`StaffService.requireTypeMatchesPosition`, `requireNoTeachingSubjects`), báo ngay
        // ở vùng chờ thay vì đổ ở bước ghi.
        if (position != null && position != StaffPosition.HIEU_TRUONG && position != StaffPosition.PHO_HIEU_TRUONG) {
            boolean teaching = position == StaffPosition.GIAO_VIEN || position == StaffPosition.TO_TRUONG;
            if (teaching && type != StaffType.TEACHER) {
                r.error("position", "Chức vụ " + position.label() + " chỉ dành cho Giáo viên — đổi loại hoặc ghi chức vụ Khác");
            } else if (!teaching && type == StaffType.TEACHER) {
                r.error("position", "Giáo viên không mang chức vụ " + position.label() + " — đổi loại thành Cán bộ hoặc đổi chức vụ");
            }
        }
        Long main = r.subject("mainSubject", "Môn chính");
        List<Long> subjects = new ArrayList<>();
        String list = r.text("subjects", 500);
        if (list != null) {
            for (String part : list.split("[;,]")) {
                Long id = r.subjectName("subjects", part.trim());
                if (id != null && !subjects.contains(id)) {
                    subjects.add(id);
                }
            }
        }
        if (main != null && !subjects.contains(main)) {
            subjects.add(0, main);
        }
        if (type != StaffType.TEACHER && !subjects.isEmpty()) {
            r.error("subjects", "Cán bộ không mang môn giảng dạy — đổi loại thành Giáo viên hoặc xoá môn");
        }
        String phone = r.ruled("phone", "Số điện thoại", FieldRule.PHONE);
        String email = r.ruled("email", "Email", FieldRule.EMAIL);
        String team = r.text("team", 255);
        if (team != null) {
            r.resolved.put("team", team);
        }
        r.existsIn(OnboardingSheet.STAFF, code);
        return new StaffRow(code, name, type, position, team, main, subjects, r.text("department", 255), phone, email,
                r.text("note", 500));
    }

    private BuildingRow building(Row r) {
        String code = r.code("code", "Mã khối nhà");
        String name = r.name("name", "Tên khối nhà");
        String campus = r.text("campus", 64);
        if (campus == null) {
            campus = r.ctx.onlyCampus;
            if (campus == null) {
                r.error("campus", "Ghi mã cơ sở — trường có nhiều cơ sở (hoặc chưa có cơ sở nào ở trang Cơ sở)");
            }
        } else {
            r.reference("campus", OnboardingSheet.CAMPUS, campus, "cơ sở");
        }
        Integer floors = r.integer("floors", "Số tầng", 0, 200);
        if (floors == null && r.text("floors", 20) == null) {
            r.error("floors", "Thiếu số tầng");
        }
        Integer year = r.integer("year", "Năm đưa vào sử dụng", 1800, 2100);
        BigDecimal area = r.number("area", "Diện tích sàn");
        FacilityCondition condition = r.choice("condition", "Hiện trạng", FacilityCondition.values(), null);
        String manager = r.reference("manager", OnboardingSheet.STAFF, r.text("manager", 64), "cán bộ");
        if (floors != null) {
            r.ctx.floors.put(upper(code), floors);
        }
        r.existsIn(OnboardingSheet.BUILDING, code);
        return new BuildingRow(code, name, upper(campus), floors, year, area, condition, manager,
                r.text("note", 500));
    }

    private RoomRow room(Row r) {
        String code = r.code("code", "Mã phòng");
        String name = r.name("name", "Tên phòng");
        // Khối nhà, tầng không bắt buộc: sân, cổng, khu vệ sinh, khu để xe… không thuộc khối nhà nào (201).
        String building = r.reference("building", OnboardingSheet.BUILDING, r.text("building", 64), "khối nhà");
        String floor = r.text("floor", 50);
        if (floor != null && r.text("building", 64) == null) {
            r.error("building", "Có tầng thì phải ghi khối nhà");
        } else if (floor != null && building != null && floor.matches("\\d+")) {
            Integer max = r.ctx.floors.get(building);
            if (max != null && Integer.parseInt(floor) > max) {
                r.error("floor", "Tầng " + floor + " vượt số tầng của khối nhà (" + max + ")");
            }
        }
        Long roomType = null;
        String typeText = r.text("roomType", 100);
        if (typeText == null) {
            r.error("roomType", "Thiếu loại phòng");
        } else {
            roomType = r.ctx.roomTypes.get(fold(typeText));
            if (roomType == null) {
                roomType = legacyRoomType(r.ctx, typeText, r.text("subject", 255));
            }
            if (roomType == null) {
                r.error("roomType", "Không có loại phòng \"" + typeText + "\"");
            }
        }
        Long subject = r.subject("subject", "Môn");
        if (subject == null && roomType != null && roomType.equals(r.ctx.roomTypes.get("PHONG_BO_MON"))
                && r.text("subject", 255) == null) {
            r.warn("subject", "Phòng bộ môn chưa ghi môn — không tính được định mức theo phòng học bộ môn");
        }
        if (subject != null) {
            r.ctx.roomSubjects.put(upper(code), subject);
        }
        BigDecimal area = r.number("area", "Diện tích");
        Integer capacity = r.integer("capacity", "Sức chứa", 0, 100_000);
        FacilityCondition condition = r.choice("condition", "Hiện trạng", FacilityCondition.values(), null);
        RoomUsageStatus usage = r.choice("usage", "Tình trạng sử dụng", RoomUsageStatus.values(), null);
        String manager = r.reference("manager", OnboardingSheet.STAFF, r.text("manager", 64), "cán bộ");
        roomNameFree(r, code, name, r.text("building", 64));
        r.existsIn(OnboardingSheet.ROOM, code);
        return new RoomRow(code, name, building, floor, roomType, subject, area, capacity, condition, usage, manager,
                r.text("unit", 255), r.text("note", 500),
                r.choice("structure", "Kết cấu", FacilityStructure.values(), FacilityStructure::label));
    }

    /**
     * Cùng luật với màn phòng (`RoomService.requireNameFree`): trong một khối nhà (hoặc trong nhóm chưa gắn khối nhà)
     * không có hai phòng cùng tên, không phân biệt hoa thường. Trùng trong tệp hay trùng phòng đã có đều báo lỗi ở
     * đây, để không qua được bước kiểm rồi mới đổ ở bước ghi.
     */
    private void roomNameFree(Row r, String code, String name, String building) {
        if (name == null) {
            return;
        }
        String key = roomNameKey(building, name);
        String where = building == null ? "trong nhóm chưa gắn khối nhà" : "trong khối nhà " + upper(building);
        List<Integer> same = r.ctx.batchRoomNames.getOrDefault(key, List.of());
        if (same.size() > 1) {
            r.error("name", "Tên phòng \"" + name + "\" bị trùng " + where + " (dòng " + join(same)
                    + "). Mỗi phòng trong một khối nhà cần một tên riêng, ví dụ thêm số phòng: \"" + name + " "
                    + (code == null ? "1" : code) + "\"");
            return;
        }
        String other = r.ctx.roomNames().get(key);
        if (other != null && (code == null || !other.equals(upper(code)))) {
            r.error("name", "Trường đã có phòng " + other + " tên \"" + name + "\" " + where
                    + ". Đặt tên khác cho phòng này, hoặc ghi đúng mã " + other + " nếu là cùng một phòng");
        }
    }

    private static String roomNameKey(String building, String name) {
        String b = upper(building);
        return (b == null ? "" : b) + "|" + name.trim().toLowerCase(Locale.ROOT);
    }

    private ClassRow schoolClass(Row r) {
        String code = r.required("code", "Tên lớp", 64);
        if (code != null && !CLASS_CODE.matcher(code).matches()) {
            r.error("code", "Tên lớp chỉ gồm chữ, số, khoảng trắng và . _ - /");
        }
        Long grade = null;
        String gradeText = r.text("grade", 50);
        if (gradeText == null) {
            // Không ghi khối: suy từ tên lớp "6A1" → Lớp 6.
            Matcher lead = code == null ? null : Pattern.compile("^(\\d{1,2})\\D.*").matcher(code);
            grade = lead != null && lead.matches() ? r.ctx.grades.get("LOP_" + Integer.parseInt(lead.group(1))) : null;
            if (grade == null) {
                r.error("grade", "Thiếu khối lớp");
            } else {
                r.warn("grade", "Suy từ tên lớp: Lớp " + Integer.parseInt(lead.group(1)));
            }
        } else {
            grade = r.ctx.grades.get(fold(gradeText));
            if (grade == null) {
                // "6", "Khối 6", "K6", "Lớp 6 (THCS)" → Lớp 6.
                Matcher n = Pattern.compile("^(?:KHOI|LOP|K|L)?_?(\\d{1,2})(?:_.*)?$")
                        .matcher(fold(gradeText).replaceAll("^_|_$", ""));
                grade = n.matches() ? r.ctx.grades.get("LOP_" + Integer.parseInt(n.group(1))) : null;
                if (grade != null) {
                    r.resolved.put("grade", "Lớp " + Integer.parseInt(n.group(1)));
                }
            }
            if (grade == null) {
                r.error("grade", "Không có khối lớp \"" + gradeText + "\"");
            }
        }
        Long year = null;
        String yearText = r.text("year", 30);
        if (yearText == null) {
            r.error("year", "Thiếu năm học");
        } else {
            String key = schoolYearKey(yearText);
            year = key == null ? null : r.ctx.years.get(key);
            boolean byCode = false;
            if (year == null && key == null) {
                // Ghi mã năm học ("NH006") — vẫn nhận, nhưng hiện cặp năm cho dễ đọc.
                year = r.ctx.years.get(upper(yearText.replaceAll("\\s", "")));
                key = year == null ? null : r.ctx.yearLabels.get(year);
                byCode = year != null;
            }
            if (year == null) {
                r.error("year", "Không có năm học \"" + yearText + "\". Ghi cặp năm, ví dụ 2026-2027");
            } else if (!key.equals(yearText.replaceAll("\\s", ""))) {
                r.resolved.put("year", key);
                if (!byCode && !yearText.matches(".*\\d{2}\\D+\\d{2}.*")) {
                    r.warn("year", "Chỉ có một năm — hiểu là năm học " + key);
                }
            }
        }
        Integer students = r.integer("students", "Sĩ số", 0, 200);
        if (students == null && r.text("students", 10) == null) {
            r.error("students", "Thiếu sĩ số");
        }
        String teacher = r.reference("teacher", OnboardingSheet.STAFF, r.text("teacher", 64), "cán bộ");
        String room = r.reference("room", OnboardingSheet.ROOM, r.text("room", 64), "phòng");
        r.existsIn(OnboardingSheet.CLASS, classKey(r.staged.data()));
        return new ClassRow(code, grade, year, students, teacher, room, r.text("note", 500));
    }

    /** "1- Khảo sát…", "1. Bộ…": tên bắt đầu bằng số thứ tự. */
    private static final Pattern NUMBERED = Pattern.compile("^\\d{1,2}\\s*[-.)]\\s*\\S");
    /** "…rơi tự do2- Chuyển động…", "…không đổi1. Đo…": mục đánh số dính vào giữa tên (mất dấu xuống dòng khi dán). */
    private static final Pattern GLUED_ITEM = Pattern.compile("[\\p{L}.,;)]\\s*\\d{1,2}\\s*[-.]\\s*\\p{Lu}");
    /** Dài hơn mức này thường là đoạn mô tả / danh sách bài thí nghiệm, không phải tên thiết bị. */
    private static final int LONG_NAME = 150;

    /**
     * Tên hợp lệ nhưng trông như danh sách bài thí nghiệm chép từ sổ cũ: chỉ nhắc (không chặn) để trường sửa tệp —
     * mỗi thiết bị một dòng, tên là tên thiết bị.
     */
    private static void equipmentNameHints(Row r, String name) {
        if (name == null) {
            return;
        }
        if (GLUED_ITEM.matcher(name).find()) {
            r.warn("name", "Tên gộp nhiều mục đánh số — mỗi thiết bị một dòng, tên là tên thiết bị");
        } else if (NUMBERED.matcher(name).find()) {
            r.warn("name", "Tên bắt đầu bằng số thứ tự — bỏ số ở đầu");
        }
        if (name.length() > LONG_NAME) {
            r.warn("name", "Tên dài " + name.length() + " ký tự — kiểm tra lại, tên nên là tên thiết bị, không phải mô tả");
        }
    }

    private EquipmentRow equipment(Row r) {
        Context ctx = r.ctx;
        String name = r.name("name", "Tên thiết bị");
        equipmentNameHints(r, name);
        String cell = r.text("catalog", 64);
        String legacy = r.text("legacy", 64);
        String room = r.reference("room", OnboardingSheet.ROOM, r.text("room", 64), "phòng");
        Long roomSubject = room == null ? null : ctx.roomSubjects.get(room);

        // Ghép với danh mục, lần lượt: mã của danh mục → mã đã học (MISA…) → tên → công thức hoá học.
        Catalog catalog = null;
        String method = null;
        if (cell != null) {
            catalog = ctx.byCode.get(upper(cell));
            if (catalog != null && !catalog.official() && !Long.valueOf(ctx.schoolId).equals(catalog.owner())) {
                catalog = null;
            }
            method = catalog != null ? "code" : null;
            if (catalog == null && ctx.aliases.containsKey(upper(cell))) {
                catalog = ctx.byId.get(ctx.aliases.get(upper(cell)));
                method = catalog != null ? "alias" : null;
            }
        }
        if (catalog == null && name != null) {
            List<Catalog> sameName = ctx.byName.getOrDefault(norm(name), List.of());
            if (!sameName.isEmpty()) {
                // Cùng tên ở nhiều môn (máy chiếu, bảng…): chọn thiết bị của môn phòng đang đặt, không có thì cái đầu.
                List<Catalog> bySubject = roomSubject == null ? List.of()
                        : sameName.stream().filter(c -> roomSubject.equals(c.subject())).toList();
                catalog = bySubject.size() == 1 ? bySubject.get(0) : sameName.get(0);
                method = catalog.official() ? "name" : "own";
                if (sameName.size() > 1 && bySubject.size() != 1) {
                    r.warn("catalog", "Danh mục có " + sameName.size() + " thiết bị cùng tên này, hệ thống đã chọn "
                            + catalog.code() + " — nếu chọn sai thì ghi đúng mã ở cột Mã DM thiết bị");
                }
            }
        }
        List<String> formulas = name == null ? List.of() : formulas(name);
        if (catalog == null && !formulas.isEmpty()) {
            for (String f : formulas) {
                List<Catalog> hits = ctx.byFormula.getOrDefault(f, List.of());
                if (hits.size() == 1) {
                    catalog = hits.get(0);
                    method = "formula";
                    break;
                }
            }
        }

        // Cấp học của trường không có, cấp khác có cùng tên: dùng thiết bị đó (Sở không cho trường tạo trùng tên
        // với danh mục), và nói rõ vì định mức của cấp học không đếm nó.
        if (catalog == null && name != null && ctx.otherLevelByName.containsKey(norm(name))) {
            catalog = ctx.otherLevelByName.get(norm(name)).get(0);
            method = "other-level";
            r.warn("catalog", "Chỉ có trong danh mục của cấp học khác (" + catalog.code()
                    + ") — thiết bị không tính vào định mức của trường");
        }

        // Mã ở cột "Mã DM thiết bị" không phải mã danh mục (mã MISA…) thì giữ làm mã cũ.
        String aliasCode = null;
        if (cell != null && !"code".equals(method)) {
            aliasCode = cell;
            if (legacy == null) {
                legacy = cell;
            }
        }
        // Nhập lại cùng tệp: mã cũ đã thành `legacy_code` của thiết bị trường → dòng đã có, không tạo lại. Thiếu bước
        // này thì thiết bị không có serial (máy tính, bàn ghế…) bị tạo trùng mỗi lần ghi.
        if (legacy != null && ctx.existing(OnboardingSheet.EQUIPMENT).containsKey(upper(legacy))) {
            r.exists = true;
            r.warn("legacy", "Đã có trên hệ thống (mã cũ " + legacy + ") — dòng này không tạo lại");
        }

        BigDecimal quantity = r.number("quantity", "Số lượng");
        if (quantity == null) {
            if (r.text("quantity", 40) == null) {
                quantity = BigDecimal.ONE;
            }
        } else if (quantity.signum() <= 0) {
            r.error("quantity", "Số lượng phải lớn hơn 0 — không còn thì bỏ dòng này");
        }
        Unit unit = null;
        String unitText = r.text("unit", 50);
        if (unitText != null) {
            unit = ctx.unit(unitText);
            if (unit == null) {
                r.error("unit", "Không có đơn vị tính \"" + unitText + "\" trong danh mục");
            }
        }

        NewItem newItem = null;
        boolean bulk;
        if (catalog != null) {
            bulk = catalog.bulk();
            r.resolved.put("catalogId", catalog.id());
            r.resolved.put("catalogCode", catalog.code());
            r.resolved.put("catalogName", catalog.name());
            r.resolved.put("match", method);
            Unit catalogUnit = catalog.unit() == null ? null : ctx.unitsById.get(catalog.unit());
            if (catalogUnit != null) {
                r.resolved.put("unit", catalogUnit.name());
            }
            if (bulk && quantity != null && quantity.signum() > 0) {
                if (unit != null && catalogUnit != null && !unit.id().equals(catalogUnit.id())) {
                    BigDecimal factor = UNIT_FACTORS.get(unit.key() + ">" + catalogUnit.key());
                    if (factor == null) {
                        r.error("unit", "Danh mục tính thiết bị này theo " + catalogUnit.name()
                                + " — đổi số lượng sang " + catalogUnit.name() + " (hoặc bỏ trống cột đơn vị)");
                    } else {
                        quantity = quantity.multiply(factor).stripTrailingZeros();
                        r.warn("quantity", "Danh mục tính bằng " + catalogUnit.name() + " nên đã đổi " + unitText + " sang "
                                + catalogUnit.name() + ": "
                                + quantity.toPlainString());
                    }
                } else if (unit == null && catalogUnit != null) {
                    r.warn("unit", "Số lượng hiểu theo đơn vị của danh mục: " + catalogUnit.name());
                }
                if (quantity.stripTrailingZeros().scale() > 0 && catalogUnit != null && !catalogUnit.fraction()) {
                    r.error("quantity", "Đơn vị " + catalogUnit.name() + " không ghi số lẻ");
                }
            }
        } else if (name != null) {
            // Ngoài danh mục: có công thức hoá học hoặc đơn vị đo lường thì là hoá chất / vật tư (một hồ sơ mang
            // số lượng), còn lại là thiết bị bền.
            boolean chemical = (!formulas.isEmpty() || chemicalName(name)) && !TOOL_WORDS.matcher(fold(name)).find();
            String tracking = r.text("tracking", 30);
            if (tracking == null) {
                bulk = chemical || (unit != null && (unit.fraction() || PACK_UNITS.contains(unit.key())));
            } else {
                String t = fold(tracking);
                bulk = t.equals("THEO_LO") || t.equals("LO") || t.contains("SO_LUONG") || t.equals("BULK") || t.contains("VAT_TU");
                if (!bulk && !t.contains("TUNG_CAI") && !t.equals("SERIAL")) {
                    r.error("tracking", "Cách quản lý ghi Từng cái hoặc Theo lô");
                }
            }
            if (chemical && unit == null) {
                r.error("unit", "Hoá chất ngoài danh mục: ghi đơn vị tính (g, ml, lọ…)");
            }
            newItem = new NewItem(norm(name), name, unit == null ? null : unit.id(), bulk, chemical, roomSubject);
            r.resolved.put("match", "new");
            r.warn("catalog", "Không có trong danh mục — sẽ thành thiết bị ngoài danh mục của trường");
        } else {
            bulk = false;
        }
        if (catalog != null && r.text("tracking", 30) != null) {
            r.warn("tracking", "Bỏ qua cột Cách quản lý: thiết bị có trong danh mục nên hệ thống tự quản lý "
                    + (bulk ? "theo lô" : "từng cái") + " theo danh mục");
        }

        int copies = 1;
        if (!bulk && quantity != null && quantity.signum() > 0) {
            if (quantity.stripTrailingZeros().scale() > 0) {
                r.error("quantity", "Thiết bị quản lý từng cái không có số lượng lẻ");
            } else if (quantity.intValue() > MAX_COPIES) {
                r.error("quantity", "Một dòng tối đa " + MAX_COPIES + " cái — nếu là hoá chất, vật tư thì ghi đơn vị tính");
            } else {
                copies = quantity.intValue();
            }
        }
        String serial = r.text("serial", 100);
        if (serial != null && copies > 1) {
            r.error("serial", "Số serial chỉ ghi khi số lượng là 1");
        }
        if (serial != null) {
            List<Integer> same = ctx.batchSerials.getOrDefault(serialKey(serial), List.of());
            String holder = ctx.serials().get(serialKey(serial));
            if (same.size() > 1) {
                r.error("serial", "Số serial \"" + serial + "\" lặp lại ở các dòng " + join(same));
            } else if (holder != null && !r.exists) {
                // Dòng đã có (khớp mã cũ): serial là của chính thiết bị đó, không phải trùng.
                r.error("serial", "Số serial \"" + serial + "\" đã có ở thiết bị " + holder);
            }
        }
        String manager = r.reference("manager", OnboardingSheet.STAFF, r.text("manager", 64), "cán bộ");

        BigDecimal original = r.number("originalValue", "Nguyên giá");
        BigDecimal remaining = r.number("remainingValue", "Giá trị còn lại");
        if (original != null && remaining != null && remaining.compareTo(original) > 0) {
            r.error("remainingValue", "Giá trị còn lại lớn hơn nguyên giá");
        }
        Integer year = r.integer("year", "Năm đưa vào sử dụng", 1900, 2100);
        LocalDate received = r.date("receivedDate", "Ngày tiếp nhận");
        if (received == null && year != null && r.text("receivedDate", 40) == null) {
            received = LocalDate.of(year, 1, 1);
            r.resolved.put("receivedDate", received.toString());
        }
        OriginRule origin = r.choice("origin", "Nguồn hình thành", OriginRule.values(), OriginRule::label);
        FundingSource funding = r.choice("funding", "Nguồn kinh phí", FundingSource.values(), FundingSource::label);
        if (funding == null && r.text("funding", 100) == null) {
            if (origin != null && !origin.allows(FundingSource.UNDETERMINED)) {
                r.error("funding", "Nguồn hình thành \"" + origin.label() + "\" cần ghi nguồn kinh phí");
            } else {
                funding = FundingSource.UNDETERMINED;
            }
        } else if (origin != null && funding != null && !origin.allows(funding)) {
            r.error("funding", "Nguồn kinh phí \"" + funding.label() + "\" không đi với nguồn hình thành \""
                    + origin.label() + "\"");
        }
        Long originId = origin == null ? null : ctx.originIds.get(origin.name());
        EquipmentCondition condition = null;
        String conditionText = r.text("condition", 50);
        if (conditionText != null) {
            condition = CONDITION_ALIASES.get(fold(conditionText));
            if (condition == null) {
                condition = r.choice("condition", "Tình trạng", EquipmentCondition.values(), CONDITION_LABELS::get);
            } else {
                r.resolved.put("condition", CONDITION_LABELS.get(condition));
            }
        }
        List<String> missing = new ArrayList<>();
        if (received == null && r.text("receivedDate", 40) == null) {
            missing.add("ngày tiếp nhận");
        }
        if (!missing.isEmpty()) {
            r.warn("receivedDate", "Thiếu " + String.join(", ", missing)
                    + " — vẫn nhập được, nhưng hồ sơ chưa đạt chuẩn cho tới khi bổ sung");
        }
        r.resolved.put("copies", bulk ? 1 : copies);
        // Bộ đếm mã tài sản của dòng này: MH.LT.NC (NC = năm tiếp nhận, không có thì năm nay — như khi cấp mã).
        String counter = catalog != null ? catalog.counter()
                : (newItem != null && newItem.subject() != null && ctx.teachingCodes.containsKey(newItem.subject())
                        ? ctx.teachingCodes.get(newItem.subject()) : "00") + ".TB";
        int yy = (received != null ? received.getYear() : LocalDate.now().getYear()) % 100;
        ctx.counters.computeIfAbsent(counter + "." + String.format("%02d", yy), k -> new LinkedHashMap<>())
                .put(r.staged.id(), bulk ? 1 : copies);
        return new EquipmentRow(legacy, name, catalog == null ? null : catalog.id(), newItem,
                catalog != null && catalog.official() && !"code".equals(method) ? aliasCode : null,
                bulk ? quantity : BigDecimal.ONE, bulk ? 1 : copies, serial, room, manager, original, remaining,
                received, year, originId, origin, funding, condition, r.text("note", 500));
    }

    /**
     * Mỗi bộ đếm mã tài sản (môn · loại · năm) chỉ có 9.999 số. Lô nào vượt thì báo NGAY ở vùng chờ, trên những dòng
     * nhiều cái nhất — thường là vật tư dùng hết (cáp mạng, đầu bấm, đĩa, lọ) đang bị quản lý từng cái.
     */
    private void codeCapacity(Map<Long, Result> results, Context ctx) {
        ctx.counters.forEach((key, rows) -> {
            int capacity = LAST_SEQUENCE - ctx.used.getOrDefault(key, 0);
            int need = rows.values().stream().mapToInt(Integer::intValue).sum();
            if (need <= capacity) {
                return;
            }
            List<Map.Entry<Long, Integer>> biggest = rows.entrySet().stream()
                    .sorted((a, b) -> b.getValue() - a.getValue()).toList();
            int over = need - capacity;
            String[] p = key.split("\\.");
            // Câu cho người nhập: mỗi cái thành một hồ sơ, mỗi hồ sơ một mã — nhóm mã (môn · loại · năm) chỉ có 9.999 số.
            String group = ("00".equals(p[0]) ? "dùng chung" : "môn mã " + p[0]) + ", nhận năm 20" + p[2];
            String text = "Số lượng quá lớn để cấp mã từng cái: mỗi cái cần một mã, nhóm " + group + " chỉ còn "
                    + capacity + " mã mà tệp cần " + need + ". Nếu là vật tư dùng hết (lọ, cáp, đầu bấm…) thì ghi cột"
                    + " Cách quản lý là \"Theo lô\" — cả dòng chỉ cần một mã.";
            for (Map.Entry<Long, Integer> e : biggest) {
                if (over <= 0) {
                    break;
                }
                Result res = results.get(e.getKey());
                List<Message> messages = new ArrayList<>(res.messages());
                messages.add(new Message("error", "quantity", text));
                results.put(e.getKey(), new Result(ERROR, messages, res.resolved(), res.payload()));
                over -= e.getValue();
            }
        });
    }

    /** Mỗi trường đúng một cơ sở chính: trường một cơ sở thì cơ sở ấy, nhiều cơ sở mà không đánh dấu thì báo. */
    private void primaryCampus(List<Staged> campuses, Map<Long, Result> results, Context ctx) {
        List<Staged> live = campuses.stream().filter(s -> !s.skipped()).toList();
        long marked = live.stream().filter(s -> {
            Result res = results.get(s.id());
            return res.payload() instanceof CampusRow c && c.primary();
        }).count();
        // Cơ sở chính đã có trên hệ thống — nêu mã của nó trong câu lỗi: hay gặp nhất là CÙNG một cơ sở mà tệp ghi
        // mã khác (CS1 với CS01), sửa mã là xong.
        String existing = jdbc.query(
                "SELECT code || ' (' || name || ')' FROM campuses WHERE school_id = ? AND is_primary LIMIT 1",
                rs -> rs.next() ? rs.getString(1) : null, ctx.schoolId);
        boolean existingPrimary = existing != null;
        for (Staged s : live) {
            Result res = results.get(s.id());
            if (!(res.payload() instanceof CampusRow c) || EXISTS.equals(res.status())) {
                continue;
            }
            List<Message> messages = new ArrayList<>(res.messages());
            CampusRow fixed = c;
            if (marked + (existingPrimary ? 1 : 0) > 1 && c.primary()) {
                messages.add(new Message("error", "primary", existingPrimary
                        ? "Trường đã có cơ sở chính " + existing + " trên hệ thống. Nếu là cùng cơ sở thì ghi mã "
                                + existing.substring(0, existing.indexOf(" (")) + "; nếu không thì ghi Không"
                        : "Mỗi trường chỉ một cơ sở chính — chỉ ghi Có ở một dòng"));
            } else if (marked == 0 && !existingPrimary && live.size() == 1) {
                fixed = new CampusRow(c.code(), c.name(), c.address(), c.phone(), true, c.note());
            }
            results.put(s.id(), new Result(statusOf(messages, res.status()), messages, res.resolved(), fixed));
        }
    }

    // ------------------------------------------------------------------ một dòng đang kiểm

    private final class Row {
        final Staged staged;
        final Context ctx;
        final List<Message> messages = new ArrayList<>();
        final Map<String, Object> resolved = new LinkedHashMap<>();
        boolean exists;

        Row(Staged staged, Context ctx) {
            this.staged = staged;
            this.ctx = ctx;
        }

        Result result(Object payload) {
            String status = statusOf(messages, exists ? EXISTS : OK);
            return new Result(status, messages, resolved, payload);
        }

        void error(String field, String text) {
            messages.add(new Message("error", field, text));
        }

        void warn(String field, String text) {
            messages.add(new Message("warning", field, text));
        }

        /** Ô đã cắt khoảng trắng hai đầu và gộp khoảng trắng kép; trống là {@code null}. */
        String text(String key, int max) {
            String v = OnboardingValidator.text(staged.data(), key);
            if (v != null && v.length() > max) {
                error(key, "Tối đa " + max + " ký tự");
                return v.substring(0, max);
            }
            return v;
        }

        /**
         * Ô theo một kiểu chuẩn ({@link FieldRule}) — cùng luật với form nhập tay, nên tệp không lọt thứ form chặn.
         * Giá trị trả về đã chuẩn hoá (SĐT bỏ dấu ngăn cách, email chữ thường).
         */
        String ruled(String key, String label, FieldRule rule) {
            String v = text(key, rule.max());
            return check(key, label, rule, v) ? rule.normalize(v) : v;
        }

        boolean check(String key, String label, FieldRule rule, String value) {
            String problem = rule.violation(value, 0);
            if (problem != null) {
                error(key, label + " " + problem);
                return false;
            }
            return true;
        }

        String required(String key, String label, int max) {
            String v = text(key, max);
            if (v == null) {
                error(key, "Thiếu " + label.toLowerCase(Locale.ROOT));
            }
            return v;
        }

        /** Tên một thứ: bắt buộc, cùng luật {@link FieldRule#NAME} với form nhập tay. */
        String name(String key, String label) {
            String v = required(key, label, FieldRule.NAME.max());
            if (v != null) {
                check(key, label, FieldRule.NAME, v);
            }
            return v;
        }

        String code(String key, String label) {
            String v = required(key, label, 64);
            if (v != null && !CODE.matcher(v).matches()) {
                error(key, label + " chỉ gồm chữ, số, dấu chấm, gạch dưới, gạch nối — không dấu cách, không ngoặc");
            }
            if (v != null) {
                List<Integer> rows = ctx.batchCodes.getOrDefault(staged.sheet(), Map.of()).getOrDefault(upper(v), List.of());
                if (rows.size() > 1) {
                    error(key, "Mã \"" + v + "\" lặp lại ở các dòng " + join(rows));
                }
            }
            return v;
        }

        /** Đã có trên hệ thống → không tạo lại. */
        void existsIn(OnboardingSheet sheet, String code) {
            if (code != null && ctx.existing(sheet).containsKey(upper(code))) {
                exists = true;
                messages.add(new Message("warning", "code", "Đã có trên hệ thống — dòng này không tạo lại"));
            }
        }

        /** Mã tham chiếu tới trang khác: phải có ở trang đó trong lô hoặc đã có trên hệ thống. */
        String reference(String key, OnboardingSheet sheet, String code, String what) {
            if (code == null) {
                return null;
            }
            String k = upper(code);
            boolean known = ctx.batchCodes.getOrDefault(sheet, Map.of()).containsKey(k) || ctx.existing(sheet).containsKey(k);
            if (!known) {
                error(key, "Không có " + what + " mã \"" + code + "\" ở trang " + sheet.title() + " hay trên hệ thống");
                return null;
            }
            return k;
        }

        Long subject(String key, String label) {
            String v = text(key, 255);
            return v == null ? null : subjectName(key, v);
        }

        Long subjectName(String key, String v) {
            if (v == null || v.isBlank()) {
                return null;
            }
            String n = norm(v);
            Long id = ctx.subjects.get(SUBJECT_ALIASES.getOrDefault(n, n));
            if (id == null) {
                warn(key, "Hệ thống chưa có môn \"" + v + "\" — bỏ qua môn này");
            }
            return id;
        }

        Integer integer(String key, String label, int min, int max) {
            String v = text(key, 40);
            if (v == null) {
                return null;
            }
            // Nhận cả số kèm chữ ("3 tầng", "40 chỗ", "35 HS", "Năm 2015") và dấu nghìn ("1.200").
            Matcher m = NUMBER_WITH_WORDS.matcher(v.strip());
            String s = m.matches() ? m.group(1) : v;
            s = s.matches("\\d+[.,]0+") ? s.replaceAll("[.,]0+$", "") : s;
            s = s.matches("\\d{1,3}([.,]\\d{3})+") ? s.replaceAll("[.,]", "") : s;
            if (!s.matches("-?\\d{1,9}")) {
                error(key, label + " phải là một số nguyên: \"" + v + "\"");
                return null;
            }
            int n = Integer.parseInt(s);
            if (n < min || n > max) {
                error(key, label + " phải từ " + min + " đến " + max);
                return null;
            }
            return n;
        }

        BigDecimal number(String key, String label) {
            String v = text(key, 40);
            if (v == null) {
                return null;
            }
            ParsedNumber p = parseNumber(v);
            if (p == null) {
                error(key, label + " không phải số: \"" + v + "\"");
                return null;
            }
            if (p.value().signum() < 0) {
                error(key, label + " không được âm");
                return null;
            }
            if (p.droppedWords() != null) {
                warn(key, "Đọc là " + p.value().stripTrailingZeros().toPlainString() + " — bỏ phần chữ \""
                        + p.droppedWords() + "\"");
            }
            return p.value();
        }

        LocalDate date(String key, String label) {
            String v = text(key, 40);
            if (v == null) {
                return null;
            }
            // Chỉ có năm ("2019") hay tháng/năm ("03/2019") → ngày đầu tiên, có cảnh báo.
            if (v.matches("(19|20)\\d{2}")) {
                warn(key, "Chỉ có năm — lấy ngày 01/01/" + v);
                return LocalDate.of(Integer.parseInt(v), 1, 1);
            }
            Matcher monthYear = Pattern.compile("(\\d{1,2})[/.-]((?:19|20)\\d{2})").matcher(v);
            if (monthYear.matches() && Integer.parseInt(monthYear.group(1)) >= 1
                    && Integer.parseInt(monthYear.group(1)) <= 12) {
                LocalDate d = LocalDate.of(Integer.parseInt(monthYear.group(2)), Integer.parseInt(monthYear.group(1)), 1);
                warn(key, "Chỉ có tháng/năm — lấy ngày " + d.format(DateTimeFormatter.ofPattern("dd/MM/yyyy")));
                return d;
            }
            if (EXCEL_SERIAL.matcher(v).matches()) {
                return EXCEL_EPOCH.plusDays((long) Double.parseDouble(v));
            }
            // Ngày kèm giờ ("15/03/2019 00:00:00", "2019-03-15T00:00") → bỏ phần giờ.
            String day = v.contains(":") ? v.split("[ T]")[0] : v;
            for (String pattern : List.of("d/M/yyyy", "yyyy-MM-dd", "d-M-yyyy", "d.M.yyyy", "yyyy/M/d")) {
                try {
                    return LocalDate.parse(day, DateTimeFormatter.ofPattern(pattern));
                } catch (DateTimeParseException e) {
                    // thử mẫu tiếp theo
                }
            }
            // Năm hai chữ số: 15/03/19 → 2019; lớn hơn năm nay thì là thế kỷ trước.
            Matcher shortYear = Pattern.compile("(\\d{1,2})[/.-](\\d{1,2})[/.-](\\d{2})").matcher(day);
            if (shortYear.matches()) {
                int yy = Integer.parseInt(shortYear.group(3));
                int year = yy + (2000 + yy > LocalDate.now().getYear() ? 1900 : 2000);
                try {
                    return LocalDate.of(year, Integer.parseInt(shortYear.group(2)), Integer.parseInt(shortYear.group(1)));
                } catch (java.time.DateTimeException e) {
                    // rơi xuống báo lỗi
                }
            }
            error(key, label + " không phải ngày (dd/mm/yyyy): \"" + v + "\"");
            return null;
        }

        Boolean yesNo(String key, String label) {
            String v = text(key, 20);
            if (v == null) {
                return null;
            }
            String f = fold(v).replaceAll("^_|_$", "");
            if (Set.of("CO", "X", "TRUE", "1", "DUNG", "PHAI", "CHINH", "YES", "Y", "LA_CO_SO_CHINH", "CO_SO_CHINH")
                    .contains(f) || v.strip().matches("[✓✔√☑]")) {
                return true;
            }
            if (Set.of("KHONG", "FALSE", "0", "SAI", "NO", "N", "KHONG_PHAI", "PHU", "CO_SO_PHU", "K", "KO")
                    .contains(f)) {
                return false;
            }
            error(key, label + " ghi Có hoặc Không");
            return null;
        }

        <E extends Enum<E>> E choice(String key, String label, E[] values, Function<E, String> labelOf) {
            String v = text(key, 100);
            if (v == null) {
                return null;
            }
            String wanted = fold(v).replaceAll("^_|_$", "");
            for (E e : values) {
                String display = labelOf == null ? null : labelOf.apply(e);
                if (fold(e.name()).equals(wanted) || (display != null && fold(display).equals(wanted))) {
                    return e;
                }
            }
            Map<String, String> synonyms = values.length == 0 ? Map.of()
                    : CHOICE_SYNONYMS.getOrDefault(values[0].getDeclaringClass(), Map.of());
            String target = synonyms.get(wanted);
            for (E e : values) {
                if (e.name().equals(target)) {
                    resolved.put(key, labelOf == null ? e.name() : labelOf.apply(e));
                    return e;
                }
            }
            error(key, label + " không hợp lệ: \"" + v + "\"");
            return null;
        }
    }

    // ------------------------------------------------------------------ dữ liệu tra cứu, nạp một lần mỗi lượt kiểm

    record Catalog(long id, String code, String name, boolean bulk, Long unit, boolean official, Long owner, Long subject,
            String counter) {
    }

    record Unit(Long id, String name, String key, boolean fraction) {
    }

    private final class Context {
        final long schoolId;
        final Map<OnboardingSheet, Map<String, List<Integer>>> batchCodes = new HashMap<>();
        final Map<OnboardingSheet, Map<String, Long>> existing = new HashMap<>();
        final Map<String, Integer> floors = new HashMap<>();
        final Map<String, Long> roomSubjects = new HashMap<>();
        final Map<String, Long> subjects = new HashMap<>();
        final Map<String, Long> grades = new HashMap<>();
        final Map<String, Long> years = new HashMap<>();
        /** Id năm học → cặp năm hiện cho người dùng ("2026-2027"). */
        final Map<Long, String> yearLabels = new HashMap<>();
        final Map<String, Long> roomTypes = new HashMap<>();
        final Map<String, Unit> units = new HashMap<>();
        final Map<Long, Unit> unitsById = new HashMap<>();
        final Map<String, Long> originIds = new HashMap<>();
        final Map<String, Catalog> byCode = new HashMap<>();
        final Map<Long, Catalog> byId = new HashMap<>();
        final Map<String, List<Catalog>> byName = new HashMap<>();
        final Map<String, List<Catalog>> byFormula = new HashMap<>();
        /** Danh mục của Sở ở CẤP HỌC KHÁC, theo tên — chỉ dùng khi cấp của trường không có. */
        final Map<String, List<Catalog>> otherLevelByName = new HashMap<>();
        final Map<String, Long> aliases = new HashMap<>();
        final Map<Long, String> teachingCodes = new HashMap<>();
        /** Bộ đếm mã tài sản MH.LT.NC → số đã cấp của trường. */
        final Map<String, Integer> used = new HashMap<>();
        /** Số serial (đã chuẩn hoá) trong trang Thiết bị của lô → các dòng mang nó. */
        final Map<String, List<Integer>> batchSerials = new HashMap<>();
        /** Khối nhà|tên phòng (chữ thường) trong trang Phòng của lô → các dòng mang nó. */
        final Map<String, List<Integer>> batchRoomNames = new HashMap<>();
        /** Khối nhà|tên phòng của phòng đang dùng của trường → mã phòng. Nạp khi cần. */
        private Map<String, String> roomNames;
        /** Số serial (đã chuẩn hoá) của tài sản còn trên sổ của trường → mã tài sản. Nạp khi cần. */
        private Map<String, String> serials;
        /** Bộ đếm → các dòng của lô sẽ lấy số ở đó (id dòng chờ → số tài sản). */
        final Map<String, Map<Long, Integer>> counters = new LinkedHashMap<>();
        String onlyCampus;

        Context(long schoolId) {
            this.schoolId = schoolId;
            jdbc.query("SELECT id, name, teaching_code FROM subjects WHERE active", rs -> {
                subjects.putIfAbsent(norm(rs.getString("name")), rs.getLong("id"));
                if (rs.getString("teaching_code") != null) {
                    teachingCodes.put(rs.getLong("id"), rs.getString("teaching_code").trim());
                }
            });
            jdbc.query("SELECT code_prefix, current_number FROM equipment_code_sequences WHERE school_id = ?", rs -> {
                // code_prefix = TT.TR.MH.LT.NC — giữ phần MH.LT.NC, cùng khoá với `counters` dưới.
                String[] p = rs.getString("code_prefix").split("\\.");
                if (p.length == 5) {
                    used.put(p[2] + "." + p[3] + "." + p[4], rs.getInt("current_number"));
                }
            }, schoolId);
            jdbc.query("SELECT id, code, name FROM grades", rs -> {
                grades.put(fold(rs.getString("name")), rs.getLong("id"));
                grades.put(fold(rs.getString("code")), rs.getLong("id"));
            });
            // Ghép theo cặp năm "2026-2027" lấy từ TÊN và từ mã — mã do quy tắc sinh mã đặt (vd "NH006"), không phải
            // lúc nào cũng là cặp năm; tệp của trường thì ghi cặp năm.
            jdbc.query("SELECT id, code, name FROM school_years", rs -> {
                long id = rs.getLong("id");
                years.put(upper(rs.getString("code").replaceAll("\\s", "")), id);
                yearLabels.put(id, schoolYearLabel(rs.getString("code"), rs.getString("name")));
                for (String text : new String[] {rs.getString("name"), rs.getString("code")}) {
                    String key = text == null ? null : schoolYearKey(text);
                    if (key != null) {
                        years.putIfAbsent(key, id);
                    }
                }
            });
            // Loại của Sở + loại ngoài danh mục của chính trường này (192).
            jdbc.query("SELECT id, code, name FROM room_types WHERE active AND (school_id IS NULL OR school_id = ?)", rs -> {
                roomTypes.put(fold(rs.getString("name")), rs.getLong("id"));
                roomTypes.put(fold(rs.getString("code")), rs.getLong("id"));
            }, schoolId);
            jdbc.query("SELECT id, code, name, allows_fraction FROM units WHERE active", rs -> {
                Unit u = new Unit(rs.getLong("id"), rs.getString("name"), fold(rs.getString("name")),
                        rs.getBoolean("allows_fraction"));
                units.putIfAbsent(fold(rs.getString("name")), u);
                units.putIfAbsent(fold(rs.getString("code")), u);
                unitsById.put(u.id(), u);
            });
            jdbc.query("SELECT id, code FROM origin_sources", rs -> {
                originIds.put(rs.getString("code"), rs.getLong("id"));
            });
            Long level = jdbc.queryForList("SELECT education_level_id FROM schools WHERE id = ?", Long.class, schoolId)
                    .stream().findFirst().orElse(null);
            jdbc.query("""
                    SELECT c.id, c.code, c.name, c.tracking_type, c.unit_id, c.owner_school_id, c.subject_id, c.physical_or_digital,
                           COALESCE(s.teaching_code, '00') AS teaching_code,
                           (c.education_level_id = ? OR EXISTS (SELECT 1 FROM equipment_catalog_levels l
                                WHERE l.catalog_id = c.id AND l.education_level_id = ?)) AS same_level
                    FROM equipment_catalogs c
                    LEFT JOIN subjects s ON s.id = c.subject_id
                    WHERE c.active AND (c.owner_school_id IS NULL OR c.owner_school_id = ?)
                    """, rs -> {
                Long owner = rs.getObject("owner_school_id", Long.class);
                Catalog c = new Catalog(rs.getLong("id"), rs.getString("code"), rs.getString("name"),
                        "BULK".equals(rs.getString("tracking_type")), rs.getObject("unit_id", Long.class), owner == null,
                        owner, rs.getObject("subject_id", Long.class),
                        rs.getString("teaching_code").trim() + "." + typeCode(rs.getString("physical_or_digital")));
                byCode.put(upper(c.code()), c);
                byId.put(c.id(), c);
                // Ghép theo tên / công thức chỉ trong danh mục CỦA CẤP HỌC trường (cộng thiết bị riêng của trường):
                // định mức đếm theo thiết bị của cấp học, ghép sang cấp khác là tài sản không được tính.
                if (owner == null && !rs.getBoolean("same_level")) {
                    otherLevelByName.computeIfAbsent(norm(c.name()), k -> new ArrayList<>()).add(c);
                }
                if (owner != null || rs.getBoolean("same_level")) {
                    byName.computeIfAbsent(norm(c.name()), k -> new ArrayList<>()).add(c);
                    if (owner == null) {
                        for (String f : new LinkedHashSet<>(formulas(c.name()))) {
                            byFormula.computeIfAbsent(f, k -> new ArrayList<>()).add(c);
                        }
                    }
                }
            }, level, level, schoolId);
            jdbc.query("SELECT alias, catalog_id FROM equipment_catalog_aliases", rs -> {
                aliases.put(upper(rs.getString("alias")), rs.getLong("catalog_id"));
            });
        }

        Map<String, String> serials() {
            if (serials == null) {
                serials = new HashMap<>();
                jdbc.query("SELECT serial_number, code FROM equipment WHERE school_id = ? AND serial_number IS NOT NULL"
                        + " AND status <> 'LOST' ORDER BY code", rs -> {
                    String key = serialKey(rs.getString("serial_number"));
                    if (key != null) {
                        serials.putIfAbsent(key, rs.getString("code"));
                    }
                }, schoolId);
            }
            return serials;
        }

        Map<String, String> roomNames() {
            if (roomNames == null) {
                roomNames = new HashMap<>();
                jdbc.query("""
                        SELECT r.code, r.name, b.code AS building FROM rooms r
                        LEFT JOIN buildings b ON b.id = r.building_id
                        WHERE r.school_id = ? AND r.active AND r.name IS NOT NULL ORDER BY r.code
                        """, rs -> {
                    roomNames.putIfAbsent(roomNameKey(rs.getString("building"), rs.getString("name")),
                            upper(rs.getString("code")));
                }, schoolId);
            }
            return roomNames;
        }

        Map<String, Long> existing(OnboardingSheet sheet) {
            return existing.computeIfAbsent(sheet, s -> {
                Map<String, Long> result = new HashMap<>();
                String table = switch (s) {
                    case CAMPUS -> "campuses";
                    case STAFF -> "staff";
                    case BUILDING -> "buildings";
                    case ROOM -> "rooms";
                    case CLASS, EQUIPMENT -> null;
                };
                if (s == OnboardingSheet.EQUIPMENT) {
                    // Thiết bị không có mã do trường đặt: nhận ra bằng mã cũ (tem, phần mềm cũ) đã lưu khi nhập.
                    jdbc.query("SELECT id, legacy_code FROM equipment WHERE school_id = ? AND legacy_code IS NOT NULL",
                            rs -> {
                                result.putIfAbsent(upper(rs.getString("legacy_code")), rs.getLong("id"));
                            }, schoolId);
                }
                if (table != null) {
                    jdbc.query("SELECT id, code FROM " + table + " WHERE school_id = ?",
                            rs -> {
                                result.put(upper(rs.getString("code")), rs.getLong("id"));
                            }, schoolId);
                } else if (s == OnboardingSheet.CLASS) {
                    jdbc.query("""
                            SELECT c.id, c.code, y.code AS year, y.name AS year_name FROM school_classes c
                            JOIN school_years y ON y.id = c.school_year_id WHERE c.school_id = ?
                            """, rs -> {
                        // Khoá theo cặp năm (từ tên năm học) — tệp ghi "2026-2027", không ghi mã "NH006".
                        result.put(classKey(rs.getString("code"),
                                schoolYearLabel(rs.getString("year"), rs.getString("year_name"))), rs.getLong("id"));
                        result.putIfAbsent(classKey(rs.getString("code"), rs.getString("year")), rs.getLong("id"));
                    }, schoolId);
                }
                if (s == OnboardingSheet.BUILDING) {
                    jdbc.query("SELECT code, floor_count FROM buildings WHERE school_id = ? AND floor_count IS NOT NULL",
                            rs -> {
                                floors.putIfAbsent(upper(rs.getString("code")), rs.getInt("floor_count"));
                            }, schoolId);
                }
                if (s == OnboardingSheet.ROOM) {
                    jdbc.query("SELECT code, subject_id FROM rooms WHERE school_id = ? AND subject_id IS NOT NULL",
                            rs -> {
                                roomSubjects.putIfAbsent(upper(rs.getString("code")), rs.getLong("subject_id"));
                            }, schoolId);
                }
                return result;
            });
        }

        Unit unit(String text) {
            String f = fold(text);
            Unit u = units.get(f);
            if (u == null && UNIT_ALIASES.containsKey(f)) {
                u = units.get(UNIT_ALIASES.get(f));
            }
            return u;
        }
    }

    // ------------------------------------------------------------------ tiện ích

    private static String typeCode(String physicalOrDigital) {
        return "DIGITAL".equals(physicalOrDigital) ? "PM" : "LEARNING_SUPPORT".equals(physicalOrDigital) ? "HL" : "TB";
    }

    static String statusOf(List<Message> messages, String base) {
        if (messages.stream().anyMatch(m -> "error".equals(m.level()))) {
            return ERROR;
        }
        if (EXISTS.equals(base)) {
            return EXISTS;
        }
        return messages.isEmpty() ? OK : WARNING;
    }

    static String text(Map<String, String> data, String key) {
        String v = data.get(key);
        if (v == null) {
            return null;
        }
        v = TextNormalizer.normalize(v.replace(' ', ' ')).replaceAll("\\s{2,}", " ");
        return v.isEmpty() ? null : v;
    }

    /**
     * Khoá một lớp: tên lớp + năm học. Năm học quy về cặp năm ("26-27", "2026 - 2027", "Năm học 2026-2027" đều là
     * "2026-2027") — so nguyên văn thì hai cách ghi cùng một năm bị coi là hai lớp, và lớp đã có (khoá theo năm của hệ
     * thống) không bao giờ khớp.
     */
    static String classKey(Map<String, String> data) {
        String code = text(data, "code");
        return code == null ? null : classKey(code, text(data, "year"));
    }

    static String classKey(String code, String year) {
        String key = year == null ? null : schoolYearKey(year);
        return upper(code) + "|" + (key != null ? key : year == null ? "" : year.replaceAll("\\s", ""));
    }

    /** Khoá so trùng số serial — cùng luật với hồ sơ tài sản. */
    static String serialKey(String serial) {
        return EquipmentService.normalizeSerial(serial);
    }

    static String upper(String s) {
        return s == null ? null : s.trim().toUpperCase(Locale.ROOT);
    }

    /** Tên loại phòng cũ (trước danh mục CSVC 192) → mã loại mới; tệp nhập làm từ mẫu cũ vẫn ghi tên cũ. */
    private static final Map<String, String> LEGACY_ROOM_TYPES = Map.of(
            "PHONG_MAY_TINH", "PHONG_MAY",
            "PHONG_MAY", "PHONG_MAY",
            "KHO_THIET_BI", "KHO",
            "KHO", "KHO",
            "KHAC", "KHAC",
            "PHONG_CHUC_NANG", "PHONG_CHUC_NANG");

    /** "Phòng bộ môn" / "Phòng thí nghiệm" cũ: loại phòng bộ môn theo MÔN của phòng (khoá là {@link #norm} tên môn). */
    private static final Map<String, String> SUBJECT_ROOM_TYPES = Map.ofEntries(
            Map.entry("AM_NHAC", "PHONG_HOC_BO_MON_AM_NHAC"),
            Map.entry("MI_THUAT", "PHONG_HOC_BO_MON_MY_THUAT"),
            Map.entry("KHOA_HOC", "PHONG_HOC_BO_MON_KHOA_HOC_CONG_NGHE"),
            Map.entry("KHOA_HOC_TIEU_HOC", "PHONG_HOC_BO_MON_KHOA_HOC_CONG_NGHE"),
            Map.entry("TIN_HOC", "PHONG_MAY"),
            Map.entry("TIENG_ANH", "PHONG_HOC_BO_MON_NGOAI_NGU"),
            Map.entry("NGOAI_NGU", "PHONG_HOC_BO_MON_NGOAI_NGU"),
            Map.entry("NGOAI_NGU_KHAC", "PHONG_HOC_BO_MON_NGOAI_NGU"),
            Map.entry("CONG_NGHE", "PHONG_HOC_BO_MON_CONG_NGHE"),
            Map.entry("KHOA_HOC_TU_NHIEN", "PHONG_HOC_BO_MON_KHOA_HOC_TU_NHIEN"),
            Map.entry("LICH_SU_VA_DIA_LI", "PHONG_HOC_BO_MON_KHOA_HOC_XA_HOI"),
            Map.entry("KHOA_HOC_XA_HOI", "PHONG_HOC_BO_MON_KHOA_HOC_XA_HOI"),
            Map.entry("VAT_LI", "PHONG_BO_MON_VAT_LY"),
            Map.entry("HOA_HOC", "PHONG_BO_MON_HOA_HOC"),
            Map.entry("SINH_HOC", "PHONG_BO_MON_SINH_HOC"));

    /** Loại phòng ghi theo tên cũ → loại CSVC mới; {@code null} khi không ghép được. */
    private static Long legacyRoomType(Context ctx, String typeText, String subjectText) {
        String folded = fold(typeText);
        String code = LEGACY_ROOM_TYPES.get(folded);
        if (code == null && ("PHONG_BO_MON".equals(folded) || "PHONG_THI_NGHIEM".equals(folded)) && subjectText != null) {
            code = SUBJECT_ROOM_TYPES.get(norm(subjectText));
        }
        return code == null ? null : ctx.roomTypes.get(fold(code));
    }

    static String fold(String s) {
        return ImportValues.fold(s);
    }

    /** Chuẩn hoá tên để so: bỏ dấu, hoa thường, và i/y cuối âm tiết (kỹ/kĩ, lý/lí, Mỹ/Mĩ). */
    static String norm(String s) {
        return fold(s).replaceAll("(?<=[BCDGHKLMNPQRSTVX])Y(?=_|$)", "I").replaceAll("^_|_$", "");
    }

    /** Tên là hoá chất. Bỏ dấu thì "Đầu ghi hình" thành "DAU_…" như "Dầu": chữ Đ ở đầu tên không phải dầu. */
    static boolean chemicalName(String name) {
        String folded = fold(name);
        boolean startsWithD = name.strip().toUpperCase(Locale.ROOT).startsWith("Đ");
        return CHEMICAL_WORDS.matcher(folded).find() && !(folded.startsWith("DAU_") && startsWithD);
    }

    /** Các công thức hoá học trong một tên, chỉ những cái gồm toàn nguyên tố thật và có ít nhất hai nguyên tố. */
    static List<String> formulas(String name) {
        List<String> result = new ArrayList<>();
        Matcher m = FORMULA.matcher(name);
        while (m.find()) {
            String f = m.group(1);
            Matcher e = ELEMENT.matcher(f);
            Set<String> symbols = new HashSet<>();
            boolean real = true;
            while (e.find()) {
                if (!ELEMENTS.contains(e.group())) {
                    real = false;
                }
                symbols.add(e.group());
            }
            // "CKC", "HS", "GV" là chữ viết tắt, không phải chất: toàn chữ hoa không số thì bỏ (trừ KI, CO…).
            boolean acronym = f.matches("[A-Z]{3,}") || f.matches("[A-Z]{2}") && !TWO_LETTER.contains(f);
            if (real && !acronym && (symbols.size() >= 2 || f.matches(".*\\d.*") && symbols.size() >= 1 && f.length() > 2)) {
                result.add(f.replace("·", "."));
            }
        }
        return result;
    }

    private static String join(List<Integer> rows) {
        return String.join(", ", rows.stream().map(String::valueOf).toList());
    }
}
