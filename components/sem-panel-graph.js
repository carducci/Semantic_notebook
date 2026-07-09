// cytoscape, cytoscapeCola and cola are loaded globally via <script> tags in index.html
// (cytoscape.use(cytoscapeCola) is also registered there) — no module import needed.

import { sparqlToElements, localName } from '../scripts/parse-utils.js';

export const stylesheet = [
  // IRI nodes — solid, teal
  {
    selector: 'node.iri',
    style: {
      'shape': 'ellipse',
      'background-color': '#0d9488',
      'border-width': 2,
      'border-color': '#0f766e',
      'color': '#ffffff',
      'label': 'data(label)',
      'text-valign': 'center',
      'text-halign': 'center',
      'font-size': '11px',
      'width': 'label',
      'height': 'label',
      'padding': '8px'
    }
  },
  // Blank nodes — amber, warning-coded
  {
    selector: 'node.blank',
    style: {
      'shape': 'ellipse',
      'background-color': '#d97706',
      'border-width': 2,
      'border-style': 'dashed',
      'border-color': '#b45309',
      'color': '#ffffff',
      'label': 'data(label)',
      'text-valign': 'center',
      'text-halign': 'center',
      'font-size': '11px',
      'width': 40,
      'height': 40
    }
  },
  // Literal nodes — rounded rectangle, light gray
  {
    selector: 'node.literal',
    style: {
      'shape': 'round-rectangle',
      'background-color': '#f1f5f9',
      'border-width': 1,
      'border-color': '#cbd5e1',
      'color': '#475569',
      'label': 'data(label)',
      'text-valign': 'center',
      'text-halign': 'center',
      'font-size': '10px',
      'width': 'label',
      'height': 'label',
      'padding': '6px'
    }
  },
  // Asserted edges — IRI to IRI
  {
    selector: 'edge.asserted',
    style: {
      'width': 1.5,
      'line-color': '#94a3b8',
      'target-arrow-color': '#94a3b8',
      'target-arrow-shape': 'triangle',
      'curve-style': 'bezier',
      'label': 'data(label)',
      'font-size': '9px',
      'color': '#64748b',
      'text-rotation': 'autorotate',
      'text-background-color': '#ffffff',
      'text-background-opacity': 0.8,
      'text-background-padding': '2px'
    }
  },
  // Inferred edges — dashed, muted
  {
    selector: 'edge.inferred',
    style: {
      'width': 1.5,
      'line-color': '#c4b5fd',
      'line-style': 'dashed',
      'target-arrow-color': '#c4b5fd',
      'target-arrow-shape': 'triangle',
      'curve-style': 'bezier',
      'label': 'data(label)',
      'font-size': '9px',
      'color': '#8b5cf6',
      'text-rotation': 'autorotate'
    }
  }
];

export const layout = {
  name: 'cola',
  animate: true,
  animationDuration: 600,
  randomize: false, // preserve positions between re-renders
  nodeSpacing: 40,
  edgeLength: 120,
  fit: true,
  padding: 30
};

export class SemPanelGraph extends HTMLElement {
  constructor() {
    super();
    this.notebook = null;
    this._cy = null;
  }

  // Called by sem-lab after appendChild
  init(notebook, notebookDoc) {
    this.notebook = notebook;
  }

  connectedCallback() {
    this.style.display = 'block';
    this.style.width = '100%';
    this.style.height = '100%';
    this.style.position = 'relative';

    // Cytoscape reads container size once at construction and never re-checks it.
    // Two things can leave that reading stale: the Tailwind CDN's JIT compiler
    // generates ancestor sizing classes (e.g. h-full) asynchronously, so a
    // construction that races it can capture a zero-size container; and a
    // GraphPanel built inside a hidden (inactive) tab is genuinely zero-size
    // until the tab is switched to. Either way, the fix is the same: resize
    // the Cytoscape canvas whenever this element's actual box size changes.
    //
    // resize() alone only updates the renderer's notion of the canvas
    // dimensions — it does not recompute pan/zoom. If the initial layout's
    // fit:true ran against that stale zero-size box, cola settles on
    // zoom:1/pan:{0,0}, which leaves the (correctly spread-out) node
    // positions rendered far outside the real viewport — most of the graph
    // sits off-canvas and only a small off-center sliver is visible, which
    // reads as an overlapping "rat's nest". Re-fitting on every resize keeps
    // the view centered on the actual content once real dimensions land.
    this._resizeObserver = new ResizeObserver(() => {
      this._cy?.resize();
      this._cy?.fit(undefined, layout.padding);
    });
    this._resizeObserver.observe(this);
  }

  disconnectedCallback() {
    this._resizeObserver?.disconnect();
  }

  // Called by sem-lab when graph:updated fires for this lab
  async onGraphUpdated(labUri) {
    const sparql = this.getAttribute('sparql');
    if (!sparql || !this.notebook) return;

    try {
      const bindings = await this.notebook.query(sparql);
      const elements = sparqlToElements(bindings);
      this._renderCytoscape(elements);
    } catch (err) {
      console.error('GraphPanel query failed:', err);
    }
  }

  _renderCytoscape(elements) {
    if (!this._cy) {
      // First render — create instance
      this._cy = cytoscape({
        container: this,
        elements,
        style: stylesheet,
        layout
      });

      // Tooltip on hover — show full IRI
      this._cy.on('mouseover', 'node', e => {
        const node = e.target;
        node.style('label', node.data('fullLabel'));
      });
      this._cy.on('mouseout', 'node', e => {
        const node = e.target;
        node.style('label', node.data('label'));
      });
      this._cy.on('mouseover', 'edge', e => {
        const edge = e.target;
        edge.style('label', edge.data('fullLabel'));
      });
      this._cy.on('mouseout', 'edge', e => {
        const edge = e.target;
        edge.style('label', edge.data('label'));
      });

    } else {
      // Subsequent renders — update data, re-run layout
      this._cy.elements().remove();
      this._cy.add(elements);
      this._cy.layout(layout).run();
    }
  }

  // Pause layout when not in viewport
  pause() {
    this._cy?.stop();
  }

  resume() {
    if (this._cy?.elements().length > 0) {
      this._cy.layout(layout).run();
    }
  }
}

customElements.define('sem-panel-graph', SemPanelGraph);
