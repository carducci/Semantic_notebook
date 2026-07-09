// <sem-notebook> — the notebook-level runtime element. Generates one <sem-lab>
// child per entry in the definition's ordered sembook:labs list, the same way
// sem-lab generates its panels from sembook:panels: the definition, not the
// HTML, is the source of the notebook's structure (C3). The page hand-authors
// only page chrome inside this element (nav bar, drawer, backdrop) — those are
// left untouched; generated labs are appended after them.
//
// Page-chrome classes for the generated labs (fixed-nav offset, box-sizing,
// scroll-snap participation) come from this element's lab-class attribute,
// keeping them a page concern the definition knows nothing about — the same
// ownership split the hand-authored <sem-lab> markup had before this component.
//
// Ordering constraint: this module registers its notebook:ready listener in
// connectedCallback, i.e. when this module executes — before the page's inline
// bootstrap module runs and registers buildNav's listener. Listeners fire in
// registration order, so the labs exist in the DOM by the time buildNav's
// getElementById calls look for them. Keep this script above the inline module.

export class SemNotebook extends HTMLElement {
  connectedCallback() {
    this._onNotebookReady = (e) =>
      this._buildLabs(e.detail.notebook, e.detail.notebookDoc);
    document.addEventListener('notebook:ready', this._onNotebookReady);
  }

  disconnectedCallback() {
    document.removeEventListener('notebook:ready', this._onNotebookReady);
  }

  _buildLabs(notebook, notebookDoc) {
    const graph = notebookDoc['@graph'] || [];
    const notebookNode = graph.find(n =>
      n['@type'] === 'sembook:Notebook' ||
      n['@type'] === 'https://notebook.semantic.consulting/vocab#Notebook'
    );
    if (!notebookNode) return;

    const labUris = (notebookNode['sembook:labs'] || []).map(l => l['@id'] || l);
    const labClasses = (this.getAttribute('lab-class') || '')
      .split(/\s+/)
      .filter(Boolean);

    for (const labUri of labUris) {
      // Lab DOM id = the IRI's fragment, never re-typed — ADR-035's
      // dereferencing (GET the lab IRI, land scrolled to that lab) depends on
      // this staying derived.
      const slug = new URL(labUri).hash.slice(1);
      const el = document.createElement('sem-lab');
      el.id = slug;
      el.setAttribute('uri', labUri);
      if (labClasses.length) el.classList.add(...labClasses);
      this.appendChild(el);
      // A listener added during the dispatch of notebook:ready never receives
      // that same event, so labs created here get the context handed directly.
      el.initNotebook(notebook, notebookDoc);
    }

    // The browser's initial scroll-to-fragment ran before these elements
    // existed; re-run it so a deep-linked lab IRI still dereferences to its
    // lab scrolled into view (C2).
    if (location.hash) {
      document.getElementById(location.hash.slice(1))?.scrollIntoView();
    }
  }
}

customElements.define('sem-notebook', SemNotebook);
