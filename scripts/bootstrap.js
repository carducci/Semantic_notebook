import { NotebookContext } from './notebook-context.js';

// jsonld.js is loaded globally via <script src=".../jsonld.min.js"> in index.html — no module import needed.

export async function bootstrap(notebookUri) {
  const throbber = document.getElementById('page-throbber');

  try {
    // 1. Fetch notebook definition
    const response = await fetch(notebookUri);
    if (!response.ok) throw new Error(`Failed to fetch notebook: ${response.status}`);
    const notebookDoc = await response.json();

    // 2. Create notebook context
    const notebook = new NotebookContext();

    // 3. Parse notebook definition into quad store (default graph)
    const nquads = await jsonld.toRDF(notebookDoc, { format: 'application/n-quads' });
    const parser = new N3.Parser({ format: 'N-Quads' });
    const defQuads = parser.parse(nquads);
    notebook.store.addQuads(defQuads);

    // 4. Extract ordered lab list — sembook:labs is a @list, order is preserved in the raw JSON array
    const labOrder = extractLabOrder(notebookDoc);
    notebook.setLabOrder(labOrder);

    // 5. For each lab, load init data into its named graph
    for (const labUri of labOrder) {
      const initData = extractInitData(notebookDoc, labUri);
      if (initData && Object.keys(initData).length > 0) {
        const initNquads = await jsonld.toRDF(initData, { format: 'application/n-quads' });
        const initQuads = parser.parse(initNquads).map(q =>
          new N3.Quad(q.subject, q.predicate, q.object, N3.DataFactory.namedNode(labUri))
        );
        notebook.store.addQuads(initQuads);
      }
    }

    // 6. Fire notebook:ready
    document.dispatchEvent(new CustomEvent('notebook:ready', {
      detail: { notebook, notebookDoc }
    }));

  } catch (err) {
    console.error('Bootstrap failed:', err);
    // Show error state — do not leave throbber up forever
    if (throbber) throbber.innerHTML = `<p class="text-red-500">Failed to load notebook: ${err.message}</p>`;
    return;
  }

  // 7. Remove throbber
  if (throbber) throbber.remove();
}

function extractLabOrder(notebookDoc) {
  // Walk the @graph to find sembook:Notebook and extract sembook:labs list
  const graph = notebookDoc['@graph'] || [];
  const notebook = graph.find(n =>
    n['@type'] === 'sembook:Notebook' ||
    n['@type'] === 'https://notebook.semantic.consulting/vocab#Notebook'
  );
  if (!notebook) return [];
  const labs = notebook['sembook:labs'] || [];
  return labs.map(l => l['@id'] || l);
}

function extractInitData(notebookDoc, labUri) {
  const graph = notebookDoc['@graph'] || [];
  const lab = graph.find(n => n['@id'] === labUri);
  if (!lab) return null;
  return lab['sembook:init'] || null;
}
