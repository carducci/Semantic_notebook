# Semantic Notebook — Architecture Spec
> Handoff document for Claude Code. This is the authoritative reference for the first build target.

---

## What This Is

A browser-based semantic teaching tool. Not a REPL, not a query console — a **notebook** where the knowledge graph is the teaching surface. Built to support conference talks and book companion material on semantic web technologies.

The core teaching moment: you add an ontology to a graph and it knows more than you told it. Reasoning emergence, made visceral and interactive.

---

## Principles

- **Hypermedia-first, resource-oriented.** The notebook URL is a real resource. GET it, get a rendered notebook. No SPA, no framework hijacking the browser.
- **HTML is not UIML.** We use the browser as a hypermedia client, not an application runtime.
- **No JS framework.** Native web components only. No React, no Vue, no Angular.
- **Local execution.** The triplestore lives in the browser. Reasoning happens client-side. The audience can see everything.
- **Server as escape hatch.** HTMX handles discrete server round-trips for persistence, artifact export, and NL→SPARQL. Nothing else needs the server.
- **Static first.** Notebooks are pre-baked JSON-LD files fetched on load. URI scheme is designed to swap in a backend later without changing component contracts.
- **Consistent component lifecycle.** Every component — lab or panel — has the same shape. No special cases.
- **No invented abstractions.** Layout uses Tailwind utility classes. No custom grid DSL, no magic strings.

---

## Stack

| Concern | Library |
|---|---|
| RDF parsing (Turtle, JSON-LD) | N3.js |
| Quad store (in-browser triplestore) | N3.js Store (native quad support) |
| SPARQL 1.1 query engine | Comunica |
| RDFS / OWL 2 RL reasoning | N3.js Reasoner |
| Graph visualization | Cytoscape.js |
| Layout utilities | Tailwind CSS (CDN) |
| Server round-trips | HTMX |
| Components | Native Web Components (no framework) |
| Notebook format (on disk) | JSON-LD |

**No build step for v1.** Vanilla JS, ES modules, CDN imports. Same pattern as the Hydra demo.

---

## Notebook Format

Notebooks are JSON-LD files. The notebook definition is fetched on page load and parsed into the quad store. All lab definitions, panel configurations, CSS classes, init data, and SPARQL queries live in this file.

Layout is expressed as Tailwind utility classes on the `sembook:cssClass` property of any component. The component reads this property and applies it directly. No interpretation, no mapping — just classes.

```jsonld
{
  "@context": {
    "sembook": "https://sembook.example.org/vocab#",
    "rdf": "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
    "rdfs": "http://www.w3.org/2000/01/rdf-schema#"
  },
  "@graph": [
    {
      "@id": "https://sembook.example.org/intro",
      "@type": "sembook:Notebook",
      "sembook:title": "Introduction to Linked Data",
      "sembook:labs": [
        { "@id": "https://sembook.example.org/intro#identity" }
      ]
    },
    {
      "@id": "https://sembook.example.org/intro#identity",
      "@type": "sembook:Lab",
      "sembook:label": "Identity and Connection",
      "sembook:cssClass": "grid grid-rows-[40vh_60vh] h-screen w-full",
      "sembook:init": {
        "@graph": []
      },
      "sembook:panels": [
        {
          "@type": "sembook:JsonLdPanel",
          "@id": "https://sembook.example.org/intro#identity-doc-a",
          "sembook:label": "Document A",
          "sembook:cssClass": "col-span-1 overflow-hidden"
        },
        {
          "@type": "sembook:JsonLdPanel",
          "@id": "https://sembook.example.org/intro#identity-doc-b",
          "sembook:label": "Document B",
          "sembook:cssClass": "col-span-1 overflow-hidden"
        },
        {
          "@type": "sembook:TabsPanel",
          "sembook:cssClass": "col-span-2",
          "sembook:panels": [
            {
              "@type": "sembook:GraphPanel",
              "sembook:label": "Local Graph",
              "sembook:sparql": "SELECT * WHERE { GRAPH <https://sembook.example.org/intro#identity> { ?s ?p ?o } }"
            },
            {
              "@type": "sembook:GraphPanel",
              "sembook:label": "Full Graph",
              "sembook:sparql": "SELECT * WHERE { ?s ?p ?o }"
            },
            {
              "@type": "sembook:EntityPanel",
              "sembook:label": "Entities",
              "sembook:sparql": "SELECT DISTINCT ?entity ?type WHERE { ?entity a ?type . FILTER(?type != <http://www.w3.org/2002/07/owl#Class>) }"
            },
            {
              "@type": "sembook:EntityPanel",
              "sembook:label": "Vocabulary",
              "sembook:sparql": "SELECT DISTINCT ?class WHERE { ?class a <http://www.w3.org/2002/07/owl#Class> }"
            }
          ]
        }
      ]
    }
  ]
}
```

---

## Named Graph Model

The quad store is the single source of truth. One lab = one named graph. The lab IRI is the named graph IRI.

```
(subject, predicate, object, <lab-iri>)
```

Init data, editor contents, and fetched resources all live in the same named graph. There is no sub-graph splitting within a lab. Panel SPARQL queries target the lab's named graph explicitly or query the full store — that distinction is in the query, not in the architecture.

**Inferred triples** go into a companion named graph: `<lab-iri-inferred>`. This keeps asserted and inferred triples distinct for visualization purposes without complicating the core model.

---

## URI Scheme

Labs are identified by fragment identifiers on the notebook URL:

```
https://sembook.example.org/intro#identity
https://sembook.example.org/intro#vocabulary
https://sembook.example.org/intro#emergence
```

Fragment identifiers are:
- Human-readable slugs, not generated IDs
- Stable — do not change when backend is added
- Valid as named graph IRIs in the quad store
- Valid as anchor targets for deep linking

---

## Bootstrap Sequence

```
1. Page loads — page-level throbber overlay visible
2. bootstrap.js fetches notebook JSON-LD
3. JSON-LD parsed and loaded into quad store (default graph)
4. For each lab in order:
   a. Read sembook:init from quad store
   b. Fire graph:upsertFragment for init data
   c. Load into lab's named graph
5. Triplestore fully populated
6. notebook:ready event fires on document
7. Throbber removed
8. Components register via connectedCallback
9. Intersection Observer takes over
10. Deep link (if any) scrolls to target lab
11. Intersection Observer fires for visible lab(s)
12. Visible labs render
```

Steps 1–7 are eager and sequential. Steps 8–12 are event-driven and lazy.

---

## Component Model

### Base Contract

Every component — lab or panel — shares the same lifecycle:

```javascript
connectedCallback()    // register with notebook context, declare graph subscriptions
initialize()           // load init data if any — labs do this, most panels don't
render(store)          // triggered by intersect OR graph:updated
update()               // user interaction, emits events to notebook context
disconnectedCallback() // cleanup — pause Cytoscape, remove subscriptions
```

### Base Panel

All panels extend a base class:

```javascript
class SemPanel extends HTMLElement {
    get sparql()  { return this.getAttribute('sparql'); }
    get label()   { return this.getAttribute('label'); }
    get uri()     { return this.getAttribute('uri'); }

    async render(notebook) {
        this.setLoadingState();
        const results = await notebook.query(this.sparql);
        this.renderResults(results); // implemented by subclass
    }

    setLoadingState() { /* skeleton/shimmer */ }
}
```

Subclasses override `renderResults`. The data fetching contract is identical across all panel types.

### Component Registry

| Tag | Class | Description |
|---|---|---|
| `<sem-notebook>` | SemNotebook | Root component, owns bootstrap |
| `<sem-lab>` | SemLab | One per lab, owns named graph, Intersection Observer |
| `<sem-panel-tabs>` | SemPanelTabs | Tab layout container, owns tab chrome |
| `<sem-panel-jsonld>` | SemPanelJsonLd | JSON-LD editor + fetch + parse affordances |
| `<sem-panel-graph>` | SemPanelGraph | Cytoscape visualization |
| `<sem-panel-entity>` | SemPanelEntity | Entity/vocabulary explorer list |

### HTML Structure

Components receive their Tailwind classes from the notebook definition via the `class` attribute, applied by the bootstrap renderer. The HTML is generated from the JSON-LD — it is not hand-authored.

```html
<sem-notebook uri="https://sembook.example.org/intro">

  <nav id="lab-nav">
    <!-- generated from notebook definition, anchor links to lab fragment IDs -->
  </nav>

  <sem-lab
    id="identity"
    uri="https://sembook.example.org/intro#identity"
    class="grid grid-rows-[40vh_60vh] h-screen w-full">

    <sem-panel-jsonld
      uri="https://sembook.example.org/intro#identity-doc-a"
      label="Document A"
      class="col-span-1 overflow-hidden">
    </sem-panel-jsonld>

    <sem-panel-jsonld
      uri="https://sembook.example.org/intro#identity-doc-b"
      label="Document B"
      class="col-span-1 overflow-hidden">
    </sem-panel-jsonld>

    <sem-panel-tabs class="col-span-2">
      <sem-panel-graph
        label="Local Graph"
        sparql="SELECT * WHERE { GRAPH <https://sembook.example.org/intro#identity> { ?s ?p ?o } }">
      </sem-panel-graph>
      <sem-panel-graph
        label="Full Graph"
        sparql="SELECT * WHERE { ?s ?p ?o }">
      </sem-panel-graph>
      <sem-panel-entity
        label="Entities"
        sparql="SELECT DISTINCT ?entity ?type WHERE { ?entity a ?type . FILTER(?type != owl:Class) }">
      </sem-panel-entity>
      <sem-panel-entity
        label="Vocabulary"
        sparql="SELECT DISTINCT ?class WHERE { ?class a owl:Class }">
      </sem-panel-entity>
    </sem-panel-tabs>

  </sem-lab>

</sem-notebook>
```

---

## Event Bus

The notebook context is the event bus. Components emit to it, the context updates the quad store, subscribed components re-render.

### Events

```javascript
// Emitted by: sem-panel-jsonld when user clicks Parse button
// Handled by: notebook context
'graph:upsertFragment' {
    labUri: string,      // the lab's named graph IRI
    fragmentUri: string, // this panel's IRI — identifies which triples to replace
    document: object     // the full parsed JSON-LD document
}

// Emitted by: notebook context after successful upsert
// Handled by: all panels subscribed to labUri
'graph:updated' {
    labUri: string
}

// Emitted by: bootstrap.js when triplestore is fully populated
// Handled by: all components
'notebook:ready' {
    notebook: NotebookContext
}
```

### Fragment Upsert Logic

```
1. Remove all quads in quad store where graph = fragmentUri
2. Parse incoming JSON-LD document
3. Add all resulting quads with graph = labUri
4. Fire graph:updated for labUri
5. All visible panels subscribed to labUri re-render
```

No delta computation. The panel's document is the source of truth. Replace and reload.

---

## Notebook Context API

The context object passed via `notebook:ready`. Components call this — never the quad store directly.

```javascript
class NotebookContext {
    // Query the quad store
    async query(sparql: string): Promise<Results>

    // Describe a resource by IRI (returns JSON-LD object)
    describe(uri: string): object

    // Upsert a graph fragment
    async upsertFragment(labUri, fragmentUri, document): Promise<void>

    // Subscribe a panel to graph updates for a given lab
    subscribe(labUri: string, panel: SemPanel): void

    // Get ordered named graph IRIs up to and including a given lab
    graphsUpTo(labUri: string): string[]

    // Emit an event on the bus
    emit(event: string, detail: object): void
}
```

---

## Viewport Layout

Each lab occupies 100vh. Navigation is a fixed top strip with lab title anchor links — generated from the notebook definition. Scrolling is the primary navigation. No JavaScript-driven reveal or tab switching between labs. Deep linking via fragment identifier scrolls to the target lab and triggers the Intersection Observer naturally.

Layout within each lab is controlled entirely by Tailwind classes on the `sembook:cssClass` property in the notebook definition. Different labs have different layouts — the component makes no assumptions.

### First Demo Lab Layout

```
┌─────────────────────────────────────────┐  ← fixed nav strip
├──────────────────┬──────────────────────┤
│                  │                      │
│  JSON-LD         │  JSON-LD             │  40vh
│  Editor A        │  Editor B            │
│  [fetch] [parse] │  [fetch] [parse]     │
│                  │                      │
├──────────────────┴──────────────────────┤
│  [Local Graph][Full Graph][Entities]    │
│  [Vocabulary]                           │  60vh
│                                         │
│      Cytoscape / Entity List            │
│                                         │
└─────────────────────────────────────────┘
```

---

## Loading States

### Page-level throbber
- Rendered in the static HTML from the start — visible before any JS runs
- Full viewport overlay with centered indicator
- Removed when `notebook:ready` fires
- Covers the eager initialization phase entirely

### Lab-level skeleton
- Each lab renders panel outlines immediately (no content)
- Replaced by real content when render completes
- Briefly re-shown during re-render triggered by `graph:updated`
- Prevents flash of empty canvas

---

## sem-panel-jsonld Behavior

The JSON-LD editor panel has three affordances:

1. **Edit** — Textarea (CodeMirror deferred). Editing does NOT update the graph. The editor is a staging area.
2. **Parse** — Explicit button. Parses the current editor content, fires `graph:upsertFragment`. This is the only trigger for graph updates from this panel. Keeps the instructor in control of when the graph changes — pedagogically important.
3. **Fetch** — URL input + fetch button. Fetches the resource at the given URL, populates the editor with the response. The fetched URI becomes the fragment IRI. The user still clicks Parse to load into the graph.
4. **Clear** — Empties the editor and fires `graph:removeFragment`.

**Parse errors** are displayed inline in the panel. They do not affect the graph — the previous valid state is preserved.

---

## Cytoscape Lifecycle

Cytoscape instances are expensive to create. Strategy:

- **Created** on first intersection — not on page load
- **Kept alive** when lab leaves viewport — not destroyed
- **Dataset replaced** on `graph:updated`
- **Layout frozen** when not intersecting to save CPU

The panel holds a Cytoscape instance reference. This is the one intentional exception to the stateless panel model.

### Visual Treatment

| Triple type | Node style | Edge style |
|---|---|---|
| Asserted | Solid border, full color | Solid line |
| Inferred | Dashed border, muted color | Dashed line |
| Fetched (external) | Dotted border, accent color | Dotted line |

---

## Testing Strategy

### Unit — components
Tested against a mock NotebookContext. Components are stateless w.r.t. the graph (Cytoscape ref excepted).

```javascript
const mockNotebook = { query: async () => mockResults };
const panel = document.createElement('sem-panel-entity');
panel.setAttribute('sparql', 'SELECT ...');
await panel.render(mockNotebook);
assert(panel.shadowRoot.querySelectorAll('.entity').length === 3);
```

### Unit — notebook context
Test `upsertFragment`, `query`, `subscribe`, `graphsUpTo` in isolation.

### Integration — bootstrap
Full init from JSON-LD fetch to `notebook:ready`. Assert quad store contains expected triples per lab.

### End-to-end — first demo
Load identity lab → edit Document A → click Parse → assert Cytoscape updates → fetch URI into Document B → click Parse → assert graph connects → verify entity panel populates.

---

## First Build Target

**Goal:** Validate spatial feel and component architecture before wiring semantic machinery.

**Scope — implement exactly this, nothing more:**
- Single static HTML file
- Tailwind CSS via CDN
- One lab (`#identity`)
- Page-level throbber (in HTML from the start, removed on `notebook:ready`)
- Fixed navigation strip with one anchor link
- Lab skeleton state (panel outlines, no content)
- Two `sem-panel-jsonld` — textarea + Parse button + Fetch affordance (no actual parsing)
- `sem-panel-tabs` with four labeled tabs (placeholder content in each)
- Intersection Observer wired — lab renders when in viewport
- Scroll navigation only — no JS tab switching between labs
- No triplestore
- No Cytoscape
- No event bus
- No actual JSON-LD parsing

**Success criteria:**
- Spatial experience feels right
- Scroll navigation feels natural
- Lab proportions feel right on a 16:9 display (conference projector target)
- Component boundaries feel clean
- Parse button placement feels natural for the teaching flow

**If anything is ambiguous or unspecified, stop and ask. Do not invent.**

---

## Open Questions (do not resolve in code)

1. **Scroll vs. reveal** — scroll confirmed for now, subject to revision after seeing it.
2. **Dynamic lab insertion** — deferred, HTMX avenue available when needed.
3. **EYE JS vs. N3.js reasoner** — N3.js reasoner for v1. EYE JS deferred.
4. **Book artifact export format** — deferred pending production format decision.
5. **NL→SPARQL panel** — deferred until base stack is stable.
6. **CodeMirror vs. textarea** — textarea for v1, CodeMirror deferred.

---

## What This Is Not

- Not a general-purpose triplestore UI
- Not a replacement for Protégé
- Not a Jupyter clone
- Not a SPA
- Not dependent on any JS framework
- Not tied to any specific backend

---

## Claude Code Instructions

- **Model:** claude-sonnet-4-5
- **Scope:** First build target section only. Everything else is context, not a todo list.
- **Cadence:** Implement one component at a time and stop for review.
- **Style:** ES modules, CDN imports, single HTML file. No npm, no build step.
- **Layout:** Tailwind CDN only. No other CSS framework, no custom utility classes.
- **Ambiguity:** If something is not specified, ask. Do not invent behavior.
- **Goal:** This is a visual validation target, not a functional one. The semantic machinery comes later.

---

*This spec is a living document. Architectural decisions made here should not be revisited in code — surface questions to the architect.*
