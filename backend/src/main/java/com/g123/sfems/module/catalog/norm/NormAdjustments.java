package com.g123.sfems.module.catalog.norm;

import com.g123.sfems.domain.catalog.standard.AdjustKind;
import com.g123.sfems.domain.catalog.standard.NormBasis;
import com.g123.sfems.shared.exception.FieldValidationException;
import java.math.BigDecimal;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Luật thuần của điều chỉnh một dòng danh mục tối thiểu (changelog 276) — không chạm CSDL, để kiểm riêng được:
 * <ul>
 *   <li>{@link #checkReduce}: định mức sau giảm phải ÍT HƠN định mức gốc;</li>
 *   <li>{@link #suggest}: đọc câu ghi chú của phụ lục, đoán kiểu điều chỉnh — chỉ là gợi ý, form có nút "Dùng gợi ý",
 *       không tự áp.</li>
 * </ul>
 */
public final class NormAdjustments {

    /** Gợi ý từ ghi chú. {@code kind == null}: ghi chú không có câu điều chỉnh nào nhận ra được. */
    public record Suggestion(AdjustKind kind, BigDecimal quantity, NormBasis basis, Integer basisSize, String condition,
            String substituteText, Boolean substituteRequired, String group, Integer groupPick, String basisText) {

        static final Suggestion NONE = new Suggestion(null, null, null, null, null, null, null, null, null, null);
    }

    /**
     * Độ "lớn" của đối tượng tính: một học sinh < một lớp / một giáo viên / một phòng < cả trường. Đổi sang đối tượng
     * lớn hơn với số không nhiều hơn là giảm; đổi ngang (lớp → giáo viên) không so được.
     */
    private static final Map<NormBasis, Integer> RANK = Map.of(
            NormBasis.PER_STUDENT, 0,
            NormBasis.PER_ROOM_STUDENT, 0,
            NormBasis.PER_CLASS, 1,
            NormBasis.PER_TEACHER, 1,
            NormBasis.PER_ROOM, 1,
            NormBasis.PER_SCHOOL, 2);

    private static final Map<NormBasis, String> PER = Map.of(
            NormBasis.PER_STUDENT, "học sinh",
            NormBasis.PER_ROOM_STUDENT, "học sinh trong phòng bộ môn",
            NormBasis.PER_CLASS, "lớp",
            NormBasis.PER_TEACHER, "giáo viên",
            NormBasis.PER_ROOM, "phòng bộ môn",
            NormBasis.PER_SCHOOL, "trường");

    /** "01 bộ/02HS", "1 bộ/2 HS", "01/2HS", "01 bộ/ lớp", "01 cái/5 lớp". */
    private static final Pattern RATIO = Pattern.compile(
            "(\\d+)\\s*(?:[\\p{L}]+\\s*)?/\\s*(\\d+)?\\s*(HS|học sinh|lớp|GV|giáo viên|phòng|trường)",
            Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);

    private static final Pattern NOT_READY = Pattern.compile("chưa có điều kiện",
            Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);

    private static final Pattern IT = Pattern.compile("chưa có điều kiện (?:sử dụng|ứng dụng|dùng) (?:CNTT|công nghệ thông tin)",
            Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);

    private static final Pattern REPLACE = Pattern.compile("thay (?:thế )?bằng\\s+([^.;\\n]+)",
            Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);

    private static final Pattern SHARED = Pattern.compile("(?:dùng|sử dụng) chung",
            Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);

    private static final Pattern CHOOSE = Pattern.compile("(?:lựa )?chọn\\s+0*(\\d+)\\s+trong\\s+0*(\\d+)\\s*([^.;,()\\n]*)",
            Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);

    private NormAdjustments() {
    }

    /**
     * Định mức sau giảm ({@code quantity} / {@code size} {@code basis}) phải ít hơn định mức gốc. Cùng đối tượng thì so
     * tỉ lệ (1 bộ / 2 HS &lt; 1 bộ / 1 HS); đối tượng lớn hơn (lớp → trường) thì số không được nhiều hơn; đổi ngang không
     * nhận.
     */
    public static void checkReduce(BigDecimal baseQuantity, NormBasis baseBasis, Integer baseSize,
            BigDecimal quantity, NormBasis basis, Integer size) {
        if (baseQuantity == null) {
            throw new FieldValidationException("adjustment.kind", "Dòng chưa ghi số lượng cần có — không giảm được");
        }
        if (quantity == null || quantity.signum() <= 0) {
            throw new FieldValidationException("adjustment.quantity", "Nhập số còn lại");
        }
        if (basis == null) {
            throw new FieldValidationException("adjustment.basis", "Chọn đối tượng");
        }
        if (size == null || size < 1) {
            throw new FieldValidationException("adjustment.basisSize", "Nhập số đối tượng");
        }
        NormBasis from = baseBasis == null ? NormBasis.PER_SCHOOL : baseBasis;
        int fromSize = baseSize == null || baseSize < 1 ? 1 : baseSize;
        String original = baseQuantity.stripTrailingZeros().toPlainString() + " / " + fromSize + " " + PER.get(from);
        if (basis == from) {
            // q / size < Q / fromSize  ⇔  q × fromSize < Q × size
            if (quantity.multiply(BigDecimal.valueOf(fromSize)).compareTo(baseQuantity.multiply(BigDecimal.valueOf(size))) >= 0) {
                throw new FieldValidationException("adjustment.quantity", "Phải ít hơn định mức gốc (" + original + ")");
            }
            return;
        }
        if (RANK.get(basis) <= RANK.get(from)) {
            throw new FieldValidationException("adjustment.basis",
                    "Chọn " + PER.get(from) + " như định mức gốc, hoặc đối tượng lớn hơn");
        }
        if (quantity.compareTo(baseQuantity) > 0) {
            throw new FieldValidationException("adjustment.quantity", "Phải ít hơn định mức gốc (" + original + ")");
        }
    }

    /** Đọc câu ghi chú của phụ lục, đoán kiểu điều chỉnh. Không nhận ra thì {@link Suggestion#NONE}. */
    public static Suggestion suggest(String note) {
        if (note == null || note.isBlank()) {
            return Suggestion.NONE;
        }
        String text = note.replaceAll("\\s+", " ").trim();
        Matcher notReady = NOT_READY.matcher(text);
        if (notReady.find()) {
            Matcher ratio = RATIO.matcher(text);
            if (ratio.find(notReady.end())) {
                return new Suggestion(AdjustKind.REDUCE, new BigDecimal(ratio.group(1)).stripTrailingZeros(),
                        basisOf(ratio.group(3)), ratio.group(2) == null ? 1 : Integer.valueOf(ratio.group(2)),
                        conditionOf(text, notReady), null, null, null, null, text);
            }
        }
        Matcher choose = CHOOSE.matcher(text);
        if (choose.find()) {
            int pick = Integer.parseInt(choose.group(1));
            String rest = choose.group(3).trim();
            return new Suggestion(AdjustKind.CHOOSE_IN_GROUP, null, null, null, null, null, null,
                    rest.isEmpty() ? null : capitalize(rest), pick, text);
        }
        if (IT.matcher(text).find()) {
            return new Suggestion(AdjustKind.SUBSTITUTE, null, null, null, null, "CNTT / bài giảng điện tử", true,
                    null, null, text);
        }
        Matcher replace = REPLACE.matcher(text);
        if (replace.find()) {
            String by = replace.group(1).trim().replaceAll("[,:)]+$", "").trim();
            return new Suggestion(AdjustKind.SUBSTITUTE, null, null, null, null, capitalize(by), true, null, null, text);
        }
        if (SHARED.matcher(text).find()) {
            return new Suggestion(AdjustKind.SHARED, null, null, null, null, null, null, null, null, text);
        }
        return Suggestion.NONE;
    }

    /** "Nơi chưa có điều kiện có thể sử dụng …" → "Nơi chưa có điều kiện". */
    private static String conditionOf(String text, Matcher notReady) {
        int start = Math.max(Math.max(text.lastIndexOf('.', notReady.start()), text.lastIndexOf(';', notReady.start())),
                text.lastIndexOf(',', notReady.start())) + 1;
        String head = text.substring(start, notReady.end()).trim();
        return capitalize(head.isEmpty() ? "Nơi chưa có điều kiện" : head);
    }

    private static NormBasis basisOf(String unit) {
        String u = unit.toLowerCase(Locale.ROOT);
        if (u.equals("hs") || u.equals("học sinh")) {
            return NormBasis.PER_STUDENT;
        }
        if (u.equals("gv") || u.equals("giáo viên")) {
            return NormBasis.PER_TEACHER;
        }
        if (u.equals("lớp")) {
            return NormBasis.PER_CLASS;
        }
        if (u.equals("phòng")) {
            return NormBasis.PER_ROOM;
        }
        return NormBasis.PER_SCHOOL;
    }

    private static String capitalize(String s) {
        return s.isEmpty() ? s : s.substring(0, 1).toUpperCase(Locale.ROOT) + s.substring(1);
    }
}
