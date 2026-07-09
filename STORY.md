# The Semantic Notebook — A Distillation
> Everything learned in one conversation. Vision, principles, architecture, open questions, surprises.

This is the story. The rules every component must obey live in [ARCHITECTURAL_CONSTRAINTS.md](ARCHITECTURAL_CONSTRAINTS.md); the significant, hard-to-reverse technology and structural choices live in [ARCHITECTURE_DECISION_RECORDS.md](ARCHITECTURE_DECISION_RECORDS.md); everything narrower — mechanisms, tuning, bug fixes — lives in [DESIGN_DECISIONS.md](DESIGN_DECISIONS.md). This document is the throughline connecting all three.

---

## The Origin of the Idea

This started as a question about building a semantic REPL. It became something more considered almost immediately. A REPL implies evaluation — you type an expression, you get a result. But the semantic web doesn't work that way. The knowledge graph isn't evaluated, it's *inhabited*. You don't get a result back, you get a richer understanding of what's already there.

The word "notebook" arrived naturally, and with it a much clearer vision. Not Jupyter — Jupyter is a code execution environment that happens to have cells. This is a *teaching surface* where the graph is the primary artifact and everything else — editors, visualizations, queries — is a projection of it.

The shift from REPL to notebook reframed everything that followed.

---

## The Vision

A browser-based semantic teaching tool that makes knowledge graph concepts visceral and interactive. Built to serve two purposes simultaneously:

**Conference teaching** — the instructor flips between slides and the notebook, typing live, showing concepts in motion. The audience follows on their own laptops. Zero installation. One URL.

**Book companion** — each chapter has a notebook URL. Readers open it, the examples are pre-loaded, they can run them, modify them, extend them. The book becomes interactive without any tooling overhead.

The core teaching moment the tool is designed to create: *you add an ontology to a graph and it knows more than you told it*. Reasoning emergence, made visceral. The audience doesn't just understand it — they feel the gap between what they typed and what the graph now knows.

---

## The Thesis Made Self-Referential

The most important architectural decision in this project is one that was proposed and accepted almost offhandedly: **the notebook format is itself a semantic artifact**.

Notebooks are stored as JSON-LD. The vocabulary that describes them — `sembook:Lab`, `sembook:JsonLdPanel`, `sembook:sparql` — is a proper OWL ontology published at a dereferenceable URI. The tool is dogfooding its own subject matter at the deepest possible level.

This isn't purist indulgence. It's the argument made self-referential. Michael is teaching that semantic, self-describing formats are architecturally superior to opaque ones. If the teaching tool's own format were a JSON blob that only this tool understands, the cathedral would be built on dirt.

You can query the notebook with SPARQL. You can reason over it. That's not a feature — it's the point.

The vocabulary lives at `https://notebook.semantic.consulting/vocab#` under the `sembook:` prefix. It is **not** in the HydrAI namespace — HydrAI is about agent-native Hydra extensions, a different concern entirely. This one is general enough to be its own contribution, potentially releasable alongside the book.

---

## What This Is Not

Worth naming explicitly because the temptations are real:

- Not a general-purpose triplestore UI
- Not a replacement for Protégé
- Not a Jupyter clone
- Not a SPA with the browser as an application runtime
- Not dependent on any JavaScript framework
- Not tied to any backend
- Not a REPL

---

## The Principles

### Hypermedia-first, resource-oriented
The notebook URL is a real resource. GET it, get a rendered notebook. The server isn't an API feeding a JavaScript runtime — it's a web server that serves documents. This is not a philosophical stance for its own sake; it's the architecture that makes deep linking, scroll navigation, and backend-agnostic operation all work for free.

### HTML is not UIML
No React, no Vue, no Angular. Native web components only. The browser is a hypermedia client, not an application runtime. This was stated clearly and held consistently throughout.

### Local execution
The triplestore lives in the browser. Reasoning happens client-side. The audience can see everything — no network tab mysteries, no black-box server calls, no latency. If execution is local, the audience can watch it happen. That transparency is part of the lesson.

### Server as escape hatch
HTMX handles discrete server round-trips for things that genuinely need the server: persisting notebooks back to JSON-LD, generating book artifacts, the NL→SPARQL call. Nothing else touches the server. This was described as "punting on making the browser do everything" — which is accurate, but it's principled punting.

### Static first
Notebooks are pre-baked JSON-LD files fetched on load. The URI scheme is designed so a backend can be swapped in later without changing any component contracts. `/notebook1/index.html` fetches `../notebooks/intro.jsonld` today. Tomorrow it fetches from a C# endpoint. The components never know the difference.

### Consistent component lifecycle
Every component — lab or panel — has the same shape: `connectedCallback`, `initialize`, `render`, `update`, `disconnectedCallback`. No special cases. This was insisted upon by Michael when the question of "hidden init panel" came up. The init data is a property of the lab, not a component. That insistence produced a cleaner model.

### No invented abstractions
Layout uses Tailwind utility classes declared in the JSON-LD definition as `sembook:cssClass`. No custom grid DSL, no magic strings like `"local"` or `"full"` for graph scope. When a magic string was proposed for graph panel variants, Michael correctly pushed back and the SPARQL query became the configuration surface instead. That was the right call — it's more powerful and eliminates an entire category of invented vocabulary.

---

## The Architecture

### The Quad Store
N3.js Store — natively a quad store. This matters because the entire cell/lab model rests on named graphs, and named graphs are the fourth element of a quad. The choice of quad store wasn't incidental.

### One Lab, One Named Graph
The lab IRI is the named graph IRI. Everything the lab knows lives in that graph. This was arrived at by pruning an earlier, more complex model where each JSON-LD editor panel had its own named graph. The simpler model is better: named graph boundaries are architectural, not editorial. What makes two islands "disconnected" is the data, not the container.

The pruning happened when Michael observed: "Why can't the entire lab be one named graph?" That question dissolved a week's worth of unnecessary complexity in a single sentence.

### Inferred Triples
Go into a companion named graph: `<lab-iri-inferred>`. This keeps asserted and inferred triples visually distinct without complicating the core model. The visualization queries both and styles them differently.

### The Default Graph Problem
This was discovered in implementation, not in design. The notebook definition — all the `sembook:Lab` and `sembook:Panel` infrastructure — loads into the default graph at bootstrap. Teaching data loads into named graphs. Panel SPARQL queries must scope to named graphs only or they surface notebook infrastructure as if it were teaching content.

The fix: all panel queries use explicit `GRAPH` clauses or `VALUES ?g { ... }` clauses. The `sembook:` namespace exclusion provides a second filter layer. `unionDefaultGraph: true` is set on Comunica so named graph data is reachable, but panels scope deliberately.

This distinction — **infrastructure in the default graph, teaching data in named graphs** — is now a first-class architectural principle documented in the spec.

### The Event Bus
The notebook context mediates all inter-component communication. Components never touch the quad store directly. The event surface is deliberately small:

- `graph:upsertFragment` — panel parsed something, update the named graph
- `graph:updated` — named graph changed, subscribed panels re-render
- `notebook:ready` — bootstrap complete, components can initialize
- `explorer:selected` — entity selected in the entity explorer, property viewer updates

Every event carries a `labUri` scope. Selection events from one lab don't bleed into another lab's property viewer. This scoping discipline was explicitly called out when the selection event was designed.

### The Fragment Upsert Model
Each JSON-LD panel owns a fragment of the lab's named graph, identified by the panel's IRI. When the user clicks Parse, the panel replaces its entire fragment — remove all quads previously contributed by this panel, add the new ones. No delta computation. The document in the editor is always the source of truth.

This is simpler than it sounds and cleaner than diffing would be. It was arrived at naturally when Michael observed: "those json-ld views are the source of truth for the graph."

### Blank Node Scoping
Discovered in implementation: `jsonld.js` resets blank node labels (`_:b0`, `_:b1`...) on every independent `toRDF()` call. Two JSON-LD panels parsed separately will both produce `_:b0` — and those would silently merge in the quad store, conflating the book and the author before any context is applied. The fix: prefix blank node labels with a slug derived from the panel's fragment URI before adding them to the store. This was one of the explicit stop conditions in the handoff and the agent caught it proactively.

### Prefix Sync
When a JSON-LD panel parses a document, it extracts `@context` prefix mappings and passes them through the event bus with the upsert. The notebook context maintains a per-lab prefix map. The Turtle Reader asks for this map when it serializes the named graph to Turtle. The result: `@context` prefixes in JSON-LD appear as `@prefix` declarations in Turtle. The correspondence is visible, and it's the lesson — these are two syntaxes for the same thing.

### Viewport-Triggered Rendering
Each lab occupies 100vh. Scrolling is the primary navigation. Intersection Observer triggers rendering when a lab enters the viewport. Labs initialize eagerly at page load (all init data loaded into named graphs before `notebook:ready` fires) but render lazily. This combination solves the deep linking problem: deep link to any lab, the graph is already populated, the rendering triggers on scroll. Sequential initialization isn't required.

Now that notebook1 has four labs, CSS scroll-snap (`snap-y snap-mandatory` on the scroll container, `snap-start snap-always` on each lab) guarantees a scroll gesture always lands on one full lab, never half of two — this is what made "which lab is active" well-defined enough to drive nav highlighting (see Nav Generation, below). Getting there exposed a real bug: `scroll-mt-12`, added alongside `pt-12` to offset for the fixed nav, double-compensated and cut every snap destination short by 3rem except the first lab (whose offset happened to clamp to 0, hiding the bug in one direction only). `pt-12` alone was enough; `scroll-mt-12` was removed.

### The `init()` Pattern
Components created dynamically by `sem-lab` receive their notebook context via an explicit `init(notebook, notebookDoc)` call immediately after `appendChild`. This is different from static components (present at parse time) which can listen for `notebook:ready`. The distinction emerged from implementation — `notebook:ready` fires once, before dynamic components exist. The `init()` pattern is now canonical and documented.

### Resizable, Collapsible Lab Rows
Any lab whose `sembook:cssClass` declares a two-value `grid-rows-[A_B]` track gets a draggable resizer between its top row and bottom row automatically — no new vocabulary, the existing cssClass string is the trigger. Drag freely to repartition; drag within 60px of either edge and release to snap that row down to a thin labeled strip ("▸ Document A · Document B — click to expand"), which restores the last non-collapsed split on click. This gives the instructor a stage-ready way to give the graph (or the editors) the full screen mid-demo without losing the other panel's content. Labs with a single-value track (`[1fr]`, e.g. notebook2's side-by-side lab) are untouched by this mechanism.

### Nav Generation
The nav links are generated at runtime from the notebook definition's `sembook:labs` list (`scripts/build-nav.js`), not hand-authored per lab. This was necessary the moment a second lab existed: hand-syncing nav links against `sembook:labs` is exactly the kind of drift C8's one-lab-one-named-graph rule (the lab IRI *is* its identity) exists to prevent. The same script also highlights whichever nav link corresponds to the lab currently dominating the viewport, driven by its own IntersectionObserver — deliberately independent of `sem-lab`'s own observer (which only triggers lazy-build), since nav active-state is page chrome, not teaching data, and has no business on the scoped event bus (C9).

With notebook1 now at four labs, an inline row of labels no longer fit the 48px fixed strip, so the links moved into a collapsible drawer: a hamburger button in the nav bar toggles a slide-out panel (`#lab-nav-drawer`) containing the vertical link list, dismissible via backdrop click, Escape, or clicking a link. The drawer chrome (button, backdrop, panel) is static markup in each notebook's `index.html`; `build-nav.js` only populates links and wires the toggle — it stays a page-chrome script, not a component, consistent with nav active-state having no place on the scoped event bus.

### Vendored Dependencies
CodeMirror was originally loaded from `esm.sh` at runtime. Mid-session, `esm.sh` intermittently failed to serve `@codemirror/view`, which silently broke the JSON-LD and Turtle editor panels — the custom element just never upgrades, with nothing surfaced to the user. The fix: CodeMirror's full transitive dependency graph (18 files: `codemirror` itself plus `@codemirror/*`, `@lezer/*`, `style-mod`, `crelt`, `w3c-keyname`, `@marijn/find-cluster-break`) is vendored verbatim under `/vendor/codemirror/`, resolved via a native `<script type="importmap">` in each notebook's `index.html`. Still zero build step — the files are unmodified ESM copies and import maps are a browser platform feature, not a bundler. ADR-006 ("No Build Step") now carries an explicit set of reconsideration triggers logged after this incident, so the tradeoff gets revisited deliberately rather than worked around silently again.

---

## The Component Stack

| Component | Role |
|---|---|
| `sem-lab` | One per lab, owns named graph, Intersection Observer, builds child panels from notebook definition |
| `sem-panel-jsonld` | JSON-LD editor (CodeMirror), Parse button, Fetch affordance |
| `sem-panel-jsonld-split` | Two side-by-side editors (body + `@context`) sharing one Parse button — teaches that `@context` is data too |
| `sem-panel-graph` | Cytoscape force-directed graph, `sparql` attribute drives data |
| `sem-panel-entity` | Split-pane entity explorer: compound-node class hierarchy (left, `owl:sameAs`-equivalence-merged at both class and instance level, inferred-aware) + property/assertions viewer (right, unions merged instances' properties); Mine/All lab-vs-cumulative scope toggle |
| `sem-panel-vocab` | Vocabulary explorer: browsing index of author-defined classes/properties, compound-node class hierarchy, rows merged only on exact display-label collision |
| `sem-panel-turtle` | Read-only Turtle serialization of current named graph, updates on `graph:updated` |
| `sem-panel-turtle-writer` | Editable Turtle input, same Parse pattern as JSON-LD panel |
| `sem-panel-tabs` | Layout container, tab chrome, child panel switching |

All panels share the same base contract. The `sparql` attribute is the universal configuration surface — a panel knows how to render its type of data, the query tells it what data to render. This eliminates magic strings and makes panels independently testable against mock contexts.

---

## The Teaching Arc (As Built So Far)

### notebook1 — Introduction to Linked Data

Five labs now, up from the original two — the arc grew to absorb what was originally notebook2's opening beat, a lab that resolves what used to be a "next iteration" item, and a closing reasoning-reveal lab.

**Lab 1: "Identity and Connection"**

Two JSON-LD editors, side by side. A single Local Graph tab below — no Full Graph, Entities, or Vocabulary tabs here, deliberately: this lab is about watching two islands become one graph, and the cumulative/definitional views those other tabs show would be noise at this stage, not signal.

The demo has four states:

1. **Raw JSON, two islands.** Both documents load as plain JSON. Blank nodes (amber) with literal leaves (gray rounded rectangles). Two disconnected subgraphs. The graph is already there — it's just lacking identity and connective tissue.

2. **Add `@base` and map `id` to `@id`.** Nodes turn teal. IRIs appear. Identity established. Still two islands — the graph hasn't connected yet.

3. **Map `author_id` to `{ "@type": "@id" }`.** A single line in the `@context`. The edge appears. The clusters snap together. One graph.

4. **Fetch a richer dataset.** Load `hofstadter-extended.jsonld` into Document B. Properties explode on the Hofstadter node. Same IRI, new properties, no mapping required. This is semantic alignment, not ETL.

**Lab 2: "Data and Context"**

One full-width panel (`sem-panel-jsonld-split`) instead of two side-by-side editors: the JSON body on the left, its `@context` on the right, one shared Parse button. The teaching point is that `@context` is data, not metadata bolted on the side — separating it into its own visible, editable pane makes that legible. The example (a biography of Elizabeth II, authored by Sally Bedell Smith) maps `about` and `author` to nested contexts with different property mappings (`about.title` → a Wikidata property, `author.title` → `schema:jobTitle`) — the same key name, resolved differently depending on which nested context frames it. This is the first lab with the full four-tab graph suite (Local Graph, Full Graph, Entities, Vocabulary) — the first point in the arc where cumulative and definitional views actually matter.

**Lab 3: "Two Syntaxes, One Graph"**

JSON-LD editor (left), Turtle Reader (right). Type JSON-LD, hit Parse, watch Turtle appear. `@context` prefixes become `@prefix` declarations. The correspondence is visible and immediate. This lab originally lived only in notebook2; it's now also notebook1's bridge into Turtle before the next lab asks the audience to write it directly.

**Lab 4: "Asserting Triples"**

Turtle Writer (editable CodeMirror, same Parse-button pattern as the JSON-LD panel) plus the full four-tab graph suite. This is the lab that used to be described as "built but not wired into a lab yet" — it now closes the notebook1 arc: having just read Turtle in Lab 3, the audience writes it directly and watches it materialize across Local Graph, Full Graph, Entities, and Vocabulary simultaneously.

**Lab 5: "Semantic Alignment"**

Two JSON-LD editors side by side, like Lab 1 — but this time each owns a completely independent record for the same real-world book, in two different vocabularies, under two different IRIs. The left panel ("Book Record") asserts the book plus a small vocabulary declaration: the author's own `ex:isbn` is declared `owl:InverseFunctionalProperty` and bridged to `schema:isbn` via `owl:equivalentProperty`. The right panel ("Catalog Record") starts empty; Fetch loads a second record (`datasets/elizabeth-dc-record.jsonld`) that uses a Dublin-Core-flavored context and only knows about `schema:isbn` — same ISBN value, no shared vocabulary, no `sameAs` anywhere. Parsing both and switching to Entities shows one merged Book instance, not two — see The Entity Explorer, above, for how the two rules chain to produce that.

### notebook2 — JSON-LD and Turtle

**Lab 1: "Two Syntaxes, One Graph"**

The same side-by-side JSON-LD/Turtle-reader demo as notebook1's Lab 3, duplicated here so notebook2 stands on its own as a chapter-companion entry point without depending on notebook1 having been read first. The Turtle Writer lab once planned as this notebook's Lab 2 was instead built into notebook1 (see Lab 4, above) rather than added here.

---

## The Visual Language

Three node types in the graph visualization:

| Node type | Color | Shape | Meaning |
|---|---|---|---|
| IRI node | Teal, solid | Circle | Named entity — has identity |
| Blank node | Amber, dashed border | Circle | Anonymous — the warning color signals "this needs an IRI" |
| Literal node | Light gray | Rounded rectangle | Data value — not an entity |

This color coding was deliberate. Blank nodes in amber is not aesthetic — it's pedagogical. The audience can visually track the moment a node gets an IRI. The warning color disappears. Identity is established. The lesson is in the color change.

Inferred triples get dashed edges. External/fetched triples get dotted edges. The visual grammar is consistent throughout.

---

## The Entity Explorer

The entity explorer is not a list. It's a class hierarchy browser where the visualization *is* the OWL/RDFS set semantics made visible.

Classes are compound nodes in Cytoscape — nested containers. Instances are leaf nodes inside their class containers. Inferred memberships show an instance inside multiple class containers simultaneously. The same dot in two circles. That's the inference reveal, made visual without words.

The property viewer (right pane) shows class members when a class is selected, instance properties when an instance is selected. Two modes, one panel, selection-driven.

The key insight that shaped this: `rdfs:subClassOf` is a set containment relationship. `:Magician rdfs:subClassOf :Performer` means the set of Magicians is a subset of the set of Performers. Any instance of Magician is automatically an instance of Performer. The nested compound node visualization makes this containment literal — the Magician circle is visually inside the Performer circle. That containment is transitive in the member list too: a class's Members include instances of every descendant subclass, not just its own direct instances — rendered italic and sorted after the direct ones, so a Magician shows up as a (subclass-derived) member of Performer's set without the reasoner having to be asked twice.

`owl:Thing` was explicitly excluded as a root node. It's a distraction at the stage where you're teaching basic RDFS. The universal set can be implicit. This was the right call.

**Equivalence, not duplication.** Classes connected by `owl:sameAs` or `owl:equivalentClass` — asserted or reasoner-inferred, either direction — render as a single compound container, not two. Hovering shows every IRI in the group joined with `≡`. Selecting the merged class shows an Assertions pane above its Members: every triple with the class (or any of its aliases) as subject, asserted rows in roman, reasoner-derived rows in italic. This is deliberately different from how the vocabulary explorer handles the same kind of ambiguity (below) — here, `owl:sameAs` genuinely means "one set, two names," so merging is the correct semantics, not a display compromise.

**Mine vs. All.** A scope toggle above the hierarchy switches between this lab's named graph only ("Mine") and every lab's graph up to and including this one ("All", the same cumulative scope Full Graph uses) — every query in the panel re-derives its scope from this one toggle. The RDF/RDFS/OWL/SHACL/XSD meta-vocabulary is filtered out of the hierarchy in both scopes; it's how you declare, not what you're modelling, and showing it here would be a second, competing reveal.

**Layout.** The hierarchy uses fCoSE, not the original `cose` — disconnected class sets with no edges between them (Person, Book, City, say) used to pile on top of each other under `cose`, forcing the instructor to drag them apart mid-demo. fCoSE's `packComponents` tiles them side by side automatically.

**Instances merge too, one level down.** Everything above about equivalence merging applies to classes. Instances connected by `owl:sameAs` — asserted, or reasoner-inferred via `owl:InverseFunctionalProperty` — now render as one dot, not two, with the union of both records' properties in the detail pane (asserted rows roman, inferred italic, the same convention as everywhere else). This is the payoff of the "Semantic Alignment" lab (notebook1, Lab 5): two records for the same book, in two different vocabularies, under two different IRIs, with no `sameAs` anywhere in the source data — one declares its own `ex:isbn` as `owl:InverseFunctionalProperty` and bridges it to `schema:isbn` via `owl:equivalentProperty`; fetching the second record (which only asserts `schema:isbn`) lets the reasoner chain the two rules — property alignment propagates the ISBN value onto both property names on both records, then the shared value on the now-common property triggers the identity merge. One new reasoning rule produces both a property-vocabulary bridge and an identity bridge, for free.

---

## The Vocabulary Explorer

Where the entity explorer answers "what's in this set," the vocabulary explorer answers "what terms did the author define" — a browsing index of classes and properties, not a set-membership visualization. Once built, it needed the identical-looking merge problem the entity explorer had already solved — and got a deliberately different answer.

**Row candidacy.** A term earns a row if it was explicitly asserted in the lab — either *used* (it appears as a predicate, or as the `rdf:type` object of some non-excluded thing) or *described* (it's the subject or object of `subClassOf`/`subPropertyOf`/`domain`/`range`/`equivalentClass`/`equivalentProperty`, or declared `a rdfs:Class`/`rdf:Property`/`owl:*`). A term you've *defined* but not yet *used* still shows, described but with no instances yet. The only exclusion is the meta-vocabulary itself (`sembook:`, `rdf:`, `rdfs:`, `owl:`, `shacl:`, `xsd:`, and the tool's synthesized `urn:sembook:implied:` fallback predicates) — `schema:` is deliberately never excluded, since it's domain vocabulary an author writes with, not description machinery. Described terms render teal/solid; identity-only ones (referenced but not yet described) render amber/dashed, the same visual grammar as blank nodes elsewhere in the tool.

The first attempt merged vocabulary rows the same way the entity explorer merges classes: on asserted `owl:sameAs` / `equivalentClass` / `equivalentProperty`. That was wrong, and wrong in a way that only showed up once real data exercised it: `ex:penName owl:equivalentProperty schema:alternateName` are two deliberately, differently-named terms, and merging them buried `penName` under whichever IRI sorted first — silently removing an author-defined term from the one list whose entire purpose is "can I find the term I wrote." The fix: row-collapsing here is driven by exact **display-label collision**, not semantics. `ex:name` and `schema:name` collapse into one row only because they'd otherwise render as two indistinguishable "name" rows in a flat list — not because anyone asserted they're equivalent. An actual `owl:sameAs` between two differently-named terms changes nothing about the row list; it still shows up as its own statement in either term's detail pane.

The class hierarchy pane hit the same fCoSE-vs-`cose`/`grid` piling problem the entity explorer did, one iteration later — `grid` was chosen to avoid `cose`'s flinging, but doesn't pack compound boxes apart from each other either, so disconnected class containers piled up until the panel was exercised with a genuinely subclassed hierarchy. Same fix, same `packComponents: true`.

---

## What's Between the Lines of the Spec

The spec documents decisions. It doesn't document the reasoning behind them as fully as this conversation did. A few things that live between the lines:

**The Parse button is a teaching affordance, not just a UX choice.** Live-on-keystroke updates would blur the three-state demo — the audience would see a continuous transition instead of three distinct moments. The Parse button gives the instructor control over *when* the graph changes. That control is pedagogically essential.

**The pre-baked dataset approach for Fetch is a feature, not a limitation.** CORS is the stated reason for using local files, but the deeper reason is that on stage, you want to control exactly what properties appear when the dataset loads. A live DBpedia fetch is unpredictable. A curated file produces exactly the explosion you planned.

**The `sparql` attribute as universal configuration is more important than it looks.** Every panel type has a different rendering strategy, but they all share the same data contract: run this query, render the results. This means any future panel type — a table, a timeline, a map, a SPARQL result grid — fits the existing architecture without modification. The `sparql` attribute is the extension point.

**The notebook format being JSON-LD is load-bearing.** Not just philosophically — practically. The bootstrap reads the notebook definition into the quad store. Components describe themselves to the notebook context by querying the quad store. The notebook bootstraps itself using its own data model. The self-referential quality isn't accidental.

---

## The Open Questions

Things that were explicitly deferred and will need resolution:

**Teaching requirements.** The most important open question. The architecture is built but the specific teaching sequence — which concepts, in what order, with what examples — hasn't been formally defined. Everything built so far was designed to be flexible enough to serve whatever sequence emerges. But the sequence will constrain things. Some labs will need new panel types. Some concepts will require new interaction patterns. The architecture should hold, but there will be surprises.

**The vocabulary explorer.** Resolved — built. See "The Vocabulary Explorer" above. It ended up needing a genuinely different row-merging rule than the entity explorer, not just a smaller version of the same component.

**Reasoning wiring.** Resolved. The N3.js reasoner is wired in and runs automatically on every Parse — no separate "Reason" button. This matches the Parse-button interaction model already established for asserted content: one gesture produces both the asserted delta and its inferred consequences. Inferred triples land in a `<lab-iri>-inferred` named graph and render distinctly (dashed edges in graph panels, italic rows in the entity explorer). The ruleset is narrower than "RDFS and OWL 2 RL" originally implied, too — the reasoning library used is BGP-only, so anything needing built-ins or `rdf:List`s (cardinality, `hasKey`, property chains, `someValuesFrom`) is out of scope; full OWL DL reasoning (EYE JS) remains the deferred escalation for when a lab actually needs it. `owl:InverseFunctionalProperty` was added later — two subjects sharing a value on an IFP-declared property are inferred to be the same individual, no explicit `sameAs` required — and, chained with the already-working `equivalentProperty` rule, is what powers the "Semantic Alignment" lab's compound property-and-identity-alignment reveal (see The Entity Explorer, below).

**Multiple labs and scroll validation.** Further resolved: notebook1 now has four labs (up from two), with CSS scroll-snap and IntersectionObserver-driven nav highlighting validated across all of them. A real bug turned up along the way and got fixed: pairing `scroll-mt-12` with `pt-12` double-compensated for the fixed nav, silently cutting every snap destination short by 3 rem except the very first lab (whose negative scroll-margin offset happened to clamp to 0, which is what hid the bug in one direction and not the other). Still open: four labs is still short of a full book chapter's length — whether Cytoscape instance count, per-lab reasoning, or Full Graph queries spanning many named graphs hold up at that scale hasn't been tested.

**Book artifact export.** What format does the book use for production? The answer determines what "export" means. SVG from Cytoscape is straightforward. A self-contained HTML page with frozen outputs is more work. A PDF is different work again. This is deferred pending the book production format decision.

**CodeMirror for Turtle Reader.** Currently read-only CodeMirror with Turtle highlighting. Works. But the Turtle mode comes from `@codemirror/legacy-modes` which is exactly what the name implies — legacy. There's a proper `@codemirror/lang-*` package approach that would be cleaner. Worth revisiting when the Turtle panels are more stable.

**The NL→SPARQL panel.** Deferred until the base stack is stable. When it arrives, it goes through the server (HTMX call, Anthropic API, key stays safe) and returns a SPARQL string that populates a query panel. The query runs client-side. This is the final layer of the demo — natural language as the ultimate abstraction over the semantic model.

**The C# backend.** The static-first approach was chosen deliberately and is the right call for where the project is. But the backend will come. Razor will read the TTL notebook files, hydrate a C# object model, and render the page with cells pre-populated. The seam is clean — the components change nothing. But it hasn't been built or tested yet.

---

## The Things That Surprised Me

**How quickly the architecture crystallized.** The named graph as cell model, the event bus, the SPARQL attribute as universal configuration — these emerged in the first few hours of conversation and didn't change. Most architectural conversations involve significant backtracking. This one didn't. The principles were clear enough that they constrained the design space productively.

**The blank node collision bug.** This was a real and subtle failure mode that the agent caught proactively. `jsonld.js` resetting blank node labels on every call is not intuitive behavior, and the collision would have been nearly invisible in the triple summary — the count would still be right, just two things merged into one. The fact that it was in the explicit stop conditions and the agent still caught it before testing is a good sign for the handoff pattern.

**Michael's instinct to simplify was always right.** Every time a more complex model was proposed — sub-graphs per panel, hidden init components, custom grid DSL, magic strings for graph scope — Michael pushed back and the simpler answer was better. "Why can't the entire lab be one named graph?" dissolved pages of unnecessary architecture. "I'm going to add the context inline" eliminated a proposed context sub-panel. "Let's use Tailwind utility classes" killed a custom layout vocabulary. The pattern is consistent: complexity proposed, simplicity chosen, architecture improved.

**The Turtle Reader as a teaching tool is more powerful than it first appeared.** When prefix sync was added — so that `@context` prefixes in JSON-LD appear as `@prefix` declarations in Turtle — the panel stopped being just a serialization viewer and became a concept bridge. The audience can see, in real time, that these two things are the same thing expressed differently. That's not a visualization, it's a revelation.

**The entity explorer becoming a set membership visualizer.** The original proposal was a list — "here are the entities, here are their properties." Michael reframed it as set membership visualization almost immediately. `rdfs:Class` is a set. `rdfs:subClassOf` is containment. The entity explorer should make that geometry visible. That reframing produced a much more powerful component — and one that's more faithful to the actual semantics of RDFS than a list would have been.

**How much the "two islands connecting" moment matters.** The entire first demo is built around this beat. Two disconnected subgraphs, one line of context, an edge appears. It's simple. It's been demonstrated in talks and papers for twenty years. But building it as a live interactive visualization — amber blank nodes turning teal, clusters animating toward each other, the edge snapping into place — makes it feel like something genuinely new. The medium is doing work that the diagram in the paper couldn't do.

---

## The Meta-Point

This project is unusual because the tool and the subject matter are the same thing. Michael is building a tool to teach the semantic web using the semantic web. The notebook format is JSON-LD. The component lifecycle is resource-oriented. The event bus passes JSON-LD. The visualization is a live knowledge graph.

This isn't just consistency. It's credibility. When Michael says "semantic formats are architecturally superior," he's not pitching an idea — he's standing inside one. The audience can see it working.

That self-referential quality — the thesis demonstrated by the tool that teaches the thesis — is the deepest thing about this project. Everything else is implementation.

---

*Distilled from a single conversation. The conversation will age. This document should be updated as the project evolves.*
