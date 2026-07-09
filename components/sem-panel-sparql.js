// CodeMirror and its dependency graph are vendored locally under /vendor/codemirror/
// and resolved via the import map in index.html — see that directory for exact
// versions. Same vendoring rationale as sem-panel-turtle.js/turtle-writer.js (ADR-006).
import { EditorView, basicSetup } from 'codemirror';
import { StreamLanguage } from '@codemirror/language';
import { sparql as sparqlMode } from '@codemirror/legacy-modes/mode/sparql';
import { keymap } from '@codemirror/view';
import { indentWithTab } from '@codemirror/commands';
import { findPanelNode } from './jsonld-panel-shared.js';

function createEditor(parent, initialContent, onChange) {
  const view = new EditorView({
    doc: initialContent,
    extensions: [
      basicSetup,
      StreamLanguage.define(sparqlMode),
      keymap.of([indentWithTab]),
      EditorView.theme({
        '&': {
          height: '100%',
          fontSize: '13px',
          fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace'
        },
        '.cm-scroller': {
          overflow: 'auto',
          lineHeight: '1.6'
        },
        '.cm-content': {
          padding: '8px 0'
        },
        '.cm-gutters': {
          backgroundColor: '#f8fafc',
          borderRight: '1px solid #e2e8f0',
          color: '#94a3b8',
          fontSize: '11px'
        },
        '.cm-activeLineGutter': {
          backgroundColor: '#cbd5e1'
        },
        // See sem-panel-turtle-writer.js for why this must be translucent, not opaque.
        '.cm-activeLine': {
          backgroundColor: 'rgba(37, 99, 235, 0.15)'
        },
        '.cm-selectionBackground': {
          backgroundColor: '#93c5fd !important'
        },
        '&.cm-focused .cm-selectionBackground': {
          backgroundColor: '#60a5fa !important'
        },
        '.cm-content ::selection': {
          backgroundColor: '#93c5fd !important'
        }
      }),
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

export class SemPanelSparql extends HTMLElement {
  constructor() {
    super();
    this._editorView = null;
    this._editorContent = '';
    this.notebook = null;
    this._labUri = null;
    this._sampleQueries = [];
  }

  // Called by sem-lab immediately after appending this element (ADR-021).
  init(notebook, notebookDoc) {
    this.notebook = notebook;
    this._labUri = this.closest('sem-lab')?.getAttribute('uri');
    this._populateInitialContent(notebookDoc);
    this._populateSampleQueries(notebookDoc);
  }

  get uri() { return this.getAttribute('uri'); }
  get label() { return this.getAttribute('label'); }
  get labUri() { return this._labUri; }

  connectedCallback() {
    this.style.cssText = 'display:flex;flex-direction:column;width:100%;height:100%;overflow:hidden;';

    this.innerHTML = `
      <div class="sem-panel-bar sem-panel-bar--header flex flex-col gap-2">
        <span class="sem-panel-label">${this.label || 'SPARQL'}</span>
        <div class="flex items-center gap-2">
          <select
            class="flex-1 min-w-0 ml-3.5 text-xs font-mono border border-slate-300 rounded px-2 py-1 bg-white"
            data-role="sample-select">
            <option value="" selected disabled>Sample queries…</option>
          </select>
        </div>
      </div>
      <div style="flex:1;overflow:hidden;min-height:0;" data-role="editor"></div>
      <div data-role="error" class="hidden px-3 py-2 text-xs text-red-600 bg-red-50 border-t border-red-200"></div>
      <div class="sem-panel-bar sem-panel-bar--footer flex items-center justify-end gap-2">
        <button class="text-xs px-3 py-1.5 rounded bg-emerald-600 text-white hover:bg-emerald-700"
          data-role="run-btn">Run</button>
      </div>
    `;

    this._editorContainer = this.querySelector('[data-role="editor"]');
    this._errorEl = this.querySelector('[data-role="error"]');
    this._sampleSelect = this.querySelector('[data-role="sample-select"]');
    this.querySelector('[data-role="run-btn"]').addEventListener('click', () => this.onRun());
    this._sampleSelect.addEventListener('change', () => this.onSampleSelected());

    this._editorView = createEditor(
      this._editorContainer,
      this._editorContent || '# Write SPARQL here — no GRAPH/FROM clause implicitly\n# scopes to everything you\'ve built so far, reasoning included\nSELECT * WHERE {\n  ?s ?p ?o\n}\n',
      (content) => { this._editorContent = content; }
    );

    this._renderSampleOptions();
  }

  // Reads sembook:initialContent from the lab's panel definition — same
  // property/lookup sem-panel-jsonld/turtle-writer use.
  _populateInitialContent(notebookDoc) {
    const graph = notebookDoc?.['@graph'] || [];
    const lab = graph.find(n => n['@id'] === this._labUri);
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

  // Reads sembook:sampleQueries from the panel's own definition — the notebook-JSON-LD-
  // declared UI slot other editor panels use for Fetch-by-IRI. Each entry is a
  // sembook:SampleQuery node ({ sembook:label, sembook:sparql }); stored here rather
  // than re-read on every selection since the dropdown is rebuilt from this array.
  _populateSampleQueries(notebookDoc) {
    const graph = notebookDoc?.['@graph'] || [];
    const lab = graph.find(n => n['@id'] === this._labUri);
    if (!lab) return;
    const panelNode = findPanelNode(lab['sembook:panels'], this.uri);
    const samples = panelNode?.['sembook:sampleQueries'];
    if (!Array.isArray(samples)) return;
    this._sampleQueries = samples.map(s => ({
      label: s['sembook:label'] || '(untitled query)',
      sparql: s['sembook:sparql'] || ''
    }));
    this._renderSampleOptions();
  }

  _renderSampleOptions() {
    if (!this._sampleSelect) return;
    // Rebuild every time (init() and connectedCallback race depending on order) —
    // keep the placeholder, drop any previously-added entries.
    this._sampleSelect.querySelectorAll('option[data-sample-index]').forEach(o => o.remove());
    this._sampleQueries.forEach((sample, i) => {
      const opt = document.createElement('option');
      opt.value = String(i);
      opt.dataset.sampleIndex = String(i);
      opt.textContent = sample.label;
      this._sampleSelect.appendChild(opt);
    });
  }

  // Loads the selected sample's query text into the editor verbatim — does not
  // execute it. Whether the query ends up implicit- or explicit-scoped is entirely
  // up to what the sample's own text contains; this panel never rewrites it.
  onSampleSelected() {
    const idx = this._sampleSelect.value;
    const sample = this._sampleQueries[Number(idx)];
    if (!sample) return;
    this._editorContent = sample.sparql;
    this._editorView.dispatch({
      changes: {
        from: 0,
        to: this._editorView.state.doc.length,
        insert: sample.sparql
      }
    });
  }

  _clearError() {
    this._errorEl.textContent = '';
    this._errorEl.classList.add('hidden');
  }

  _showError(message) {
    this._errorEl.textContent = message;
    this._errorEl.classList.remove('hidden');
  }

  async onRun() {
    const sparql = this._editorContent.trim();
    if (!sparql) return;

    this._clearError();

    try {
      const result = await this.notebook.executeSparql(this._labUri, sparql);
      this.notebook.emit('sparql:executed', {
        labUri: this._labUri,
        panelUri: this.uri,
        sparql,
        ...result
      });
    } catch (err) {
      this._showError(err.message);
    }
  }

  disconnectedCallback() {
    this._editorView?.destroy();
    this._editorView = null;
  }
}

customElements.define('sem-panel-sparql', SemPanelSparql);
