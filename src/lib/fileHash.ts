export const sha256Hex = async (file: File): Promise<string> => {
  const buf = await file.arrayBuffer();
  const hash = await crypto.subtle.digest("SHA-256", buf);
  const bytes = new Uint8Array(hash);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

export const getFileExt = (fileName: string) => {
  const parts = fileName.split(".");
  if (parts.length < 2) return "";
  return (parts.pop() || "").toLowerCase();
};
