# vendor/globals — Provenance

Unmodified single-file browser builds, loaded via classic `<script>` tags and
consumed as window globals (the pattern the pages already used with jsdelivr).
Vendored 2026-07-09 so no page makes a CDN fetch at runtime — see ADR-006 rev. 2
("Conference wifi is unreliable. A live remote fetch during a demo is a liability").

Unlike `/vendor/codemirror/` this involved no dependency-graph chasing: every
file below is the complete, self-contained artifact its upstream publishes.

| File | Version | Source URL | Global |
|---|---|---|---|
| tailwindcss-play.js | 3.4.16 | https://cdn.tailwindcss.com/3.4.16 | `tailwind` |
| n3.min.js | 1.26.0 | https://cdn.jsdelivr.net/npm/n3@1.26.0/browser/n3.min.js | `N3` |
| jsonld.min.js | 8.3.1 | https://cdn.jsdelivr.net/npm/jsonld@8.3.1/dist/jsonld.min.js | `jsonld` |
| comunica-browser.js | 2.10.0 | https://rdf.js.org/comunica-browser/versions/v2.10.0/engines/query-sparql/comunica-browser.js | `Comunica` |
| cytoscape.min.js | 3.28.1 | https://cdn.jsdelivr.net/npm/cytoscape@3.28.1/dist/cytoscape.min.js | `cytoscape` |
| cola.js | 3.4.0 | https://cdn.jsdelivr.net/npm/webcola@3.4.0/WebCola/cola.js | `cola` (aliased to `webcola` inline in the pages) |
| cytoscape-cola.js | 2.5.1 | https://cdn.jsdelivr.net/npm/cytoscape-cola@2.5.1/cytoscape-cola.js | `cytoscapeCola` |
| layout-base.js | 2.0.1 | https://cdn.jsdelivr.net/npm/layout-base@2.0.1/layout-base.js | `layoutBase` |
| cose-base.js | 2.2.0 | https://cdn.jsdelivr.net/npm/cose-base@2.2.0/cose-base.js | `coseBase` |
| cytoscape-fcose.js | 2.2.0 | https://cdn.jsdelivr.net/npm/cytoscape-fcose@2.2.0/cytoscape-fcose.js | `cytoscapeFcose` |

Version notes:
- n3 1.26.0 serves both notebook pages; notebook2 previously loaded 1.17.2 from
  CDN and moved up in this pass (API-stable within 1.x per ADR-031's note).
- comunica-browser.js is the official Comunica browser bundle of
  `@comunica/query-sparql@2.10.0` — the same package/version
  `scripts/notebook-context.js` previously imported from jsdelivr `+esm` at runtime.
- tailwindcss-play.js is the Play CDN script, version-pinned. It still logs its
  "should not be used in production" console warning; that warning is about the
  runtime-JIT approach, not the hosting origin, and is accepted (C10/ADR-006:
  no build step means no Tailwind CLI build).
