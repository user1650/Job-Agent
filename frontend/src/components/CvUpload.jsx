import { useState, useRef } from "react";
import { Paperclip, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

const API_URL = "http://localhost:8000";

export function CvUpload({ threadId, onUploaded }) {
  const [isUploading, setIsUploading] = useState(false);
  const [status, setStatus] = useState("idle"); // idle, success, error
  const [filename, setFilename] = useState("");
  const fileInputRef = useRef(null);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setStatus("idle");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(`${API_URL}/upload-cv/${threadId}`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      const data = await response.json();
      setFilename(data.filename);
      setStatus("success");
      onUploaded?.(data.filename);
    } catch (err) {
      console.error(err);
      setStatus("error");
    } finally {
      setIsUploading(false);
      // Reset input so the same file can be uploaded again if needed
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <div className="flex items-center gap-2">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept=".pdf,.docx,.txt"
      />
      
      {status === "success" && (
        <div className="flex items-center gap-1.5 rounded-full bg-green-500/10 px-3 py-1 text-xs font-medium text-green-500 border border-green-500/20">
          <CheckCircle2 className="h-3.5 w-3.5" />
          <span className="max-w-[120px] truncate">{filename} loaded</span>
        </div>
      )}

      {status === "error" && (
        <div className="flex items-center gap-1.5 rounded-full bg-red-500/10 px-3 py-1 text-xs font-medium text-red-500 border border-red-500/20">
          <XCircle className="h-3.5 w-3.5" />
          Failed to load CV
        </div>
      )}

      <Button
        variant="outline"
        size="sm"
        className="gap-2"
        onClick={() => fileInputRef.current?.click()}
        disabled={isUploading}
      >
        {isUploading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Paperclip className="h-4 w-4" />
        )}
        <span className="hidden sm:inline">{isUploading ? "Uploading..." : "Upload CV"}</span>
      </Button>
    </div>
  );
}
