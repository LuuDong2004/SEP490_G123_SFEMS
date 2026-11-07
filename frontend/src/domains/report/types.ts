export type ReportOption = { id: number | null; key: string | null; label: string };

export type AssetReport = {
  scope: "CITY" | "BODY" | "SCHOOL" | "NONE";
  fromDate: string;
  toDate: string;
  filters: {
    schools: ReportOption[];
    subjects: ReportOption[];
    equipmentTypes: ReportOption[];
    origins: ReportOption[];
    statuses: ReportOption[];
  };
  summary: {
    quantity: number;
    originalValue: number;
    inUse: number;
    inStorage: number;
    broken: number;
    missing: number;
    recordedInPeriod: number;
  };
  totalRows: number;
  truncated: boolean;
  rows: {
    id: number;
    code: string;
    name: string;
    schoolName: string;
    subjectName: string | null;
    equipmentTypeName: string | null;
    status: string;
    statusLabel: string;
    originName: string | null;
    condition: string | null;
    quantity: number;
    originalValue: number | null;
    receivedDate: string | null;
  }[];
};
