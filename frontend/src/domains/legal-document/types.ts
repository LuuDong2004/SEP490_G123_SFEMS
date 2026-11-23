/** Văn bản căn cứ: loại văn bản. */
export const LEGAL_DOC_TYPE_LABELS: Record<string, string> = {
  LUAT: "Luật",
  NGHI_DINH: "Nghị định",
  THONG_TU: "Thông tư",
  QUYET_DINH: "Quyết định",
  CONG_VAN: "Công văn",
  HUONG_DAN: "Hướng dẫn",
  KHAC: "Khác",
};

/** Số hiệu: chữ (cả Đ), số, / . - — cùng luật với `LegalDocumentService.NUMBER_PATTERN`. */
export const LEGAL_DOC_NUMBER = /^[0-9A-Za-zĐđ/.-]*$/;
