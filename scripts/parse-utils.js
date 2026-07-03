function classifyNode(term) {
  if (term.termType === 'BlankNode') return 'blank';
  if (term.termType === 'NamedNode') return 'iri';
  return null; // literals handled separately
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
