// CodeMirror and its dependency graph are vendored locally under /vendor/codemirror/
// and resolved via the import map in index.html (same vendored files sem-panel-jsonld.js
// resolves to, so there's a single shared @codemirror/state instance — no risk of the
// duplicate-bundle "Unrecognized extension value" / mismatched-tag-identity failure
// modes an on-the-fly CDN bundler like esm.sh could produce).
import { EditorView, basicSetup } from 'codemirror';
import { StreamLanguage } from '@codemirror/language';
import { turtle } from '@codemirror/legacy-modes/mode/turtle';

// N3 is loaded globally via <script src=".../n3.min.js"> in index.html — no module import needed.

export function createTurtleViewer(parent, content) {
  return new EditorView({
    doc: content,
    extensions: [
      basicSetup,
      StreamLanguage.define(turtle),
      EditorView.editable.of(false),   // read-only
      EditorView.theme({
        '&': {
          height: '100%',
          fontSize: '13px',
          fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace',
          backgroundColor: '#fafafa'   // subtle distinction from editable panels
        },
        '.cm-scroller': {
          overflow: 'auto',
          lineHeight: '1.6'
        },
        '.cm-content': {
          padding: '8px 0',
          caretColor: 'transparent'    // no cursor in read-only
        },
        '.cm-gutters': {
          backgroundColor: '#f1f5f9',
          borderRight: '1px solid #e2e8f0',
          color: '#94a3b8',
          fontSize: '11px'
        },
        '.cm-activeLineGutter': {
          backgroundColor: '#cbd5e1'
        },
        // Per CodeMirror's own guidance (opaque line-decoration backgrounds
        // "never worked" — https://discuss.codemirror.net/t/various-themes-activeline-selections-not-visible/7473):
        // decoration backgrounds must be translucent, or they paint over and
        // hide layers rendered underneath them, like the selection layer. An
        // opaque activeLine background made text selected on the active line
        // invisible even though it was technically still selected/copyable.
        '.cm-activeLine': {
          backgroundColor: 'rgba(37, 99, 235, 0.15)'
        },
        // CodeMirror's own selection layer has no default styling here, so it
        // inherits whatever the browser's dark-mode remapping does to its
        // near-transparent default — pin it to an explicit, solid, saturated
        // color instead (this viewer is read-only but still selectable/copyable).
        // !important because drawSelection's generated rule has matching
        // specificity and can load after this theme.
        '.cm-selectionBackground': {
          backgroundColor: '#93c5fd !important'
        },
        '&.cm-focused .cm-selectionBackground': {
          backgroundColor: '#60a5fa !important'
        },
        '.cm-content ::selection': {
          backgroundColor: '#93c5fd !important'
        }
      })
    ],
    parent
  });
}

async function graphToTurtle(notebook, sparql, labUri) {
  const bindings = await notebook.query(sparql);
  const prefixes = notebook.getPrefixes(labUri);

  return new Promise((resolve, reject) => {
    const writer = new N3.Writer({ prefixes });

    for (const binding of bindings) {
      const s = binding.get('s');
      const p = binding.get('p');
      const o = binding.get('o');
      if (s && p && o) {
        writer.addQuad(
          N3.DataFactory.quad(s, p, o)
        );
      }
    }

    writer.end((err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}

export class SemPanelTurtle extends HTMLElement {
  constructor() {
    super();
    this._editorView = null;
    this.notebook = null;
    this._labUri = null;
  }

  init(notebook, notebookDoc) {
    this.notebook = notebook;
    this._labUri = this.closest('sem-lab')?.getAttribute('uri');
  }

  connectedCallback() {
    this.style.cssText = 'display:flex;flex-direction:column;width:100%;height:100%;overflow:hidden;';

    // Panel header — shares sem-panel-bar/sem-panel-label classes with JsonLdPanel
    // so the two editors sit under equal-height bars (tops align) with matching type.
    const header = document.createElement('div');
    // items-start (not items-center) — JsonLdPanel's label sits at the top of its
    // header bar (the fetch row fills the space below it), so Turtle's label must
    // anchor to the same top edge rather than centering in the taller shared bar.
    header.className = 'sem-panel-bar sem-panel-bar--header flex items-start';
    header.innerHTML = `
      <span class="sem-panel-label">${this.getAttribute('label') || 'Turtle'}</span>
    `;

    // Editor container
    const editorContainer = document.createElement('div');
    editorContainer.style.cssText = 'flex:1;overflow:hidden;min-height:0;';

    // Footer — mirrors JsonLdPanel's footer bar so the editor is framed by
    // equal-height bars top and bottom (bottoms align); "read-only" sits where Parse would.
    const footer = document.createElement('div');
    footer.className = 'sem-panel-bar sem-panel-bar--footer flex items-center justify-end';
    footer.innerHTML = `<span style="font-size:0.75rem;color:#94a3b8;">read-only</span>`;

    this.appendChild(header);
    this.appendChild(editorContainer);
    this.appendChild(footer);

    this._editorView = createTurtleViewer(editorContainer, '# Turtle will appear here after Parse');
  }

  async onGraphUpdated(labUri) {
    if (!this.notebook || !this._editorView) return;

    const sparql = this.getAttribute('sparql');
    if (!sparql) return;

    try {
      const turtle = await graphToTurtle(this.notebook, sparql, this._labUri);

      this._editorView.dispatch({
        changes: {
          from: 0,
          to: this._editorView.state.doc.length,
          insert: turtle || '# No triples in graph yet'
        }
      });
    } catch(err) {
      console.error('Turtle serialization failed:', err);
    }
  }

  disconnectedCallback() {
    this._editorView?.destroy();
    this._editorView = null;
  }
}

customElements.define('sem-panel-turtle', SemPanelTurtle);
