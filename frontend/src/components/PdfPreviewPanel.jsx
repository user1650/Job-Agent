import { useEffect, useRef } from "react";
import { X, Download, ExternalLink, FileText, ZoomIn, ZoomOut } from "lucide-react";

/**
 * PdfPreviewPanel — a right-side slide-in panel that renders a PDF inline.
 *
 * Props:
 *   url      {string|null}  — the PDF URL to display; null means panel is closed
 *   onClose  {function}     — called when the user closes the panel
 */
export function PdfPreviewPanel({ url, onClose }) {
  const iframeRef = useRef(null);

  // When a new URL arrives, scroll the iframe back to the top
  useEffect(() => {
    if (iframeRef.current && url) {
      iframeRef.current.src = url;
    }
  }, [url]);

  const filename = url ? url.split("/").pop() : "";

  return (
    <div
      className={`
        flex flex-col h-full border-l border-border bg-background
        transition-all duration-300 ease-in-out overflow-hidden
        ${url ? "w-[480px] min-w-[360px]" : "w-0 min-w-0"}
      `}
      aria-hidden={!url}
    >
      {url && (
        <>
          {/* ── Header ── */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-card shrink-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/10">
              <FileText className="h-4 w-4 text-violet-500" />
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold truncate text-foreground">Resume Preview</p>
              <p className="text-[10px] text-muted-foreground truncate">{filename}</p>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-1 shrink-0">
              <a
                href={url}
                download={filename}
                title="Download PDF"
                className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              >
                <Download className="h-3.5 w-3.5" />
              </a>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                title="Open in new tab"
                className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
              <button
                onClick={onClose}
                title="Close preview"
                className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* ── PDF iframe ── */}
          <div className="flex-1 overflow-hidden bg-muted/30">
            <iframe
              ref={iframeRef}
              src={url}
              title="Resume PDF Preview"
              className="w-full h-full border-0"
              style={{ display: "block" }}
            />
          </div>

          {/* ── Footer ── */}
          <div className="shrink-0 px-4 py-2 border-t border-border bg-card flex items-center justify-between">
            <p className="text-[10px] text-muted-foreground">
              Use browser controls to zoom · PDF renders natively
            </p>
            <a
              href={url}
              download={filename}
              className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 px-3 py-1.5 text-xs font-medium text-white transition-colors"
            >
              <Download className="h-3 w-3" />
              Download
            </a>
          </div>
        </>
      )}
    </div>
  );
}
