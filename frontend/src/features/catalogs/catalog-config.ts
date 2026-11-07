import type { ComponentType } from "react";
import type { HttpError } from "@refinedev/core";
import type { UseTableReturnType } from "@refinedev/react-table";
import type { ColumnDef } from "@tanstack/react-table";
import type { Control } from "react-hook-form";

import type { CatalogItem } from "@/domains/catalog/types";

/** Một dòng danh mục bất kỳ: năm trường chung cộng các trường riêng của danh mục đó. */
export type CatalogRecord = CatalogItem & Record<string, unknown>;

/** Giá trị của form thêm/sửa: năm trường chung (trừ thứ tự, máy chủ tự xếp) cộng các trường riêng. */
export type CatalogFormValues = {
  code: string;
  name: string;
  note: string;
  active: boolean;
} & Record<string, unknown>;

/**
 * Mô tả MỘT danh mục cho bộ màn dùng chung (danh sách + hộp thoại thêm, sửa, xem). Danh mục chỉ có năm
 * trường chung thì chỉ cần `resource` và `noun`; danh mục có trường riêng khai thêm cột, ô nhập, ô xem.
 */
export type CatalogConfig = {
  /** Tên resource — trùng đường dẫn API và nửa đầu mã quyền, vd. `units`. */
  resource: string;
  /** Danh từ viết thường để ghép câu: "Thêm {noun}", "Xoá {noun} …". */
  noun: string;
  /** Câu mô tả ngắn hiện dưới tiêu đề hộp thoại. */
  description: string;
  /** Nhãn cột và ô mã, mặc định "Mã" (môn học dùng "Mã môn"). */
  codeLabel?: string;
  /** Mã bắt buộc gõ tay (vd. mã hành chính của phường/xã), không để máy chủ tự cấp. */
  codeRequired?: boolean;
  /** Ví dụ trong ô mã và ô tên. */
  codePlaceholder?: string;
  namePlaceholder?: string;

  /** Cột riêng, chèn giữa cột Tên và cột Trạng thái. */
  extraColumns?: ColumnDef<CatalogRecord>[];
  /** Tên các trường riêng được gửi lên khi lưu. */
  extraKeys?: string[];
  /** Giá trị ban đầu của các trường riêng ở form thêm. */
  extraDefaults?: Record<string, unknown>;
  /** Ô nhập của các trường riêng. */
  ExtraFields?: ComponentType<{ control: Control<CatalogFormValues> }>;
  /** Ô chỉ xem của các trường riêng, ở hộp thoại xem. */
  ExtraRead?: ComponentType<{ record: CatalogRecord }>;
  /** Ô lọc riêng trên thanh công cụ của danh sách. */
  ExtraFilters?: ComponentType<{ table: UseTableReturnType<CatalogRecord, HttpError> }>;
  /** Vòng đời riêng của danh mục có thể khóa sửa hoặc xóa từng bản ghi. */
  canModify?: (record: CatalogRecord) => boolean;
  /** Bộ tiêu chuẩn dùng trạng thái hiệu lực riêng, không dùng công tắc active. */
  hideActive?: boolean;
  listLink?: { to: string; label: string };
};

/** Năm trường chung luôn gửi lên khi lưu. Thứ tự không có trên form nên không gửi. */
export const BASE_FORM_KEYS = ["code", "name", "note", "active"] as const;

export const BASE_FORM_DEFAULTS: CatalogFormValues = {
  code: "",
  name: "",
  note: "",
  active: true,
};
