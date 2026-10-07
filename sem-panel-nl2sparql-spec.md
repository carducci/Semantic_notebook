# OpenSpec: `sem-panel-nl2sparql`

> Design and implementation specification for the NL→SPARQL panel.  
> Architect: Michael Carducci | Status: DRAFT — awaiting approval before implementation begins.

---

## 1. Identity

| Field | Value |
|---|---|
| Component tag | `sem-panel-nl2sparql` |
| Class name | `SemPanelNl2Sparql` |
| File | `components/sem-panel-nl2sparql.js` |
| `sembook:` type | `sembook:Nl2SparqlPanel` |
| Base | Clone of `sem-panel-sparql.js`, restructured |

Registration:
```js
customElements.define('sem-panel-nl2sparql', SemPanelNl2Sparql);
```

---

## 2. Purpose

This panel is the Magicland reveal: the audience types a natural-language question, the panel serializes the full cumulative ontology (asserted + inferred, all named graphs up to and including this lab), sends it to the Anthropic Messages API along with the question, receives a SPARQL SELECT query, loads it into the right-side editor, and the audience runs it.

Nothing is written to the quad store. The panel is a read-only consumer of the graph plus an LLM bridge. It does not mutate state.

---

## 3. Layout

The component renders a single self-contained panel with an internal two-column top section and a separate result panel below it in the lab layout (handled by the notebook definition, not by this component).

```
┌──────────────────────────────────────────────────────────────────┐
│ sem-panel-bar--header  [label: "Natural Language → SPARQL"]      │
├────────────────────────────┬─────────────────────────────────────┤
│  LEFT COLUMN (50%)         │  RIGHT COLUMN (50%)                  │
│  ┌──────────────────────┐  │  ┌───────────────────────────────┐  │
│  │ API Key input        │  │  │                               │  │
│  │ [••••••••••••••] [✓] │  │  │  CodeMirror (SPARQL mode)     │  │
│  └──────────────────────┘  │  │                               │  │
│  ┌──────────────────────┐  │  │  (read from response,         │  │
│  │                      │  │  │   editable before Run)        │  │
│  │  CodeMirror          │  │  │                               │  │
│  │  (natural language   │  │  └───────────────────────────────┘  │
│  │   prompt, plain text │  │  ┌───────────────────────────────┐  │
│  │   mode)              │  │  │  sem-panel-bar--footer        │  │
│  │                      │  │  │  [error slot]   [Run →]       │  │
│  └──────────────────────┘  │  └───────────────────────────────┘  │
│  ┌──────────────────────┐  │                                      │
│  │  sem-panel-bar--footer│  │                                     │
│  │  [status/error]      │  │                                      │
│  │  [Translate →]       │  │                                      │
│  └──────────────────────┘  │                                      │
└────────────────────────────┴─────────────────────────────────────┘
```

The lab layout (notebook JSON-LD) positions a `sem-panel-sparql-result` panel below this one. The result panel is an independent component that already exists — it listens for `sparql:executed` events scoped to the lab.

---

## 4. UX Contract

### 4.1 API Key input

- Positioned in the left column header, consistent with the Fetch IRI input in `sem-panel-jsonld` (box above, button below, editor in middle).
- `type="password"` input. Value never leaves the component; never written to the quad store or any persistent storage.
- A small confirm indicator (checkmark or "saved" label) appears after the user tabs out or presses Enter — purely visual reassurance.
- Pre-populated from `sembook:initialContent` on the panel node if defined (allows a key to be embedded in the notebook definition for local dev — never in production notebooks).
- The API key is stored in `this._apiKey` (component-local state). This is not graph data — C7 does not apply.

### 4.2 NL Prompt editor (left, main area)

- CodeMirror instance, plain text mode (no syntax highlighting — the input is natural language).
- Placeholder text: `Ask a question about the data…`
- Pre-populated from `sembook:initialContent` if defined on the left panel node — this is how the "Translate" click-one-button demo state is achieved: the question is already in the box.
- Initial content follows the same `sembook:initialContent` / `findPanelNode` pattern as every other editor panel.

### 4.3 Translate button (left, footer)

- Label: `Translate →`
- Disabled when: API key is empty, or a translation is in flight.
- Loading state: button text changes to `Translating…`, button disabled.
- On success: generated SPARQL query is loaded into the right CodeMirror editor.
- On error: error message shown in the left panel's error slot (below the button or inline above it).

### 4.4 SPARQL editor (right, main area)

- CodeMirror instance, SPARQL mode — same `createEditor` factory as `sem-panel-sparql.js`.
- Populated by the Translate action. Empty on load.
- Editable — the audience can inspect and modify the generated query before running it. This is intentional: it demonstrates that the output is ordinary SPARQL, not magic.
- Placeholder text: `Generated SPARQL will appear here…`

### 4.5 Run button (right, footer)

- Label: `Run →`
- Disabled when the SPARQL editor is empty.
- Executes the query against the quad store via `this.notebook.executeSparql(this._labUri, sparql)`.
- On success: emits `sparql:executed` (see §6). The result panel below handles rendering.
- On error: shows error in the right panel's error slot.
- Does NOT disable during execution (consistent with `sem-panel-sparql` behavior).

---

## 5. Lifecycle

Follows C6 exactly. The component implements the standard contract:

```js
connectedCallback()        // render DOM structure, create both CodeMirror editors
init(notebook, notebookDoc) // store notebook context, populate initial content
disconnectedCallback()     // destroy both editor views
```

`init()` is called by `sem-lab` immediately after appending, before `connectedCallback` in some orderings. Both `_populateInitialContent` calls guard against `this._editorView === null` and apply content via `dispatch` if the view exists, or store it in `this._nlContent` / `this._sparqlContent` for `connectedCallback` to pick up — identical to the pattern in `sem-panel-sparql.js`.

---

## 6. Ontology Extraction

Before calling the API, the component serializes the full cumulative graph to Turtle:

```js
async _serializeOntology() {
  // All named graphs up to and including this lab (asserted + inferred)
  const graphs = this.notebook.graphsUpTo(this._labUri)
    .flatMap(g => [g, `${g}-inferred`]);

  // Collect quads from each named graph directly from the store
  const quads = graphs.flatMap(g =>
    this.notebook.store.getQuads(null, null, null, N3.DataFactory.namedNode(g))
  );

  // Gather accumulated prefixes across all labs up to this one
  const prefixes = {};
  for (const g of this.notebook.graphsUpTo(this._labUri)) {
    Object.assign(prefixes, this.notebook.getPrefixes(g));
  }

  // Serialize with N3.Writer (already vendored/available globally)
  return new Promise((resolve, reject) => {
    const writer = new N3.Writer({ prefixes, format: 'Turtle' });
    writer.addQuads(quads);
    writer.end((error, result) => error ? reject(error) : resolve(result));
  });
}
```

`N3` is available as a global (loaded via script tag in `index.html`) — no import needed, consistent with how `notebook-context.js` uses it.

---

## 7. API Integration

### 7.1 Call

```js
async _translate(nlQuery) {
  const ontologyTurtle = await this._serializeOntology();

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': this._apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-ipc': 'true',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: 'claude-opus-4-5',   // architect decision — see §7.3
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: nlQuery }]
    })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || `API error ${response.status}`);
  }

  const data = await response.json();
  return data.content?.[0]?.text?.trim() ?? '';
}
```

**Note on the CORS header:** Anthropic's direct browser API access requires `anthropic-dangerous-direct-browser-ipc: true`. This is a deliberate acknowledgment that the key is exposed in the browser — which is acceptable here because the key belongs to the instructor, is entered manually for this demo, and is never stored. The audience sees this header and can discuss key management as a teaching moment.

### 7.2 System Prompt

```js
const SYSTEM_PROMPT = (ontologyTurtle) => `
You are a SPARQL query generator. Given an RDF/OWL ontology and a natural-language question, return a valid SPARQL 1.1 SELECT query that answers the question using the vocabulary defined in the ontology.

Rules:
- Return ONLY the raw SPARQL query — no explanation, no markdown code fences, no preamble
- Use the exact class and property IRIs from the ontology
- Do NOT add GRAPH or FROM clauses — the query engine handles graph scoping automatically
- Prefer readable variable names (?customer, ?loan, ?maturityDate, etc.)
- Use LIMIT 100 unless the question explicitly implies otherwise
- If the ontology does not contain vocabulary sufficient to answer the question, return a SPARQL DESCRIBE query that retrieves everything available and include a single-line comment at the top: # NOTE: insufficient vocabulary for this query

Ontology (Turtle):
${ontologyTurtle}
`.trim();
```

The system prompt is constructed fresh on each Translate call so the ontology is always current.

### 7.3 Model

`claude-opus-4-5` is the spec default. **Architect decision required before implementation:** confirm model name or override. The model string should be a `sembook:` property on the panel node so it can be changed in the notebook JSON-LD without touching component code:

```
sembook:apiModel  "claude-opus-4-5"
```

Component reads it in `init()` from `notebookDoc`, falls back to `'claude-opus-4-5'` if absent.

---

## 8. Event Protocol

On successful Run, emits identically to `sem-panel-sparql`:

```js
this.notebook.emit('sparql:executed', {
  labUri: this._labUri,
  panelUri: this.uri,
  sparql,           // the SPARQL that was run
  ...result         // { resultType, bindings | quads | value }
});
```

This is a read-only event — no graph mutation occurs. The existing `sem-panel-sparql-result` component handles rendering without any changes.

C9 compliance: `labUri` is present on every emission.

---

## 9. Notebook JSON-LD Definition

### 9.1 New `sembook:` vocabulary

Two new terms required (to be added to `sembook.ttl`):

```turtle
sembook:Nl2SparqlPanel
  a owl:Class ;
  rdfs:subClassOf sembook:Panel ;
  rdfs:label "NL→SPARQL Panel" ;
  rdfs:comment "A panel that translates natural-language questions to SPARQL using an LLM." .

sembook:apiModel
  a owl:DatatypeProperty ;
  rdfs:domain sembook:Nl2SparqlPanel ;
  rdfs:range xsd:string ;
  rdfs:label "API model" ;
  rdfs:comment "The Anthropic model identifier to use for NL→SPARQL translation." .
```

`sembook:initialContent` is already defined and reused here for both the NL prompt and the API key.

### 9.2 Lab definition shape

```jsonld
{
  "@id": "https://sembook.example.org/fbt#magicland",
  "@type": "sembook:Lab",
  "sembook:label": "Welcome to Magicland",
  "sembook:cssClass": "grid grid-rows-[60vh_40vh] h-screen w-full",
  "sembook:panels": [
    {
      "@type": "sembook:Nl2SparqlPanel",
      "@id": "https://sembook.example.org/fbt#magicland-nl2sparql",
      "sembook:label": "Natural Language → SPARQL",
      "sembook:cssClass": "col-span-1 overflow-hidden",
      "sembook:apiModel": "claude-opus-4-5",
      "sembook:initialContent": "Show me all customers whose only loan product is a vehicle loan within 6 months of maturity."
    },
    {
      "@type": "sembook:SparqlResultPanel",
      "@id": "https://sembook.example.org/fbt#magicland-result",
      "sembook:label": "Results",
      "sembook:cssClass": "col-span-1 overflow-hidden"
    }
  ]
}
```

The `sembook:initialContent` on the NL2SPARQL panel is the pre-baked FBT money-shot question — the one that was typed into Phil's "what keeps you up at night" answer. One click on Translate. No dead air.

---

## 10. Constraint Validation

| # | Constraint | Status | Notes |
|---|---|---|---|
| C1 | Hypermedia-First | ✅ | Panel has IRI; navigable via lab |
| C2 | Resource Orientation | ✅ | `@id` on panel node |
| C3 | Semantic Format | ✅ | New type added to `sembook.ttl`; panel node is valid JSON-LD |
| C4 | No Invented Abstractions | ✅ | No custom protocol; reuses `sparql:executed` event, `findPanelNode` shared util, CodeMirror, N3.Writer |
| C5 | Local Execution | ✅ explicit exception | Core teaching ops are local. The Anthropic API call is the one documented escape hatch — the API key input is the explicit UX signal. C5 names this exact case: "except when demonstrating that specific capability." |
| C6 | Consistent Lifecycle | ✅ | `connectedCallback`, `init`, `disconnectedCallback` — both editor views destroyed in `disconnectedCallback` |
| C7 | Quad Store Authority | ✅ | Component never writes to the store. API key is not graph data. |
| C8 | Data Separation | ✅ | No graph writes; query scoping is handled by `executeSparql` |
| C9 | Events Scoped | ✅ | `sparql:executed` carries `labUri` |
| C10 | No Framework | ✅ | Native Web Component, no build step |
| C11 | Static First | ✅ | Only the API key changes the network behavior; all other state from static notebook JSON-LD |
| C12 | Scope Control | ✅ | This spec defines the scope. `sembook:apiModel` is the only new feature; deferred items below stay deferred. |
| C13 | SPARQL Config Surface | N/A | This panel generates SPARQL; it does not consume a `sparql` attribute. C13 governs visualization panels. The Run action uses `executeSparql` identically to `sem-panel-sparql` — that path is fully C13-compliant. |

---

## 11. Explicitly Deferred

The following are out of scope for this implementation task. Do not implement:

- **Streaming responses.** The API call blocks until complete. No streaming, no progressive rendering of the generated query.
- **Query history / undo.** No memory of previous translations within the session.
- **Model picker UI.** Model is set in the notebook JSON-LD definition only (`sembook:apiModel`).
- **Prompt template editor.** The system prompt is fixed in component code. Not user-configurable.
- **Token count / cost display.** The API response includes usage data — do not display it.
- **Persisting the API key.** No `localStorage`, no session storage. Key is lost on page reload by design.
- **Server-side key handling.** The key is entered in the browser for this demo context. A server-side proxy is a future concern (C11: backend agnostic).
- **CONSTRUCT / ASK / DESCRIBE result rendering.** The generated query is expected to be SELECT. If the LLM generates CONSTRUCT, `executeSparql` handles it; the result panel's rendering is a separate concern.
- **Multi-lab result correlation.** The result panel below picks up `sparql:executed` from any panel in the lab — this is correct and sufficient.

---

## 12. Implementation Task Handoff

When this spec is approved, the implementation task is:

1. Create `components/sem-panel-nl2sparql.js` per this spec
2. Add `sembook:Nl2SparqlPanel` and `sembook:apiModel` to `sembook.ttl`
3. Register the import in `index.html` (or in the notebook's `index.html`) alongside the other panel imports
4. Add `sem-panel-nl2sparql` to `sem-lab.js`'s component dispatch map (the block that maps `sembook:` types to custom element tags)
5. Verify against the constraint checklist above before submitting

The implementation begins with a design review against this spec (read it back, confirm understanding, flag questions) before writing any code.

---

*Generated: 2026-08-12 | Session: FBT Day 2 prep*
