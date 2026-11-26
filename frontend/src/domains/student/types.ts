/** Học sinh của trường (`/api/students`, changelog 304). Năm học suy ra từ lớp. */

export type StudentGender = "MALE" | "FEMALE";

/** Giới tính — cùng danh sách với `StudentGender` ở backend. */
export const GENDER_LABELS: Record<StudentGender, string> = {
  MALE: "Nam",
  FEMALE: "Nữ",
};

export const GENDER_OPTIONS = (Object.keys(GENDER_LABELS) as StudentGender[]).map((value) => ({
  value,
  label: GENDER_LABELS[value],
}));

type Ref = { id: number; code?: string | null; name?: string | null } | null;

export type Student = {
  id: number;
  /** Mã học sinh — duy nhất trong một lớp. */
  code: string;
  /** Họ và tên. */
  name: string;
  active: boolean;
  note: string | null;
  school: Ref;
  class: Ref;
  schoolYear: Ref;
  grade: Ref;
  /** Ngày lịch "yyyy-MM-dd". */
  birthDate: string | null;
  gender: StudentGender | null;
};
