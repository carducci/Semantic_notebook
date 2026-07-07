// Row-resizer tuning for labs whose sembook:cssClass declares a two-value
// grid-rows-[A_B] track (e.g. "40vh_60vh"). Single-value labs (e.g. "[1fr]")
// never match _parseRowRatios and fall through to the plain, non-resizable path.
const HANDLE_PX = 10;
const STRIP_PX = 36;
const SNAP_PX = 60; // release within this distance of an edge snaps to collapsed

export class SemLab extends HTMLElement {
  connectedCallback() {
    this._intersected = false;
    this._notebook = null;
    this._notebookDoc = null;
    this._built = false;

    this.renderSkeleton();

    this._observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            this._intersected = true;
            this._maybeBuild();
          }
        }
      },
      { threshold: 0.15 }
    );
    this._observer.observe(this);

    // sem-lab is present in the static HTML from page load, so this listener is
    // registered well before bootstrap() (invoked at the bottom of this script)
    // ever fires notebook:ready.
    this._onNotebookReady = (e) => {
      this._notebook = e.detail.notebook;
      this._notebookDoc = e.detail.notebookDoc;
      this._applyLayoutClass();
      this._maybeBuild();
    };
    document.addEventListener('notebook:ready', this._onNotebookReady);
  }

  disconnectedCallback() {
    this._observer?.disconnect();
    document.removeEventListener('notebook:ready', this._onNotebookReady);
  }

  get uri() { return this.getAttribute('uri'); }

  renderSkeleton() {
    this.innerHTML = `
      <div class="col-span-1 border-r border-slate-300 bg-slate-200 animate-pulse"></div>
      <div class="col-span-1 bg-slate-200 animate-pulse"></div>
      <div class="col-span-2 border-t border-slate-300 bg-slate-100 animate-pulse"></div>
    `;
  }

  _applyLayoutClass() {
    const lab = this._findLabNode();
    const cssClass = lab?.['sembook:cssClass'];
    if (!cssClass) return;
    // Additive — preserves the page-chrome classes already on the element
    // rather than replacing them, since the definition doesn't own those.
    this.classList.add(...cssClass.split(/\s+/).filter(Boolean));
  }

  _maybeBuild() {
    if (this._built || !this._intersected || !this._notebook) return;
    this._built = true;
    this._build();
  }

  _findLabNode() {
    const graph = this._notebookDoc['@graph'] || [];
    return graph.find(n => n['@id'] === this.uri);
  }

  _build() {
    const lab = this._findLabNode();
    this.innerHTML = '';
    if (!lab) return;

    const panelDefs = lab['sembook:panels'] || [];
    const rowRatios = this._parseRowRatios(lab['sembook:cssClass']);

    if (rowRatios && panelDefs.length > 1) {
      const colCount = this._parseColCount(lab['sembook:cssClass']);
      this._buildResizableRows(panelDefs, rowRatios, colCount);
      return;
    }

    for (const panelDef of panelDefs) {
      const el = this._buildPanel(panelDef);
      // Single append site for every panel type — appending an already-appended
      // node a second time triggers a disconnect/reconnect cycle, which previously
      // reset sem-panel-jsonld's notebook reference back to null after init().
      this.appendChild(el);
      this._initPanelEl(el, panelDef);
    }
  }

  // Matches a two-value grid-rows-[A_B] track (e.g. "40vh_60vh") in the lab's
  // cssClass. Single-value tracks (e.g. "[1fr]") return null so those labs keep
  // the plain, non-resizable build path.
  _parseRowRatios(cssClass) {
    if (!cssClass) return null;
    const match = cssClass.match(/grid-rows-\[([\d.]+)[a-z%]*_([\d.]+)[a-z%]*\]/i);
    if (!match) return null;
    const a = parseFloat(match[1]);
    const b = parseFloat(match[2]);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
    return [a, b];
  }

  // Reads the lab's own explicit column count (e.g. "grid-cols-2") so the
  // resizable-rows layout below can span exactly that many columns rather
  // than a hardcoded 2 — a single-column lab (no grid-cols-N at all, e.g. a
  // full-width lab with one top panel) would otherwise ask its wrapper to
  // span a second column track that was never declared.
  _parseColCount(cssClass) {
    if (!cssClass) return 1;
    const match = cssClass.match(/grid-cols-(\d+)/);
    return match ? parseInt(match[1], 10) : 1;
  }

  _initPanelEl(el, panelDef) {
    if (panelDef['@type'] === 'sembook:JsonLdPanel' || panelDef['@type'] === 'sembook:JsonLdContextPanel' || panelDef['@type'] === 'sembook:TurtleWriterPanel') {
      el.init(this._notebook, this._notebookDoc);
    } else if (panelDef['@type'] === 'sembook:TurtlePanel') {
      el.init(this._notebook, this._notebookDoc);
      this._notebook.subscribe(this.uri, el);
    }
    // sembook:TabsPanel's nested panels are init'd inside _buildTabs.
  }

  // Builds a draggable/collapsible two-row layout: all panels but the last
  // occupy row 1 (side by side, matching the lab's own column count), the last
  // panel occupies row 2. A resizer bar sits between them; dragging it near
  // either edge and releasing snaps that row to a thin, clickable strip.
  _buildResizableRows(panelDefs, rowRatios, colCount = 2) {
    const topDefs = panelDefs.slice(0, -1);
    const bottomDef = panelDefs[panelDefs.length - 1];

    const topWrapper = document.createElement('div');
    // col-span-${colCount} spans the lab's own declared column count (outer
    // grid); grid-cols-${topDefs.length} arranges the top panels side by side
    // within topWrapper's own nested grid — two independent column counts.
    topWrapper.className = `row-start-1 col-span-${colCount} grid grid-cols-${topDefs.length} overflow-hidden min-h-0`;

    const topPairs = [];
    const topLabels = [];
    for (const panelDef of topDefs) {
      const el = this._buildPanel(panelDef);
      topWrapper.appendChild(el);
      topPairs.push([el, panelDef]);
      if (panelDef['sembook:label']) topLabels.push(panelDef['sembook:label']);
    }

    const bottomEl = this._buildPanel(bottomDef);
    bottomEl.classList.add('row-start-3');
    const bottomLabels = (bottomDef['sembook:panels'] || [bottomDef])
      .map(p => p['sembook:label'])
      .filter(Boolean);

    const handle = document.createElement('div');
    handle.className = `row-start-2 col-span-${colCount} flex items-center justify-center bg-slate-200 hover:bg-slate-300 cursor-row-resize select-none border-y border-slate-300`;
    handle.innerHTML = '<div class="w-10 h-1 rounded-full bg-slate-400"></div>';

    const stripBase = `col-span-${colCount} flex w-full items-center justify-center gap-2 text-xs text-slate-500 bg-slate-100 hover:bg-slate-200 border-y border-slate-300 cursor-pointer hidden`;
    const topStrip = document.createElement('button');
    topStrip.type = 'button';
    topStrip.className = `row-start-1 ${stripBase}`;
    topStrip.textContent = `▸ ${topLabels.join(' · ') || 'panel'} — click to expand`;

    const bottomStrip = document.createElement('button');
    bottomStrip.type = 'button';
    bottomStrip.className = `row-start-3 ${stripBase}`;
    bottomStrip.textContent = `▸ ${bottomLabels.join(' · ') || 'panel'} — click to expand`;

    // Connect the whole subtree in one go, then init() each panel — matching
    // the safe order in _build() above, where connectedCallback (which
    // sem-panel-jsonld relies on to have already run) fires during this append,
    // before any init() call.
    this.append(topWrapper, topStrip, handle, bottomEl, bottomStrip);

    for (const [el, panelDef] of topPairs) this._initPanelEl(el, panelDef);
    this._initPanelEl(bottomEl, bottomDef);

    const els = { topWrapper, topStrip, bottomEl, bottomStrip };
    const state = { ratios: rowRatios, lastRatios: rowRatios, collapsed: null };

    this._applyRowState(state, els);
    this._wireResizer(handle, state, els);

    const restore = () => {
      state.collapsed = null;
      state.ratios = state.lastRatios;
      this._applyRowState(state, els);
    };
    topStrip.addEventListener('click', restore);
    bottomStrip.addEventListener('click', restore);
  }

  _applyRowState(state, { topWrapper, topStrip, bottomEl, bottomStrip }) {
    let rows;
    if (state.collapsed === 'top') {
      rows = `${STRIP_PX}px ${HANDLE_PX}px 1fr`;
    } else if (state.collapsed === 'bottom') {
      rows = `1fr ${HANDLE_PX}px ${STRIP_PX}px`;
    } else {
      rows = `${state.ratios[0]}fr ${HANDLE_PX}px ${state.ratios[1]}fr`;
    }
    this.style.gridTemplateRows = rows;

    topWrapper.classList.toggle('hidden', state.collapsed === 'top');
    topStrip.classList.toggle('hidden', state.collapsed !== 'top');
    bottomEl.classList.toggle('hidden', state.collapsed === 'bottom');
    bottomStrip.classList.toggle('hidden', state.collapsed !== 'bottom');
  }

  _wireResizer(handle, state, els) {
    const onPointerMove = (e) => {
      const rect = this.getBoundingClientRect();
      const total = rect.height - HANDLE_PX;
      let topPx = e.clientY - rect.top;
      topPx = Math.max(0, Math.min(total, topPx));
      const bottomPx = total - topPx;

      this.style.gridTemplateRows = `${topPx}px ${HANDLE_PX}px ${bottomPx}px`;
      els.topWrapper.classList.remove('hidden');
      els.topStrip.classList.add('hidden');
      els.bottomEl.classList.remove('hidden');
      els.bottomStrip.classList.add('hidden');

      this._dragTopPx = topPx;
      this._dragBottomPx = bottomPx;
    };

    const onPointerUp = () => {
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', onPointerUp);
      document.body.classList.remove('select-none');

      const topPx = this._dragTopPx;
      const bottomPx = this._dragBottomPx;

      if (topPx < SNAP_PX) {
        state.collapsed = 'top';
      } else if (bottomPx < SNAP_PX) {
        state.collapsed = 'bottom';
      } else {
        state.collapsed = null;
        state.ratios = [topPx, bottomPx];
        state.lastRatios = state.ratios;
      }
      this._applyRowState(state, els);
    };

    handle.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      document.body.classList.add('select-none');
      document.addEventListener('pointermove', onPointerMove);
      document.addEventListener('pointerup', onPointerUp);
    });
  }

  _buildPanel(panelDef) {
    const type = panelDef['@type'];

    if (type === 'sembook:JsonLdPanel') {
      const el = document.createElement('sem-panel-jsonld');
      el.setAttribute('uri', panelDef['@id']);
      el.setAttribute('label', panelDef['sembook:label'] || '');
      if (panelDef['sembook:cssClass']) el.className = panelDef['sembook:cssClass'];
      return el;
    }

    if (type === 'sembook:JsonLdContextPanel') {
      const el = document.createElement('sem-panel-jsonld-split');
      el.setAttribute('uri', panelDef['@id']);
      el.setAttribute('label', panelDef['sembook:label'] || '');
      if (panelDef['sembook:cssClass']) el.className = panelDef['sembook:cssClass'];
      return el;
    }

    if (type === 'sembook:TabsPanel') {
      return this._buildTabs(panelDef);
    }

    if (type === 'sembook:TurtlePanel') {
      const el = document.createElement('sem-panel-turtle');
      el.setAttribute('uri', panelDef['@id'] || '');
      el.setAttribute('label', panelDef['sembook:label'] || '');
      el.setAttribute('sparql', panelDef['sembook:sparql'] || '');
      if (panelDef['sembook:cssClass']) el.className = panelDef['sembook:cssClass'];
      return el;
    }

    if (type === 'sembook:TurtleWriterPanel') {
      const el = document.createElement('sem-panel-turtle-writer');
      el.setAttribute('uri', panelDef['@id'] || '');
      el.setAttribute('label', panelDef['sembook:label'] || '');
      if (panelDef['sembook:cssClass']) el.className = panelDef['sembook:cssClass'];
      return el;
    }

    // Unhandled panel types render as an empty placeholder container this iteration.
    const div = document.createElement('div');
    if (panelDef['sembook:cssClass']) div.className = panelDef['sembook:cssClass'];
    return div;
  }

  // The SPARQL VALUES ?g {...} clause spanning every lab's named graph up to
  // and including this one — the cumulative scope shared by Full Graph and
  // the entity/vocabulary panels.
  _cumulativeGraphsValuesClause() {
    const graphs = this._notebook.graphsUpTo(this.uri);
    return `VALUES ?g { ${graphs.map(g => `<${g}>`).join(' ')} }`;
  }

  // Rewrites a GraphPanel's `GRAPH ?g { ?s ?p ?o } VALUES ?g { … }` query so it also
  // spans each in-scope lab graph's <lab-iri>-inferred companion, and projects ?g so
  // sparqlToElements can style asserted edges solid and inferred ones dashed (ADR-031).
  // Deliberately separate from _cumulativeGraphsValuesClause (used by the entity/vocab
  // panels): pulling the inferred graphs into scope is a graph-view concern only.
  _inferredAwareGraphSparql(sparql, assertedGraphs) {
    const graphs = assertedGraphs.flatMap(g => [g, `${g}-inferred`]);
    const values = `VALUES ?g { ${graphs.map(g => `<${g}>`).join(' ')} }`;
    return sparql
      .replace(/SELECT\s+\?s\s+\?p\s+\?o/, 'SELECT ?s ?p ?o ?g')
      .replace(/VALUES\s+\?g\s*\{[^}]*\}/, values);
  }

  _buildTabs(panelDef) {
    const container = document.createElement('div');
    container.className = panelDef['sembook:cssClass'] || '';

    const tabBar = document.createElement('div');
    tabBar.className = 'flex items-center gap-1 px-3 pt-2 border-b border-slate-300 bg-slate-50';

    const contentArea = document.createElement('div');
    contentArea.className = 'flex-1 overflow-auto bg-white';

    const activeTabClass = 'px-3 py-1.5 text-sm rounded-t bg-white border border-b-0 border-slate-300 text-slate-900';
    const inactiveTabClass = 'px-3 py-1.5 text-sm rounded-t text-slate-500 hover:text-slate-700';

    const children = panelDef['sembook:panels'] || [];

    children.forEach((child, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = child['sembook:label'] || `Tab ${i + 1}`;
      btn.className = i === 0 ? activeTabClass : inactiveTabClass;

      const pane = document.createElement('div');
      // h-full matters for sem-panel-graph, whose height:100% otherwise has
      // nothing to resolve against — contentArea has a real flex-computed
      // height, but pane itself is auto-height with no content to size from.
      pane.className = i === 0 ? 'p-3 h-full' : 'p-3 h-full hidden';

      if (child['@type'] === 'sembook:GraphPanel') {
        // Local Graph scopes to just this lab; Full Graph is cumulative across labs.
        const assertedGraphs = child['sembook:label'] === 'Full Graph'
          ? this._notebook.graphsUpTo(this.uri)
          : [this.uri];
        const sparql = this._inferredAwareGraphSparql(child['sembook:sparql'], assertedGraphs);

        const el = document.createElement('sem-panel-graph');
        el.setAttribute('sparql', sparql);
        el.setAttribute('label', child['sembook:label'] || '');
        el.setAttribute('uri', child['@id'] || '');
        pane.appendChild(el);
        el.init(this._notebook, this._notebookDoc);
        this._notebook.subscribe(this.uri, el);
      } else if (child['@type'] === 'sembook:EntityPanel') {
        // Entities/Vocabulary are cumulative across labs too — same reasoning
        // as Full Graph: an entity introduced two labs ago is still known.
        const sparql = child['sembook:sparql']
          .replace(/VALUES \?g \{[^}]*\}/, this._cumulativeGraphsValuesClause());

        const el = document.createElement('sem-panel-entity');
        el.setAttribute('sparql', sparql);
        el.setAttribute('label', child['sembook:label'] || '');
        el.setAttribute('uri', child['@id'] || '');
        pane.appendChild(el);
        el.init(this._notebook, this._notebookDoc);
        this._notebook.subscribe(this.uri, el);
      } else if (child['@type'] === 'sembook:VocabularyPanel') {
        // The Vocabulary Explorer derives its own cumulative scope in-component (via
        // notebook.graphsUpTo, like the entity panel's detail queries), so unlike Graph
        // and Entity panels it carries no sparql attribute for _buildTabs to rewrite.
        const el = document.createElement('sem-panel-vocab');
        el.setAttribute('label', child['sembook:label'] || '');
        el.setAttribute('uri', child['@id'] || '');
        pane.appendChild(el);
        el.init(this._notebook, this._notebookDoc);
        this._notebook.subscribe(this.uri, el);
      } else {
        pane.innerHTML = `<p class="text-sm text-slate-400">${child['sembook:label']} — deferred to a future iteration.</p>`;
      }

      btn.addEventListener('click', () => {
        tabBar.querySelectorAll('button').forEach(b => b.className = inactiveTabClass);
        btn.className = activeTabClass;
        contentArea.querySelectorAll(':scope > div').forEach(p => p.classList.add('hidden'));
        pane.classList.remove('hidden');
      });

      tabBar.appendChild(btn);
      contentArea.appendChild(pane);
    });

    container.appendChild(tabBar);
    container.appendChild(contentArea);

    return container;
  }
}

customElements.define('sem-lab', SemLab);
