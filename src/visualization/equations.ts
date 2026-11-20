/** Presentation-only TeX. Numerical physics lives exclusively in science/. */
export const equations = {
  horizontal: "d(t) = v_0\\cos\\theta\\,t",
  vertical: "y(t) = h_0 + v_0\\sin\\theta\\,t - \\frac{1}{2}gt^2",
  required:
    "v_0 = \\sqrt{\\frac{g d^2}{2\\cos^2\\theta\\left(d\\tan\\theta-\\Delta h\\right)}}",
  angle:
    "\\theta^{\\star}=\\arctan\\!\\left(\\frac{\\Delta h+\\sqrt{d^2+\\Delta h^2}}{d}\\right)",
  minimum:
    "v_{\\min}=\\sqrt{g\\left(\\Delta h+\\sqrt{d^2+\\Delta h^2}\\right)}",
  sphere: "\\sqrt{x(t_c)^2+z(t_c)^2}<R_{\\mathrm{inner}}-r_{\\mathrm{ball}}",
  error:
    "\\begin{aligned}\\theta_{\\mathrm{actual}}&=\\theta_{\\mathrm{intended}}+\\varepsilon_{\\theta}\\\\v_{\\mathrm{actual}}&=v_{\\mathrm{intended}}+\\varepsilon_v\\\\\\phi_{\\mathrm{actual}}&=\\phi_{\\mathrm{intended}}+\\varepsilon_{\\phi}\\end{aligned}",
  normal: "\\varepsilon_i\\sim\\mathcal{N}(0,\\sigma_i^2)",
  probability:
    "\\widehat{p}=\\frac{\\text{clean baskets}}{\\text{simulated shots}}",
} as const;
