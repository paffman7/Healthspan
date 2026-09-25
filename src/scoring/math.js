// Generic helpers: tiers, piecewise-linear interpolation, clamping.
// No station knowledge and no numbers live here.

export const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

export const roundTo = (x, decimals) => {
  const f = 10 ** decimals;
  return Math.round((x + Number.EPSILON) * f) / f;
};

export function ageBand(age) {
  if (age < 40) return 'under40';
  if (age < 60) return '40to59';
  return '60plus';
}

/**
 * Tier from four thresholds [elite, strong, good, fair].
 * higher_is_better: first tier with result >= threshold.
 * lower_is_better : first tier with result <  threshold.
 * null thresholds are skipped. Nothing matched = at_risk.
 */
export function tierFromThresholds(value, thresholds, direction, tierOrder) {
  for (let i = 0; i < thresholds.length; i++) {
    const t = thresholds[i];
    if (t === null || t === undefined) continue;
    const hit = direction === 'lower_is_better' ? value < t : value >= t;
    if (hit) return tierOrder[i];
  }
  return tierOrder[tierOrder.length - 1];
}

/** The worse of two tiers (used for caps). */
export function worseTier(a, b, tierOrder) {
  return tierOrder.indexOf(a) >= tierOrder.indexOf(b) ? a : b;
}

/** The better of two tiers. */
export function betterTier(a, b, tierOrder) {
  return tierOrder.indexOf(a) <= tierOrder.indexOf(b) ? a : b;
}

/**
 * Piecewise-linear lookup through points [[x, y], ...] sorted by x.
 * Outside the range, the nearest segment is extended.
 */
export function interpolate(points, x) {
  if (points.length === 0) return null;
  if (points.length === 1) return points[0][1];
  let i;
  if (x <= points[0][0]) i = 0;
  else if (x >= points[points.length - 1][0]) i = points.length - 2;
  else i = points.findIndex((p, k) => k < points.length - 1 && x >= p[0] && x <= points[k + 1][0]);
  const [x1, y1] = points[i];
  const [x2, y2] = points[i + 1];
  if (x2 === x1) return y1;
  return y1 + ((x - x1) * (y2 - y1)) / (x2 - x1);
}

/**
 * Median points for functional age: anchor each median at its decade age,
 * optionally drop zeros, then merge runs of equal neighbours into one point
 * at their average age. Returns [[age, median], ...].
 */
export function medianCurve(medians, anchorAges, { dropZeros = false } = {}) {
  let pts = medians.map((m, i) => [anchorAges[i], m]);
  if (dropZeros) pts = pts.filter(([, m]) => m !== 0);
  const merged = [];
  let run = [];
  for (const p of pts) {
    if (run.length && run[0][1] !== p[1]) {
      merged.push([run.reduce((s, r) => s + r[0], 0) / run.length, run[0][1]]);
      run = [];
    }
    run.push(p);
  }
  if (run.length) merged.push([run.reduce((s, r) => s + r[0], 0) / run.length, run[0][1]]);
  return merged;
}

/**
 * Functional age: read the age off the median curve for a result
 * (linear between points, extended beyond the ends), then clamp.
 */
export function functionalAge(value, curve, clampMin, clampMax) {
  // Swap to [median, age] and sort by median so interpolate() can walk it.
  const inverse = curve.map(([age, m]) => [m, age]).sort((a, b) => a[0] - b[0]);
  const age = interpolate(inverse, value);
  return age === null ? null : clamp(age, clampMin, clampMax);
}

/**
 * Parse a linear formula such as
 * "VO2max = 132.853 - 0.0769*weight_lb - 0.3877*age + 6.315*sex"
 * into { intercept, coefficients: { weight_lb: -0.0769, ... } }.
 */
export function parseLinearFormula(expression) {
  const rhs = expression.split('=').pop().replace(/\s+/g, '');
  const terms = rhs.match(/[+-]?[^+-]+/g) || [];
  const out = { intercept: 0, coefficients: {} };
  for (const term of terms) {
    const [num, variable] = term.split('*');
    const n = Number(num);
    if (Number.isNaN(n)) throw new Error(`Cannot parse formula term "${term}"`);
    if (variable) out.coefficients[variable] = n;
    else out.intercept += n;
  }
  return out;
}

export function evaluateLinearFormula(parsed, vars) {
  let y = parsed.intercept;
  for (const [name, c] of Object.entries(parsed.coefficients)) {
    if (!(name in vars)) throw new Error(`Missing formula variable "${name}"`);
    y += c * vars[name];
  }
  return y;
}
