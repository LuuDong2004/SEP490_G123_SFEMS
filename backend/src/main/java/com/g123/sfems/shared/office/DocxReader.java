package com.g123.sfems.shared.office;

import com.g123.sfems.shared.exception.FieldValidationException;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import javax.xml.stream.XMLInputFactory;
import javax.xml.stream.XMLStreamConstants;
import javax.xml.stream.XMLStreamException;
import javax.xml.stream.XMLStreamReader;

/**
 * Đọc thân một tệp Word .docx thành dãy KHỐI theo đúng thứ tự trong văn bản: đoạn văn và bảng. Bảng được trải
 * thành lưới chữ nhật — ô gộp cột ({@code gridSpan}) chép sang mọi cột nó phủ, ô gộp hàng ({@code vMerge}) chép
 * xuống mọi hàng nó phủ — để người đọc lấy ô theo chỉ số cột như một bảng tính.
 *
 * <p>Tự viết trên StAX như {@link SpreadsheetReader}, cùng các chốt an toàn: kiểm chữ ký zip, trần kích thước sau
 * giải nén, tắt DTD và thực thể ngoài (tệp tải lên là dữ liệu không tin cậy).
 */
public final class DocxReader {

    private static final long MAX_UNCOMPRESSED = 50L * 1024 * 1024;
    private static final int MAX_ROWS = 20_000;
    private static final int MAX_COLUMNS = 60;
    private static final int MAX_CELL = 20_000;
    private static final String W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

    private DocxReader() {
    }

    /** Một khối của thân văn bản. */
    public sealed interface Block permits Paragraph, Table {
    }

    /** Đoạn văn ngoài bảng — chữ đã gộp khoảng trắng. */
    public record Paragraph(String text) implements Block {
    }

    /** Bảng đã trải ô gộp: mỗi hàng cùng số cột; chữ trong ô giữ xuống dòng giữa các đoạn. */
    public record Table(List<List<String>> rows) implements Block {
    }

    public static List<Block> read(byte[] content) {
        return blocks(documentXml(content));
    }

    private static byte[] documentXml(byte[] content) {
        if (content.length < 4 || content[0] != 'P' || content[1] != 'K' || content[2] != 3 || content[3] != 4) {
            throw new FieldValidationException("file", "Tệp không phải Word .docx thật — hãy mở bằng Word, lưu lại dạng .docx rồi tải lên");
        }
        long total = 0;
        try (ZipInputStream zip = new ZipInputStream(new ByteArrayInputStream(content))) {
            ZipEntry entry;
            while ((entry = zip.getNextEntry()) != null) {
                byte[] bytes = zip.readNBytes((int) Math.min(MAX_UNCOMPRESSED - total + 1, Integer.MAX_VALUE - 8));
                total += bytes.length;
                if (total > MAX_UNCOMPRESSED) {
                    throw new FieldValidationException("file", "Tệp quá lớn sau khi giải nén");
                }
                if (entry.getName().equals("word/document.xml")) {
                    return bytes;
                }
            }
        } catch (IOException e) {
            throw new FieldValidationException("file", "Không đọc được tệp Word — tệp hỏng hoặc không phải .docx");
        }
        throw new FieldValidationException("file", "Tệp .docx không có nội dung văn bản (thiếu word/document.xml)");
    }

    /** Một ô đang đọc: chữ, số cột nó phủ, và có phải ô nối tiếp của một ô gộp hàng. */
    private static final class Cell {
        final StringBuilder text = new StringBuilder();
        int span = 1;
        boolean continued;
    }

    private static List<Block> blocks(byte[] xml) {
        List<Block> out = new ArrayList<>();
        try {
            XMLInputFactory f = XMLInputFactory.newFactory();
            f.setProperty(XMLInputFactory.SUPPORT_DTD, false);
            f.setProperty(XMLInputFactory.IS_SUPPORTING_EXTERNAL_ENTITIES, false);
            XMLStreamReader x = f.createXMLStreamReader(new ByteArrayInputStream(xml), "UTF-8");
            int tableDepth = 0;
            StringBuilder para = null;
            List<List<Cell>> rows = null;
            List<Cell> row = null;
            Cell cell = null;
            int gridBefore = 0;
            int totalRows = 0;
            while (x.hasNext()) {
                int ev = x.next();
                if (ev == XMLStreamConstants.START_ELEMENT && W.equals(x.getNamespaceURI())) {
                    switch (x.getLocalName()) {
                        case "tbl" -> {
                            tableDepth++;
                            if (tableDepth == 1) {
                                rows = new ArrayList<>();
                            }
                        }
                        case "tr" -> {
                            if (tableDepth == 1) {
                                row = new ArrayList<>();
                                gridBefore = 0;
                                if (++totalRows > MAX_ROWS) {
                                    throw new FieldValidationException("file", "Tệp có quá nhiều dòng bảng");
                                }
                            }
                        }
                        case "gridBefore" -> {
                            if (tableDepth == 1 && cell == null) {
                                gridBefore = intVal(x, 0);
                            }
                        }
                        case "tc" -> {
                            if (tableDepth == 1 && row != null) {
                                for (int i = 0; i < gridBefore; i++) {
                                    row.add(new Cell());
                                }
                                gridBefore = 0;
                                cell = new Cell();
                            }
                        }
                        case "gridSpan" -> {
                            if (tableDepth == 1 && cell != null) {
                                cell.span = Math.max(1, Math.min(MAX_COLUMNS, intVal(x, 1)));
                            }
                        }
                        case "vMerge" -> {
                            // <w:vMerge/> (không val) hoặc val="continue" là ô nối tiếp; val="restart" là ô đầu.
                            if (tableDepth == 1 && cell != null) {
                                String v = x.getAttributeValue(W, "val");
                                cell.continued = v == null || v.equals("continue");
                            }
                        }
                        case "p" -> {
                            if (tableDepth == 0) {
                                para = new StringBuilder();
                            }
                        }
                        case "t" -> {
                            String t = x.getElementText();
                            if (cell != null) {
                                if (cell.text.length() < MAX_CELL) {
                                    cell.text.append(t);
                                }
                            } else if (para != null) {
                                para.append(t);
                            }
                        }
                        case "tab" -> append(cell, para, " ");
                        case "br", "cr" -> append(cell, para, "\n");
                        default -> {
                        }
                    }
                } else if (ev == XMLStreamConstants.END_ELEMENT && W.equals(x.getNamespaceURI())) {
                    switch (x.getLocalName()) {
                        case "p" -> {
                            if (tableDepth == 0 && para != null) {
                                String t = squash(para.toString());
                                if (!t.isEmpty()) {
                                    out.add(new Paragraph(t));
                                }
                                para = null;
                            } else if (cell != null) {
                                cell.text.append('\n');
                            }
                        }
                        case "tc" -> {
                            if (tableDepth == 1 && row != null && cell != null) {
                                row.add(cell);
                                cell = null;
                            }
                        }
                        case "tr" -> {
                            if (tableDepth == 1 && rows != null && row != null) {
                                rows.add(row);
                                row = null;
                            }
                        }
                        case "tbl" -> {
                            if (tableDepth == 1 && rows != null) {
                                out.add(new Table(grid(rows)));
                                rows = null;
                            }
                            tableDepth--;
                        }
                        default -> {
                        }
                    }
                }
            }
        } catch (XMLStreamException e) {
            throw new FieldValidationException("file", "Không đọc được nội dung tệp Word");
        }
        return out;
    }

    private static void append(Cell cell, StringBuilder para, String s) {
        if (cell != null) {
            cell.text.append(s);
        } else if (para != null) {
            para.append(s);
        }
    }

    /** Trải ô gộp: cột theo {@code gridSpan}, hàng theo {@code vMerge} (chép chữ của ô ngay trên). */
    private static List<List<String>> grid(List<List<Cell>> rows) {
        List<List<String>> out = new ArrayList<>();
        List<String> above = List.of();
        for (List<Cell> r : rows) {
            List<String> line = new ArrayList<>();
            for (Cell c : r) {
                for (int i = 0; i < c.span && line.size() < MAX_COLUMNS; i++) {
                    int col = line.size();
                    line.add(c.continued && col < above.size() ? above.get(col) : cellText(c.text.toString()));
                }
            }
            out.add(line);
            above = line;
        }
        int width = out.stream().mapToInt(List::size).max().orElse(0);
        for (List<String> line : out) {
            while (line.size() < width) {
                line.add("");
            }
        }
        return out;
    }

    /** Mỗi đoạn trong ô một dòng, khoảng trắng gộp lại, bỏ dòng trống. */
    private static String cellText(String raw) {
        StringBuilder sb = new StringBuilder();
        for (String part : raw.split("\n")) {
            String t = squash(part);
            if (!t.isEmpty()) {
                if (!sb.isEmpty()) {
                    sb.append('\n');
                }
                sb.append(t);
            }
        }
        return sb.toString();
    }

    private static String squash(String s) {
        return s.replace(' ', ' ').replaceAll("\\s+", " ").trim();
    }

    private static int intVal(XMLStreamReader x, int fallback) {
        String v = x.getAttributeValue(W, "val");
        try {
            return v == null ? fallback : Integer.parseInt(v.trim());
        } catch (NumberFormatException e) {
            return fallback;
        }
    }
}
