# Semantic Notebook

An interactive knowledge graph that renders itself.

This is a browser-based teaching tool for the understanding the semantic stack for AI and integration. It's built for conference talks and as book companion material. It has one core trick: you add an ontology to a graph, and the graph knows more than you told it. Reasoning emergence, made visceral and interactive, live on stage.

The deeper trick is that the tool is made of the thing it teaches. A "notebook" here isn't a JSON config file the app happens to read — it's a JSON-LD document describing itself in a proper OWL ontology (`sembook:`), published at a dereferenceable URI. The app bootstraps by loading its own definition into a knowledge graph and querying that graph to find out what to render. You can point a SPARQL query at the notebook you're looking at. The tool doesn't just talk about semantic, self-describing formats — it *is* one.

## What it does

Each "lab" is a full-viewport teaching beat: an editor or two, a graph visualization, live side by side. Type or edit JSON-LD or Turtle, hit Parse, and watch the knowledge graph update — new nodes, new edges, new inferred triples appearing with a different visual treatment than what you asserted. The flagship demo: two disconnected documents (two "islands" of data) become one connected graph the moment a single `@context` mapping gives them a shared identity. No code, one line of JSON-LD, and the audience watches the edge snap into place.

Labs stack vertically and the notebook scrolls like a document — deep-linkable, back-button-friendly, no client-side routing. Multiple notebooks can exist side by side, each its own directory, each a companion to a different talk or book chapter.

## How it works

- **Everything runs in the browser.** An in-memory quad store (N3.js), a SPARQL 1.1 engine (Comunica), and an RDFS/OWL reasoner all execute client-side. No server round-trip for any core teaching operation — the audience sees exactly what's happening, and the demo survives conference wifi.
- **One lab, one named graph.** The lab's own IRI is the named graph IRI. Infrastructure (the notebook's own definition — labs, panels, layout) lives in the default graph and is filtered out of every panel; only teaching content is ever visualized.
- **Reasoning is automatic.** Every Parse re-runs the reasoner. Inferred triples land in a companion graph and render distinctly — dashed edges, italic property rows — so asserted and derived knowledge are always visually distinguishable.
- **No framework.** Native Web Components, no build step, no bundler. Every component — lab or panel — shares one lifecycle contract. Layout is Tailwind utility classes declared directly in the notebook's own JSON-LD.
- **A SPARQL query is the entire configuration surface for any panel.** What a panel shows is just what its query returns — which means a new panel type is a new query, not a new vocabulary.

## The stack

N3.js (quad store, Turtle/JSON-LD parsing) · Comunica (SPARQL) · N3.js Reasoner (RDFS / OWL 2 RL subset) · Cytoscape.js (graph visualization) · CodeMirror 6 (editors) · Tailwind CSS · native Web Components.

## Learn more

- [STORY.md](STORY.md) — the full origin story: the vision, the principles, what surprised us, what's still open.
- [ARCHITECTURAL_CONSTRAINTS.md](ARCHITECTURAL_CONSTRAINTS.md) — the rules every component must obey.
- [ARCHITECTURE_DECISION_RECORDS.md](ARCHITECTURE_DECISION_RECORDS.md) — the significant, hard-to-reverse technology choices.
- [DESIGN_DECISIONS.md](DESIGN_DECISIONS.md) — mechanisms, tuning, bug fixes — everything narrower.
- [SEMANTIC_NOTEBOOK_SPEC.md](SEMANTIC_NOTEBOOK_SPEC.md) — the original build handoff spec.
