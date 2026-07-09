# Semantic Notebook — Design Decisions

> The narrowest tier. Component-internal mechanisms, bug fixes, visual tuning, naming — and the concrete implementation behind rules stated at a higher tier. Grouped by subsystem, not chronologically.

---

## How This Relates to the Other Two Documents

[ARCHITECTURAL_CONSTRAINTS.md](ARCHITECTURAL_CONSTRAINTS.md) holds rules about the system's uniform interface — checkable independent of which specific component you're looking at.

[ARCHITECTURE_DECISION_RECORDS.md](ARCHITECTURE_DECISION_RECORDS.md) holds architecturally significant decisions that aren't uniform-interface rules but are still foundational, hard to reverse, or cross-cutting — library/technology choices for whole subsystems, wire-format commitments, interaction models every future component of a kind inherits.

This document holds everything narrower than that: which specific mechanism implements a rule from one of the other two documents, a bug fix, a tuning parameter, a naming choice, one component's internal tactic. The heuristic: if reversing it wouldn't ripple beyond the one component or panel family it lives in, it's a design decision, not an ADR.

Each entry below carries a `DDR-NNN` number and, where the entry originated as a numbered ADR in the original ADR document, a `formerly ADR-NNN` tag — so old cross-references (code comments, prior conversations) still resolve. Several entries are the implementation-mechanism half of a rule whose crisp kernel now lives in the constraint catalog or the ADR catalog; those are cross-referenced both ways. Records are immutable in the same sense as the other two documents: if a decision changes, a new entry supersedes the old one, and superseded entries are retained for audit.

---

## Quad Store & Reasoning

### DDR-013 — SPARQL as Universal Panel Configuration Surface: Alternatives & Mechanism
*(formerly ADR-013)*

**Context:** Panels need a way to specify what data they render. Early designs used magic strings (`"local"`, `"full"`) or typed properties (`sembook:scope: "cumulative"`) to indicate data scope.

**Decision:** Every panel has a `sparql` attribute containing a SPARQL SELECT query. The panel executes this query against the quad store and renders the results. The query is the only configuration surface for data scope — this rule is now stated as [C13](ARCHITECTURAL_CONSTRAINTS.md#c13--sparql-is-the-panel-configuration-surface). This entry keeps the alternatives considered and the concrete cumulative-scope mechanism.

**Alternatives Considered:**
- Magic string variants (`"local"`, `"full"`, `"cumulative"`)
- `sembook:scope` typed property with enum values
- Parameterized queries with scope flags

**Rationale:** Magic strings and typed scope properties require the component to interpret them — adding a vocabulary of special values that must be documented, implemented, and tested. A SPARQL query is self-describing. Michael pushed back on the magic-string proposal and the SPARQL query replaced it. That was the right call.

**Consequences:**
- Panel SPARQL queries are stored in the notebook JSON-LD definition
- Full Graph queries inject dynamic `VALUES ?g { ... }` clauses from `notebook.graphsUpTo(labUri)` — this is the mechanism `sem-lab` uses to hand a cumulative-scope query to a panel; the panel itself never constructs the clause
- The agent must never hardcode SPARQL queries in component code

---

### DDR-017 — `graph:upsertFragment` Mechanism: Fragment Ownership Tracking
*(formerly ADR-017)*

**Context:** When a JSON-LD editor panel parses its content, it needs to update the named graph. Options include: add new triples (accumulate), compute a diff and apply changes, or replace the panel's entire contribution.

**Decision:** Each panel owns a fragment of the named graph identified by the panel's IRI. On parse, all quads previously contributed by that fragment are removed and the new quads are inserted wholesale. No delta computation. The whole-fragment-replacement rule itself is now stated as part of [C7](ARCHITECTURAL_CONSTRAINTS.md#c7--the-quad-store-is-the-single-source-of-truth); this entry keeps the tracking mechanism, alternatives, and consequences.

**Alternatives Considered:**
- Accumulate (add only, never remove) — creates ghost triples when content changes
- Diff (compute changed triples and apply) — complex, fragile, unnecessary
- Full named graph replacement (replace everything in the lab) — loses other panels' contributions

**Rationale:** The JSON-LD document in the editor is the source of truth for that fragment. Fragment ownership (tracked in `NotebookContext._fragmentOwnership`) gives the context exactly what it needs to remove old quads without touching other panels' contributions.

**Consequences:**
- `NotebookContext._fragmentOwnership` maintains a map from fragmentUri to quad set
- Parse is idempotent — parsing the same content twice produces the same graph state
- No history or undo — each parse is a clean replacement

---

### DDR-018 — Blank Node Scoping by Fragment URI
*(formerly ADR-018)*

**Context:** `jsonld.js` resets blank node labels (`_:b0`, `_:b1`, etc.) on every independent `toRDF()` call. Two JSON-LD panels parsed in separate calls both produce `_:b0`. When both are loaded into the same named graph, these collide — two distinct anonymous entities become one.

**Decision:** Before adding quads to the store, each blank node label is prefixed with a slug derived from the panel's fragment URI. Panel A's `_:b0` becomes `_:identity-doc-a-b0`. Panel B's `_:b0` becomes `_:identity-doc-b-b0`. They cannot collide.

**Alternatives Considered:**
- UUID suffixes (random, not deterministic)
- Full fragment URI as prefix (too verbose)
- Separate named graphs per panel (rejected — see C8's one-lab-one-graph rule)

**Rationale:** The collision is subtle and nearly invisible — triple counts appear correct but two entities merge silently. This directly undermines the "two islands" teaching beat: the audience needs to see two distinct anonymous entities before they add an `@context`. Fragment-URI-derived prefixes are deterministic and human-readable in debug contexts.

**Consequences:**
- Blank node labels in the store are not the labels `jsonld.js` produces — they are transformed
- Tools that inspect the raw store see prefixed blank node IDs
- Re-parsing the same content produces the same blank node IDs (deterministic)

---

### DDR-022 — `unionDefaultGraph: true` with Compensating Named Graph Filters
*(formerly ADR-022)*

**Context:** Comunica by default treats queries without an explicit `GRAPH` clause as querying the SPARQL default graph only. Named graph data is not included. Full Graph queries (`SELECT * WHERE { ?s ?p ?o }`) would return only notebook infrastructure triples.

**Decision:** `NotebookContext.query()` sets `unionDefaultGraph: true` on all Comunica queries, making named graph data reachable by queries without explicit `GRAPH` clauses. All panel queries must still use explicit `GRAPH` or `VALUES ?g { ... }` clauses to scope to teaching data only.

**Alternatives Considered:**
- Require all queries to use explicit `GRAPH` clauses (stricter, but error-prone)
- Separate Comunica instances for default and named graph queries
- Load teaching data into the default graph (would violate C8)

**Rationale:** `unionDefaultGraph: true` is the Comunica setting that matches expected RDF semantics — a query over all triples should include named graph data. But this alone would surface notebook infrastructure. The compensating named graph filters in panel queries provide the second layer.

**Consequences:**
- `unionDefaultGraph: true` is set in `NotebookContext.query()` and cannot be overridden per-query without bypassing the context
- Panel queries must filter by named graph — this is a developer responsibility enforced by convention, not by the engine

**Governing constraint:** [C8 — Infrastructure Data and Teaching Data Must Never Mix](ARCHITECTURAL_CONSTRAINTS.md#c8--infrastructure-data-and-teaching-data-must-never-mix) states the rule this mechanism implements.

---

### DDR-031 — Materialization on Parse via N3.js Reasoner: Mechanism
*(formerly ADR-031 — refines ADR-009)*

**Context:** ADR-009 chose the N3.js Reasoner and reserved a `<lab-iri>-inferred` named graph for reasoning output, but reasoning was never wired in. This iteration materializes inferred triples automatically on every Parse and renders them distinctly (dashed graph edges, italic entity-property rows). That reasoning is Parse-triggered and not a separate user action is an interaction-model decision — see ADR-019 for why it was kept as a design decision rather than elevated to a constraint alongside the Parse-button rule.

Investigation surfaced three facts that shaped the decision, none of which were true as the spec assumed:

1. **The pinned `n3@1.17.2` has no Reasoner.** `N3Reasoner.js` first appears in the `n3` `1.x` line at **1.21.0**; 1.17.2 ships only Parser/Writer/Store/DataFactory.
2. **N3.js bundles no ruleset.** `Reasoner.reason(rules)` takes a user-supplied dataset of N3 `{…} => {…}` rules.
3. **The Reasoner is BGP-only** — "only rules with Basic Graph Patterns in premise and conclusion; built-ins and backward-chaining are not supported." It runs to a fixpoint (rules chain).

**Decision:**

**Trigger.** Materialization runs inside `NotebookContext.upsertFragment()` — the single chokepoint every Parse path (JSON-LD, JSON-LD-split, Turtle Writer) already funnels through — after the asserted quads land and before subscribers are notified. It is not a user-visible action: no "Reason" button, fires on every Parse.

**Dependency.** Bump the global `n3` script from 1.17.2 to **1.26.0** (final 1.x — has the Reasoner, keeps the Store/Parser/Writer/DataFactory API the app already uses). Not the 2.x major bump.

**Isolation + idempotency.** Reasoning runs in a throwaway `N3.Store` holding a copy of the lab's asserted triples in its *default graph* (the Reasoner adds conclusions to the graph it reasons over and mutates in place, so an isolated single-graph scratch keeps asserted+derived together and diffable). Newly-derived triples = scratch minus the asserted snapshot; those are written into `<lab-iri>-inferred`. The inferred graph is cleared and recomputed on every Parse, so repeated/overlapping parses never accumulate duplicates. Per-lab scope only. A full re-reason per Parse is synchronous and trivially fast at teaching-data scale; no incremental reasoning.

**Ruleset (`scripts/reasoning-rules.js`).** Hand-authored N3 covering the BGP-expressible fragment: RDFS (subClass/subProperty transitivity + rdfs9/rdfs7 propagation, domain, range) and the relational OWL 2 RL axioms (inverseOf, Symmetric/TransitiveProperty, equivalentClass/Property, partial owl:sameAs). This narrows ADR-009's "OWL 2 RL": the OWL2RL rules needing built-ins or rdf:Lists — cardinality, hasKey, propertyChainAxiom, intersectionOf/unionOf/someValuesFrom constructors, datatype checks — cannot be expressed in N3.js and are out of scope. Heavier reasoning remains the deferred EYE JS escalation (ADR-009).

**Rendering.** Graph panels' queries are rewritten (in `sem-lab._inferredAwareGraphSparql`) to also span each in-scope lab graph's `-inferred` companion and project `?g`; `sparqlToElements` styles edges from an inferred graph as dashed, asserted edges solid, deduping a triple seen in both graphs to solid. The entity explorer's `_renderInstanceProperties` (only) queries the inferred graphs too and italicizes property rows whose triple lives in the inferred graph. The class-hierarchy/member queries and the vocab panel are untouched at this point — the inferred graph is simply populated so a future vocab/SPARQL panel can query it without rework (later un-deferred by DDR-032).

**Alternatives Considered:**
- **2.x major bump** — larger blast radius across Store/Parser/DataFactory usage for no gain over 1.26.0.
- **Reason in place on the main store** — no clean asserted/inferred separation; mixing derived triples into the lab graph mid-computation risks silent duplication.
- **Blanket-including the inferred graphs via the shared cumulative-VALUES helper** — would leak inferred triples into the entity hierarchy, class-member, and vocab queries, exceeding the scoped change (C12).
- **Incremental reasoning** — unnecessary at this scale; full re-reason is simpler and idempotent by construction.

**Consequences:**
- `n3` is pinned at 1.26.0; the existing parse/store/turtle-writer paths were smoke-tested after the bump.
- The inferred graph naming convention `<lab-iri>-inferred` is now load-bearing in three places (materialization, `sem-lab` graph-query rewrite, entity/graph provenance checks via the `-inferred` suffix).
- `owl:sameAs` value-replication can derive reflexive `?x owl:sameAs ?x`; those are dropped during materialization to keep the inferred graph clean.
- RDFS `domain`/`range` on a datatype property can, per standard RDFS materialization, yield a literal-subject/object type triple; accepted (teaching datasets declare domain/range on object properties).
- Bootstrap `sembook:init` data is not materialized (all current init blocks are empty); materialization is Parse-triggered per the handoff scope.

---

## Layout & Visualization

### DDR-014 — Tailwind CSS Utility Classes for Layout: Alternatives
*(formerly ADR-014)*

**Context:** Labs and panels need configurable layout. Different labs have different arrangements. Early proposals included a custom CSS grid DSL, Bootstrap, and fixed component-level layout assumptions.

**Decision:** Layout is expressed as Tailwind CSS utility class strings on the `sembook:cssClass` property in the notebook JSON-LD definition. Components read this property and apply it directly as the HTML `class` attribute. No interpretation, no mapping. The underlying "use the ecosystem solution, not an invented DSL" rule is [C4](ARCHITECTURAL_CONSTRAINTS.md#c4--no-invented-abstractions); this entry keeps the alternatives considered.

**Alternatives Considered:**
- Custom grid DSL (`"2-top 1-bottom"`)
- Bootstrap grid
- Fixed layout assumptions in component code
- CSS Grid template areas as a string attribute

**Rationale:** Bootstrap ships opinions about components that conflict with the component model. Fixed layout assumptions prevent reuse across labs with different arrangements. The `sembook:cssClass` property passes classes through without interpretation — the component doesn't need to understand layout, it just applies what the definition says.

**Consequences:**
- Tailwind CDN must be loaded before component rendering
- Layout classes in notebook JSON-LD must be valid Tailwind classes
- Design tokens (colors, spacing) use CSS custom properties rather than Tailwind configuration

---

## Component Model & Event Bus

### DDR-020 — Notebook Context as Event Bus Mediator: subscribe()/emit() Mechanism
*(formerly ADR-020)*

**Context:** Components need to communicate: editor panels update the graph, graph panels re-render, entity explorers respond to selection. Direct component-to-component communication would create coupling. That components must communicate only through the notebook context, never directly, is now stated in [C6](ARCHITECTURAL_CONSTRAINTS.md#c6--consistent-component-lifecycle)'s violations, and the `labUri` scoping requirement is [C9](ARCHITECTURAL_CONSTRAINTS.md#c9--events-are-scoped). This entry keeps the alternatives considered and the concrete API mechanism.

**Alternatives Considered:**
- Custom DOM events bubbling through the element tree
- Global event bus singleton
- Shared reactive store (MobX-style)

**Rationale:** A shared reactive store requires a framework (violates C10). Global event buses create invisible coupling between components with no clear ownership. DOM event bubbling is hard to scope — events would need to be stopped at the lab boundary manually. The notebook context is already the authoritative interface to the quad store; making it the event bus as well keeps communication centralized, auditable, and scoped.

**Consequences:**
- Every component that needs to communicate requires a reference to the notebook context
- The context's `subscribe()` and `emit()` methods are the only inter-component communication surface
- Testing requires a mock notebook context — which is also the right boundary for unit tests

---

### DDR-021 — `init()` Method for Dynamically Created Panel Components
*(formerly ADR-021)*

**Context:** `sem-lab` creates panel components dynamically after `notebook:ready` has already fired. Components that listen for `notebook:ready` in `connectedCallback` will never receive it because the event fired before they existed.

**Decision:** Components created dynamically by `sem-lab` receive their notebook context via an explicit `init(notebook, notebookDoc)` call immediately after `appendChild`. Static components (present at parse time) may listen for `notebook:ready`. Dynamic components must use `init()`.

**Alternatives Considered:**
- Store the notebook context on a well-known global after `notebook:ready`
- Re-fire `notebook:ready` for late-joining components
- Use a custom element registry that injects context on element creation

**Rationale:** Re-firing events creates race conditions and confusion about event ordering. A global context violates the dependency injection principle that makes components testable. The `init()` method is explicit, synchronous, and makes the dependency visible in the code. The distinction between static and dynamic components is real and worth naming — it's not a hack, it's a lifecycle contract difference.

**Consequences:**
- `sem-lab` must call `el.init(notebook, notebookDoc)` immediately after every `appendChild`
- All panel component classes must implement `init()`
- Unit tests inject the notebook context via `init()`, not via event listening

**Governing constraint:** [C6 — Consistent Component Lifecycle](ARCHITECTURAL_CONSTRAINTS.md#c6--consistent-component-lifecycle) treats this as the concrete mechanism behind its "initialize" step for dynamically-created panels; kept here as a design decision rather than folded into C6's text, per architect's call.

---

### DDR-023 — Prefix Sync via Event Bus
*(formerly ADR-023)*

**Context:** The Turtle Reader panel serializes the named graph to Turtle using N3.js `Writer`. Turtle output quality depends on having the right prefix declarations. JSON-LD `@context` entries contain prefix mappings that should appear as `@prefix` declarations in the Turtle output.

**Decision:** When `sem-panel-jsonld` parses a document, it extracts `@context` prefix mappings and includes them in the `graph:upsertFragment` event. `NotebookContext` maintains a per-lab prefix map. `sem-panel-turtle` calls `notebook.getPrefixes(labUri)` before serializing.

**Alternatives Considered:**
- Fixed well-known prefixes only (rdf, rdfs, owl, schema, xsd)
- Extract prefixes from the quad store by IRI pattern matching
- Require explicit prefix configuration in the notebook definition

**Rationale:** The 1:1 correspondence between JSON-LD `@context` prefixes and Turtle `@prefix` declarations is a teaching point. Making the prefix sync automatic and visible demonstrates this without explanation. Fixed prefixes would miss user-defined prefixes. IRI pattern matching is fragile.

**Consequences:**
- `graph:upsertFragment` now carries a `prefixes` payload (additive, not breaking)
- `NotebookContext.getPrefixes(labUri)` returns the merged prefix map for a lab
- Turtle Writer (sem-panel-turtle-writer) also extracts prefixes from parsed Turtle and syncs them

---

### DDR-025 — `explorer:selected` Event for Entity Explorer Selection
*(formerly ADR-025)*

**Context:** The entity explorer has two panes: a class hierarchy visualizer (left) and a property viewer (right). Selection in the left pane drives the right pane. This is component-to-component communication within a single parent component.

**Decision:** Selection is managed as internal state within `sem-panel-entity`. When selection changes, `sem-panel-entity` fires `explorer:selected` on the notebook context event bus with `{ labUri, entityIri, selectionType }`. External components can listen for this event scoped to their lab.

**Alternatives Considered:**
- Direct method call from left pane to right pane (tight coupling)
- Shared state object passed to both sub-panes
- DOM custom event bubbling

**Rationale:** Even though the entity explorer currently manages both panes internally, the selection event on the event bus makes the interaction pattern visible and extensible. A future lab might have a standalone property viewer that responds to entity selection from a different panel.

**Consequences:**
- `explorer:selected` is a new event type on the notebook context
- External components can subscribe to entity selection without coupling to `sem-panel-entity`
- The event fires even when the right pane is within `sem-panel-entity` itself — the component both emits and acts on it

**Governing constraint:** [C9 — Events Are Scoped](ARCHITECTURAL_CONSTRAINTS.md#c9--events-are-scoped) — the `labUri` scope on this event is what this constraint requires.

---

## Graph/Entity/Vocab Panels

### DDR-024 — Cytoscape Destroy-and-Recreate for Compound Node Graphs
*(formerly ADR-024)*

**Context:** The entity explorer uses Cytoscape compound nodes for class hierarchy visualization. Cytoscape compound node graphs cannot be updated incrementally without losing parent-child structure. Standard graph panels use `cy.elements().remove(); cy.add(elements)` for updates.

**Decision:** `sem-panel-entity` and `sem-panel-vocab` destroy and recreate the Cytoscape instance on every `graph:updated` event. `sem-panel-graph` uses the incremental update approach (remove and add elements, re-run layout).

**Alternatives Considered:**
- Incremental compound node update with careful diffing
- Re-parenting nodes in place
- Unified destroy-and-recreate for all panel types

**Rationale:** Cytoscape compound node parent-child relationships are set at node creation and are not easily modified after the fact. Attempting to update compound node structure incrementally is fragile and produces visual artifacts. For teaching-sized datasets, destroy-and-recreate is imperceptible. The two panel families have different update models because their data structures have different update characteristics.

**Consequences:**
- Selection state is lost on every `graph:updated` in the entity explorer
- The Cytoscape instance reference in these panels is short-lived (recreated on update)
- Layout animation runs on every update — this is acceptable and arguably desirable (the hierarchy "settles" visually)

---

### DDR-030 — Literals as Nodes in Graph Visualization
*(formerly ADR-030)*

**Context:** Literal values (strings, numbers, dates) in RDF triples can be visualized as either: leaf nodes with edges from their subject, or as properties displayed on the subject node (tooltip, label, or inline text).

**Decision:** Literals are rendered as nodes — rounded rectangles in light gray — connected to their subject by edges. They are not suppressed as annotations.

**Alternatives Considered:**
- Literals as subject node properties (tooltip or inline text)
- Literals hidden from the graph, shown only in the entity explorer
- Toggle between node and annotation modes

**Rationale:** The core teaching beat of the first demo requires showing that raw JSON is "already a proto-graph — just lacking connective tissue." If literals are suppressed, the "two islands" state looks sparse. Showing literals as nodes makes the graph look populated even before any context is applied. The context doesn't create the graph — it reveals the relationships that were implicit.

**Consequences:**
- Literal nodes use `literalId(term)` (deterministic hash of value + datatype + language) for deduplication
- The graph visualization is denser than it would be with literals suppressed
- Long literal values are truncated to 20 characters with `…` in the node label; full value shown on hover

---

### DDR-032 — Entity Explorer Renders Equivalence Merges, Inferred Memberships, and Class Assertions
*(formerly ADR-032 — refines DDR-031)*

**Context:** DDR-031 scoped the entity explorer's inferred-awareness to the instance property view only; the class hierarchy, member list, and class selection stayed asserted-only — scope control at the time, not a design verdict. The architect has since directed: (1) classes connected by `owl:sameAs` must render as one set, not two; (2) selecting a class must show the triples on the class — asserted roman, inferred italic — alongside its members; (3) inferred memberships must be visible in the explorer, italic.

**Decision:**
- **Equivalence merge.** Classes connected by `owl:sameAs` or `owl:equivalentClass` (asserted or inferred, either direction, transitively — union-find in `parse-utils.equivalenceGroups`) render as a single compound container. Canonical representative = the group's lexicographically-smallest member present in the scope-filtered candidate set, so merging never resurrects a scope-excluded IRI. Hover shows every grouped IRI joined with `≡`. Member/detail queries span the whole group. The merge map is recomputed on every rebuild (per C7 — never cached across graph updates).
- **Class detail pane.** Class selection renders Assertions (`<class> ?p ?v` over asserted + `-inferred` graphs, across the equivalence group) above Members (same inferred-aware scope). Rows present only in a `-inferred` graph render italic; a row both asserted and re-derived renders roman (assertion wins). Values are shown as asserted — NOT canonicalized to the group representative. The one exception: *inferred* equivalence statements whose object is another alias of the *same* merged class are dropped (self-referential noise); the author's own asserted equivalence statements are always kept.
- **Transitive membership.** A class's Members list includes instances of every (transitive) subclass. The subClassOf structure is captured from the merged hierarchy bindings and walked in JS (`_descendantClasses`). Direct members render roman; members present only by subclass or reasoner inference render italic and sort after the direct ones.
- **Inferred membership dots.** Reasoner-derived `?instance a ?class` triples place the instance inside the additional class container, styled dashed/italic/muted teal — memberships only, and only into classes that already have an asserted container (the class/parent structure query stays asserted-only to avoid order-dependent nesting).

**Consequences:**
- The inference reveal the entity explorer was designed around now actually renders.
- Inferred membership placement is canonicalized through the equivalence merge.
- The vocabulary panel's row-collapsing turned out to need a genuinely different merge key than this one — see DDR-034.

---

### DDR-033 — Entity Explorer Scope Toggle Means Lab vs Cumulative; Meta-Vocabulary Always Hidden
*(formerly ADR-033)*

**Context:** The Mine/All toggle originally meant "hide vs show the RDF/RDFS/OWL/SHACL/XSD meta-vocabulary", with both states cumulative across labs. With teaching data that never types anything as `owl:Class`, the two states were indistinguishable on screen, and the architect's expectation was graph scoping: "mine isn't scoped to just what's in the lab." This entry supersedes the Mine/All semantics introduced in an earlier, informal iteration ("adding togglable scope to entity viewer").

**Decision:**
- **Mine** = this lab's named graph only. **All** = every lab's graph up to and including this one (the cumulative scope Full Graph uses). The toggle drives a single `_scopeGraphs()` source that every query in the panel — hierarchy, equivalence merge, inferred memberships, class detail, instance properties — derives its `VALUES ?g` clause from.
- The meta-vocabulary is **always** filtered from the hierarchy, in both scopes. It's how you declare, not what you're modelling; the machinery reveal is dropped from this panel.
- Default is Mine: start lab-local, widen to All as the instructor's reveal.

**Alternatives Considered:**
- Two independent toggles (scope × meta-vocab) — most flexible, rejected by the architect for toolbar noise.
- Single combined toggle (lab+clean vs cumulative+machinery) — loses the clean cumulative view, rejected.

**Consequences:**
- Scope switches re-render the detail pane too, not just the hierarchy — a selected class's members narrow to the lab in Mine.
- The `sparql` attribute still arrives from sem-lab with the cumulative VALUES clause; the panel re-scopes it per query. Component contract unchanged — see C13.
- No way to see owl:/rdfs: terms as containers in this panel anymore; the vocabulary explorer remains the place where declaration machinery is discussed.

---

### DDR-034 — Vocabulary Panel Row-Collapsing Is Display-Label Collision, Not Semantic Equivalence
*(renumbered — this entry was mislabeled ADR-033 in the original ADR document, colliding with DDR-033 above. No code comment cites the row-collapsing feature as "ADR-033", so this renumbering does not orphan any reference.)*

**Context:** Following DDR-032's entity-explorer equivalence merge, the vocabulary panel (`sem-panel-vocab.js`) was given the identical treatment: classes merged on `owl:sameAs`/`owl:equivalentClass`, properties on `owl:equivalentProperty`. In review this proved wrong for a browsing list specifically: `ex:penName owl:equivalentProperty schema:alternateName` — two deliberately, differently-named terms — collapsed into a single row under whichever IRI sorted first, silently removing `penName` from the browsable list. The architect's objection: "If `ex:penName` was defined in the vocab, it needs to be in the list. Period. Not buried in the drilldown." This entry supersedes an unreleased first attempt (never committed) that merged vocabulary rows on the same semantic-equivalence key as DDR-032's entity-explorer merge.

The entity explorer and the vocabulary panel are solving different problems (see README: "the entity explorer (set membership) and the vocabulary explorer (class/property definitions and hierarchy) are different things with different interaction models"). The entity explorer merges CLASSES because `owl:sameAs`/`equivalentClass` genuinely means "these are one set" — merging is the correct semantics. The vocabulary panel is a browsing index of TERMS an author defined; every row-candidate term must be independently findable.

**Decision:** The vocabulary panel's Classes and Properties row-collapsing is driven by **exact display-label collision** — `ex:name` and `schema:name` both render as `name`, and a flat list (or a class-graph node label) cannot show two rows/nodes with identical text as distinguishable anyway, so those collapse into one, and the detail/drilldown pane is what disambiguates them (querying every IRI in the group, not just the canonical one). This is NOT semantic: `owl:sameAs`, `owl:equivalentClass`, and `owl:equivalentProperty` assertions play no part in the merge decision.

Mechanically this reuses the exact same merge machinery as DDR-032 (`mergeHierarchyBindings`) — only the grouping *key* changes. A new `parse-utils.groupsByLabel(entries)` computes the grouping (trivial: identical strings are already a complete, transitive group — no union-find needed, unlike `equivalenceGroups`) and produces the same `Map<iri, group[]>` shape. The merged-row hover label and detail-pane group note use `/` rather than `≡` to avoid implying a formal equivalence assertion that may not exist.

**Alternatives Considered:**
- **Semantic-equivalence merge (the reverted first attempt)** — rejected: buries differently-named, intentionally-authored terms, directly undermining the panel's purpose as a browsing index.
- **No merging at all** — rejected: `ex:name`/`schema:name` sharing an identical rendered label is a real, if narrow, display collision a list cannot resolve without merging or an artificial disambiguator.

**Consequences:**
- The vocabulary panel and entity explorer now have two clearly-named, deliberately different merge behaviors — this follows from the two panels solving different problems.
- The class-hierarchy graph's `packComponents` layout question (ADR-010's iteration-13 correction) and this row-collapsing question are independent — the same fCoSE piling bug applied regardless of which merge key was in use.

---

## Deployment

### DDR-026 — Pre-Baked Datasets, No Cross-Origin Fetch
*(formerly ADR-026)*

**Context:** The Fetch affordance in JSON-LD panels allows loading external data by URL. The "datasets unlock datasets" demo beat requires fetching a richer description of an entity. CORS restrictions prevent direct browser-to-DBpedia fetching.

**Decision:** Datasets that simulate external resources are pre-baked as local JSON-LD files in `/datasets/`. The Fetch affordance works with relative paths to these files. Cross-origin fetching is not supported in v1.

**Alternatives Considered:**
- CORS proxy server (adds server dependency)
- Wikidata SPARQL endpoint (CORS-friendly, but live network dependency)
- Pre-fetched and cached remote responses

**Rationale:** Conference wifi is unreliable. A live remote fetch during a demo is a liability. Pre-baked local files give the instructor full control over what properties appear when a dataset is loaded — pedagogically superior to unpredictable live data. A CORS proxy would add a server dependency that violates C11.

**Consequences:**
- `/datasets/` directory contains curated JSON-LD files for each demo scenario
- Future: CORS proxy via HTMX for genuinely live external data (separate iteration)
- The Fetch affordance is a URL input — it works with any URL the browser can reach, including local paths

---

### DDR-028 — Per-Notebook Directory Structure
*(formerly ADR-028)*

**Context:** Multiple notebooks need to coexist. Options include query parameters (`?notebook=intro`), path-based routing, or separate directories.

**Decision:** Each notebook has its own directory: `/notebook1/index.html`, `/notebook2/index.html`. All notebooks share common assets at `/scripts/`, `/components/`, `/styles/`, `/notebooks/`, `/datasets/`.

**Alternatives Considered:**
- Single HTML file with query parameter (`?nb=intro`)
- Sub-paths under a notebook root (`/notebooks/intro/`)
- Separate domains

**Rationale:** Directories are resources. `/notebook1/` is a dereferenceable resource — navigable, linkable, bookmarkable without query parameters, matching C2's resource-orientation principle. Each notebook's `index.html` is a thin shell that differs only in the bootstrap fetch URL and the CDN imports needed.

**Consequences:**
- Relative paths in notebook HTML must use `../` to reach shared assets
- A new notebook is a new directory with a thin `index.html` shell
- Notebook-specific styles or scripts live in the notebook directory; shared ones in `/scripts/` and `/styles/`

---

*This document is immutable in the same sense the other two are: when a decision changes, a new DDR entry supersedes the old one, and superseded entries are retained for audit. See [ARCHITECTURE_DECISION_RECORDS.md](ARCHITECTURE_DECISION_RECORDS.md)'s index for the full map of where every original ADR number lives now.*
