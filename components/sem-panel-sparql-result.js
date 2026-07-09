// cytoscape, cytoscapeCola, cola are loaded globally via <script> tags in index.html
// (see sem-panel-graph.js) — no module import needed. N3 likewise (n3.min.js script tag).
import { sparqlToElements, quadsToElements, localName } from '../scripts/parse-utils.js';
import { stylesheet, layout } from './sem-panel-graph.js';
import { createTurtleViewer } from './sem-panel-turtle.js';

export class SemPanelSparqlResult extends HTMLElement {
  constructor() {
    super();
    this.notebook = null;
    this._labUri = null;
    this._cy = null;
    this._turtleView = null;
    this._activeView = 'table';
    this._lastResult = null; // { resultType: 'bindings'|'quads'|'boolean', bindings|quads|value }
    this._onExecuted = null;
  }

  // Called by sem-lab immediately after appendChild (ADR-021). This panel never
  // mutates the graph, so unlike GraphPanel/EntityPanel it never calls
  // notebook.subscribe()/onGraphUpdated — it reacts only to sparql:executed,
  // the same "bespoke scoped event, not graph:updated" precedent DDR-025 set.
  init(notebook, notebookDoc) {
    this.notebook = notebook;
    this._labUri = this.closest('sem-lab')?.getAttribute('uri');
    this._onExecuted = (e) => {
      if (e.detail.labUri !== this._labUri) return;
      this._handleResult(e.detail);
    };
    this.notebook.addEventListener('sparql:executed', this._onExecuted);
  }

  get uri() { return this.getAttribute('uri'); }
  get label() { return this.getAttribute('label'); }

  connectedCallback() {
    this.style.cssText = 'display:flex;flex-direction:column;width:100%;height:100%;overflow:hidden;';

    const header = document.createElement('div');
    header.className = 'sem-panel-bar sem-panel-bar--header flex items-center justify-between';
    header.innerHTML = `
      <span class="sem-panel-label">${this.label || 'Result'}</span>
      <div class="flex gap-1" data-role="view-tabs">
        <button type="button" data-view="table">Table</button>
        <button type="button" data-view="turtle">Turtle</button>
        <button type="button" data-view="graph">Graph</button>
      </div>
    `;

    const content = document.createElement('div');
    content.style.cssText = 'position:relative;flex:1;min-height:0;overflow:hidden;';

    this._tablePane = document.createElement('div');
    this._tablePane.style.cssText = 'position:absolute;inset:0;overflow:auto;';

    this._turtlePane = document.createElement('div');
    this._turtlePane.style.cssText = 'position:absolute;inset:0;overflow:hidden;display:none;';

    this._graphPane = document.createElement('div');
    this._graphPane.style.cssText = 'position:absolute;inset:0;overflow:hidden;display:none;';

    content.append(this._tablePane, this._turtlePane, this._graphPane);

    this.innerHTML = '';
    this.appendChild(header);
    this.appendChild(content);

    this._viewButtons = {
      table: header.querySelector('[data-view="table"]'),
      turtle: header.querySelector('[data-view="turtle"]'),
      graph: header.querySelector('[data-view="graph"]')
    };
    for (const [name, btn] of Object.entries(this._viewButtons)) {
      btn.addEventListener('click', () => this._showView(name));
    }

    this._turtleView = createTurtleViewer(this._turtlePane, '# Run a query to see Turtle output here');

    this._renderTable(null);
    this._showView('table');

    // Cytoscape reads container size once at construction; the graph pane starts
    // display:none (Table is the default view), so any instance built while hidden
    // measures 0×0 — same rationale/fix as sem-panel-graph.js and sem-panel-vocab.js.
    this._resizeObserver = new ResizeObserver(() => {
      this._cy?.resize();
      this._cy?.fit(undefined, layout.padding);
    });
    this._resizeObserver.observe(this._graphPane);
  }

  disconnectedCallback() {
    this.notebook?.removeEventListener('sparql:executed', this._onExecuted);
    this._resizeObserver?.disconnect();
    this._cy?.destroy();
    this._cy = null;
    this._turtleView?.destroy();
    this._turtleView = null;
  }

  // Turtle/Graph are only meaningful for triple-shaped results — a CONSTRUCT/DESCRIBE
  // quad stream is always triple-shaped; a SELECT is triple-shaped only when it
  // projects exactly ?s ?p ?o (the same convention every other graph-producing panel
  // in this app already relies on via sparqlToElements). Table is always available.
  _eligibility(result) {
    if (!result) return { table: true, turtle: false, graph: false };
    if (result.resultType === 'quads') return { table: true, turtle: true, graph: true };
    if (result.resultType === 'bindings') {
      const varNames = this._collectVarNames(result.bindings);
      const tripleShaped = varNames.length === 3 && ['s', 'p', 'o'].every(v => varNames.includes(v));
      return { table: true, turtle: tripleShaped, graph: tripleShaped };
    }
    return { table: true, turtle: false, graph: false }; // 'boolean' — ASK
  }

  _collectVarNames(bindings) {
    const seen = new Set();
    const names = [];
    for (const b of bindings) {
      for (const [v] of b) {
        if (!seen.has(v.value)) { seen.add(v.value); names.push(v.value); }
      }
    }
    return names;
  }

  _handleResult(detail) {
    this._lastResult = detail;
    const elig = this._eligibility(detail);

    this._renderTable(detail);
    this._renderTurtle(detail, elig.turtle);
    this._renderGraph(detail, elig.graph);

    // Stay on the learner's current view if the new result still supports it
    // (e.g. iterating on a CONSTRUCT query while watching Graph); otherwise fall
    // back to Table, which is always available.
    this._showView(elig[this._activeView] ? this._activeView : 'table');
  }

  _showView(name) {
    const elig = this._eligibility(this._lastResult);
    if (!elig[name]) return;
    this._activeView = name;
    this._tablePane.style.display = name === 'table' ? 'block' : 'none';
    this._turtlePane.style.display = name === 'turtle' ? 'block' : 'none';
    this._graphPane.style.display = name === 'graph' ? 'block' : 'none';
    this._styleViewButtons(elig);
    if (name === 'graph' && this._cy) {
      this._cy.resize();
      this._cy.fit(undefined, layout.padding);
    }
  }

  _styleViewButtons(elig = this._eligibility(this._lastResult)) {
    for (const [name, btn] of Object.entries(this._viewButtons)) {
      const active = this._activeView === name;
      const enabled = elig[name];
      btn.disabled = !enabled;
      btn.style.cssText = `font-size:0.75rem;padding:0.25rem 0.625rem;border-radius:0.375rem;border:1px solid transparent;${
        enabled ? 'cursor:pointer;' : 'cursor:not-allowed;opacity:0.4;'
      }${
        active && enabled ? 'background:#0d9488;color:#ffffff;' : 'background:transparent;color:#64748b;'
      }`;
    }
  }

  _emptyMessage(text) {
    const p = document.createElement('p');
    p.style.cssText = 'color:#94a3b8;font-size:0.875rem;padding:0.75rem;';
    p.textContent = text;
    return p;
  }

  // Built with the DOM API (not innerHTML templating) so arbitrary literal values
  // from the store — entirely learner-typed, via the JSON-LD/Turtle/SPARQL editors —
  // land in textContent/title rather than parsed as markup.
  _renderTable(result) {
    this._tablePane.innerHTML = '';

    if (!result) {
      this._tablePane.appendChild(this._emptyMessage('Run a query to see results.'));
      return;
    }

    if (result.resultType === 'boolean') {
      const div = document.createElement('div');
      div.style.cssText = 'padding:0.75rem;font-size:0.875rem;font-family:monospace;';
      div.textContent = result.value ? 'true' : 'false';
      this._tablePane.appendChild(div);
      return;
    }

    let headers, rows;
    if (result.resultType === 'quads') {
      headers = ['subject', 'predicate', 'object'];
      rows = result.quads.map(q => [q.subject, q.predicate, q.object]);
    } else {
      headers = this._collectVarNames(result.bindings);
      rows = result.bindings.map(b => headers.map(h => b.get(h)));
    }

    if (rows.length === 0) {
      this._tablePane.appendChild(this._emptyMessage('No results.'));
      return;
    }

    const table = document.createElement('table');
    table.style.cssText = 'width:100%;border-collapse:collapse;font-size:0.75rem;font-family:"JetBrains Mono","Fira Code","Cascadia Code",monospace;';

    const thead = document.createElement('thead');
    const headRow = document.createElement('tr');
    for (const h of headers) {
      const th = document.createElement('th');
      th.textContent = h;
      th.style.cssText = 'text-align:left;padding:0.375rem 0.5rem;background:#f8fafc;border-bottom:1px solid #e2e8f0;position:sticky;top:0;color:#334155;';
      headRow.appendChild(th);
    }
    thead.appendChild(headRow);

    const tbody = document.createElement('tbody');
    for (const row of rows) {
      const tr = document.createElement('tr');
      for (const term of row) {
        const td = document.createElement('td');
        td.style.cssText = 'padding:0.375rem 0.5rem;border-bottom:1px solid #f1f5f9;white-space:nowrap;';
        if (term) {
          td.textContent = term.termType === 'Literal' ? `"${term.value}"` : localName(term.value);
          td.title = term.value;
        } else {
          td.textContent = '—';
          td.style.color = '#cbd5e1';
        }
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }

    table.appendChild(thead);
    table.appendChild(tbody);
    this._tablePane.appendChild(table);
  }

  async _renderTurtle(result, eligible) {
    if (!this._turtleView) return;
    let text = '# Turtle view is only available for triple-shaped results (?s ?p ?o, or CONSTRUCT/DESCRIBE)\n';
    if (eligible) {
      const quads = result.resultType === 'quads'
        ? result.quads
        : result.bindings.map(b => N3.DataFactory.quad(b.get('s'), b.get('p'), b.get('o')));
      text = (await this._quadsToTurtle(quads)) || '# No triples in this result\n';
    }
    this._turtleView.dispatch({
      changes: { from: 0, to: this._turtleView.state.doc.length, insert: text }
    });
  }

  _quadsToTurtle(quads) {
    const prefixes = this.notebook.getPrefixes(this._labUri);
    return new Promise((resolve, reject) => {
      const writer = new N3.Writer({ prefixes });
      for (const q of quads) {
        writer.addQuad(N3.DataFactory.quad(q.subject, q.predicate, q.object));
      }
      writer.end((err, text) => (err ? reject(err) : resolve(text)));
    });
  }

  _renderGraph(result, eligible) {
    this._cy?.destroy();
    this._cy = null;
    this._graphPane.innerHTML = '';

    if (!eligible) {
      this._graphPane.appendChild(this._emptyMessage('Graph view is only available for triple-shaped results (?s ?p ?o, or CONSTRUCT/DESCRIBE).'));
      return;
    }

    const elements = result.resultType === 'quads'
      ? quadsToElements(result.quads)
      : sparqlToElements(result.bindings);

    if (elements.length === 0) {
      this._graphPane.appendChild(this._emptyMessage('No results.'));
      return;
    }

    this._cy = cytoscape({
      container: this._graphPane,
      elements,
      style: stylesheet,
      layout
    });

    // Same hover-for-full-IRI affordance as sem-panel-graph.js.
    this._cy.on('mouseover', 'node', e => { const n = e.target; n.style('label', n.data('fullLabel')); });
    this._cy.on('mouseout', 'node', e => { const n = e.target; n.style('label', n.data('label')); });
    this._cy.on('mouseover', 'edge', e => { const ed = e.target; ed.style('label', ed.data('fullLabel')); });
    this._cy.on('mouseout', 'edge', e => { const ed = e.target; ed.style('label', ed.data('label')); });
  }
}

customElements.define('sem-panel-sparql-result', SemPanelSparqlResult);
