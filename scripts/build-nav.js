// Generates the jump-to nav links from the notebook definition rather than
// hand-authoring one <a> per lab in HTML — with several labs already, hand-sync
// drift between the nav and sembook:labs is otherwise inevitable, and it breaks
// the "fragment identifier is the single source of a lab's identity" rule
// (ADR-011) the moment someone renames a lab's label without touching the nav.
//
// Links render inside a collapsible drawer (see #lab-nav-drawer in index.html)
// rather than inline in the fixed bar — with four labs in notebook1, an inline
// row of labels no longer fits the 48px strip. The hamburger toggle and drawer
// chrome are static markup; this script only ever populates and highlights links.

function findNotebookNode(notebookDoc) {
  const graph = notebookDoc['@graph'] || [];
  return graph.find(n =>
    n['@type'] === 'sembook:Notebook' ||
    n['@type'] === 'https://notebook.semantic.consulting/vocab#Notebook'
  );
}

const INACTIVE_LINK_CLASS = 'block rounded px-3 py-2 border-l-2 border-transparent text-slate-300 hover:bg-white/10 hover:text-white';
const ACTIVE_LINK_CLASS = 'block rounded px-3 py-2 border-l-2 border-white bg-white/10 text-white';

export function buildNav(linksEl, notebookDoc) {
  const notebookNode = findNotebookNode(notebookDoc);
  if (!notebookNode) return;

  const graph = notebookDoc['@graph'] || [];
  const labUris = (notebookNode['sembook:labs'] || []).map(l => l['@id'] || l);

  const linksBySlug = new Map();

  for (const labUri of labUris) {
    const lab = graph.find(n => n['@id'] === labUri);
    if (!lab) continue;

    const slug = new URL(labUri).hash; // e.g. "#identity" — derived, never re-typed
    const a = document.createElement('a');
    a.href = slug;
    a.className = INACTIVE_LINK_CLASS;
    a.textContent = lab['sembook:label'] || labUri;
    a.addEventListener('click', closeDrawer);
    linksEl.appendChild(a);
    linksBySlug.set(slug.slice(1), a);
  }

  observeActiveLab(linksBySlug);
  wireDrawerToggle();
}

// Highlights whichever nav link corresponds to the <sem-lab> currently
// dominating the viewport. This is independent of sem-lab.js's own
// IntersectionObserver (which only triggers lazy-build) — nav active-state
// is page chrome, not teaching data, so it has no business on
// NotebookContext's scoped event bus (C9).
//
// Scroll-snap (ADR-015) guarantees at most one lab is ever substantially in
// view, so "the most-intersecting lab wins" needs no scroll-direction or
// velocity tracking — just track each lab's latest ratio and re-pick the max.
function observeActiveLab(linksBySlug) {
  if (linksBySlug.size === 0) return;

  const ratios = new Map();

  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      ratios.set(entry.target.id, entry.isIntersecting ? entry.intersectionRatio : 0);
    }

    let activeSlug = null;
    let bestRatio = 0;
    for (const [slug, ratio] of ratios) {
      if (ratio > bestRatio) {
        bestRatio = ratio;
        activeSlug = slug;
      }
    }

    for (const [slug, link] of linksBySlug) {
      link.className = slug === activeSlug ? ACTIVE_LINK_CLASS : INACTIVE_LINK_CLASS;
    }
  }, { threshold: [0, 0.25, 0.5, 0.75, 1] });

  for (const slug of linksBySlug.keys()) {
    const labEl = document.getElementById(slug);
    if (labEl) observer.observe(labEl);
  }
}

// Wires the hamburger button, backdrop, and Escape key to the drawer's open/
// closed state. `dataset.wired` guards against double-binding if buildNav is
// ever called more than once (it currently isn't — notebook:ready fires once).
function wireDrawerToggle() {
  const toggle = document.getElementById('lab-nav-toggle');
  const drawer = document.getElementById('lab-nav-drawer');
  const backdrop = document.getElementById('lab-nav-backdrop');
  if (!toggle || !drawer || !backdrop || toggle.dataset.wired) return;
  toggle.dataset.wired = 'true';

  toggle.addEventListener('click', () => {
    toggle.getAttribute('aria-expanded') === 'true' ? closeDrawer() : openDrawer();
  });
  backdrop.addEventListener('click', closeDrawer);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeDrawer();
  });
}

function openDrawer() {
  document.getElementById('lab-nav-drawer')?.classList.remove('-translate-x-full');
  document.getElementById('lab-nav-backdrop')?.classList.remove('opacity-0', 'pointer-events-none');
  document.getElementById('lab-nav-toggle')?.setAttribute('aria-expanded', 'true');
  document.getElementById('lab-nav-drawer')?.setAttribute('aria-hidden', 'false');
}

function closeDrawer() {
  document.getElementById('lab-nav-drawer')?.classList.add('-translate-x-full');
  document.getElementById('lab-nav-backdrop')?.classList.add('opacity-0', 'pointer-events-none');
  document.getElementById('lab-nav-toggle')?.setAttribute('aria-expanded', 'false');
  document.getElementById('lab-nav-drawer')?.setAttribute('aria-hidden', 'true');
}
