// The NL→SPARQL panel — the "Magicland" reveal. The learner types a natural-language
// question on the left, this panel serializes the cumulative ontology (asserted +
// inferred, every lab up to and including this one) to Turtle, sends it with the
// question to the Anthropic Messages API, and loads the returned SPARQL SELECT into the
// editable right-hand editor. Run executes it against the quad store and hands the
// result to the companion sem-panel-sparql-result via a sparql:executed event — the same
// read-only, explicit-commit path sem-panel-sparql already uses. This panel never mutates
// the graph.
//
// The Anthropic API call is the single deliberate exception to local-only execution
// (ARCHITECTURAL_CONSTRAINTS C5, which names NL→SPARQL translation as the escape hatch):
// the API-key input is the explicit UX signal that a network call is happening.
//
// CodeMirror is vendored under /vendor/codemirror/ and resolved via the import map in the
// host page — same specifiers sem-panel-sparql.js / jsonld-panel-shared.js use, so every
// panel shares one CodeMirror instance (no duplicate-extension failure mode). N3 is a
// global (n3.min.js script tag) — no import needed, same as notebook-context.js.
import { EditorView, basicSetup } from 'codemirror';
import { StreamLanguage } from '@codemirror/language';
import { sparql as sparqlMode } from '@codemirror/legacy-modes/mode/sparql';
import { keymap, placeholder } from '@codemirror/view';
import { indentWithTab } from '@codemirror/commands';
import { findPanelNode } from './jsonld-panel-shared.js';

const DEFAULT_MODEL = 'claude-opus-4-5';

// Shared editor chrome — identical to sem-panel-sparql.js's theme so the two editors
// in this panel read as siblings of every other editor in the app.
const EDITOR_THEME = EditorView.theme({
  '&': {
    height: '100%',
    fontSize: '13px',
    fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace'
  },
  '.cm-scroller': { overflow: 'auto', lineHeight: '1.6' },
  '.cm-content': { padding: '8px 0' },
  '.cm-gutters': {
    backgroundColor: '#f8fafc',
    borderRight: '1px solid #e2e8f0',
    color: '#94a3b8',
    fontSize: '11px'
  },
  '.cm-activeLineGutter': { backgroundColor: '#cbd5e1' },
  // Translucent, not opaque — see sem-panel-turtle-writer.js for why an opaque
  // active-line background hides the selection layer underneath it.
  '.cm-activeLine': { backgroundColor: 'rgba(37, 99, 235, 0.15)' },
  '.cm-selectionBackground': { backgroundColor: '#93c5fd !important' },
  '&.cm-focused .cm-selectionBackground': { backgroundColor: '#60a5fa !important' },
  '.cm-content ::selection': { backgroundColor: '#93c5fd !important' }
});

// SPARQL editor (right column) — SPARQL syntax mode, same factory shape as
// sem-panel-sparql.js (that panel's createEditor is module-private, so it's inlined here
// rather than imported).
function createSparqlEditor(parent, initialContent, onChange) {
  return new EditorView({
    doc: initialContent,
    extensions: [
      basicSetup,
      StreamLanguage.define(sparqlMode),
      keymap.of([indentWithTab]),
      placeholder('Generated SPARQL will appear here…'),
      EDITOR_THEME,
      EditorView.updateListener.of(update => {
        if (update.docChanged) onChange(update.state.doc.toString());
      })
    ],
    parent
  });
}

// NL prompt editor (left column) — plain text, no syntax mode and no line-number gutter:
// the input is a natural-language question, not code, so it reads as prose (line-wrapped,
// placeholder-prompted) rather than a numbered listing.
function createNlEditor(parent, onChange) {
  return new EditorView({
    doc: '',
    extensions: [
      keymap.of([indentWithTab]),
      EditorView.lineWrapping,
      placeholder('Ask a question about the data…'),
      EDITOR_THEME,
      EditorView.updateListener.of(update => {
        if (update.docChanged) onChange(update.state.doc.toString());
      })
    ],
    parent
  });
}

const SYSTEM_PROMPT = (ontologyTurtle, today) => `
You translate a natural-language question into a single SPARQL 1.1 SELECT query over the ontology below.

TODAY'S DATE IS ${today}. Resolve EVERY relative time expression against it — do not assume any other "today":
- "in / within the next six months" → maturity/date from ${today} to six months after ${today}.
- "more than five years ago" / "banked with us 5+ years" → the date on or before five years before ${today}.
- Compute the actual calendar dates yourself and write them as "YYYY-MM-DD"^^xsd:date literals in FILTERs.

Output rules:
- Output ONLY the query — no prose, no explanation, no markdown code fences.
- Do NOT write PREFIX or BASE declarations — they are prepended for you automatically. Just use the prefixed names exactly as they appear in the ontology (e.g. ex:Customer, ncino:VehicleLoan, ex:heldBy).
- Do NOT add GRAPH or FROM clauses — scoping spans every named graph automatically.
- End with LIMIT 100 unless the question clearly implies otherwise.

How to model queries (the rdfs:comment on each term tells you what it means and how to use it — read them):
- The store is ALREADY reasoned: subclass and subproperty inference is materialized. So match the class you want directly — every Checking/Savings is already typed ex:Account, every loan is already typed mdm:Product, every Borrower is already typed ex:Customer. Do NOT use rdfs:subClassOf* / property paths to walk the hierarchy; just use the class.
- "Products a customer holds" (their whole relationship) = anything linked to the customer by ex:heldBy — loans AND deposit accounts both, via inference. Use mdm:Product when you mean "any product".
- Dates are xsd:date (e.g. "2027-01-15"^^xsd:date); money amounts are xsd:decimal.

If the ontology lacks the vocabulary to answer, return a DESCRIBE query for what's available with a leading comment: # NOTE: insufficient vocabulary

Ontology (Turtle):
${ontologyTurtle}
`.trim();

export class SemPanelNl2Sparql extends HTMLElement {
  constructor() {
    super();
    this.notebook = null;
    this._labUri = null;
    this._apiModel = DEFAULT_MODEL;

    this._nlEditor = null;
    this._sparqlEditor = null;
    this._nlContent = '';
    this._sparqlContent = '';
    this._apiKey = '';
    this._translating = false;
  }

  // Called by sem-lab immediately after appending this element (ADR-021). Reads the
  // panel's declared model; the NL prompt and API key are intentionally NOT seeded —
  // the reveal is typing the question live.
  init(notebook, notebookDoc) {
    this.notebook = notebook;
    this._labUri = this.closest('sem-lab')?.getAttribute('uri');
    this._apiModel = this._readApiModel(notebookDoc) || DEFAULT_MODEL;
  }

  get uri() { return this.getAttribute('uri'); }
  get label() { return this.getAttribute('label'); }
  get labUri() { return this._labUri; }

  _readApiModel(notebookDoc) {
    const graph = notebookDoc?.['@graph'] || [];
    const lab = graph.find(n => n['@id'] === this._labUri);
    if (!lab) return null;
    const panelNode = findPanelNode(lab['sembook:panels'], this.uri);
    return panelNode?.['sembook:apiModel'] || null;
  }

  connectedCallback() {
    this.style.cssText = 'display:flex;flex-direction:column;width:100%;height:100%;overflow:hidden;';

    this.innerHTML = `
      <div class="sem-panel-bar sem-panel-bar--header flex items-center">
        <span class="sem-panel-label">${this.label || 'Natural Language → SPARQL'}</span>
      </div>
      <div class="flex flex-1 min-h-0 overflow-hidden">
        <!-- LEFT: API key + natural-language prompt + Translate -->
        <div class="flex flex-col flex-1 min-w-0 border-r border-slate-300">
          <div class="flex items-center gap-2 px-3 py-2 border-b border-slate-200">
            <input type="password" autocomplete="off" spellcheck="false"
              placeholder="Anthropic API key…"
              class="flex-1 min-w-0 text-xs font-mono border border-slate-300 rounded px-2 py-1"
              data-role="api-key" />
            <span data-role="key-ok" class="hidden shrink-0 text-emerald-600 text-xs font-medium">✓ saved</span>
          </div>
          <div style="flex:1;overflow:hidden;min-height:0;" data-role="nl-editor"></div>
          <div data-role="nl-error" class="hidden px-3 py-2 text-xs text-red-600 bg-red-50 border-t border-red-200"></div>
          <div class="sem-panel-bar sem-panel-bar--footer flex items-center justify-end gap-2">
            <button data-role="translate-btn"
              class="text-xs px-3 py-1.5 rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed">Translate →</button>
          </div>
        </div>
        <!-- RIGHT: generated SPARQL + Run -->
        <div class="flex flex-col flex-1 min-w-0">
          <div style="flex:1;overflow:hidden;min-height:0;" data-role="sparql-editor"></div>
          <div data-role="sparql-error" class="hidden px-3 py-2 text-xs text-red-600 bg-red-50 border-t border-red-200"></div>
          <div class="sem-panel-bar sem-panel-bar--footer flex items-center justify-end gap-2">
            <button data-role="run-btn"
              class="text-xs px-3 py-1.5 rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed">Run →</button>
          </div>
        </div>
      </div>
    `;

    this._apiKeyInput = this.querySelector('[data-role="api-key"]');
    this._keyOk = this.querySelector('[data-role="key-ok"]');
    this._nlErrorEl = this.querySelector('[data-role="nl-error"]');
    this._sparqlErrorEl = this.querySelector('[data-role="sparql-error"]');
    this._translateBtn = this.querySelector('[data-role="translate-btn"]');
    this._runBtn = this.querySelector('[data-role="run-btn"]');

    this._nlEditor = createNlEditor(
      this.querySelector('[data-role="nl-editor"]'),
      (content) => { this._nlContent = content; this._syncButtons(); }
    );
    this._sparqlEditor = createSparqlEditor(
      this.querySelector('[data-role="sparql-editor"]'),
      '',
      (content) => { this._sparqlContent = content; this._syncButtons(); }
    );

    this._apiKeyInput.addEventListener('input', () => {
      this._apiKey = this._apiKeyInput.value;
      this._keyOk.classList.add('hidden');
      this._syncButtons();
    });
    // Visual reassurance only — the key is never stored anywhere but this._apiKey.
    const confirmKey = () => {
      if (this._apiKey.trim()) this._keyOk.classList.remove('hidden');
    };
    this._apiKeyInput.addEventListener('blur', confirmKey);
    this._apiKeyInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') confirmKey(); });

    this._translateBtn.addEventListener('click', () => this.onTranslate());
    this._runBtn.addEventListener('click', () => this.onRun());

    this._syncButtons();
  }

  disconnectedCallback() {
    this._nlEditor?.destroy();
    this._nlEditor = null;
    this._sparqlEditor?.destroy();
    this._sparqlEditor = null;
  }

  _syncButtons() {
    if (this._translateBtn) {
      this._translateBtn.disabled =
        this._translating || !this._apiKey.trim() || !this._nlContent.trim();
    }
    if (this._runBtn) {
      this._runBtn.disabled = !this._sparqlContent.trim();
    }
  }

  _setTranslating(on) {
    this._translating = on;
    this._translateBtn.textContent = on ? 'Translating…' : 'Translate →';
    this._syncButtons();
  }

  _setSparql(text) {
    this._sparqlContent = text;
    this._sparqlEditor.dispatch({
      changes: { from: 0, to: this._sparqlEditor.state.doc.length, insert: text }
    });
    this._syncButtons();
  }

  _clearError(which) {
    const el = which === 'sparql' ? this._sparqlErrorEl : this._nlErrorEl;
    el.textContent = '';
    el.classList.add('hidden');
  }

  _showError(which, message) {
    const el = which === 'sparql' ? this._sparqlErrorEl : this._nlErrorEl;
    el.textContent = message;
    el.classList.remove('hidden');
  }

  // Serialize the cumulative graph (asserted + inferred, every lab up to and including
  // this one) to Turtle for the LLM. Mirrors executeSparql's own scope so the model
  // reasons over exactly the graph the generated query will run against. Falls back to
  // [labUri] if lab order isn't loaded yet — same guard _materialize uses.
  async _serializeOntology() {
    const labs = this.notebook.graphsUpTo(this._labUri);
    const scope = labs.length > 0 ? labs : [this._labUri];
    const graphs = scope.flatMap(g => [g, `${g}-inferred`]);
    const quads = graphs.flatMap(g =>
      this.notebook.store.getQuads(null, null, null, N3.DataFactory.namedNode(g))
    );
    const prefixes = {};
    for (const g of scope) Object.assign(prefixes, this.notebook.getPrefixes(g));

    const turtle = await new Promise((resolve, reject) => {
      const writer = new N3.Writer({ prefixes, format: 'Turtle' });
      writer.addQuads(quads);
      writer.end((error, result) => (error ? reject(error) : resolve(result)));
    });
    return { turtle, prefixes };
  }

  // The PREFIX header prepended to every generated query, so the model never has to write
  // one (and can't get it wrong). Standard vocabularies plus whatever the notebook
  // registered from its own data (ex:, ncino:, mdm:, …).
  _prefixBlock(prefixes) {
    const merged = {
      rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
      rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
      owl: 'http://www.w3.org/2002/07/owl#',
      xsd: 'http://www.w3.org/2001/XMLSchema#',
      ...prefixes
    };
    return Object.entries(merged)
      .filter(([p, iri]) => p && !p.startsWith('@') && typeof iri === 'string')
      .map(([p, iri]) => `PREFIX ${p}: <${iri}>`)
      .join('\n');
  }

  // Strip markdown fences and any PREFIX/BASE the model added (we supply our own header),
  // leaving just the query body.
  _cleanSparql(raw) {
    return (raw || '')
      .trim()
      .replace(/^```(?:sparql)?\s*/i, '')
      .replace(/\s*```$/, '')
      .replace(/^\s*(?:(?:PREFIX\s+[^\s:]*:\s*<[^>]*>|BASE\s*<[^>]*>)\s*)+/i, '')
      .trim();
  }

  async _translate(nlQuery) {
    const { turtle, prefixes } = await this._serializeOntology();
    // The model has no reliable notion of "now" (its training cutoff, not the demo date),
    // so relative time expressions ("next six months", "5+ years") anchor to the wrong
    // year. Hand it today's date explicitly.
    const today = new Date().toISOString().slice(0, 10);

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': this._apiKey,
        'anthropic-version': '2023-06-01',
        // The documented CORS opt-in for calling the Messages API directly from browser
        // JS. The key is exposed in the browser as a result — acceptable here: it's the
        // instructor's key, entered manually for this demo, never stored (C5's escape
        // hatch, discussed openly with the audience).
        'anthropic-dangerous-direct-browser-access': 'true',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: this._apiModel,
        max_tokens: 1024,
        system: SYSTEM_PROMPT(turtle, today),
        messages: [{ role: 'user', content: nlQuery }]
      })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err?.error?.message || `API error ${response.status}`);
    }

    const data = await response.json();
    // Always prepend our own PREFIX header (the model is told not to write one) and drop
    // any fences/prefixes it added anyway — guarantees a runnable, self-contained query.
    const body = this._cleanSparql(data.content?.[0]?.text ?? '');
    return `${this._prefixBlock(prefixes)}\n\n${body}`;
  }

  async onTranslate() {
    const nlQuery = this._nlContent.trim();
    if (!nlQuery || !this._apiKey.trim() || this._translating) return;

    this._clearError('nl');
    this._setTranslating(true);
    try {
      const sparql = await this._translate(nlQuery);
      this._setSparql(sparql);
    } catch (err) {
      this._showError('nl', err.message);
    } finally {
      this._setTranslating(false);
    }
  }

  // Identical read-only execution path to sem-panel-sparql: no explicit GRAPH/FROM in the
  // generated query, so executeSparql scopes it to the cumulative asserted+inferred graph.
  // The companion sem-panel-sparql-result renders the sparql:executed emission unchanged.
  async onRun() {
    const sparql = this._sparqlContent.trim();
    if (!sparql) return;

    this._clearError('sparql');
    try {
      const result = await this.notebook.executeSparql(this._labUri, sparql);
      this.notebook.emit('sparql:executed', {
        labUri: this._labUri,
        panelUri: this.uri,
        sparql,
        ...result
      });
    } catch (err) {
      this._showError('sparql', err.message);
    }
  }
}

customElements.define('sem-panel-nl2sparql', SemPanelNl2Sparql);
