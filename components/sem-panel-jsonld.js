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

async function parseToQuads(jsonString, fragmentUri, labUri) {
  let doc;
  try {
    doc = JSON.parse(jsonString);
  } catch (e) {
    throw new Error(`Invalid JSON: ${e.message}`);
  }

  // If no @context, inject a minimal one that maps plain JSON
  // to blank nodes with literal properties
  if (!doc['@context']) {
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
  }

  const nquads = await jsonld.toRDF(doc, { format: 'application/n-quads' });
  const parser = new N3.Parser({ format: 'N-Quads' });
  return parser.parse(nquads).map(q =>
    new N3.Quad(q.subject, q.predicate, q.object, N3.DataFactory.namedNode(labUri))
  );
}

export class SemPanelJsonLd extends HTMLElement {
  connectedCallback() {
    this.notebook = null;
    this._render();
    this._bindEvents();

    this._onNotebookReady = (e) => {
      this.notebook = e.detail.notebook;
      this._populateInitialContent(e.detail.notebookDoc);
    };
    document.addEventListener('notebook:ready', this._onNotebookReady);
  }

  disconnectedCallback() {
    document.removeEventListener('notebook:ready', this._onNotebookReady);
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
