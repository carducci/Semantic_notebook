// cytoscape and the fCoSE layout (cytoscapeFcose + its cose-base/layout-base deps) are
// loaded globally via <script> tags in index.html, where cytoscape.use(cytoscapeFcose)
// is also registered — no module import needed.

import {
  hierarchyToElements,
  localName,
  filterHierarchyBindings,
  equivalenceGroups,
  mergeHierarchyBindings,
  META_VOCAB_NAMESPACES
} from '../scripts/parse-utils.js';

const OWL = 'http://www.w3.org/2002/07/owl#';
const RDFS = 'http://www.w3.org/2000/01/rdf-schema#';

// Dedupe bindings that can surface from both an asserted graph and a <lab>-inferred
// companion; assertion wins, so a row that is asserted AND re-derived renders roman,
// not italic (same precedence rule as sparqlToElements' edge dedupe, ADR-031). Keeps
// first-seen order; an asserted duplicate upgrades the row in place.
function dedupeInferredRows(bindings, keyOf) {
  const rows = new Map();
  for (const b of bindings) {
    const g = b.get('g');
    const inferred = !!(g && g.value.endsWith('-inferred'));
    const key = keyOf(b);
    const existing = rows.get(key);
    if (existing && !existing.inferred) continue; // asserted already recorded — keep it
    rows.set(key, { b, inferred });
  }
  return [...rows.values()];
}

// Property/value table shared by the instance view and the class-assertions view.
// Inferred rows render italic; everything else about the row is identical.
function propertyTableHtml(rows) {
  let html = '<table style="width:100%;border-collapse:collapse;font-size:0.8rem;">';
  for (const { prop, val, inferred } of rows) {
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
  return html;
}

function sectionLabelHtml(text) {
  return `<h4 style="font-size:0.7rem;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;margin:1rem 0 0.25rem;">${text}</h4>`;
}

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
  // Inferred membership — this instance is in this set because the reasoner derived it,
  // not because anyone typed it. Muted fill + dashed border + italic label, matching the
  // dashed-inferred visual grammar the graph panels already use (ADR-031).
  {
    selector: 'node.instance-node.inferred',
    style: {
      'background-color': '#99f6e4',
      'border-width': 2,
      'border-style': 'dashed',
      'border-color': '#0d9488',
      'color': '#0f766e',
      'font-style': 'italic'
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

// fCoSE, not plain cose: cose predates Cytoscape's compound-node support. It doesn't pack
// disconnected components apart, so separate class sets (Person, Book, City, ...) pile on
// top of each other instead of tiling side by side — exactly the bug reported. fCoSE (via
// packComponents) tiles them and remains compound-aware for the nested instance-in-class
// containment. randomize:true is safe here (unlike the graph panel) because this panel
// always destroys and recreates its Cytoscape instance on every render (ADR-024) — there
// are never prior positions worth preserving to justify randomize:false.
const entityLayout = {
  name: 'fcose',
  quality: 'proof',
  randomize: true,
  animate: true,
  animationDuration: 400,
  fit: true,
  padding: 30,
  nodeDimensionsIncludeLabels: true,
  packComponents: true,
  nodeSeparation: 80,
  idealEdgeLength: 90,
  nodeRepulsion: 5000
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
    // 'mine' scopes every query to THIS lab's graph only; 'all' spans every lab's graph
    // up to and including this one (cumulative — how an entity asserted two labs ago
    // joins the view when the instructor widens scope). The RDF/RDFS/OWL/SHACL/XSD
    // meta-vocabulary is always hidden here regardless of scope (ADR-033) — it's how you
    // declare, not what you're modelling. 'mine' is the default: start lab-local, widen
    // to 'all' as the reveal.
    this._scope = 'mine';
    this._scopeButtons = {};
    this._resizeObserver = null;
    // canonical class IRI → full sorted equivalence group ([ex:Person, schema:Person]),
    // plus the inverse member → canonical map. Render-derived projections of the store,
    // recomputed on every rebuild — never carried across graph updates (C7; same
    // category as the Cytoscape instance ref).
    this._classGroups = new Map();
    this._classCanon = new Map();
    // canonical parent class IRI → Set of canonical direct-child class IRIs, from the
    // merged subClassOf structure. Lets a class's member list include instances of its
    // (transitive) subclasses — an Author is a Person. Same render-derived, recomputed-
    // every-rebuild lifetime as the maps above.
    this._classChildren = new Map();
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
    this._scopeButtons.mine = this._scopeButton('Mine', 'mine', "This lab's data only");
    this._scopeButtons.all = this._scopeButton('All', 'all', 'Everything asserted so far, across all labs up to this one');
    toolbar.appendChild(this._scopeButtons.mine);
    toolbar.appendChild(this._scopeButtons.all);

    this._graphContainer = document.createElement('div');
    this._graphContainer.style.cssText = 'flex:1;min-height:0;position:relative;';

    this._leftPane.appendChild(toolbar);
    this._leftPane.appendChild(this._graphContainer);
    this._syncScopeButtons();

    // Cytoscape reads its container size once at construction and never re-checks it.
    // The Entities tab is usually not the active tab when a Parse first renders this
    // panel, so its cytoscape is built inside a display:none (0×0) pane — the layout's
    // fit:true settles on zoom:1/pan:0 and the graph sits off-canvas. resize() updates
    // the renderer's canvas dimensions; fit() re-centers on the real content once a true
    // box lands (tab selected, scrolled into view, or Tailwind sizing resolves). Same
    // mechanism the graph and vocab panels already rely on — this keeps the entity
    // explorer consistent so it draws whenever it's observed, not only on Parse/toggle.
    this._resizeObserver = new ResizeObserver(() => {
      this._cy?.resize();
      this._cy?.fit(undefined, entityLayout.padding);
    });
    this._resizeObserver.observe(this._graphContainer);

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
    // Re-query the store (no cached bindings — C7) and rebuild BOTH panes in the new
    // scope: the hierarchy, and the detail pane if something is selected — a selected
    // class's members (or entity's properties) narrow to this lab in 'mine' too.
    await this._rebuildHierarchy();
    if (this._selectedIri) await this._renderPropertyPane();
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
      // The sparql attribute arrives with sem-lab's cumulative VALUES clause baked in;
      // re-scope it to the current toggle (this lab only vs all labs so far).
      const scopedSparql = sparql.replace(/VALUES\s+\?g\s*\{[^}]*\}/, this._graphsValuesClause());
      const [bindings, equivBindings, inferredMembers] = await Promise.all([
        this.notebook.query(scopedSparql),
        this.notebook.query(this._equivalenceQuery()),
        this.notebook.query(this._inferredMembershipQuery())
      ]);
      // The meta-vocabulary is machinery, never modelling — always filtered here,
      // whatever the scope (ADR-033). sembook infrastructure is already excluded in
      // the SPARQL itself (C8).
      const scoped = filterHierarchyBindings(bindings, META_VOCAB_NAMESPACES);
      // Collapse equivalent classes (owl:sameAs / owl:equivalentClass) into one set each —
      // scope-filter first so the canonical pick can't resurrect a filtered namespace.
      const groups = equivalenceGroups(
        equivBindings.map(b => [b.get('a').value, b.get('b').value])
      );
      const { bindings: merged, groupOf } = mergeHierarchyBindings(scoped, groups);
      this._classGroups = groupOf;
      this._classCanon = new Map();
      for (const [canonIri, group] of groupOf) {
        for (const member of group) this._classCanon.set(member, canonIri);
      }
      // Capture the (canonical) subClassOf structure so member lists can descend it.
      this._classChildren = new Map();
      for (const b of merged) {
        const c = b.get('class')?.value;
        const p = b.get('parentClass')?.value;
        if (!c || !p || c === p) continue;
        if (!this._classChildren.has(p)) this._classChildren.set(p, new Set());
        this._classChildren.get(p).add(c);
      }

      const elements = hierarchyToElements(merged);
      // A merged container's hover label enumerates every IRI it stands for.
      for (const el of elements) {
        const group = groupOf.get(el.data.id);
        if (group) el.data.fullLabel = group.join(' ≡ ');
      }
      // The inference reveal: derived memberships place the same instance inside
      // additional class containers, styled dashed/italic. Only memberships, never
      // hierarchy structure — inferred subClassOf transitivity would make the
      // first-parent-wins nesting order-dependent and flatten Author out of Person.
      this._appendInferredMembers(elements, inferredMembers);
      this._renderHierarchy(elements);
    } catch (err) {
      console.error('EntityPanel query failed:', err);
    }
  }

  // Equivalence assertions across the cumulative scope, inferred companions included
  // (so reasoner-derived equivalences merge too). Direction and transitivity are
  // handled in JS by equivalenceGroups — this just collects the raw pairs.
  _equivalenceQuery() {
    return `
      SELECT DISTINCT ?a ?b WHERE {
        GRAPH ?g {
          ${this._graphsWithInferredValuesClause()}
          { ?a <${OWL}sameAs> ?b } UNION { ?a <${OWL}equivalentClass> ?b }
          FILTER(!isBlank(?a))
          FILTER(!isBlank(?b))
          FILTER(?a != ?b)
        }
      }
    `;
  }

  // The <lab-iri>-inferred companions only (scope-aware) — used to find memberships the
  // reasoner derived, as opposed to the asserted memberships the hierarchy query returns.
  _inferredGraphsValuesClause() {
    const graphs = this._scopeGraphs().map(g => `${g}-inferred`);
    return `VALUES ?g { ${graphs.map(g => `<${g}>`).join(' ')} }`;
  }

  _inferredMembershipQuery() {
    return `
      SELECT DISTINCT ?class ?instance ?instanceLabel WHERE {
        GRAPH ?g {
          ${this._inferredGraphsValuesClause()}
          ?instance a ?class .
          FILTER(!isBlank(?instance))
          FILTER(!isBlank(?class))
          OPTIONAL { ?instance <${RDFS}label> ?instanceLabel }
        }
      }
    `;
  }

  // Place reasoner-derived memberships into the already-built compound hierarchy: the
  // same instance appears inside each additional class container, dashed/italic. Rules:
  //   • class is canonicalized through the equivalence map, so a membership inferred
  //     against schema:Person lands in the merged Person container;
  //   • only existing containers — a class with no asserted presence (hence no
  //     container) doesn't get conjured by an inferred membership;
  //   • asserted membership wins — if the dot is already there solid, no dashed twin.
  _appendInferredMembers(elements, bindings) {
    const have = new Set(elements.map(e => e.data.id));

    for (const b of bindings) {
      const rawClass = b.get('class')?.value;
      const instance = b.get('instance')?.value;
      if (!rawClass || !instance) continue;
      const classIri = this._classCanon.get(rawClass) || rawClass;
      if (!have.has(classIri)) continue;            // no asserted container for this class
      const key = `${instance}__in__${classIri}`;
      if (have.has(key)) continue;                  // asserted membership already renders solid
      have.add(key);
      elements.push({
        data: {
          id: key,
          entityIri: instance,
          label: b.get('instanceLabel')?.value || localName(instance),
          fullLabel: instance,
          parent: classIri,
          nodeType: 'instance'
        },
        classes: 'instance-node inferred'
      });
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

  // Graphs in the current scope: 'mine' = this lab's named graph only, 'all' = every
  // lab's graph up to and including this one (the same cumulative scope sem-lab gives
  // Full Graph). Every query in this panel derives its VALUES clause from here, so the
  // toggle uniformly narrows the hierarchy, equivalence merging, and the detail pane.
  _scopeGraphs() {
    return this._scope === 'mine'
      ? [this._labUri]
      : this.notebook.graphsUpTo(this._labUri);
  }

  _graphsValuesClause() {
    return `VALUES ?g { ${this._scopeGraphs().map(g => `<${g}>`).join(' ')} }`;
  }

  // The canonical class plus all its transitive subclasses (reflexive closure over
  // _classChildren). Cycle-guarded via the visited set.
  _descendantClasses(canonIri) {
    const out = new Set([canonIri]);
    const stack = [canonIri];
    while (stack.length) {
      for (const child of this._classChildren.get(stack.pop()) || []) {
        if (!out.has(child)) { out.add(child); stack.push(child); }
      }
    }
    return out;
  }

  // Expand a set of canonical class IRIs to every alias IRI in their equivalence groups,
  // so a member query matches instances typed with any spelling (an instance typed
  // schema:Author still counts toward the merged ex:Author set).
  _expandAliases(canonSet) {
    const all = new Set();
    for (const c of canonSet) {
      for (const alias of this._classGroups.get(c) || [c]) all.add(alias);
    }
    return all;
  }

  // Same scope, but also spanning each lab graph's <lab-iri>-inferred companion — for
  // the views that distinguish asserted vs inferred rows (ADR-031/032).
  _graphsWithInferredValuesClause() {
    const graphs = this._scopeGraphs().flatMap(g => [g, `${g}-inferred`]);
    return `VALUES ?g { ${graphs.map(g => `<${g}>`).join(' ')} }`;
  }

  // Class selection shows the class as a first-class resource: everything asserted (and
  // inferred — italic) about it, then its members, inferred memberships italic too. A
  // merged container stands for its whole equivalence group, so both queries span every
  // grouped IRI: members of ANY of them belong to the (single) set being shown, and
  // assertions on ANY of them describe it.
  async _renderClassDetail(classIri) {
    const group = this._classGroups.get(classIri) || [classIri];
    const groupValues = group.map(c => `<${c}>`).join(' ');

    const assertionsSparql = `
      SELECT ?property ?value ?g WHERE {
        GRAPH ?g {
          ${this._graphsWithInferredValuesClause()}
          ?classIri ?property ?value .
          VALUES ?classIri { ${groupValues} }
          FILTER(!STRSTARTS(STR(?property), "https://sembook.example.org/vocab#"))
        }
      }
      ORDER BY ?property
    `;
    // Members include instances of every (transitive) subclass — a set contains all its
    // descendants' instances (an Author is a Person). memberClassValues spans the whole
    // subtree's aliases; directMemberValues is just the selected class's own aliases, used
    // (asserted graphs only) to decide which members are DIRECT (roman) vs members only by
    // subclass/inference (italic — same "membership you didn't type" grammar as the
    // inferred dots in the graph).
    const memberClassIris = [...this._expandAliases(this._descendantClasses(classIri))];
    const memberClassValues = memberClassIris.map(c => `<${c}>`).join(' ');
    const membersSparql = `
      SELECT DISTINCT ?instance ?label WHERE {
        GRAPH ?g {
          ${this._graphsWithInferredValuesClause()}
          ?instance a ?memberClass .
          VALUES ?memberClass { ${memberClassValues} }
          FILTER(!isBlank(?instance))
          OPTIONAL { ?instance <${RDFS}label> ?label }
        }
      }
    `;
    const directMembersSparql = `
      SELECT DISTINCT ?instance WHERE {
        GRAPH ?g {
          ${this._graphsValuesClause()}
          ?instance a ?memberClass .
          VALUES ?memberClass { ${groupValues} }
          FILTER(!isBlank(?instance))
        }
      }
    `;
    const [assertionBindings, memberBindings, directBindings] = await Promise.all([
      this.notebook.query(assertionsSparql),
      this.notebook.query(membersSparql),
      this.notebook.query(directMembersSparql)
    ]);

    // Keep the DIRECT (asserted) equivalence statements — a merged class may carry
    // several genuine `owl:sameAs`/`owl:equivalentClass` assertions the author typed, and
    // those belong in the list. Drop only the INFERRED equivalences that point back at one
    // of the node's own aliases: in a node presented as one resource, the reasoner's
    // symmetric/transitive `Author sameAs <another alias of Author>` reads as "the same as
    // itself" and just multiplies with group size. Equivalences pointing at a *different*
    // resource, and every non-equivalence statement (e.g. inferred `subClassOf
    // schema:Person`), are kept in both their asserted and inferred spellings.
    const isInferred = (b) => { const g = b.get('g'); return !!(g && g.value.endsWith('-inferred')); };
    const redundantEquiv = (b) => {
      const p = b.get('property').value;
      if (p !== `${OWL}sameAs` && p !== `${OWL}equivalentClass`) return false;
      if (!isInferred(b)) return false; // the author's own assertion — always keep
      const objVal = b.get('value').value;
      const objCanon = this._classCanon.get(objVal) || objVal;
      return objCanon === classIri; // inferred sameness with one of its own aliases → noise
    };
    const assertionRows = dedupeInferredRows(
      assertionBindings.filter(b => !redundantEquiv(b)),
      b => `${b.get('property').value} ${b.get('value').value}`
    ).map(({ b, inferred }) => ({
      prop: b.get('property').value,
      val: b.get('value').value,
      inferred
    }));

    // Direct = asserted `?instance a <this class>`; everything else in the member set is
    // here by subclass or by reasoner inference → italic.
    const directSet = new Set(directBindings.map(b => b.get('instance').value));
    const seen = new Set();
    const memberRows = [];
    for (const b of memberBindings) {
      const iri = b.get('instance').value;
      if (seen.has(iri)) continue;
      seen.add(iri);
      memberRows.push({
        iri,
        label: b.get('label')?.value || localName(iri),
        inferred: !directSet.has(iri)
      });
    }
    // Direct members first, then inferred/subclass ones; stable and alphabetical within.
    memberRows.sort((a, b) =>
      (a.inferred - b.inferred) || a.label.localeCompare(b.label));

    const className = localName(classIri);
    const groupNote = group.length > 1
      ? `<span style="color:#94a3b8;font-size:0.75rem;font-weight:400;display:block;word-break:break-all;">${group.join(' ≡ ')}</span>`
      : `<span style="color:#94a3b8;font-size:0.75rem;font-weight:400;display:block;word-break:break-all;">${classIri}</span>`;
    let html = `<h3 style="font-size:0.875rem;font-weight:600;color:#0f766e;margin-bottom:0.75rem;">
      ${className}
      ${groupNote}
    </h3>`;

    html += sectionLabelHtml('Assertions');
    html += assertionRows.length
      ? propertyTableHtml(assertionRows)
      : '<p style="color:#94a3b8;font-size:0.875rem;">None</p>';

    html += sectionLabelHtml(`Members · ${memberRows.length}`);
    if (memberRows.length === 0) {
      html += '<p style="color:#94a3b8;font-size:0.875rem;">No instances defined</p>';
    } else {
      html += '<ul style="list-style:none;padding:0;margin:0;">';
      for (const { iri, label, inferred } of memberRows) {
        const italic = inferred ? 'font-style:italic;' : '';
        html += `
          <li style="padding:0.375rem 0;border-bottom:1px solid #f1f5f9;font-size:0.875rem;${italic}">
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
          ${this._graphsWithInferredValuesClause()}
          <${instanceIri}> ?property ?value .
          FILTER(!STRSTARTS(STR(?property), "https://sembook.example.org/vocab#"))
        }
      }
      ORDER BY ?property
    `;
    const bindings = await this.notebook.query(sparql);
    const label = localName(instanceIri);

    // Dedup property/value pairs across the asserted and inferred graphs, with assertion
    // winning (dedupeInferredRows); a pair present only in an <lab-iri>-inferred graph
    // renders italic via the shared table builder. Values are NOT canonicalized here —
    // an instance's inferred membership in an equivalent class (`type schema:Author`
    // alongside asserted `type ex:Author`) is a real derivation worth showing, italic.
    const rows = dedupeInferredRows(
      bindings,
      b => `${b.get('property').value} ${b.get('value').value}`
    ).map(({ b, inferred }) => ({
      prop: b.get('property').value,
      val: b.get('value').value,
      inferred
    }));

    let html = `<h3 style="font-size:0.875rem;font-weight:600;color:#0f766e;margin-bottom:0.75rem;">
      ${label}
      <span style="color:#94a3b8;font-size:0.75rem;font-weight:400;display:block;">${instanceIri}</span>
    </h3>`;

    if (rows.length === 0) {
      html += '<p style="color:#94a3b8;font-size:0.875rem;">No properties asserted</p>';
    } else {
      html += propertyTableHtml(rows);
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
      await this._renderClassDetail(this._selectedIri);
    } else {
      await this._renderInstanceProperties(this._selectedIri);
    }
  }

  disconnectedCallback() {
    this._resizeObserver?.disconnect();
    this._cy?.destroy();
    this._cy = null;
  }
}

customElements.define('sem-panel-entity', SemPanelEntity);
