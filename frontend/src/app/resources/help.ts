import type { ResourceProps } from "@refinedev/core";

import type { ScreenHelp } from "@/shared/components/layout/help-button";
import { MODULES } from "@/app/resources/modules";

/**
 * Trợ giúp của các màn KHÔNG thuộc phân hệ nghiệp vụ — chủ yếu quản trị hệ thống. Màn thuộc phân hệ lấy
 * trợ giúp từ chính các bước Quy trình của phân hệ ({@link withHelp}), nên không phải viết hai lần.
 */
const ADMIN_HELP: Record<string, ScreenHelp> = {
  users: {
    title: "Người dùng",
    summary: "Tài khoản đăng nhập của mọi cấp: Sở, trường.",
    tips: [
      "Một tài khoản gắn với MỘT nơi công tác (cơ quan quản lý hoặc trường) và một hay nhiều vai trò; vai trò quyết định được làm gì, nơi công tác quyết định thấy dữ liệu của ai.",
      "Đặt lại mật khẩu ở trang chi tiết tài khoản: mọi phiên đang mở của tài khoản đó bị đăng xuất.",
      "Trang chi tiết có \"Phiên đăng nhập\" (đăng xuất từng thiết bị) và \"Lịch sử đăng nhập\".",
      "Tài khoản của cán bộ trường nên cấp từ hồ sơ cán bộ (nút Cấp tài khoản) để tên đăng nhập theo mẫu <mã trường>.<mã cán bộ>.",
    ],
  },
  school_users: {
    title: "Tài khoản của trường",
    summary: "Lãnh đạo trường quản lý tài khoản của cán bộ, giáo viên trong trường mình.",
    tips: [
      "Chỉ gán được vai phía trường: Giáo viên, Cán bộ thiết bị, Trưởng bộ môn, Lãnh đạo trường.",
      "Mật khẩu do máy sinh và chỉ hiện MỘT lần — chép lại gửi cho người dùng.",
      "Không tự khoá hay tự đổi vai của chính mình.",
    ],
  },
  roles: {
    title: "Vai trò và phân quyền",
    summary: "Mỗi vai trò là một tập quyền (được gọi API nào) cộng phạm vi dữ liệu (thấy những dòng nào).",
    tips: [
      "Tab Quyền: tích chức năng và thao tác (xem, sửa, xoá, duyệt, xuất). Bấm Lưu mới ghi.",
      "Tab Phạm vi dữ liệu: mỗi điều kiện lưu NGAY khi đóng hộp thoại, không chờ nút Lưu của vai trò.",
      "Cấp quyền sửa mà quên phạm vi dữ liệu \"sửa\" thì nút có trên màn hình nhưng bấm vào bị từ chối.",
    ],
  },
  permissions: {
    title: "Danh mục quyền",
    summary: "Danh sách mọi mã quyền hệ thống kiểm tra; chỉ xem, thêm bằng bản cập nhật phần mềm.",
  },
  row_level_policies: {
    title: "Phạm vi dữ liệu",
    summary: "Điều kiện quyết định mỗi vai trò thấy, sửa, xoá những dòng nào của một loại dữ liệu.",
    tips: [
      "Phạm vi của nhiều vai cộng dồn (HOẶC); bộ lọc chung áp cho mọi người (VÀ).",
      "Điều kiện \"KHÔNG phải X\" không khớp dòng trống — muốn gồm cả dòng trống thì thêm nhánh \"là trống\".",
    ],
  },
  approval_flows: {
    title: "Luồng phê duyệt",
    summary: "Mỗi loại phiếu đi qua những cấp duyệt nào: trường, Sở. Đề xuất mua sắm luôn qua lãnh đạo trường rồi lãnh đạo Sở, không đổi được.",
    tips: [
      "Đổi luồng có hiệu lực ở lần trình / duyệt kế tiếp; phiếu đang chờ đi tiếp từ cấp nó đang đứng.",
    ],
  },
  school_code_rules: {
    title: "Quy tắc mã của trường",
    summary: "Ký hiệu đầu và độ dài số của mã phòng, khối nhà, điểm trường, cán bộ — theo từng trường.",
  },
  data_changes: {
    title: "Lịch sử thay đổi dữ liệu",
    summary: "Giá trị TRƯỚC và SAU mỗi lần sửa các trường quan trọng (trường, cán bộ, phòng, tài khoản, danh mục…).",
    tips: [
      "Lịch sử chỉ thêm, không ai sửa hay xoá được — kể cả quản trị viên.",
      "Thiết bị và phiếu có lịch sử riêng: tab Lịch sử của hồ sơ thiết bị, \"Quá trình duyệt\" của phiếu.",
    ],
  },
};

/**
 * Gắn `meta.help` vào mọi resource: màn thuộc phân hệ lấy các bước Quy trình nhắc tới nó (và lối tới trang Quy
 * trình), màn quản trị lấy {@link ADMIN_HELP}. Resource đã tự khai `meta.help` thì giữ nguyên.
 */
export function withHelp(resources: ResourceProps[]): ResourceProps[] {
  const fromModules = new Map<string, ScreenHelp>();
  for (const m of MODULES) {
    const processPath = `/modules/${m.tabs[0][0].replace("process_", "")}`;
    for (const [resource, label] of m.tabs.slice(1)) {
      const steps = m.process.steps.filter((s) => s.resource === resource);
      fromModules.set(resource, {
        title: label,
        summary: `Thuộc phân hệ ${m.label}.`,
        steps: steps.map((s) => ({ title: s.title, maker: s.maker, approver: s.approver, result: s.result })),
        processPath,
      });
    }
  }
  return resources.map((r) => {
    if (r.meta?.help) return r;
    const help = ADMIN_HELP[r.name] ?? fromModules.get(r.name);
    return help ? { ...r, meta: { ...r.meta, help } } : r;
  });
}
