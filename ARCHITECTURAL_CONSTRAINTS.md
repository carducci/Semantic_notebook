# Semantic Notebook — Architectural Constraints
> Constraints the coding agent must respect and validate solutions against.
> Grounded in the Tailor-Made Architecture model from *Mastering Software Architecture*.

---

## Preamble

Architecture is a named, coordinated set of constraints. Not patterns — patterns are a side effect of architecture. The constraints come first. Everything else is derived.

This document defines the constraints for the Semantic Notebook project. Every implementation decision must be validated against them. When a proposed solution violates a constraint, the constraint wins — not the convenience of the solution.

The agent must treat this document as a checklist, not a suggestion list. Before proposing or implementing any solution, ask: does this fit?

---

## The Fit Dimensions

The Tailor-Made model requires fit across four dimensions simultaneously. A solution that fits the business but not the team is not a fit. A solution that fits the technology but not the organization is not a fit. All four must hold.

### Business Fit
The business goal of this system is teaching. Every decision must serve the teaching moment. If a technical choice makes the code cleaner but obscures the pedagogical arc, it is the wrong choice.

### Team Fit
The "team" building content for this system is one person — the instructor. The constraints must support a workflow where:
- Notebooks can be authored without engineering assistance
- The JSON-LD format is human-writable and readable
- Demo scenarios can be modified quickly between sessions
- The system fails gracefully when content is imperfect

### Organization Fit
This is an independent project with no ops team, no dedicated infrastructure, no CI/CD pipeline. The constraints must reflect that:
- Zero operational overhead at rest (static files)
- No services that can go down during a conference talk
- No dependencies on external APIs during live demo (except when demonstrating that specific capability)
- Deployment is a file copy

### Environmental Fit
The primary runtime environment is a conference room. The constraints must account for:
- Unreliable or absent wifi
- A projector showing a 16:9 viewport
- An audience ranging from beginner to expert
- One person driving, N people watching and following along

---

## The Constraints

### C1 — Hypermedia-First

**Statement:** The system must behave as a hypermedia client and server at every layer. Resources are identified by URIs. State transitions are driven by links. The application surface area is navigable without prior knowledge baked into the client.

**Rationale:** This is not just a principle — it is the subject matter. The notebook is teaching hypermedia. A notebook that violates hypermedia principles is teaching one thing and doing another. That contradiction would undermine the credibility of everything it teaches.

**Validation:** Can you navigate to any lab by following links from the notebook root? Can a new client discover the notebook's structure from its representation alone? If not, the constraint is violated.

**Violations:**
- Hardcoding lab IRIs in client code
- Using query parameters for navigation state
- Client-side routing that doesn't reflect in the URL
- Session state that can't be reconstructed from a URI

---

### C2 — Resource Orientation

**Statement:** Every significant thing in the system must be a resource with an IRI. Labs, panels, notebooks, datasets, vocabulary terms — all are resources. Not objects. Not components. Resources.

**Rationale:** The distinction between an object and a resource is the distinction between private implementation state and a publicly addressable thing. The notebook teaches that identity is the prerequisite for connection. The system must practice what it preaches.

**Validation:** Can you dereference the IRI of any lab and get a meaningful representation? Can the notebook's structure be described entirely in terms of IRIs and their relationships?

**Violations:**
- Auto-generated IDs that aren't IRIs
- Fragment identifiers that are implementation details rather than resource identities
- Named graphs that don't correspond to dereferenceable resources

---

### C3 — The Notebook Format Is the Subject Matter

**Statement:** The notebook format must be a semantic artifact. Notebooks are stored as JSON-LD. The vocabulary that describes them is a proper OWL ontology. The format must be queryable with SPARQL and describable with RDFS/OWL.

**Rationale:** Michael authored the definitive book on semantic web technologies. If his teaching tool uses an opaque proprietary format, the argument for semantic formats is self-refuting. The tool must dogfood the thesis.

**Validation:** Can you load a notebook file into Protégé? Can you run a SPARQL query against the notebook definition and get meaningful results? Can another tool consume the notebook format without reverse engineering it?

**Violations:**
- Notebook configuration stored as plain JSON without semantic types
- Layout or behavior encoded as magic strings rather than typed RDF properties
- Component configuration that isn't representable in the `sembook:` vocabulary

---

### C4 — No Invented Abstractions

**Statement:** When a solved problem exists in the ecosystem, use the ecosystem's solution. Do not invent a custom equivalent. This applies to layout (Tailwind), component behavior (Web Components spec), query language (SPARQL), serialization (JSON-LD, Turtle), and everything else.

**Rationale:** From the talk: "patterns are a side effect of architecture." Inventing a custom DSL for layout, or a custom event protocol for component communication, or a custom query syntax for panel configuration is prescribing patterns before understanding the architecture. Every invented abstraction is a maintenance burden and a conceptual wall between the system and its ecosystem.

**Validation:** For every custom abstraction in the codebase, ask: does an ecosystem equivalent exist? If yes, why wasn't it used? If the answer is "convenience" or "it felt cleaner," the constraint is violated.

**Violations:**
- Custom grid DSL instead of Tailwind classes
- Magic strings like `"local"` or `"full"` for graph scope instead of SPARQL queries
- Custom event formats instead of JSON-LD on the event bus
- Invented query syntax instead of SPARQL

---

### C5 — Local Execution, Server as Escape Hatch

**Statement:** All teaching operations must execute locally in the browser. The triplestore, the SPARQL engine, the reasoner, the graph visualization — all client-side. The server is invoked only for operations that genuinely require it: persistence, NL→SPARQL translation, artifact export.

**Rationale:** If execution is local, the audience can see everything. No network tab mysteries. No latency. No black box. The transparency is pedagogically essential — the audience must be able to trust that what they see is what is happening. Server-side execution creates a gap between the visible and the actual. That gap undermines trust in the teaching.

Additionally: conference wifi is unreliable. A system that requires a server call for core functionality will fail at the worst possible moment.

**Validation:** Does the system function fully offline after initial page load? Can the audience follow along without network access?

**Violations:**
- SPARQL queries sent to a remote endpoint for panel rendering
- Reasoning invoked on a remote server for graph visualization
- Any core teaching operation that requires a network call

---

### C6 — Consistent Component Lifecycle

**Statement:** Every component — lab or panel — must implement the same lifecycle contract: `connectedCallback`, `initialize`, `render`, `update`, `disconnectedCallback`. No exceptions. No special cases. No components that bypass the contract.

**Rationale:** From the Tailor-Made model: architectural constraints must be consistently applied. A constraint with exceptions is not a constraint — it's a preference. The consistent lifecycle is what makes components independently testable, what makes the system predictable, and what ensures that future panel types fit without surprises.

**Validation:** Can you write a unit test for any panel using only a mock NotebookContext? If a panel requires special initialization that bypasses the standard contract, the constraint is violated.

**Violations:**
- Components that initialize themselves by reaching into the DOM
- Components that maintain state beyond what the lifecycle contract permits
- Components that communicate directly with other components rather than through the notebook context

---

### C7 — The Quad Store Is the Single Source of Truth

**Statement:** The in-browser quad store is the authoritative state of the system. No component may maintain a local copy of graph data. No component may cache triples. The quad store is queried on every render. Components are projections of the store, not owners of data.

**Rationale:** This is the semantic web principle applied to the component model. In the semantic web, the graph is the source of truth. URIs identify things. Querying the graph returns the current state. Applications that cache data create divergence between what is and what is shown. The notebook must not make this mistake about the very thing it teaches.

**Validation:** If you clear a component's local state and re-render it from the quad store, does it produce the same output? If not, the component has state that violates this constraint.

**Exceptions (documented):** The Cytoscape instance reference is retained between renders for performance. This is the one documented exception. It does not cache graph data — it caches the rendering context only.

**Violations:**
- Components that store triples locally and update the store separately
- Components that maintain a local copy of query results between renders
- Any state that diverges from the quad store

---

### C8 — Infrastructure Data and Teaching Data Must Never Mix

**Statement:** Notebook definition triples (infrastructure) live in the default graph. Teaching content triples live in named graphs. Panel SPARQL queries must scope to named graphs only. Infrastructure triples must never appear in any panel visualization.

**Rationale:** The audience is watching the graph. If `sembook:Lab` nodes appear alongside `:Person` nodes, the teaching moment is contaminated. The audience loses the thread. The infrastructure must be invisible. This is not a styling preference — it is a hard boundary between the system and its subject matter.

**Validation:** Load the notebook and parse no user content. Do any panel visualizations show any nodes or edges? If yes, infrastructure is leaking into the teaching surface.

**Violations:**
- SPARQL queries without explicit `GRAPH` clause scoping
- `unionDefaultGraph: true` used without compensating named graph filter
- Any `sembook:` typed node appearing in a Cytoscape visualization or entity explorer

---

### C9 — Events Are Scoped

**Statement:** All events on the notebook context event bus must carry a `labUri` scope. A panel may only respond to events scoped to its own lab. Selection events, graph update events, and any future event types must carry this scope.

**Rationale:** The Tailor-Made model emphasizes that constraints must be precisely defined — not vague. "Components communicate via the event bus" is vague. "Events are scoped to their lab and panels only respond to events in their scope" is a constraint. Without this scoping, the system breaks the moment two labs are visible simultaneously.

**Validation:** With two labs visible on screen, trigger a graph update in lab 1. Do any panels in lab 2 re-render? If yes, events are not properly scoped.

**Violations:**
- Events without `labUri` property
- Panels that respond to events from other labs
- Global state changes triggered by lab-local events

---

### C10 — No Framework

**Statement:** No JavaScript framework. Native Web Components only. No React, no Vue, no Angular, no Svelte. CDN imports of purpose-specific libraries (Cytoscape, CodeMirror, N3.js, Comunica) are permitted. General-purpose UI frameworks are not.

**Rationale:** From the talk: "HTML is not UIML." The browser is a hypermedia client. Frameworks that treat the browser as an application runtime are architecturally incompatible with the system's principles. Additionally, this is a teaching tool — the implementation should be transparent enough that an advanced audience member can inspect it and understand it without framework knowledge.

**Validation:** Can a developer with no framework knowledge read and understand any component file? Does the system require a build step?

**Violations:**
- Any npm package that is a UI framework
- Any build step (webpack, vite, rollup, etc.)
- Any JSX or template compilation
- Virtual DOM of any kind

---

### C11 — Static First, Backend Agnostic

**Statement:** The system must function fully as static files with no backend. The URI scheme must be designed so a backend can be introduced later without changing any component contracts. Component code must not know or care whether notebook JSON-LD comes from a static file or a server endpoint.

**Rationale:** Conference deployment means file copy. Development means file copy. The backend (C#, Razor, persistent storage) is a future concern. Building in a backend dependency now would violate the Tailor-Made fit principle — the environment doesn't support it yet, so the architecture must not require it.

**Validation:** Does the system work when served from a local file server with no dynamic endpoints? Does changing `fetch('../notebooks/intro.jsonld')` to `fetch('/api/notebooks/intro')` require any changes beyond that one line?

**Violations:**
- Components that require API endpoints for initialization
- Auth or session state assumptions
- Server-rendered HTML that components depend on

---

### C12 — Scope Control

**Statement:** Every implementation task has an explicit scope. The agent must not implement features outside the stated scope of the current handoff. When something outside scope seems obviously useful, it must be flagged for the architect's decision — not implemented.

**Rationale:** This is the Tailor-Made model's "avoid overprescribing" constraint applied to the development process. The architect (Michael) has visibility into interconnections and sequencing that the agent does not. An agent that implements beyond its scope is introducing undocumented decisions into a system where decisions are load-bearing.

**Validation:** After each implementation task, compare what was built to what the handoff specified. Any delta is a scope violation.

**Violations:**
- Implementing features listed as "explicitly deferred"
- Making behavior changes during a restructure task
- Adding abstractions not requested by the architect
- Resolving open questions by picking an answer rather than surfacing them

---

## Constraint Validation Checklist

Before submitting any implementation for review, the agent must answer these questions:

1. **C1 — Hypermedia:** Are all resources identified by IRIs? Is navigation driven by links?
2. **C2 — Resource Orientation:** Does every significant thing have an IRI? Is it dereferenceable?
3. **C3 — Semantic Format:** Is the notebook definition valid JSON-LD? Does it conform to the `sembook:` ontology?
4. **C4 — No Invented Abstractions:** Is every abstraction in this implementation justified? Does an ecosystem equivalent exist?
5. **C5 — Local Execution:** Does this feature work offline? Does it require a server call during core operation?
6. **C6 — Consistent Lifecycle:** Does every component implement the standard lifecycle? Can it be unit tested against a mock context?
7. **C7 — Quad Store Authority:** Does any component cache graph data locally? Does render produce the same output from store state alone?
8. **C8 — Data Separation:** Do all panel queries scope to named graphs? Can infrastructure triples reach the visualization layer?
9. **C9 — Event Scoping:** Do all events carry `labUri`? Do panels filter events by their own lab?
10. **C10 — No Framework:** Is there a build step? Is there a UI framework dependency?
11. **C11 — Static First:** Does this work without a backend? Is the fetch URL the only seam?
12. **C12 — Scope Control:** Does this implementation match the handoff scope exactly? Are deferred items still deferred?

---

## Architectural Style Definition

Following Fielding's constraint-based definition of architectural styles (REST being the canonical example), the Semantic Notebook can be defined as a named style:

**Semantic Notebook Architecture (SNA)** — a browser-based hypermedia teaching environment characterized by:

1. Resource-identified components (C1, C2)
2. A semantic artifact format for configuration (C3)
3. Ecosystem-native abstractions (C4)
4. Local-first execution with server escape hatches (C5)
5. Uniform component lifecycle (C6)
6. A quad store as single source of truth (C7)
7. Hard separation between infrastructure and content data (C8)
8. Scoped inter-component communication (C9)
9. No framework, no build step (C10)
10. Backend-agnostic static deployment (C11)

A system that satisfies all twelve constraints is an instance of this style. A system that violates any constraint is not — regardless of what it looks like from the outside.

---

## On Fit

The constraints above are not arbitrary. Each one was derived from the intersection of:

- The business goal (teaching semantic web technologies)
- The team constraint (one instructor, one developer, one architect — sometimes the same person)
- The organizational constraint (independent project, no ops, conference deployment)
- The environmental constraint (conference room, unreliable wifi, live audience)

A different project with different fit dimensions would produce different constraints. These constraints fit *this* project. They should not be applied elsewhere without re-deriving from fit.

When a constraint feels wrong for a specific situation, the right response is not to violate it — it is to surface the tension to the architect. The constraint may need to be refined. Or the situation may be misunderstood. Either way, the architect decides.

---

*These constraints are derived from the Tailor-Made Architecture model described in Michael Carducci's book* Mastering Software Architecture *and from the architectural decisions made in building this system. They should be updated as the architecture evolves.*
