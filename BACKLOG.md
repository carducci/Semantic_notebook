# Notebook backlog (nice-to-haves)

Ordered as captured, not by priority.

1. **Local state saving.** DONE Oct 8 (ADR-039; commit log + editor text in localStorage, replayed on load, "Start over" in the drawer). Persist editor contents and lab progress locally (e.g. localStorage/IndexedDB) so students can come back later or recover from a browser crash. Open questions: per-lab or whole-notebook; how a reset works; how it interacts with "one lab = one named graph" and cumulative reasoning (restore means re-parse, since Parse is the only commit).
