function classifyNode(term) {
  if (term.termType === 'BlankNode') return 'blank';
  if (term.termType === 'NamedNode') return 'iri';
  return null; // literals handled separately
}

// The RDF/OWL/SHACL/XSD "description machinery" namespaces — the vocabulary you use to
// *assert things about* your terms (rdfs:label, owl:Class, xsd:string, …), not terms an
// author is modelling. Both the entity explorer ("Mine" scope) and the vocabulary panel
// hide these; keeping the list here is the single source both import so they can't drift.
// schema: is deliberately absent — it's domain vocabulary an author writes with.
export const META_VOCAB_NAMESPACES = [
  'http://www.w3.org/1999/02/22-rdf-syntax-ns#', // rdf:
  'http://www.w3.org/2000/01/rdf-schema#',       // rdfs:
  'http://www.w3.org/2002/07/owl#',              // owl:
  'http://www.w3.org/ns/shacl#',                 // shacl:
  'http://www.w3.org/2001/XMLSchema#'            // xsd:
];

// sembook: infrastructure namespace — excluded from every panel unconditionally (C8),
// independent of any user-facing scope toggle.
export const SEMBOOK_VOCAB_NS = 'https://sembook.example.org/vocab#';

// Tool-synthesized fallback vocabulary (see jsonld-panel-shared.js parseToQuads): keys a
// document's @context doesn't map are minted as urn:sembook:implied:<key> predicates so
// raw JSON still renders as a proto-graph. Infrastructure in the C8 sense — the graph and
// property views deliberately keep showing these (the "your keys aren't vocabulary yet"
// state-1 beat), but nobody authored them, so they never earn vocabulary rows.
export const SEMBOOK_IMPLIED_NS = 'urn:sembook:implied:';

export function inNamespaces(iri, namespaces) {
  return !!iri && namespaces.some(ns => iri.startsWith(ns));
}

// Narrow a hierarchy binding set to the author's own vocabulary: drop rows whose ?class
// falls in one of `namespaces`, and mask a ?parentClass that does (so a class parented to
// e.g. owl:Thing roots cleanly instead of dangling at a pruned parent). Returns binding-like
// adapters that preserve the `.get(name).value` shape hierarchyToElements expects, so the
// builder stays agnostic to the toggle.
export function filterHierarchyBindings(bindings, namespaces) {
  const out = [];
  for (const b of bindings) {
    if (inNamespaces(b.get('class')?.value, namespaces)) continue;
    if (inNamespaces(b.get('parentClass')?.value, namespaces)) {
      out.push({ get: (name) => (name === 'parentClass' ? undefined : b.get(name)) });
    } else {
      out.push(b);
    }
  }
  return out;
}

// Group IRIs connected by equivalence assertions (owl:sameAs / owl:equivalentClass)
// symmetric-transitively via union-find: A≡B plus B≡C puts all three in one group,
// whichever direction each pair was asserted in. `pairs` is an array of [a, b] IRI
// tuples. Returns Map<iri, string[]> from every grouped member to its shared, sorted
// group array; IRIs with no equivalence partner are absent from the map entirely.
export function equivalenceGroups(pairs) {
  const parent = new Map();
  const find = (x) => {
    if (!parent.has(x)) parent.set(x, x);
    let root = x;
    while (parent.get(root) !== root) root = parent.get(root);
    let cur = x; // path compression
    while (parent.get(cur) !== root) { const next = parent.get(cur); parent.set(cur, root); cur = next; }
    return root;
  };
  for (const [a, b] of pairs) parent.set(find(a), find(b));

  const byRoot = new Map();
  for (const iri of parent.keys()) {
    const root = find(iri);
    if (!byRoot.has(root)) byRoot.set(root, []);
    byRoot.get(root).push(iri);
  }
  const byMember = new Map();
  for (const members of byRoot.values()) {
    if (members.length < 2) continue;
    members.sort();
    for (const m of members) byMember.set(m, members);
  }
  return byMember;
}

// Rewrite hierarchy bindings so ?class / ?parentClass IRIs collapse to one node per
// equivalence group — `ex:Person owl:sameAs schema:Person` renders as a single set, and
// members of either IRI land in it. Canonical representative = the group's
// lexicographically-smallest member that actually appears as a ?class value in the
// (already scope-filtered) bindings, so merging can never relabel a visible class to an
// IRI the current scope excludes (e.g. an owl: partner while in 'Mine' scope). A parent
// pointer that lands in its own group after merging is masked — this also neutralises
// the containment cycle that mutual equivalentClass-derived subClassOf would create.
// Returns { bindings, groupOf } where groupOf maps canonical IRI → full sorted group
// (for expanding member/detail queries and hover labels). Same binding-adapter shape as
// filterHierarchyBindings, so hierarchyToElements stays agnostic to merging.
export function mergeHierarchyBindings(bindings, groupsByMember) {
  if (groupsByMember.size === 0) return { bindings, groupOf: new Map() };

  const candidates = new Set();
  for (const b of bindings) {
    const c = b.get('class')?.value;
    if (c) candidates.add(c);
  }
  const canonOf = new Map();
  for (const [member, group] of groupsByMember) {
    canonOf.set(member, group.find(m => candidates.has(m)) ?? group[0]);
  }
  const canon = (iri) => (iri && canonOf.get(iri)) || iri;

  const out = [];
  for (const b of bindings) {
    const cls = b.get('class')?.value;
    const parentCls = b.get('parentClass')?.value;
    const clsCanon = canon(cls);
    const parentCanon = canon(parentCls);
    const dropParent = !!parentCls && parentCanon === clsCanon;
    if (clsCanon === cls && parentCanon === parentCls && !dropParent) {
      out.push(b);
      continue;
    }
    out.push({
      get: (name) => {
        if (name === 'class') return cls ? { value: clsCanon } : b.get(name);
        if (name === 'parentClass') {
          if (dropParent) return undefined;
          return parentCls ? { value: parentCanon } : b.get(name);
        }
        return b.get(name);
      }
    });
  }

  const groupOf = new Map();
  for (const [member, group] of groupsByMember) {
    const c = canonOf.get(member);
    if (!groupOf.has(c)) groupOf.set(c, group);
  }
  return { bindings: out, groupOf };
}

export function localName(iri) {
  const hash = iri.lastIndexOf('#');
  const slash = iri.lastIndexOf('/');
  const colon = iri.lastIndexOf(':'); // covers URN-style IRIs (e.g. urn:sembook:implied:author_id)
  const idx = Math.max(hash, slash, colon);
  return idx >= 0 ? iri.slice(idx + 1) : iri;
}

export function literalId(term) {
  return `literal:${term.value}^^${term.datatype?.value || ''}@${term.language || ''}`;
}

export function nodeLabel(term) {
  if (term.termType === 'Literal') {
    const v = term.value;
    return v.length > 20 ? v.slice(0, 20) + '…' : v;
  }
  if (term.termType === 'BlankNode') return '?';
  return localName(term.value);
}

export function sparqlToElements(bindings) {
  const nodes = new Map(); // id → element
  const edges = new Map(); // edgeId → element (asserted precedence on collision)

  for (const binding of bindings) {
    const s = binding.get('s');
    const p = binding.get('p');
    const o = binding.get('o');
    // ?g is bound when the query projects graph provenance (graph panels). A triple
    // living in a <lab-iri>-inferred graph is inferred → dashed edge; otherwise asserted.
    const g = binding.get('g');
    const inferred = !!(g && g.value.endsWith('-inferred'));

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

    // Edge. The same triple can surface from both an asserted and an inferred graph
    // (e.g. asserted in one lab, inferred in another, both in the Full view); assertion
    // wins so it renders solid, and the shared edge id is deduped rather than added
    // twice (Cytoscape rejects duplicate ids).
    const edgeId = `${sId}__${p.value}__${oId}`;
    const existing = edges.get(edgeId);
    if (existing && existing.classes === 'asserted') continue;
    edges.set(edgeId, {
      data: {
        id: edgeId,
        source: sId,
        target: oId,
        label: localName(p.value),
        fullLabel: p.value
      },
      classes: inferred ? 'inferred' : 'asserted'
    });
  }

  return [...nodes.values(), ...edges.values()];
}

export function hierarchyToElements(bindings) {
  const classNodes = new Map();    // classIri → element
  const instanceNodes = new Map(); // instanceIri+classIri → element

  for (const binding of bindings) {
    const classIri      = binding.get('class')?.value;
    const parentIri     = binding.get('parentClass')?.value;
    const instanceIri   = binding.get('instance')?.value;
    const classLabel    = binding.get('classLabel')?.value;
    const instanceLabel = binding.get('instanceLabel')?.value;

    if (!classIri) continue;

    // Class node
    if (!classNodes.has(classIri)) {
      classNodes.set(classIri, {
        data: {
          id: classIri,
          label: classLabel || localName(classIri),
          fullLabel: classIri,
          parent: parentIri || null,
          nodeType: 'class'
        },
        classes: 'class-node'
      });
    } else if (parentIri && !classNodes.get(classIri).data.parent) {
      // Update parent if we now have one
      classNodes.get(classIri).data.parent = parentIri;
    }

    // Instance node — keyed by instanceIri+classIri to support
    // inferred multi-class membership (same instance in multiple classes)
    if (instanceIri) {
      const instanceKey = `${instanceIri}__in__${classIri}`;
      if (!instanceNodes.has(instanceKey)) {
        instanceNodes.set(instanceKey, {
          data: {
            id: instanceKey,           // unique per class membership
            entityIri: instanceIri,    // actual IRI for selection events
            label: instanceLabel || localName(instanceIri),
            fullLabel: instanceIri,
            parent: classIri,
            nodeType: 'instance'
          },
          classes: 'instance-node'
        });
      }
    }
  }

  return [...classNodes.values(), ...instanceNodes.values()];
}
