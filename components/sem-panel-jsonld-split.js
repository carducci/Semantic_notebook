// A full-width JSON-LD panel with two side-by-side editors — the JSON body
// (left, ~65%) and its @context (right, ~35%) — sharing a single Parse button.
// The teaching point this panel exists for: the @context is data too, and
// editing it separately from the body makes that visible. Combine + parse
// pipeline reuses the exact same parseToQuads/upsertFragment path as the
// single-editor panel (sem-panel-jsonld.js) via jsonld-panel-shared.js.

import { createEditor, findPanelNode, parseToQuads } from './jsonld-panel-shared.js';

export class SemPanelJsonLdSplit extends HTMLElement {
  connectedCallback() {
    this.notebook = null;
    this._bodyContent = '';
    this._contextContent = '';
    this._bodyEditorView = null;
    this._contextEditorView = null;
    this._render();
    this._bindEvents();
    this._bodyEditorView = createEditor(
      this._bodyEditorContainer,
      this._bodyContent,
      (content) => { this._bodyContent = content; }
    );
    this._contextEditorView = createEditor(
      this._contextEditorContainer,
      this._contextContent,
      (content) => { this._contextContent = content; }
    );
  }

  // Called by sem-lab immediately after appending this element — same contract
  // as SemPanelJsonLd.init.
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
      <div style="flex:1;display:grid;grid-template-columns:65fr 35fr;overflow:hidden;min-height:0;">
        <div style="display:flex;flex-direction:column;overflow:hidden;min-height:0;border-right:1px solid #e2e8f0;">
          <div class="px-3 py-1 text-xs font-medium text-slate-500 bg-slate-50 border-b border-slate-200">Body</div>
          <div style="flex:1;overflow:hidden;min-height:0;" data-role="body-editor"></div>
          <div data-role="body-error" class="hidden px-3 py-2 text-xs text-red-600 bg-red-50 border-t border-red-200"></div>
        </div>
        <div style="display:flex;flex-direction:column;overflow:hidden;min-height:0;">
          <div class="px-3 py-1 text-xs font-medium text-slate-500 bg-slate-50 border-b border-slate-200">@context</div>
          <div style="flex:1;overflow:hidden;min-height:0;" data-role="context-editor"></div>
          <div data-role="context-error" class="hidden px-3 py-2 text-xs text-red-600 bg-red-50 border-t border-red-200"></div>
        </div>
      </div>
      <div data-role="error" class="hidden px-3 py-2 text-xs text-red-600 bg-red-50 border-t border-red-200"></div>
      <div class="sem-panel-bar sem-panel-bar--footer flex items-center justify-end gap-2">
        <button class="text-xs px-3 py-1.5 rounded bg-emerald-600 text-white hover:bg-emerald-700"
          data-role="parse-btn">Parse</button>
      </div>
    `;
    this._bodyEditorContainer = this.querySelector('[data-role="body-editor"]');
    this._contextEditorContainer = this.querySelector('[data-role="context-editor"]');
    this._bodyErrorEl = this.querySelector('[data-role="body-error"]');
    this._contextErrorEl = this.querySelector('[data-role="context-error"]');
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
    if (!panelNode) return;

    // Same sembook:fetchUrl seeding as sem-panel-jsonld — input pre-filled,
    // fetch and Parse each remain deliberate clicks (ADR-019).
    const fetchUrl = panelNode['sembook:fetchUrl'];
    if (fetchUrl && this._fetchInput) this._fetchInput.value = fetchUrl;

    const initialContent = panelNode['sembook:initialContent'];
    if (initialContent) {
      this._bodyContent = initialContent;
      this._bodyEditorView?.dispatch({
        changes: { from: 0, to: this._bodyEditorView.state.doc.length, insert: initialContent }
      });
    }

    const initialContext = panelNode['sembook:initialContext'];
    if (initialContext) {
      this._contextContent = initialContext;
      this._contextEditorView?.dispatch({
        changes: { from: 0, to: this._contextEditorView.state.doc.length, insert: initialContext }
      });
    }
  }

  _clearErrors() {
    for (const el of [this._bodyErrorEl, this._contextErrorEl, this._errorEl]) {
      el.textContent = '';
      el.classList.add('hidden');
    }
  }

  _showBodyError(message) {
    this._bodyErrorEl.textContent = message;
    this._bodyErrorEl.classList.remove('hidden');
  }

  _showContextError(message) {
    this._contextErrorEl.textContent = message;
    this._contextErrorEl.classList.remove('hidden');
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

  // Fetch-by-URL applies to the body editor only — the @context is authored
  // inline, not fetched, matching how this panel was scoped.
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
      this._bodyEditorView.dispatch({
        changes: { from: 0, to: this._bodyEditorView.state.doc.length, insert: text }
      });
      this._bodyContent = text;
      this._setFetchState('idle');
      this._clearFetchError();
    } catch (err) {
      this._setFetchState('idle');
      this._showFetchError(`Fetch failed: ${err.message}`);
    }
  }

  async onParse() {
    const bodyText = this._bodyContent.trim();
    if (!bodyText) return;

    this._clearErrors();

    let bodyJson;
    try {
      bodyJson = JSON.parse(bodyText);
    } catch (e) {
      this._showBodyError(`Invalid JSON: ${e.message}`);
      return;
    }

    if (bodyJson['@context'] !== undefined) {
      this._showBodyError('@context belongs in the context editor, not the body.');
      return;
    }

    const contextText = this._contextContent.trim();
    let contextValue;
    if (contextText) {
      let contextDoc;
      try {
        contextDoc = JSON.parse(contextText);
      } catch (e) {
        this._showContextError(`Invalid JSON: ${e.message}`);
        return;
      }
      if (contextDoc['@context'] === undefined) {
        this._showContextError('Expected a top-level "@context" key.');
        return;
      }
      contextValue = contextDoc['@context'];
    }

    const combined = contextValue !== undefined
      ? { '@context': contextValue, ...bodyJson }
      : { ...bodyJson };

    try {
      const { quads, prefixes } = await parseToQuads(JSON.stringify(combined), this.uri, this.labUri);
      await this.notebook.upsertFragment(this.labUri, this.uri, quads, prefixes);
    } catch (err) {
      this._showError(err.message);
    }
  }
}

customElements.define('sem-panel-jsonld-split', SemPanelJsonLdSplit);
