import './styles.css';
import tables from '../scoring-tables.json';
import config from './config.js';
import { buildResultsRecord, scoreStation } from './scoring/index.js';
import { STATIONS, checkField, describeEntry, toEngineInput, versionOf } from './ui/stations.js';
import { sendToHubspot } from './ui/hubspot.js';

const STORAGE_KEY = 'primedy-healthspan-draft';
const TIER_LABELS = { elite: 'Elite', strong: 'Strong', good: 'Good', fair: 'Fair', at_risk: 'At-Risk' };

const app = document.getElementById('app');
const announcer = document.getElementById('announcer');

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const freshState = () => ({
  step: 'about', // about | station | contact | results
  stationIndex: 0,
  about: { firstName: '', age: '', sex: '', bodyweightLb: '', heightUnit: 'ftin', heightFt: '', heightIn: '', heightCm: '', setting: '', testDate: today() },
  contact: { lastName: '', email: '' },
  stations: {}, // key -> { version, values: {name: text}, notTested }
  id: `hs-${Date.now()}`,
});

let state = load() ?? freshState();

function load() {
  try {
    const s = JSON.parse(sessionStorage.getItem(STORAGE_KEY));
    return s && s.about ? s : null;
  } catch {
    return null;
  }
}

function save() {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable (private mode, blocked iframe storage): keep going in memory */
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const num = (t) => {
  const n = Number(String(t ?? '').trim().replace(',', '.'));
  return String(t ?? '').trim() !== '' && Number.isFinite(n) ? n : null;
};

function heightCm(a) {
  if (a.heightUnit === 'cm') return num(a.heightCm);
  const ft = num(a.heightFt);
  const inch = num(a.heightIn) ?? 0;
  return ft === null ? null : (ft * 12 + inch) * tables.formulas.cmPerInch;
}

function athlete() {
  const a = state.about;
  return { sex: a.sex, age: num(a.age), bodyweightLb: num(a.bodyweightLb), heightCm: heightCm(a) };
}

function session() {
  return {
    id: state.id,
    testDate: state.about.testDate,
    setting: state.about.setting,
    firstName: state.about.firstName.trim(),
    athlete: athlete(),
    inputs: Object.fromEntries(STATIONS.map((s) => [s.key, toEngineInput(s, state.stations[s.key])])),
  };
}

const rawFor = (key) => (state.stations[key] ??= { version: STATIONS.find((s) => s.key === key).versions[0].id, values: {}, notTested: false });

const hasEntry = (station) => {
  const raw = state.stations[station.key];
  if (!raw) return false;
  if (raw.notTested) return true;
  return scoreStation(station.key, toEngineInput(station, raw), athlete()).tested;
};

const tierBadge = (tier) =>
  tier ? `<span class="badge badge--${tier}">${TIER_LABELS[tier]}</span>` : '<span class="badge badge--none">Not tested</span>';

const wholeYears = (age) => (age === null || age === undefined ? null : Math.round(age));

function go(step, stationIndex = state.stationIndex) {
  state.step = step;
  state.stationIndex = stationIndex;
  save();
  render();
  window.scrollTo(0, 0);
  postToParent({ type: 'primedy-healthspan:navigate' });
  app.querySelector('h1')?.focus();
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------

function render() {
  if (state.step === 'about') app.innerHTML = aboutView();
  else if (state.step === 'station') app.innerHTML = stationView();
  else if (state.step === 'contact') app.innerHTML = contactView();
  else app.innerHTML = resultsView();
  document.title = `${app.querySelector('h1')?.textContent ?? 'Healthspan'} | Primedy Healthspan Calculator`;
}

function field({ id, label, value, unit, type = 'text', inputmode = 'decimal', attrs = '', hint = '', error = '' }) {
  const describedBy = [hint && `${id}-hint`, `${id}-msg`].filter(Boolean).join(' ');
  return `
    <div class="field">
      <label for="${id}">${label}${unit ? ` <span class="unit">(${unit})</span>` : ''}</label>
      ${hint ? `<p class="hint" id="${id}-hint">${hint}</p>` : ''}
      <div class="input-wrap">
        <input id="${id}" name="${id}" type="${type}" inputmode="${inputmode}" value="${esc(value)}" ${attrs}
          aria-describedby="${describedBy}" ${error ? 'aria-invalid="true"' : ''} />
        ${unit ? `<span class="suffix" aria-hidden="true">${unit}</span>` : ''}
      </div>
      <p class="msg ${error ? 'msg--error' : ''}" id="${id}-msg">${esc(error)}</p>
    </div>`;
}

function radios({ name, legend, options, value, error = '' }) {
  return `
    <fieldset class="choice" ${error ? 'aria-invalid="true"' : ''} aria-describedby="${name}-msg">
      <legend>${legend}</legend>
      <div class="choice__options">
        ${options
          .map(
            (o) => `
          <label class="pill">
            <input type="radio" name="${name}" value="${o.value}" ${o.value === value ? 'checked' : ''} />
            <span>${o.label}</span>
          </label>`,
          )
          .join('')}
      </div>
      <p class="msg ${error ? 'msg--error' : ''}" id="${name}-msg">${esc(error)}</p>
    </fieldset>`;
}

// --- Step 1: About you -------------------------------------------------------

let aboutErrors = {};

function aboutView() {
  const a = state.about;
  const e = aboutErrors;
  return `
  <header class="brand"><span class="brand__mark">Primedy</span> Healthspan Challenge</header>
  <section class="card">
    <p class="eyebrow">Step 1 of 3</p>
    <h1 tabindex="-1">About you</h1>
    <p class="lede">Your age, sex and bodyweight set the norms each result is compared against.</p>
    <form id="about-form" novalidate>
      ${field({ id: 'firstName', label: 'First name', value: a.firstName, inputmode: 'text', attrs: 'autocomplete="given-name"', error: e.firstName })}
      <div class="row">
        ${field({ id: 'age', label: 'Age', unit: 'years', value: a.age, inputmode: 'numeric', error: e.age })}
        ${field({ id: 'bodyweightLb', label: 'Bodyweight', unit: 'lb', value: a.bodyweightLb, error: e.bodyweightLb })}
      </div>
      ${radios({ name: 'sex', legend: 'Sex', value: a.sex, error: e.sex, options: [{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }] })}
      <fieldset class="choice" aria-describedby="height-msg">
        <legend>Height</legend>
        <div class="choice__options choice__options--small">
          <label class="pill pill--small"><input type="radio" name="heightUnit" value="ftin" ${a.heightUnit === 'ftin' ? 'checked' : ''} /><span>ft / in</span></label>
          <label class="pill pill--small"><input type="radio" name="heightUnit" value="cm" ${a.heightUnit === 'cm' ? 'checked' : ''} /><span>cm</span></label>
        </div>
        <div class="row">
          ${
            a.heightUnit === 'cm'
              ? field({ id: 'heightCm', label: 'Height', unit: 'cm', value: a.heightCm })
              : field({ id: 'heightFt', label: 'Feet', unit: 'ft', value: a.heightFt, inputmode: 'numeric' }) +
                field({ id: 'heightIn', label: 'Inches', unit: 'in', value: a.heightIn })
          }
        </div>
        <p class="msg ${e.height ? 'msg--error' : ''}" id="height-msg">${esc(e.height ?? '')}</p>
      </fieldset>
      ${radios({ name: 'setting', legend: 'Where are you testing?', value: a.setting, error: e.setting, options: [{ value: 'in_gym', label: 'In-Gym' }, { value: 'at_home', label: 'At-Home' }] })}
      ${field({ id: 'testDate', label: 'Test date', type: 'date', value: a.testDate, inputmode: 'none', error: e.testDate })}
      <div class="actions">
        <button type="submit" class="btn btn--primary">Start entering results</button>
      </div>
    </form>
  </section>`;
}

function validateAbout() {
  const a = state.about;
  const e = {};
  if (!a.firstName.trim()) e.firstName = 'Please enter your first name.';
  const age = num(a.age);
  if (age === null) e.age = 'Please enter your age.';
  else if (age < 18 || age > 100) e.age = 'Enter an age between 18 and 100.';
  if (!a.sex) e.sex = 'Please choose one.';
  const bw = num(a.bodyweightLb);
  if (bw === null) e.bodyweightLb = 'Please enter your bodyweight.';
  else if (bw < 70 || bw > 500) e.bodyweightLb = 'Enter your bodyweight in pounds.';
  const h = heightCm(a);
  if (h === null) e.height = 'Please enter your height.';
  else if (h < 120 || h > 230) e.height = 'Double-check your height.';
  if (!a.setting) e.setting = 'Please choose one.';
  if (!a.testDate) e.testDate = 'Please enter the test date.';
  return e;
}

// --- Step 2: Stations --------------------------------------------------------

function stationView() {
  const i = state.stationIndex;
  const station = STATIONS[i];
  const raw = rawFor(station.key);
  const version = versionOf(station, raw);
  const pct = Math.round(((i + 1) / STATIONS.length) * 100);
  return `
  <header class="brand"><span class="brand__mark">Primedy</span> Healthspan Challenge</header>
  <section class="card">
    <div class="progress">
      <div class="progress__meta"><span>Station ${i + 1} of ${STATIONS.length}</span><span>${pct}%</span></div>
      <div class="progress__track" role="progressbar" aria-label="Stations completed" aria-valuemin="1" aria-valuemax="${STATIONS.length}" aria-valuenow="${i + 1}" aria-valuetext="Station ${i + 1} of ${STATIONS.length}">
        <span class="progress__bar" style="width:${pct}%"></span>
      </div>
      <ol class="progress__dots" aria-hidden="true">
        ${STATIONS.map((s, k) => `<li class="${k === i ? 'is-current' : hasEntry(s) ? 'is-done' : ''}"></li>`).join('')}
      </ol>
    </div>
    <p class="eyebrow">Step 2 of 3 · Enter results</p>
    <h1 tabindex="-1">${station.title}</h1>
    <p class="how">${station.how}</p>
    <form id="station-form" novalidate>
      ${
        station.versions.length > 1
          ? radios({ name: 'version', legend: 'Test version', value: version.id, options: station.versions.map((v) => ({ value: v.id, label: v.label })) })
          : ''
      }
      ${version.note ? `<p class="note">${version.note}</p>` : ''}
      <div class="row row--fields">
        ${version.fields
          .filter((f) => f.kind !== 'choice')
          .map((f) => {
            const value = raw.values[f.name] ?? f.defaultValue ?? '';
            return field({
              id: `f-${f.name}`,
              label: `${f.label}${f.optional ? ' <span class="optional">optional</span>' : ''}`,
              unit: f.unit,
              value,
              inputmode: f.kind === 'time' ? 'text' : f.step && f.step % 1 === 0 ? 'numeric' : 'decimal',
              attrs: `data-field="${f.name}" autocomplete="off" ${f.kind === 'time' ? 'placeholder="mm:ss" ' : ''}`,
              error: '',
            });
          })
          .join('')}
      </div>
      ${version.fields
        .filter((f) => f.kind === 'choice')
        .map((f) => choiceField(f, raw.values[f.name] ?? f.defaultValue))
        .join('')}
      <div class="live" id="live" aria-live="polite">${liveResult(station)}</div>
      <div class="actions actions--station">
        <button type="button" class="btn btn--ghost" data-action="back">Back</button>
        <button type="button" class="btn btn--secondary" data-action="skip" aria-pressed="${raw.notTested}">${raw.notTested ? 'Marked: didn’t test' : 'Didn’t test this'}</button>
        <button type="submit" class="btn btn--primary">${i === STATIONS.length - 1 ? 'See my results' : 'Next'}</button>
      </div>
      <p class="msg msg--error" id="station-msg" role="alert"></p>
    </form>
  </section>`;
}

function choiceField(f, value) {
  return `
    <fieldset class="choice">
      <legend>${f.label}</legend>
      <div class="choice__cards">
        ${f.options
          .map(
            (o) => `
          <label class="pill pill--card">
            <input type="radio" name="f-${f.name}" value="${o.value}" data-field="${f.name}" ${o.value === value ? 'checked' : ''} />
            <span><strong>${o.label}</strong><small>${o.description}</small></span>
          </label>`,
          )
          .join('')}
      </div>
      ${f.note ? `<p class="hint">${f.note}</p>` : ''}
    </fieldset>`;
}

function liveResult(station) {
  const raw = rawFor(station.key);
  if (raw.notTested) return `<p class="live__empty">Marked as not tested: 0 points, left out of your Healthspan Age.</p>`;
  const r = scoreStation(station.key, toEngineInput(station, raw), athlete());
  const hint =
    station.key === 'pull_ups' && raw.version === 'pull_ups' && num(raw.values.reps) === 0
      ? '<p class="note">0 pull-ups? Choose <strong>Dead hang</strong> or <strong>Both</strong> and enter your hang time.</p>'
      : '';
  if (!r.tested) return `<p class="live__empty">Enter your result to see your tier and functional age.</p>${hint}`;
  const age = wholeYears(r.age);
  return `
    <div class="live__grid">
      <div><span class="live__label">Tier</span>${tierBadge(r.tier)}</div>
      <div><span class="live__label">Points</span><strong>${r.points}</strong></div>
      <div><span class="live__label">Functional age</span><strong>${age ?? '—'}</strong></div>
    </div>
    ${r.calculated ? `<p class="live__calc">${r.calculated.text}</p>` : ''}
    ${pullUpNote(r)}
    ${r.notes.map((n) => `<p class="note note--warn">${n}</p>`).join('')}
    ${r.age === null ? '<p class="note">At-home body composition isn’t included in your Healthspan Age.</p>' : ''}
    ${hint}`;
}

function pullUpNote(r) {
  if (r.station !== 'pull_ups' || r.variant !== 'both') return '';
  const name = { pull_ups: 'pull-ups', dead_hang: 'hang' };
  if (r.tierFrom === r.ageFrom) return `<p class="live__calc">Scored on your ${name[r.tierFrom]} (the better of the two)</p>`;
  return `<p class="live__calc">Tier from your ${name[r.tierFrom]}, age from your ${name[r.ageFrom]}</p>`;
}

function updateStationFeedback(station, input) {
  const version = versionOf(station, rawFor(station.key));
  const f = version.fields.find((x) => x.name === input.dataset.field);
  const msg = input.id ? document.getElementById(`${input.id}-msg`) : null;
  if (msg) {
    const warn = f ? checkField(f, input.value) : null;
    msg.textContent = warn ?? '';
    msg.className = `msg ${warn ? 'msg--warn' : ''}`;
  }
  document.getElementById('live').innerHTML = liveResult(station);
  const skip = app.querySelector('[data-action="skip"]');
  skip.textContent = 'Didn’t test this';
  skip.setAttribute('aria-pressed', 'false');
}

// --- Optional HubSpot step ---------------------------------------------------

let contactErrors = {};

function contactView() {
  const c = state.contact;
  return `
  <header class="brand"><span class="brand__mark">Primedy</span> Healthspan Challenge</header>
  <section class="card">
    <p class="eyebrow">Almost there</p>
    <h1 tabindex="-1">Where should we send your results?</h1>
    <form id="contact-form" novalidate>
      ${field({ id: 'lastName', label: 'Last name', value: c.lastName, inputmode: 'text', attrs: 'autocomplete="family-name"', error: contactErrors.lastName })}
      ${field({ id: 'email', label: 'Email', type: 'email', value: c.email, inputmode: 'email', attrs: 'autocomplete="email"', error: contactErrors.email })}
      <div class="actions">
        <button type="button" class="btn btn--ghost" data-action="back">Back</button>
        <button type="submit" class="btn btn--primary">See my results</button>
      </div>
    </form>
  </section>`;
}

// --- Step 3: Results ---------------------------------------------------------

function resultsView() {
  const record = buildResultsRecord(session());
  state.record = record;
  save();
  const res = record.results;
  const realAge = record.athlete.age;
  const hsAge = wholeYears(res.healthspanAge);
  const diff = hsAge === null ? null : hsAge - realAge;
  const diffLine =
    diff === null
      ? 'Test at least one station to get a Healthspan Age.'
      : diff < 0
        ? `${-diff} ${-diff === 1 ? 'year' : 'years'} younger than your actual age.`
        : diff > 0
          ? `${diff} ${diff === 1 ? 'year' : 'years'} older than your actual age.`
          : 'Right at your actual age.';
  const name = esc(state.about.firstName.trim());
  const dateText = formatDate(record.testDate);

  const rows = res.stations
    .map((r, k) => {
      const st = STATIONS[k];
      const entered = describeEntry(st, state.stations[st.key]);
      const age = wholeYears(r.age);
      return `
      <tr class="${r.tested ? '' : 'is-untested'}">
        <th scope="row"><span class="num">${k + 1}</span> ${st.title}</th>
        <td data-label="Entered">${esc(entered)}</td>
        <td data-label="Calculated">${calcText(r)}</td>
        <td data-label="Tier">${tierBadge(r.tested ? r.tier : null)}</td>
        <td data-label="Points" class="t-num">${r.points}</td>
        <td data-label="Functional age" class="t-num">${r.tested ? (age ?? '<span class="muted" title="Not included in Healthspan Age">—</span>') : '—'}</td>
        <td class="no-print t-edit"><button type="button" class="link" data-edit="${k}" aria-label="Edit ${st.title}">Edit</button></td>
      </tr>`;
    })
    .join('');

  const focus = res.focus.map((key) => res.stations.find((s) => s.station === key));

  return `
  <header class="brand"><span class="brand__mark">Primedy</span> Healthspan Challenge</header>
  <section class="card results">
    <p class="eyebrow">${name ? `${name}’s results` : 'Your results'} · ${esc(dateText)}</p>
    <h1 tabindex="-1" class="sr-only">Your Healthspan results</h1>

    <div class="hero">
      <div class="hero__age">
        <span class="hero__label">Healthspan Age</span>
        <span class="hero__value">${hsAge ?? '—'}</span>
      </div>
      <div class="hero__age hero__age--real">
        <span class="hero__label">Actual age</span>
        <span class="hero__value">${realAge}</span>
      </div>
      <p class="hero__line">${diffLine}</p>
    </div>

    <div class="score">
      <div class="score__num"><span class="score__value">${res.score}</span><span class="score__max">/ ${res.maxScore}</span></div>
      <div>
        <p class="score__band">${res.band.label}</p>
        <p class="score__desc">${res.band.description}</p>
      </div>
    </div>

    ${res.testedCount < res.stationCount ? `<p class="based-on">Based on ${res.testedCount} of ${res.stationCount} stations.</p>` : ''}

    ${
      focus.length
        ? `<h2>Focus next</h2>
      <ul class="focus">
        ${focus
          .map(
            (r) => `<li>
          <strong>${STATIONS.find((s) => s.key === r.station).title}</strong>
          ${tierBadge(r.tier)} <span>${r.points} pts${wholeYears(r.age) !== null ? ` · functional age ${wholeYears(r.age)}` : ''}</span>
        </li>`,
          )
          .join('')}
      </ul>`
        : ''
    }

    <h2>Station breakdown</h2>
    <div class="table-wrap">
      <table class="breakdown">
        <thead><tr><th scope="col">Station</th><th scope="col">Entered</th><th scope="col">Calculated</th><th scope="col">Tier</th><th scope="col" class="t-num">Pts</th><th scope="col" class="t-num">Age</th><th class="no-print"><span class="sr-only">Edit</span></th></tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr><th scope="row">Total</th><td></td><td></td><td>${tierBadgeBand(res.band)}</td><td class="t-num">${res.score}</td><td class="t-num">${hsAge ?? '—'}</td><td class="no-print"></td></tr></tfoot>
      </table>
    </div>

    <h2>Functional age by station</h2>
    ${ageChart(res, realAge)}

    <div class="actions actions--results no-print">
      <button type="button" class="btn btn--primary" data-action="print">Print / Save PDF</button>
      <button type="button" class="btn btn--secondary" data-action="edit">Edit results</button>
      <button type="button" class="btn btn--ghost" data-action="restart">Start over</button>
    </div>

    <footer class="footer">Estimates based on population norms, not a medical assessment. Re-test in 12 weeks using the same test versions.</footer>
  </section>`;
}

const tierBadgeBand = (band) => `<span class="badge badge--${band.key}">${band.label.replace(' Healthspan', '')}</span>`;

function calcText(r) {
  if (!r.tested) return '';
  const parts = [];
  if (r.calculated) parts.push(esc(r.calculated.text));
  if (r.station === 'pull_ups' && r.variant === 'both') {
    const n = { pull_ups: 'pull-ups', dead_hang: 'hang' };
    parts.push(r.tierFrom === r.ageFrom ? `scored on ${n[r.tierFrom]}` : `tier from ${n[r.tierFrom]}, age from ${n[r.ageFrom]}`);
  }
  for (const n of r.notes) parts.push(`<span class="warn-text">${esc(n)}</span>`);
  if (r.station === 'body_composition' && r.age === null) parts.push('<span class="muted">not in age</span>');
  return parts.join('<br />');
}

function formatDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

function ageChart(res, realAge) {
  const max = 90;
  const pos = (v) => `${(Math.min(v, max) / max) * 100}%`;
  const ticks = [0, 20, 40, 60, 80];
  const bars = res.stations
    .map((r, k) => {
      const title = STATIONS[k].title;
      const age = r.tested && r.age !== null ? r.age : null;
      const shown = wholeYears(age);
      const cls = age === null ? '' : shown > realAge ? 'bar--older' : 'bar--younger';
      const label = !r.tested ? 'Not tested' : age === null ? 'No age (at-home)' : shown;
      const tip = age === null ? `${title}: ${label}` : `${title}: functional age ${shown} (${shown - realAge >= 0 ? '+' : ''}${shown - realAge} vs. actual)`;
      return `
      <li class="chart__row" title="${esc(tip)}">
        <span class="chart__name">${title}</span>
        <span class="chart__track">
          ${age !== null ? `<span class="bar ${cls}" style="width:${pos(age)}"></span>` : ''}
          <span class="chart__value ${age === null ? 'chart__value--none' : ''}" style="${age !== null ? `left:calc(${pos(age)} + 6px)` : 'left:0'}">${label}</span>
        </span>
      </li>`;
    })
    .join('');
  return `
  <figure class="chart" aria-labelledby="chart-cap">
    <figcaption id="chart-cap" class="chart__legend">
      <span><i class="key key--younger"></i>At or younger than actual age</span>
      <span><i class="key key--older"></i>Older than actual age</span>
      <span><i class="key key--line"></i>Actual age (${realAge})</span>
    </figcaption>
    <div class="chart__body">
      <ol class="chart__rows">${bars}</ol>
      <div class="chart__overlay" aria-hidden="true">
        <span class="chart__line" style="left:${pos(realAge)}"></span>
        <div class="chart__axis">${ticks.map((t) => `<span style="left:${pos(t)}">${t}</span>`).join('')}</div>
      </div>
    </div>
  </figure>`;
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

app.addEventListener('input', (ev) => {
  const t = ev.target;
  if (state.step === 'about') {
    if (t.name === 'heightUnit') {
      state.about.heightUnit = t.value;
      save();
      render();
      app.querySelector(`input[name="heightUnit"][value="${t.value}"]`)?.focus();
      return;
    }
    if (t.name in state.about) state.about[t.name] = t.value;
    save();
  } else if (state.step === 'station') {
    const station = STATIONS[state.stationIndex];
    const raw = rawFor(station.key);
    if (t.name === 'version') {
      raw.version = t.value;
      raw.notTested = false;
      save();
      render();
      app.querySelector(`input[name="version"][value="${t.value}"]`)?.focus();
      return;
    }
    if (t.dataset.field) {
      raw.values[t.dataset.field] = t.value;
      raw.notTested = false;
      save();
      updateStationFeedback(station, t);
    }
  } else if (state.step === 'contact') {
    if (t.name in state.contact) state.contact[t.name] = t.value;
    save();
  }
});

app.addEventListener('submit', (ev) => {
  ev.preventDefault();
  if (ev.target.id === 'about-form') {
    aboutErrors = validateAbout();
    if (Object.keys(aboutErrors).length) {
      render();
      const first = app.querySelector('[aria-invalid="true"]');
      (first?.matches('fieldset') ? first.querySelector('input') : first)?.focus();
      announcer.textContent = 'Please fix the highlighted fields.';
      return;
    }
    go('station', 0);
  } else if (ev.target.id === 'station-form') {
    const station = STATIONS[state.stationIndex];
    if (!hasEntry(station)) {
      document.getElementById('station-msg').textContent = 'Enter a result, or choose “Didn’t test this”.';
      return;
    }
    nextStation();
  } else if (ev.target.id === 'contact-form') {
    const c = state.contact;
    contactErrors = {};
    if (!c.lastName.trim()) contactErrors.lastName = 'Please enter your last name.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email.trim())) contactErrors.email = 'Please enter a valid email.';
    if (Object.keys(contactErrors).length) {
      render();
      app.querySelector('[aria-invalid="true"]')?.focus();
      return;
    }
    go('results');
    // Fire and forget: results always show, even if the send fails.
    sendToHubspot(config.hubspot, state.record, state.about.firstName, c).catch(() => {});
  }
});

app.addEventListener('click', (ev) => {
  const btn = ev.target.closest('button');
  if (!btn) return;
  const action = btn.dataset.action;
  if (btn.dataset.edit !== undefined) return go('station', Number(btn.dataset.edit));
  if (action === 'back') {
    if (state.step === 'station') return state.stationIndex === 0 ? go('about') : go('station', state.stationIndex - 1);
    if (state.step === 'contact') return go('station', STATIONS.length - 1);
  }
  if (action === 'skip') {
    const raw = rawFor(STATIONS[state.stationIndex].key);
    raw.notTested = true;
    save();
    return nextStation();
  }
  if (action === 'print') return window.print();
  if (action === 'edit') return go('station', 0);
  if (action === 'restart') {
    if (!window.confirm('Clear all results and start over?')) return;
    state = freshState();
    aboutErrors = {};
    contactErrors = {};
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    return go('about');
  }
});

function nextStation() {
  if (state.stationIndex < STATIONS.length - 1) return go('station', state.stationIndex + 1);
  return go(config.hubspot.enabled ? 'contact' : 'results');
}

// ---------------------------------------------------------------------------
// Iframe support: tell the parent page our height so it can size the frame.
// ---------------------------------------------------------------------------

function postToParent(msg) {
  if (window.parent !== window) window.parent.postMessage(msg, '*');
}

if (window.parent !== window) {
  document.documentElement.classList.add('in-iframe');
  const report = () => postToParent({ type: 'primedy-healthspan:height', height: document.documentElement.scrollHeight });
  new ResizeObserver(report).observe(document.body);
  window.addEventListener('load', report);
}

// A session opened on the results page re-validates in case About You is incomplete.
if (state.step !== 'about' && Object.keys(validateAbout()).length) state.step = 'about';
render();
