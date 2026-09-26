import config from '../config.js';

// Concept2 / Hagerman row formula needs the athlete's training level.
const TRAINING_LEVEL = {
  name: 'highlyTrained',
  label: 'Training level',
  kind: 'choice',
  defaultValue: 'no',
  options: [
    {
      value: 'no',
      label: 'Not highly trained',
      description: 'Most people, including regular gym-goers who row now and then. Not sure? Choose this.',
    },
    {
      value: 'yes',
      label: 'Highly trained',
      description:
        'You do rowing or endurance training 4+ times a week, have for a year or more, and have raced or tested a 2K before.',
    },
  ],
  note: 'For highly trained rowers the formula changes at 165 lb (men) and 135 lb (women), so estimates can jump slightly near those weights.',
};

// What the athlete sees for each station: names, how-to reminders, versions and
// input fields. `check` is a soft "Double-check this?" range, not a scoring number.

export const STATIONS = [
  {
    key: 'body_composition',
    title: 'Body Composition',
    how: 'InBody scan for body fat % and muscle mass, or a tape measure at home.',
    versions: [
      {
        id: 'inbody',
        label: 'InBody',
        fields: [
          { name: 'bodyFatPercent', label: 'Body fat', unit: '%', step: 0.1, check: [4, 55] },
          { name: 'asmi', label: 'ASMI (skeletal muscle index)', unit: 'kg/m²', step: 0.1, optional: true, check: [3.5, 13] },
        ],
      },
      {
        id: 'tape',
        label: 'Tape measure',
        note: 'Waist at the navel, calf at its widest point.',
        fields: [
          { name: 'waistCm', label: 'Waist', unit: 'cm', step: 0.5, check: [50, 170] },
          { name: 'calfCm', label: 'Calf', unit: 'cm', step: 0.5, optional: true, check: [22, 55] },
        ],
      },
    ],
  },
  {
    key: 'sitting_rising',
    title: 'Sitting-Rising Test',
    how: 'Sit to the floor and stand back up without hands. Start at 10, lose a point for each support used.',
    versions: [
      {
        id: 'standard',
        fields: [{ name: 'score', label: 'Score', unit: 'of 10', step: 0.5, min: 0, max: 10, check: [0, 10], halfSteps: true }],
      },
    ],
  },
  {
    key: 'single_leg_stance',
    title: 'Single-Leg Stance',
    how: 'Stand on one leg, eyes open, hands on hips. Record your best hold.',
    versions: [{ id: 'standard', fields: [{ name: 'seconds', label: 'Best hold', unit: 'seconds', step: 1, check: [0, 180] }] }],
  },
  {
    key: 'grip_strength',
    title: 'Grip Strength',
    how: 'Squeeze as hard as you can with your dominant hand. Best of 3.',
    versions: [
      { id: 'dynamometer', label: 'Dynamometer', fields: [{ name: 'kg', label: 'Grip', unit: 'kg', step: 0.5, check: [8, 85] }] },
      {
        id: 'scale',
        label: 'Bathroom scale',
        note: 'Squeeze the scale between both palms, then note what it reads with nothing on it.',
        fields: [
          { name: 'squeezeLb', label: 'Squeeze reading', unit: 'lb', step: 0.5, check: [15, 200] },
          { name: 'emptyLb', label: 'Empty reading', unit: 'lb', step: 0.5, defaultValue: '0', check: [0, 20] },
        ],
      },
    ],
  },
  {
    key: 'deadlift',
    title: 'Deadlift',
    how: 'Heaviest weight you can lift for 3 good reps.',
    versions: [
      {
        id: 'barbell',
        fields: [
          { name: 'weightLb', label: 'Weight', unit: 'lb', step: 5, check: [30, 700] },
          { name: 'reps', label: 'Reps', unit: 'reps', step: 1, defaultValue: '3', check: [1, 10] },
        ],
      },
    ],
  },
  {
    key: 'strict_press',
    title: 'Strict Press',
    how: 'Overhead press with no leg drive. Heaviest weight for 3 good reps.',
    versions: [
      {
        id: 'barbell',
        label: 'Barbell',
        fields: [
          { name: 'weightLb', label: 'Weight', unit: 'lb', step: 5, check: [15, 300] },
          { name: 'reps', label: 'Reps', unit: 'reps', step: 1, defaultValue: '3', check: [1, 10] },
        ],
      },
      {
        id: 'dumbbells',
        label: 'Dumbbells / KBs',
        fields: [
          { name: 'weightLb', label: 'Weight (total of both)', unit: 'lb', step: 5, check: [10, 250] },
          { name: 'reps', label: 'Reps', unit: 'reps', step: 1, defaultValue: '3', check: [1, 10] },
        ],
      },
    ],
  },
  {
    key: 'push_ups',
    title: 'Push-Ups',
    how: 'As many good-form reps as you can without stopping.',
    versions: [
      { id: 'full', label: 'Full', fields: [{ name: 'reps', label: 'Reps', unit: 'reps', step: 1, check: [0, 100] }] },
      { id: 'knee', label: 'Knee', fields: [{ name: 'reps', label: 'Reps', unit: 'reps', step: 1, check: [0, 100] }] },
    ],
  },
  {
    key: 'pull_ups',
    title: 'Pull-Ups / Dead Hang',
    how: 'Strict pull-ups from a dead hang. No pull-ups? Hang from the bar as long as you can.',
    versions: [
      { id: 'pull_ups', label: 'Pull-ups', fields: [{ name: 'reps', label: 'Pull-ups', unit: 'reps', step: 1, check: [0, 40] }] },
      { id: 'dead_hang', label: 'Dead hang', fields: [{ name: 'hangSeconds', label: 'Hang', unit: 'seconds', step: 1, check: [0, 240] }] },
      {
        id: 'both',
        label: 'Both',
        fields: [
          { name: 'reps', label: 'Pull-ups', unit: 'reps', step: 1, check: [0, 40] },
          { name: 'hangSeconds', label: 'Hang', unit: 'seconds', step: 1, check: [0, 240] },
        ],
      },
    ],
  },
  {
    key: 'cardio',
    title: 'Cardio',
    how: 'Run a mile or row 2,000 m as fast as you can, or do the Rockport 1-mile walk at home.',
    versions: [
      { id: 'mile_run', label: '1-mile run', fields: [{ name: 'timeSeconds', label: 'Time', unit: 'mm:ss', kind: 'time', check: [240, 1500] }] },
      {
        id: 'row_2k',
        label: '2K row',
        fields: [
          { name: 'timeSeconds', label: 'Time', unit: 'mm:ss', kind: 'time', check: [330, 900] },
          ...(config.rowVo2Method === 'concept2' ? [TRAINING_LEVEL] : []),
        ],
      },
      {
        id: 'rockport_walk',
        label: 'Rockport walk',
        note: 'Walk 1 mile as fast as you can, then take your heart rate right away.',
        fields: [
          { name: 'timeSeconds', label: 'Time', unit: 'mm:ss', kind: 'time', check: [540, 1800] },
          { name: 'finishHr', label: 'Finish heart rate', unit: 'bpm', step: 1, check: [70, 200] },
        ],
      },
      { id: 'known_vo2', label: 'Known VO₂ max', fields: [{ name: 'vo2max', label: 'VO₂ max', unit: 'ml/kg/min', step: 0.1, check: [15, 85] }] },
    ],
  },
  {
    key: 'jump',
    title: 'Jump',
    how: 'Best of 3 jumps.',
    versions: [
      { id: 'vertical', label: 'Vertical', fields: [{ name: 'inches', label: 'Height', unit: 'in', step: 0.5, check: [2, 40] }] },
      { id: 'broad', label: 'Broad', fields: [{ name: 'inches', label: 'Distance', unit: 'in', step: 0.5, check: [15, 130] }] },
    ],
  },
];

export const stationByKey = Object.fromEntries(STATIONS.map((s) => [s.key, s]));

/** "8:30", "8.30", "8 30" or plain seconds → seconds. */
export function parseTime(text) {
  const t = String(text ?? '').trim();
  if (!t) return null;
  const m = t.match(/^(\d{1,3})\s*[:.\s]\s*(\d{1,2})$/);
  if (m) {
    const sec = Number(m[2]);
    return sec < 60 ? Number(m[1]) * 60 + sec : null;
  }
  return /^\d+$/.test(t) ? Number(t) * 60 : null; // "9" = 9 minutes
}

export function formatTime(seconds) {
  const s = Math.round(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function parseNumber(text) {
  const t = String(text ?? '').trim().replace(',', '.');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function parseField(field, text) {
  if (field.kind === 'choice') return text === 'yes';
  return field.kind === 'time' ? parseTime(text) : parseNumber(text);
}

export function versionOf(station, raw) {
  return station.versions.find((v) => v.id === raw?.version) ?? station.versions[0];
}

/** Raw form state for a station → engine input. */
export function toEngineInput(station, raw) {
  if (!raw || raw.notTested) return { notTested: true };
  const version = versionOf(station, raw);
  const input = { version: version.id };
  for (const f of version.fields) {
    const v = parseField(f, raw.values?.[f.name] ?? f.defaultValue);
    if (v !== null) input[f.name] = v;
  }
  return input;
}

/** Soft warnings for values that look unrealistic. Never blocks. */
export function checkField(field, text) {
  const t = String(text ?? '').trim();
  if (!t || field.kind === 'choice') return null;
  const v = parseField(field, t);
  if (v === null) return field.kind === 'time' ? 'Enter time as mm:ss, e.g. 8:30.' : 'Enter a number.';
  if (field.halfSteps && Math.abs(v * 2 - Math.round(v * 2)) > 1e-9) return 'Scores go in half points (e.g. 8.5).';
  if (field.check && (v < field.check[0] || v > field.check[1])) return 'Double-check this?';
  return null;
}

/** Plain-language summary of what was entered, for the results table. */
export function describeEntry(station, raw) {
  if (!raw || raw.notTested) return 'Not tested';
  const version = versionOf(station, raw);
  const val = (name) => {
    const f = version.fields.find((x) => x.name === name);
    return String(raw.values?.[name] ?? f?.defaultValue ?? '').trim();
  };
  const input = toEngineInput(station, raw);
  switch (station.key) {
    case 'body_composition':
      return version.id === 'tape'
        ? `Waist ${val('waistCm')} cm${val('calfCm') ? `, calf ${val('calfCm')} cm` : ''}`
        : `${val('bodyFatPercent')}% body fat${val('asmi') ? `, ASMI ${val('asmi')}` : ''}`;
    case 'sitting_rising':
      return `${val('score')} / 10`;
    case 'single_leg_stance':
      return `${val('seconds')} s`;
    case 'grip_strength':
      return version.id === 'scale' ? `Scale ${val('squeezeLb')} lb − ${val('emptyLb') || 0} lb` : `${val('kg')} kg`;
    case 'deadlift':
    case 'strict_press':
      return `${val('weightLb')} lb × ${val('reps') || 3}${version.id === 'dumbbells' ? ' (DBs)' : ''}`;
    case 'push_ups':
      return `${val('reps')} ${version.id === 'knee' ? 'knee ' : ''}push-ups`;
    case 'pull_ups': {
      const parts = [];
      if (val('reps') !== '') parts.push(`${val('reps')} pull-ups`);
      if (val('hangSeconds') !== '') parts.push(`${val('hangSeconds')} s hang`);
      return parts.join(', ');
    }
    case 'cardio':
      if (version.id === 'known_vo2') return `VO₂ max ${val('vo2max')}`;
      if (!('timeSeconds' in input)) return '';
      return `${formatTime(input.timeSeconds)} ${version.label.toLowerCase()}${version.id === 'rockport_walk' ? `, HR ${val('finishHr')}` : ''}${
        input.highlyTrained ? ', highly trained' : ''
      }`;
    case 'jump':
      return `${val('inches')} in ${version.label.toLowerCase()}`;
    default:
      return '';
  }
}
