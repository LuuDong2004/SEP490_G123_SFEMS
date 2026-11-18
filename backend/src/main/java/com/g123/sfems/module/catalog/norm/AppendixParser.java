package com.g123.sfems.module.catalog.norm;

import com.g123.sfems.domain.catalog.standard.NormBasis;
import com.g123.sfems.shared.office.DocxReader;
import java.math.BigDecimal;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeSet;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Đọc PHỤ LỤC danh mục thiết bị dạy học tối thiểu (thông tư 37 / 38 / 39 và văn bản hợp nhất) từ dãy khối của một
 * tệp Word thành các dòng đã HỆ THỐNG HOÁ: số lượng, tính theo, cỡ nhóm, khối lớp, tự chọn — cạnh nguyên văn.
 *
 * <p>Cùng cách hiểu với bộ sinh {@code backend/tools/tbdh_toi_thieu.py} (đã kiểm trên 1.777 dòng thật), thêm một
 * chỗ bộ sinh bỏ sót: câu "Danh mục thiết bị được tính cho 01 phòng học bộ môn" nằm ở GHI CHÚ CUỐI BẢNG (THPT:
 * Vật lý, Hoá học, Sinh học, Công nghệ, Tin học, Mĩ thuật), không chỉ ở dòng ngay trên bảng (THCS). Thiếu nó, mọi
 * dòng chỉ ghi một con số ("07") bị hiểu là "cả trường".
 *
 * <p>Không đoán: số lượng không đọc được thì để trống phần hiểu (dòng hiện "Chưa có số lượng" để người sửa).
 */
final class AppendixParser {

    private AppendixParser() {
    }

    /** Một bảng phụ lục đã đọc: môn (khoá bí danh), có tính theo phòng bộ môn không, và lý do. */
    record Section(int index, String heading, String subjectKey, boolean perRoom, String perRoomSource, int rows) {
    }

    /** Một dòng phụ lục đã hệ thống hoá. {@code subjectKey} là khoá trong {@link #SUBJECTS}. */
    record Row(int section, String subjectKey, String itemNo, String sectionName, String topic, String name,
            String purpose, String description, boolean forTeacher, boolean forStudent, boolean optional,
            String unitText, String quantityText, BigDecimal minQuantity, NormBasis normBasis, Integer basisSize,
            String gradeLevels, String note) {
    }

    record Result(List<Section> sections, List<Row> rows) {
    }

    /** Tiêu đề phụ lục (không dấu) → khoá môn. Thứ tự quan trọng: "khoa hoc tu nhien" trước "khoa hoc". */
    static final List<String[]> SUBJECTS = List.of(
            new String[] {"tieng viet", "TIENG_VIET"}, new String[] {"ngu van", "NGU_VAN"},
            new String[] {"toan", "TOAN"}, new String[] {"ngoai ngu", "TIENG_ANH"},
            new String[] {"dao duc", "DAO_DUC"}, new String[] {"tu nhien va xa hoi", "TU_NHIEN_XA_HOI"},
            new String[] {"khoa hoc tu nhien", "KHTN"}, new String[] {"lich su va dia li", "LS_DL"},
            new String[] {"lich su va dia ly", "LS_DL"}, new String[] {"lich su", "LICH_SU"},
            new String[] {"dia ly", "DIA_LY"}, new String[] {"dia li", "DIA_LY"},
            new String[] {"khoa hoc", "KHOA_HOC"}, new String[] {"tin hoc", "TIN_HOC"},
            new String[] {"cong nghe", "CONG_NGHE"}, new String[] {"giao duc the chat", "THE_DUC"},
            new String[] {"am nhac", "AM_NHAC"}, new String[] {"mi thuat", "MY_THUAT"},
            new String[] {"my thuat", "MY_THUAT"}, new String[] {"hoat dong trai nghiem", "HD_TRAI_NGHIEM"},
            new String[] {"giao duc cong dan", "GDCD"}, new String[] {"kinh te - phap luat", "GDKT_PL"},
            new String[] {"kinh te va phap luat", "GDKT_PL"}, new String[] {"vat ly", "VAT_LY"},
            new String[] {"vat li", "VAT_LY"}, new String[] {"hoa hoc", "HOA_HOC"},
            new String[] {"sinh hoc", "SINH_HOC"}, new String[] {"thiet bi dung chung", "CHUNG"});

    /** Khoá môn → tên môn trong danh mục Môn học (không dấu) — để tra id. */
    static final Map<String, String> SUBJECT_NAMES = Map.ofEntries(
            Map.entry("TIENG_VIET", "tieng viet"), Map.entry("NGU_VAN", "ngu van"), Map.entry("TOAN", "toan"),
            Map.entry("TIENG_ANH", "tieng anh"), Map.entry("DAO_DUC", "dao duc"),
            Map.entry("TU_NHIEN_XA_HOI", "tu nhien va xa hoi (tieu hoc)"), Map.entry("KHTN", "khoa hoc tu nhien"),
            Map.entry("LS_DL", "lich su va dia li"), Map.entry("LICH_SU", "lich su"), Map.entry("DIA_LY", "dia ly"),
            Map.entry("KHOA_HOC", "khoa hoc (tieu hoc)"), Map.entry("TIN_HOC", "tin hoc"),
            Map.entry("CONG_NGHE", "cong nghe"), Map.entry("THE_DUC", "giao duc the chat"),
            Map.entry("AM_NHAC", "am nhac"), Map.entry("MY_THUAT", "my thuat"),
            Map.entry("HD_TRAI_NGHIEM", "hoat dong trai nghiem"), Map.entry("GDCD", "giao duc cong dan"),
            Map.entry("GDKT_PL", "giao duc kinh te va phap luat"), Map.entry("VAT_LY", "vat ly"),
            Map.entry("HOA_HOC", "hoa hoc"), Map.entry("SINH_HOC", "sinh hoc"), Map.entry("CHUNG", "dung chung"));

    private static final Map<String, int[]> GRADES = Map.of(
            "TH", new int[] {1, 2, 3, 4, 5}, "THCS", new int[] {6, 7, 8, 9}, "THPT", new int[] {10, 11, 12});
    private static final Pattern ROMAN = Pattern.compile(
            "^(I|II|III|IV|V|VI|VII|VIII|IX|X|XI|XII|XIII|XIV|XV|XVI|XVII|XVIII|XIX|XX)\\.?$");
    private static final Pattern LETTER = Pattern.compile("^[A-ZĐ]\\.?$");
    private static final Pattern QTY = Pattern.compile(
            "^(\\d+(?:,\\d+)?)(?:den\\d+)?(?:to|bo|tep|chiec|bo\\(hoacchiec\\))?(?:/(.*))?$");
    /** "(Danh mục tính cho 01 phòng học bộ môn)", "Thiết bị được tính cho 01 phòng học bộ môn". */
    private static final Pattern PER_ROOM_NOTE = Pattern.compile("tinh cho (0?1|mot) phong hoc bo mon");
    private static final int BEFORE = 8;
    private static final int AFTER = 20;

    static Result parse(List<DocxReader.Block> blocks, String level) {
        List<Section> sections = new ArrayList<>();
        List<Raw> raws = new ArrayList<>();
        String subject = null;
        String part = null;
        int lastTable = -1;
        for (int bi = 0; bi < blocks.size(); bi++) {
            if (!(blocks.get(bi) instanceof DocxReader.Table table) || table.rows().size() < 3) {
                continue;
            }
            Map<String, Integer> m = colmap(table.rows().get(0));
            if (!m.containsKey("name")) {
                continue;
            }
            // Đoạn văn ngay trên bảng (từ sau bảng trước, tối đa BEFORE đoạn) và ghi chú ngay sau bảng.
            List<String> heads = paragraphs(blocks, Math.max(lastTable + 1, bi - BEFORE), bi);
            List<String> after = notesAfter(blocks, bi + 1);
            lastTable = bi;
            for (int k = 0; k < heads.size(); k++) {
                String h = heads.get(k);
                if (fold(h).contains("thiet bi day hoc toi thieu cap")) {
                    // Tiêu đề có khi xuống dòng giữa chừng: "…CẤP TRUNG HỌC PHỔ THÔNG -" / "MÔN NGỮ VĂN".
                    subject = subjectOf(h, null) == null && k + 1 < heads.size() ? h + " " + heads.get(k + 1) : h;
                    part = null;
                }
            }
            boolean perRoom = false;
            String perRoomSource = null;
            for (String h : heads) {
                String fh = fold(h);
                // Câu dẫn "Căn cứ vào điều kiện… trang bị cho giáo viên… hoặc lắp đặt trong phòng học bộ môn" thì
                // không: thiết bị lựa chọn 1 dành cho giáo viên, "01" là của trường.
                if (fh.contains("phong hoc bo mon") && (fh.contains("tinh cho") || fh.contains("trang bi")
                        || fh.contains("lap dat")) && !fh.startsWith("can cu vao")) {
                    perRoom = true;
                    perRoomSource = h;
                }
                if (fh.matches("^(a|b)\\. phan mon.*") || fh.matches("^phan (i|ii)\\b.*")
                        || fh.matches("^(i|ii|iii)\\. (thiet bi|he thong).*")) {
                    part = h;
                }
            }
            String joinedAfter = fold(String.join(" ", after));
            if (!perRoom && PER_ROOM_NOTE.matcher(joinedAfter).find()) {
                perRoom = true;
                perRoomSource = "Ghi chú cuối bảng: " + excerpt(after);
            }
            if (subject == null) {
                continue;
            }
            int sectionIndex = sections.size();
            int before = raws.size();
            extract(table.rows(), m, sectionIndex, subject, part, perRoom, raws);
            sections.add(new Section(sectionIndex, subjectTitle(subject), subjectOf(subject, part), perRoom,
                    perRoomSource, raws.size() - before));
        }
        return new Result(sections, build(raws, level));
    }

    // ------------------------------------------------------------------ đọc bảng

    /** Một dòng phụ lục chưa hiểu — các ô nguyên văn và ngữ cảnh tiêu đề. */
    private static final class Raw {
        int section;
        String subject;
        String part;
        boolean perRoom;
        String tt;
        String group;
        String sectionHead;
        String topicHead;
        String topic;
        String name;
        String purpose;
        String desc;
        boolean gv;
        boolean hs;
        String unit;
        String qty;
        final List<String> notes = new ArrayList<>();
    }

    private static void extract(List<List<String>> g, Map<String, Integer> m, int section, String subject,
            String part, boolean perRoom, List<Raw> out) {
        List<String> sub = g.get(1);
        Integer gv = null;
        Integer hs = null;
        for (int i = 0; i < sub.size(); i++) {
            String f = fold(sub.get(i));
            if (f.equals("gv") && gv == null) {
                gv = i;
            } else if (f.equals("hs") && hs == null) {
                hs = i;
            }
        }
        String letter = null;
        String roman = null;
        String num = null;
        Raw prev = null;
        for (int r = gv != null ? 2 : 1; r < g.size(); r++) {
            List<String> line = g.get(r);
            String tt = get(line, m, "tt").trim();
            String name = get(line, m, "name");
            String unit = get(line, m, "unit");
            String qty = get(line, m, "qty");
            Integer ttCol = m.get("tt");
            java.util.Set<String> distinct = new java.util.LinkedHashSet<>();
            for (int i = 0; i < line.size(); i++) {
                if ((ttCol == null || i != ttCol) && !line.get(i).isEmpty()) {
                    distinct.add(line.get(i));
                }
            }
            boolean heading = distinct.size() == 1 || (name.isEmpty() && unit.isEmpty() && qty.isEmpty())
                    || (!name.isEmpty() && name.equals(unit) && unit.equals(qty))
                    || (!name.isEmpty() && unit.isEmpty() && qty.isEmpty() && get(line, m, "purpose").isEmpty()
                            && get(line, m, "desc").isEmpty());
            if (heading) {
                String text = distinct.isEmpty() ? "" : distinct.iterator().next();
                if (text.isEmpty()) {
                    continue;
                }
                if (ROMAN.matcher(tt).matches()) {
                    roman = text;
                    num = null;
                } else if (LETTER.matcher(tt).matches()) {
                    letter = text;
                    roman = null;
                    num = null;
                } else {
                    num = text;
                }
                continue;
            }
            if (name.isEmpty()) {
                continue;
            }
            String purpose = get(line, m, "purpose");
            // Một thiết bị nhiều thành phần chiếm nhiều hàng cùng TT + tên: gộp lại, nối mô tả.
            if (prev != null && prev.section == section && prev.tt.equals(tt) && prev.name.equals(name)
                    && prev.purpose.equals(purpose)) {
                String d = get(line, m, "desc");
                if (!d.isEmpty() && !prev.desc.contains(d)) {
                    prev.desc = (prev.desc + "\n" + d).trim();
                }
                if (prev.unit.isEmpty() && !unit.isEmpty()) {
                    prev.unit = unit;
                }
                if (prev.qty.isEmpty() && !qty.isEmpty()) {
                    prev.qty = qty;
                }
                String note = get(line, m, "note");
                if (!note.isEmpty() && !prev.notes.contains(note)) {
                    prev.notes.add(note);
                }
                continue;
            }
            Raw x = new Raw();
            x.section = section;
            x.subject = subject;
            x.part = part;
            x.perRoom = perRoom;
            x.tt = tt;
            x.group = letter;
            x.sectionHead = roman;
            x.topicHead = num;
            String topic = get(line, m, "topic");
            x.topic = topic.equals(name) ? "" : topic;
            x.name = name;
            x.purpose = purpose;
            x.desc = get(line, m, "desc");
            x.gv = gv != null && gv < line.size() && line.get(gv).trim().equalsIgnoreCase("x");
            x.hs = hs != null && hs < line.size() && line.get(hs).trim().equalsIgnoreCase("x");
            x.unit = unit;
            x.qty = qty;
            String note = get(line, m, "note");
            if (!note.isEmpty()) {
                x.notes.add(note);
            }
            out.add(x);
            prev = x;
        }
    }

    // ------------------------------------------------------------------ hiểu từng dòng

    private static List<Row> build(List<Raw> raws, String level) {
        List<Row> rows = new ArrayList<>();
        Map<String, String> parentQty = new HashMap<>();
        for (Raw r : raws) {
            String subjectKey = subjectOf(r.subject, r.part);
            String unitRaw = r.unit.replace("\n", " ");
            String qtyRaw = r.qty.replace("\n", " ");
            // Thiết bị con (8.1, 8.2…) không ghi số lượng thì theo dòng cha (8) cùng bảng.
            if (!r.tt.isEmpty()) {
                parentQty.put(r.section + "|" + r.tt, qtyRaw);
            }
            if (qtyRaw.isEmpty() && r.tt.contains(".")) {
                qtyRaw = parentQty.getOrDefault(r.section + "|" + r.tt.substring(0, r.tt.lastIndexOf('.')), "");
            }
            boolean perRoom = r.perRoom || containsRoom(r.group) || containsRoom(r.sectionHead);
            Quantity q = parseQty(qtyRaw, perRoom);
            String name = r.name.replaceAll("\\s+", " ").trim().replaceAll("^[a-zđ][.)]\\s+", "");
            String desc = r.desc;
            if (name.length() > 250) {
                // Cột lệch: ô tên chứa cả mô tả — tên là phần trước "được / gồm / có".
                desc = (name + "\n" + desc).trim();
                name = name.split("\\s(?:được|gồm|có)\\s", 2)[0];
                if (name.length() > 250) {
                    name = name.substring(0, 250);
                }
            }
            String part = r.part;
            // Ngoại ngữ THPT ghi "I. Thiết bị … (lựa chọn 1): …" trong CỘT chủ đề: đó là phương án, không phải chủ đề.
            String topic = (!r.topic.isEmpty() ? r.topic : r.topicHead == null ? "" : r.topicHead).replace("\n", " ");
            Matcher choice = Pattern.compile("lua chon (\\d)").matcher(fold(topic));
            if (topic.matches("^(I|II|III)\\.\\s.*") && choice.find()) {
                if (part == null) {
                    part = topic.split("[:(]", 2)[0].trim() + " (lựa chọn " + choice.group(1) + ")";
                }
                topic = "";
            }
            String partLabel = part == null ? null
                    : part.replaceAll("^(A|B|I|II|III)\\.\\s*", "").replaceAll("(?i)^PHẦN (I|II):\\s*", "");
            String sectionName = java.util.stream.Stream.of(partLabel, r.group, r.sectionHead)
                    .filter(x -> x != null && !x.isBlank()).map(AppendixParser::label)
                    .collect(Collectors.joining(" › "));
            String context = fold(String.join(" ", nz(r.part), nz(part), nz(r.group), nz(r.sectionHead)));
            boolean optional = Pattern.compile("lua chon [23]|tu chon|dinh huong (cong|nong) nghiep")
                    .matcher(context).find();
            List<String> headings = new ArrayList<>();
            headings.add(r.topic);
            headings.add(r.topicHead);
            headings.add(r.sectionHead);
            headings.add(r.group);
            headings.add(part);
            String grades = gradesOf(level, r.notes, headings);
            rows.add(new Row(r.section, subjectKey, trim(r.tt.replaceAll("\\.$", ""), 20), trim(sectionName, 500),
                    trim(topic, 500), name, blank(r.purpose), blank(desc), r.gv, r.hs, optional, trim(unitRaw, 50),
                    trim(qtyRaw, 100), q.min(), q.basis(), q.size(), grades,
                    blank(r.notes.stream().map(n -> n.replace("\n", " ")).collect(Collectors.joining("; ")))));
        }
        return rows;
    }

    record Quantity(BigDecimal min, NormBasis basis, Integer size) {
    }

    /** "01/4 đến 6HS" → (1, PER_STUDENT, 6). Không hiểu thì để trống cả ba. */
    static Quantity parseQty(String text, boolean perRoom) {
        String t = fold(text).replace(" ", "");
        Matcher m = QTY.matcher(t);
        if (t.isEmpty() || !m.matches()) {
            return new Quantity(null, null, null);
        }
        BigDecimal qty = new BigDecimal(m.group(1).replace(",", "."));
        String rest = m.group(2);
        if (rest == null) {
            return new Quantity(qty, perRoom ? NormBasis.PER_ROOM : NormBasis.PER_SCHOOL, null);
        }
        if (rest.startsWith("gv")) {
            return new Quantity(qty, NormBasis.PER_TEACHER, null);
        }
        if (rest.equals("phbm")) {
            return new Quantity(qty, NormBasis.PER_ROOM, null);
        }
        if (rest.startsWith("truong") || rest.contains("hocat")) {
            return new Quantity(qty, NormBasis.PER_SCHOOL, null);
        }
        Matcher lop = Pattern.compile("^(\\d+)?lop$").matcher(rest);
        if (lop.matches()) {
            return new Quantity(qty, NormBasis.PER_CLASS, lop.group(1) == null ? null : sizeOrNull(Integer.parseInt(lop.group(1))));
        }
        if (rest.contains("hs") && rest.matches("[0-9a-z/-]*") && rest.matches("(\\d|den|-|hs|/|phbm)*")) {
            // 01/HS · 01/6HS · 01/4 đến 6HS · 01/4HS- 6HS: một bộ cho nhóm đông nhất được phép.
            int size = 0;
            Matcher d = Pattern.compile("\\d+").matcher(rest);
            while (d.find()) {
                size = Math.max(size, Integer.parseInt(d.group()));
            }
            return new Quantity(qty, NormBasis.PER_STUDENT, sizeOrNull(size));
        }
        return new Quantity(null, null, null);
    }

    private static Integer sizeOrNull(int size) {
        return size > 1 ? size : null;
    }

    private static String gradesOf(String level, List<String> notes, List<String> headings) {
        int[] allowed = GRADES.getOrDefault(level, new int[0]);
        for (String text : notes) {
            String f = fold(text);
            if (f.contains("tat ca") && f.contains("lop")) {
                return null;
            }
            int i = f.indexOf("lop");
            if (i >= 0) {
                String found = gradesIn(f.substring(i), allowed);
                if (found != null) {
                    return found;
                }
            }
        }
        for (String h : headings) {
            String f = fold(h);
            int i = f.indexOf("lop ");
            if (i >= 0) {
                String found = gradesIn(f.substring(i), allowed);
                if (found != null) {
                    return found;
                }
            }
        }
        return null;
    }

    private static String gradesIn(String s, int[] allowed) {
        TreeSet<Integer> found = new TreeSet<>();
        Matcher d = Pattern.compile("\\d+").matcher(s);
        while (d.find()) {
            int g = Integer.parseInt(d.group());
            for (int a : allowed) {
                if (a == g) {
                    found.add(g);
                }
            }
        }
        return found.isEmpty() ? null : found.stream().map(String::valueOf).collect(Collectors.joining(","));
    }

    static String subjectOf(String heading, String part) {
        String f = fold(subjectTitle(heading));
        if (f.contains("lich su va dia") && part != null) {
            String fp = fold(part);
            if (fp.contains("lich su")) {
                return "LICH_SU";
            }
            if (fp.contains("dia ly") || fp.contains("dia li")) {
                return "DIA_LY";
            }
        }
        for (String[] s : SUBJECTS) {
            if (f.contains(s[0])) {
                return s[1];
            }
        }
        return null;
    }

    /** "THIẾT BỊ DẠY HỌC TỐI THIỂU CẤP THPT - MÔN HÓA HỌC(Kèm theo …)" → "MÔN HÓA HỌC". */
    static String subjectTitle(String heading) {
        String h = heading.replaceAll("(?i)\\s*\\(Kèm theo.*$", "").trim();
        Matcher m = Pattern.compile("\\s[-–]\\s").matcher(h);
        return m.find() ? h.substring(m.end()).trim() : h;
    }

    // ------------------------------------------------------------------ tiện ích

    private static Map<String, Integer> colmap(List<String> header) {
        Map<String, Integer> m = new LinkedHashMap<>();
        for (int i = 0; i < header.size(); i++) {
            String f = fold(header.get(i));
            if ((f.equals("tt") || f.equals("stt") || f.equals("so tt")) && !m.containsKey("tt")) {
                m.put("tt", i);
            } else if (f.contains("chu de")) {
                m.putIfAbsent("topic", i);
            } else if (f.contains("ten thiet bi")) {
                m.putIfAbsent("name", i);
            } else if (f.contains("muc dich")) {
                m.putIfAbsent("purpose", i);
            } else if (f.contains("mo ta")) {
                m.putIfAbsent("desc", i);
            } else if (f.contains("don vi")) {
                m.putIfAbsent("unit", i);
            } else if (f.contains("so luong")) {
                m.putIfAbsent("qty", i);
            } else if (f.contains("ghi chu")) {
                m.putIfAbsent("note", i);
            }
        }
        return m;
    }

    private static String get(List<String> line, Map<String, Integer> m, String key) {
        Integer i = m.get(key);
        return i != null && i < line.size() ? clean(line.get(i)) : "";
    }

    private static List<String> paragraphs(List<DocxReader.Block> blocks, int from, int to) {
        List<String> out = new ArrayList<>();
        for (int i = from; i < to; i++) {
            if (blocks.get(i) instanceof DocxReader.Paragraph p) {
                out.add(clean(p.text()));
            }
        }
        return out;
    }

    /** Ghi chú ngay sau bảng: các đoạn tới bảng kế tiếp hoặc tới tiêu đề phụ lục kế tiếp. */
    private static List<String> notesAfter(List<DocxReader.Block> blocks, int from) {
        List<String> out = new ArrayList<>();
        for (int i = from; i < blocks.size() && out.size() < AFTER; i++) {
            if (!(blocks.get(i) instanceof DocxReader.Paragraph p)) {
                break;
            }
            String f = fold(p.text());
            if (f.contains("thiet bi day hoc toi thieu cap") || f.startsWith("phu luc")) {
                break;
            }
            out.add(clean(p.text()));
        }
        return out;
    }

    private static boolean containsRoom(String s) {
        String f = fold(s);
        return f.contains("phbm") || f.contains("phong hoc bo mon");
    }

    private static String excerpt(List<String> notes) {
        String s = String.join(" ", notes);
        String f = fold(s);
        Matcher m = PER_ROOM_NOTE.matcher(f);
        if (!m.find()) {
            return trim(s, 160);
        }
        int start = Math.max(0, m.start() - 40);
        return trim(s.substring(start, Math.min(s.length(), m.end() + 10)).trim(), 160);
    }

    /** Hạ chữ IN HOA của tiêu đề nhóm ("THIẾT BỊ DÙNG CHUNG") thành chữ thường, giữ chữ đầu. */
    private static String label(String text) {
        String t = text.replaceAll("\\s+", " ").trim();
        if (!t.equals(t.toUpperCase()) || t.length() < 4) {
            return t;
        }
        String lower = t.toLowerCase();
        return Character.toUpperCase(lower.charAt(0)) + lower.substring(1);
    }

    /** Bỏ dấu, chữ thường, gộp khoảng trắng — "Đ" thành "d". */
    static String fold(String s) {
        if (s == null) {
            return "";
        }
        String n = Normalizer.normalize(s.toLowerCase().replace('đ', 'd'), Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "");
        return n.replaceAll("\\s+", " ").trim();
    }

    /** Bỏ chú thích "[3]" của văn bản hợp nhất, gộp khoảng trắng trong mỗi dòng. */
    private static String clean(String s) {
        if (s == null) {
            return "";
        }
        return s.replaceAll("\\[\\d+]", "").replace(' ', ' ').replaceAll("[ \\t]+", " ").trim();
    }

    private static String nz(String s) {
        return s == null ? "" : s;
    }

    private static String blank(String s) {
        return s == null || s.isBlank() ? null : s;
    }

    private static String trim(String s, int max) {
        if (s == null || s.isBlank()) {
            return null;
        }
        return s.length() <= max ? s : s.substring(0, max);
    }
}
