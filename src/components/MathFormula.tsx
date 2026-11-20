import { useMemo } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";

/** Fixed, developer-authored TeX only; includes MathML for assistive readers. */
export default function MathFormula({
  tex,
  label,
}: {
  tex: string;
  label: string;
}) {
  const html = useMemo(
    () =>
      katex.renderToString(tex, {
        displayMode: true,
        throwOnError: true,
        strict: "error",
        output: "htmlAndMathml",
        trust: false,
      }),
    [tex],
  );
  return (
    <div
      className="math-formula"
      role="group"
      aria-label={label}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
