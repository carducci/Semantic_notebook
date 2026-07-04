import { createEditor, findPanelNode, parseToQuads } from './jsonld-panel-shared.js';

export class SemPanelJsonLd extends HTMLElement {
  connectedCallback() {
    this.notebook = null;
    this._editorContent = '';
    this._editorView = null;
    this._render();
    this._bindEvents();
    this._editorView = createEditor(
      this._editorContainer,
      this._editorContent,
      (content) => { this._editorContent = content; }
    );
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
      <div class="sem-panel-bar sem-panel-bar--header flex flex-col gap-2">
        <span class="sem-panel-label">${this.label}</span>
        <div class="flex items-center gap-2">
          <input type="text" placeholder="IRI…"
            class="flex-1 min-w-0 ml-3.5 text-xs font-mono border border-slate-300 rounded px-2 py-1"
            data-role="fetch-input" />
          <button class="shrink-0 text-xs px-2 py-1 rounded bg-slate-200 text-slate-700 hover:bg-slate-300"
            data-role="fetch-btn">Fetch</button>
        </div>
        <div data-role="fetch-error" class="hidden text-xs text-red-600"></div>
      </div>
      <div style="flex:1;overflow:hidden;min-height:0;" data-role="editor"></div>
      <div data-role="error" class="hidden px-3 py-2 text-xs text-red-600 bg-red-50 border-t border-red-200"></div>
      <div class="sem-panel-bar sem-panel-bar--footer flex items-center justify-end gap-2">
        <button class="text-xs px-3 py-1.5 rounded bg-emerald-600 text-white hover:bg-emerald-700"
          data-role="parse-btn">Parse</button>
      </div>
    `;
    this._editorContainer = this.querySelector('[data-role="editor"]');
    this._errorEl = this.querySelector('[data-role="error"]');
    this._fetchInput = this.querySelector('[data-role="fetch-input"]');
    this._fetchButton = this.querySelector('[data-role="fetch-btn"]');
    this._fetchErrorEl = this.querySelector('[data-role="fetch-error"]');
  }

  _bindEvents() {
    this.querySelector('[data-role="parse-btn"]')
      .addEventListener('click', () => this.onParse());
    this._fetchButton.addEventListener('click', () => this.onFetch());
  }

  _populateInitialContent(notebookDoc) {
    const graph = notebookDoc['@graph'] || [];
    const lab = graph.find(n => n['@id'] === this.labUri);
    if (!lab) return;
    const panelNode = findPanelNode(lab['sembook:panels'], this.uri);
    const initialContent = panelNode?.['sembook:initialContent'];
    if (!initialContent) return;
    this._editorContent = initialContent;
    if (this._editorView) {
      this._editorView.dispatch({
        changes: {
          from: 0,
          to: this._editorView.state.doc.length,
          insert: initialContent
        }
      });
    }
  }

  _clearError() {
    this._errorEl.textContent = '';
    this._errorEl.classList.add('hidden');
  }

  _showError(message) {
    this._errorEl.textContent = message;
    this._errorEl.classList.remove('hidden');
  }

  _clearFetchError() {
    this._fetchErrorEl.textContent = '';
    this._fetchErrorEl.classList.add('hidden');
  }

  _showFetchError(message) {
    this._fetchErrorEl.textContent = message;
    this._fetchErrorEl.classList.remove('hidden');
  }

  _setFetchState(state) {
    const btn = this._fetchButton;
    if (state === 'loading') {
      btn.disabled = true;
      btn.textContent = 'Fetching…';
    } else {
      btn.disabled = false;
      btn.textContent = 'Fetch';
    }
  }

  async onFetch() {
    const url = this._fetchInput.value.trim();
    if (!url) return;

    this._setFetchState('loading');

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const text = await response.text();
      this._editorView.dispatch({
        changes: {
          from: 0,
          to: this._editorView.state.doc.length,
          insert: text
        }
      });
      this._editorContent = text;
      this._setFetchState('idle');
      this._clearFetchError();
    } catch (err) {
      this._setFetchState('idle');
      this._showFetchError(`Fetch failed: ${err.message}`);
    }
  }

  async onParse() {
    const jsonString = this._editorContent.trim();
    if (!jsonString) return;

    this._clearError();

    try {
      const { quads, prefixes } = await parseToQuads(jsonString, this.uri, this.labUri);
      await this.notebook.upsertFragment(this.labUri, this.uri, quads, prefixes);
    } catch (err) {
      this._showError(err.message);
    }
  }
}

customElements.define('sem-panel-jsonld', SemPanelJsonLd);
