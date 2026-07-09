import { QueryEngine } from 'https://cdn.jsdelivr.net/npm/@comunica/query-sparql@2.10.0/+esm';
import { RDFS_OWL2RL_RULES } from './reasoning-rules.js';

// N3 is loaded globally via <script src=".../n3.min.js"> in index.html — no module import needed.

const OWL_SAMEAS = 'http://www.w3.org/2002/07/owl#sameAs';

// Value-based quad key (not object identity): N3 hands back fresh Term instances per
// getQuads() call, so the asserted-vs-derived diff in _materialize must compare by
// value. Literal datatype/language are part of the identity; blank/named nodes by value.
function termKey(t) {
  if (t.termType === 'Literal') {
    return `L${t.value}${t.datatype ? t.datatype.value : ''}${t.language || ''}`;
  }
  return `${t.termType === 'BlankNode' ? 'B' : 'N'}${t.value}`;
}
function quadKey(q) {
  return `${termKey(q.subject)}${termKey(q.predicate)}${termKey(q.object)}`;
}

export class NotebookContext extends EventTarget {
  constructor() {
    super();
    this.store = new N3.Store();
    this.engine = new QueryEngine();
    this._subscribers = new Map();       // labUri → Set<SemPanel>
    this._labOrder = [];                 // ordered lab IRIs
    this._fragmentOwnership = new Map(); // fragmentUri → quad[]
    this._prefixes = new Map();          // labUri → merged prefix object
    this._rulesStore = null;             // lazily-parsed N3 ruleset (see _getRulesStore)
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

  // Execute an arbitrary learner-typed SPARQL query (sem-panel-sparql's Run button).
  // Unlike query(), this never assumes bindings — it branches on Comunica's own
  // resultType so CONSTRUCT/DESCRIBE (quads) and ASK (boolean) are representable too,
  // not just SELECT.
  //
  // Scoping: a query with no explicit GRAPH/FROM clause is implicitly scoped to the
  // cumulative graph (asserted AND inferred) spanning every lab up to and including
  // labUri, via a native SPARQL `FROM <iri> FROM <iri> ...` dataset clause inserted
  // before the query's own WHERE keyword — never by copying data into a side store,
  // so there's nothing that can fall out of sync with the real store. A query that
  // already contains an explicit GRAPH/FROM clause is left completely untouched, so
  // the learner's own scoping (one lab's graph, an explicit VALUES ?g merge, even the
  // default/infrastructure graph by IRI) is honored exactly as written.
  async executeSparql(labUri, sparql) {
    const hasExplicitScope = /\bGRAPH\b/i.test(sparql) || /\bFROM\b/i.test(sparql);

    let queryToRun = sparql;
    if (!hasExplicitScope) {
      // Asserted graph + its -inferred companion for every lab up to and including
      // this one — same graph-list shape sem-lab.js's _inferredAwareGraphSparql
      // already builds for the Full Graph tab, so reasoning is visible by default.
      const graphs = this.graphsUpTo(labUri).flatMap(g => [g, `${g}-inferred`]);
      const fromClauses = graphs.map(g => `FROM <${g}>`).join(' ');
      // Only the first (outermost) WHERE is replaced — a non-global regex match
      // stops after one hit, and any nested subquery WHERE appears later in the text.
      queryToRun = sparql.replace(/\bWHERE\b/i, `${fromClauses} WHERE`);
    }

    const result = await this.engine.query(queryToRun, {
      sources: [this.store],
      unionDefaultGraph: true
    });

    if (result.resultType === 'bindings') {
      const stream = await result.execute();
      return { resultType: 'bindings', bindings: await stream.toArray() };
    }
    if (result.resultType === 'quads') {
      const stream = await result.execute();
      return { resultType: 'quads', quads: await stream.toArray() };
    }
    // 'boolean' — ASK
    return { resultType: 'boolean', value: await result.execute() };
  }

  // Describe a resource — returns all quads about it
  describe(uri) {
    return this.store.getQuads(N3.DataFactory.namedNode(uri), null, null, null);
  }

  // Upsert a graph fragment — replace all triples previously contributed by fragmentUri
  async upsertFragment(labUri, fragmentUri, quads, prefixes = {}) {
    const prev = this._fragmentOwnership.get(fragmentUri) || [];
    for (const q of prev) this.store.removeQuad(q);

    this.store.addQuads(quads);
    this._fragmentOwnership.set(fragmentUri, quads);

    // Merge new prefixes into lab's prefix map
    if (!this._prefixes.has(labUri)) {
      this._prefixes.set(labUri, {});
    }
    Object.assign(this._prefixes.get(labUri), prefixes);

    // Every successful Parse re-materializes this lab's inferred graph before panels
    // re-render (ADR-031) — not a separate user action, a direct consequence of Parse.
    this._materialize(labUri);

    this._notifySubscribers(labUri);
  }

  // Lazily parse the N3 ruleset once and cache it — the rules never change, so there's
  // no reason to re-parse the text on every Parse.
  _getRulesStore() {
    if (!this._rulesStore) {
      const parser = new N3.Parser({ format: 'text/n3' });
      this._rulesStore = new N3.Store(parser.parse(RDFS_OWL2RL_RULES));
    }
    return this._rulesStore;
  }

  // Materialize inferred triples for a lab into its <lab-iri>-inferred named graph
  // (the convention in spec §"Named Graph Model", ADR-009, and sembook.ttl). Idempotent:
  // the inferred graph is cleared and recomputed from scratch on every call, so repeated
  // Parses of the same or overlapping fragments never accumulate duplicate derivations.
  _materialize(labUri) {
    const df = N3.DataFactory;
    const inferredGraph = df.namedNode(`${labUri}-inferred`);

    // 1. Drop the previous inferred graph — full replace, never accumulate.
    for (const q of this.store.getQuads(null, null, null, inferredGraph)) {
      this.store.removeQuad(q);
    }

    // 2. This lab's asserted triples (its own named graph only — per-lab isolation,
    //    matching how the lab's asserted graph is scoped; not a cross-lab union).
    const asserted = this.store.getQuads(null, null, null, df.namedNode(labUri));
    if (asserted.length === 0) return;

    // 3. Reason in an isolated scratch store rather than in place. N3.Reasoner mutates
    //    its store and adds conclusions to the graph it reasoned over, so putting the
    //    asserted triples in the scratch DEFAULT graph keeps asserted + derived together
    //    there and lets us diff them out cleanly — the main store is never touched
    //    mid-computation. Reasoning is synchronous and, at teaching-data scale, trivially
    //    fast, so a full re-reason on each Parse is fine (no incremental reasoning needed).
    const scratch = new N3.Store();
    for (const q of asserted) {
      scratch.addQuad(df.quad(q.subject, q.predicate, q.object));
    }
    const assertedKeys = new Set(scratch.getQuads().map(quadKey));

    new N3.Reasoner(scratch).reason(this._getRulesStore());

    // 4. Newly derived = everything in the scratch graph that wasn't already asserted.
    //    Write those (only those) into the inferred graph.
    for (const q of scratch.getQuads()) {
      if (assertedKeys.has(quadKey(q))) continue;                 // re-derived assertion
      if (q.predicate.value === OWL_SAMEAS && q.subject.equals(q.object)) continue; // reflexive noise
      this.store.addQuad(df.quad(q.subject, q.predicate, q.object, inferredGraph));
    }
  }

  getPrefixes(labUri) {
    return this._prefixes.get(labUri) || {};
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

  // Fire a scoped event on the notebook context (e.g. explorer:selected)
  emit(eventName, detail) {
    this.dispatchEvent(new CustomEvent(eventName, { detail }));
  }

  _notifySubscribers(labUri) {
    const panels = this._subscribers.get(labUri) || new Set();
    for (const panel of panels) {
      panel.onGraphUpdated(labUri);
    }
  }
}
