import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";
import { Bot, User, FileDown, ExternalLink, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

function CodeBlock({ children, className, onPdfReady }) {
  const [copied, setCopied] = useState(false);
  const [compiling, setCompiling] = useState(false);
  const text = String(children).replace(/\n$/, "");

  const isLatex = className?.includes("language-latex") || className?.includes("language-tex");

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCompile = async () => {
    setCompiling(true);
    try {
      const res = await fetch("http://localhost:8000/compile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ latex: text }),
      });
      const data = await res.json();
      // Try to extract PDF URL from response
      const urlMatch = /PDF_URL:\s*(https?:\/\/\S+\.pdf)/.exec(data.message);
      const linkMatch = /\[.*?\]\((http:\/\/localhost:8000\/static\/resumes\/[^\)]+\.pdf)\)/.exec(data.message);
      const url = urlMatch?.[1] || linkMatch?.[1];
      if (url) {
        onPdfReady?.(url);
      } else {
        alert("Compilation failed:\n" + data.message);
      }
    } catch (e) {
      alert("Error: " + e.message);
    }
    setCompiling(false);
  };

  return (
    <div className="relative group my-4 rounded-xl overflow-hidden border border-border">
      {/* Header bar */}
      <div className="flex items-center justify-between bg-muted/60 px-4 py-2 text-xs text-muted-foreground">
        <span className="font-medium uppercase tracking-wider">
          {className?.replace("language-", "") || "code"}
        </span>
        <div className="flex items-center gap-2">
          {isLatex && (
            <Button
              size="sm"
              variant="default"
              className="h-6 px-2.5 bg-green-600 hover:bg-green-700 text-[11px] gap-1.5 rounded-md"
              onClick={handleCompile}
              disabled={compiling}
            >
              <FileDown className="h-3 w-3" />
              {compiling ? "Rendering..." : "Render PDF"}
            </Button>
          )}
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-green-500" />
                <span className="text-green-500">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      </div>
      <pre className="overflow-x-auto bg-card p-4 font-mono text-xs leading-relaxed">
        <code className={className}>{children}</code>
      </pre>
    </div>
  );
}

// PDF download + preview card shown above message content
function PdfDownloadCard({ url, filename, onPdfReady }) {
  return (
    <div className="my-4 flex items-center gap-4 rounded-xl border border-green-500/30 bg-green-500/10 p-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-green-500/20 text-green-400">
        <FileDown className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-green-400">Resume Compiled Successfully!</p>
        <p className="text-xs text-muted-foreground truncate">{filename}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button
          size="sm"
          variant="outline"
          className="gap-2 rounded-lg text-xs border-green-500/40 text-green-400 hover:bg-green-500/10"
          onClick={() => onPdfReady?.(url)}
        >
          <ExternalLink className="h-3.5 w-3.5" />
          View
        </Button>
        <Button
          asChild
          size="sm"
          className="shrink-0 bg-green-600 hover:bg-green-700 text-white gap-2 rounded-lg text-xs"
        >
          <a href={url} download={filename}>
            <FileDown className="h-3.5 w-3.5" />
            Download
          </a>
        </Button>
      </div>
    </div>
  );
}

// Extract any PDF URLs from the message content
function extractPdfLinks(content) {
  const regex = /\[.*?\]\((http:\/\/localhost:8000\/static\/resumes\/[^\)]+\.pdf)\)/g;
  const matches = [];
  let match;
  while ((match = regex.exec(content)) !== null) {
    const url = match[1];
    const filename = url.split("/").pop();
    matches.push({ url, filename });
  }
  return matches;
}

export function Message({ message, onPdfReady }) {
  const isUser = message.role === "user";
  const pdfLinks = !isUser ? extractPdfLinks(message.content || "") : [];

  return (
    <div
      className={cn(
        "group py-5 px-4 -mx-4 rounded-xl transition-colors",
        isUser ? "" : "hover:bg-muted/30"
      )}
    >
      <div className="flex gap-4">
        {/* Avatar */}
        <div
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg mt-0.5 border border-border",
            isUser ? "bg-muted" : "bg-muted"
          )}
        >
          {isUser ? <User className="h-4 w-4 text-muted-foreground" /> : <Bot className="h-4 w-4 text-muted-foreground" />}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-muted-foreground mb-1.5">
            {isUser ? "You" : "DeepAgent"}
          </p>

          {isUser ? (
            <p className="text-sm leading-relaxed">{message.content}</p>
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none text-sm break-words">
              {/* Render PDF download cards at the top */}
              {pdfLinks.map(({ url, filename }) => (
                <PdfDownloadCard key={url} url={url} filename={filename} onPdfReady={onPdfReady} />
              ))}

              <ReactMarkdown
                components={{
                  table: ({ children }) => (
                    <div className="my-4 w-full overflow-x-auto rounded-xl border border-border">
                      <table className="w-full text-sm">{children}</table>
                    </div>
                  ),
                  th: ({ children }) => (
                    <th className="border-b border-border px-4 py-2.5 text-left font-semibold bg-muted/50 text-xs uppercase tracking-wider">
                      {children}
                    </th>
                  ),
                  td: ({ children }) => (
                    <td className="border-b border-border/50 px-4 py-2.5 text-left">{children}</td>
                  ),
                  a: ({ href, children }) => {
                    // Render PDF links as download buttons inline
                    if (href?.includes("/static/resumes/") && href?.endsWith(".pdf")) {
                      return (
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 font-medium text-green-400 underline underline-offset-4 hover:text-green-300"
                        >
                          <FileDown className="h-3.5 w-3.5" />
                          {children}
                        </a>
                      );
                    }
                    return (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-primary underline underline-offset-4 hover:text-primary/80"
                      >
                        {children}
                      </a>
                    );
                  },
                  p: ({ children }) => (
                    <p className="leading-7 [&:not(:first-child)]:mt-3">{children}</p>
                  ),
                  ul: ({ children }) => (
                    <ul className="my-3 ml-6 list-disc [&>li]:mt-1.5">{children}</ul>
                  ),
                  ol: ({ children }) => (
                    <ol className="my-3 ml-6 list-decimal [&>li]:mt-1.5">{children}</ol>
                  ),
                  pre: ({ children }) => <>{children}</>,
                  code: ({ node, inline, className, children, ...props }) => {
                    const match = /language-(\w+)/.exec(className || '');
                    return !inline && match ? (
                      <CodeBlock className={className} onPdfReady={onPdfReady}>{children}</CodeBlock>
                    ) : (
                      <code className={cn("rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs", className)} {...props}>
                        {children}
                      </code>
                    );
                  },
                }}
              >
                {message.content || "▋"}
              </ReactMarkdown>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
