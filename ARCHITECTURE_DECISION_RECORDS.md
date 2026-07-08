# Semantic Notebook — Architecture Decision Records
> Omnibus ADR document. Each record captures a decision, its context, the alternatives considered, and the rationale. Records are immutable — if a decision changes, a new ADR supersedes the old one. Superseded records are retained for audit.

---

## ADR Index

| ID | Title | Status |
|---|---|---|
| ADR-001 | Teaching tool, not a general-purpose triplestore UI | Accepted |
| ADR-002 | Notebook as semantic artifact | Accepted |
| ADR-003 | JSON-LD as notebook wire format, Turtle as authoring format | Accepted |
| ADR-004 | `sembook:` vocabulary in its own namespace | Accepted |
| ADR-005 | Native Web Components, no JS framework | Accepted |
| ADR-006 | No build step | Accepted |
| ADR-007 | N3.js as in-browser quad store | Accepted |
| ADR-008 | Comunica as SPARQL engine | Accepted |
| ADR-009 | N3.js Reasoner for RDFS/OWL 2 RL, EYE JS deferred | Accepted |
| ADR-010 | Cytoscape.js for graph visualization | Accepted |
| ADR-011 | One lab, one named graph | Accepted |
| ADR-012 | Infrastructure in default graph, teaching data in named graphs | Accepted |
| ADR-013 | SPARQL as universal panel configuration surface | Accepted |
| ADR-014 | Tailwind CSS utility classes for layout | Accepted |
| ADR-015 | Scroll-based navigation, Intersection Observer rendering | Accepted |
| ADR-016 | Eager initialization, lazy rendering | Accepted |
| ADR-017 | `graph:upsertFragment` replace-not-diff model | Accepted |
| ADR-018 | Blank node scoping by fragment URI | Accepted |
| ADR-019 | Parse button as explicit commit, no live keystroke updates | Accepted |
| ADR-020 | Notebook context as event bus mediator | Accepted |
| ADR-021 | `init()` method for dynamically created panel components | Accepted |
| ADR-022 | `unionDefaultGraph: true` with compensating named graph filters | Accepted |
| ADR-023 | Prefix sync via event bus | Accepted |
| ADR-024 | Cytoscape destroy-and-recreate for compound node graphs | Accepted |
| ADR-025 | `explorer:selected` event for entity explorer selection | Accepted |
| ADR-026 | Pre-baked datasets, no cross-origin fetch | Accepted |
| ADR-027 | Static-first deployment, backend-agnostic URI scheme | Accepted |
| ADR-028 | Per-notebook directory structure (`/notebook1/`, `/notebook2/`) | Accepted |
| ADR-029 | CodeMirror 6 for all code editing surfaces | Accepted |
| ADR-030 | Literals as nodes in graph visualization | Accepted |
| ADR-031 | Materialization on Parse via N3.js Reasoner, RDFS/OWL2RL-BGP subset | Accepted |
| ADR-032 | Entity explorer renders equivalence merges, inferred memberships, and class assertions | Accepted |
| ADR-033 | Entity explorer scope toggle = lab vs cumulative; meta-vocabulary always hidden | Accepted |

---

## ADR-001 — Teaching Tool, Not a General-Purpose Triplestore UI

**Status:** Accepted  
**Date:** Project inception

### Context
The semantic notebook could be built as a general-purpose RDF exploration tool — something like a browser-based alternative to Protégé or Blazegraph's workbench. The audience for such a tool would be broader.

### Decision
The tool is a teaching surface, not a general-purpose utility. Every design decision is subordinate to the pedagogical arc. Features that are useful in a general tool but that don't serve a specific teaching moment are out of scope.

### Alternatives Considered
- General-purpose RDF browser with teaching mode
- Jupyter-style notebook with RDF kernel

### Rationale
A general-purpose tool optimizes for breadth of capability. A teaching tool optimizes for clarity of the learning moment. These goals conflict. A tool that tries to serve both will fail at both. The teaching goal is primary because it is what the book, the talk, and the workshop all require. Scope discipline is the only way to ship something that actually works on stage.

### Consequences
- Features that don't serve a teaching moment are deferred indefinitely
- UI decisions prioritize instructor control over user flexibility
- The tool is not positioned as an open-source RDF utility

---

## ADR-002 — Notebook as Semantic Artifact

**Status:** Accepted  
**Date:** Project inception

### Context
The notebook format could be a proprietary JSON schema, a YAML config file, a database schema, or any number of standard formats. The format choice has downstream consequences for queryability, interoperability, and intellectual consistency.

### Decision
The notebook format is a semantic artifact. Notebooks are stored as JSON-LD conforming to the `sembook:` OWL ontology. The notebook definition is loaded into the quad store at bootstrap and is itself queryable via SPARQL.

### Alternatives Considered
- Plain JSON with a custom schema
- YAML configuration (simpler authoring, but no semantic type system)
- Database-backed (powerful, but requires a server)

### Rationale
Michael authored the definitive book on semantic web technologies. A teaching tool for semantic web that uses an opaque proprietary format is self-refuting. The notebook format being a semantic artifact means: you can query the notebook with SPARQL, you can reason over it, you can describe it with OWL, you can publish the vocabulary at a dereferenceable URI. The tool is dogfooding the thesis at the deepest possible level. This is not purist indulgence — it is the argument made concrete.

### Consequences
- Bootstrap must parse JSON-LD and load it into the quad store
- Components read their own configuration from the quad store by querying their own IRI
- The `sembook:` vocabulary must be maintained as a proper OWL ontology
- Notebook authoring requires JSON-LD literacy (acceptable — this is a tool for practitioners)

---

## ADR-003 — JSON-LD as Wire Format, Turtle as Authoring Format

**Status:** Accepted  
**Date:** Project inception

### Context
RDF can be serialized in many formats: Turtle, JSON-LD, N-Quads, RDF/XML, TriG. The choice of format affects authoring experience, tooling compatibility, and runtime behavior.

### Decision
Notebooks are authored and stored as JSON-LD. The server (when it exists) may accept Turtle as an authoring format and serialize to JSON-LD for the wire. The browser runtime always works with JSON-LD.

### Alternatives Considered
- Turtle only (more readable, but requires a server to parse before client use)
- JSON-LD only (current approach)
- Multiple formats with content negotiation

### Rationale
JSON-LD maps directly to JavaScript object models. The C# backend (future) can deserialize JSON-LD with a JSON-LD processor into typed objects without writing a custom Turtle parser. The browser receives JSON-LD in a `<script type="application/ld+json">` block — a well-understood web pattern. N3.js parses JSON-LD natively. Turtle is more readable for humans and is used as the teaching syntax in the notebook's own content — but keeping the configuration format as JSON-LD maintains consistency between the format that describes the tool and the format the tool teaches.

### Consequences
- `@list` containers must be used for ordered collections to preserve lab and panel order
- The `sembook.ttl` ontology file is Turtle (for Protégé compatibility), but the notebook definition files are JSON-LD
- When the C# backend is added, it reads Turtle, serializes to JSON-LD for the wire

---

## ADR-004 — `sembook:` Vocabulary in Its Own Namespace

**Status:** Accepted  
**Date:** Early design

### Context
The vocabulary that describes notebooks, labs, and panels needs a home. Candidates were the HydrAI namespace (`hydrai:`), a sub-namespace of the project, or its own top-level namespace.

### Decision
The vocabulary lives at `https://sembook.example.org/vocab#` under the `sembook:` prefix. It is a separate project from HydrAI with its own identity.

### Alternatives Considered
- HydrAI namespace (`hydrai:Notebook`, `hydrai:Lab`, etc.)
- Sub-namespace of the book's domain

### Rationale
HydrAI is about agent-native Hydra extensions — operation cost hints, SPARQL-native resource support, binding specs. A semantic notebook vocabulary is a different concern entirely. Folding it into HydrAI would dilute both. The notebook vocabulary is general enough to be useful to anyone building interactive semantic teaching tools — not just this project, not just this talk. Giving it its own namespace and its own identity makes it a potential contribution to the ecosystem in its own right. It could be released alongside the book as "here's the open vocabulary the companion tool uses."

### Consequences
- `sembook:` namespace must be maintained separately from `hydrai:`
- The ontology (`sembook.ttl`) is a publishable artifact
- Future contributors can extend the vocabulary independently

---

## ADR-005 — Native Web Components, No JS Framework

**Status:** Accepted  
**Date:** Project inception

### Context
Modern web UI development defaults to React, Vue, or similar frameworks. These frameworks offer component models, state management, and large ecosystems.

### Decision
All components are native HTML Custom Elements (Web Components). No React, no Vue, no Angular, no Svelte. Third-party libraries for specific capabilities (Cytoscape, CodeMirror, N3.js) are permitted. General-purpose UI frameworks are not.

### Alternatives Considered
- React (most common, large ecosystem)
- Vue (lighter, simpler)
- Lit (Web Components with framework conveniences)
- No framework, vanilla DOM manipulation

### Rationale
The system is teaching that HTML is a hypermedia format, not a UI markup language. Using React to build a tool that makes this argument would undermine the argument. The browser has a native component model — Web Components — that is architecturally appropriate. Additionally: this is a teaching tool, and the implementation should be inspectable. An audience member who opens DevTools should be able to read the component code without framework knowledge. No build step means no compilation barrier between the source and what runs in the browser. Web Components also cross the shadow DOM boundary cleanly with CSS custom properties, which is the right model for the design token layer.

### Consequences
- No JSX, no virtual DOM, no reactive data binding
- State management is explicit — the quad store is the state
- The component lifecycle is manually managed
- CDN imports only, no package manager at runtime

---

## ADR-006 — No Build Step

**Status:** Accepted  
**Date:** Project inception

### Context
Modern JavaScript projects use build tools (webpack, vite, rollup, esbuild) for bundling, transpilation, and optimization. These tools add complexity but enable features like TypeScript, module resolution, and tree shaking.

### Decision
No build step. ES modules loaded directly from CDN or relative paths. The source is what runs in the browser.

### Alternatives Considered
- Vite (fast, minimal config)
- esbuild (very fast)
- TypeScript compilation only (no bundling)

### Rationale
Fit with the organizational constraint: this is an independent project with no CI/CD pipeline and no dedicated build infrastructure. A build step adds a failure mode between writing code and seeing it run. For a conference demo tool, that failure mode is unacceptable. ES modules are natively supported in all modern browsers. CDN imports are reliable for known stable versions. The transparency of no build step — the source is the running code — is also consistent with the teaching goals of the project.

### Consequences
- No TypeScript (JavaScript only)
- No tree shaking or bundle optimization
- CDN availability is a dependency (mitigated by pre-baked datasets for offline use)
- Module import paths are relative or CDN URLs

### Reconsideration Triggers (added after vendoring CodeMirror, iteration 10)
`esm.sh` intermittently failed to serve `@codemirror/view` during a live session, which silently broke `sem-panel-jsonld`/`sem-panel-turtle` (the custom element never upgrades, and there's no error surfaced to the user). The fix was to vendor CodeMirror's full dependency graph (18 files) under `/vendor/codemirror/` and resolve it via a native `<script type="importmap">` — still zero build step, per ADR-006, since the files are unmodified ESM copies and the import map is a browser platform feature, not a bundler.

This decision (no build step) still holds, but should be actively revisited — not silently worked around again — if any of the following happen:
- **Vendoring becomes a recurring chore.** This session's resolution was manual: fetch each package's `package.json` from the registry, read its `exports`/`module` field, grep its actual `import` statements to verify the transitive closure, `curl` each file. That's tolerable once. If a second or third dependency needs the same treatment, the manual process doesn't scale and a minimal fetch-only tool (not a bundler — just something to script what was done by hand here) is worth introducing.
- **A future dependency has a messier dependency graph than CodeMirror's** (dynamic imports, non-ESM packages, circular re-exports) such that flat-file vendoring + an import map can't represent it cleanly.
- **A second contributor joins.** The Tailor-Made "team fit" for this ADR assumes one person; standard tooling (npm + a bundler) has a real onboarding-cost argument once that's no longer true.
- **TypeScript or JSX genuinely becomes desired** for a component, not just hypothetically nice-to-have — the "no build step" constraint is the only thing currently ruling this out.
- **The conference/offline deployment constraint loosens** (e.g., the notebook moves to an always-hosted environment with CI as ADR-027's future backend arrives) — the "zero ops, must never fail on stage" argument for no build step weakens once there's a deploy pipeline anyway.

None of these are true yet — this is a flag for the architect, not a pending action.

---

## ADR-007 — N3.js as In-Browser Quad Store

**Status:** Accepted  
**Date:** Early design

### Context
The system requires an in-browser RDF store that supports named graphs (quads), can parse Turtle and JSON-LD, and integrates with a SPARQL engine.

### Decision
N3.js `Store` is the quad store. N3.js `Parser` handles Turtle and N-Quads parsing. `jsonld.js` handles JSON-LD to N-Quads conversion before N3.js ingestion.

### Alternatives Considered
- Quadstore + MemoryLevel (more full-featured, larger bundle)
- RDFLib.js (Python port, less maintained)
- Custom in-memory store

### Rationale
N3.js is the most actively maintained RDF library in the JavaScript ecosystem. Its `Store` class is natively a quad store — named graph support is first-class, not bolted on. It integrates naturally with Comunica via the RDF/JS interface. The `Parser` handles Turtle natively, which is important for the Turtle Writer panel. Quadstore was considered but adds LevelDB as a dependency and is heavier than needed for teaching-sized datasets.

### Consequences
- `jsonld.js` is a separate dependency for JSON-LD parsing (N3.js handles N-Quads output from jsonld.js)
- The store is in-memory only — no persistence across sessions without server intervention
- Quad IDs use N3.js `DataFactory` conventions

---

## ADR-008 — Comunica as SPARQL Engine

**Status:** Accepted  
**Date:** Early design

### Context
SPARQL 1.1 query execution is required for all panel data fetching. The engine must run in the browser against an N3.js store.

### Decision
Comunica `QueryEngine` from `@comunica/query-sparql` is the SPARQL engine. It is imported as an ES module from CDN.

### Alternatives Considered
- SPARQL.js (parser only, not an engine)
- Custom SPARQL subset implementation
- Server-side SPARQL via HTMX

### Rationale
Comunica is designed for the browser, supports SPARQL 1.1, integrates with N3.js via the RDF/JS Query interface, and is actively maintained. Server-side SPARQL would violate the local execution constraint (C5). Custom implementation would violate the no invented abstractions constraint (C4).

### Consequences
- `unionDefaultGraph: true` must be set on all queries to make named graph data reachable
- Named graph scoping in panel queries is the developer's responsibility (Comunica won't enforce it)
- Comunica's ESM build must be loaded before any component queries run

---

## ADR-009 — N3.js Reasoner for RDFS/OWL 2 RL, EYE JS Deferred

**Status:** Accepted  
**Date:** Early design

### Context
RDFS and OWL reasoning is required for the "emergence reveal" — the central teaching moment where the graph knows more than the user typed. Several browser-compatible reasoning options exist.

### Decision
N3.js Reasoner handles RDFS and OWL 2 RL materialization. EYE JS (WebAssembly Prolog-based reasoner) is deferred for use when N3 rule-based reasoning is needed.

### Alternatives Considered
- HyLAR (RDFS + OWL RL, but built on deprecated rdfstore.js)
- EYE JS immediately (more capable, but heavier WASM load)
- Server-side reasoning via HTMX

### Rationale
N3.js Reasoner is built on N3.js (already in the stack), supports RDFS transitivity, inverseOf, TransitiveProperty, domain/range inference — everything needed for the teaching arc's reasoning reveals. EYE JS brings full N3 rule reasoning and proof traces, which is more powerful than needed for v1 and adds WASM cold-start latency. The deferred constraint — bring in EYE JS when heavier reasoning is demonstrated — follows the Tailor-Made principle of not overprescribing.

### Consequences
- Full OWL DL reasoning (tableaux) is not available client-side
- Reasoning output goes into `<lab-iri-inferred>` named graph (not yet wired)
- EYE JS integration is a planned future iteration

---

## ADR-010 — Cytoscape.js for Graph Visualization

**Status:** Accepted  
**Date:** Early design

### Context
The graph visualization is central to the teaching surface. It must handle node-edge graphs (for triple visualization) and compound node graphs (for class hierarchy visualization). Layout algorithms, interactive selection, and export are required.

### Decision
Cytoscape.js is the graph visualization library for all panel types. Cola layout for force-directed clustering. Compound nodes for the entity explorer hierarchy.

### Alternatives Considered
- D3.js (more control, significantly more implementation effort)
- Sigma.js (simpler, less feature-rich)
- Custom SVG/Canvas

### Rationale
Cytoscape.js offers compound nodes (parent-child containment), multiple layout algorithms, interactive selection, pan/zoom, and export — all first-class. D3 was considered for the entity explorer's nested set visualization but rejected: D3's circle packing layout isn't containment-based, and the interaction model (drill-down, zoom, click to enumerate) requires significant custom state management that Cytoscape provides natively. The decision was to use Cytoscape compound nodes for v1 and revisit D3 for book artifact export if the visual needs to be more polished.

### Consequences
- Cytoscape instances are expensive — created on first intersection, kept alive, not destroyed on scroll-out
- Compound node graphs must be destroyed and recreated on update (incremental update is fragile)
- The Cytoscape instance reference is the one documented exception to the stateless panel model

---

## ADR-011 — One Lab, One Named Graph

**Status:** Accepted  
**Date:** Early design — supersedes earlier sub-graph model

### Context
Early design considered giving each JSON-LD editor panel its own named graph (`<lab-doc-a>`, `<lab-doc-b>`). This would allow tracking which panel contributed which triples.

### Decision
One lab maps to one named graph. The lab IRI is the named graph IRI. All content in a lab — init data, editor A, editor B, fetched resources — lives in the same named graph. Fragment identity is tracked separately via the `upsertFragment` mechanism, not via named graph splitting.

### Alternatives Considered
- Per-panel named graphs (rejected)
- Hierarchical named graphs with a lab root (rejected as overcomplicated)

### Rationale
Named graph boundaries are architectural, not editorial. What makes two JSON documents "disconnected islands" is the data — the absence of shared IRIs — not the named graph they live in. The connection moment (adding `@type: "@id"` to the context) works because the IRI now resolves to the same entity, not because the graphs merged. Splitting named graphs per panel adds complexity for no teaching benefit and creates join queries every time a panel wants to see the full lab state. Michael collapsed this with the observation: "Why can't the entire lab be one named graph?" That question dissolved the unnecessary complexity.

### Consequences
- Fragment ownership is tracked in `NotebookContext._fragmentOwnership` (fragmentUri → quads)
- `upsertFragment` removes and replaces by fragment, not by named graph
- Panel SPARQL queries target the lab named graph, not a per-panel graph

---

## ADR-012 — Infrastructure in Default Graph, Teaching Data in Named Graphs

**Status:** Accepted  
**Date:** Discovered in implementation (iteration 2)

### Context
The bootstrap loads the notebook definition (labs, panels, SPARQL queries, CSS classes — all `sembook:` typed triples) into the quad store. Teaching content is also in the quad store. Without separation, panel queries return infrastructure triples mixed with teaching content.

### Decision
Notebook definition triples (infrastructure) are loaded into the default graph. Teaching content triples are loaded into named graphs (one per lab). All panel SPARQL queries must scope to named graphs only using explicit `GRAPH` clauses or `VALUES ?g { ... }`.

### Alternatives Considered
- Filter by `sembook:` namespace in every query (fragile, easy to miss)
- Separate store for infrastructure (two stores, more complexity)
- Load infrastructure into a well-known named graph and filter it out

### Rationale
The named graph boundary is the cleanest architectural separator. The default graph contains what the system knows about itself. Named graphs contain what the notebooks teach. This is a natural semantic distinction. The `sembook:` namespace exclusion filter provides a second safety layer but is not the primary mechanism. The separation was discovered when panel queries surfaced `sembook:Lab` nodes in the Cytoscape visualization — infrastructure bleeding into the teaching surface.

### Consequences
- `unionDefaultGraph: true` must be set on Comunica queries (so named graph data is reachable) but panels must scope explicitly
- The `sembook:` namespace exclusion filter is applied in entity and vocabulary panel queries as a second layer
- The default graph is reserved for infrastructure — no teaching content may go there

---

## ADR-013 — SPARQL as Universal Panel Configuration Surface

**Status:** Accepted  
**Date:** Early design

### Context
Panels need a way to specify what data they render. Early designs used magic strings (`"local"`, `"full"`) or typed properties (`sembook:scope: "cumulative"`) to indicate data scope.

### Decision
Every panel has a `sparql` attribute containing a SPARQL SELECT query. The panel executes this query against the quad store and renders the results. The query is the only configuration surface for data scope.

### Alternatives Considered
- Magic string variants (`"local"`, `"full"`, `"cumulative"`)
- `sembook:scope` typed property with enum values
- Parameterized queries with scope flags

### Rationale
Magic strings and typed scope properties require the component to interpret them — adding a vocabulary of special values that must be documented, implemented, and tested. A SPARQL query is self-describing: it says exactly what it fetches. Any panel can be configured to show any slice of the graph without changing component code. Future panel types (tables, timelines, maps) fit the same contract without modification. The query is also the thing that changes between "local" and "full" scope — making the query the configuration makes the distinction visible and inspectable. Michael pushed back on the magic string proposal and the SPARQL query replaced it. That was the right call.

### Consequences
- Panel SPARQL queries are stored in the notebook JSON-LD definition
- Full Graph queries inject dynamic `VALUES ?g { ... }` clauses from `notebook.graphsUpTo(labUri)`
- The agent must never hardcode SPARQL queries in component code

---

## ADR-014 — Tailwind CSS Utility Classes for Layout

**Status:** Accepted  
**Date:** Early design

### Context
Labs and panels need configurable layout. Different labs have different arrangements. Early proposals included a custom CSS grid DSL, Bootstrap, and fixed component-level layout assumptions.

### Decision
Layout is expressed as Tailwind CSS utility class strings on the `sembook:cssClass` property in the notebook JSON-LD definition. Components read this property and apply it directly as the HTML `class` attribute. No interpretation, no mapping.

### Alternatives Considered
- Custom grid DSL (`"2-top 1-bottom"`)
- Bootstrap grid
- Fixed layout assumptions in component code
- CSS Grid template areas as a string attribute

### Rationale
A custom DSL is an invented abstraction (violates C4). Bootstrap ships opinions about components that conflict with the component model. Fixed layout assumptions prevent reuse across labs with different arrangements. Tailwind utility classes are a solved, understood, ecosystem-native solution. The `sembook:cssClass` property passes classes through without interpretation — the component doesn't need to understand layout, it just applies what the definition says. Different labs have different class strings; the component is unchanged.

### Consequences
- Tailwind CDN must be loaded before component rendering
- Layout classes in notebook JSON-LD must be valid Tailwind classes
- Design tokens (colors, spacing) use CSS custom properties rather than Tailwind configuration

---

## ADR-015 — Scroll-Based Navigation, Intersection Observer Rendering

**Status:** Accepted (subject to revision after UI validation)  
**Date:** Early design

### Context
Labs occupy the full viewport. Navigation between labs could be scroll-based (native browser anchor behavior) or reveal-based (JavaScript swapping visible labs).

### Decision
Labs are stacked vertically in the DOM. Navigation is standard browser scrolling. Fragment identifiers in URLs scroll to the target lab. Intersection Observer triggers rendering when a lab enters the viewport.

### Alternatives Considered
- Tab-style reveal (JavaScript hides/shows labs)
- Carousel/slideshow navigation
- Paginated navigation with explicit prev/next

### Rationale
Scroll is the most hypermedia-native approach — the browser's built-in anchor behavior does the work without JavaScript. Back button works. Deep linking works. The narrative has a spatial order that the audience can feel as they scroll. Tab reveal destroys that spatial metaphor. The decision was stated as provisional — "I'd have to see it" — and held after the first visual build.

### Consequences
- Intersection Observer is required for all lab rendering
- Labs that are off-screen have their Cytoscape layouts paused (not destroyed)
- Deep linking requires eager initialization (all labs initialize at page load, only render on scroll)

---

## ADR-016 — Eager Initialization, Lazy Rendering

**Status:** Accepted  
**Date:** Early design

### Context
If labs initialize and render only when scrolled into view, deep linking breaks — a late lab in the notebook depends on earlier labs' data but those labs haven't run yet.

### Decision
Initialization is eager: all labs load their `sembook:init` data into named graphs during the bootstrap sequence before `notebook:ready` fires. Rendering is lazy: Intersection Observer triggers Cytoscape and SPARQL rendering only when a lab enters the viewport.

### Rationale
Deep linking to any lab must produce a correct visualization. The graph state for every lab must be present in the quad store before any rendering occurs. Initialization is cheap (JSON-LD parsing, quad insertion). Rendering is expensive (Cytoscape layout). Separating them solves deep linking without paying the full rendering cost for all labs.

### Consequences
- Bootstrap sequence must iterate all labs in order before firing `notebook:ready`
- The page-level throbber covers the initialization phase
- A lab with heavy init data will slow down the initial page load

---

## ADR-017 — `graph:upsertFragment` Replace-Not-Diff Model

**Status:** Accepted  
**Date:** Iteration 2

### Context
When a JSON-LD editor panel parses its content, it needs to update the named graph. Options include: add new triples (accumulate), compute a diff and apply changes, or replace the panel's entire contribution.

### Decision
Each panel owns a fragment of the named graph identified by the panel's IRI. On parse, all quads previously contributed by that fragment are removed and the new quads are inserted wholesale. No delta computation.

### Alternatives Considered
- Accumulate (add only, never remove) — creates ghost triples when content changes
- Diff (compute changed triples and apply) — complex, fragile, unnecessary
- Full named graph replacement (replace everything in the lab) — loses other panels' contributions

### Rationale
The JSON-LD document in the editor is the source of truth for that fragment. When it changes, the fragment changes. There is no meaningful intermediate state between "old content" and "new content" that needs to be preserved. Replace-not-diff is simpler, more predictable, and eliminates an entire class of consistency bugs. Fragment ownership (tracked in `NotebookContext._fragmentOwnership`) gives the context exactly what it needs to remove old quads without touching other panels' contributions.

### Consequences
- `NotebookContext._fragmentOwnership` maintains a map from fragmentUri to quad set
- Parse is idempotent — parsing the same content twice produces the same graph state
- No history or undo — each parse is a clean replacement

---

## ADR-018 — Blank Node Scoping by Fragment URI

**Status:** Accepted  
**Date:** Discovered in implementation (iteration 2)

### Context
`jsonld.js` resets blank node labels (`_:b0`, `_:b1`, etc.) on every independent `toRDF()` call. Two JSON-LD panels parsed in separate calls both produce `_:b0`. When both are loaded into the same named graph, these collide — two distinct anonymous entities become one.

### Decision
Before adding quads to the store, each blank node label is prefixed with a slug derived from the panel's fragment URI. Panel A's `_:b0` becomes `_:identity-doc-a-b0`. Panel B's `_:b0` becomes `_:identity-doc-b-b0`. They cannot collide.

### Alternatives Considered
- UUID suffixes (random, not deterministic)
- Full fragment URI as prefix (too verbose)
- Separate named graphs per panel (rejected in ADR-011)

### Rationale
The collision is subtle and nearly invisible — triple counts appear correct but two entities merge silently. This directly undermines the "two islands" teaching beat: the audience needs to see two distinct anonymous entities before they add an `@context`. Fragment-URI-derived prefixes are deterministic (same input, same output) and human-readable in debug contexts.

### Consequences
- Blank node labels in the store are not the labels `jsonld.js` produces — they are transformed
- Tools that inspect the raw store see prefixed blank node IDs
- Re-parsing the same content produces the same blank node IDs (deterministic)

---

## ADR-019 — Parse Button as Explicit Commit, No Live Updates

**Status:** Accepted  
**Date:** Early design

### Context
Live update on keystroke (debounced) would give the audience real-time graph feedback as they type. An explicit Parse button requires deliberate action but gives the instructor control.

### Decision
The Parse button is the only trigger for graph updates from editor panels. Editing the textarea or CodeMirror editor does not update the graph. The editor is a staging area.

### Alternatives Considered
- Live update on keystroke (debounced 500ms)
- Auto-parse on blur
- Both (live preview + explicit commit)

### Rationale
The three-state demo (raw JSON → identity → connection) requires distinct beats that the instructor controls. Live updates would blur the transitions — the audience would see a continuous animation as the instructor types, losing the clarity of each reveal. The Parse button gives the instructor a deliberate moment: "watch what happens when I do this." That moment of anticipation before the button press is pedagogically valuable. It also prevents parse errors from appearing mid-keystroke and breaking the visual flow.

### Consequences
- The editor and the graph are not always in sync — the editor may be "ahead" of the graph
- Parse errors are surfaced inline in the panel, not as toast notifications or console errors
- The Clear affordance removes the panel's fragment from the graph

---

## ADR-020 — Notebook Context as Event Bus Mediator

**Status:** Accepted  
**Date:** Early design

### Context
Components need to communicate: editor panels update the graph, graph panels re-render, entity explorers respond to selection. Direct component-to-component communication would create coupling.

### Decision
All inter-component communication goes through the `NotebookContext` instance. Components never talk to each other directly. The context receives events, updates the quad store, and notifies subscribers.

### Alternatives Considered
- Custom DOM events bubbling through the element tree
- Global event bus singleton
- Shared reactive store (MobX-style)

### Rationale
A shared reactive store requires a framework (violates C10). Global event buses create invisible coupling between components with no clear ownership. DOM event bubbling is hard to scope — events would need to be stopped at the lab boundary manually. The notebook context is already the authoritative interface to the quad store. Making it the event bus as well keeps communication centralized, auditable, and scoped. The lab boundary scoping (`labUri` on every event) is a first-class concern of the context, not an afterthought.

### Consequences
- Every component that needs to communicate requires a reference to the notebook context
- The context's `subscribe()` and `emit()` methods are the only inter-component communication surface
- Testing requires a mock notebook context — which is also the right boundary for unit tests

---

## ADR-021 — `init()` Method for Dynamically Created Panel Components

**Status:** Accepted  
**Date:** Discovered in implementation (iteration 3)

### Context
`sem-lab` creates panel components dynamically after `notebook:ready` has already fired. Components that listen for `notebook:ready` in `connectedCallback` will never receive it because the event fired before they existed.

### Decision
Components created dynamically by `sem-lab` receive their notebook context via an explicit `init(notebook, notebookDoc)` call immediately after `appendChild`. Static components (present at parse time) may listen for `notebook:ready`. Dynamic components must use `init()`.

### Alternatives Considered
- Store the notebook context on a well-known global after `notebook:ready`
- Re-fire `notebook:ready` for late-joining components
- Use a custom element registry that injects context on element creation

### Rationale
Re-firing events creates race conditions and confusion about event ordering. A global context violates the dependency injection principle that makes components testable. The `init()` method is explicit, synchronous, and makes the dependency visible in the code. The distinction between static and dynamic components is real and worth naming — it's not a hack, it's a lifecycle contract difference.

### Consequences
- `sem-lab` must call `el.init(notebook, notebookDoc)` immediately after every `appendChild`
- All panel component classes must implement `init()`
- Unit tests inject the notebook context via `init()`, not via event listening

---

## ADR-022 — `unionDefaultGraph: true` with Compensating Named Graph Filters

**Status:** Accepted  
**Date:** Discovered in implementation (iteration 2)

### Context
Comunica by default treats queries without an explicit `GRAPH` clause as querying the SPARQL default graph only. Named graph data is not included. Full Graph queries (`SELECT * WHERE { ?s ?p ?o }`) would return only notebook infrastructure triples.

### Decision
`NotebookContext.query()` sets `unionDefaultGraph: true` on all Comunica queries, making named graph data reachable by queries without explicit `GRAPH` clauses. All panel queries must still use explicit `GRAPH` or `VALUES ?g { ... }` clauses to scope to teaching data only.

### Alternatives Considered
- Require all queries to use explicit `GRAPH` clauses (stricter, but error-prone)
- Separate Comunica instances for default and named graph queries
- Load teaching data into the default graph (violates ADR-012)

### Rationale
`unionDefaultGraph: true` is the Comunica setting that matches the expected RDF semantics — a query over all triples should include named graph data. But this alone would surface notebook infrastructure. The compensating named graph filters in panel queries provide the second layer. Together they produce correct behavior: teaching data is reachable, infrastructure is excluded.

### Consequences
- `unionDefaultGraph: true` is set in `NotebookContext.query()` and cannot be overridden per-query without bypassing the context
- Panel queries must filter by named graph — this is a developer responsibility enforced by convention, not by the engine

---

## ADR-023 — Prefix Sync via Event Bus

**Status:** Accepted  
**Date:** Iteration 9

### Context
The Turtle Reader panel serializes the named graph to Turtle using N3.js `Writer`. Turtle output quality depends on having the right prefix declarations. JSON-LD `@context` entries contain prefix mappings that should appear as `@prefix` declarations in the Turtle output.

### Decision
When `sem-panel-jsonld` parses a document, it extracts `@context` prefix mappings and includes them in the `graph:upsertFragment` event. `NotebookContext` maintains a per-lab prefix map. `sem-panel-turtle` calls `notebook.getPrefixes(labUri)` before serializing.

### Alternatives Considered
- Fixed well-known prefixes only (rdf, rdfs, owl, schema, xsd)
- Extract prefixes from the quad store by IRI pattern matching
- Require explicit prefix configuration in the notebook definition

### Rationale
The 1:1 correspondence between JSON-LD `@context` prefixes and Turtle `@prefix` declarations is a teaching point. The audience should see that these are the same concept expressed in two syntaxes. Making the prefix sync automatic and visible — the prefix you define in JSON-LD appears in the Turtle — demonstrates this without explanation. Fixed prefixes would miss user-defined prefixes. IRI pattern matching is fragile. Explicit configuration is redundant when `@context` already contains the information.

### Consequences
- `graph:upsertFragment` now carries a `prefixes` payload (additive, not breaking)
- `NotebookContext.getPrefixes(labUri)` returns the merged prefix map for a lab
- Turtle Writer (sem-panel-turtle-writer) also extracts prefixes from parsed Turtle and syncs them

---

## ADR-024 — Cytoscape Destroy-and-Recreate for Compound Node Graphs

**Status:** Accepted  
**Date:** Iteration 6

### Context
The entity explorer uses Cytoscape compound nodes for class hierarchy visualization. Cytoscape compound node graphs cannot be updated incrementally without losing parent-child structure. Standard graph panels use `cy.elements().remove(); cy.add(elements)` for updates.

### Decision
`sem-panel-entity` destroys and recreates the Cytoscape instance on every `graph:updated` event. `sem-panel-graph` uses the incremental update approach (remove and add elements, re-run layout).

### Alternatives Considered
- Incremental compound node update with careful diffing
- Re-parenting nodes in place
- Unified destroy-and-recreate for all panel types

### Rationale
Cytoscape compound node parent-child relationships are set at node creation and are not easily modified after the fact. Attempting to update compound node structure incrementally is fragile and produces visual artifacts. For teaching-sized datasets, destroy-and-recreate is imperceptible. The visual artifact of a full re-layout is preferable to broken compound nesting. The two panel types have different update models because their data structures have different update characteristics.

### Consequences
- Selection state is lost on every `graph:updated` in the entity explorer
- The Cytoscape instance reference in `sem-panel-entity` is short-lived (recreated on update)
- Layout animation runs on every update — this is acceptable and arguably desirable (the hierarchy "settles" visually)

---

## ADR-025 — `explorer:selected` Event for Entity Explorer Selection

**Status:** Accepted  
**Date:** Iteration 6

### Context
The entity explorer has two panes: a class hierarchy visualizer (left) and a property viewer (right). Selection in the left pane drives the right pane. This is component-to-component communication within a single parent component.

### Decision
Selection is managed as internal state within `sem-panel-entity`. When selection changes, `sem-panel-entity` fires `explorer:selected` on the notebook context event bus with `{ labUri, entityIri, selectionType }`. External components (e.g., a future property panel that is separate from the entity explorer) can listen for this event scoped to their lab.

### Alternatives Considered
- Direct method call from left pane to right pane (tight coupling)
- Shared state object passed to both sub-panes
- DOM custom event bubbling

### Rationale
Even though the entity explorer currently manages both panes internally, the selection event on the event bus makes the interaction pattern visible and extensible. A future lab might have a standalone property viewer that responds to entity selection from a different panel. Putting the selection on the event bus makes that possible without refactoring. The `labUri` scope ensures the event doesn't bleed across labs.

### Consequences
- `explorer:selected` is a new event type on the notebook context
- External components can subscribe to entity selection without coupling to `sem-panel-entity`
- The event fires even when the right pane is within `sem-panel-entity` itself — the component both emits and acts on it

---

## ADR-026 — Pre-Baked Datasets, No Cross-Origin Fetch

**Status:** Accepted  
**Date:** Iteration 5

### Context
The Fetch affordance in JSON-LD panels allows loading external data by URL. The "datasets unlock datasets" demo beat requires fetching a richer description of an entity. CORS restrictions prevent direct browser-to-DBpedia fetching.

### Decision
Datasets that simulate external resources are pre-baked as local JSON-LD files in `/datasets/`. The Fetch affordance works with relative paths to these files. Cross-origin fetching is not supported in v1.

### Alternatives Considered
- CORS proxy server (adds server dependency)
- Wikidata SPARQL endpoint (CORS-friendly, but live network dependency)
- Pre-fetched and cached remote responses

### Rationale
Conference wifi is unreliable (environmental fit constraint). A live remote fetch during a demo is a liability. Pre-baked local files give the instructor full control over what properties appear when a dataset is loaded — which is pedagogically superior to unpredictable live data. The file is local so the fetch is fast and reliable. CORS proxy would add a server dependency that violates the static-first constraint (C11). The audience does not know or care whether the "external" dataset is truly remote.

### Consequences
- `/datasets/` directory contains curated JSON-LD files for each demo scenario
- Future: CORS proxy via HTMX for genuinely live external data (separate iteration)
- The Fetch affordance is a URL input — it works with any URL the browser can reach, including local paths

---

## ADR-027 — Static-First Deployment, Backend-Agnostic URI Scheme

**Status:** Accepted  
**Date:** Project inception

### Context
The long-term vision includes a C# backend with Razor rendering, persistent notebook storage, and server-side operations. The short-term reality is static file hosting.

### Decision
The system is designed for static file deployment. The C# backend is a future addition that must not require changes to component code when it arrives. The URI scheme uses human-readable slugs (`#identity`, `#vocabulary`) that are stable across static and server-backed deployment. The only seam is the `fetch()` URL in the bootstrap call.

### Rationale
Fit with organizational constraints: no ops team, no server infrastructure, conference deployment is file copy. Building in server dependencies now would make the system undevelopable in the current environment. The backend arrives when it's needed (persistence, multi-user, auth) and the architecture accommodates it without rewrites.

### Consequences
- `bootstrap('notebooks/intro.jsonld')` is the only place a URL appears that will change when the backend arrives
- Components never construct URLs — they receive them from the notebook context
- The backend, when it arrives, must serve the same JSON-LD contract the static files serve

---

## ADR-028 — Per-Notebook Directory Structure

**Status:** Accepted  
**Date:** Iteration 7

### Context
Multiple notebooks need to coexist. Options include query parameters (`?notebook=intro`), path-based routing, or separate directories.

### Decision
Each notebook has its own directory: `/notebook1/index.html`, `/notebook2/index.html`. All notebooks share common assets at `/scripts/`, `/components/`, `/styles/`, `/notebooks/`, `/datasets/`.

### Alternatives Considered
- Single HTML file with query parameter (`?nb=intro`)
- Sub-paths under a notebook root (`/notebooks/intro/`)
- Separate domains

### Rationale
Directories are resources. `/notebook1/` is a dereferenceable resource. It's navigable, linkable, bookmarkable without query parameters. It matches the resource-orientation principle. Each notebook's `index.html` is a thin shell that differs only in the bootstrap fetch URL and the CDN imports needed. Common assets are shared without duplication. When the backend arrives, `/notebook1/` maps naturally to a server route.

### Consequences
- Relative paths in notebook HTML must use `../` to reach shared assets
- A new notebook is a new directory with a thin `index.html` shell
- Notebook-specific styles or scripts live in the notebook directory; shared ones in `/scripts/` and `/styles/`

---

## ADR-029 — CodeMirror 6 for All Code Editing Surfaces

**Status:** Accepted  
**Date:** Iteration 8

### Context
The initial implementation used plain `<textarea>` elements for JSON-LD editing. Tab behavior was jarring (focus jump rather than indent). The editor needed to be visually lightweight but functional.

### Decision
CodeMirror 6 replaces all textarea elements in editor panels. JSON panels use the `@codemirror/lang-json` extension. Turtle panels use `@codemirror/legacy-modes` with the Turtle StreamLanguage. Read-only panels (Turtle Reader) use `EditorView.editable.of(false)`.

### Alternatives Considered
- Monaco Editor (VS Code's editor — powerful, but large bundle)
- Ace Editor (older, less maintained)
- Enhanced textarea with Tab override only

### Rationale
CodeMirror 6 is modular, lightweight, and available as ES modules from CDN (no build step). It handles Tab correctly, provides line numbers, bracket matching, and syntax highlighting. The same editor component serves both editable (JSON-LD Writer, Turtle Writer) and read-only (Turtle Reader) surfaces — visual consistency is pedagogically important. The subtle background color difference between editable and read-only editors is a deliberate affordance signal.

### Consequences
- All editor content is accessed via `editorView.state.doc.toString()` not `textarea.value`
- Setting content programmatically uses `editorView.dispatch({ changes: { from: 0, to: ..., insert: ... } })`
- CodeMirror 6 ESM imports are loaded inside the component module, not as global script tags

---

## ADR-030 — Literals as Nodes in Graph Visualization

**Status:** Accepted  
**Date:** Iteration 3

### Context
Literal values (strings, numbers, dates) in RDF triples can be visualized as either: leaf nodes with edges from their subject, or as properties displayed on the subject node (tooltip, label, or inline text).

### Decision
Literals are rendered as nodes — rounded rectangles in light gray — connected to their subject by edges. They are not suppressed as annotations.

### Alternatives Considered
- Literals as subject node properties (tooltip or inline text)
- Literals hidden from the graph, shown only in the entity explorer
- Toggle between node and annotation modes

### Rationale
The core teaching beat of the first demo requires showing that raw JSON is "already a proto-graph — just lacking connective tissue." If literals are suppressed, the "two islands" state looks sparse and doesn't communicate that there's already structure there. Showing literals as nodes makes the graph look populated even before any context is applied. The audience can see: there's a node for the book, and it has three properties hanging off it. The context doesn't create the graph — it reveals the relationships that were implicit. Suppressing literals would make the "before" state misleading.

### Consequences
- Literal nodes use `literalId(term)` (deterministic hash of value + datatype + language) for deduplication
- The graph visualization is denser than it would be with literals suppressed
- Long literal values are truncated to 20 characters with `…` in the node label; full value shown on hover

---

## ADR-031 — Materialization on Parse via N3.js Reasoner, RDFS/OWL2RL-BGP Subset

**Status:** Accepted
**Date:** Iteration 11
**Refines:** ADR-009 (wires up the "not yet wired" inferred graph; narrows "RDFS and OWL 2 RL" — see §Ruleset)

### Context
ADR-009 chose the N3.js Reasoner and reserved a `<lab-iri-inferred>` named graph for reasoning output, but reasoning was never wired in. This iteration materializes inferred triples automatically on every Parse and renders them distinctly (dashed graph edges, italic entity-property rows).

Investigation surfaced three facts that shaped the decision, none of which were true as the spec assumed:

1. **The pinned `n3@1.17.2` has no Reasoner.** `N3Reasoner.js` first appears in the `n3` `1.x` line at **1.21.0**; 1.17.2 ships only Parser/Writer/Store/DataFactory.
2. **N3.js bundles no ruleset.** `Reasoner.reason(rules)` takes a user-supplied dataset of N3 `{…} => {…}` rules.
3. **The Reasoner is BGP-only** — "only rules with Basic Graph Patterns in premise and conclusion; built-ins and backward-chaining are not supported." It runs to a fixpoint (rules chain).

### Decision

**Trigger.** Materialization runs inside `NotebookContext.upsertFragment()` — the single chokepoint every Parse path (JSON-LD, JSON-LD-split, Turtle Writer) already funnels through — after the asserted quads land and before subscribers are notified. It is not a user-visible action: no "Reason" button, fires on every Parse.

**Dependency.** Bump the global `n3` script from 1.17.2 to **1.26.0** (final 1.x — has the Reasoner, keeps the Store/Parser/Writer/DataFactory API the app already uses). Not the 2.x major bump.

**Isolation + idempotency.** Reasoning runs in a throwaway `N3.Store` holding a copy of the lab's asserted triples in its *default graph* (the Reasoner adds conclusions to the graph it reasons over and mutates in place, so an isolated single-graph scratch keeps asserted+derived together and diffable). Newly-derived triples = scratch minus the asserted snapshot; those are written into `<lab-iri>-inferred`. The inferred graph is cleared and recomputed on every Parse, so repeated/overlapping parses never accumulate duplicates. Per-lab scope only — the reasoner sees one lab's own named graph, matching how that lab's asserted graph is scoped (not a cross-lab union). A full re-reason per Parse is synchronous and trivially fast at teaching-data scale; no incremental reasoning.

**Ruleset (`scripts/reasoning-rules.js`).** Hand-authored N3 covering the BGP-expressible fragment: RDFS (subClass/subProperty transitivity + rdfs9/rdfs7 propagation, domain, range) and the relational OWL 2 RL axioms (inverseOf, Symmetric/TransitiveProperty, equivalentClass/Property, partial owl:sameAs). This **narrows ADR-009's "OWL 2 RL"**: the OWL2RL rules needing built-ins or rdf:Lists — cardinality, hasKey, propertyChainAxiom, intersectionOf/unionOf/someValuesFrom constructors, datatype checks — cannot be expressed in N3.js and are out of scope. Heavier reasoning remains the deferred EYE JS escalation (ADR-009).

**Rendering.** Graph panels' queries are rewritten (in `sem-lab._inferredAwareGraphSparql`) to also span each in-scope lab graph's `-inferred` companion and project `?g`; `sparqlToElements` styles edges from an inferred graph as dashed (the pre-existing, unused `edge.inferred` style), asserted edges solid, deduping a triple seen in both graphs to solid. The entity explorer's `_renderInstanceProperties` (only) queries the inferred graphs too and italicizes property rows whose triple lives in `sembook:inferred`. The class-hierarchy/member queries and the vocab panel are untouched — the inferred graph is simply populated so a future vocab/SPARQL panel can query it without rework.

### Alternatives Considered
- **2.x major bump** — larger blast radius across Store/Parser/DataFactory usage for no gain over 1.26.0.
- **Reason in place on the main store** — no clean asserted/inferred separation; mixing derived triples into the lab graph mid-computation risks silent duplication (the failure mode the handoff explicitly warned against).
- **Blanket-including the inferred graphs via the shared cumulative-VALUES helper** — would leak inferred triples into the entity hierarchy, class-member, and vocab queries, exceeding the scoped change (C12).
- **Incremental reasoning** — unnecessary at this scale; full re-reason is simpler and idempotent by construction.

### Consequences
- `n3` is pinned at 1.26.0; the existing parse/store/turtle-writer paths were smoke-tested after the bump.
- The inferred graph naming convention `<lab-iri>-inferred` is now load-bearing in three places (materialization, `sem-lab` graph-query rewrite, entity/graph provenance checks via the `-inferred` suffix).
- `owl:sameAs` value-replication can derive reflexive `?x owl:sameAs ?x`; those are dropped during materialization to keep the inferred graph clean.
- RDFS `domain`/`range` on a datatype property can, per standard RDFS materialization, yield a literal-subject/object type triple; accepted (teaching datasets declare domain/range on object properties).
- Bootstrap `sembook:init` data is not materialized (all current init blocks are empty); materialization is Parse-triggered per the handoff scope.

---

## ADR-032 — Entity Explorer Renders Equivalence Merges, Inferred Memberships, and Class Assertions

**Status:** Accepted
**Date:** Iteration 12
**Refines:** ADR-031 (un-defers the entity-explorer queries it deliberately left asserted-only)

### Context
ADR-031 scoped the entity explorer's inferred-awareness to the instance property view only; the class hierarchy, member list, and class selection stayed asserted-only — scope control at the time, not a design verdict. The architect has since directed: (1) classes connected by `owl:sameAs` must render as one set, not two; (2) selecting a class must show the triples on the class — asserted roman, inferred italic — alongside its members; (3) inferred memberships must be visible in the explorer, italic.

### Decision
- **Equivalence merge.** Classes connected by `owl:sameAs` or `owl:equivalentClass` (asserted or inferred, either direction, transitively — union-find in `parse-utils.equivalenceGroups`) render as a single compound container. Canonical representative = the group's lexicographically-smallest member present in the scope-filtered candidate set, so merging never resurrects a scope-excluded IRI. Hover shows every grouped IRI joined with `≡`. Member/detail queries span the whole group. The merge map is recomputed on every rebuild (C7), never cached across graph updates.
- **Class detail pane.** Class selection renders Assertions (`<class> ?p ?v` over asserted + `-inferred` graphs, across the equivalence group) above Members (same inferred-aware scope). Rows present only in a `-inferred` graph render italic; a row both asserted and re-derived renders roman (assertion wins — shared `dedupeInferredRows` precedence, matching `sparqlToElements`). Values are shown as asserted — NOT canonicalized to the group representative — so an inferred `subClassOf schema:Person` (pointing at a *different* merged class) shows as its own italic row. The one exception: *inferred* equivalence statements (`owl:sameAs`/`owl:equivalentClass`) whose object is another alias of the *same* merged class are dropped — in a node presented as one resource, the reasoner's symmetric/transitive `Author sameAs <another alias>` reads as "the same as itself" and multiplies with group size. The author's own (asserted) equivalence statements are always kept, however many — a class may carry several genuine `sameAs` assertions worth listing.
- **Transitive membership.** A class's Members list includes instances of every (transitive) subclass — a set contains all its descendants' instances (an Author, and a Poet ⊑ Author, are Persons). The subClassOf structure is captured from the merged hierarchy bindings and walked in JS (`_descendantClasses`), so this holds even where per-lab reasoning didn't materialize the cross-class membership. Direct members (asserted `?instance a <this class>`) render roman; members present only by subclass or reasoner inference render italic and sort after the direct ones.
- **Inferred membership dots.** Reasoner-derived `?instance a ?class` triples place the instance inside the additional class container — the "same dot in two circles" reveal — styled dashed/italic/muted teal. Memberships only, and only into classes that already have an asserted container: the class/parent *structure* query stays asserted-only, because inferred subClassOf transitive-closure triples would make the first-parent-wins nesting order-dependent (Author would flatten out of Person into a grandparent), and a class whose only presence is derived is not conjured as a container.

### Consequences
- The inference reveal the entity explorer was designed around (README §The Entity Explorer) now actually renders.
- Inferred membership placement is canonicalized through the equivalence merge, so a membership derived against `schema:Person` lands in the merged Person set.
- The vocabulary panel does not yet merge equivalent terms — queued as its own change.

---

## ADR-033 — Entity Explorer Scope Toggle Means Lab vs Cumulative; Meta-Vocabulary Always Hidden

**Status:** Accepted
**Date:** Iteration 12 — supersedes the Mine/All semantics introduced in "adding togglable scope to entity viewer"

### Context
The Mine/All toggle originally meant "hide vs show the RDF/RDFS/OWL/SHACL/XSD meta-vocabulary", with both states cumulative across labs. With teaching data that never types anything as `owl:Class`, the two states are indistinguishable on screen, and the architect's expectation was graph scoping: "mine isn't scoped to just what's in the lab."

### Decision
- **Mine** = this lab's named graph only. **All** = every lab's graph up to and including this one (the cumulative scope Full Graph uses). The toggle drives a single `_scopeGraphs()` source that every query in the panel — hierarchy, equivalence merge, inferred memberships, class detail, instance properties — derives its `VALUES ?g` clause from.
- The meta-vocabulary is **always** filtered from the hierarchy, in both scopes. It's how you declare, not what you're modelling; the machinery reveal is dropped from this panel.
- Default is Mine: start lab-local, widen to All as the instructor's reveal (e.g. lab 3's Ada joining the merged Person set the moment scope widens past the sameAs assertion).

### Alternatives Considered
- Two independent toggles (scope × meta-vocab) — most flexible, rejected by the architect for toolbar noise.
- Single combined toggle (lab+clean vs cumulative+machinery) — loses the clean cumulative view, rejected.

### Consequences
- Scope switches re-render the detail pane too, not just the hierarchy — a selected class's members narrow to the lab in Mine.
- The `sparql` attribute still arrives from sem-lab with the cumulative VALUES clause; the panel re-scopes it per query. Component contract unchanged.
- No way to see owl:/rdfs: terms as containers in this panel anymore; the vocabulary explorer remains the place where declaration machinery is discussed.

---

*This document is immutable. When a decision changes, a new ADR is added with status "Supersedes ADR-NNN". Superseded records are retained.*
