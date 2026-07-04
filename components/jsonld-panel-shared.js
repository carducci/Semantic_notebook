// Shared between sem-panel-jsonld.js (single editor) and sem-panel-jsonld-split.js
// (body + context editors) — extracted so both panels run identical parsing,
// blank-node-scoping, and prefix-extraction logic rather than each maintaining
// their own copy.
//
// jsonld.js and N3 are loaded globally via <script> tags in index.html — no
// module import needed.

// CodeMirror and its dependency graph are vendored locally under /vendor/codemirror/
// and resolved via the import map in index.html — see that directory for exact
// versions. All panels resolve @codemirror/state (etc.) to the same vendored file,
// so there's no risk of the duplicate-instance/"Unrecognized extension value"
// failure mode that an on-the-fly CDN bundler (e.g. esm.sh) can produce when it
// bundles each package independently.
import { EditorView, basicSetup } from 'codemirror';
import { json } from '@codemirror/lang-json';
// basicSetup deliberately leaves Tab unbound (so keyboard users can still tab
// out of the editor) — indentWithTab opts back into indent-on-Tab, which is
// the behavior this swap was for.
import { keymap } from '@codemirror/view';
import { indentWithTab } from '@codemirror/commands';

export function createEditor(parent, initialContent, onChange) {
  const view = new EditorView({
    doc: initialContent,
    extensions: [
      basicSetup,
      json(),
      keymap.of([indentWithTab]),
      EditorView.theme({
        '&': {
          height: '100%',
          fontSize: '13px',
          fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace'
        },
        '.cm-scroller': {
          overflow: 'auto',
          lineHeight: '1.6'
        },
        '.cm-content': {
          padding: '8px 0'
        },
        '.cm-gutters': {
          backgroundColor: '#f8fafc',
          borderRight: '1px solid #e2e8f0',
          color: '#94a3b8',
          fontSize: '11px'
        },
        '.cm-activeLineGutter': {
          backgroundColor: '#cbd5e1'
        },
        // Per CodeMirror's own guidance (opaque line-decoration backgrounds
        // "never worked" — https://discuss.codemirror.net/t/various-themes-activeline-selections-not-visible/7473):
        // decoration backgrounds must be translucent, or they paint over and
        // hide layers rendered underneath them, like the selection layer. An
        // opaque activeLine background made text selected on the active line
        // invisible even though it was technically still selected/copyable.
        '.cm-activeLine': {
          backgroundColor: 'rgba(37, 99, 235, 0.15)'
        },
        // CodeMirror's own selection layer (drawn via basicSetup's drawSelection
        // extension) has no default styling here, so it inherits whatever the
        // browser's dark-mode remapping does to its near-transparent default —
        // pin it to an explicit, solid, saturated color instead. !important
        // because drawSelection's generated rule has matching specificity and
        // can load after this theme.
        '.cm-selectionBackground': {
          backgroundColor: '#93c5fd !important'
        },
        '&.cm-focused .cm-selectionBackground': {
          backgroundColor: '#60a5fa !important'
        },
        '.cm-content ::selection': {
          backgroundColor: '#93c5fd !important'
        }
      }),
      EditorView.updateListener.of(update => {
        if (update.docChanged) {
          onChange(view.state.doc.toString());
        }
      })
    ],
    parent
  });
  return view;
}

export function findPanelNode(panels, uri) {
  for (const p of panels || []) {
    if (p['@id'] === uri) return p;
    if (p['sembook:panels']) {
      const found = findPanelNode(p['sembook:panels'], uri);
      if (found) return found;
    }
  }
  return null;
}

// jsonld.js issues its own blank node labels (_:b0, _:b1, ...) starting fresh on every
// independent toRDF() call. Two fragments parsed separately (e.g. Document A and
// Document B) can both produce "_:b0" — and since their quads land in the same named
// graph, an unscoped label would silently merge two unrelated entities. Prefix every
// blank node with something derived from the fragment's own IRI so labels from
// different fragments can never collide once merged.
export function scopeBlankNode(term, fragmentUri) {
  if (term.termType !== 'BlankNode') return term;
  const safePrefix = fragmentUri.split(/[/#]/).pop().replace(/[^A-Za-z0-9_-]/g, '');
  return N3.DataFactory.blankNode(`${safePrefix}-${term.value}`);
}

export function extractPrefixes(doc) {
  const prefixes = {};
  const ctx = doc['@context'];
  if (!ctx) return prefixes;

  // Handle array context
  const contexts = Array.isArray(ctx) ? ctx : [ctx];

  for (const c of contexts) {
    if (typeof c !== 'object') continue;
    for (const [key, value] of Object.entries(c)) {
      // Skip @-keywords and non-string values that aren't simple IRI mappings
      if (key.startsWith('@')) continue;
      if (typeof value === 'string' && value.match(/^https?:\/\//)) {
        prefixes[key] = value;
      }
    }
  }
  return prefixes;
}

export async function parseToQuads(jsonString, fragmentUri, labUri) {
  let doc;
  try {
    doc = JSON.parse(jsonString);
  } catch (e) {
    throw new Error(`Invalid JSON: ${e.message}`);
  }

  const prefixes = extractPrefixes(doc);

  const hasContext = doc['@context'] && typeof doc['@context'] === 'object' && !Array.isArray(doc['@context']);

  if (!hasContext) {
    // Case 1 — no context at all: everything becomes a blank node with literal
    // properties under an implied vocabulary, so the audience sees *something*
    // in the graph even though it isn't semantically useful yet.
    doc = {
      '@context': { '@vocab': 'urn:sembook:implied:' },
      ...doc
    };
    // Map 'id' to '@id' if present — common convention
    if (doc.id !== undefined) {
      doc['@context']['id'] = '@id';
      // Make it a blank node if it looks like a plain string, not a URI
      if (!doc.id.startsWith('http') && !doc.id.startsWith('/')) {
        doc['@id'] = `_:${doc.id}`;
        delete doc.id;
      }
    }
  } else if (doc['@context']['@vocab'] === undefined) {
    // The user supplied their own context (e.g. mapping id -> @id) but didn't
    // define a vocabulary for the remaining plain keys. Without a fallback,
    // JSON-LD expansion silently drops any property it can't map to an IRI —
    // this is why triples vanish the moment a partial context is introduced.
    doc['@context']['@vocab'] = 'urn:sembook:implied:';
  }

  // Fallback base for relative @id values (e.g. "id": "441") when the user's
  // own context doesn't declare @base — automatically overridden by an
  // explicit @base in the document's context, per JSON-LD resolution rules.
  // This also means two documents that both omit @base still resolve a
  // shared bare id (e.g. "872") to the same IRI.
  const nquads = await jsonld.toRDF(doc, {
    format: 'application/n-quads',
    base: 'https://sembook.example.org/data/'
  });
  const parser = new N3.Parser({ format: 'N-Quads' });
  const quads = parser.parse(nquads).map(q =>
    new N3.Quad(
      scopeBlankNode(q.subject, fragmentUri),
      q.predicate,
      scopeBlankNode(q.object, fragmentUri),
      N3.DataFactory.namedNode(labUri)
    )
  );
  return { quads, prefixes };
}
