"use client";

import { Highlight, themes } from "prism-react-renderer";

export function CodeBlock({ code, language, className = "" }: { code: string; language?: string | null; className?: string }) {
  return (
    <Highlight code={code.trimEnd()} language={(language ?? "python").toLowerCase()} theme={themes.nightOwl}>
      {({ style, tokens, getLineProps, getTokenProps }) => (
        <pre
          style={style}
          className={`overflow-x-auto rounded-xl border border-white/10 p-4 text-left font-mono text-sm leading-relaxed ${className}`}
        >
          {tokens.map((line, i) => (
            <div key={i} {...getLineProps({ line })}>
              <span className="mr-4 inline-block w-5 select-none text-right text-slate-500">{i + 1}</span>
              {line.map((token, key) => (
                <span key={key} {...getTokenProps({ token })} />
              ))}
            </div>
          ))}
        </pre>
      )}
    </Highlight>
  );
}
