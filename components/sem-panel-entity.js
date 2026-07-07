// cytoscape is loaded globally via <script> tag in index.html — no module import needed.

import {
  hierarchyToElements,
  localName,
  filterHierarchyBindings,
  META_VOCAB_NAMESPACES
} from '../scripts/parse-utils.js';

const entityStylesheet = [
  {
    selector: 'node.class-node',
    style: {
      'shape': 'round-rectangle',
      'background-color': '#f0fdfa',
      'border-width': 2,
      'border-color': '#0d9488',
      'color': '#0f766e',
      'label': 'data(label)',
      'text-valign': 'top',
      'text-halign': 'center',
      'font-size': '12px',
      'font-weight': 'bold',
      'padding': '24px',
      'text-margin-y': '-4px'
    }
  },
  {
    selector: 'node.instance-node',
    style: {
      'shape': 'ellipse',
      'background-color': '#0d9488',
      'border-width': 0,
      'color': '#ffffff',
      'label': 'data(label)',
      'text-valign': 'center',
      'text-halign': 'center',
      'font-size': '10px',
      'width': 48,
      'height': 48
    }
  },
  {
    selector: 'node:selected',
    style: {
      'border-color': '#7c3aed',
      'border-width': 3,
      'background-color': '#ede9fe'
    }
  },
  {
    selector: 'node.instance-node:selected',
    style: {
      'background-color': '#7c3aed',
      'border-width': 0
    }
  }
];

const entityLayout = {
  name: 'cose',
  animate: true,
  animationDuration: 400,
  fit: true,
  padding: 40,
  nodeOverlap: 20,
  idealEdgeLength: 100,
  componentSpacing: 60
};

export class SemPanelEntity extends HTMLElement {
  constructor() {
    super();
    this._cy = null;
    this._selectedIri = null;
    this._selectedType = null;
    this._leftPane = null;
    this._graphContainer = null;
    this._rightPane = null;
    this.notebook = null;
    this._labUri = null;
    // 'mine' hides the RDF/OWL/SHACL/XSD meta-vocabulary (the author's own classes only);
    // 'all' shows it too. 'mine' is the default — the meta-vocab is noise for the core
    // set-membership teaching moment (owl:Class/rdfs:Class are how you declare, not what
    // you're modelling), but the toggle lets the instructor reveal it on demand.
    this._scope = 'mine';
    this._scopeButtons = {};
  }

  // Called by sem-lab after appendChild
  init(notebook, notebookDoc) {
    this.notebook = notebook;
    this._labUri = this.closest('sem-lab')?.getAttribute('uri');
  }

  connectedCallback() {
    // TabsPanel builds this element inside a detached container and appends it
    // to the connected DOM only after init() already ran, so closest('sem-lab')
    // resolves to null at init() time — connectedCallback fires once actually
    // connected and is the reliable place to resolve it.
    this._labUri = this.closest('sem-lab')?.getAttribute('uri');

    this.style.display = 'grid';
    this.style.gridTemplateColumns = '60% 40%';
    this.style.width = '100%';
    this.style.height = '100%';
    this.style.overflow = 'hidden';

    // Left pane — a scope toolbar above the Cytoscape container (a flex column so the
    // graph gets all remaining height; Cytoscape targets _graphContainer, not _leftPane,
    // so a graph:updated rebuild that clears the graph never wipes the toolbar).
    this._leftPane = document.createElement('div');
    this._leftPane.style.cssText = 'display:flex;flex-direction:column;width:100%;height:100%;border-right:1px solid #e2e8f0;';

    const toolbar = document.createElement('div');
    toolbar.style.cssText = 'flex:none;display:flex;align-items:center;gap:0.25rem;padding:0.25rem 0.5rem;background:#f8fafc;border-bottom:1px solid #e2e8f0;';
    this._scopeButtons.mine = this._scopeButton('Mine', 'mine', 'Your own classes only');
    this._scopeButtons.all = this._scopeButton('All', 'all', 'Include the RDF/RDFS/OWL/SHACL/XSD vocabulary');
    toolbar.appendChild(this._scopeButtons.mine);
    toolbar.appendChild(this._scopeButtons.all);

    this._graphContainer = document.createElement('div');
    this._graphContainer.style.cssText = 'flex:1;min-height:0;position:relative;';

    this._leftPane.appendChild(toolbar);
    this._leftPane.appendChild(this._graphContainer);
    this._syncScopeButtons();

    // Right pane — property viewer
    this._rightPane = document.createElement('div');
    this._rightPane.style.cssText = 'width:100%;height:100%;overflow-y:auto;padding:1rem;';
    this._rightPane.innerHTML = '<p style="color:#94a3b8;font-size:0.875rem;">Select a class or entity</p>';

    this.appendChild(this._leftPane);
    this.appendChild(this._rightPane);
  }

  _scopeButton(label, scope, title) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = label;
    btn.title = title;
    btn.style.cssText = 'flex:none;padding:0.25rem 0.625rem;font-size:0.75rem;font-weight:600;letter-spacing:0.03em;border:1px solid #e2e8f0;border-radius:0.375rem;background:transparent;color:#64748b;cursor:pointer;';
    btn.addEventListener('click', () => this._setScope(scope));
    return btn;
  }

  _syncScopeButtons() {
    for (const [scope, btn] of Object.entries(this._scopeButtons)) {
      const active = scope === this._scope;
      btn.style.background = active ? '#0d9488' : 'transparent';
      btn.style.color = active ? '#ffffff' : '#64748b';
      btn.style.borderColor = active ? '#0d9488' : '#e2e8f0';
    }
  }

  async _setScope(scope) {
    if (scope === this._scope) return;
    this._scope = scope;
    this._syncScopeButtons();
    // Re-query the store (no cached bindings — C7) and rebuild the hierarchy in the new
    // scope. Selection and the property pane are unaffected: scope only governs which
    // class containers are shown, not what a selected entity's properties are.
    await this._rebuildHierarchy();
  }

  // Called by sem-lab when graph:updated fires for this lab
  async onGraphUpdated(labUri) {
    await this._rebuildHierarchy();

    // Re-render property pane if something is selected
    // (graph change may have added new properties to selected entity)
    if (this._selectedIri) {
      await this._renderPropertyPane();
    }
  }

  // Query the store and (re)draw the class hierarchy for the current scope. Runs on both
  // graph:updated and scope-toggle; re-queries every time rather than caching bindings (C7).
  async _rebuildHierarchy() {
    const sparql = this.getAttribute('sparql');
    if (!sparql || !this.notebook) return;

    try {
      const bindings = await this.notebook.query(sparql);
      // 'mine' drops the meta-vocabulary; 'all' keeps every candidate. sembook infrastructure
      // is already excluded in the SPARQL itself (C8) regardless of scope.
      const scoped = this._scope === 'mine'
        ? filterHierarchyBindings(bindings, META_VOCAB_NAMESPACES)
        : bindings;
      this._renderHierarchy(hierarchyToElements(scoped));
    } catch (err) {
      console.error('EntityPanel query failed:', err);
    }
  }

  _renderHierarchy(elements) {
    // Always destroy and recreate — compound node graphs
    // cannot be updated incrementally
    if (this._cy) {
      this._cy.destroy();
      this._cy = null;
    }

    if (elements.length === 0) {
      this._graphContainer.innerHTML =
        '<p style="color:#94a3b8;font-size:0.875rem;padding:1rem;">No classes defined yet</p>';
      return;
    }

    this._graphContainer.innerHTML = '';
    this._cy = cytoscape({
      container: this._graphContainer,
      elements,
      style: entityStylesheet,
      layout: entityLayout
    });

    this._initCytoscapeEvents();
  }

  _initCytoscapeEvents() {
    // Click instance node → show properties
    this._cy.on('tap', 'node.instance-node', (e) => {
      const entityIri = e.target.data('entityIri');
      this._setSelection(entityIri, 'instance');
    });

    // Click class node → show members
    this._cy.on('tap', 'node.class-node', (e) => {
      const classIri = e.target.data('id');
      this._setSelection(classIri, 'class');
    });

    // Click background → clear selection
    this._cy.on('tap', (e) => {
      if (e.target === this._cy) {
        this._setSelection(null, null);
      }
    });

    // Hover — show full IRI
    this._cy.on('mouseover', 'node', (e) => {
      e.target.style('label', e.target.data('fullLabel'));
    });
    this._cy.on('mouseout', 'node', (e) => {
      e.target.style('label', e.target.data('label'));
    });
  }

  _setSelection(iri, type) {
    this._selectedIri = iri;
    this._selectedType = type;

    // Fire scoped selection event on notebook context
    if (this.notebook) {
      this.notebook.emit('explorer:selected', {
        labUri: this._labUri,
        entityIri: iri,
        selectionType: type  // 'instance' | 'class' | null
      });
    }

    this._renderPropertyPane();
  }

  // The SPARQL VALUES ?g {...} clause spanning every lab's named graph up to
  // and including this one — matches the cumulative scope the panel's own
  // `sparql` attribute is given (see sem-lab.js _cumulativeGraphsValuesClause).
  _cumulativeGraphsValuesClause() {
    const graphs = this.notebook.graphsUpTo(this._labUri);
    return `VALUES ?g { ${graphs.map(g => `<${g}>`).join(' ')} }`;
  }

  // Same cumulative scope, but also spanning each lab graph's <lab-iri>-inferred
  // companion — used only by the instance-property view, which distinguishes asserted
  // vs inferred property rows (ADR-031). The class-hierarchy and class-member queries
  // deliberately keep using the asserted-only clause above.
  _cumulativeGraphsWithInferredValuesClause() {
    const graphs = this.notebook.graphsUpTo(this._labUri)
      .flatMap(g => [g, `${g}-inferred`]);
    return `VALUES ?g { ${graphs.map(g => `<${g}>`).join(' ')} }`;
  }

  async _renderClassMembers(classIri) {
    const sparql = `
      SELECT DISTINCT ?instance ?label WHERE {
        GRAPH ?g {
          ${this._cumulativeGraphsValuesClause()}
          ?instance a <${classIri}> .
          FILTER(!isBlank(?instance))
          OPTIONAL { ?instance <http://www.w3.org/2000/01/rdf-schema#label> ?label }
        }
      }
    `;
    const bindings = await this.notebook.query(sparql);

    const className = localName(classIri);
    let html = `<h3 style="font-size:0.875rem;font-weight:600;color:#0f766e;margin-bottom:0.75rem;">
      Members of ${className}
    </h3>`;

    if (bindings.length === 0) {
      html += '<p style="color:#94a3b8;font-size:0.875rem;">No instances defined</p>';
    } else {
      html += '<ul style="list-style:none;padding:0;margin:0;">';
      for (const b of bindings) {
        const iri = b.get('instance').value;
        const label = b.get('label')?.value || localName(iri);
        html += `
          <li style="padding:0.375rem 0;border-bottom:1px solid #f1f5f9;font-size:0.875rem;">
            <span style="color:#0d9488;font-weight:500;">${label}</span>
            <span style="color:#94a3b8;font-size:0.75rem;display:block;">${iri}</span>
          </li>`;
      }
      html += '</ul>';
    }

    this._rightPane.innerHTML = html;
  }

  async _renderInstanceProperties(instanceIri) {
    const sparql = `
      SELECT ?property ?value ?g WHERE {
        GRAPH ?g {
          ${this._cumulativeGraphsWithInferredValuesClause()}
          <${instanceIri}> ?property ?value .
          FILTER(!STRSTARTS(STR(?property), "https://sembook.example.org/vocab#"))
        }
      }
      ORDER BY ?property
    `;
    const bindings = await this.notebook.query(sparql);
    const label = localName(instanceIri);

    // Dedup property/value pairs across the asserted and inferred graphs, with assertion
    // winning: a pair that is both asserted and (re-)inferred reads as asserted (not
    // italic). A pair present only in an <lab-iri>-inferred graph renders italic.
    const rows = new Map(); // "propvalue" → { prop, val, inferred }
    for (const b of bindings) {
      const prop = b.get('property').value;
      const val = b.get('value').value;
      const g = b.get('g');
      const inferred = !!(g && g.value.endsWith('-inferred'));
      const key = `${prop}${val}`;
      const existing = rows.get(key);
      if (existing && !existing.inferred) continue; // asserted already recorded — keep it
      rows.set(key, { prop, val, inferred });
    }

    let html = `<h3 style="font-size:0.875rem;font-weight:600;color:#0f766e;margin-bottom:0.75rem;">
      ${label}
      <span style="color:#94a3b8;font-size:0.75rem;font-weight:400;display:block;">${instanceIri}</span>
    </h3>`;

    if (rows.size === 0) {
      html += '<p style="color:#94a3b8;font-size:0.875rem;">No properties asserted</p>';
    } else {
      html += '<table style="width:100%;border-collapse:collapse;font-size:0.8rem;">';
      for (const { prop, val, inferred } of rows.values()) {
        // Inferred rows (triple lives in sembook:inferred) render italic; everything
        // else about the row is unchanged.
        const italic = inferred ? 'font-style:italic;' : '';
        html += `
          <tr style="border-bottom:1px solid #f1f5f9;">
            <td style="padding:0.375rem 0.5rem 0.375rem 0;color:#64748b;white-space:nowrap;vertical-align:top;${italic}">
              ${localName(prop)}
            </td>
            <td style="padding:0.375rem 0;color:#1e293b;word-break:break-all;${italic}">
              ${val}
            </td>
          </tr>`;
      }
      html += '</table>';
    }

    this._rightPane.innerHTML = html;
  }

  async _renderPropertyPane() {
    if (!this._selectedIri) {
      this._rightPane.innerHTML =
        '<p style="color:#94a3b8;font-size:0.875rem;">Select a class or entity</p>';
      return;
    }
    if (this._selectedType === 'class') {
      await this._renderClassMembers(this._selectedIri);
    } else {
      await this._renderInstanceProperties(this._selectedIri);
    }
  }

  disconnectedCallback() {
    this._cy?.destroy();
    this._cy = null;
  }
}

customElements.define('sem-panel-entity', SemPanelEntity);
