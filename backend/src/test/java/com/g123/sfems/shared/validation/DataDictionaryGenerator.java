package com.g123.sfems.shared.validation;

import com.g123.sfems.shared.office.XlsxWriter;
import com.g123.sfems.shared.security.PasswordPolicy;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.io.IOException;
import java.lang.annotation.Annotation;
import java.lang.reflect.AnnotatedParameterizedType;
import java.lang.reflect.AnnotatedType;
import java.lang.reflect.Method;
import java.lang.reflect.RecordComponent;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.config.BeanDefinition;
import org.springframework.context.annotation.ClassPathScanningCandidateComponentProvider;
import org.springframework.core.MethodParameter;
import org.springframework.core.ResolvableType;
import org.springframework.core.annotation.AnnotatedElementUtils;
import org.springframework.core.type.filter.AnnotationTypeFilter;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import tools.jackson.databind.SerializationFeature;
import tools.jackson.databind.json.JsonMapper;

/**
 * Sinh TỪ ĐIỂN DỮ LIỆU (HSDT TL4.1.2, TL4.1.14 mục 21 — sản phẩm bàn giao): mỗi bảng, mỗi cột của CSDL kèm kiểu,
 * độ dài, bắt buộc, khoá, và QUY TẮC KIỂM TRA mà API áp khi ghi cột đó (đọc từ annotation trên DTO). Hai dạng:
 * {@code docs/tu-dien-du-lieu/tu-dien-du-lieu.xlsx} (đọc) và {@code .json} (tệp có cấu trúc, cho kết nối / đối soát).
 *
 * <p>Không chạy trong bộ test thường. Chạy khi schema hoặc luật đổi, với CSDL đã migrate:
 * {@code GENERATE_DICTIONARY=1 ./gradlew test --tests '*DataDictionaryGenerator'}
 * (CSDL lấy từ {@code SPRING_DATASOURCE_URL / _USERNAME / _PASSWORD}, mặc định như application.properties).
 *
 * <p>Ghép DTO với bảng theo tên: thành phần {@code fullName} ↔ cột {@code full_name}, record ↔ bảng có nhiều cột
 * trùng tên nhất (ưu tiên bảng mang tên tài nguyên của controller). Cột không có DTO nào ghi là cột máy tự điền.
 */
class DataDictionaryGenerator {

    private static final Path OUT = Path.of("..", "docs", "tu-dien-du-lieu");
    private static final Set<String> SKIP_TABLES = Set.of("databasechangelog", "databasechangeloglock");

    record Col(String table, String column, String type, String nullable, String defaultValue, String key,
               String comment) {
    }

    @Test
    void generate() throws Exception {
        Assumptions.assumeTrue(System.getenv("GENERATE_DICTIONARY") != null, "đặt GENERATE_DICTIONARY=1 để sinh");
        Map<String, List<Col>> tables = readSchema();
        Map<String, Map<String, Rule>> rules = readRules(tables);
        write(tables, rules);
    }

    // ------------------------------------------------------------------ CSDL

    private static Map<String, List<Col>> readSchema() throws SQLException {
        String url = env("SPRING_DATASOURCE_URL", "jdbc:postgresql://localhost:5432/qltb");
        Map<String, List<Col>> tables = new TreeMap<>();
        try (Connection c = DriverManager.getConnection(url, env("SPRING_DATASOURCE_USERNAME", "postgres"),
                env("SPRING_DATASOURCE_PASSWORD", "123"))) {
            Map<String, String> keys = new LinkedHashMap<>();
            try (ResultSet rs = c.createStatement().executeQuery("""
                    SELECT tc.table_name, kcu.column_name, tc.constraint_type,
                           ccu.table_name AS ref_table
                      FROM information_schema.table_constraints tc
                      JOIN information_schema.key_column_usage kcu
                        ON kcu.constraint_name = tc.constraint_name AND kcu.table_schema = tc.table_schema
                      LEFT JOIN information_schema.constraint_column_usage ccu
                        ON tc.constraint_type = 'FOREIGN KEY' AND ccu.constraint_name = tc.constraint_name
                     WHERE tc.table_schema = 'public'
                       AND tc.constraint_type IN ('PRIMARY KEY', 'FOREIGN KEY', 'UNIQUE')
                    """)) {
                while (rs.next()) {
                    String k = rs.getString(1) + "." + rs.getString(2);
                    String label = switch (rs.getString(3)) {
                        case "PRIMARY KEY" -> "Khoá chính";
                        case "FOREIGN KEY" -> "→ " + rs.getString(4);
                        default -> "Duy nhất";
                    };
                    keys.merge(k, label, (a, b) -> a.contains(b) ? a : a + "; " + b);
                }
            }
            try (ResultSet rs = c.createStatement().executeQuery("""
                    SELECT c.table_name, c.column_name, c.data_type, c.character_maximum_length,
                           c.numeric_precision, c.numeric_scale, c.is_nullable, c.column_default,
                           col_description(format('%I', c.table_name)::regclass, c.ordinal_position)
                      FROM information_schema.columns c
                      JOIN information_schema.tables t
                        ON t.table_name = c.table_name AND t.table_schema = c.table_schema AND t.table_type = 'BASE TABLE'
                     WHERE c.table_schema = 'public'
                     ORDER BY c.table_name, c.ordinal_position
                    """)) {
                while (rs.next()) {
                    String table = rs.getString(1);
                    if (SKIP_TABLES.contains(table)) {
                        continue;
                    }
                    String column = rs.getString(2);
                    String type = rs.getString(3);
                    if (rs.getObject(4) != null) {
                        type += "(" + rs.getInt(4) + ")";
                    } else if ("numeric".equals(type) && rs.getObject(5) != null) {
                        type += "(" + rs.getInt(5) + "," + rs.getInt(6) + ")";
                    }
                    String def = rs.getString(8);
                    if (def != null && def.startsWith("nextval")) {
                        def = "tự tăng";
                    }
                    tables.computeIfAbsent(table, t -> new ArrayList<>()).add(new Col(table, column, type,
                            "NO".equals(rs.getString(7)) ? "Có" : "", def == null ? "" : def,
                            keys.getOrDefault(table + "." + column, ""), rs.getString(9) == null ? "" : rs.getString(9)));
                }
            }
        }
        return tables;
    }

    // ------------------------------------------------------------------ luật từ DTO

    record Rule(String label, String rule, Set<String> sources) {
    }

    private static Map<String, Map<String, Rule>> readRules(Map<String, List<Col>> tables) throws ClassNotFoundException {
        Map<String, Set<String>> columnsOf = new LinkedHashMap<>();
        tables.forEach((t, cols) -> columnsOf.put(t, cols.stream().map(Col::column)
                .collect(LinkedHashSet::new, Set::add, Set::addAll)));
        Map<String, Map<String, Rule>> out = new TreeMap<>();
        ClassPathScanningCandidateComponentProvider scanner = new ClassPathScanningCandidateComponentProvider(false);
        scanner.addIncludeFilter(new AnnotationTypeFilter(RestController.class));
        for (BeanDefinition definition : scanner.findCandidateComponents("com.g123.sfems")) {
            Class<?> controller = Class.forName(definition.getBeanClassName());
            RequestMapping mapping = AnnotatedElementUtils.findMergedAnnotation(controller, RequestMapping.class);
            String resource = mapping == null || mapping.value().length == 0 ? ""
                    : mapping.value()[0].replaceFirst("^/api/", "").replaceAll("/.*", "");
            for (Method method : controller.getMethods()) {
                for (int i = 0; i < method.getParameterCount(); i++) {
                    MethodParameter parameter = new MethodParameter(method, i).withContainingClass(controller);
                    if (!parameter.hasParameterAnnotation(RequestBody.class)) {
                        continue;
                    }
                    Class<?> body = ResolvableType.forMethodParameter(parameter).resolve();
                    if (body != null && body.isRecord()) {
                        collect(body, resource, columnsOf, out, new LinkedHashSet<>(),
                                controller.getSimpleName() + "." + method.getName());
                    }
                }
            }
        }
        return out;
    }

    private static void collect(Class<?> record, String resource, Map<String, Set<String>> columnsOf,
            Map<String, Map<String, Rule>> out, Set<Class<?>> seen, String source) {
        if (!seen.add(record)) {
            return;
        }
        String table = bestTable(record, resource, columnsOf);
        for (RecordComponent component : record.getRecordComponents()) {
            Class<?> nested = elementRecord(component);
            if (nested != null) {
                collect(nested, resource, columnsOf, out, seen, source);
                continue;
            }
            String rule = describe(component);
            if (table == null || rule.isEmpty()) {
                continue;
            }
            String column = snake(component.getName());
            if (!columnsOf.get(table).contains(column)) {
                column = column + "_id";
                if (!columnsOf.get(table).contains(column)) {
                    continue;
                }
            }
            String label = label(component);
            out.computeIfAbsent(table, t -> new TreeMap<>()).merge(column,
                    new Rule(label, rule, new LinkedHashSet<>(List.of(source))),
                    (a, b) -> {
                        a.sources().addAll(b.sources());
                        // Bản tạo (có "Bắt buộc") nói đủ hơn bản sửa.
                        return b.rule().length() > a.rule().length() ? new Rule(a.label().isEmpty() ? b.label() : a.label(), b.rule(), a.sources()) : a;
                    });
        }
    }

    private static String bestTable(Class<?> record, String resource, Map<String, Set<String>> columnsOf) {
        List<String> names = new ArrayList<>();
        for (RecordComponent c : record.getRecordComponents()) {
            names.add(snake(c.getName()));
            names.add(snake(c.getName()) + "_id");
        }
        String best = null;
        int bestScore = 1;
        for (Map.Entry<String, Set<String>> e : columnsOf.entrySet()) {
            int score = (int) names.stream().filter(e.getValue()::contains).count();
            boolean preferred = e.getKey().equals(resource);
            if (score > bestScore || (score == bestScore && preferred && score > 1)) {
                best = e.getKey();
                bestScore = score;
            }
        }
        return best;
    }

    private static Class<?> elementRecord(RecordComponent component) {
        if (component.getType().isRecord()) {
            return component.getType();
        }
        AnnotatedType type = component.getAnnotatedType();
        if (Collection.class.isAssignableFrom(component.getType()) && type instanceof AnnotatedParameterizedType p
                && p.getAnnotatedActualTypeArguments()[0].getType() instanceof Class<?> element && element.isRecord()) {
            return element;
        }
        return null;
    }

    private static String label(RecordComponent c) {
        Text text = c.getAnnotation(Text.class);
        Num num = c.getAnnotation(Num.class);
        DateValue date = c.getAnnotation(DateValue.class);
        return text != null ? text.label() : num != null ? num.label() : date != null ? date.label() : "";
    }

    private static String describe(RecordComponent c) {
        List<String> parts = new ArrayList<>();
        for (Annotation a : c.getAnnotations()) {
            switch (a) {
                case NotBlank n -> parts.add("Bắt buộc");
                case NotNull n -> parts.add("Bắt buộc");
                case NotEmpty n -> parts.add("Bắt buộc");
                case Text t -> parts.add(t.value().name() + ": tối đa " + (t.max() > 0 ? t.max() : t.value().max())
                        + " ký tự; " + t.value().patternMessage());
                case Num n -> parts.add(n.value().name() + ": " + n.value().min().toPlainString() + " – "
                        + (n.value().max() == null ? "năm nay + 1" : n.value().max().toPlainString())
                        + (n.value().scale() == 0 ? ", số nguyên" : ", tối đa " + n.value().scale() + " số lẻ"));
                case DateValue d -> parts.add(d.value() == DateRule.PAST_OR_TODAY
                        ? "Ngày: từ 01/01/1950, không sau hôm nay" : "Ngày: 01/01/1950 – 31/12/2100");
                case Size s -> parts.add(s.min() > 0 ? "Độ dài " + s.min() + " – " + s.max() : "Tối đa " + s.max() + " ký tự");
                case Pattern p -> parts.add("Mẫu: " + p.regexp());
                case Min m -> parts.add("≥ " + m.value());
                case Max m -> parts.add("≤ " + m.value());
                case DecimalMin m -> parts.add("≥ " + m.value());
                case DecimalMax m -> parts.add("≤ " + m.value());
                case Positive p -> parts.add("> 0");
                case PositiveOrZero p -> parts.add("≥ 0");
                default -> {
                }
            }
        }
        return String.join("; ", new LinkedHashSet<>(parts));
    }

    private static String snake(String camel) {
        return camel.replaceAll("([a-z0-9])([A-Z])", "$1_$2").toLowerCase(Locale.ROOT);
    }

    // ------------------------------------------------------------------ xuất

    private static void write(Map<String, List<Col>> tables, Map<String, Map<String, Rule>> rules) throws IOException {
        Files.createDirectories(OUT);
        List<Map<String, Object>> overview = new ArrayList<>();
        List<Map<String, Object>> rows = new ArrayList<>();
        Map<String, Object> json = new LinkedHashMap<>();
        int stt = 0;
        for (Map.Entry<String, List<Col>> e : tables.entrySet()) {
            Map<String, Rule> tableRules = rules.getOrDefault(e.getKey(), Map.of());
            Map<String, Object> o = new LinkedHashMap<>();
            o.put("stt", ++stt);
            o.put("table", e.getKey());
            o.put("columns", e.getValue().size());
            o.put("validated", tableRules.size());
            overview.add(o);
            List<Map<String, Object>> jsonCols = new ArrayList<>();
            for (Col c : e.getValue()) {
                Rule r = tableRules.get(c.column());
                Map<String, Object> row = new LinkedHashMap<>();
                row.put("table", c.table());
                row.put("column", c.column());
                row.put("label", r == null ? "" : r.label());
                row.put("type", c.type());
                row.put("notNull", c.nullable());
                row.put("key", c.key());
                row.put("default", c.defaultValue());
                row.put("rule", r == null ? (c.defaultValue().isEmpty() && !c.key().contains("Khoá chính") ? "" : "Máy tự điền") : r.rule());
                row.put("comment", c.comment());
                rows.add(row);
                jsonCols.add(row);
            }
            json.put(e.getKey(), jsonCols);
        }
        List<Map<String, Object>> standard = new ArrayList<>();
        for (FieldRule r : FieldRule.values()) {
            standard.add(Map.of("name", r.name(), "kind", "Chữ", "limit", "Tối đa " + r.max() + " ký tự",
                    "rule", r.patternMessage(), "regex", r.regex()));
        }
        for (NumberRule r : NumberRule.values()) {
            standard.add(Map.of("name", r.name(), "kind", "Số", "limit", r.min().toPlainString() + " – "
                    + (r.max() == null ? "năm nay + 1" : r.max().toPlainString()),
                    "rule", r.scale() == 0 ? "Số nguyên" : "Tối đa " + r.scale() + " chữ số thập phân", "regex", ""));
        }
        for (DateRule r : DateRule.values()) {
            standard.add(Map.of("name", r.name(), "kind", "Ngày", "limit", "01/01/1950 – 31/12/2100",
                    "rule", r == DateRule.PAST_OR_TODAY ? "Không sau hôm nay (giờ Việt Nam)" : "", "regex", ""));
        }
        standard.add(Map.of("name", "PASSWORD", "kind", "Mật khẩu",
                "limit", PasswordPolicy.MIN_LENGTH + " – " + PasswordPolicy.MAX_LENGTH + " ký tự (" + PasswordPolicy.PRIVILEGED_MIN_LENGTH
                        + " với " + String.join(", ", PasswordPolicy.PRIVILEGED_ROLES.stream().sorted().toList()) + ")",
                "rule", "Chữ hoa, chữ thường, chữ số, ký tự đặc biệt; không chứa tên đăng nhập, dãy liên tiếp, từ phổ biến",
                "regex", ""));
        standard.add(Map.of("name", "CHUẨN HOÁ", "kind", "Mọi ô chữ", "limit", "",
                "rule", "Bỏ khoảng trắng hai đầu, Unicode dựng sẵn (NFC), bỏ ký tự vô hình — trước khi kiểm và lưu", "regex", ""));
        standard.add(Map.of("name", "TỆP ĐÍNH KÈM", "kind", "Tệp", "limit", "Tối đa 10 MB",
                "rule", "PDF, ảnh, Word/Excel/PowerPoint/ODF, TXT, CSV, ZIP, XML (hoá đơn điện tử); nội dung phải khớp đuôi tệp", "regex", ""));

        String subtitle = "Sinh tự động ngày " + LocalDate.now() + " từ CSDL và quy tắc kiểm tra của API";
        byte[] xlsx = XlsxWriter.writeAll(List.of(
                new XlsxWriter.Tab("Tong quan", new XlsxWriter.Sheet("Danh mục bảng dữ liệu", subtitle, List.of(
                        new XlsxWriter.Column("stt", "STT", "number"),
                        new XlsxWriter.Column("table", "Bảng", "text"),
                        new XlsxWriter.Column("columns", "Số cột", "number"),
                        new XlsxWriter.Column("validated", "Cột có quy tắc nhập", "number")), overview)),
                new XlsxWriter.Tab("Tu dien", new XlsxWriter.Sheet("Từ điển dữ liệu", subtitle, List.of(
                        new XlsxWriter.Column("table", "Bảng", "text"),
                        new XlsxWriter.Column("column", "Cột", "text"),
                        new XlsxWriter.Column("label", "Tên trên màn hình", "text"),
                        new XlsxWriter.Column("type", "Kiểu dữ liệu", "text"),
                        new XlsxWriter.Column("notNull", "Bắt buộc (CSDL)", "text"),
                        new XlsxWriter.Column("key", "Khoá / tham chiếu", "text"),
                        new XlsxWriter.Column("default", "Mặc định", "text"),
                        new XlsxWriter.Column("rule", "Quy tắc kiểm tra khi nhập", "text"),
                        new XlsxWriter.Column("comment", "Ghi chú", "text")), rows)),
                new XlsxWriter.Tab("Quy tac chuan", new XlsxWriter.Sheet("Bộ quy tắc kiểm tra chuẩn", subtitle, List.of(
                        new XlsxWriter.Column("name", "Kiểu", "text"),
                        new XlsxWriter.Column("kind", "Loại", "text"),
                        new XlsxWriter.Column("limit", "Giới hạn", "text"),
                        new XlsxWriter.Column("rule", "Quy tắc", "text"),
                        new XlsxWriter.Column("regex", "Biểu thức", "text")), standard))));
        Files.write(OUT.resolve("tu-dien-du-lieu.xlsx"), xlsx);
        Map<String, Object> root = new LinkedHashMap<>();
        root.put("generated", LocalDate.now().toString());
        root.put("standardRules", standard);
        root.put("tables", json);
        Files.writeString(OUT.resolve("tu-dien-du-lieu.json"),
                JsonMapper.builder().enable(SerializationFeature.INDENT_OUTPUT).build().writeValueAsString(root),
                StandardCharsets.UTF_8);
    }

    private static String env(String name, String fallback) {
        String v = System.getenv(name);
        return v == null || v.isBlank() ? fallback : v;
    }
}
