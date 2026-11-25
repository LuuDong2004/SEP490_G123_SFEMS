"""Sinh 2 tệp dữ liệu đầu vào cho THCS Thanh Bình từ tệp mẫu của hệ thống.

python -I gen_data.py <template.xlsx> <thư mục ra> [tên miền email]
  Tên miền mặc định thanhbinh.edu.vn. Chạy kịch bản trên trường khác thì đổi tên miền: email cán bộ là duy nhất
  toàn hệ thống, trùng thì cấp tài khoản báo "Email … đã được dùng".
  -> THCS-Thanh-Binh_1-co-loi.xlsx  (cài sẵn lỗi để test bước kiểm tra / sửa nhanh)
  -> THCS-Thanh-Binh_2-sach.xlsx    (đúng hết, dùng khi chỉ muốn đi nhanh tới bước ghi)
"""
import copy
import sys

import openpyxl

TEMPLATE, OUT = sys.argv[1], sys.argv[2]
DOMAIN = sys.argv[3] if len(sys.argv) > 3 else "thanhbinh.edu.vn"
FIRST = 6  # dòng 4 tiêu đề, dòng 5 hướng dẫn

CAMPUS = [
    ["CS1", "Cơ sở chính", "12 Lê Văn Lương, phường Tân Hưng", "02838720011", "Có", ""],
    ["CS2", "Điểm trường Ấp 3", "45 Ấp 3, xã Nhơn Đức", "02838720012", "Không", ""],
]

# Mã, Họ tên, Loại, Chức vụ, Tổ, Môn chính, Môn dạy, Bộ phận, SĐT, Email, Ghi chú
STAFF = [
    ["CB0001", "Phạm Văn Hùng", "Cán bộ", "Hiệu trưởng", "", "", "", "Ban giám hiệu", "0903111001", "hung.pv@thanhbinh.edu.vn", ""],
    ["CB0002", "Ngô Thị Lan", "Cán bộ", "Phó hiệu trưởng", "", "", "", "Ban giám hiệu", "0903111002", "lan.nt@thanhbinh.edu.vn", ""],
    ["CB0003", "Trần Minh Tâm", "Cán bộ", "Cán bộ thiết bị", "", "", "", "Tổ văn phòng", "0903111003", "tam.tm@thanhbinh.edu.vn", "Phụ trách CS1"],
    ["CB0004", "Lê Thị Hồng", "Cán bộ", "Cán bộ thiết bị", "", "", "", "Tổ văn phòng", "0903111004", "hong.lt@thanhbinh.edu.vn", "Phụ trách CS2"],
    ["CB0005", "Võ Thị Mai", "Cán bộ", "Nhân viên thư viện", "", "", "", "Tổ văn phòng", "0903111005", "", ""],
    ["CB0006", "Đỗ Văn Khoa", "Cán bộ", "Kế toán", "", "", "", "Tổ văn phòng", "0903111006", "", ""],
    ["GV0001", "Nguyễn Văn An", "Giáo viên", "Tổ trưởng chuyên môn", "Tổ Toán – Tin", "Toán", "Toán", "", "0903222001", "", ""],
    ["GV0002", "Huỳnh Thị Bích", "Giáo viên", "Giáo viên", "Tổ Toán – Tin", "Tin học", "Tin học; Toán", "", "0903222002", "", ""],
    ["GV0003", "Lý Văn Cường", "Giáo viên", "Tổ trưởng chuyên môn", "Tổ Khoa học tự nhiên", "Khoa học tự nhiên", "Khoa học tự nhiên", "", "0903222003", "", ""],
    ["GV0004", "Mai Thị Dung", "Giáo viên", "Giáo viên", "Tổ Khoa học tự nhiên", "Khoa học tự nhiên", "Khoa học tự nhiên; Công nghệ", "", "0903222004", "", ""],
    ["GV0005", "Phan Thị Hà", "Giáo viên", "Tổ trưởng chuyên môn", "Tổ Ngữ văn – Ngoại ngữ", "Ngữ văn", "Ngữ văn", "", "0903222005", "", ""],
    ["GV0006", "Trương Thị Ngọc", "Giáo viên", "Giáo viên", "Tổ Ngữ văn – Ngoại ngữ", "Tiếng Anh", "Tiếng Anh", "", "0903222006", "", ""],
    ["GV0007", "Bùi Văn Phúc", "Giáo viên", "Giáo viên", "Tổ Năng khiếu", "Giáo dục thể chất", "Giáo dục thể chất", "", "0903222007", "", ""],
    ["GV0008", "Đặng Thị Quyên", "Giáo viên", "Giáo viên", "Tổ Năng khiếu", "Mỹ thuật", "Mỹ thuật; Âm nhạc", "", "0903222008", "", "Dạy cả CS2"],
]

# Mã, Tên, Mã cơ sở, Số tầng, Năm, Diện tích, Hiện trạng, Cán bộ phụ trách, Ghi chú
BUILDING = [
    ["KA", "Khối A – Phòng học", "CS1", 3, 2012, 1450, "Tốt", "CB0003", ""],
    ["KB", "Khối B – Bộ môn, hành chính", "CS1", 2, 2016, 980, "Bình thường", "CB0003", ""],
    ["NDN", "Nhà đa năng", "CS1", 1, 2019, 620, "Tốt", "CB0003", ""],
    ["KC", "Khối C – Điểm trường Ấp 3", "CS2", 2, 2008, 540, "Cần sửa chữa", "CB0004", "Mái tôn dột"],
]

# Mã, Tên, Khối nhà, Tầng, Loại CSVC, Kết cấu, Môn, Diện tích, Sức chứa, Hiện trạng, Sử dụng, Phụ trách, Đơn vị, Ghi chú
def classroom(code, building, floor, manager="CB0003"):
    return [code, f"Phòng {code.split('.')[1]}", building, floor, "Phòng học", "Kiên cố", "", 54, 45,
            "Tốt", "Đang sử dụng", manager, "", ""]

ROOM = [
    classroom("A.101", "KA", 1), classroom("A.102", "KA", 1), classroom("A.201", "KA", 2),
    classroom("A.202", "KA", 2), classroom("A.301", "KA", 3), classroom("A.302", "KA", 3),
    ["B.101", "Phòng học bộ môn Tin học", "KB", 1, "Phòng học bộ môn Tin học", "Kiên cố", "Tin học", 75, 45, "Tốt", "Đang sử dụng", "GV0002", "Tổ Toán – Tin", ""],
    ["B.102", "Phòng học bộ môn Khoa học tự nhiên", "KB", 1, "Phòng học bộ môn Khoa học tự nhiên", "Kiên cố", "Khoa học tự nhiên", 84, 45, "Tốt", "Đang sử dụng", "GV0003", "Tổ Khoa học tự nhiên", ""],
    ["B.103", "Phòng học bộ môn Ngoại ngữ", "KB", 1, "Phòng học bộ môn Ngoại ngữ", "Kiên cố", "Tiếng Anh", 60, 40, "Bình thường", "Đang sử dụng", "GV0006", "", ""],
    ["B.201", "Thư viện", "KB", 2, "Thư viện", "Kiên cố", "", 120, 60, "Tốt", "Đang sử dụng", "CB0005", "", ""],
    ["B.202", "Phòng thiết bị giáo dục", "KB", 2, "Phòng thiết bị giáo dục", "Kiên cố", "", 48, "", "Tốt", "Đang sử dụng", "CB0003", "", "Kho thiết bị CS1"],
    ["B.203", "Phòng Hiệu trưởng", "KB", 2, "Phòng Hiệu trưởng", "Kiên cố", "", 24, "", "Tốt", "Đang sử dụng", "CB0001", "", ""],
    ["B.204", "Văn phòng trường", "KB", 2, "Văn Phòng trường", "Kiên cố", "", 36, "", "Tốt", "Đang sử dụng", "CB0006", "", ""],
    ["NDN.01", "Sàn nhà đa năng", "NDN", 1, "Nhà đa năng", "Kiên cố", "", 600, 300, "Tốt", "Đang sử dụng", "GV0007", "", ""],
    ["SAN-1", "Sân trường CS1", "", "", "Sân chơi chung", "", "", 1800, "", "Tốt", "Đang sử dụng", "", "", ""],
    classroom("C.101", "KC", 1, "CB0004"), classroom("C.102", "KC", 1, "CB0004"),
    ["C.201", "Phòng thiết bị Ấp 3", "KC", 2, "Phòng thiết bị giáo dục", "Bán kiên cố", "", 30, "", "Cần sửa chữa", "Đang sử dụng", "CB0004", "", "Kho thiết bị CS2"],
]

# Tên lớp, Khối, Năm học, Sĩ số, GVCN, Phòng, Ghi chú
YEAR = "2026-2027"
CLASS = [
    ["6A1", "Lớp 6", YEAR, 42, "GV0001", "A.101", ""], ["6A2", "Lớp 6", YEAR, 41, "GV0002", "A.102", ""],
    ["7A1", "Lớp 7", YEAR, 40, "GV0003", "A.201", ""], ["7A2", "Lớp 7", YEAR, 39, "GV0004", "A.202", ""],
    ["8A1", "Lớp 8", YEAR, 43, "GV0005", "A.301", ""], ["9A1", "Lớp 9", YEAR, 38, "GV0006", "A.302", ""],
    ["6A3", "Lớp 6", YEAR, 30, "GV0008", "C.101", "Điểm trường Ấp 3"],
    ["7A3", "Lớp 7", YEAR, 28, "GV0007", "C.102", "Điểm trường Ấp 3"],
]

# Mã cũ, Tên, Mã DM, SL, ĐVT, Cách QL, Serial, Phòng, CB quản lý, Nguyên giá, GTCL, Ngày nhận, Năm, Nguồn hình thành, Nguồn KP, Tình trạng, Ghi chú
def eq(legacy, name, cat, qty, room, manager, price, year, origin="Được cấp phát, bàn giao", funding="Ngân sách",
       cond="Tốt", serial="", unit="", tracking="", remaining="", received="", note=""):
    return [legacy, name, cat, qty, unit, tracking, serial, room, manager, price, remaining, received, year,
            origin, funding, cond, note]

EQUIP = [
    eq("TS-0001", "Máy chiếu Epson EB-X51", "THCS-00-013", 1, "A.101", "CB0003", 12500000, 2022, serial="X51-77812"),
    eq("TS-0002", "Máy chiếu Epson EB-X51", "THCS-00-013", 1, "A.102", "CB0003", 12500000, 2022, serial="X51-77813"),
    eq("TS-0003", "Tivi Samsung 65 inch", "THCS-00-013", 4, "A.201", "CB0003", 18900000, 2023, origin="Kế hoạch mua sắm", remaining=16000000),
    eq("TS-0010", "Máy tính để bàn Dell Optiplex", "THCS-14-002", 20, "B.101", "GV0002", 14200000, 2021, origin="Kế hoạch mua sắm"),
    eq("TS-0011", "Bàn ghế phòng máy", "THCS-14-004", 20, "B.101", "GV0002", 2100000, 2021),
    eq("TS-0012", "Switch TP-Link 24 cổng", "THCS-14-026", 1, "B.101", "GV0002", 3200000, 2021, serial="TL-SG1024-0091"),
    eq("TS-0013", "Router Wifi Archer C6", "THCS-14-027", 1, "B.101", "GV0002", 1100000, 2022, serial="AC6-55120"),
    eq("TS-0020", "Kính hiển vi quang học", "THCS-27-055", 6, "B.102", "GV0003", 4500000, 2020, cond="Khá"),
    eq("TS-0021", "Cân điện tử 0,01g", "THCS-27-052", 3, "B.102", "GV0003", 1800000, 2020),
    eq("TS-0022", "Nhiệt kế lỏng", "THCS-27-026", 12, "B.102", "GV0003", 45000, 2020),
    eq("HC-0001", "Bột lưu huỳnh", "THCS-27-058", 500, "B.202", "CB0003", 300, 2024, unit="g", origin="Kế hoạch mua sắm"),
    eq("HC-0002", "Natri clorua (NaCl)", "THCS-27-077", 1000, "B.202", "CB0003", 50, 2024, unit="g", origin="Kế hoạch mua sắm"),
    eq("HC-0003", "Ống nghiệm thủy tinh", "THCS-27-041", 60, "B.202", "CB0003", 8000, 2024),
    eq("TS-0030", "Quả bóng đá số 5", "THCS-21-024", 10, "NDN.01", "GV0007", 250000, 2025, origin="Được tặng, tài trợ", funding="Tài trợ"),
    eq("TS-0031", "Lưới chắn bóng", "THCS-21-015", 2, "NDN.01", "GV0007", 1500000, 2025),
    eq("TS-0032", "Thước dây 30m", "THCS-21-003", 2, "", "GV0007", 180000, 2025, note="Để trong kho"),
    eq("TS-0040", "Loa cầm tay Sony", "THCS-00-009", 2, "B.204", "CB0006", 2400000, 2023),
    eq("TS-0041", "Máy chiếu vật thể", "THCS-00-015", 1, "B.103", "GV0006", 6800000, 2023, serial="MCVT-1102"),
    eq("TS-0050", "Máy lọc nước Kangaroo", "", 1, "B.204", "CB0006", 7500000, 2024, unit="Cái",
       origin="Được tặng, tài trợ", funding="Tài trợ", note="Ngoài danh mục"),
    eq("TS-0060", "Máy chiếu cũ Sony VPL", "THCS-00-013", 1, "C.101", "CB0004", 9000000, 2015, cond="Kém",
       remaining=1000000, serial="VPL-2015-01"),
    eq("TS-0061", "Máy tính xách tay HP", "THCS-00-012", 2, "C.201", "CB0004", 13000000, 2019),
    eq("TS-0062", "Bộ thước thực hành đo ngoài trời", "THCS-08-002", 1, "C.201", "CB0004", 950000, 2019),
]

# Lỗi cài sẵn cho bản 1: (trang, chỉ số dòng trong danh sách, cột, giá trị sai, mô tả)
ERRORS = [
    ("STAFF", 4, 0, "CB0004", "Mã cán bộ trùng (CB0005 ghi nhầm thành CB0004)"),
    ("ROOM", 4, 3, 5, "Tầng 5 vượt số tầng của khối A (3 tầng)"),
    ("ROOM", 5, 4, "Phòng học thường", "Loại CSVC không có trong danh mục"),
    ("CLASS", 5, 5, "A.999", "Lớp 9A1 trỏ tới phòng không có"),
    ("EQUIP", 2, 6, "SS65-0001", "Có số serial nhưng số lượng 4"),
    ("EQUIP", 9, 3, 0, "Số lượng 0"),
    ("EQUIP", 16, 7, "a101", "Mã phòng viết khác (a101 thay vì A.101)"),
    ("BUILDING", 2, 4, 219, "Năm không đủ 4 chữ số"),
]

SHEETS = {"Cơ sở": "CAMPUS", "Cán bộ – giáo viên": "STAFF", "Khối nhà": "BUILDING", "Phòng": "ROOM",
          "Lớp học": "CLASS", "Thiết bị": "EQUIP"}


def build(with_errors, path):
    wb = openpyxl.load_workbook(TEMPLATE)
    data = {k: copy.deepcopy(v) for k, v in
            dict(CAMPUS=CAMPUS, STAFF=STAFF, BUILDING=BUILDING, ROOM=ROOM, CLASS=CLASS, EQUIP=EQUIP).items()}
    if DOMAIN != "thanhbinh.edu.vn":
        for row in data["STAFF"]:
            row[9] = row[9].replace("thanhbinh.edu.vn", DOMAIN)
    if with_errors:
        for sheet, row, col, value, _ in ERRORS:
            data[sheet][row][col] = value
    for title, key in SHEETS.items():
        ws = wb[title]
        for i, row in enumerate(data[key]):
            for j, value in enumerate(row):
                if value != "":
                    ws.cell(row=FIRST + i, column=j + 1, value=value)
    wb.save(path)


build(True, f"{OUT}/THCS-Thanh-Binh_1-co-loi.xlsx")
build(False, f"{OUT}/THCS-Thanh-Binh_2-sach.xlsx")
sys.stdout.reconfigure(encoding="utf-8")
print("rows:", {k: len(v) for k, v in dict(CAMPUS=CAMPUS, STAFF=STAFF, BUILDING=BUILDING, ROOM=ROOM,
                                             CLASS=CLASS, EQUIP=EQUIP).items()})
for e in ERRORS:
    print("lỗi:", e[0], "dòng", FIRST + e[1], "-", e[4])
