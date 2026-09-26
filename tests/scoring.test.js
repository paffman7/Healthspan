import { describe, expect, it } from 'vitest';
import { bandForScore, scoreSession, scoreStation } from '../src/scoring/index.js';
import baseConfig from '../src/config.js';

// Part 4 answers assume the scorecard pull-up policy and the scorecard's
// time-to-VO2 pairs for the 2K row (they predate the Concept2 formula).
const scorecard = { config: { ...baseConfig, pullUpPolicy: 'scorecard', rowVo2Method: 'scorecard' } };
const bestOfBoth = { config: { ...baseConfig, pullUpPolicy: 'best_of_both' } };

const TOL = 0.1;
const closeTo = (actual, expected) => expect(Math.abs(actual - expected)).toBeLessThanOrEqual(TOL);
const mmss = (s) => {
  const [m, sec] = s.split(':').map(Number);
  return m * 60 + sec;
};

function expectStation(r, { tier, points, age }) {
  if (tier) expect(r.tier).toBe(tier);
  if (points !== undefined) expect(r.points).toBe(points);
  if (age !== undefined) closeTo(r.age, age);
}

describe('Athlete A: male, 47, 185 lb', () => {
  const athlete = { sex: 'male', age: 47, bodyweightLb: 185 };
  const inputs = {
    body_composition: { version: 'inbody', bodyFatPercent: 19.0 },
    sitting_rising: { score: 8.5 },
    single_leg_stance: { seconds: 34 },
    grip_strength: { version: 'dynamometer', kg: 47.5 },
    deadlift: { weightLb: 295, reps: 3 },
    strict_press: { version: 'barbell', weightLb: 115, reps: 3 },
    push_ups: { version: 'full', reps: 24 },
    pull_ups: { version: 'pull_ups', reps: 5 },
    cardio: { version: 'mile_run', timeSeconds: mmss('8:30') },
    jump: { version: 'vertical', inches: 17 },
  };
  const res = scoreSession({ athlete, inputs }, scorecard);
  const by = Object.fromEntries(res.stations.map((s) => [s.station, s]));

  const rows = [
    ['body_composition', 'good', 6, 38.3],
    ['sitting_rising', 'strong', 8, 50.0],
    ['single_leg_stance', 'strong', 8, 42.3],
    ['grip_strength', 'strong', 8, 40.0],
    ['deadlift', 'strong', 8, 29.8],
    ['strict_press', 'good', 6, 34.8],
    ['push_ups', 'strong', 8, 28.3],
    ['pull_ups', 'good', 6, 40.0],
    ['cardio', 'strong', 8, 45.0],
    ['jump', 'strong', 8, 41.7],
  ];
  it.each(rows)('%s → %s, %i pts, age %f', (key, tier, points, age) => {
    expectStation(by[key], { tier, points, age });
  });

  it('calculated values', () => {
    expect(by.deadlift.ratio).toBe(1.754);
    expect(by.strict_press.ratio).toBe(0.684);
    closeTo(by.cardio.vo2, 37.0);
  });

  it('totals: Strong, 74, age 39.0', () => {
    expect(res.score).toBe(74);
    expect(res.band.key).toBe('strong');
    closeTo(res.healthspanAge, 39.0);
    expect(res.testedCount).toBe(10);
  });
});

describe('Athlete B: female, 62, 150 lb', () => {
  const athlete = { sex: 'female', age: 62, bodyweightLb: 150 };
  const inputs = {
    body_composition: { version: 'inbody', bodyFatPercent: 31.0 },
    sitting_rising: { score: 6.0 },
    single_leg_stance: { seconds: 9 },
    grip_strength: { version: 'dynamometer', kg: 21.0 },
    deadlift: { weightLb: 125, reps: 3 },
    strict_press: { version: 'barbell', weightLb: 35, reps: 3 },
    push_ups: { version: 'full', reps: 6 },
    pull_ups: { version: 'both', reps: 0, hangSeconds: 28 },
    cardio: { version: 'mile_run', timeSeconds: mmss('11:15') },
    jump: { version: 'vertical', inches: 6.5 },
  };
  const res = scoreSession({ athlete, inputs }, scorecard);
  const by = Object.fromEntries(res.stations.map((s) => [s.station, s]));

  const rows = [
    ['body_composition', 'good', 6, 60.0],
    ['sitting_rising', 'fair', 4, 68.3],
    ['single_leg_stance', 'fair', 4, 69.3],
    ['grip_strength', 'good', 6, 70.0],
    ['deadlift', 'strong', 8, 54.1],
    ['strict_press', 'good', 6, 73.6],
    ['push_ups', 'good', 6, 55.0],
    ['pull_ups', 'good', 6, 57.0],
    ['cardio', 'strong', 8, 51.2],
    ['jump', 'good', 6, 62.5],
  ];
  it.each(rows)('%s → %s, %i pts, age %f', (key, tier, points, age) => {
    expectStation(by[key], { tier, points, age });
  });

  it('calculated values', () => {
    expect(by.deadlift.ratio).toBe(0.917);
    expect(by.strict_press.ratio).toBe(0.257);
    closeTo(by.cardio.vo2, 27.5);
    expect(by.pull_ups.variant).toBe('dead_hang');
  });

  it('totals: Good, 60, age 62.1', () => {
    expect(res.score).toBe(60);
    expect(res.band.key).toBe('good');
    closeTo(res.healthspanAge, 62.1);
  });
});

describe('Edge cases', () => {
  const m = (age = 47, extra = {}) => ({ sex: 'male', age, bodyweightLb: 185, ...extra });
  const f = (age = 47, extra = {}) => ({ sex: 'female', age, bodyweightLb: 150, ...extra });
  const s = (key, input, athlete, opts = scorecard) => scoreStation(key, input, athlete, opts);

  it('female grip 31 kg / 33 kg → age 30.0 / 20', () => {
    closeTo(s('grip_strength', { kg: 31 }, f()).age, 30.0);
    closeTo(s('grip_strength', { kg: 33 }, f()).age, 20);
  });

  it('male deadlift 1.60× → age 39.0', () => {
    // 1.60× bodyweight as a 1RM: bodyweight 100, weight chosen so ratio = 1.600.
    const r = s('deadlift', { weightLb: 160, reps: 0 }, m(47, { bodyweightLb: 100 }));
    expect(r.ratio).toBe(1.6);
    closeTo(r.age, 39.0);
  });

  it('SRT 10 / 3 → age 25.0 / 85', () => {
    closeTo(s('sitting_rising', { score: 10 }, m()).age, 25.0);
    closeTo(s('sitting_rising', { score: 3 }, m()).age, 85);
  });

  it('male push-ups 0 → age 85', () => {
    closeTo(s('push_ups', { version: 'full', reps: 0 }, m()).age, 85);
  });

  it('female pull-ups 1 / 2 → age 40.0 / 25.0', () => {
    closeTo(s('pull_ups', { version: 'pull_ups', reps: 1 }, f()).age, 40.0);
    closeTo(s('pull_ups', { version: 'pull_ups', reps: 2 }, f()).age, 25.0);
  });

  it('male pull-ups 1 → age 65.0', () => {
    closeTo(s('pull_ups', { version: 'pull_ups', reps: 1 }, m()).age, 65.0);
  });

  it('male body fat 22% / 12% → age 50.0 / 20', () => {
    closeTo(s('body_composition', { version: 'inbody', bodyFatPercent: 22 }, m()).age, 50.0);
    closeTo(s('body_composition', { version: 'inbody', bodyFatPercent: 12 }, m()).age, 20);
  });

  it('male 45, grip 44.5 kg → Good', () => {
    expect(s('grip_strength', { kg: 44.5 }, m(45)).tier).toBe('good');
  });

  it('male 35, mile 7:30 / 7:31 → Strong / Good', () => {
    expect(s('cardio', { version: 'mile_run', timeSeconds: mmss('7:30') }, m(35)).tier).toBe('strong');
    expect(s('cardio', { version: 'mile_run', timeSeconds: mmss('7:31') }, m(35)).tier).toBe('good');
  });

  it('male 35, 2K row 7:45 → VO₂ 40.0, Good, age 35.0', () => {
    const r = s('cardio', { version: 'row_2k', timeSeconds: mmss('7:45') }, m(35));
    closeTo(r.vo2, 40.0);
    expect(r.tier).toBe('good');
    closeTo(r.age, 35.0);
  });

  it('female 44, 2K row 10:00 → VO₂ 25.0, Fair, age 57.5', () => {
    const r = s('cardio', { version: 'row_2k', timeSeconds: mmss('10:00') }, f(44));
    closeTo(r.vo2, 25.0);
    expect(r.tier).toBe('fair');
    closeTo(r.age, 57.5);
  });

  it('male 52, mile 12:00 → VO₂ 22.7, At-Risk, age 75.7', () => {
    const r = s('cardio', { version: 'mile_run', timeSeconds: mmss('12:00') }, m(52));
    closeTo(r.vo2, 22.7);
    expect(r.tier).toBe('at_risk');
    closeTo(r.age, 75.7);
  });

  it('female 58, 160 lb, Rockport 15:30, HR 130 → VO₂ 27.1, Good, age 52.2', () => {
    const r = s('cardio', { version: 'rockport_walk', timeSeconds: mmss('15:30'), finishHr: 130 }, f(58, { bodyweightLb: 160 }));
    closeTo(r.vo2, 27.1);
    expect(r.tier).toBe('good');
    closeTo(r.age, 52.2);
  });
});

describe('Pull-up policy: best_of_both', () => {
  const athlete = { sex: 'male', age: 35, bodyweightLb: 185 };
  const input = { version: 'both', reps: 2, hangSeconds: 90 };

  it('pull-ups alone: At-Risk, age 60.0', () => {
    const r = scoreStation('pull_ups', { version: 'pull_ups', reps: 2 }, athlete, bestOfBoth);
    expect(r.tier).toBe('at_risk');
    closeTo(r.age, 60.0);
  });

  it('2 pull-ups + 90 s hang → Strong (from hang), age 20', () => {
    const r = scoreStation('pull_ups', input, athlete, bestOfBoth);
    expect(r.tier).toBe('strong');
    expect(r.tierFrom).toBe('dead_hang');
    expect(r.points).toBe(8);
    closeTo(r.age, 20);
  });

  it('same input under scorecard policy uses pull-ups', () => {
    const r = scoreStation('pull_ups', input, athlete, scorecard);
    expect(r.tier).toBe('at_risk');
    closeTo(r.age, 60.0);
  });
});

describe('Owner decisions and rules', () => {
  const m = { sex: 'male', age: 47, bodyweightLb: 185, heightCm: 180 };

  it('not tested: 0 points, left out of the age average', () => {
    const res = scoreSession({ athlete: m, inputs: { sitting_rising: { score: 10 }, jump: { notTested: true } } });
    expect(res.testedCount).toBe(1);
    expect(res.score).toBe(10);
    closeTo(res.healthspanAge, 25);
    expect(res.stations.find((s) => s.station === 'jump').points).toBe(0);
  });

  it('ASMI below the sarcopenia line caps body comp at Fair', () => {
    const r = scoreStation('body_composition', { version: 'inbody', bodyFatPercent: 12, asmi: 6.5 }, m);
    expect(r.tier).toBe('fair');
    closeTo(r.age, 20); // functional age is unchanged by the cap
    const r2 = scoreStation('body_composition', { version: 'inbody', bodyFatPercent: 12, asmi: 6.5 }, m, {
      config: { ...baseConfig, asmiCap: 'at_risk' },
    });
    expect(r2.tier).toBe('at_risk');
  });

  it('at-home body comp: waist-to-height tiers, calf cap, no functional age', () => {
    const r = scoreStation('body_composition', { version: 'tape', waistCm: 76, calfCm: 36 }, m); // 0.422
    expect(r.tier).toBe('elite');
    expect(r.age).toBeNull();
    const capped = scoreStation('body_composition', { version: 'tape', waistCm: 76, calfCm: 33 }, m);
    expect(capped.tier).toBe('fair');
    const res = scoreSession({ athlete: m, inputs: { body_composition: { version: 'tape', waistCm: 76 }, sitting_rising: { score: 10 } } });
    expect(res.score).toBe(20);
    expect(res.ageCount).toBe(1);
    closeTo(res.healthspanAge, 25);
  });

  it('bathroom-scale grip = (squeeze − empty) ÷ 2.2046', () => {
    const r = scoreStation('grip_strength', { version: 'scale', squeezeLb: 110, emptyLb: 5.28 }, m);
    closeTo(r.calculated.value, 47.5);
    expect(r.tier).toBe('strong');
  });

  it('known VO₂ max uses VO₂ tiers', () => {
    const r = scoreStation('cardio', { version: 'known_vo2', vo2max: 37 }, m);
    expect(r.tier).toBe('strong');
    closeTo(r.age, 45);
  });

  it('band wording: softened Strong text by default, scorecard text on request', () => {
    expect(scoreSession({ athlete: m, inputs: {} }).band.key).toBe('at_risk');
    expect(bandForScore(75).key).toBe('strong');
    expect(bandForScore(75).description).toMatch(/typically younger than chronological age/);
    expect(bandForScore(75, { config: { ...baseConfig, bandWording: 'scorecard' } }).description).toMatch(/10-15 years/);
  });

  it('focus next: two lowest points, ties to the station furthest above real age', () => {
    const res = scoreSession({
      athlete: m,
      inputs: {
        sitting_rising: { score: 6 }, // fair, age 68.3
        single_leg_stance: { seconds: 11 }, // fair, age 66.4
        push_ups: { reps: 9 }, // fair, age 65
        jump: { inches: 22 }, // elite
      },
    });
    expect(res.focus).toEqual(['sitting_rising', 'single_leg_stance']);
  });
});

describe("2K row VO₂: Concept2 / Hagerman formula (rowVo2Method: 'concept2')", () => {
  const concept2 = { config: { ...baseConfig, rowVo2Method: 'concept2' } };
  const row = (sex, age, bodyweightLb, time, highlyTrained) =>
    scoreStation('cardio', { version: 'row_2k', timeSeconds: mmss(time), highlyTrained }, { sex, age, bodyweightLb }, concept2);

  it('male 35, 185 lb, 7:45, not highly trained → VO₂ 44.39, Good (from time), age 20.4', () => {
    // Y = 10.7 − 0.9 × 7.75 = 3.725 L/min; 3725 / 83.915 kg = 44.39
    const r = row('male', 35, 185, '7:45', false);
    expect(r.vo2).toBe(44.39);
    expect(r.tier).toBe('good');
    closeTo(r.age, 20.4);
  });

  it('male > 75 kg, highly trained: 15.7 − 1.5 × t', () => {
    // Y = 15.7 − 11.625 = 4.075; 4075 / 83.915 = 48.56
    expect(row('male', 35, 185, '7:45', true).vo2).toBe(48.56);
  });

  it('male ≤ 75 kg, highly trained: 15.1 − 1.5 × t', () => {
    // 70 kg = 154.322 lb; Y = 15.1 − 11.25 = 3.85; 3850 / 70 = 55.00
    closeTo(row('male', 30, 70 * 2.2046, '7:30', true).vo2, 55.0);
  });

  it('female ≤ 61.36 kg, highly trained: 14.6 − 1.5 × t', () => {
    // 55 kg; Y = 14.6 − 1.5 × 7.6667 = 3.1; 3100 / 55 = 56.36
    closeTo(row('female', 30, 55 * 2.2046, '7:40', true).vo2, 56.36);
  });

  it('female > 61.36 kg, highly trained: 14.9 − 1.5 × t', () => {
    // 62 kg; Y = 14.9 − 12 = 2.9; 2900 / 62 = 46.77
    closeTo(row('female', 30, 62 * 2.2046, '8:00', true).vo2, 46.77);
  });

  it('female 44, 150 lb, 9:00, not highly trained → VO₂ 27.78, Strong (from time), age 50.6', () => {
    // Y = 10.26 − 0.93 × 9 = 1.89; 1890 / 68.039 = 27.78 → age 45 + (30 − 27.78) / 0.4 = 50.6
    const r = row('female', 44, 150, '9:00', false);
    closeTo(r.vo2, 27.78);
    expect(r.tier).toBe('strong');
    closeTo(r.age, 50.6);
    expect(r.notes).toEqual([]);
  });

  it('below 10 ml/kg/min is flagged and the age uses the clamped value', () => {
    // male 65, 185 lb, 11:15: Y = 10.7 − 10.125 = 0.575; 575 / 83.915 = 6.85
    const r = row('male', 65, 185, '11:15', false);
    closeTo(r.vo2, 6.85);
    expect(r.tier).toBe('fair');
    expect(r.notes.length).toBe(1);
    closeTo(r.age, 85);
  });

  it("'scorecard' method keeps the original time-to-VO₂ pairs", () => {
    const r = scoreStation('cardio', { version: 'row_2k', timeSeconds: mmss('7:45'), highlyTrained: true }, { sex: 'male', age: 35, bodyweightLb: 185 }, scorecard);
    closeTo(r.vo2, 40.0);
  });
});

describe('Run and row: default scorecard method agrees with the VO₂ tier table', () => {
  it.each(['row_2k', 'mile_run'])('%s tier matches the Known VO₂ tier for its own VO₂ estimate, every second', (version) => {
    let checked = 0;
    for (const sex of ['male', 'female'])
      for (const age of [30, 50, 65])
        for (let t = 300; t <= 1100; t += 1) {
          const a = { sex, age, bodyweightLb: 170 };
          const row = scoreStation('cardio', { version, timeSeconds: t }, a);
          const known = scoreStation('cardio', { version: 'known_vo2', vo2max: row.vo2 }, a);
          expect(`${sex} ${age} ${t}s: ${known.tier}`).toBe(`${sex} ${age} ${t}s: ${row.tier}`);
          checked++;
        }
    expect(checked).toBeGreaterThan(4000);
  });
});

describe('Elite cutoff second counts as Elite (matches the VO₂ table)', () => {
  const m35 = { sex: 'male', age: 35, bodyweightLb: 185 };
  it('male 35: 7:00 row is Elite, 7:01 is Strong', () => {
    expect(scoreStation('cardio', { version: 'row_2k', timeSeconds: mmss('7:00') }, m35).tier).toBe('elite');
    expect(scoreStation('cardio', { version: 'row_2k', timeSeconds: mmss('7:01') }, m35).tier).toBe('strong');
  });
  it('male 35: 6:30 mile is Elite, 6:31 is Strong', () => {
    expect(scoreStation('cardio', { version: 'mile_run', timeSeconds: mmss('6:30') }, m35).tier).toBe('elite');
    expect(scoreStation('cardio', { version: 'mile_run', timeSeconds: mmss('6:31') }, m35).tier).toBe('strong');
  });
});
