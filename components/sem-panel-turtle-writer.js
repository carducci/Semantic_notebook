// CodeMirror and its dependency graph are vendored locally under /vendor/codemirror/
// and resolved via the import map in index.html — see that directory for exact
// versions. This panel isn't wired into a lab yet (next iteration), but importing
// it the same way as sem-panel-jsonld.js/sem-panel-turtle.js now means it won't
// reintroduce the esm.sh single-point-of-failure the moment it is.
import { EditorView, basicSetup } from 'codemirror';
import { editorTheme, turtleLanguage } from './editor-theme.js';
import { keymap } from '@codemirror/view';
import { indentWithTab } from '@codemirror/commands';
import { findPanelNode } from './jsonld-panel-shared.js';

// N3 is loaded globally via <script src=".../n3.min.js"> in index.html — no module import needed.

function createEditor(parent, initialContent, onChange) {
  const view = new EditorView({
    doc: initialContent,
    extensions: [
      basicSetup,
      turtleLanguage,
      keymap.of([indentWithTab]),
      ...editorTheme(),
      EditorView.updateListener.of(update => {
        if (update.docChanged) {
          onChange(view.state.doc.toString());
        }
      })
    ],
    parent
  });
  return view;
}

// N3.js issues its own blank node labels afresh on every independent parse — see
// scopeBlankNode in sem-panel-jsonld.js for why two fragments landing in the same
// named graph need their blank nodes scoped to the fragment they came from.
function scopeBlankNode(term, fragmentUri) {
  if (term.termType !== 'BlankNode') return term;
  const safePrefix = fragmentUri.split(/[/#]/).pop().replace(/[^A-Za-z0-9_-]/g, '');
  return N3.DataFactory.blankNode(`${safePrefix}-${term.value}`);
}

async function parseTurtleToQuads(turtleString, fragmentUri, labUri) {
  return new Promise((resolve, reject) => {
    const parser = new N3.Parser();
    const quads = [];

    parser.parse(turtleString, (err, quad, prefixes) => {
      if (err) {
        reject(new Error(`Turtle parse error: ${err.message}`));
        return;
      }
      if (quad) {
        quads.push(
          N3.DataFactory.quad(
            scopeBlankNode(quad.subject, fragmentUri),
            quad.predicate,
            scopeBlankNode(quad.object, fragmentUri),
            N3.DataFactory.namedNode(labUri)
          )
        );
      } else {
        // Done — prefixes (third callback arg) are only populated on this final call.
        resolve({ quads, prefixes: prefixes || {} });
      }
    });
  });
}

export class SemPanelTurtleWriter extends HTMLElement {
  constructor() {
    super();
    this._editorView = null;
    this._editorContent = '';
    this.notebook = null;
    this._labUri = null;
  }

  // Called by sem-lab immediately after appending this element — matches the
  // init() timing sem-panel-jsonld relies on (see ADR-021).
  init(notebook, notebookDoc) {
    this.notebook = notebook;
    this._labUri = this.closest('sem-lab')?.getAttribute('uri');
    this._populateInitialContent(notebookDoc);
  }

  get uri() { return this.getAttribute('uri'); }
  get label() { return this.getAttribute('label'); }

  connectedCallback() {
    this.style.cssText = 'display:flex;flex-direction:column;width:100%;height:100%;overflow:hidden;';

    this.innerHTML = `
      <div class="sem-panel-bar sem-panel-bar--header flex flex-col gap-2">
        <span class="sem-panel-label">${this.label || 'Turtle'}</span>
        <div class="flex items-center gap-2">
          <input type="text" placeholder="IRI…"
            class="flex-1 min-w-0 ml-3.5 sem-input"
            data-role="fetch-input" />
          <button class="shrink-0 sem-btn"
            data-role="fetch-btn">Fetch</button>
        </div>
        <div data-role="fetch-error" class="hidden sem-error sem-error--inline"></div>
      </div>
      <div style="flex:1;overflow:hidden;min-height:0;" data-role="editor"></div>
      <div data-role="error" class="hidden sem-error"></div>
      <div class="sem-panel-bar sem-panel-bar--footer flex items-center justify-end gap-2">
        <button class="sem-btn sem-btn--primary"
          data-role="parse-btn">Parse</button>
      </div>
    `;

    this._editorContainer = this.querySelector('[data-role="editor"]');
    this._errorEl = this.querySelector('[data-role="error"]');
    this._fetchInput = this.querySelector('[data-role="fetch-input"]');
    this._fetchButton = this.querySelector('[data-role="fetch-btn"]');
    this._fetchErrorEl = this.querySelector('[data-role="fetch-error"]');
    this.querySelector('[data-role="parse-btn"]').addEventListener('click', () => this.onParse());
    this._fetchButton.addEventListener('click', () => this.onFetch());

    this._editorView = createEditor(
      this._editorContainer,
      this._editorContent || '# Write Turtle here\n',
      (content) => { this._editorContent = content; }
    );
  }

  // Reads sembook:initialContent from the lab's panel definition — same
  // property/lookup sem-panel-jsonld uses, so authoring a Turtle Writer panel
  // in the notebook JSON-LD feels identical to authoring a JSON-LD panel.
  _populateInitialContent(notebookDoc) {
    const graph = notebookDoc?.['@graph'] || [];
    const lab = graph.find(n => n['@id'] === this._labUri);
    if (!lab) return;
    const panelNode = findPanelNode(lab['sembook:panels'], this.uri);
    // Same sembook:fetchUrl seeding as sem-panel-jsonld — input pre-filled,
    // fetch and Parse each remain deliberate clicks (ADR-019).
    const fetchUrl = panelNode?.['sembook:fetchUrl'];
    if (fetchUrl && this._fetchInput) this._fetchInput.value = fetchUrl;
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
    const turtleString = this._editorContent.trim();
    if (!turtleString) return;

    this._clearError();

    try {
      const { quads, prefixes } = await parseTurtleToQuads(turtleString, this.uri, this._labUri);
      await this.notebook.upsertFragment(this._labUri, this.uri, quads, prefixes);
    } catch (err) {
      this._showError(err.message);
    }
  }

  disconnectedCallback() {
    this._editorView?.destroy();
    this._editorView = null;
  }
}

customElements.define('sem-panel-turtle-writer', SemPanelTurtleWriter);
