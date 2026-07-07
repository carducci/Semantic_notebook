// cytoscape is loaded globally via <script> tag in index.html — no module import needed.

import { hierarchyToElements, localName } from '../scripts/parse-utils.js';

// ── Namespaces ───────────────────────────────────────────────────────────────
// Row exclusion is about hiding the *description machinery*, not domain vocabulary.
// A term in one of these namespaces never earns its own browsable row — but it still
// appears in the right-hand detail pane (which has no namespace filter), because that's
// where a term's own `a rdfs:Class` / `rdfs:label` / `subPropertyOf` assertions belong.
//   (a) sembook: — the existing infrastructure-exclusion convention every panel uses.
//   (b) The RDF/OWL/SHACL/XSD meta-vocabulary — rdfs:label, rdfs:subPropertyOf,
//       owl:ObjectProperty, xsd:string, etc. These are how you *assert* things about
//       your terms, not terms you're authoring, so they'd be noise as rows.
// schema: is deliberately NOT here: it's domain vocabulary the author writes with, so a
// term's *use* of schema:name (or a reference to schema:bar) earns a row like any ex: term.
// The deferred "schema.org inclusion" feature only adds schema.org's own *definitions*
// later (which would flip those rows from identity-only to described) — it does not gate
// whether the author's own use of a schema: term shows up here.
const SEMBOOK_NS = 'https://sembook.example.org/vocab#';
const STD_VOCAB_NS = [
  'http://www.w3.org/1999/02/22-rdf-syntax-ns#', // rdf:
  'http://www.w3.org/2000/01/rdf-schema#',       // rdfs:
  'http://www.w3.org/2002/07/owl#',              // owl:
  'http://www.w3.org/ns/shacl#',                 // shacl:
  'http://www.w3.org/2001/XMLSchema#'            // xsd:
];
const EXCLUDED_NS = [SEMBOOK_NS, ...STD_VOCAB_NS];

const RDFS = 'http://www.w3.org/2000/01/rdf-schema#';
const OWL  = 'http://www.w3.org/2002/07/owl#';
const RDF  = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';

// A term is DESCRIBED (as opposed to identity-only) if, as a subject, it carries any of
// these predicates, or an rdf:type whose object is one of the described-type IRIs below.
const DESCRIBED_PREDICATES = [
  `${RDFS}label`, `${RDFS}comment`, `${RDFS}domain`, `${RDFS}range`,
  `${RDFS}subClassOf`, `${RDFS}subPropertyOf`,
  `${OWL}equivalentClass`, `${OWL}equivalentProperty`, `${OWL}inverseOf`
];
const DESCRIBED_TYPES = [
  `${RDFS}Class`,
  `${RDF}Property`,               // the standard property-declaration type (rdf:Property)
  `${OWL}Class`, `${OWL}ObjectProperty`, `${OWL}DatatypeProperty`,
  `${OWL}SymmetricProperty`, `${OWL}TransitiveProperty`,
  `${OWL}FunctionalProperty`, `${OWL}InverseFunctionalProperty`
];

// ── Colour tokens ────────────────────────────────────────────────────────────
// Reused verbatim from sem-panel-graph.js's blank-node→IRI transition — same values,
// no new colour token. DESCRIBED reads like a settled IRI (teal, solid); identity-only
// reads like an as-yet-unelaborated blank node (amber, dashed).
const DESCRIBED_FILL   = '#0d9488';
const DESCRIBED_BORDER = '#0f766e';
const IDENTITY_FILL    = '#d97706';
const IDENTITY_BORDER  = '#b45309';

const classStylesheet = [
  {
    selector: 'node.class-node',
    style: {
      'shape': 'round-rectangle',
      'border-width': 2,
      'label': 'data(label)',
      'text-valign': 'center',
      'text-halign': 'center',
      'font-size': '12px',
      'font-weight': 'bold',
      'color': '#ffffff',
      'width': 'label',
      'height': 'label',
      'padding': '10px'
    }
  },
  // Leaf-node fills use the solid tokens; compound parents get the same colour at low
  // opacity (label anchored top) so their nested subclasses stay readable — the fill
  // value is unchanged, only its opacity, so this introduces no new colour.
  {
    selector: 'node.class-node.described',
    style: { 'background-color': DESCRIBED_FILL, 'border-color': DESCRIBED_BORDER, 'border-style': 'solid' }
  },
  {
    selector: 'node.class-node.identity-only',
    style: { 'background-color': IDENTITY_FILL, 'border-color': IDENTITY_BORDER, 'border-style': 'dashed' }
  },
  {
    selector: 'node.class-node:parent',
    style: { 'background-opacity': 0.15, 'text-valign': 'top', 'padding': '20px', 'text-margin-y': '-4px', 'color': DESCRIBED_BORDER }
  },
  {
    selector: 'node.class-node.identity-only:parent',
    style: { 'color': IDENTITY_BORDER }
  },
  {
    selector: 'node:selected',
    style: { 'border-color': '#7c3aed', 'border-width': 3 }
  }
];

// Grid, not a force layout: vocabulary classes are mostly disconnected (there are no
// edges between them — subclassing is compound containment, not an edge), and cose flings
// disconnected components apart, so fit zooms out until nodes are unreadably tiny. Grid
// keeps them compact and is still compound-aware (subclasses stay nested in their parent).
const classLayout = {
  name: 'grid',
  fit: true,
  padding: 20,
  avoidOverlap: true,
  avoidOverlapPadding: 20,
  animate: true,
  animationDuration: 300
};

export class SemPanelVocab extends HTMLElement {
  constructor() {
    super();
    this.notebook = null;
    this._labUri = null;
    this._cy = null;
    this._selectedIri = null;
    this._classesPane = null;
    this._propsPane = null;
    this._detailPane = null;
  }

  // Called by sem-lab after appendChild
  init(notebook, notebookDoc) {
    this.notebook = notebook;
    this._labUri = this.closest('sem-lab')?.getAttribute('uri');
  }

  connectedCallback() {
    // TabsPanel appends this from a detached container after init() already ran, so
    // closest('sem-lab') can be null at init() time — re-resolve once truly connected.
    this._labUri = this.closest('sem-lab')?.getAttribute('uri');

    this.style.display = 'grid';
    this.style.gridTemplateColumns = '60% 40%';
    this.style.width = '100%';
    this.style.height = '100%';
    this.style.overflow = 'hidden';

    // Left column — Classes and Properties as tabs, not stacked. Stacking forced a fixed
    // height split, which left the Properties list unreadably short whenever the Classes
    // graph was busy; a tab gives whichever view is active the full column height.
    const leftCol = document.createElement('div');
    leftCol.style.cssText = 'display:flex;flex-direction:column;height:100%;min-width:0;border-right:1px solid #e2e8f0;';

    const tabBar = document.createElement('div');
    tabBar.style.cssText = 'flex:none;display:flex;gap:0.25rem;padding:0.25rem 0.5rem 0;background:#f8fafc;border-bottom:1px solid #e2e8f0;';
    this._classesTab = this._tabButton('Classes');
    this._propsTab = this._tabButton('Properties');
    this._classesTab.addEventListener('click', () => this._showTab('classes'));
    this._propsTab.addEventListener('click', () => this._showTab('properties'));
    tabBar.appendChild(this._classesTab);
    tabBar.appendChild(this._propsTab);

    // Both panes fill the same box (absolute inset:0); the inactive one is display:none.
    const content = document.createElement('div');
    content.style.cssText = 'position:relative;flex:1;min-height:0;';

    this._classesPane = document.createElement('div');
    this._classesPane.style.cssText = 'position:absolute;inset:0;overflow:hidden;';

    this._propsPane = document.createElement('div');
    this._propsPane.style.cssText = 'position:absolute;inset:0;overflow-y:auto;padding:0.25rem 0;';

    content.appendChild(this._classesPane);
    content.appendChild(this._propsPane);
    leftCol.appendChild(tabBar);
    leftCol.appendChild(content);

    // Right column — detail table for the selected term
    this._detailPane = document.createElement('div');
    this._detailPane.style.cssText = 'width:100%;height:100%;overflow-y:auto;padding:1rem;';

    this.appendChild(leftCol);
    this.appendChild(this._detailPane);

    this._renderEmptyClasses();
    this._renderEmptyProps();
    this._renderEmptyDetail();
    this._showTab('classes');

    // Cytoscape reads its container size once at construction; while its tab is
    // display:none it measures 0×0. Resize + re-fit whenever the real box lands — both on
    // tab-switch (see _showTab) and here (same rationale as sem-panel-graph.js).
    this._resizeObserver = new ResizeObserver(() => {
      this._cy?.resize();
      this._cy?.fit(undefined, classLayout.padding);
    });
    this._resizeObserver.observe(this._classesPane);
  }

  disconnectedCallback() {
    this._resizeObserver?.disconnect();
    this._cy?.destroy();
    this._cy = null;
  }

  _tabButton(label) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.label = label;
    btn.textContent = label;
    btn.style.cssText = 'flex:none;padding:0.375rem 0.75rem;font-size:0.75rem;font-weight:600;letter-spacing:0.03em;border:none;border-bottom:2px solid transparent;background:transparent;color:#64748b;cursor:pointer;';
    return btn;
  }

  _showTab(name) {
    this._activeTab = name;
    const onClasses = name === 'classes';
    this._classesPane.style.display = onClasses ? 'block' : 'none';
    this._propsPane.style.display = onClasses ? 'none' : 'block';
    this._styleTab(this._classesTab, onClasses);
    this._styleTab(this._propsTab, !onClasses);
    if (onClasses && this._cy) {
      this._cy.resize();
      if (this._classesDirty) {
        // Layout was computed while hidden (0×0) — recompute now the box is real.
        this._cy.layout(classLayout).run();
        this._classesDirty = false;
      } else {
        // Cytoscape can't measure while display:none — re-fit now it's visible.
        this._cy.fit(undefined, classLayout.padding);
      }
    }
  }

  _styleTab(btn, active) {
    btn.style.color = active ? '#0f766e' : '#64748b';
    btn.style.borderBottomColor = active ? '#0d9488' : 'transparent';
  }

  // Append a live count to a tab label so the inactive tab still advertises its contents
  // (the original stacked layout at least showed both lists; tabs must not hide that a
  // term is waiting on the other tab).
  _setTabCount(name, n) {
    const btn = name === 'classes' ? this._classesTab : this._propsTab;
    btn.textContent = n > 0 ? `${btn.dataset.label} · ${n}` : btn.dataset.label;
  }

  // The cumulative VALUES ?g {...} clause spanning every lab's named graph up to and
  // including this one — the same cumulative scope sem-lab.js gives Full Graph and the
  // entity/vocabulary panels, so a term introduced two labs ago is still in view.
  _cumulativeGraphsValuesClause() {
    const graphs = this.notebook.graphsUpTo(this._labUri);
    return `VALUES ?g { ${graphs.map(g => `<${g}>`).join(' ')} }`;
  }

  _excludeNsFilters(varName) {
    return EXCLUDED_NS.map(ns => `FILTER(!STRSTARTS(STR(?${varName}), "${ns}"))`).join('\n        ');
  }

  // Called by sem-lab when graph:updated fires for this lab (via notebook.subscribe)
  async onGraphUpdated(labUri) {
    if (!this.notebook) return;

    try {
      const [classBindings, propBindings, describedBindings] = await Promise.all([
        this.notebook.query(this._classesQuery()),
        this.notebook.query(this._propertiesQuery()),
        this.notebook.query(this._describedQuery())
      ]);

      const describedSet = new Set(describedBindings.map(b => b.get('term').value));

      this._renderClasses(classBindings, describedSet);
      this._renderProperties(propBindings, describedSet);

      // A graph change may have added properties to the selected term — refresh detail.
      if (this._selectedIri) await this._renderDetail(this._selectedIri);
    } catch (err) {
      console.error('VocabPanel query failed:', err);
    }
  }

  // ── Queries ────────────────────────────────────────────────────────────────

  // Row-candidate classes: a non-excluded term earns a class row when it was explicitly
  // asserted as a class in the lab, by any of —
  //   • USED:        `?s a ?class`  (some non-excluded thing is typed with it)
  //   • DECLARED:    `?class a rdfs:Class | owl:Class`
  //   • SUBJECT of:  `?class rdfs:subClassOf ?x` / `?class owl:equivalentClass ?x`
  //   • OBJECT of:   `?x rdfs:subClassOf ?class` / `?x owl:equivalentClass ?class`
  // The object-of branches keep a referenced parent class (e.g. the super in
  // `ex:Novel rdfs:subClassOf ex:Book`) as a row so the compound hierarchy can nest under
  // it. subClassOf parents are pulled in optionally; any parent that still isn't a
  // candidate is pruned in JS before layout.
  _classesQuery() {
    return `
      SELECT DISTINCT ?class ?parentClass WHERE {
        GRAPH ?g {
          ${this._cumulativeGraphsValuesClause()}
          {
            ?s a ?class .
            FILTER(?s != ?class)
            ${this._excludeNsFilters('s')}
          } UNION {
            ?class a ?classDeclType .
            VALUES ?classDeclType { <${RDFS}Class> <${OWL}Class> }
          } UNION {
            ?class <${RDFS}subClassOf> ?superOfClass .
          } UNION {
            ?subOfClass <${RDFS}subClassOf> ?class .
          } UNION {
            ?class <${OWL}equivalentClass> ?eqClassObj .
          } UNION {
            ?eqClassSubj <${OWL}equivalentClass> ?class .
          }
          FILTER(!isBlank(?class))
          ${this._excludeNsFilters('class')}
          OPTIONAL {
            ?class <${RDFS}subClassOf> ?parentClass .
            FILTER(!isBlank(?parentClass))
            ${this._excludeNsFilters('parentClass')}
          }
        }
      }
    `;
  }

  // Row-candidate properties: a non-excluded term earns a property row when it was
  // explicitly asserted as a property in the lab, by any of —
  //   • USED:        `?s ?property ?o`  (it appears as a predicate)
  //   • DECLARED:    `?property a rdf:Property | owl:ObjectProperty | owl:DatatypeProperty | …`
  //   • SUBJECT of:  subPropertyOf / domain / range / equivalentProperty / inverseOf
  //   • OBJECT of:   `?x subPropertyOf ?property` / equivalentProperty / inverseOf
  // The object-of branches are what surface a referenced parent like `schema:bar` in
  // `ex:Foo rdfs:subPropertyOf schema:bar`, so ex:Foo can indent beneath it. Excluding the
  // meta-vocabulary namespaces is what still keeps rdf:type, rdfs:label, rdfs:subPropertyOf
  // itself, etc. out of the list — they're the machinery, not authored properties.
  _propertiesQuery() {
    return `
      SELECT DISTINCT ?property ?parentProperty WHERE {
        GRAPH ?g {
          ${this._cumulativeGraphsValuesClause()}
          {
            ?s ?property ?o .
          } UNION {
            ?property a ?propDeclType .
            VALUES ?propDeclType {
              <${RDF}Property> <${OWL}ObjectProperty> <${OWL}DatatypeProperty>
              <${OWL}SymmetricProperty> <${OWL}TransitiveProperty>
              <${OWL}FunctionalProperty> <${OWL}InverseFunctionalProperty>
            }
          } UNION {
            ?property <${RDFS}subPropertyOf> ?superOfProp .
          } UNION {
            ?subOfProp <${RDFS}subPropertyOf> ?property .
          } UNION {
            ?property <${RDFS}domain> ?domainOfProp .
          } UNION {
            ?property <${RDFS}range> ?rangeOfProp .
          } UNION {
            ?property <${OWL}equivalentProperty> ?eqPropObj .
          } UNION {
            ?eqPropSubj <${OWL}equivalentProperty> ?property .
          } UNION {
            ?property <${OWL}inverseOf> ?invObj .
          } UNION {
            ?invSubj <${OWL}inverseOf> ?property .
          }
          FILTER(!isBlank(?property))
          ${this._excludeNsFilters('property')}
          OPTIONAL {
            ?property <${RDFS}subPropertyOf> ?parentProperty .
            FILTER(!isBlank(?parentProperty))
            ${this._excludeNsFilters('parentProperty')}
          }
        }
      }
    `;
  }

  // Terms that are DESCRIBED (carry a describing predicate, or a describing rdf:type).
  // Intersected with the candidate sets in JS to decide teal-solid vs amber-dashed.
  _describedQuery() {
    const predValues = DESCRIBED_PREDICATES.map(p => `<${p}>`).join(' ');
    const typeValues = DESCRIBED_TYPES.map(t => `<${t}>`).join(' ');
    return `
      SELECT DISTINCT ?term WHERE {
        GRAPH ?g {
          ${this._cumulativeGraphsValuesClause()}
          {
            ?term ?dp ?dv .
            VALUES ?dp { ${predValues} }
          } UNION {
            ?term a ?dt .
            VALUES ?dt { ${typeValues} }
          }
        }
      }
    `;
  }

  // Every triple where the selected term is the subject — NO namespace filter, so a
  // term's own self-description (`ex:Book a rdfs:Class`, rdfs:label, …) shows exactly as
  // asserted. Same predicate/object table shape as sem-panel-entity's _renderInstanceProperties.
  _detailQuery(termIri) {
    return `
      SELECT ?property ?value WHERE {
        GRAPH ?g {
          ${this._cumulativeGraphsValuesClause()}
          <${termIri}> ?property ?value .
        }
      }
      ORDER BY ?property
    `;
  }

  // ── Classes (compound graph) ─────────────────────────────────────────────────

  _renderClasses(bindings, describedSet) {
    // Reuse the shared compound-node builder — subClassOf becomes Cytoscape parenthood.
    const elements = hierarchyToElements(bindings);

    this._setTabCount('classes', elements.length);

    if (elements.length === 0) {
      if (this._cy) { this._cy.destroy(); this._cy = null; }
      this._renderEmptyClasses();
      return;
    }

    // Prune parent pointers that reference a non-candidate class (pruned/absent node),
    // and tag each node teal-solid (described) or amber-dashed (identity-only).
    const nodeIds = new Set(elements.map(e => e.data.id));
    for (const el of elements) {
      if (el.data.parent && !nodeIds.has(el.data.parent)) el.data.parent = null;
      el.classes = `${el.classes} ${describedSet.has(el.data.id) ? 'described' : 'identity-only'}`;
    }

    // Destroy-and-recreate per ADR-024 — compound graphs can't be updated incrementally.
    if (this._cy) { this._cy.destroy(); this._cy = null; }
    this._classesPane.innerHTML = '';
    this._cy = cytoscape({
      container: this._classesPane,
      elements,
      style: classStylesheet,
      layout: classLayout
    });

    this._cy.on('tap', 'node.class-node', (e) => this._select(e.target.data('id')));
    this._cy.on('tap', (e) => { if (e.target === this._cy) this._select(null); });
    this._cy.on('mouseover', 'node', (e) => e.target.style('label', e.target.data('fullLabel')));
    this._cy.on('mouseout', 'node', (e) => e.target.style('label', e.target.data('label')));

    // If this rebuild happened while the Classes tab was hidden, the layout just ran
    // against a 0×0 box — re-run it once the tab is next shown (see _showTab).
    this._classesDirty = this._activeTab !== 'classes';
  }

  _renderEmptyClasses() {
    this._classesPane.innerHTML =
      '<p style="color:#94a3b8;font-size:0.8rem;padding:0.75rem;">No classes in use yet</p>';
  }

  // ── Properties (indented flat list) ──────────────────────────────────────────

  _renderProperties(bindings, describedSet) {
    const candidates = new Set();
    const rawParent = new Map(); // property → first subPropertyOf parent seen
    for (const b of bindings) {
      const prop = b.get('property').value;
      candidates.add(prop);
      const parent = b.get('parentProperty')?.value;
      if (parent && !rawParent.has(prop)) rawParent.set(prop, parent);
    }

    this._setTabCount('properties', candidates.size);

    if (candidates.size === 0) {
      this._renderEmptyProps();
      return;
    }

    // Build a subPropertyOf forest over candidate properties only; a parent that isn't a
    // candidate itself is treated as a root, mirroring the class dangling-parent pruning.
    const childrenOf = new Map();
    const roots = [];
    for (const p of candidates) childrenOf.set(p, []);
    for (const p of candidates) {
      const parent = rawParent.get(p);
      if (parent && parent !== p && candidates.has(parent)) {
        childrenOf.get(parent).push(p);
      } else {
        roots.push(p);
      }
    }
    const byName = (a, b) => localName(a).localeCompare(localName(b));
    roots.sort(byName);
    for (const list of childrenOf.values()) list.sort(byName);

    const ordered = [];
    const visited = new Set();
    const walk = (iri, depth) => {
      if (visited.has(iri)) return; // guards subPropertyOf cycles
      visited.add(iri);
      ordered.push({ iri, depth });
      for (const child of childrenOf.get(iri)) walk(child, depth + 1);
    };
    for (const r of roots) walk(r, 0);
    for (const p of candidates) if (!visited.has(p)) ordered.push({ iri: p, depth: 0 });

    this._propsPane.innerHTML = '';
    for (const { iri, depth } of ordered) {
      this._propsPane.appendChild(this._propRow(iri, depth, describedSet.has(iri)));
    }
  }

  _propRow(iri, depth, described) {
    const fill = described ? DESCRIBED_FILL : IDENTITY_FILL;
    const border = described ? DESCRIBED_BORDER : IDENTITY_BORDER;
    const borderStyle = described ? 'solid' : 'dashed';
    const pad = 8 + depth * 16;
    const selected = iri === this._selectedIri;

    const row = document.createElement('button');
    row.type = 'button';
    row.dataset.iri = iri;
    row.style.cssText =
      `display:flex;align-items:center;gap:0.5rem;width:100%;text-align:left;` +
      `padding:0.375rem 0.5rem 0.375rem ${pad}px;` +
      `border:none;border-left:3px ${borderStyle} ${border};` +
      `background:${selected ? '#ede9fe' : 'transparent'};cursor:pointer;font-size:0.8rem;`;
    row.innerHTML =
      `<span style="display:inline-block;width:11px;height:11px;border-radius:2px;` +
      `background:${fill};border:1.5px ${borderStyle} ${border};flex:none;"></span>` +
      `<span style="color:#1e293b;word-break:break-all;">${localName(iri)}</span>`;
    row.addEventListener('click', () => this._select(iri));
    return row;
  }

  _renderEmptyProps() {
    this._propsPane.innerHTML =
      '<p style="color:#94a3b8;font-size:0.8rem;padding:0.75rem;">No properties in use yet</p>';
  }

  // ── Selection + detail ───────────────────────────────────────────────────────

  _select(iri) {
    this._selectedIri = iri;

    // Reflect selection in the property list (re-tint rows) and the class graph.
    this._propsPane.querySelectorAll('button[data-iri]').forEach(row => {
      row.style.background = row.dataset.iri === iri ? '#ede9fe' : 'transparent';
    });
    if (this._cy) {
      this._cy.$(':selected').unselect();
      if (iri) this._cy.$id(iri).select();
    }

    if (iri) this._renderDetail(iri);
    else this._renderEmptyDetail();
  }

  async _renderDetail(termIri) {
    const bindings = await this.notebook.query(this._detailQuery(termIri));
    const label = localName(termIri);

    let html = `<h3 style="font-size:0.875rem;font-weight:600;color:#0f766e;margin-bottom:0.75rem;">
      ${label}
      <span style="color:#94a3b8;font-size:0.75rem;font-weight:400;display:block;word-break:break-all;">${termIri}</span>
    </h3>`;

    if (bindings.length === 0) {
      html += '<p style="color:#94a3b8;font-size:0.875rem;">No triples asserted</p>';
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

    this._detailPane.innerHTML = html;
  }

  _renderEmptyDetail() {
    this._detailPane.innerHTML =
      '<p style="color:#94a3b8;font-size:0.875rem;">Select a class or property</p>';
  }
}

customElements.define('sem-panel-vocab', SemPanelVocab);
