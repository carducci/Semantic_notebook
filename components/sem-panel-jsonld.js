// jsonld.js and N3 are loaded globally via <script> tags in index.html — no module import needed.

function findPanelNode(panels, uri) {
  for (const p of panels || []) {
    if (p['@id'] === uri) return p;
    if (p['sembook:panels']) {
      const found = findPanelNode(p['sembook:panels'], uri);
      if (found) return found;
    }
  }
  return null;
}

// jsonld.js issues its own blank node labels (_:b0, _:b1, ...) starting fresh on every
// independent toRDF() call. Two fragments parsed separately (e.g. Document A and
// Document B) can both produce "_:b0" — and since their quads land in the same named
// graph, an unscoped label would silently merge two unrelated entities. Prefix every
// blank node with something derived from the fragment's own IRI so labels from
// different fragments can never collide once merged.
function scopeBlankNode(term, fragmentUri) {
  if (term.termType !== 'BlankNode') return term;
  const safePrefix = fragmentUri.split(/[/#]/).pop().replace(/[^A-Za-z0-9_-]/g, '');
  return N3.DataFactory.blankNode(`${safePrefix}-${term.value}`);
}

async function parseToQuads(jsonString, fragmentUri, labUri) {
  let doc;
  try {
    doc = JSON.parse(jsonString);
  } catch (e) {
    throw new Error(`Invalid JSON: ${e.message}`);
  }

  const hasContext = doc['@context'] && typeof doc['@context'] === 'object' && !Array.isArray(doc['@context']);

  if (!hasContext) {
    // Case 1 — no context at all: everything becomes a blank node with literal
    // properties under an implied vocabulary, so the audience sees *something*
    // in the graph even though it isn't semantically useful yet.
    doc = {
      '@context': { '@vocab': 'urn:sembook:implied:' },
      ...doc
    };
    // Map 'id' to '@id' if present — common convention
    if (doc.id !== undefined) {
      doc['@context']['id'] = '@id';
      // Make it a blank node if it looks like a plain string, not a URI
      if (!doc.id.startsWith('http') && !doc.id.startsWith('/')) {
        doc['@id'] = `_:${doc.id}`;
        delete doc.id;
      }
    }
  } else if (doc['@context']['@vocab'] === undefined) {
    // The user supplied their own context (e.g. mapping id -> @id) but didn't
    // define a vocabulary for the remaining plain keys. Without a fallback,
    // JSON-LD expansion silently drops any property it can't map to an IRI —
    // this is why triples vanish the moment a partial context is introduced.
    doc['@context']['@vocab'] = 'urn:sembook:implied:';
  }

  // Fallback base for relative @id values (e.g. "id": "441") when the user's
  // own context doesn't declare @base — automatically overridden by an
  // explicit @base in the document's context, per JSON-LD resolution rules.
  // This also means two documents that both omit @base still resolve a
  // shared bare id (e.g. "872") to the same IRI.
  const nquads = await jsonld.toRDF(doc, {
    format: 'application/n-quads',
    base: 'https://sembook.example.org/data/'
  });
  const parser = new N3.Parser({ format: 'N-Quads' });
  return parser.parse(nquads).map(q =>
    new N3.Quad(
      scopeBlankNode(q.subject, fragmentUri),
      q.predicate,
      scopeBlankNode(q.object, fragmentUri),
      N3.DataFactory.namedNode(labUri)
    )
  );
}

export class SemPanelJsonLd extends HTMLElement {
  connectedCallback() {
    this.notebook = null;
    this._render();
    this._bindEvents();
  }

  // Called by sem-lab immediately after appending this element — sem-lab already
  // holds the notebook context by the time it constructs panels (it only builds
  // children once notebook:ready has fired), so there is no event to listen for here.
  init(notebook, notebookDoc) {
    this.notebook = notebook;
    this._populateInitialContent(notebookDoc);
  }

  get uri() { return this.getAttribute('uri'); }
  get label() { return this.getAttribute('label'); }
  get labUri() { return this.closest('sem-lab')?.getAttribute('uri'); }

  _render() {
    this.innerHTML = `
      <div class="flex flex-col gap-2 px-3 py-2 border-b border-slate-200 bg-slate-50">
        <span class="text-sm font-medium text-slate-700">${this.label}</span>
        <div class="flex items-center gap-2">
          <input type="text" placeholder="IRI…"
            class="flex-1 min-w-0 text-xs font-mono border border-slate-300 rounded px-2 py-1"
            data-role="fetch-input" />
          <button class="shrink-0 text-xs px-2 py-1 rounded bg-slate-200 text-slate-700 hover:bg-slate-300"
            data-role="fetch-btn">Fetch</button>
        </div>
      </div>
      <textarea placeholder="// paste JSON or JSON-LD here"
        class="flex-1 w-full resize-none font-mono text-xs p-3 outline-none"
        data-role="editor"></textarea>
      <div data-role="error" class="hidden px-3 py-2 text-xs text-red-600 bg-red-50 border-t border-red-200"></div>
      <div class="flex items-center justify-end gap-2 px-3 py-2 border-t border-slate-200 bg-slate-50">
        <button class="text-xs px-3 py-1.5 rounded bg-emerald-600 text-white hover:bg-emerald-700"
          data-role="parse-btn">Parse</button>
      </div>
    `;
    this._textarea = this.querySelector('[data-role="editor"]');
    this._errorEl = this.querySelector('[data-role="error"]');
  }

  _bindEvents() {
    this.querySelector('[data-role="parse-btn"]')
      .addEventListener('click', () => this.onParse());
  }

  _populateInitialContent(notebookDoc) {
    const graph = notebookDoc['@graph'] || [];
    const lab = graph.find(n => n['@id'] === this.labUri);
    if (!lab) return;
    const panelNode = findPanelNode(lab['sembook:panels'], this.uri);
    const initialContent = panelNode?.['sembook:initialContent'];
    if (initialContent) this._textarea.value = initialContent;
  }

  _clearError() {
    this._errorEl.textContent = '';
    this._errorEl.classList.add('hidden');
  }

  _showError(message) {
    this._errorEl.textContent = message;
    this._errorEl.classList.remove('hidden');
  }

  async onParse() {
    const jsonString = this._textarea.value.trim();
    if (!jsonString) return;

    this._clearError();

    try {
      const quads = await parseToQuads(jsonString, this.uri, this.labUri);
      await this.notebook.upsertFragment(this.labUri, this.uri, quads);
    } catch (err) {
      this._showError(err.message);
    }
  }
}

customElements.define('sem-panel-jsonld', SemPanelJsonLd);
