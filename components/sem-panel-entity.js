// cytoscape is loaded globally via <script> tag in index.html — no module import needed.

import { hierarchyToElements, localName } from '../scripts/parse-utils.js';

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
    this._rightPane = null;
    this.notebook = null;
    this._labUri = null;
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

    // Left pane — Cytoscape container
    this._leftPane = document.createElement('div');
    this._leftPane.style.cssText = 'width:100%;height:100%;position:relative;border-right:1px solid #e2e8f0;';

    // Right pane — property viewer
    this._rightPane = document.createElement('div');
    this._rightPane.style.cssText = 'width:100%;height:100%;overflow-y:auto;padding:1rem;';
    this._rightPane.innerHTML = '<p style="color:#94a3b8;font-size:0.875rem;">Select a class or entity</p>';

    this.appendChild(this._leftPane);
    this.appendChild(this._rightPane);
  }

  // Called by sem-lab when graph:updated fires for this lab
  async onGraphUpdated(labUri) {
    const sparql = this.getAttribute('sparql');
    if (!sparql || !this.notebook) return;

    try {
      const bindings = await this.notebook.query(sparql);
      const elements = hierarchyToElements(bindings);
      this._renderHierarchy(elements);

      // Re-render property pane if something is selected
      // (graph change may have added new properties to selected entity)
      if (this._selectedIri) {
        await this._renderPropertyPane();
      }
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
      this._leftPane.innerHTML =
        '<p style="color:#94a3b8;font-size:0.875rem;padding:1rem;">No classes defined yet</p>';
      return;
    }

    this._leftPane.innerHTML = '';
    this._cy = cytoscape({
      container: this._leftPane,
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

  async _renderClassMembers(classIri) {
    const sparql = `
      SELECT DISTINCT ?instance ?label WHERE {
        GRAPH ?g {
          VALUES ?g { <${this._labUri}> }
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
      SELECT ?property ?value WHERE {
        GRAPH ?g {
          VALUES ?g { <${this._labUri}> }
          <${instanceIri}> ?property ?value .
          FILTER(!STRSTARTS(STR(?property), "https://sembook.example.org/vocab#"))
        }
      }
      ORDER BY ?property
    `;
    const bindings = await this.notebook.query(sparql);
    const label = localName(instanceIri);

    let html = `<h3 style="font-size:0.875rem;font-weight:600;color:#0f766e;margin-bottom:0.75rem;">
      ${label}
      <span style="color:#94a3b8;font-size:0.75rem;font-weight:400;display:block;">${instanceIri}</span>
    </h3>`;

    if (bindings.length === 0) {
      html += '<p style="color:#94a3b8;font-size:0.875rem;">No properties asserted</p>';
    } else {
      html += '<table style="width:100%;border-collapse:collapse;font-size:0.8rem;">';
      for (const b of bindings) {
        const prop = b.get('property').value;
        const val = b.get('value').value;
        html += `
          <tr style="border-bottom:1px solid #f1f5f9;">
            <td style="padding:0.375rem 0.5rem 0.375rem 0;color:#64748b;white-space:nowrap;vertical-align:top;">
              ${localName(prop)}
            </td>
            <td style="padding:0.375rem 0;color:#1e293b;word-break:break-all;">
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
