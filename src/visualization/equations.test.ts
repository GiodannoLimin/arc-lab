import { test } from "node:test";
import assert from "node:assert/strict";
import katex from "katex";
import { equations } from "./equations";

test("every displayed scientific equation typesets with accessible MathML and no TeX errors", () => {
  for (const [name, tex] of Object.entries(equations)) {
    const html = katex.renderToString(tex, {
      displayMode: true,
      throwOnError: true,
      strict: "error",
      output: "htmlAndMathml",
      trust: false,
    });
    assert.ok(html.includes("<math"), name + " has semantic math");
    assert.ok(html.includes("katex-html"), name + " has typeset layout");
    assert.ok(!html.includes("katex-error"), name + " renders without errors");
  }
});
