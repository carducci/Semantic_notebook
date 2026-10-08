# Instructor Notes — Workshop Labs (notebook1)

Per-lab choreography for the workshop. Each lab lists: seed state, the live arc,
the one discrepancy event the lab exists for, and stage gotchas. Companion to
the deck ("An Engineer's Guide to the Semantic Layer"); deck cue points refer to
slide numbers as of 2026-07-12 and shift as the deck is renumbered.

**Standing rules (apply to every lab):** phenomenon before name; one
discrepancy event per lab; seeds fire zero visible inference before Lab 7;
schema.org stays "some other system's dialect" until the web-scale reveal;
nothing invites "what if triples disagree" before the named-graphs beat.

**Standing delivery rules (OWL section onward — hammer these):**
- **The SQL strawman, drawn sharply:** yes, a competent analyst could write a
  SQL query that finds Kate's husband or everything in Colorado. But the
  *query writer* carries the semantics in their head — out-of-band knowledge,
  re-supplied per query, per person, forever. Here the knowledge is IN the
  data: the graph *knows*, and anyone (or anything) that asks gets the
  benefit. Navigable data model ≠ knowing data. Query-ability is not
  knowledge.
- **"An LLM doesn't have to guess at this. It's a computable fact. It cannot
  be hallucinated."** Use verbatim, repeatedly.
- **PUNCTUATION RULE: every single time you say "the graph got smarter,"
  immediately translate: "— which means YOUR AI just got smarter."** No
  exceptions. The room must leave with those two phrases fused.
- **OWL lab setup callback (each lab):** "We didn't map fields. We learned
  something about the data and told the graph. `:marriedTo` is symmetric —
  let's weave that fact into the knowledge fabric."

**Authoring convention (retroactive, 2026-07-12):** any Turtle surface that
mixes instance data and vocabulary axioms labels its sections with boxed
comments — `# ── <whose> data/file ──` vs `# ── <vocab> ontology (excerpt) ──`
— so the data/ontology distinction is visible in every frame before it's ever
taught. Applied to the Lab 4/5/6 seeds and michael-foaf.ttl; JSON-LD datasets
can't carry comments, so there the convention is structural (alignment nodes
grouped last in @graph).

**Runtime behavior worth knowing on stage:**
- Parse is the only commit — nothing updates on keystroke.
- Cumulative panels (Full Graph, Entities "All", Vocabulary) refresh when
  *their own* lab parses, and populate from everything earlier when first
  scrolled into view. Forward flow always looks right; **re-parsing an earlier
  lab does not ripple into a later lab's already-open panels** until that later
  lab's next Parse.
- Reasoning runs on every Parse but sees **only the current lab's graph** —
  type assertions and the axioms that act on them must be asserted in the same
  lab. (Cross-lab reasoning is a pending architecture decision.)
- Unmapped JSON keys are caught by an invisible `@vocab` and minted as
  `urn:sembook:implied:` predicates so they stay visible in the graph — they
  render as "still magic strings" until mapped.

---

## Lab 1 — Identity and Connection (deck 1a–1c)

**Seed:** two plain-JSON islands (GEB book / Hofstadter author), no context.
**Pauses (student notes split Lab 1 into 1a/1b/1c/1d, minutes apart):** after 1a
(identity talk), after 1b (data vs. information), after 1c (terms have the same problem).
**Live arc:** raw parse (blank nodes as dashed rings, two islands; "we see meaning,
the machine sees nothing") → talk identity: URI as identifier, not a link (REST
seed) → they put fully qualified ids in (`https://example.com/Book/Id/441`) and
Parse: DRUMROLL, nothing happens (`id` is a magic string) → data vs. information:
add `@context`, map `id` → `@id` (rings go solid, still two islands) → map
`author_id` to `{"@type": "@id"}` (THE edge snaps, one graph) → Lab 1d: terms have
the same identity problem; mint URIs for each term. NO fetch in Lab 1 (decided
Oct 7; the fetch beat lives in later labs).
URI scheme: `{scheme}://{authority}/{collection (class set)}/{keyspace}/{key}`.
**Discrepancy event:** the edge snap — one line of context connects two systems.
**Gotchas:** the term-mapping pass (deck Lab 1c) maps `title`, `published`,
etc. to `https://example.com/ns#…` — later labs assume those IRIs exist, do
not skip it. Dashed ring → solid ring is the identity lesson; narrate the change.
**Ids are fully qualified, no `@base`** (decided Oct 7). Students replace the id
VALUES (`https://example.com/Book/Id/441`, `/Author/Id/872`, `/Org/Id/34`), including
the references, in Lab 1b. Later labs' references (Lab 6 seed, cheatsheets) point at
these IRIs.
### Lab 1 runbook (copy/paste; doubles as the test script; verified headless Oct 7)
Replace the whole editor contents each time, then Parse (both documents).
**1b: Document A and Document B (fully qualified ids). Expect: NOTHING changes**
(dashed `?` node, the full IRI shows as a literal box; `id` is a magic string).
```json
{
  "id": "https://example.com/Book/Id/441",
  "title": "Gödel, Escher, Bach",
  "author_id": "https://example.com/Author/Id/872",
  "published": 1979
}
```
```json
{
  "id": "https://example.com/Author/Id/872",
  "name": "Douglas Hofstadter",
  "affiliation_id": "https://example.com/Org/Id/34"
}
```
**1c: Document A and Document B (context: `id` → `@id`, references as `@type: @id`).
Expect: solid rings, and the book→author edge snaps into one graph.**
```json
{
  "@context": {
    "id": "@id",
    "author_id": {
      "@type": "@id"
    }
  },
  "id": "https://example.com/Book/Id/441",
  "title": "Gödel, Escher, Bach",
  "author_id": "https://example.com/Author/Id/872",
  "published": 1979
}
```
```json
{
  "@context": {
    "id": "@id",
    "affiliation_id": {
      "@type": "@id"
    }
  },
  "id": "https://example.com/Author/Id/872",
  "name": "Douglas Hofstadter",
  "affiliation_id": "https://example.com/Org/Id/34"
}
```
**1d: Document A and Document B (final: terms minted).** Expect: same graph, terms are
`https://example.com/ns#…` IRIs (Vocabulary tab in later labs; `ex:title`, `ex:published`,
`ex:author`, `ex:name`, `ex:affiliation`).
```json
{
  "@context": {
    "id": "@id",
    "title": "https://example.com/ns#title",
    "published": "https://example.com/ns#published",
    "author_id": {
      "@id": "https://example.com/ns#author",
      "@type": "@id"
    }
  },
  "id": "https://example.com/Book/Id/441",
  "title": "Gödel, Escher, Bach",
  "author_id": "https://example.com/Author/Id/872",
  "published": 1979
}
```
```json
{
  "@context": {
    "id": "@id",
    "name": "https://example.com/ns#name",
    "affiliation_id": {
      "@id": "https://example.com/ns#affiliation",
      "@type": "@id"
    }
  },
  "id": "https://example.com/Author/Id/872",
  "name": "Douglas Hofstadter",
  "affiliation_id": "https://example.com/Org/Id/34"
}
```

## Lab 2 — Data and Context (deck Lab 2)

**Seed:** Elizabeth biography record, ids already fully qualified (slide 130). The
context holds only `about` and `author`, each with an EMPTY nested `@context` (the
scaffold shows where scoped mappings go). Nothing is mapped for `title`, `isbn`, or
`name`; they all surface as `implied:` predicates. (Oct 7: the old seed carried
`title` → `ex:title` and `about.title` → `ex:positionHeld`; both are now the room's
job. Reorder the slides so the deck lands here before the problem is pointed out.)
**Live arc (atomic, no pauses; Socratic: walk it together, run into the problem, discuss):** first the room builds "the canonical glossary," and everyone reaches
for `ns#title` without much thought (map `isbn` and `name` the same way). Then walk
to the next `title`, the queen's: the same IRI would say a royal position is a book
title. Now the room sees that the URI is what disambiguates. Give each meaning its
own IRI with a scoped context (`about.title` → `ex:positionHeld`, `author.title` →
`ex:jobTitle`).
**Discrepancy event:** same key, different meanings, and the first instinct
(reuse the term already minted) is wrong here.
**Green path / robots:** the reuse reflex is the "simple robot": it sees a key and
reaches for a term. Plant the seed for the "smart robot": when it sees a concept it
has already defined, it reuses it (and knows when the concept is NOT the same).
Michael does not mind the repetition from Lab 1d; it mirrors a real situation
the room will meet at work.
**Tabs:** Local Graph + Vocabulary only.
**Gotchas:** keep everything in `ex:`, no schema.org here; the queen's
DBpedia IRI is a plant for the merging lab, don't dwell on it.
### Lab 2 runbook (copy/paste; verified headless Oct 7)
The seed body is already in the Body pane; the seed @context holds only `about` and
`author` with empty nested contexts. Replace the `@context` pane with this, then Parse.
**Final @context (Lab 12's merge depends on the isbn line; Lab 4 uses positionHeld/jobTitle):**
```json
{
  "@context": {
    "title": "https://example.com/ns#title",
    "isbn": "https://example.com/ns#isbn",
    "name": "https://example.com/ns#name",
    "about": {
      "@id": "https://example.com/ns#about",
      "@context": {
        "title": "https://example.com/ns#positionHeld"
      }
    },
    "author": {
      "@id": "https://example.com/ns#author",
      "@context": {
        "title": "https://example.com/ns#jobTitle"
      }
    }
  }
}
```
Expect: Vocabulary tab, Properties · 9 (`title`, `published`, `author`, `name`,
`affiliation`, `isbn`, `about`, `positionHeld`, `jobTitle`); nothing says `implied:`.
Body (seed, unchanged, for reference):
```json
{
  "@id": "https://example.com/Book/Id/8268",
  "title": "Elizabeth the Queen: The Life of a Modern Monarch",
  "isbn": "0812979796",
  "about": {
    "@id": "https://dbpedia.org/resource/Elizabeth_II",
    "name": "Elizabeth Windsor",
    "title": "Queen of the United Kingdom"
  },
  "author": {
    "@id": "https://example.com/Author/Id/35626",
    "name": "Sally Bedell Smith",
    "title": "Biographer"
  }
}
```

## Lab 3 — Two Syntaxes, One Graph (deck Lab 3; callout moves to after slide 202)

**Seed:** *Mastering Software Architecture* (Apress, 2025) from a fictional
publisher catalog (`https://catalog.example.net/…`), written in the
schema.org dialect; author node is Michael's real IRI
`https://w3id.org/people/michael`.
**Live arc:** Parse; read the Turtle pane out loud — they're sentences. Point
at `@context` prefix ↔ `@prefix` correspondence. Do NOT teach syntax here
(the `a`, semicolons, periods get *named* at slides 234–238 — "you've been
reading this for twenty minutes").
**Discrepancy event:** same document, two costumes — and the JSON was never
the thing; the sentences were.
**Gotchas:** present schema.org as *nothing special* — "my publisher's
vocabulary." Its true identity is a Part-II reveal. The book record and
Michael's IRI stay in the day's graph and pay off at the finale.
Live `@base` change is a good micro-beat (every IRI re-resolves).

## Lab 4 — Defining Terms (deck Lab 4, slide 239; RDFS: type and range, PRIMITIVES ONLY)

**Design (Oct 7, Michael):** this is the "build our vocabulary" lab. The room is still
thinking in schemas (the GraphQL schema is in the student notes and on the slides), so
this is familiar turf: type and range, primitives only. We do NOT point out that range
is instructive yet; the mental model gets walked away from slowly. The first big
inferencing reveal is DOMAIN (new lab, `isbn`). After classes exist, we come back and
give `author` / `affiliation` ranges that are classes, and see it in the entity and
vocabulary explorers.
**Seed (Turtle writer):** prefixes `ex rdf rdfs xsd schema` (`schema:` =
`http://schema.org/`), `ex:title a rdf:Property ; rdfs:range xsd:string`, and a commented
worklist of the eight other terms the day has used. No `rdfs:label` / `rdfs:comment`
(the deck teaches those later; this also clears the old ordering catch R12).
**Live arc:** open on the Vocabulary tab: every term sits **dashed, identity without
description**. Parse the seed; `title` turns solid. The room works down the list, using
the GraphQL schema and the primitives table in the notes. Schema.org is "a well-known
vocabulary that defines these concepts" and nothing more.
**Odd man out, on purpose:** `ex:title` stays `xsd:string` while the rest use
`schema:Text` / `schema:Integer`. Payoff later (SPARQL demos): schema.org defines its own
concept of a string, and the relationship between the two.
**Discrepancy event:** the term itself becomes a node with properties: definitions are
data, same graph, same syntax. The schema's `id: Int!` has no property at all (it became
the IRI in Lab 1).
**Tabs:** Vocabulary (default) + Local Graph.
**Gotchas:** NO `rdfs:domain`; NO range on `author`, `affiliation`, `about` (the queen's
un-typed plant, M11, and the Lab 7/9 reveals depend on it). Verified headless: ranges on
primitives fire no visible inference even with Labs 1-3 data in the graph. Vocabulary
quirk: `author`, `isbn`, and `name` rows merge with the publisher's `schema:` terms
(label-collision groups: "one name, 2 distinct terms") and stay dashed after the room
describes the `ex:` terms; the detail pane shows both IRIs. Expect the question; it
is a feature, not a bug. The Classes tab shows a single large dashed `Book` card (from
Lab 3's catalog record).
### Lab 4 runbook (copy/paste; verified headless Oct 7, after Labs 1-3 are parsed)
Replace the Turtle editor contents with this, then Parse. Expect Properties · 10 with
`title`, `published`, `jobTitle`, `positionHeld`, `about`, `affiliation` solid; no dotted
inferred edges.
```turtle
@prefix ex: <https://example.com/ns#> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
@prefix schema: <http://schema.org/> .

ex:title a rdf:Property ; rdfs:range xsd:string .
ex:published a rdf:Property ; rdfs:range schema:Integer .
ex:name a rdf:Property ; rdfs:range schema:Text .
ex:isbn a rdf:Property ; rdfs:range schema:Text .
ex:positionHeld a rdf:Property ; rdfs:range schema:Text .
ex:jobTitle a rdf:Property ; rdfs:range schema:Text .
ex:author a rdf:Property .
ex:affiliation a rdf:Property .
ex:about a rdf:Property .
```

## Lab 5 — Labels and Comments (NEW Oct 7; slide Lab 5 "turtle writer")

**Design (Michael):** a new Turtle writer where the room adds `rdfs:label` and
`rdfs:comment` to the terms. The seed scaffolds a placeholder for EVERY term in the
vocabulary: one term and an empty `rdfs:label`, ending in a period. The room adds the
semicolon and the `rdfs:comment` themselves (Oct 7 decision). The empty string carries
`@en-US` "because why not."
**Seed (nine blocks, like this):**
```turtle
ex:title
    rdfs:label ""@en-US .
```
(`title published author name affiliation isbn about positionHeld jobTitle`, in that order.)
**Live arc:** fill each label, change the period to a semicolon and add a comment; Parse; select a term in the Vocabulary tab and the
detail pane shows label and comment next to the type and range from Lab 4. Same graph, more triples.
**Tabs:** Vocabulary (default) + Local Graph.
**Gotchas:** descriptive triples only (label, comment); no domain, no classes yet. The
wording below is a suggested fill (mine; Michael to edit).
### Lab 5 runbook (copy/paste; verified headless Oct 7, after Labs 1-4 are parsed)
Replace the Turtle editor contents with this, then Parse.
```turtle
@prefix ex: <https://example.com/ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

ex:title
    rdfs:label "Title"@en-US ;
    rdfs:comment "The title of a published work"@en-US .

ex:published
    rdfs:label "Published"@en-US ;
    rdfs:comment "The year a work was first published"@en-US .

ex:author
    rdfs:label "Author"@en-US ;
    rdfs:comment "Connects a work to the person who wrote it"@en-US .

ex:name
    rdfs:label "Name"@en-US ;
    rdfs:comment "The name of a person or organization"@en-US .

ex:affiliation
    rdfs:label "Affiliation"@en-US ;
    rdfs:comment "Connects a person to the organization they belong to"@en-US .

ex:isbn
    rdfs:label "ISBN"@en-US ;
    rdfs:comment "International Standard Book Number"@en-US .

ex:about
    rdfs:label "About"@en-US ;
    rdfs:comment "Connects a work to its subject"@en-US .

ex:positionHeld
    rdfs:label "Position held"@en-US ;
    rdfs:comment "A role someone holds, such as a monarch's title"@en-US .

ex:jobTitle
    rdfs:label "Job title"@en-US ;
    rdfs:comment "The title of someone's job"@en-US .
```

## Lab 6 — Classes and Subclasses (deck Labs 5+6, slides 246/250; REVISED Oct 7)

**Design (Michael):** just define the kinds of things we've seen (the list in the seed
helps) and play with class hierarchies (CreativeWork as a superclass of Book).
Vocabulary-explorer work, NOT the whole graph yet: no instances are typed in this lab and
there is no Entities tab. Local Graph stays as the second tab.
**Seed (Turtle writer):** prefixes `ex schema rdfs`; `ex:Book a rdfs:Class` with label and
comment as the model; then a commented list of the kinds of things the day has met:
`ex:Author`, `schema:Person`, `ex:Organization`, `schema:CreativeWork`.
**Live arc:** declare the classes, then relate them: `ex:Author rdfs:subClassOf
schema:Person` (crossing dialects: your class, their class, one hierarchy), and
`ex:Book rdfs:subClassOf schema:CreativeWork`. Open Vocabulary, Classes: the nesting
(Person ⊃ Author, CreativeWork ⊃ Book) is the payoff.
**Discrepancy event:** kinds nest inside kinds; the vocabulary is data like everything else.
**Gotchas:** zero inference here by design (nothing typed yet). The old beats move to
Lab 7: the first dotted gold edges, and the un-typed queen (M11). `ex:Book` stays dashed
in the Classes view because it merges with the catalog's `schema:Book` (label-collision
group), exactly like `author`/`isbn`/`name` in Lab 4. Name choice: `ex:Organization`
(your GraphQL schema says `Org` and the IRIs use `/Org/`); later labs already use `ex:Organization`.
### Lab 6 runbook (copy/paste; verified headless Oct 7)
Replace the Turtle editor contents with this, then Parse. Expect Classes · 5.
```turtle
@prefix ex: <https://example.com/ns#> .
@prefix schema: <http://schema.org/> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

ex:Book a rdfs:Class ;
    rdfs:label "Book" ;
    rdfs:comment "A published written work" ;
    rdfs:subClassOf schema:CreativeWork .
ex:Author a rdfs:Class ;
    rdfs:subClassOf schema:Person .
ex:Organization a rdfs:Class .
```

## Lab 7 — Domain and Range (NEW Oct 7; slide Lab 7: first big inferencing reveal)

**Design (Michael):** introduce DOMAIN with `isbn` (the working dataset example): add the
domain triple and the book "Elizabeth the Queen" (Lab 2's record, the one carrying
`ex:isbn`) is now an `ex:Book`. Then mention RANGE and define ranges now that classes
exist; watch what happens in the Entities explorer. Vocabulary + Entities tabs. Very
little scaffold (comments only): they write triples without crutches. This is where
inferred triples (types, and compounding up the hierarchy) first appear. `stageName` is a
slide concept only.
**Seed (Turtle writer):** `ex`, `rdfs` prefixes and two comment lines:
`# What kind of thing has an ISBN?` and `# Then: what kind of thing is the value of
ex:author? Of ex:affiliation?`
**Live arc:** (1) `ex:isbn rdfs:domain ex:Book`; Entities tab (opens on **All** by Michael's call; the
*Mine* toggle is this lab only and would show "No classes defined yet", because the classes
live in Lab 6): the book 8268 is now a Book, dotted gold. (2) Mention range; add `ex:author rdfs:range
ex:Author` and `ex:affiliation rdfs:range ex:Organization`: Hofstadter (872) and Sally
(35626) appear as Authors and, compounding, as Persons; the book is also a CreativeWork;
the organization appears. Nobody typed any of it.
**Verified headless Oct 7 (Labs 1-6 parsed first), Entities / All:** Person ⊃ Author
(872, 35626, each also at Person level), CreativeWork ⊃ Book (8268, also at CreativeWork
level), Organization (34), plus the catalog's own `schema:Book` (asserted, separate class
until the merge lab). The queen is NOT typed (M11 intact; her classification arrives in
Lab 9). Michael Carducci is not typed either (his author link is `schema:author`).
**Gotchas:** NO domain or range on `ex:about` (it would type the queen early).
### Lab 7 runbook (copy/paste; verified headless Oct 7)
Step 1, then Parse:
```turtle
@prefix ex: <https://example.com/ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

ex:isbn rdfs:domain ex:Book .
```
Step 2 (replace the editor contents with this), then Parse:
```turtle
@prefix ex: <https://example.com/ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

ex:isbn rdfs:domain ex:Book .
ex:author rdfs:range ex:Author .
ex:affiliation rdfs:range ex:Organization .
```

## Lab 8 — Merging Vocabularies (deck Labs 7+8)

Aligning our vocabulary to schema.org's terms and classes, in **pure RDFS** —
no `owl:` yet. The arc inside the lab: one-way containment first (the honest,
common case), then the escalation to both-ways — equivalence built live out
of a part the room already owns.

**Seed (Turtle writer):** the worked example is `title`, the day's running
term — `ex:title rdfs:subPropertyOf schema:name .` **one direction only**,
with the candidates commented as questions (`author`? `Book`? `isbn` —
"careful: is this one-way… or both?").

**Walking the title example — beats and quips:**
- Setup: "Their system doesn't even have a word called *title* for this — they
  say *name*. Do we fight about it? No. We state the relationship."
- The device: "Every title is a name. Not every name is a title — ask anyone
  named Duke." (Beer/beverage carryover: *title is the beer here.*)
- **The prop bit (do this physically):** hold up the book — "What's the *name*
  of this? …You'd hand me the title. Interchangeable — in that direction."
  Point at yourself — "But *Michael* is not the title of a book. Name is the
  broader thing; title is the special case that works anywhere a name is
  wanted, never the reverse. So we're modeling this as a **specialization** —
  and RDFS already has one word for 'the special case of': `subPropertyOf`.
  One line, one direction, and the graph knows a title will serve anywhere a
  name is asked for."
- Parse, then the bloom: two dotted `schema:name` triples appear on the
  *morning's* records. "Nobody edited the publisher's data. Nobody wrote a
  migration. We told the graph one true thing, and it re-read everything it
  already knew."
- Why one-way matters — **the trap: transitive welding through a hub.**
  Equivalence composes: everything declared equivalent to `schema:name`
  becomes equivalent to *each other*, not just to it. Walk it: declare
  `ex:title ≡ schema:name` (both ways), then later someone reasonably adds
  `ex:name ≡ schema:name`. Both look innocent. The chain now runs
  `ex:title ≡ schema:name ≡ ex:name` — *your own two properties just merged*.
  Hofstadter's name "Douglas Hofstadter" is now also his title; every book's
  title is its `ex:name`. Nothing errors — the graph did exactly what you
  said, globally, retroactively, in dotted edges. Rule of thumb for the room:
  **one-way arrows can safely converge on a shared hub; two-way arrows
  through a hub weld everything they touch into one property.** "Is it true
  in both directions?" is the modeling question of this lab — isbn passes,
  title doesn't. Quip: "Careless equivalence is how you end up with a library
  where everybody is named *Moby Dick*."
- The escalation (live): work the worklist. `author`: one-way. Classes: same
  trick one level up, `rdfs:subClassOf`. Then `isbn`: "is every `ex:isbn` a
  `schema:isbn`? Yes. Is every `schema:isbn` an `ex:isbn`? …also yes. So say
  it twice." Two one-way statements, both directions → "How must a reasoner
  evaluate that? The only world where both hold is one where they're *the
  same property*. We just built equivalence out of subproperty." (OWL's
  contribution — *naming* this pattern in one line — stays in the OWL
  section's pocket.)
- If Lab 2's collision was left unfixed, "Biographer" now blooms as Sally's
  `schema:name` — either quietly fix it in Lab 2 beforehand, or use it:
  "alignment propagates your *mistakes* just as faithfully."

**Tabs:** Vocabulary (default) + Local Graph (the Turn's pointing surface:
the bridge itself is an edge among the books and people) + Full Graph (the
bloom across the whole morning).

**Note:** ADR-038 (cumulative reasoning) is what makes all of this real —
axioms parsed here act on the whole morning's data, and the isbn bridge built
here detonates again when the foreign dataset arrives in Lab 9.
**End state (verified; Labs 9/12/13 depend on the isbn and Book lines):**
```turtle
ex:title  rdfs:subPropertyOf schema:name .    # one-way — the Duke
ex:name   rdfs:subPropertyOf schema:name .
ex:author rdfs:subPropertyOf schema:author .

ex:Book   rdfs:subClassOf schema:Book .
schema:Book rdfs:subClassOf ex:Book .         # classes: true both ways

ex:isbn   rdfs:subPropertyOf schema:isbn .
schema:isbn rdfs:subPropertyOf ex:isbn .      # equivalence, built by hand
```

### The bridge out of Lab 8 (Pledge / Turn / Prestige)

- **Pledge:** declarative alignment, shown. Classes converged, properties
  deduped, dotted dialect triples across the morning's data.
- **Turn (rapid-fire takahashi):** "You might be thinking 'ok cool, we mapped
  two schemas… in a really weird way…' — That's not what just happened. We
  *learned* something about the semantics. We expressed what we learned as
  individual facts. We added those facts to the knowledge graph. We didn't map
  fields. We made the data, itself, smarter."
- **While saying "individual facts": point at the Local Graph tab** — the
  bridge is ON SCREEN as data: `ex:isbn —subPropertyOf→ schema:isbn`, an edge
  among the books and people. "Your mapping has an IRI. It's queryable. Your
  ETL config never was."
- **Prestige = Lab 9's fetch** ("…let me show you something…"), BEFORE the
  LOD story: the queen's record joins with zero local mapping. Then "how does
  this scale?" → DBpedia → LOD cloud as *recognition* — the world has been
  doing what the room just did, since 2007, at billions of facts.
- **Callback triangle to keep verbally parallel:** slide 154 "the graph grows
  in understanding" (plant) → this Turn "we made the data itself smarter"
  (thesis) → slide 498 "it's a capability of the data itself" (payoff).

## Lab 9 — Integration for Free (deck Lab 9)

**Seed:** empty JSON-LD panel labeled "DBpedia Record (Fetch it)"; the Fetch
IRI input arrives pre-filled (`sembook:fetchUrl`) with
`../datasets/elizabeth-dbpedia.jsonld` — one click fetches (fills the editor,
does NOT parse), a second click commits.
Read it with the room first: dbo: terms nobody has seen, and — scroll down —
**the vocabulary's alignments travel with the data** (`dbo:Person ⊑
schema:Person`, `dbo:birthName ⊑ schema:name`; DBpedia genuinely publishes
these). No comment syntax exists in JSON — the pointing IS the callout.
**Live arc:** Fetch → read → Parse → Full Graph: the foreign record attaches
to the *existing* queen node (same IRI since Lab 2), and the dotted climb
happens — queen and Philip derive `schema:Person` through DBpedia's own
chain, birth name lands on `schema:name` where the morning's data already
converges. Zero local mapping was written.
**Discrepancy event:** data from a system nobody mapped arrives *already
understood* — the room's Lab-6 work and DBpedia's published alignments meet
at the schema.org hub without coordination. **The queen beat:** she was
deliberately left unclassified in Lab 6 (the "notice who's missing" plant) —
now she materializes into the Person container, dotted, classified by
someone else's knowledge: "suddenly the queen is a person — and nobody in
this room said so."
**Tabs:** Local Graph (default) + Entities + Vocabulary.
**Deck:** this is the Prestige — the "…let me show you something…" beat,
BEFORE the LOD story; "how does this scale?" → DBpedia → LOD as recognition.

Design decisions on record:

- **The dataset is doctored, on purpose (pedagogic license, entry due when the
  file lands):** heavily trimmed from real DBpedia output — what's in frame in
  CodeMirror must look *familiar*, not a mountain of every-language labels.
  Buried inside: schema.org assertions that genuinely exist in DBpedia's
  vocabulary alignment, called out quietly in a Turtle comment if the surface
  is Turtle. Authentic `owl:` strays stay (foreshadowing), curated so nothing
  visibly merges before its moment.
- **Fetched IRIs are silently rebased** (existing dereference behavior — CORS
  + offline-capable demos). License note due alongside the dataset.
- Fetch fills the editor and does NOT parse (ADR-019) — read the foreign
  record with the room before committing it.
- **The smuggle (DO NOT FORGET):** the doctored dataset carries extra vocab
  assertions that pay off *later* — a fact surfaces labs afterward and the
  beat is "how did the data know that? …DBpedia told us." That question is
  the bridge into the trust/provenance aside (whose full answer is the
  named-graphs beat in the SPARQL section: every triple knows where it came
  from). Choose the smuggled assertions when the dataset is authored.
- **Quip looking for a home** (candidate spots: after this lab's zero-mapping
  merge, the OWL declare-once section, or the 1000× token-reduction slide):
  *"The smarter we make the graph, the less we need to say."*

### Post-Lab-7 deck sequence (agreed rework)

Wow → stakes → origin → ecosystem → thesis; each beat answers the question
the previous one raises:

1. **Land the Prestige** — the Turn slides, closing "how does this scale?"
2. **Energy Instruments tease** (pulled forward; 1–2 slides, plant not
   payoff): four systems, one business question, zero ETL. "Read and write in
   whichever dialect makes sense to you." Full case study still returns later.
3. **Liz IRI → DBpedia → LOD** (existing 265–271 run): "where did that record
   come from?" — lands distributed-understanding-without-coordination as
   *recognition* of what the room just did.
4. **schema.org reveal + existing vocabularies**: "that hub you aligned to
   this morning? It has a name." Origin capsule with COMPRESSED Google/hotels
   (2–3 slides — the market-coercion beat; designated flex cut if long).
   Then widen: utility vocabs (rdf/rdfs/xsd — how to say) vs domain vocabs
   (schema.org, Dublin Core, industry — what there is). Subclass, don't
   reinvent. **Callback ammo for the reveal: roughly half of the indexed
   web already carries JSON-LD** — the dialect the room "met at 10am" is
   the most widely deployed data format they've never heard of.
5. **"We don't need a global ontology. We never did."** — thesis restated,
   calling back the morning's 132–136; the EKG/EDW line lands here.
6. **The old "Merging Graphs" placeholder is DELETED** — its content is Lab 9;
   the callout slide, retitled "Integration for Free," lives at the Prestige.

## Lab 10 — The Nature of Relationships (OWL: symmetric / inverse / subproperty)

**Surface:** dueling Turtle writers — **Data** (left) | **Semantics** (right)
— over a single Local Graph tab. Separation of concerns made physical: the
data never changes; you parse *meaning* and the graph grows.
**Seed:** Data holds ONE fact: `<w3id:michael> ex:husbandOf ex:kate .`
Semantics holds only the breadcrumb comments. Follow-along.
**The follow-along Turtle (final state of the Semantics panel):**
```turtle
@prefix ex: <https://example.com/ns#> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

ex:husbandOf rdfs:subPropertyOf ex:marriedTo .
ex:marriedTo a owl:SymmetricProperty .
ex:wifeOf owl:inverseOf ex:husbandOf .
```
**Staging:** parse Data first — two nodes, one edge, nothing else. Then add
the semantics one line at a time, parsing after each: subPropertyOf →
*michael marriedTo kate* (dotted); SymmetricProperty → *kate marriedTo
michael*; inverseOf → *kate wifeOf michael*. **One asserted fact, three
derived facts** (verified). "I said one thing. The graph now knows four."
**Do NOT promise `owl:propertyChainAxiom`** (uncle = brother∘parent, etc.) —
the notebook's reasoner is BGP-only and cannot run chains; it's a
slides-only mention.
**Delivery:** SQL strawman + can't-be-hallucinated + punctuation rule, every
beat.

## Lab 11 — Transitivity (the UberConf world)

**Surface:** same dueling-writers + Local Graph shape.
**Seed (Data):** UberConf `a schema:EducationalEvent`, `schema:performer` →
Michael's w3id IRI, `schema:location` → Westin Westminster (`schema:Hotel`);
`ex:locatedIn` chain: michael → Westin → Westminster → Colorado, plus
Westminster → `ex:DenverMetro` (label: "Denver"). Semantics: breadcrumbs
only ("…where am I? The graph does not know yet.").
**The follow-along Turtle:** one line —
```turtle
ex:locatedIn a owl:TransitiveProperty .
```
**Payoff (verified):** five derived edges bloom at once — michael is in
Westminster, in "Denver," in Colorado; the Westin too. One line of
semantics; the graph closes the whole chain.
**The Denver aside (lean, keep):** the conference ads say "Denver, CO" —
Westminster isn't in Denver proper. `ex:DenverMetro` is a *different
resource* that happens to carry the label "Denver," and it's the one the ad
means. Nobody lied; two contexts, two resources, one label. Lab 2's
title-collision lesson, grown up — 30 seconds, then move on.

## OWL suite — remaining (IFP; FP punted)

**FunctionalProperty — PUNTED as a lab (2026-07-12).** Every candidate
breaks: spouse (stale data welds your ex to your current), bornIn
(granularity — "Rock Springs" and "USA" are both true, FP welds a city to a
country). The underlying principle, worth one slide breath at most: **FP
claims uniqueness about the world; IFP claims uniqueness about an
identifier — and identifiers are the one thing humans design to be
unique.** That's why IFP demos sing and FP demos blow up. If the stale-data
question arises anyway (someone will invent FP in their head), it's a gift
with a scheduled answer: "you've just discovered why provenance matters —
hold that thought for the last lab."

**Lab 10 coda — the Philip payoff (QUICK BONUS FACT, instructor-only beat):**
after Kate's cascade: "…and remember Philip?" Add to the Semantics panel —
`@prefix dbo: <https://dbpedia.org/ontology/> .` then
`dbo:spouse a owl:SymmetricProperty .` and, for the cross-ontology kick,
`dbo:spouse rdfs:subPropertyOf ex:marriedTo .` → parse → **switch to the
Entity viewer**: Philip now carries an inferred `marriedTo` — DBpedia's
fact, expressed in OUR vocabulary, derived by a rule typed seconds ago.
**The significance to hit (needs its own vibrant slide):**
**MULTIPLE DATASETS GOT SMARTER.** Not our data enriched by theirs — every
dataset in the graph now knows more, in every dialect, simultaneously.
Script: "The graph knows more than you told it. The AI consuming this knows
more than you told it. These are new facts in the dataset — and they cannot
be hallucinated."
## Lab 12 — Semantic Alignment (IFP — the identity climax) — BUILT

**Surface:** left = JSON-LD panel, Fetch pre-filled with
`../datasets/elizabeth-catalog-record.jsonld`; right = Turtle writer
(breadcrumbs only); below = Local Graph, Full Graph, Entities, Vocabulary.
**The dataset:** a fictional library system (`lib:` —
catalog.worldlib.example): its own record IRI, `lib:mainTitle`,
`lib:author` ("Smith, Sally Bedell", literal, library-style), `lib:isbn`
`"0812979796"`, `lib:format` — and its vocabulary's own schema.org
alignments in-band (`lib:Book ⊑ schema:Book`, `lib:isbn ⊑ schema:isbn`,
`lib:mainTitle ⊑ schema:name`). **No identifier shared** with the Lab 2
record.
**The follow-along Turtle (one line):**
```turtle
schema:isbn a owl:InverseFunctionalProperty .
```
**Chain (verified end-to-end):** Lab 2's isbn mapping (`isbn` → `ex:isbn`,
done live at 9:45) + Lab 8's alignment (`ex:isbn` ↔ `schema:isbn`, done
live mid-morning) + the fetched record's own `lib:isbn ⊑ schema:isbn` +
this one line → both records derive `schema:isbn "0812979796"` → IFP fires
→ `owl:sameAs`, both directions. **16 derived triples.** In the Entity
explorer: two book dots become ONE, and the merged record's **properties
double** — it gains `mainTitle`/`author`/`format` from the library AND the
room's `title`, Sally's IRI, and the `about` → Elizabeth link, which
connects the merged book into the queen's whole cluster.
**LIVE-WORK DEPENDENCIES (do not skip):** the merge requires Lab 2's isbn
mapping and Lab 8's isbn alignment to have actually happened. If either was
skipped, add them quietly before this lab.
**Delivery:** "Two systems. No shared key. Nobody wrote a crosswalk. We
told the graph one true thing about what an ISBN *is* — and identity
emerged." Then the pause — the denouement — before the KG reveal and
SPARQL: look at Full Graph. That thing on screen is a knowledge graph. It
was never built. It *emerged*.

**Slide asset delivered:** `C:\Users\micha\OneDrive\Documents\talks\lab9-local-graph.svg`
— Lab 10's local-graph end state in the tool's *pre-reskin* visual grammar (teal
IRI nodes, solid gray asserted edges, dashed violet inferred), laid out
clean: michael/kate with 1 solid + 3 inferred edges, semantics cluster to the
right. (Live Cytoscape export was unusable — layout doesn't settle in the
headless env.) **Stale since the Semantic Lounge reskin:** the tool now draws the
brand's diagram grammar (hollow Lace rings, solid Lace asserted, dotted String-light
inferred); regenerate before using it on a slide.

## SPARQL section — AGREED PROGRESSION (Michael, 2026-07-12)

**Act 1 — familiar ground** ("…you're safe and sound here, now…"). It's a
query language. Preset sample queries in the dropdown, run in order:
1. `SELECT ?s ?p ?o` — remember, it's all triples.
2. Books, in OUR vocabulary (`ex:`).
3. `DESCRIBE <https://w3id.org/people/michael>` — introduce the keyword;
   four dialects come back off one node.
4. The books query again — in schema.org terms, then dbo:/foaf-flavored —
   same answers, different language.
**Takeaway slide/speech:** "Your AI doesn't care what your info silo calls
things — because it knows what you MEAN. And so does every other system
that consumes it. So why are you still writing ETLs, and mapping files, and
anti-corruption layers, and SDKs, and… Just make data make sense to
machines."

**Act 2 — the rug pull** ("…at the McFly farm."). This isn't a database —
it's a knowledge graph. Direct questions. Wikidata tangent for endless
examples. Then: how does this plug into AI? Toggle the SPARQL endpoint on,
advertise it in Hydra, back to the generic client, ask the big question,
get the answer.
**The drumbeat:** Zero-shot. Self-discovering. Explainable. Grounded.
Provable. *Justified.*
**Value prop, verbatim arc with callback slides:** language is vague; SPARQL
is precise. "Remember the Q&A example from the very beginning (slide) — and
I said (slide) there's no mechanism in the architecture for truth, only
probability. (slide) SPARQL gives you truth. (slide) Your knowledge graph is
the architecture for truth your AI has been missing all along. Stop thinking
it's something you *build*. It's not an artifact. It's not a neo4j database.
It's an emergent behavior — born from making your data mean something."
**"Emergent" means, concretely:** a bare LLM, generic prompt, generic
client, connected via the API and KG — instantly understood the landscape.
No prior knowledge. No custom prompt. No MCP. No custom tools. No generated
SDK.

## Lab 15 — Who Said That? (provenance — the capstone) — BUILT & VERIFIED

**Surface:** fetch panel (left, pre-filled:
`../datasets/elizabeth-gossip-record.jsonld` — "CelebWatch", a gossip site
that hotlinks the queen's DBpedia IRI, asserts her birthday OFF BY ONE DAY,
and one true fact: alternateName "Lilibet") | SPARQL panel (right) | Result
(full-width below).
**Live arc:** Fetch → read ("looks fine, right?") → Parse. The graph accepts
it without complaint — *it's entertaining the idea.* Then the numbered
queries:
1. **When was Elizabeth born?** → TWO answers. "Is the graph broken? No.
   It's doing what an educated mind does."
2. **…says who?** → sources named. Note the gem: DBpedia's date comes from
   an *-inferred* graph — the trusted answer is itself a derived fact with
   its own receipt (DBpedia said dbo:birthDate; the schema form was
   inferred, and the provenance says so).
3. **Only sources we trust** → one answer. Nothing deleted.
4. **What else did the tabloid claim?** → "Lilibet" — which happens to be
   TRUE. Excluding the source dropped a true fact too: trust decisions are
   coarse, and that's exactly why provenance beats deletion — the receipts
   survive to be re-examined.
**This lab is the stage for the Turn script below** — run the beats over
these queries, landing "Acceptance isn't storage. Acceptance is a
query-time decision. …Belief. Justified. And now — TRUE, with receipts."
**Mind the tense — the queen is dead (2022):** "she WAS born," "her spouse
WAS Philip." If anyone points out she died: that's a free beat, not a
problem — *the graph doesn't know she's dead; nobody told it.* No deathDate
exists anywhere in the day's data. "The graph only knows what it's been
told — and it knows exactly who told it." Which is the whole lesson,
restated by an audience member for free.
**Deliberately NO early fester:** the conflict arrives here, in this lab,
under control (rule 7b). The soft latent version — the merged book's
double-shaped author from Lab 12 — is available as an optional pointable
if the moment wants a second example.

## The Turn Nobody Expects (provenance / named graphs) — SCRIPT

Set-up (Michael's beats, verbatim):
> "Justified, true, belief. (beat) That's what this whole workshop has been
> about. (beat) Knowledge. (beat) The semantic layer is how machine
> knowledge is justified. You see how it works. (beat) You've seen a lot of
> accuracy. (beat) But accuracy isn't always truth. …
> 'An educated mind is one that can entertain an idea without accepting
> it.'" (attribute as "attributed to Aristotle" — it's actually Lowell
> Thomas; engineers have phones.)

"Accuracy isn't truth" is a CALLBACK to the morning's 90%/one-nine slides —
accuracy unmasked a second time, one level up.

The landing (the quote is a literal spec of the quad store):
> "Your knowledge graph is an educated mind. It's been holding DBpedia's
> claims, and my claims, and YOUR claims — all day. Entertaining every one
> of them. But it never confused *storing* a fact with *accepting* it —
> because every fact in this graph remembers who said it."
> (live: GRAPH clause — exclude a source without deleting it; show asserted
> vs inferred provenance)
> "Acceptance isn't storage. Acceptance is a query-time decision.
> …Belief. Justified. And now — TRUE, with receipts."

This is also the L1/L2 license unwind: "the notebook has been doing this
invisibly since 9am" — the tool confesses its own machinery as the final
lesson in trust. If anyone raised the stale-data question earlier, name
them here — the scheduled answer arrives.

## Lab 13 — Querying the Graph — BUILT & VERIFIED

Seven sample queries in the dropdown, numbered in delivery order:
1. **It's all triples** — `SELECT ?s ?p ?o` (auto-scoped to the whole day,
   asserted + inferred; ~100+ rows).
2. **Books — in our vocabulary** — the LIBRARY record answers `ex:title`,
   a property it never asserted.
3. **DESCRIBE Michael** — one node, four dialects (ex:, schema:, foaf:,
   rdf; dbo: shows on Elizabeth).
4. **Books — in their vocabulary** — same books, schema.org terms. NOTE:
   counts can differ between 2 and 4 — `ex:title ⊑ schema:name` is one-way
   (the Duke!), so a book with only schema:name has no ex:title. If asked,
   that's the answer: direction was a modeling decision.
5. **Everything about Elizabeth — and who said it** — GRAPH ?source; rows
   grouped by origin, including `-inferred` graphs (derivations have
   provenance too).
6. **The same — without trusting DBpedia** — FILTER NOT IN the two
   integration-for-free graphs; only the room's facts remain. "Excluded,
   not deleted." Honest caveat if pressed: derivations that OTHER labs
   computed from excluded data live in those labs' inferred graphs — full
   truth-maintenance is real engineering; this shows the primitive.
7. **Query the notebook itself** — returns all 13 labs from the default
   graph. (Mechanism: the leading comment mentions GRAPH, which switches
   off the automatic lab-scoping — documented in the comment itself.)

## Lab 14 — Contexts on the Fly (CONSTRUCT) — BUILT & VERIFIED

**Bridge in:** "We don't need a global ontology. We just need contextual
definitions… and we can build those on the fly."
**Two sample queries:** (1) *Invent a vocabulary — right now*: CONSTRUCT
mints `reporting#displayName` onto every Person — a vocabulary that did not
exist five seconds ago, populated from three source dialects; the Result
panel's Graph view shows the reshaped world. (2) *Define a new class on the
fly*: CONSTRUCT types every pre-2000 book `reporting#TwentiethCenturyBook`
— a class nobody declared, enumerated by query. (Depends on Lab 1's live
`published` mapping.)
**Bridge out:** straight into the Energy Instruments case study — "one of
these queries saved a million dollars."

### EI slide query (hypothetical, for the case-study slide)
```sparql
PREFIX ei: <https://energyinstruments.example/ns#>

CONSTRUCT {
  ?part a ei:DisposablePart .
}
WHERE {
  ?part a ei:Part ;
        ei:storedIn ?warehouse .

  FILTER NOT EXISTS {
    ?product a ei:Product ;
             ei:status ei:Active ;
             ei:usesPart ?part .
  }
}

# ei:usesPart is transitive — the reasoner has already flattened
# every level of every bill of materials. That's why this query
# never has to mention sub-assemblies.
```
The footnote is the depth-charge: the query is *simple because the
reasoning already happened*. Say the number after the room reads it.

## SPARQL section — REMINDERS

- **"Query in whatever language makes sense to you" demo:** run the persons
  query in schema.org terms, then the identical question in `ex:` terms —
  same answers, "but you already understand this…" Then the closer,
  (foaf has no live source now that Standing on Shoulders is cut; TBD which dialects the DESCRIBE shows)
  `DESCRIBE <https://w3id.org/people/michael>` returns **one node speaking
  four dialects** — `ex:`, `schema:`, `dbo:`, `foaf:` — "one thing, four
  vocabularies, one graph. Pick whichever language you think in; the answers
  are the same." Exact sequencing TBD.
- **Tie this demo back to multi-agent systems** when the deck reaches that
  section — an agent that speaks *any* of the aligned dialects can query the
  graph; nobody coordinated. Michael asked to be reminded at that deck beat.
