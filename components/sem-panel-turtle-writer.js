// See sem-panel-turtle.js for why these are pinned the way they are: leaving
// @codemirror/language unpinned (not e.g. @6.0.0) lets esm.sh dedupe it against
// the copy codemirror@6.0.1 already pulls in — pinning an exact patch produces a
// second bundle whose @lezer/highlight tags don't match, silently killing highlighting.
import { EditorView, basicSetup } from 'https://esm.sh/codemirror@6.0.1';
import { StreamLanguage } from 'https://esm.sh/@codemirror/language@6';
import { turtle } from 'https://esm.sh/@codemirror/legacy-modes@6.3.3/mode/turtle';
import { keymap } from 'https://esm.sh/@codemirror/view@6';
import { indentWithTab } from 'https://esm.sh/@codemirror/commands@6';

// N3 is loaded globally via <script src=".../n3.min.js"> in index.html — no module import needed.

function createEditor(parent, initialContent, onChange) {
  const view = new EditorView({
    doc: initialContent,
    extensions: [
      basicSetup,
      StreamLanguage.define(turtle),
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
          backgroundColor: '#f1f5f9'
        },
        '.cm-activeLine': {
          backgroundColor: '#f8fafc'
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

  init(notebook, notebookDoc) {
    this.notebook = notebook;
    this._labUri = this.closest('sem-lab')?.getAttribute('uri');
  }

  get uri() { return this.getAttribute('uri'); }
  get label() { return this.getAttribute('label'); }

  connectedCallback() {
    this.style.cssText = 'display:flex;flex-direction:column;width:100%;height:100%;overflow:hidden;';

    this.innerHTML = `
      <div class="sem-panel-bar sem-panel-bar--header flex items-start">
        <span class="sem-panel-label">${this.label || 'Turtle'}</span>
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
    this.querySelector('[data-role="parse-btn"]').addEventListener('click', () => this.onParse());

    this._editorView = createEditor(
      this._editorContainer,
      this._editorContent || '# Write Turtle here\n',
      (content) => { this._editorContent = content; }
    );
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
