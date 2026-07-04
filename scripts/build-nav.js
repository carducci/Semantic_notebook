// Generates the jump-to nav links from the notebook definition rather than
// hand-authoring one <a> per lab in HTML — with two labs already, hand-sync
// drift between the nav and sembook:labs is otherwise inevitable, and it breaks
// the "fragment identifier is the single source of a lab's identity" rule
// (ADR-011) the moment someone renames a lab's label without touching the nav.

function findNotebookNode(notebookDoc) {
  const graph = notebookDoc['@graph'] || [];
  return graph.find(n =>
    n['@type'] === 'sembook:Notebook' ||
    n['@type'] === 'https://sembook.example.org/vocab#Notebook'
  );
}

const INACTIVE_LINK_CLASS = 'text-slate-300 hover:text-white border-b-2 border-transparent';
const ACTIVE_LINK_CLASS = 'text-white border-b-2 border-white';

export function buildNav(navEl, notebookDoc) {
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
    navEl.appendChild(a);
    linksBySlug.set(slug.slice(1), a);
  }

  observeActiveLab(linksBySlug);
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
