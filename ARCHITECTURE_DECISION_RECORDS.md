# Semantic Notebook — Architecture Decision Records

> Architecturally significant decisions: foundational technology and structural choices that are hard to reverse, cross-cutting across the system, or commit it to a seam that isn't built yet (like the future backend's wire format). Not every implementation decision earns an ADR — narrower, component-scoped choices live in [DESIGN_DECISIONS.md](DESIGN_DECISIONS.md) instead.

---

## How This Relates to the Other Two Documents

[ARCHITECTURAL_CONSTRAINTS.md](ARCHITECTURAL_CONSTRAINTS.md) holds rules about the system's *uniform interface* — checkable independent of which specific component you're looking at, Fielding-REST style. A constraint is violated the moment any one component doesn't obey it.

This document holds decisions that aren't uniform-interface rules but are still architecturally significant. The test: would reversing this decision ripple beyond one component, or does it commit the system to a contract nothing has been built against yet? If yes, it's an ADR. Library/technology choices for foundational subsystems (the quad store, the SPARQL engine, the reasoner, the graph visualization library, the editor library), the wire-format choice for the notebook definition itself, and cross-cutting interaction models are the kind of thing that lives here.

[DESIGN_DECISIONS.md](DESIGN_DECISIONS.md) holds everything narrower: the concrete mechanism behind a rule stated above, component-internal tactics, bug fixes, visual tuning, naming.

Records here are immutable in the Nygard sense: when a decision changes, a dated Revision/Correction section is appended in place (see ADR-010) or a new record supersedes the old one; nothing is silently overwritten.

---

## Index — Where Every Original ADR Number Lives

| ADR | Title | Current Home |
|---|---|---|
| ADR-001 | Teaching tool, not a general-purpose triplestore UI | STORY.md ("What This Is Not") |
| ADR-002 | Notebook as semantic artifact | Absorbed into **C3** |
| **ADR-003** | JSON-LD as notebook wire format, Turtle as authoring format | **Active — below** |
| **ADR-004** | `sembook:` vocabulary in its own namespace | **Active — below** |
| ADR-005 | Native Web Components, no JS framework | Absorbed into **C10** |
| **ADR-006** | No build step | **Active — below** |
| **ADR-007** | N3.js as in-browser quad store | **Active — below** |
| **ADR-008** | Comunica as SPARQL engine | **Active — below** |
| **ADR-009** | N3.js Reasoner for RDFS/OWL 2 RL, EYE JS deferred | **Active — below** |
| **ADR-010** | Cytoscape.js for graph visualization (+ cola/fCoSE revisions) | **Active — below** |
| ADR-011 | One lab, one named graph | Absorbed into **C8** |
| ADR-012 | Infrastructure in default graph, teaching data in named graphs | Absorbed into **C8** |
| ADR-013 | SPARQL as universal panel configuration surface | Core rule → **C13**; mechanism → [DDR-013](DESIGN_DECISIONS.md) |
| ADR-014 | Tailwind CSS utility classes for layout | Absorbed into **C4**; alternatives → [DDR-014](DESIGN_DECISIONS.md) |
| **ADR-015** | Scroll-based navigation, Intersection Observer rendering | **Active — below** |
| **ADR-016** | Eager initialization, lazy rendering | **Active — below** |
| ADR-017 | `graph:upsertFragment` replace-not-diff model | Core rule → **C7**; mechanism → [DDR-017](DESIGN_DECISIONS.md) |
| ADR-018 | Blank node scoping by fragment URI | [DDR-018](DESIGN_DECISIONS.md) |
| **ADR-019** | Parse button as explicit commit, no live keystroke updates | **Active — below** |
| ADR-020 | Notebook context as event bus mediator | Absorbed into **C6** + **C9**; mechanism → [DDR-020](DESIGN_DECISIONS.md) |
| ADR-021 | `init()` method for dynamically created panel components | [DDR-021](DESIGN_DECISIONS.md), cross-referenced from **C6** |
| ADR-022 | `unionDefaultGraph: true` with compensating named graph filters | [DDR-022](DESIGN_DECISIONS.md) |
| ADR-023 | Prefix sync via event bus | [DDR-023](DESIGN_DECISIONS.md) |
| ADR-024 | Cytoscape destroy-and-recreate for compound node graphs | [DDR-024](DESIGN_DECISIONS.md) |
| ADR-025 | `explorer:selected` event for entity explorer selection | [DDR-025](DESIGN_DECISIONS.md) |
| ADR-026 | Pre-baked datasets, no cross-origin fetch | [DDR-026](DESIGN_DECISIONS.md) |
| ADR-027 | Static-first deployment, backend-agnostic URI scheme | Absorbed into **C11** |
| ADR-028 | Per-notebook directory structure | [DDR-028](DESIGN_DECISIONS.md) |
| **ADR-029** | CodeMirror 6 for all code editing surfaces | **Active — below** |
| ADR-030 | Literals as nodes in graph visualization | [DDR-030](DESIGN_DECISIONS.md) |
| ADR-031 | Materialization on Parse via N3.js Reasoner, RDFS/OWL2RL-BGP subset | Trigger clause cross-referenced with **ADR-019**; mechanism → [DDR-031](DESIGN_DECISIONS.md) |
| ADR-032 | Entity explorer renders equivalence merges, inferred memberships, class assertions | [DDR-032](DESIGN_DECISIONS.md) |
| ADR-033 | Entity explorer scope toggle = lab vs cumulative; meta-vocabulary always hidden | [DDR-033](DESIGN_DECISIONS.md) |
| ~~ADR-033~~ → ADR-034 | Vocabulary panel row-collapsing is display-label collision, not semantic equivalence | [DDR-034](DESIGN_DECISIONS.md) — renumbered; duplicated ADR-033's number in the original document, no code referenced it under that number |

---

## ADR-003 — JSON-LD as Wire Format, Turtle as Authoring Format

**Context:** RDF can be serialized in many formats: Turtle, JSON-LD, N-Quads, RDF/XML, TriG. The choice of format affects authoring experience, tooling compatibility, and runtime behavior.

**Decision:** Notebooks are authored and stored as JSON-LD. The server (when it exists) may accept Turtle as an authoring format and serialize to JSON-LD for the wire. The browser runtime always works with JSON-LD.

**Alternatives Considered:**
- Turtle only (more readable, but requires a server to parse before client use)
- JSON-LD only (current approach)
- Multiple formats with content negotiation

**Rationale:** JSON-LD maps directly to JavaScript object models. The C# backend (future) can deserialize JSON-LD with a JSON-LD processor into typed objects without writing a custom Turtle parser. The browser receives JSON-LD in a `<script type="application/ld+json">` block — a well-understood web pattern. N3.js parses JSON-LD natively. Turtle is more readable for humans and is used as the teaching syntax in the notebook's own content — but keeping the configuration format as JSON-LD maintains consistency between the format that describes the tool and the format the tool teaches.

**Consequences:**
- `@list` containers must be used for ordered collections to preserve lab and panel order — a structural requirement on every notebook definition file, present and future
- The `sembook.ttl` ontology file is Turtle (for Protégé compatibility), but the notebook definition files are JSON-LD
- When the C# backend is added, it reads Turtle, serializes to JSON-LD for the wire — a contract nothing has been built against yet, but every future backend integration inherits it

**Why this is architecturally significant, not just a component detail:** this is the parse target of `bootstrap()` for every notebook file that exists or will ever exist across both notebooks — not a choice scoped to any one lab or panel. It also commits the not-yet-built C# backend to a specific seam (accepts Turtle, serializes to JSON-LD) that would be expensive to discover was wrong only after that backend is built.

**Governing constraint:** [C3 — The Notebook Format Is the Subject Matter](ARCHITECTURAL_CONSTRAINTS.md#c3--the-notebook-format-is-the-subject-matter) states *that* the format must be a queryable semantic artifact; this record is *which* serialization achieves it and why.

---

## ADR-004 — `sembook:` Vocabulary in Its Own Namespace

**Context:** The vocabulary that describes notebooks, labs, and panels needs a home. Candidates were the HydrAI namespace (`hydrai:`), a sub-namespace of the project, or its own top-level namespace.

**Decision:** The vocabulary lives at `https://sembook.example.org/vocab#` under the `sembook:` prefix. It is a separate project from HydrAI with its own identity.

**Alternatives Considered:**
- HydrAI namespace (`hydrai:Notebook`, `hydrai:Lab`, etc.)
- Sub-namespace of the book's domain

**Rationale:** HydrAI is about agent-native Hydra extensions — operation cost hints, SPARQL-native resource support, binding specs. A semantic notebook vocabulary is a different concern entirely. Folding it into HydrAI would dilute both. The notebook vocabulary is general enough to be useful to anyone building interactive semantic teaching tools — not just this project, not just this talk. Giving it its own namespace and its own identity makes it a potential contribution to the ecosystem in its own right.

**Consequences:**
- `sembook:` namespace must be maintained separately from `hydrai:`
- The ontology (`sembook.ttl`) is a publishable artifact
- Future contributors can extend the vocabulary independently

**Why this is architecturally significant:** the namespace is baked into every notebook JSON-LD file and every SPARQL query in the system. It's also a public, publishable identity — if the ontology is ever released or dereferenced externally, renaming the namespace later means breaking every consumer, not just editing one file.

---

## ADR-006 — No Build Step

**Context:** Modern JavaScript projects use build tools (webpack, vite, rollup, esbuild) for bundling, transpilation, and optimization. These tools add complexity but enable features like TypeScript, module resolution, and tree shaking.

**Decision:** No build step. ES modules loaded directly from CDN or relative paths. The source is what runs in the browser.

**Alternatives Considered:**
- Vite (fast, minimal config)
- esbuild (very fast)
- TypeScript compilation only (no bundling)

**Rationale:** Fit with the organizational constraint: this is an independent project with no CI/CD pipeline and no dedicated build infrastructure. A build step adds a failure mode between writing code and seeing it run. For a conference demo tool, that failure mode is unacceptable. ES modules are natively supported in all modern browsers. CDN imports are reliable for known stable versions. The transparency of no build step — the source is the running code — is also consistent with the teaching goals of the project.

**Consequences:**
- No TypeScript (JavaScript only)
- No tree shaking or bundle optimization
- CDN availability is a dependency (mitigated by pre-baked datasets for offline use)
- Module import paths are relative or CDN URLs

**Reconsideration Triggers (added after vendoring CodeMirror, iteration 10):** `esm.sh` intermittently failed to serve `@codemirror/view` during a live session, which silently broke `sem-panel-jsonld`/`sem-panel-turtle` (the custom element never upgrades, and there's no error surfaced to the user). The fix was to vendor CodeMirror's full dependency graph (18 files) under `/vendor/codemirror/` and resolve it via a native `<script type="importmap">` — still zero build step, per this decision, since the files are unmodified ESM copies and the import map is a browser platform feature, not a bundler.

This decision still holds, but should be actively revisited — not silently worked around again — if any of the following happen:
- **Vendoring becomes a recurring chore.** This session's resolution was manual: fetch each package's `package.json` from the registry, read its `exports`/`module` field, grep its actual `import` statements to verify the transitive closure, `curl` each file. That's tolerable once. If a second or third dependency needs the same treatment, the manual process doesn't scale and a minimal fetch-only tool (not a bundler — just something to script what was done by hand here) is worth introducing.
- **A future dependency has a messier dependency graph than CodeMirror's** (dynamic imports, non-ESM packages, circular re-exports) such that flat-file vendoring + an import map can't represent it cleanly.
- **A second contributor joins.** The Tailor-Made "team fit" for this decision assumes one person; standard tooling (npm + a bundler) has a real onboarding-cost argument once that's no longer true.
- **TypeScript or JSX genuinely becomes desired** for a component, not just hypothetically nice-to-have — the "no build step" constraint is the only thing currently ruling this out.
- **The conference/offline deployment constraint loosens** (e.g., the notebook moves to an always-hosted environment with CI as the future backend arrives) — the "zero ops, must never fail on stage" argument for no build step weakens once there's a deploy pipeline anyway.

None of these are true yet — this is a flag for the architect, not a pending action.

**Governing constraint:** [C10 — No Framework](ARCHITECTURAL_CONSTRAINTS.md#c10--no-framework) states the rule; this record carries the incident that tested it and the explicit conditions for revisiting it.

---

## ADR-007 — N3.js as In-Browser Quad Store

**Context:** The system requires an in-browser RDF store that supports named graphs (quads), can parse Turtle and JSON-LD, and integrates with a SPARQL engine.

**Decision:** N3.js `Store` is the quad store. N3.js `Parser` handles Turtle and N-Quads parsing. `jsonld.js` handles JSON-LD to N-Quads conversion before N3.js ingestion.

**Alternatives Considered:**
- Quadstore + MemoryLevel (more full-featured, larger bundle)
- RDFLib.js (Python port, less maintained)
- Custom in-memory store

**Rationale:** N3.js is the most actively maintained RDF library in the JavaScript ecosystem. Its `Store` class is natively a quad store — named graph support is first-class, not bolted on. It integrates naturally with Comunica via the RDF/JS interface. The `Parser` handles Turtle natively, which is important for the Turtle Writer panel. Quadstore was considered but adds LevelDB as a dependency and is heavier than needed for teaching-sized datasets.

**Consequences:**
- `jsonld.js` is a separate dependency for JSON-LD parsing (N3.js handles N-Quads output from jsonld.js)
- The store is in-memory only — no persistence across sessions without server intervention
- Quad IDs use N3.js `DataFactory` conventions

**Why this is architecturally significant:** it's the foundation everything else in the data layer is built on top of — the SPARQL engine, the reasoner, the whole quad store model in C7. Swapping it would ripple through every subsystem that touches graph data.

**Governing constraint:** [C7 — The Quad Store Is the Single Source of Truth](ARCHITECTURAL_CONSTRAINTS.md#c7--the-quad-store-is-the-single-source-of-truth).

---

## ADR-008 — Comunica as SPARQL Engine

**Context:** SPARQL 1.1 query execution is required for all panel data fetching. The engine must run in the browser against an N3.js store.

**Decision:** Comunica `QueryEngine` from `@comunica/query-sparql` is the SPARQL engine. It is imported as an ES module from CDN.

**Alternatives Considered:**
- SPARQL.js (parser only, not an engine)
- Custom SPARQL subset implementation
- Server-side SPARQL via HTMX

**Rationale:** Comunica is designed for the browser, supports SPARQL 1.1, integrates with N3.js via the RDF/JS Query interface, and is actively maintained. Server-side SPARQL would violate the local execution constraint (C5). Custom implementation would violate the no invented abstractions constraint (C4).

**Consequences:**
- `unionDefaultGraph: true` must be set on all queries to make named graph data reachable
- Named graph scoping in panel queries is the developer's responsibility (Comunica won't enforce it)
- Comunica's ESM build must be loaded before any component queries run

**Why this is architecturally significant:** every panel in the system — present and future — renders by running a query through this engine (see C13). It's as foundational as the quad store choice it pairs with.

---

## ADR-009 — N3.js Reasoner for RDFS/OWL 2 RL, EYE JS Deferred

**Context:** RDFS and OWL reasoning is required for the "emergence reveal" — the central teaching moment where the graph knows more than the user typed. Several browser-compatible reasoning options exist.

**Decision:** N3.js Reasoner handles RDFS and OWL 2 RL materialization. EYE JS (WebAssembly Prolog-based reasoner) is deferred for use when heavier N3 rule-based reasoning is needed.

**Alternatives Considered:**
- HyLAR (RDFS + OWL RL, but built on deprecated rdfstore.js)
- EYE JS immediately (more capable, but heavier WASM load)
- Server-side reasoning via HTMX

**Rationale:** N3.js Reasoner is built on N3.js (already in the stack), supports RDFS transitivity, inverseOf, TransitiveProperty, domain/range inference — everything needed for the teaching arc's reasoning reveals. EYE JS brings full N3 rule reasoning and proof traces, which is more powerful than needed for v1 and adds WASM cold-start latency. The deferred escalation — bring in EYE JS when heavier reasoning is demonstrated — follows the Tailor-Made principle of not overprescribing.

**Consequences:**
- Full OWL DL reasoning (tableaux) is not available client-side
- Reasoning output goes into a `<lab-iri>-inferred` named graph
- EYE JS integration is a planned future iteration

**Refined by DDR-031:** when reasoning was actually wired in, investigation narrowed this decision's "OWL 2 RL" to the BGP-expressible subset only (the N3.js Reasoner cannot express rules needing built-ins or rdf:Lists — cardinality, hasKey, propertyChainAxiom, someValuesFrom, etc.). See [DDR-031](DESIGN_DECISIONS.md) for the full ruleset scope and materialization mechanism.

**Why this is architecturally significant:** this sets the capability ceiling for every future lab's reasoning-dependent teaching moment. A lab that wants to demonstrate an OWL construct outside this ruleset can't, until the deferred EYE JS escalation happens — that's a real constraint on future content, not an implementation detail of one component.

**See also:** ADR-019 (the Parse-triggered interaction model this reasoning runs inside — not elevated to a constraint; see that entry for why).

---

## ADR-010 — Cytoscape.js for Graph Visualization, with fCoSE Layout Revisions

**Context:** The graph visualization is central to the teaching surface. It must handle node-edge graphs (for triple visualization) and compound node graphs (for class hierarchy visualization). Layout algorithms, interactive selection, and export are required.

**Decision:** Cytoscape.js is the graph visualization library for all panel types. Cola layout for the graph panel's force-directed clustering. Compound nodes for the entity explorer and vocabulary panel hierarchies.

**Alternatives Considered:**
- D3.js (more control, significantly more implementation effort)
- Sigma.js (simpler, less feature-rich)
- Custom SVG/Canvas

**Rationale:** Cytoscape.js offers compound nodes (parent-child containment), multiple layout algorithms, interactive selection, pan/zoom, and export — all first-class. D3 was considered for the entity explorer's nested set visualization but rejected: D3's circle packing layout isn't containment-based, and the interaction model (drill-down, zoom, click to enumerate) requires significant custom state management that Cytoscape provides natively.

**Consequences:**
- Cytoscape instances are expensive — created on first intersection, kept alive, not destroyed on scroll-out
- Compound node graphs must be destroyed and recreated on update (incremental update is fragile — see [DDR-024](DESIGN_DECISIONS.md))
- The Cytoscape instance reference is the one documented exception to C7's stateless-projection model

**Why this is architecturally significant:** the entire visual teaching surface — graph panel, entity explorer, vocabulary panel — is built on this one library. It's the second most load-bearing technology choice in the system after the quad store.

### Revision (iteration 12) — Entity Explorer Layout: cose → fCoSE (scoped, not project-wide)

The entity/vocabulary explorer's compound-node hierarchy used plain `cose`, which predates Cytoscape's compound-node support and doesn't pack disconnected components apart — separate class sets (e.g. Person, Book, City with no edges between them) piled on top of one another, requiring the instructor to drag them apart to read them.

**Decision:** the entity explorer (`sem-panel-entity.js`) switches to **fCoSE** (`cytoscape-fcose`, the i-Vis lab's compound-aware successor to cose-bilkent), with `packComponents: true` to tile disconnected class sets side by side instead of overlapping. Loaded via UMD `<script>` tags with SRI hashes (`layout-base` → `cose-base` → `cytoscape-fcose`; each reads the previous off its window global, so no aliasing shim is needed, unlike cola/webcola), registered *alongside* cola, not replacing it.

**Scope note — this was tried project-wide first and reverted.** An earlier attempt also moved the graph panel from `cola` to `fcose`, reasoning that cola's force layout hairballs literal-dense teaching graphs. In practice, getting fCoSE's `randomize` setting right for the graph panel's incremental-update model (a live instance updated via `cy.layout().run()` on every Parse, versus the entity panel's destroy-and-recreate) took more than one attempt and the first attempt shipped a regression (nodes collapsing into a diagonal line on first render). The architect asked to revert and re-scope to the entity explorer only, where the model is simpler: the panel already destroys and recreates its Cytoscape instance on every render ([DDR-024](DESIGN_DECISIONS.md)), so there are never prior positions to preserve, and `randomize: true` on every layout is safe and sufficient. **The graph panel remains on cola** — untouched, unregressed. Revisiting fCoSE (or another layout) for the graph panel is a separate, deferred question.

**Consequences (of the revision):** Both notebooks' `index.html` now load fCoSE's dependency chain in addition to cola's; nothing was removed.

### Correction (iteration 13) — Vocabulary Panel's Classes Graph Also Moves to fCoSE

An earlier note claiming "Vocabulary panel's Classes graph is unaffected... remains so" turned out to be wrong: `grid` was chosen to avoid `cose`'s "flings disconnected components apart" problem, but grid does not actually pack COMPOUND boxes apart from one another either — disconnected class containers piled on top of each other, the identical bug just fixed for the entity explorer, only surfacing later once the vocabulary panel was exercised with a compound (subclassed) hierarchy rather than a flat one. `sem-panel-vocab.js`'s `classLayout` now also uses fCoSE with `packComponents: true`, same tuning family as the entity explorer, `randomize: true` (safe for the same reason — this panel also destroys and recreates its Cytoscape instance every render).

---

## ADR-015 — Scroll-Based Navigation, Intersection Observer Rendering

**Status note:** originally logged "subject to revision after UI validation"; held after the first visual build.

**Context:** Labs occupy the full viewport. Navigation between labs could be scroll-based (native browser anchor behavior) or reveal-based (JavaScript swapping visible labs).

**Decision:** Labs are stacked vertically in the DOM. Navigation is standard browser scrolling. Fragment identifiers in URLs scroll to the target lab. Intersection Observer triggers rendering when a lab enters the viewport.

**Alternatives Considered:**
- Tab-style reveal (JavaScript hides/shows labs)
- Carousel/slideshow navigation
- Paginated navigation with explicit prev/next

**Rationale:** Scroll is the most hypermedia-native approach — the browser's built-in anchor behavior does the work without JavaScript. Back button works. Deep linking works. The narrative has a spatial order that the audience can feel as they scroll. Tab reveal destroys that spatial metaphor.

**Consequences:**
- Intersection Observer is required for all lab rendering
- Labs that are off-screen have their Cytoscape layouts paused (not destroyed)
- Deep linking requires eager initialization (see ADR-016)

**Why this is architecturally significant:** this is the navigation and rendering model for every lab, in every notebook, present and future — not a per-lab choice. That "client-side routing must reflect in the URL" is also a [C1](ARCHITECTURAL_CONSTRAINTS.md#c1--hypermedia-first) violation category means this decision is also what keeps the system compliant with C1 at the lab-navigation level.

---

## ADR-016 — Eager Initialization, Lazy Rendering

**Context:** If labs initialize and render only when scrolled into view, deep linking breaks — a late lab in the notebook depends on earlier labs' data but those labs haven't run yet.

**Decision:** Initialization is eager: all labs load their `sembook:init` data into named graphs during the bootstrap sequence before `notebook:ready` fires. Rendering is lazy: Intersection Observer triggers Cytoscape and SPARQL rendering only when a lab enters the viewport.

**Rationale:** Deep linking to any lab must produce a correct visualization. The graph state for every lab must be present in the quad store before any rendering occurs. Initialization is cheap (JSON-LD parsing, quad insertion). Rendering is expensive (Cytoscape layout). Separating them solves deep linking without paying the full rendering cost for all labs.

**Consequences:**
- Bootstrap sequence must iterate all labs in order before firing `notebook:ready`
- The page-level throbber covers the initialization phase
- A lab with heavy init data will slow down the initial page load

**Why this is architecturally significant:** this is the mechanism that makes multi-lab notebooks work at all, and it's explicitly untested at scale — STORY.md's open questions note that "whether Cytoscape instance count, per-lab reasoning, or Full Graph queries spanning many named graphs hold up" at book-chapter length hasn't been validated. A decision with a known, flagged scalability question is exactly the kind of thing worth keeping visible as its own record rather than burying in a subsystem list.

---

## ADR-019 — Parse Button as Explicit Commit, No Live Updates

**Context:** Live update on keystroke (debounced) would give the audience real-time graph feedback as they type. An explicit Parse button requires deliberate action but gives the instructor control.

**Decision:** The Parse button is the only trigger for graph updates from editor panels. Editing the textarea or CodeMirror editor does not update the graph. The editor is a staging area.

**Alternatives Considered:**
- Live update on keystroke (debounced 500ms)
- Auto-parse on blur
- Both (live preview + explicit commit)

**Rationale:** The three-state demo (raw JSON → identity → connection) requires distinct beats that the instructor controls. Live updates would blur the transitions — the audience would see a continuous animation as the instructor types, losing the clarity of each reveal. The Parse button gives the instructor a deliberate moment: "watch what happens when I do this." That moment of anticipation before the button press is pedagogically valuable. It also prevents parse errors from appearing mid-keystroke and breaking the visual flow.

**Consequences:**
- The editor and the graph are not always in sync — the editor may be "ahead" of the graph
- Parse errors are surfaced inline in the panel, not as toast notifications or console errors
- The Clear affordance removes the panel's fragment from the graph

**Why this is architecturally significant:** every editor-type panel, present and future, inherits this interaction model — it's not a property of one panel but of the "editor panel" concept itself. It also shapes how any future derived-state subsystem must hook in: reasoning materialization (DDR-031) fires on this same Parse commit rather than as a separate action, so any future derived-state feature (a validator, a second inference layer) would be expected to follow the same one-gesture pattern rather than inventing its own trigger.

**See also:** [DDR-031](DESIGN_DECISIONS.md) (reasoner materialization fires on this same Parse commit, not on a separate action).

---

## ADR-029 — CodeMirror 6 for All Code Editing Surfaces

**Context:** The initial implementation used plain `<textarea>` elements for JSON-LD editing. Tab behavior was jarring (focus jump rather than indent). The editor needed to be visually lightweight but functional.

**Decision:** CodeMirror 6 replaces all textarea elements in editor panels. JSON panels use the `@codemirror/lang-json` extension. Turtle panels use `@codemirror/legacy-modes` with the Turtle StreamLanguage. Read-only panels (Turtle Reader) use `EditorView.editable.of(false)`.

**Alternatives Considered:**
- Monaco Editor (VS Code's editor — powerful, but large bundle)
- Ace Editor (older, less maintained)
- Enhanced textarea with Tab override only

**Rationale:** CodeMirror 6 is modular, lightweight, and available as ES modules from CDN (no build step). It handles Tab correctly, provides line numbers, bracket matching, and syntax highlighting. The same editor component serves both editable (JSON-LD Writer, Turtle Writer) and read-only (Turtle Reader) surfaces — visual consistency is pedagogically important. The subtle background color difference between editable and read-only editors is a deliberate affordance signal.

**Consequences:**
- All editor content is accessed via `editorView.state.doc.toString()` not `textarea.value`
- Setting content programmatically uses `editorView.dispatch({ changes: { from: 0, to: ..., insert: ... } })`
- CodeMirror 6 ESM imports are loaded inside the component module, not as global script tags

**Why this is architecturally significant:** every editor surface in the system — present and future — depends on this one library; swapping it touches every editor panel simultaneously, not one component in isolation.

---

*Records here are added when a new decision clears the bar in the "How This Relates" section above. When a decision changes, append a dated Revision/Correction section (see ADR-010) rather than editing the original text away.*
