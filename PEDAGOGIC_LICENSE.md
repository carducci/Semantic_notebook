# Pedagogic License Register

Places where the runtime or the notebook definitions deliberately fudge, hide,
or pre-empt a concept because the lab sequence hasn't introduced it yet. These
are curriculum decisions, not architecture drift — the runtime quietly does the
right thing until the learner is ready to see the machinery.

**Why this register exists:** the generalized version of this architecture will
be extracted from this codebase. Without a record of which "cheats" are
deliberate, future work (human or agent) cannot tell license from drift — and
will either faithfully generalize a fudge or "fix" a teaching decision. When a
consult or review flags something listed here, the answer is "licensed, see
this file," not a refactor. C3's governing idea (the notebook format is the
subject matter) cuts both ways: where the format lies a little, the lie is
part of the lesson plan and gets written down.

Each entry: what is fudged, what the honest version would be, and when (if
ever) the fudge should be unwound.

---

## L1 — SPARQL panel queries default to the cumulative graph

**The fudge:** a learner-typed query with no `GRAPH`/`FROM` clause is silently
scoped to the union of every lab's graph (asserted + inferred) up to and
including the current lab (`NotebookContext.executeSparql`). The learner has
not yet been taught RDF datasets, named graphs as query scope, or `FROM`.

**The honest version:** the query runs against exactly the dataset the learner
specifies, and an unscoped query over a quad store's default graph would
return nothing — a correct but bewildering first SPARQL experience.

**Unwind:** never fully — the default is good UX, not just license. But once a
lab teaches named-graph scoping (the "Only Lab 1 (explicit GRAPH override)"
sample query already gestures at it), the implicit default should be *named*
in the teaching flow rather than left invisible.

## L2 — Cumulative scope itself is invisible machinery

**The fudge:** Full Graph / Entities / Vocabulary panels accumulate knowledge
across labs (`sembook:CumulativeScope`, ADR-036) before the learner has any
concept of multiple graphs existing, let alone a union of them. Lab 1's
learner just sees "the graph remembers."

**The honest version:** panels would show only what the current lab asserted
until graphs-as-scopes are taught.

**Unwind:** don't — "knowledge accumulates" *is* the lesson, taught by
experience before it's taught by name. Listed here because the machinery
(per-lab named graphs + `-inferred` companions + union) is deliberately never
surfaced in the UI.

## L3 — Inference appears before reasoning is taught

**The fudge:** every Parse materializes RDFS/OWL-RL entailments into a hidden
`<lab-iri>-inferred` graph, and graph panels draw them dashed (ADR-031), from
the very first lab — long before any lab explains entailment, rules, or why a
triple nobody typed exists.

**The honest version:** no inferred triples until a lab introduces reasoning.

**Unwind:** partially, by curriculum rather than code — early-lab seed data is
authored so that little or nothing fires (no domains/ranges/subclass axioms in
lab 1), so the dashed edges first *appear* around the labs that discuss
alignment and inference. That authoring convention is the actual mechanism of
this license and should be kept in mind when editing early-lab
`sembook:initialContent`.

## L4 — The "DBpedia" record is doctored and locally served

**The fudge:** the Integration for Free lab fetches
`datasets/elizabeth-dbpedia.jsonld` — presented as "a document about the
queen from DBpedia," it is actually hand-authored: trimmed from thousands of
real triples to a dozen that fit one CodeMirror frame and look familiar; the
class/property alignments to schema.org (which DBpedia genuinely publishes)
are re-expressed as plain `rdfs:subClassOf`/`subPropertyOf` and shipped
in-band with the instance data; `owl:` appearances are curated to be inert
under our ruleset (`a owl:Class` typings stay; `owl:sameAs` links were
deliberately REMOVED because our reasoner's sameAs replication/merge rules
would fire and pre-empt the OWL lab's identity-merge reveal); and the fetch
URL is local — real DBpedia IRIs inside, our host serving them (CORS +
conference wifi + control over exactly what appears on screen).

**The honest version:** live `GET https://dbpedia.org/data/Elizabeth_II.json`
— thousands of triples, dozens of languages, real owl:sameAs links firing
merges out of sequence, and a network dependency on stage.

**Unwind:** never fully. The local-serving fudge could become honest content
negotiation against a caching proxy in the generalized version; the trimming
and owl-curation are curriculum, not drift. The smuggled assertions (e.g.
`dbo:spouse` + Prince Philip, planted for a later "how did the data know
that?" beat) are part of the lesson plan — see INSTRUCTOR_NOTES.md.

---

*Add entries as they're committed. If an entry stops being true (the concept
is now taught before the machinery engages), move it to a dated "retired"
section rather than deleting it — the generalized version needs the history.*
