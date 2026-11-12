import { useQueryClient } from "@tanstack/react-query";
import { FileSpreadsheet, Upload } from "lucide-react";
import { useState } from "react";

import { kyInstance } from "@/shared/api/data";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";

/** Kết quả kiểm tra tệp: số dòng có dữ liệu, số dòng đủ điều kiện và lỗi theo từng dòng. */
type Preview = {
  rows: number;
  valid: number;
  errors: { row: number; message: string }[];
};

/** Đọc thông báo lỗi từ phản hồi của máy chủ (trường `message`), hoặc dùng câu mặc định. */
async function readError(error: unknown, fallback: string): Promise<string> {
  const response = (error as { response?: Response })?.response;
  if (response) {
    try {
      const body = (await response.json()) as { message?: string };
      if (body.message) return body.message;
    } catch {
      // Không phải JSON: dùng câu mặc định.
    }
  }
  return fallback;
}

/**
 * Nhập thiết bị ban đầu từ tệp theo mẫu "Mẫu dữ liệu đầu vào.xlsx", trang "Thiết bị" (TS-07).
 * Kiểm tra trước, ghi sau: có lỗi ở bất kỳ dòng nào thì không ghi dòng nào.
 */
export const EquipmentImport = () => {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const pick = (next: File | null) => {
    setFile(next);
    setPreview(null);
    setMessage(null);
  };

  const send = async (path: "preview" | "commit") => {
    if (!file) return;
    const body = new FormData();
    body.append("file", file);
    setBusy(true);
    setMessage(null);
    try {
      if (path === "preview") {
        setPreview(await kyInstance.post("data_imports/equipment/preview", { body }).json<Preview>());
      } else {
        const result = await kyInstance.post("data_imports/equipment", { body }).json<{ created: number }>();
        setMessage(`Đã tạo ${result.created} thiết bị từ tệp.`);
        setFile(null);
        setPreview(null);
        queryClient.invalidateQueries({ queryKey: ["equipment"] });
      }
    } catch (error) {
      setMessage(await readError(error, "Không đọc được tệp. Kiểm tra lại tệp đúng mẫu."));
    } finally {
      setBusy(false);
    }
  };

  const canCommit = !!preview && preview.errors.length === 0 && preview.valid > 0;

  return (
    <div className="mx-auto grid w-full max-w-4xl gap-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Nhập thiết bị từ tệp</h1>
        <p className="text-muted-foreground text-sm">
          Chỉ nhận tệp Excel theo mẫu <span className="font-medium">"Mẫu dữ liệu đầu vào.xlsx"</span>, trang{" "}
          <span className="font-medium">"Thiết bị"</span>. Kiểm tra trước; nếu còn lỗi ở bất kỳ dòng nào thì không
          ghi dòng nào.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">1. Chọn tệp</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="border-input hover:bg-muted/40 flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm">
            <FileSpreadsheet className="size-4" />
            <span>{file ? file.name : "Chọn file .xlsx"}</span>
            <input
              type="file"
              accept=".xlsx"
              className="sr-only"
              onChange={(event) => pick(event.target.files?.[0] ?? null)}
            />
          </label>
          <Button type="button" disabled={!file || busy} onClick={() => send("preview")}>
            <Upload className="size-4" />
            Kiểm tra tệp
          </Button>
        </CardContent>
      </Card>

      {preview ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">2. Kết quả kiểm tra</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <p className="text-sm">
              Có <span className="font-medium">{preview.rows}</span> dòng dữ liệu,{" "}
              <span className="font-medium">{preview.valid}</span> dòng đủ điều kiện.
            </p>
            {preview.errors.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-muted-foreground text-xs">
                    <tr>
                      <th className="px-2 py-1 font-medium">Dòng</th>
                      <th className="px-2 py-1 font-medium">Lỗi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.errors.map((error, index) => (
                      <tr key={`${error.row}-${index}`} className="border-t">
                        <td className="px-2 py-1 font-mono">{error.row}</td>
                        <td className="px-2 py-1">{error.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
            <div>
              <Button type="button" disabled={!canCommit || busy} onClick={() => send("commit")}>
                Ghi vào hồ sơ
              </Button>
              {preview.errors.length > 0 ? (
                <p className="text-muted-foreground mt-2 text-xs">Sửa hết lỗi trong tệp rồi kiểm tra lại.</p>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {message ? <p className="text-sm">{message}</p> : null}
    </div>
  );
};
