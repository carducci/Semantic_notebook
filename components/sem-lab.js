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

    for (const panelDef of lab['sembook:panels'] || []) {
      const el = this._buildPanel(panelDef);
      // Single append site for every panel type — appending an already-appended
      // node a second time triggers a disconnect/reconnect cycle, which previously
      // reset sem-panel-jsonld's notebook reference back to null after init().
      this.appendChild(el);
      if (panelDef['@type'] === 'sembook:JsonLdPanel') {
        el.init(this._notebook, this._notebookDoc);
      } else if (panelDef['@type'] === 'sembook:TurtlePanel') {
        el.init(this._notebook, this._notebookDoc);
        this._notebook.subscribe(this.uri, el);
      }
    }
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

    // Unhandled panel types render as an empty placeholder container this iteration.
    const div = document.createElement('div');
    if (panelDef['sembook:cssClass']) div.className = panelDef['sembook:cssClass'];
    return div;
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
        let sparql = child['sembook:sparql'];

        // Full Graph is cumulative across labs; replace the static single-lab
        // VALUES clause from the definition with the live lab order.
        if (child['sembook:label'] === 'Full Graph') {
          const graphs = this._notebook.graphsUpTo(this.uri);
          const valuesClause = `VALUES ?g { ${graphs.map(g => `<${g}>`).join(' ')} }`;
          sparql = sparql.replace(/VALUES \?g \{[^}]*\}/, valuesClause);
        }

        const el = document.createElement('sem-panel-graph');
        el.setAttribute('sparql', sparql);
        el.setAttribute('label', child['sembook:label'] || '');
        el.setAttribute('uri', child['@id'] || '');
        pane.appendChild(el);
        el.init(this._notebook, this._notebookDoc);
        this._notebook.subscribe(this.uri, el);
      } else if (child['@type'] === 'sembook:EntityPanel') {
        const el = document.createElement('sem-panel-entity');
        el.setAttribute('sparql', child['sembook:sparql']);
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
