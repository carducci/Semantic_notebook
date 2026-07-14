# Workshop Notes — Data Architecture for AI

Your companion for the hands-on labs at
**<https://notebook.semantic.consulting/notebook1/>**. Everything runs in your
browser — nothing to install. Each lab is one full screen; scroll (or use the
menu) to move between them. **Parse** is your commit button: edit, parse,
watch the graph.

Reading the graph: **teal circles** are things with identity (an IRI). **Amber
circles** are anonymous — the graph knows something is there but not *what*.
**Gray boxes** are plain values. **Dashed** edges and *italic* rows are facts
the graph worked out on its own — you'll see your first one in Lab 5.

---

## Lab 1 — Identity and Connection

Two JSON documents from two different systems. They're about connected things —
a book and its author — but nothing connects them, because nothing in them has
identity.

**Goal:** feel the moment data becomes *linked* data.

1. Parse both documents as-is. Two islands.
2. Give each record identity: add `@base` and map `id` to `@id` in a
   `@context`. Watch amber turn teal.
3. Map `author_id` so its value is understood as *a reference, not a string*:
   `"author_id": { "@type": "@id" }`. Watch the islands become one graph.
4. Fetch the richer author record. Same IRI — so everything just attaches.

You're done when: one connected graph, no amber nodes, and you can say *why*
the edge appeared.

## Lab 2 — Data and Context

One JSON document where the same key — `title` — means three different things:
a book's title, a royal position, a job. Humans read past this; machines can't.

**Goal:** meaning is contextual, and context can be written down.

The `@context` pane is data too. See how the queen's `title` is resolved
differently *inside* the `about` object. Then finish the job: the author's
`title` is still colliding with the book's, and `isbn` and `name` are still
unmapped "magic strings." Map them to your own terms.

You're done when: three different `title` meanings resolve to three different
properties, and nothing in the graph says `implied:` anymore.

## Lab 3 — Two Syntaxes, One Graph

A record from a completely different system — a publisher's catalog, using a
vocabulary we've never seen — and a second pane you haven't met.

**Goal:** JSON-LD documents are one *costume* for something deeper: sentences.

Parse, then read the right-hand pane out loud. Subject, verb, object, period.
That's Turtle — the same graph, written as statements. Notice the `@context`
prefixes became `@prefix` lines. Change something on the left; parse; find it
on the right.

You're done when: you can point at any line of Turtle and say which part of
the JSON it came from.

## Lab 4 — Defining Terms

Open the Vocabulary tab: every term you've used today is listed — and almost
all of them are amber. They have identity, but no meaning anyone wrote down.

**Goal:** definitions are data. A term is a resource you can describe like any
other.

The editor holds a complete definition of `title`: what kind of thing it is
(`rdf:Property`), a human label, a description, what values it takes
(`rdfs:range`). Parse it — watch `title` turn teal in the vocabulary. Then
work down the amber list and describe your own terms the same way.

You're done when: the terms *you* created are teal, and you can explain what
`rdfs:range` told the graph.

## Lab 5 — Classes and Subclasses

So far the graph knows *things* and *properties*. Now it learns *kinds of
things* — and how kinds relate.

**Goal:** watch the graph know more than you told it.

The seed declares a class (`ex:Book`) and claims one: Gödel, Escher, Bach `a
ex:Book`. Now build upward: declare `ex:Author`, and state the relationship —
`ex:Author rdfs:subClassOf schema:Person`. Then type the people you've met
today: Sally, Hofstadter, Michael are Authors. Their IRIs are waiting in the
editor's comments — no need to hunt back through earlier labs. Watch the
Entities tab as you parse. (As for Elizabeth — what *is* she, exactly? Sit
with that one. The graph doesn't know either… yet.)

Something will appear that you did not type. Find it. It's dashed for a
reason: the graph *derived* it, and it can tell you exactly from which two
statements. That's the difference between a database and a knowledge graph —
and between retrieval and reasoning.

You're done when: you can point at the fact nobody typed and name the two
statements that justify it.

## Lab 6 — Merging Vocabularies

Two vocabularies have been living in your graph all day: yours, and the one
the publisher's system spoke in Lab 3. Mostly different words for the same
ideas. Time to teach the graph what you've noticed.

**Goal:** alignment is knowledge, not configuration — a mapping is just
another fact.

The seed states one relationship, in one direction: every `ex:title` is a
`schema:name` (not every name is a title — direction matters). Parse it and
watch the Full Graph: records from hours ago restate themselves in a
vocabulary you never used. Then work the commented list — and when you reach
`isbn`, ask yourself the seed's question: one-way, or both? Say what's true.
If it's true both ways, say it twice, and think about what a reasoner must
conclude.

You're done when: data you asserted this morning carries dashed triples in
the other vocabulary, and you can explain why `title` got one direction but
`isbn` got two.

## Lab 7 — Integration for Free

A record about Elizabeth II, from DBpedia — a system nobody in this room has
ever integrated with. Vocabulary you've never seen (`dbo:` everything).

**Goal:** feel integration happen with zero mapping work.

Fetch the record (the URL is given in the room) and *read it before you
parse*. Notice two things: the queen's IRI is one your graph already knows —
and near the bottom, DBpedia's vocabulary ships its own alignments to
schema.org, as plain data. Now Parse, and watch the Full Graph: the foreign
record attaches to *your* queen, and dashed facts climb through DBpedia's
alignments into the same shared vocabulary your Lab 6 work aligned to. Two
parties, no coordination, one graph.

You're done when: you can trace one dashed fact end-to-end — which foreign
triple, through which alignment, landed where — and say who wrote each link
in that chain (hint: not you).

## Lab 8 — Standing on Shoulders

One more fetch: Michael's actual public identity —
`https://w3id.org/people/michael` — written in FOAF, a vocabulary for
describing people that has existed since 2000.

**Goal:** an existing ontology brings more than terms — it brings everything
it already learned.

Fetch and read the Turtle before parsing. Notice the record doesn't just
*use* FOAF's words — the vocabulary ships its own knowledge: what a
`foaf:Person` is relative to `schema:Person`, and what kind of things
`foaf:knows` can possibly connect. Parse, and check the Entities tab for
someone who just got classified without anyone saying a word about him.

You're done when: you can explain how a person became a `foaf:Person`
without any triple saying so — and which *vocabulary author*, years ago,
made that inference possible.

## Lab 9 — The Nature of Relationships

Two editors now: **Data** on the left, **Semantics** on the right. The data
is one fact — one — about Michael and Kate.

**Goal:** describe how a relationship *works*, and watch facts nobody typed
become computable.

Parse the data: two nodes, one edge. Now answer the Semantics panel's
questions, one line at a time, parsing as you go: a husband is a kind of
spouse (`rdfs:subPropertyOf`); marriage points both ways
(`owl:SymmetricProperty`); *wife-of* is *husband-of* read backwards
(`owl:inverseOf`). Watch the graph after each parse.

You're done when: one asserted fact has become four known facts, and you can
say which dashed edge came from which line of semantics. None of them is a
guess. None of them can be hallucinated.

## Lab 10 — Transitivity

A real scene: this conference, this hotel, this city — and you, somewhere
inside all of it.

**Goal:** one line of semantics closes an entire chain.

Parse the data and look at the graph: a chain of `locatedIn` links, each
one step long. The graph does not know where Michael is beyond the hotel.
Teach it what "located in" *means* — that it carries through — and parse.

You're done when: you can explain why five new edges appeared from one
declaration — and why the ads saying the conference is in "Denver" aren't
lying, even though Denver proper is nowhere in this graph.

## Lab 11 — Semantic Alignment

One last stranger: a library catalog's record of a book you've known since
this morning. Different system, different vocabulary, different identifier —
*no* shared key.

**Goal:** identity doesn't have to be declared. It can be inferred.

Fetch and read the record. Notice there is nothing connecting it to your
book — except a thirteen-digit string you've seen before. Now think about
what an ISBN *is*: one book per ISBN, one ISBN per book. Say that precisely
(`owl:InverseFunctionalProperty`), parse, and open the Entities tab.

You're done when: two books have become one, its properties have doubled,
and you can name every fact in the chain that made it happen — including
who asserted each one, and when.

## Lab 12 — Querying the Graph

Everything the room built today is one graph. SPARQL is how you talk to it.

**Goal:** ask the day's graph real questions — in any vocabulary you like.

Work the numbered sample queries in order. Watch for three things: the
library's record answering in *your* vocabulary (nobody mapped it); one
`DESCRIBE` returning a person in four dialects at once; and query 5's
last column — every fact knows *who said it*, including the inferred ones.
Then run query 6 and notice what "excluding a source" doesn't do: nothing
was deleted. Trust became part of the question.

You're done when: you've run query 7, read what came back, and realized
where you've been all day.

## Lab 13 — Contexts on the Fly

**Goal:** contexts aren't fixed — you can mint one whenever a question
deserves it.

`CONSTRUCT` returns a *graph*, not rows. The first sample invents a
brand-new vocabulary and populates it from three systems' data in one
query. The second defines a class nobody ever declared — and enumerates
its members. No migration, no schema change, no meeting.

You're done when: you can explain the difference between a class someone
asserted, a class the reasoner derived, and a class you just made up — and
why the graph is comfortable with all three.

---

## References

- JSON-LD: <https://www.w3.org/TR/json-ld11/> · playground: <https://json-ld.org/playground/>
- RDF primer: <https://www.w3.org/TR/rdf11-primer/>
- Turtle: <https://www.w3.org/TR/turtle/>
- RDFS: <https://www.w3.org/TR/rdf-schema/>
- schema.org: <https://schema.org/> (you met it before you knew its name)
- FOAF: <http://xmlns.com/foaf/spec/> (describing people since 2000)
- Michael: <https://w3id.org/people/michael> · <michael@semantic.consulting>
