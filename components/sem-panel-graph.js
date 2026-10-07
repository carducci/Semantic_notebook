// cytoscape, cytoscapeCola and cola are loaded globally via <script> tags in index.html
// (cytoscape.use(cytoscapeCola) is also registered there) — no module import needed.

import { sparqlToElements, localName } from '../scripts/parse-utils.js';
import { graphGrammar, fontsReady, onThemeChange } from '../scripts/theme.js';

// Built from the brand's diagram grammar (scripts/theme.js#graphGrammar — the same
// grammar lectern's slides draw) rather than literal colors, and rebuilt on a
// day/night switch: Cytoscape paints to canvas, so it can't follow CSS var()s.
export function buildStylesheet() {
  const g = graphGrammar();
  return [
    // IRI nodes — a hollow Lace ring: a thing with identity
    {
      selector: 'node.iri',
      style: {
        ...g.node,
        'shape': 'ellipse',
        'label': 'data(label)',
        'text-valign': 'center',
        'text-halign': 'center',
        'width': 'label',
        'height': 'label',
        'padding': '8px'
      }
    },
    // Blank nodes — a dashed fog ring: no identity yet
    {
      selector: 'node.blank',
      style: {
        ...g.blank,
        'shape': 'ellipse',
        'label': 'data(label)',
        'text-valign': 'center',
        'text-halign': 'center',
        'width': 40,
        'height': 40
      }
    },
    // Literal nodes — rounded chip: a value, not a thing
    {
      selector: 'node.literal',
      style: {
        ...g.literal,
        'shape': 'round-rectangle',
        'label': 'data(label)',
        'text-valign': 'center',
        'text-halign': 'center',
        'width': 'label',
        'height': 'label',
        'padding': '6px'
      }
    },
    // Asserted edges — solid Lace: somebody typed this
    { selector: 'edge.asserted', style: g.edgeAsserted },
    // Inferred edges — dotted string light: the reasoner derived this (ADR-031)
    { selector: 'edge.inferred', style: g.edgeInferred }
  ];
}

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
    this._offTheme = onThemeChange(() => this._cy?.style(buildStylesheet()));
  }

  disconnectedCallback() {
    this._resizeObserver?.disconnect();
    this._offTheme?.();
  }

  // Called by sem-lab when graph:updated fires for this lab
  async onGraphUpdated(labUri) {
    const sparql = this.getAttribute('sparql');
    if (!sparql || !this.notebook) return;

    try {
      const bindings = await this.notebook.query(sparql);
      const elements = sparqlToElements(bindings);
      await fontsReady(); // canvas labels must measure in DM Mono, not the fallback
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
        style: buildStylesheet(),
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
