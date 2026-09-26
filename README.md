# Primedy Healthspan Challenge Calculator

A static, browser-only web app. Athletes enter their Healthspan Challenge results and get a tier, points and an exact functional age for each of the 10 stations, plus their overall Healthspan Score, band and Healthspan Age. Build spec: [`HEALTHSPAN_APP_SPEC.md`](HEALTHSPAN_APP_SPEC.md).

## Where things live

| What | File |
|---|---|
| Every scoring number (thresholds, medians, formulas) | `scoring-tables.json` |
| Owner decisions (pull-up policy, ASMI cap, HubSpot, band wording…) | `src/config.js` |
| Scoring engine (pure, no UI) | `src/scoring/` |
| Unit tests (spec Part 4) | `tests/scoring.test.js` |
| Screens, station inputs, styles | `src/main.js`, `src/ui/`, `src/styles.css` |

To re-calibrate the norms, edit `scoring-tables.json` and run `npm test`.

## Run locally

Requires Node 20+.

```bash
npm install
npm test          # unit tests
npm run dev       # dev server with live reload → http://localhost:3000
npm run build     # production build into dist/
npm run preview   # serve the production build → http://localhost:4173
```

`dist/` uses relative paths, so it can be hosted from any folder or opened inside an iframe.

## Publish with GitHub Pages

1. Merge this branch into `main`.
2. On GitHub, open the repo → **Settings** → **Pages**. Under **Build and deployment → Source**, choose **GitHub Actions**.
3. The workflow in `.github/workflows/deploy.yml` runs the tests, builds, and deploys on every push to `main`. You can also start it from **Actions → Test and deploy to GitHub Pages → Run workflow**.
4. When it finishes, the site is live at `https://paffman7.github.io/Healthspan/`.

## Embed on your website

```html
<iframe
  id="primedy-healthspan"
  src="https://paffman7.github.io/Healthspan/"
  title="Primedy Healthspan Challenge Calculator"
  style="width:100%; max-width:820px; height:900px; border:0; display:block; margin:0 auto;"
  loading="lazy"
></iframe>
<script>
  // Optional: grow the frame to fit its content and scroll to it on each new step.
  window.addEventListener('message', function (e) {
    if (e.origin !== 'https://paffman7.github.io' || !e.data) return;
    var frame = document.getElementById('primedy-healthspan');
    if (e.data.type === 'primedy-healthspan:height') frame.style.height = e.data.height + 'px';
    if (e.data.type === 'primedy-healthspan:navigate') {
      var top = frame.getBoundingClientRect().top;
      if (top < 0) frame.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
</script>
```

Without the script, the iframe still works at the fixed height and scrolls inside itself.
