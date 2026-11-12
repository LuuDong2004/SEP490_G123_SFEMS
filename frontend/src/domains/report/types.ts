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

export type AdequacyReport = {
  scope: "CITY" | "BODY" | "SCHOOL" | "NONE";
  filters: { schools: { id: number; label: string }[]; subjects: { id: number; label: string }[]; grades: { id: number; label: string }[]; equipmentTypes: { id: number; label: string }[] };
  summary: { schools: number; countedSchools: number; averagePercent: number; shortageTotal: number; surplusTotal: number; unknownNorms: number };
  distribution: { key: string; label: string; count: number }[];
  rows: { schoolId: number; schoolCode: string; schoolName: string; educationLevel: string | null; classCount: number | null; studentCount: number | null; norms: number; met: number; unknown: number; shortageNorms: number; shortageTotal: number; surplusNorms: number; surplusTotal: number; percent: number | null }[];
  details: { schoolId: number; schoolCode: string; schoolName: string; normCode: string; normName: string; itemNo: string | null; catalogCode: string | null; catalogName: string | null; subjectName: string | null; gradeName: string | null; gradeLevels: string | null; equipmentTypeName: string | null; required: number | null; available: number; shortage: number | null; surplus: number | null; percent: number | null }[];
};

export type PurchaseReport = {
  scope: "CITY" | "BODY" | "SCHOOL" | "NONE";
  filters: { schools: { key: string; label: string }[]; years: { key: string; label: string }[]; equipment: { key: string; label: string }[]; statuses: { key: string; label: string }[] };
  summary: { proposals: number; pending: number; approved: number; planned: number; quantity: number; receivedQuantity: number; amount: number; approvedAmount: number };
  rows: { key: string; name: string; schools: number; proposals: number; pending: number; approved: number; planned: number; quantity: number; receivedQuantity: number; amount: number; approvedAmount: number }[];
};

export type InventoryReport = {
  scope: "CITY" | "BODY" | "SCHOOL" | "NONE";
  filters: { campaigns: { id: number; label: string }[]; schools: { id: number; label: string }[] };
  summary: { sessions: number; bookQuantity: number; matchedQuantity: number; shortageQuantity: number; surplusQuantity: number; damagedQuantity: number; wrongLocationQuantity: number; discrepancyValue: number };
  rows: { id: number; code: string; campaign: string; school: string; inventoryDate: string; status: string; statusLabel: string; bookQuantity: number; matchedQuantity: number; shortageQuantity: number; surplusQuantity: number; damagedQuantity: number; wrongLocationQuantity: number; discrepancyValue: number }[];
};
