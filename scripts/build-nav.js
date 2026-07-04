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

export function buildNav(navEl, notebookDoc) {
  const notebookNode = findNotebookNode(notebookDoc);
  if (!notebookNode) return;

  const graph = notebookDoc['@graph'] || [];
  const labUris = (notebookNode['sembook:labs'] || []).map(l => l['@id'] || l);

  for (const labUri of labUris) {
    const lab = graph.find(n => n['@id'] === labUri);
    if (!lab) continue;

    const a = document.createElement('a');
    a.href = new URL(labUri).hash; // e.g. "#identity" — derived, never re-typed
    a.className = 'text-slate-300 hover:text-white';
    a.textContent = lab['sembook:label'] || labUri;
    navEl.appendChild(a);
  }
}
