// cytoscape, cytoscapeCola and cola are loaded globally via <script> tags in index.html
// (cytoscape.use(cytoscapeCola) is also registered there) — no module import needed.

function classifyNode(term) {
  if (term.termType === 'BlankNode') return 'blank';
  if (term.termType === 'NamedNode') return 'iri';
  return null; // literals handled separately
}

function literalId(term) {
  return `literal:${term.value}^^${term.datatype?.value || ''}@${term.language || ''}`;
}

function localName(iri) {
  const hash = iri.lastIndexOf('#');
  const slash = iri.lastIndexOf('/');
  const colon = iri.lastIndexOf(':'); // covers URN-style IRIs (e.g. urn:sembook:implied:author_id)
  const idx = Math.max(hash, slash, colon);
  return idx >= 0 ? iri.slice(idx + 1) : iri;
}

function nodeLabel(term) {
  if (term.termType === 'Literal') {
    const v = term.value;
    return v.length > 20 ? v.slice(0, 20) + '…' : v;
  }
  if (term.termType === 'BlankNode') return '?';
  return localName(term.value);
}

function sparqlToElements(bindings) {
  const nodes = new Map(); // id → element
  const edges = [];

  for (const binding of bindings) {
    const s = binding.get('s');
    const p = binding.get('p');
    const o = binding.get('o');

    // Subject node
    const sId = s.termType === 'BlankNode'
      ? `_:${s.value}`
      : s.value;
    const sType = classifyNode(s);
    if (!nodes.has(sId)) {
      nodes.set(sId, {
        data: {
          id: sId,
          label: nodeLabel(s),
          fullLabel: s.value,
          nodeType: sType
        },
        classes: sType
      });
    }

    // Object node
    const oId = o.termType === 'Literal'
      ? literalId(o)
      : o.termType === 'BlankNode'
        ? `_:${o.value}`
        : o.value;
    const oType = o.termType === 'Literal' ? 'literal' : classifyNode(o);
    if (!nodes.has(oId)) {
      nodes.set(oId, {
        data: {
          id: oId,
          label: nodeLabel(o),
          fullLabel: o.termType === 'Literal' ? `"${o.value}"` : o.value,
          nodeType: oType
        },
        classes: oType
      });
    }

    // Edge
    const edgeId = `${sId}__${p.value}__${oId}`;
    edges.push({
      data: {
        id: edgeId,
        source: sId,
        target: oId,
        label: localName(p.value),
        fullLabel: p.value
      },
      classes: 'asserted'
    });
  }

  return [...nodes.values(), ...edges];
}

const stylesheet = [
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

const layout = {
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
    this._resizeObserver = new ResizeObserver(() => this._cy?.resize());
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
