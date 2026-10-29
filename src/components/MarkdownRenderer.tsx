import React, { useState } from 'react';
import { marked } from 'marked';
import { Copy, Check } from 'lucide-react';

interface MarkdownRendererProps {
  content: string;
  themeAccent?: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, themeAccent = 'emerald' }) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Configure marked options
  marked.setOptions({
    gfm: true,
    breaks: true,
  });

  const parsedHtml = marked.parse(content) as string;

  const handleCopy = (codeText: string, id: string) => {
    navigator.clipboard.writeText(codeText);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="relative terminal-markdown break-words">
      <div 
        dangerouslySetInnerHTML={{ __html: parsedHtml }} 
        ref={(el) => {
          if (!el) return;
          // Add copy buttons dynamically to all pre elements
          const preBlocks = el.querySelectorAll('pre');
          preBlocks.forEach((pre, index) => {
            if (pre.querySelector('.code-copy-btn')) return;
            
            const code = pre.querySelector('code');
            const codeText = code ? code.innerText : pre.innerText;
            const btn = document.createElement('button');
            btn.className = `code-copy-btn absolute top-2 right-2 text-xs px-2 py-1 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-600/50 transition-all flex items-center gap-1 cursor-pointer select-none font-mono`;
            btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg> <span>COPY</span>`;
            
            btn.addEventListener('click', (e) => {
              e.stopPropagation();
              navigator.clipboard.writeText(codeText);
              btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg> <span style="color:#10b981">COPIED</span>`;
              setTimeout(() => {
                btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg> <span>COPY</span>`;
              }, 2000);
            });
            
            pre.style.position = 'relative';
            pre.appendChild(btn);
          });
        }}
      />
    </div>
  );
};
