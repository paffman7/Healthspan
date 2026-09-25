// Primedy Healthspan scoring engine. Pure functions, no UI.
// Every number comes from scoring-tables.json; every owner decision from config.js.

import defaultTables from '../../scoring-tables.json';
import defaultConfig from '../config.js';
import {
  ageBand,
  betterTier,
  clamp,
  evaluateLinearFormula,
  functionalAge,
  interpolate,
  medianCurve,
  parseLinearFormula,
  roundTo,
  tierFromThresholds,
  worseTier,
} from './math.js';

export const STATION_KEYS = [
  'body_composition',
  'sitting_rising',
  'single_leg_stance',
  'grip_strength',
  'deadlift',
  'strict_press',
  'push_ups',
  'pull_ups',
  'cardio',
  'jump',
];

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

// ---------------------------------------------------------------------------
// Calculated values
// ---------------------------------------------------------------------------

export function estimated1rm(weight, reps, tables = defaultTables) {
  return weight * (1 + tables.formulas.estimated1rm.repCoefficient * reps);
}

export function strengthRatio(weightLb, reps, bodyweightLb, tables = defaultTables) {
  const f = tables.formulas.estimated1rm;
  return roundTo(estimated1rm(weightLb, reps, tables) / bodyweightLb, f.ratioDecimals);
}

export function gripFromScale(squeezeLb, emptyLb, tables = defaultTables) {
  return (squeezeLb - emptyLb) / tables.formulas.lbPerKg;
}

export function vo2FromTime(variant, timeSeconds, sex, age, tables = defaultTables) {
  const pairs = tables.stations.cardio.timeToVo2[variant][sex][ageBand(age)];
  const { min, max } = tables.formulas.vo2EstimateClamp;
  return clamp(interpolate(pairs, timeSeconds), min, max);
}

export function vo2FromRockport({ weightLb, age, timeSeconds, finishHr, sex }, tables = defaultTables) {
  const parsed = parseLinearFormula(tables.stations.cardio.rockportFormula.expression);
  return evaluateLinearFormula(parsed, {
    weight_lb: weightLb,
    age,
    time_min: timeSeconds / 60,
    finish_hr: finishHr,
    sex: sex === 'male' ? 1 : 0,
  });
}

// ---------------------------------------------------------------------------
// Table lookups
// ---------------------------------------------------------------------------

function pickTiers(tiers, sex, band) {
  const bySex = tiers[sex] ?? tiers.all;
  return Array.isArray(bySex) ? bySex : bySex[band];
}

function pickMedians(medians, sex) {
  return medians[sex] ?? medians.all;
}

/** Tier + functional age for one table ({tiers, medians}) and one result. */
function rate(value, { tiers, medians, direction, dropZeroMedians = false }, athlete, tables) {
  const band = ageBand(athlete.age);
  const tier = tierFromThresholds(value, pickTiers(tiers, athlete.sex, band), direction, tables.tierOrder);
  let age = null;
  if (medians) {
    const fa = tables.functionalAge;
    const curve = medianCurve(pickMedians(medians, athlete.sex), fa.anchorAges, { dropZeros: dropZeroMedians });
    age = functionalAge(value, curve, fa.clampMin, fa.clampMax);
  }
  return { tier, age };
}

function result(stationKey, tables, fields) {
  const tier = fields.tier ?? null;
  return {
    station: stationKey,
    name: tables.stations[stationKey].name,
    tested: tier !== null,
    points: tier ? tables.tierPoints[tier] : tables.tierPoints.not_tested,
    age: null,
    includeInAge: true,
    calculated: null,
    notes: [],
    ...fields,
  };
}

const notTested = (stationKey, tables) =>
  result(stationKey, tables, { tier: null, points: tables.tierPoints.not_tested, age: null, includeInAge: false });

// ---------------------------------------------------------------------------
// Stations
// ---------------------------------------------------------------------------

const scorers = {
  body_composition(input, athlete, tables, config) {
    const st = tables.stations.body_composition;
    if (input.version === 'tape') {
      const home = st.atHome;
      if (!isNum(input.waistCm) || !isNum(athlete.heightCm)) return null;
      const whtr = input.waistCm / athlete.heightCm;
      let tier = tierFromThresholds(whtr, home[config.atHomeBodyComp.tiersKey], 'lower_is_better', tables.tierOrder);
      const notes = [];
      const calfTarget = home.calfCircumferenceTargetCm[athlete.sex];
      if (isNum(input.calfCm) && input.calfCm < calfTarget) {
        const capped = worseTier(tier, config.atHomeBodyComp.calfCapTier, tables.tierOrder);
        if (capped !== tier) notes.push(`Capped: calf under ${calfTarget} cm`);
        tier = capped;
      }
      return {
        tier,
        age: null,
        includeInAge: config.atHomeBodyComp.includeInHealthspanAge,
        variant: 'tape',
        calculated: { label: 'Waist-to-height', value: roundTo(whtr, 2), text: `waist-to-height ${whtr.toFixed(2)}` },
        notes,
      };
    }
    // InBody
    if (!isNum(input.bodyFatPercent)) return null;
    let { tier, age } = rate(input.bodyFatPercent, st, athlete, tables);
    const notes = [];
    const asmiLine = st.asmiSarcopeniaThreshold[athlete.sex];
    if (isNum(input.asmi) && input.asmi < asmiLine) {
      const capped = worseTier(tier, config.asmiCap, tables.tierOrder);
      if (capped !== tier) notes.push(`Capped: ASMI below ${asmiLine}`);
      tier = capped;
    }
    return { tier, age, variant: 'inbody', notes };
  },

  sitting_rising(input, athlete, tables) {
    if (!isNum(input.score)) return null;
    return rate(input.score, tables.stations.sitting_rising, athlete, tables);
  },

  single_leg_stance(input, athlete, tables) {
    if (!isNum(input.seconds)) return null;
    return rate(input.seconds, tables.stations.single_leg_stance, athlete, tables);
  },

  grip_strength(input, athlete, tables) {
    let kg;
    let calculated = null;
    if (input.version === 'scale') {
      if (!isNum(input.squeezeLb) || !isNum(input.emptyLb)) return null;
      kg = gripFromScale(input.squeezeLb, input.emptyLb, tables);
      calculated = { label: 'Grip', value: roundTo(kg, 1), text: `${kg.toFixed(1)} kg` };
    } else {
      if (!isNum(input.kg)) return null;
      kg = input.kg;
    }
    return { ...rate(kg, tables.stations.grip_strength, athlete, tables), variant: input.version ?? 'dynamometer', calculated };
  },

  deadlift(input, athlete, tables) {
    return liftScorer('deadlift', input, athlete, tables);
  },

  strict_press(input, athlete, tables) {
    return liftScorer('strict_press', input, athlete, tables);
  },

  push_ups(input, athlete, tables) {
    const variant = input.version ?? 'full';
    if (!isNum(input.reps)) return null;
    const table = { ...tables.stations.push_ups.variants[variant], direction: tables.stations.push_ups.direction };
    return { ...rate(input.reps, table, athlete, tables), variant };
  },

  pull_ups(input, athlete, tables, config) {
    const st = tables.stations.pull_ups;
    const direction = st.direction;
    const reps = isNum(input.reps) ? input.reps : null;
    let hang = isNum(input.hangSeconds) ? input.hangSeconds : null;

    // 0 pull-ups routes to the hang. With no hang entered, 0 reps = "cannot hang" = 0 s.
    if (reps === 0 && hang === null) hang = 0;

    const pull =
      reps !== null && reps >= 1
        ? { variant: 'pull_ups', ...rate(reps, { ...st.variants.pull_ups, direction, dropZeroMedians: true }, athlete, tables) }
        : null;
    const hng = hang !== null ? { variant: 'dead_hang', ...rate(hang, { ...st.variants.dead_hang, direction }, athlete, tables) } : null;

    if (!pull && !hng) return null;
    if (!pull) return { ...hng, components: { dead_hang: hng } };
    if (!hng) return { ...pull, components: { pull_ups: pull } };

    const components = { pull_ups: pull, dead_hang: hng };
    if (config.pullUpPolicy === 'scorecard') return { ...pull, components };

    // best_of_both: better tier and younger age, possibly from different tests.
    const tier = betterTier(pull.tier, hng.tier, tables.tierOrder);
    const age = Math.min(pull.age, hng.age);
    const tierFrom = tier === pull.tier ? 'pull_ups' : 'dead_hang';
    const ageFrom = age === pull.age ? 'pull_ups' : 'dead_hang';
    return { tier, age, variant: 'both', tierFrom, ageFrom, components };
  },

  cardio(input, athlete, tables) {
    const st = tables.stations.cardio;
    const variant = input.version ?? 'mile_run';
    const band = ageBand(athlete.age);
    let vo2;
    let tier;
    if (variant === 'mile_run' || variant === 'row_2k') {
      if (!isNum(input.timeSeconds)) return null;
      const v = st.variants[variant];
      tier = tierFromThresholds(input.timeSeconds, pickTiers(v.tiers, athlete.sex, band), v.direction, tables.tierOrder);
      vo2 = vo2FromTime(variant, input.timeSeconds, athlete.sex, athlete.age, tables);
    } else {
      if (variant === 'rockport_walk') {
        if (!isNum(input.timeSeconds) || !isNum(input.finishHr) || !isNum(athlete.bodyweightLb)) return null;
        vo2 = vo2FromRockport(
          { weightLb: athlete.bodyweightLb, age: athlete.age, timeSeconds: input.timeSeconds, finishHr: input.finishHr, sex: athlete.sex },
          tables,
        );
      } else {
        if (!isNum(input.vo2max)) return null;
        vo2 = input.vo2max;
      }
      const vt = st.vo2maxTiers;
      tier = tierFromThresholds(vo2, pickTiers(vt.tiers, athlete.sex, band), vt.direction, tables.tierOrder);
    }
    const fa = tables.functionalAge;
    const curve = medianCurve(pickMedians(st.medians, athlete.sex), fa.anchorAges);
    const age = functionalAge(vo2, curve, fa.clampMin, fa.clampMax);
    return {
      tier,
      age,
      variant,
      vo2,
      calculated: { label: 'Est. VO₂ max', value: roundTo(vo2, 1), text: `est. VO₂ ${vo2.toFixed(1)}` },
    };
  },

  jump(input, athlete, tables) {
    const variant = input.version ?? 'vertical';
    if (!isNum(input.inches)) return null;
    const table = { ...tables.stations.jump.variants[variant], direction: tables.stations.jump.direction };
    return { ...rate(input.inches, table, athlete, tables), variant };
  },
};

function liftScorer(key, input, athlete, tables) {
  if (!isNum(input.weightLb) || !isNum(athlete.bodyweightLb) || athlete.bodyweightLb <= 0) return null;
  const reps = isNum(input.reps) ? input.reps : 3;
  const ratio = strengthRatio(input.weightLb, reps, athlete.bodyweightLb, tables);
  return {
    ...rate(ratio, tables.stations[key], athlete, tables),
    variant: input.version,
    ratio,
    calculated: { label: 'Est. 1RM ÷ bodyweight', value: ratio, text: `${ratio.toFixed(2)}× bodyweight` },
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Score one station.
 * athlete: { sex: 'male'|'female', age, bodyweightLb, heightCm }
 * input: station-specific fields, or null / { notTested: true }.
 */
export function scoreStation(stationKey, input, athlete, { tables = defaultTables, config = defaultConfig } = {}) {
  if (!input || input.notTested) return notTested(stationKey, tables);
  const scored = scorers[stationKey](input, athlete, tables, config);
  if (!scored) return notTested(stationKey, tables);
  return result(stationKey, tables, scored);
}

export function bandForScore(score, { tables = defaultTables, config = defaultConfig } = {}) {
  const band = tables.healthspanBands.find((b) => score >= b.min && score <= b.max) ?? tables.healthspanBands.at(-1);
  const override = config.bandWording === 'softened' ? config.bandDescriptionOverrides?.[band.key] : null;
  return { ...band, description: override ?? band.description };
}

/**
 * Score a whole session.
 * session: { athlete, inputs: { [stationKey]: input } }
 */
export function scoreSession(session, opts = {}) {
  const { tables = defaultTables } = opts;
  const { athlete, inputs = {} } = session;
  const stations = STATION_KEYS.map((k) => scoreStation(k, inputs[k], athlete, opts));

  const score = stations.reduce((s, r) => s + r.points, 0);
  const tested = stations.filter((r) => r.tested);
  const aged = tested.filter((r) => r.includeInAge && isNum(r.age));
  const healthspanAge = aged.length ? aged.reduce((s, r) => s + r.age, 0) / aged.length : null;
  const difference = healthspanAge === null ? null : healthspanAge - athlete.age;

  // Focus next: lowest points; ties go to the station furthest above real age.
  const gap = (r) => (isNum(r.age) ? r.age - athlete.age : -Infinity);
  const focus = [...tested]
    .sort((a, b) => a.points - b.points || gap(b) - gap(a))
    .slice(0, 2)
    .map((r) => r.station);

  return {
    stations,
    score,
    maxScore: STATION_KEYS.length * tables.tierPoints[tables.tierOrder[0]],
    band: bandForScore(score, opts),
    healthspanAge,
    difference,
    testedCount: tested.length,
    ageCount: aged.length,
    stationCount: STATION_KEYS.length,
    focus,
  };
}

/** One results object per session, dated, so history can be added later. */
export function buildResultsRecord(session, opts = {}) {
  const scored = scoreSession(session, opts);
  return {
    schemaVersion: 1,
    id: session.id ?? `hs-${Date.now()}`,
    testDate: session.testDate,
    createdAt: new Date().toISOString(),
    athlete: session.athlete,
    inputs: session.inputs,
    results: scored,
  };
}
