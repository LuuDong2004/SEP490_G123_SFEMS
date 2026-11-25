"""Sinh changelog nạp Danh mục thiết bị dạy học tối thiểu (Tiểu học, THCS, THPT).

Chạy:  python backend/tools/tbdh_toi_thieu.py <thư mục tải về>

Nguồn là ba VĂN BẢN HỢP NHẤT của Bộ GD&ĐT — đã gộp sửa đổi của TT 26/2023/TT-BGDĐT vào
thông tư gốc, nên không phải tự áp từng điều sửa đổi:

    02/VBHN-BGDĐT  (TT 37/2021 — Tiểu học)
    03/VBHN-BGDĐT  (TT 38/2021 — Trung học cơ sở)
    06/VBHN-BGDĐT  (TT 39/2021 — Trung học phổ thông)

lấy toàn văn HTML trên caselaw.vn (URL ở SOURCES; vbpl.vn chặn tải tự động). Lần chạy đầu
tải về thư mục đã cho, các lần sau đọc lại bản đã tải.

Mỗi phụ lục là một bảng / môn: TT, Chủ đề dạy học, Tên thiết bị, Mục đích, Mô tả chi tiết,
Đối tượng (GV / HS), Đơn vị, Số lượng, Ghi chú; dòng tiêu đề nhóm (A, I, 1…) xen giữa. Ô gộp
hàng / cột được trải ra trước khi đọc. Một thiết bị nhiều thành phần chiếm nhiều hàng cùng
TT + tên → gộp lại một dòng, nối mô tả.

Ra: src/main/resources/db/changelog/changes/096-tbdh-toi-thieu-data.sql. Mỗi dòng phụ lục
thành MỘT dòng định mức (equipment_norms) gắn với MỘT thiết bị trong Danh mục thiết bị
(equipment_catalogs; cùng cấp + cùng môn + cùng tên thì dùng chung một thiết bị). Số lượng
giữ NGUYÊN VĂN ("01/4 đến 6HS") cạnh phần đã hiểu (số tối thiểu, tính theo gì, cỡ nhóm) —
chỗ nào không hiểu được thì để trống phần hiểu, không đoán.

Sửa cách hiểu ở các bảng / hàm dưới rồi chạy lại; đừng sửa tay tệp SQL sinh ra.
"""
import json
import os
import re
import sys
import unicodedata
import urllib.request

import lxml.html

CACHE = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), ".cache")
OUT = os.path.join(os.path.dirname(__file__), "..", "src", "main", "resources", "db", "changelog",
                   "changes", "096-tbdh-toi-thieu-data.sql")

SOURCES = {
    "TH": ("https://caselaw.vn/van-ban-phap-luat/461158-van-ban-hop-nhat-so-02-vbhn-bgddt-ngay-26-04-2024-"
           "cua-bo-truong-bo-giao-duc-va-dao-tao-hop-nhat-thong-tu-ve-danh-muc-thiet-bi-day-hoc-toi-thieu-cap-tieu-hoc"),
    "THCS": ("https://caselaw.vn/van-ban-phap-luat/461159-van-ban-hop-nhat-so-03-vbhn-bgddt-ngay-26-04-2024-"
             "cua-bo-truong-bo-giao-duc-va-dao-tao-hop-nhat-thong-tu-ve-danh-muc-thiet-bi-day-hoc-toi-thieu-cap-trung-hoc-co-so"),
    "THPT": ("https://caselaw.vn/van-ban-phap-luat/461161-van-ban-hop-nhat-so-06-vbhn-bgddt-ngay-10-06-2024-"
             "cua-bo-truong-bo-giao-duc-va-dao-tao-hop-nhat-thong-tu-ve-danh-muc-thiet-bi-day-hoc-toi-thieu-cap-trung-hoc-pho-thong"),
}
LEGAL = {
    "TH": "TT 37/2021/TT-BGDĐT, sửa đổi bởi TT 26/2023/TT-BGDĐT (02/VBHN-BGDĐT)",
    "THCS": "TT 38/2021/TT-BGDĐT, sửa đổi bởi TT 26/2023/TT-BGDĐT (03/VBHN-BGDĐT)",
    "THPT": "TT 39/2021/TT-BGDĐT, sửa đổi bởi TT 26/2023/TT-BGDĐT (06/VBHN-BGDĐT)",
}
GRADES = {"TH": range(1, 6), "THCS": range(6, 10), "THPT": range(10, 13)}

# Tiêu đề phụ lục (bỏ dấu) → mã môn. Môn mới được tạo ở 095.
SUBJECTS = [
    ("tieng viet", "TIENG_VIET"), ("ngu van", "NGU_VAN"), ("toan", "TOAN"), ("ngoai ngu", "TIENG_ANH"),
    ("dao duc", "DAO_DUC"), ("tu nhien va xa hoi", "TU_NHIEN_XA_HOI"), ("khoa hoc tu nhien", "KHTN"),
    ("lich su va dia li", "LS_DL"), ("lich su va dia ly", "LS_DL"), ("lich su", "LICH_SU"), ("dia ly", "DIA_LY"),
    ("khoa hoc", "KHOA_HOC"), ("tin hoc", "TIN_HOC"), ("cong nghe", "CONG_NGHE"),
    ("giao duc the chat", "THE_DUC"), ("am nhac", "AM_NHAC"), ("mi thuat", "MY_THUAT"),
    ("hoat dong trai nghiem", "HD_TRAI_NGHIEM"), ("giao duc cong dan", "GDCD"),
    ("kinh te - phap luat", "GDKT_PL"), ("vat ly", "VAT_LY"), ("hoa hoc", "HOA_HOC"), ("sinh hoc", "SINH_HOC"),
    ("thiet bi dung chung", "CHUNG"),
]
ABBR = {
    "TIENG_VIET": "TV", "NGU_VAN": "NV", "TOAN": "TOAN", "TIENG_ANH": "NN", "DAO_DUC": "DD",
    "TU_NHIEN_XA_HOI": "TNXH", "KHTN": "KHTN", "LS_DL": "LSDL", "LICH_SU": "LS", "DIA_LY": "DL",
    "KHOA_HOC": "KH", "TIN_HOC": "TIN", "CONG_NGHE": "CN", "THE_DUC": "GDTC", "AM_NHAC": "AN",
    "MY_THUAT": "MT", "HD_TRAI_NGHIEM": "HDTN", "GDCD": "GDCD", "GDKT_PL": "KTPL", "VAT_LY": "VL",
    "HOA_HOC": "HH", "SINH_HOC": "SH", "CHUNG": "DC",
}
SCIENCES = {"KHTN", "VAT_LY", "HOA_HOC", "SINH_HOC", "KHOA_HOC"}

# Đơn vị trong phụ lục (bỏ dấu, bỏ khoảng trắng) → mã danh mục Đơn vị tính. Mã mới tạo ở 095.
UNITS = {
    "bo": "BO", "bo(2tam)": "BO", "bo/chiec": "BO", "to": "TO", "cai": "CAI", "chiec": "CHIEC",
    "g": "G", "gam": "G", "ml": "ML", "lit": "LIT", "kg": "KG", "met": "MET", "m": "MET", "hop": "HOP",
    "cuon": "CUON", "qua": "QUA", "tep": "TEP", "cay": "CAY", "tam": "TAM", "cap": "CAP",
    "hethong": "HE_THONG", "bang": "BANG", "day": "DAY", "doi": "DOI", "ong": "ONG",
}


# ------------------------------------------------------------------ đọc HTML

def fold(s):
    s = unicodedata.normalize("NFD", (s or "").lower()).replace("đ", "d")
    return re.sub(r"\s+", " ", "".join(ch for ch in s if unicodedata.category(ch) != "Mn")).strip()


def clean(s):
    s = re.sub(r"\[\d+\]", "", s or "").replace("\xa0", " ")  # [3] là chú thích của văn bản hợp nhất
    return re.sub(r"\s+", " ", s).strip()


def cell_text(c):
    ps = c.xpath(".//p")
    parts = [clean(p.text_content()) for p in ps] if ps else [clean(c.text_content())]
    return "\n".join(p for p in parts if p)


def grid(table):
    """Bảng → lưới chữ nhật: ô gộp hàng / cột được chép vào mọi ô nó phủ."""
    out, span = [], {}
    for r in table.xpath("./tr|./tbody/tr|./thead/tr"):
        line, col, cells, ci = [], 0, r.xpath("./td|./th"), 0
        while ci < len(cells) or col in span:
            if col in span:
                txt, left = span[col]
                line.append(txt)
                if left <= 1:
                    del span[col]
                else:
                    span[col] = (txt, left - 1)
                col += 1
                continue
            c = cells[ci]
            ci += 1
            txt = cell_text(c)
            cs, rs = int(c.get("colspan", 1) or 1), int(c.get("rowspan", 1) or 1)
            for _ in range(cs):
                line.append(txt)
                if rs > 1:
                    span[col] = (txt, rs - 1)
                col += 1
        out.append(line)
    return out


def colmap(header):
    m = {}
    for i, h in enumerate(header):
        f = fold(h)
        if f in ("tt", "stt", "so tt") and "tt" not in m:
            m["tt"] = i
        elif "chu de" in f:
            m.setdefault("topic", i)
        elif "ten thiet bi" in f:
            m.setdefault("name", i)
        elif "muc dich" in f:
            m.setdefault("purpose", i)
        elif "mo ta" in f:
            m.setdefault("desc", i)
        elif "don vi" in f:
            m.setdefault("unit", i)
        elif "so luong" in f:
            m.setdefault("qty", i)
        elif "ghi chu" in f:
            m.setdefault("note", i)
    return m


ROMAN = re.compile(r"^(I|II|III|IV|V|VI|VII|VIII|IX|X|XI|XII|XIII|XIV|XV|XVI|XVII|XVIII|XIX|XX)\.?$")


def tt_kind(tt):
    tt = tt.strip()
    if ROMAN.match(tt):  # trước chữ cái: "I" là mục La Mã, không phải phần I
        return "roman"
    if re.fullmatch(r"[A-ZĐ]\.?", tt):
        return "letter"
    return "num"


def extract(path):
    doc = lxml.html.parse(path).getroot()
    out, subject, part, per_room = [], None, None, False
    for ti, t in enumerate(doc.xpath("//table")):
        g = grid(t)
        if len(g) < 3:
            continue
        m = colmap(g[0])
        if "name" not in m:
            continue
        heads = [clean(p.text_content()) for p in reversed(t.xpath("preceding::p[normalize-space()][position()<=6]"))]
        for h in heads:
            if "thiet bi day hoc toi thieu cap" in fold(h):
                subject = re.split(r"\s[-–]\s", h, maxsplit=1)[1] if re.search(r"\s[-–]\s", h) else h
                subject = re.sub(r"\s*\(Kèm theo.*$", "", subject, flags=re.I).strip()
                part, per_room = None, False
        for h in heads:
            fh = fold(h)
            # "(Danh mục tính cho 01 phòng học bộ môn)", "(Được trang bị và lắp đặt trong một phòng học bộ
            # môn…)". Câu dẫn "Căn cứ vào điều kiện… trang bị cho giáo viên… hoặc lắp đặt trong phòng học
            # bộ môn" thì không: thiết bị lựa chọn 1 dành cho giáo viên, "01" là của trường.
            if "phong hoc bo mon" in fh and ("tinh cho" in fh or "trang bi" in fh or "lap dat" in fh)                     and not fh.startswith("can cu vao"):
                per_room = True
            if re.match(r"^(a|b)\. phan mon", fh) or re.match(r"^phan (i|ii)", fh) \
                    or re.match(r"^(i|ii|iii)\. (thiet bi|he thong)", fh):
                part = h
        sub = g[1]
        gv = next((i for i, h in enumerate(sub) if fold(h) == "gv"), None)
        hs = next((i for i, h in enumerate(sub) if fold(h) == "hs"), None)
        stack = {"letter": None, "roman": None, "num": None}
        for line in g[2 if gv is not None else 1:]:
            def get(k):
                return line[m[k]] if k in m and m[k] < len(line) else ""
            tt = get("tt").strip()
            name, unit, qty = get("name"), get("unit"), get("qty")
            distinct = {v for i, v in enumerate(line) if i != m.get("tt") and v}
            heading = len(distinct) == 1 or (not name and not unit and not qty) or (name and name == unit == qty) \
                or (name and not unit and not qty and not get("purpose") and not get("desc"))
            if heading:
                text = next(iter(distinct)) if distinct else ""
                if not text:
                    continue
                k = tt_kind(tt)
                if k == "letter":
                    stack = {"letter": text, "roman": None, "num": None}
                elif k == "roman":
                    stack.update(roman=text, num=None)
                else:
                    stack["num"] = text
                continue
            if not name:
                continue
            prev = out[-1] if out else None
            if prev and prev["table"] == ti and prev["tt"] == tt and prev["name"] == name \
                    and prev["purpose"] == get("purpose"):
                d = get("desc")
                if d and d not in prev["desc"]:
                    prev["desc"] = (prev["desc"] + "\n" + d).strip()
                for k in ("unit", "qty"):
                    if not prev[k] and get(k):
                        prev[k] = get(k)
                if get("note") and get("note") not in prev["notes"]:
                    prev["notes"].append(get("note"))
                continue
            topic = get("topic")
            out.append({
                "table": ti, "subject": subject, "part": part, "perRoom": per_room, "tt": tt,
                "group": stack["letter"], "section": stack["roman"], "topicHead": stack["num"],
                "topic": topic if topic != name else "", "name": name, "purpose": get("purpose"),
                "desc": get("desc"),
                "gv": gv is not None and gv < len(line) and line[gv].strip().lower() == "x",
                "hs": hs is not None and hs < len(line) and line[hs].strip().lower() == "x",
                "unit": unit, "qty": qty, "notes": [get("note")] if get("note") else [],
            })
    return out


# ------------------------------------------------------------------ hiểu từng dòng

def subject_of(heading, part):
    f = fold(heading)
    if "lich su va dia" in f and part:
        fp = fold(part)
        if "lich su" in fp:
            return "LICH_SU"
        if "dia ly" in fp or "dia li" in fp:
            return "DIA_LY"
    for key, code in SUBJECTS:
        if key in f:
            return code
    raise SystemExit("Không nhận ra môn: " + heading)


def unit_of(raw):
    return UNITS.get(fold(raw).replace(" ", ""))


def parse_qty(text, per_room):
    """'01/4 đến 6HS' → (1, 'PER_STUDENT', 6). Không hiểu thì (None, None, None)."""
    t = fold(text).replace(" ", "")
    m = re.match(r"^(\d+(?:,\d+)?)(?:den\d+)?(?:to|bo|tep|chiec|bo\(hoacchiec\))?(?:/(.*))?$", t)
    if not m:
        return None, None, None
    qty = float(m.group(1).replace(",", "."))
    rest = m.group(2)
    if rest is None:
        return qty, "PER_ROOM" if per_room else "PER_SCHOOL", None
    if rest.startswith("gv"):
        return qty, "PER_TEACHER", None
    if rest == "phbm":
        return qty, "PER_ROOM", None
    if rest.startswith("truong") or "hocat" in rest:
        return qty, "PER_SCHOOL", None
    mm = re.match(r"^(\d+)?lop$", rest)
    if mm:
        return qty, "PER_CLASS", int(mm.group(1)) if mm.group(1) else None
    if "hs" in rest and re.fullmatch(r"[0-9a-z/-]*", rest) and re.fullmatch(r"(\d|den|-|hs|/|phbm)*", rest):
        # 01/HS · 01/6HS · 01/4 đến 6HS · 01/4HS- 6HS: một bộ cho nhóm đông nhất được phép.
        sizes = [int(x) for x in re.findall(r"\d+", rest)]
        size = max(sizes) if sizes else None
        return qty, "PER_STUDENT", size if size and size > 1 else None
    return None, None, None


def grades_of(level, notes, headings):
    allowed = list(GRADES[level])
    for text in notes:
        f = fold(text)
        if "tat ca" in f and "lop" in f:
            return None
        i = f.find("lop")
        if i >= 0:
            found = [int(x) for x in re.findall(r"\d+", f[i:]) if int(x) in allowed]
            if found:
                return sorted(set(found))
    for h in headings:
        f = fold(h or "")
        i = f.find("lop ")
        if i >= 0:
            found = [int(x) for x in re.findall(r"\d+", f[i:]) if int(x) in allowed]
            if found:
                return sorted(set(found))
    return None


def type_of(r, subject, unit):
    n, ctx = fold(r["name"]), fold(" ".join(x or "" for x in (r["part"], r["group"], r["section"])))
    if unit in ("G", "ML", "LIT", "KG") or fold(r["section"] or "").startswith("hoa chat"):
        return "HOA_CHAT", "PHYSICAL"
    if re.match(r"^(video|phim|phan mem|bo phan mem|hoc lieu dien tu|bo hoc lieu dien tu|bo hoc lieu so)", n) \
            or unit == "TEP" or "video" in ctx:
        return "THIET_BI_CNTT", "DIGITAL"
    if re.match(r"^(may tinh|bo may vi tinh|may chu|thiet bi ket noi|man hinh|may in|may quet|bang tuong tac"
                r"|thiet bi trinh chieu|may chieu vat the)", n):
        return "THIET_BI_CNTT", "PHYSICAL"
    if re.match(r"^(may chieu|ti ?vi|loa|dai|dau d|thiet bi am thanh|micro|tai nghe|camera|may anh|may ghi am"
                r"|dieu hoa|quat)", n):
        return "MAY_MOC_THIET_BI", "PHYSICAL"
    if re.match(r"^(bo )?(tranh|anh|ban do|luoc do|so do|bang so lieu|bieu do)", n) or "tranh" in ctx \
            or "ban do" in ctx or "luoc do" in ctx:
        return "TRANH_ANH_BAN_DO", "PHYSICAL"
    if re.match(r"^(bo )?(mo hinh|mau vat|sa ban|tieu ban)", n) or "mo hinh" in ctx or "mau vat" in ctx:
        return "MO_HINH_MAU_VAT", "PHYSICAL"
    if subject in SCIENCES or "thi nghiem" in ctx or "thi nghiem" in n:
        return "THIET_BI_THI_NGHIEM", "PHYSICAL"
    if re.match(r"^(bo the|the |bo chu|bo mau chu|bang |bo do dung|bo thiet bi day|bo vat lieu|bo hinh)", n):
        return "DO_DUNG_DAY_HOC", "PHYSICAL"
    if "dung cu" in n or subject in ("THE_DUC", "CONG_NGHE", "AM_NHAC", "MY_THUAT"):
        return "DUNG_CU", "PHYSICAL"
    return "THIET_BI_DAY_HOC", "PHYSICAL"


# Tên riêng hay gặp trong tiêu đề phụ lục Lịch sử / Địa lý: hạ chữ IN HOA xong thì viết hoa lại.
PROPER = ["Việt Nam", "Đông Nam Á", "Châu Âu", "Bắc Mỹ", "Tây Âu", "Đông Âu", "Châu Á", "Châu Phi",
          "Mỹ La-tinh", "Mĩ La-tinh", "Trung Quốc", "Ấn Độ", "Nhật Bản", "Liên Xô", "Hy Lạp", "La Mã",
          "Văn Lang", "Âu Lạc", "Champa", "Phù Nam", "Đại Việt", "Tây Sơn", "Lê Sơ", "Hồ Chí Minh",
          "Đông Dương", "Tây Á", "Nam Bộ", "Bắc Bộ", "Trung Bộ", "Tây Nguyên", "Biển Đông"]


def label(text):
    """Tiêu đề nhóm cho màn hình: bỏ chú thích dài trong ngoặc / sau dấu *, chữ IN HOA → chữ thường."""
    t, out, depth, start = clean(text), "", 0, 0
    for i, ch in enumerate(t):  # bỏ nhóm ngoặc ngoài cùng dài (kể cả có ngoặc lồng bên trong)
        if ch == "(":
            if depth == 0:
                start = i
            depth += 1
        elif ch == ")" and depth:
            depth -= 1
            if depth == 0 and i - start < 16:
                out += t[start:i + 1]
        elif depth == 0:
            out += ch
    t = re.sub(r"\s+", " ", out).split(" * ")[0].strip(" -–:*")
    letters = [ch for ch in t if ch.isalpha()]
    if letters and all(ch.isupper() for ch in letters):
        t = t[:1] + t[1:].lower()
        t = re.sub(r"\b[ivxl]+\b", lambda m: m.group(0).upper(), t)  # thế kỉ xvi → XVI
        for name in PROPER:
            t = re.sub(re.escape(name), name, t, flags=re.I)
    return t


def load(level):
    os.makedirs(CACHE, exist_ok=True)
    path = os.path.join(CACHE, f"vbhn-{level.lower()}.html")
    if not os.path.exists(path):
        req = urllib.request.Request(SOURCES[level], headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0 Safari/537.36"})
        with urllib.request.urlopen(req, timeout=120) as resp, open(path, "wb") as f:
            f.write(resp.read())
    return extract(path)


def build():
    rows = []
    for level in ("TH", "THCS", "THPT"):
        catalogs, seq_cat, seq_norm = {}, {}, {}
        parent_qty = {}
        for i, r in enumerate(load(level)):
            subject = subject_of(r["subject"], r["part"])
            unit_raw, qty_raw = r["unit"].replace("\n", " "), r["qty"].replace("\n", " ")
            if not unit_raw and unit_of(qty_raw):  # cột lệch: đơn vị nằm ở ô số lượng
                unit_raw, qty_raw = qty_raw, ""
            # Thiết bị con (8.1, 8.2…) không ghi số lượng thì theo dòng cha (8) cùng bảng.
            if r["tt"]:
                parent_qty[(r["table"], r["tt"])] = qty_raw
            if not qty_raw and "." in r["tt"]:
                qty_raw = parent_qty.get((r["table"], r["tt"].rsplit(".", 1)[0]), "")
            unit = unit_of(unit_raw)
            per_room = r["perRoom"] or any("phbm" in fold(x or "") or "phong hoc bo mon" in fold(x or "")
                                           for x in (r["group"], r["section"]))
            qty, basis, size = parse_qty(qty_raw, per_room)
            type_code, pod = type_of(r, subject, unit)
            name = re.sub(r"\s+", " ", r["name"]).strip()
            name = re.sub(r"^[a-zđ][.)]\s+", "", name)  # "a. Bộ tranh…", "b) …": ký hiệu liệt kê của phụ lục
            if len(name) > 250:  # cột lệch: ô tên chứa cả mô tả — tên là phần trước "được …"
                r["desc"] = (name + "\n" + r["desc"]).strip()
                name = re.split(r"\s(?:được|gồm|có)\s", name, maxsplit=1)[0]
            key = (subject, fold(name))
            abbr = ABBR[subject]
            if key not in catalogs:
                seq_cat[subject] = seq_cat.get(subject, 0) + 1
                catalogs[key] = f"{level}-{abbr}-{seq_cat[subject]:03d}"
            seq_norm[subject] = seq_norm.get(subject, 0) + 1
            # Ngoại ngữ THPT ghi "I. Thiết bị … (lựa chọn 1): …" trong CỘT chủ đề (ô gộp nhiều hàng)
            # thay vì một dòng tiêu đề: đó là phương án, không phải chủ đề dạy học.
            topic = (r["topic"] or r["topicHead"] or "").replace("\n", " ")
            if re.match(r"^(I|II|III)\.\s", topic) and "lua chon" in fold(topic):
                r["part"] = r["part"] or re.split(r"[:(]", topic)[0].strip() + (
                    " (lựa chọn " + re.search(r"lua chon (\d)", fold(topic)).group(1) + ")")
                topic = ""
            part = r["part"]
            if part:
                part = re.sub(r"^(A|B|I|II|III)\.\s*", "", part)
                part = re.sub(r"^PHẦN (I|II):\s*", "", part, flags=re.I)
            section = " › ".join(label(x) for x in (part, r["group"], r["section"]) if x and label(x))
            # Nhóm tự chọn: phương án thay thế nhau, hoặc dụng cụ của môn thể thao trường tự chọn.
            optional = bool(re.search(r"lua chon [23]|tu chon|dinh huong (cong|nong) nghiep",
                                      fold(" ".join(x or "" for x in (r["part"], r["group"], r["section"])))))
            grades = grades_of(level, r["notes"], [r["topic"], r["topicHead"], r["section"], r["group"], r["part"]])
            rows.append({
                "level": level, "subject": subject, "sort": (i + 1) * 10,
                "item_no": r["tt"].rstrip(".")[:20] or None,
                "section": section[:500] or None,
                "topic": topic[:500] or None,
                "name": name, "purpose": r["purpose"] or None, "description": r["desc"] or None,
                "teacher": r["gv"], "student": r["hs"], "optional": optional,
                "unit": unit, "unit_text": unit_raw[:50] or None, "qty_text": qty_raw[:100] or None,
                "qty": qty, "basis": basis, "size": size,
                "grades": ",".join(map(str, grades)) if grades else None,
                "note": "; ".join(n.replace("\n", " ") for n in r["notes"]) or None,
                "type": type_code, "pod": pod,
                "tracking": "BULK" if type_code == "HOA_CHAT" else "SERIAL",
                "category": "CHEMICAL" if type_code == "HOA_CHAT" else None,
                "catalog_code": catalogs[key], "norm_code": f"DM-{level}-{abbr}-{seq_norm[subject]:03d}",
                "legal": LEGAL[level],
            })
    return rows


# ------------------------------------------------------------------ SQL

def lit(v):
    if v is None:
        return "NULL"
    if isinstance(v, bool):
        return "TRUE" if v else "FALSE"
    if isinstance(v, (int, float)):
        return ("%g" % v) if isinstance(v, float) else str(v)
    s = str(v).replace("\\", "\\\\").replace("'", "''").replace("\r", "").replace("\n", "\\n")
    return "E'" + s + "'"


COLS = ["level", "subject", "sort", "item_no", "section", "topic", "name", "purpose", "description",
        "teacher", "student", "optional", "unit", "unit_text", "qty_text", "qty", "basis", "size", "grades", "note",
        "type", "pod", "tracking", "category", "catalog_code", "norm_code", "legal"]


def write_sql(rows):
    lines = [
        "--liquibase formatted sql",
        "",
        "-- SINH TỰ ĐỘNG bởi backend/tools/tbdh_toi_thieu.py — đừng sửa tay, sửa bộ sinh rồi chạy lại.",
        "--",
        "-- Danh mục thiết bị dạy học tối thiểu theo ba văn bản hợp nhất của Bộ GD&ĐT (đã gộp sửa đổi",
        "-- của TT 26/2023): 02/VBHN-BGDĐT (TT 37/2021, Tiểu học), 03/VBHN-BGDĐT (TT 38/2021, THCS),",
        f"-- 06/VBHN-BGDĐT (TT 39/2021, THPT). {len(rows)} dòng phụ lục.",
        "--",
        "-- Mỗi dòng phụ lục → một dòng định mức của bộ tiêu chuẩn cùng cấp, gắn với một THIẾT BỊ trong",
        "-- Danh mục thiết bị (cùng cấp + môn + tên thì chung một thiết bị), đánh dấu thiết bị tối thiểu",
        "-- và ghi căn cứ. Thiết bị đã có cùng mã thì không thêm lại.",
        "",
        "--changeset qltb:096-tbdh-toi-thieu-data",
        "CREATE TEMP TABLE tbdh_rows (",
        "    level VARCHAR(10), subject VARCHAR(64), sort INTEGER, item_no VARCHAR(20), section VARCHAR(500),",
        "    topic VARCHAR(500), name TEXT, purpose TEXT, description TEXT, teacher BOOLEAN, student BOOLEAN,",
        "    optional BOOLEAN,",
        "    unit VARCHAR(64), unit_text VARCHAR(50), qty_text VARCHAR(100), qty NUMERIC(14,3), basis VARCHAR(20),",
        "    size INTEGER, grades VARCHAR(40), note TEXT, type VARCHAR(64), pod VARCHAR(30), tracking VARCHAR(20),",
        "    category VARCHAR(30), catalog_code VARCHAR(64), norm_code VARCHAR(64), legal VARCHAR(255)",
        ") ON COMMIT DROP;",
    ]
    for i in range(0, len(rows), 100):
        chunk = rows[i:i + 100]
        lines.append("INSERT INTO tbdh_rows VALUES")
        for j, r in enumerate(chunk):
            lines.append("(" + ", ".join(lit(r[c]) for c in COLS) + (");" if j == len(chunk) - 1 else "),"))
    lines += [
        "",
        "-- Môn nào có thiết bị ở cấp nào thì môn đó được dạy ở cấp đó.",
        "INSERT INTO subject_education_levels (subject_id, education_level_id, subject_type, created_at)",
        "SELECT DISTINCT s.id, l.id, 'BAT_BUOC', now()",
        "FROM tbdh_rows r JOIN subjects s ON s.code = r.subject JOIN education_levels l ON l.code = r.level",
        "WHERE r.subject <> 'CHUNG' AND NOT EXISTS (SELECT 1 FROM subject_education_levels x",
        "    WHERE x.subject_id = s.id AND x.education_level_id = l.id);",
        "",
        "-- Thiết bị trong Danh mục thiết bị: dòng đầu tiên của mỗi mã quyết định thuộc tính.",
        "INSERT INTO equipment_catalogs (code, name, sort_order, active, parent_id, equipment_type_id, subject_id,",
        "    education_level_id, grade_id, unit_id, tracking_type, minimum_required, asset_category,",
        "    physical_or_digital, legal_basis, used_by_teacher, used_by_student, description, created_at)",
        "SELECT DISTINCT ON (r.catalog_code) r.catalog_code, left(r.name, 255), r.sort, TRUE, NULL, t.id, s.id, l.id,",
        "       CASE WHEN r.grades ~ '^[0-9]+$' THEN g.id END, u.id, r.tracking, TRUE, r.category, r.pod, r.legal,",
        "       r.teacher, r.student, r.description, now()",
        "FROM tbdh_rows r",
        "JOIN education_levels l ON l.code = r.level",
        "JOIN subjects s ON s.code = r.subject",
        "JOIN equipment_types t ON t.code = r.type",
        "LEFT JOIN units u ON u.code = r.unit",
        "LEFT JOIN grades g ON g.code = 'LOP_' || r.grades",
        "WHERE NOT EXISTS (SELECT 1 FROM equipment_catalogs c WHERE c.code = r.catalog_code)",
        "ORDER BY r.catalog_code, r.sort;",
        "",
        "INSERT INTO equipment_norms (code, name, sort_order, active, note, standard_id, catalog_id, equipment_type_id,",
        "    subject_id, unit_id, min_quantity, norm_basis, basis_size, quantity_text, unit_text, grade_levels,",
        "    item_no, section_name, topic, purpose, description, for_teacher, for_student, optional,",
        "    source_document_id,",
        "    created_at)",
        "SELECT r.norm_code, r.name, r.sort, TRUE, r.note, sd.id, c.id, c.equipment_type_id, c.subject_id,",
        "       c.unit_id, r.qty, COALESCE(r.basis, 'PER_SCHOOL'), r.size, r.qty_text, r.unit_text, r.grades,",
        "       r.item_no, r.section, r.topic, r.purpose, r.description, r.teacher, r.student, r.optional,",
        "       (SELECT d.id FROM equipment_standard_documents d WHERE d.standard_id = sd.id",
        "         ORDER BY (d.document_role = 'REFERENCE') DESC, d.sort_order LIMIT 1),",
        "       now()",
        "FROM tbdh_rows r",
        "JOIN equipment_standards sd ON sd.code = 'STD-' || r.level",
        "JOIN equipment_catalogs c ON c.code = r.catalog_code",
        "WHERE NOT EXISTS (SELECT 1 FROM equipment_norms n WHERE n.code = r.norm_code)",
        "ORDER BY r.sort;",
        "",
    ]
    with open(OUT, "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(lines))


if __name__ == "__main__":
    data = build()
    write_sql(data)
    by = {}
    for r in data:
        by[r["level"]] = by.get(r["level"], 0) + 1
    print("Đã ghi", os.path.relpath(OUT), "—", by, "| không hiểu số lượng:",
          sum(1 for r in data if r["qty"] is None), "| không rõ đơn vị:", sum(1 for r in data if not r["unit"]),
          "| tự chọn:", sum(1 for r in data if r["optional"]))
    if "--json" in sys.argv:
        json.dump(data, open(os.path.join(CACHE, "tbdh.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
