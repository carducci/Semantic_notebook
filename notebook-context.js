import { QueryEngine } from 'https://cdn.jsdelivr.net/npm/@comunica/query-sparql@2.10.0/+esm';

// N3 is loaded globally via <script src=".../n3.min.js"> in index.html — no module import needed.

export class NotebookContext extends EventTarget {
  constructor() {
    super();
    this.store = new N3.Store();
    this.engine = new QueryEngine();
    this._subscribers = new Map();       // labUri → Set<SemPanel>
    this._labOrder = [];                 // ordered lab IRIs
    this._fragmentOwnership = new Map(); // fragmentUri → quad[]
  }

  // Query the quad store with SPARQL
  async query(sparql) {
    const bindingsStream = await this.engine.queryBindings(sparql, {
      sources: [this.store],
      // Without this, a query with no GRAPH clause only matches the store's true
      // default graph (the notebook/lab definition triples) — named-graph data
      // like lab fragments would be invisible to queries like SELECT * WHERE { ?s ?p ?o }.
      unionDefaultGraph: true
    });
    return bindingsStream.toArray();
  }

  // Describe a resource — returns all quads about it
  describe(uri) {
    return this.store.getQuads(N3.DataFactory.namedNode(uri), null, null, null);
  }

  // Upsert a graph fragment — replace all triples previously contributed by fragmentUri
  async upsertFragment(labUri, fragmentUri, quads) {
    const prev = this._fragmentOwnership.get(fragmentUri) || [];
    for (const q of prev) this.store.removeQuad(q);

    this.store.addQuads(quads);
    this._fragmentOwnership.set(fragmentUri, quads);

    this._notifySubscribers(labUri);
  }

  // Remove all triples contributed by a fragment (does not notify — caller decides)
  removeFragment(fragmentUri) {
    const prev = this._fragmentOwnership.get(fragmentUri) || [];
    for (const q of prev) this.store.removeQuad(q);
    this._fragmentOwnership.delete(fragmentUri);
  }

  // Subscribe a panel to updates for a lab
  subscribe(labUri, panel) {
    if (!this._subscribers.has(labUri)) {
      this._subscribers.set(labUri, new Set());
    }
    this._subscribers.get(labUri).add(panel);
  }

  // Get ordered named graph IRIs up to and including labUri
  graphsUpTo(labUri) {
    const idx = this._labOrder.indexOf(labUri);
    if (idx === -1) return [];
    return this._labOrder.slice(0, idx + 1);
  }

  // Set lab order (called by bootstrap)
  setLabOrder(labIris) {
    this._labOrder = labIris;
  }

  _notifySubscribers(labUri) {
    const panels = this._subscribers.get(labUri) || new Set();
    for (const panel of panels) {
      panel.onGraphUpdated(labUri);
    }
  }
}
