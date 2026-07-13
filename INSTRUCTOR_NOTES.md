# Instructor Notes — Workshop Labs (notebook1)

Per-lab choreography for the workshop. Each lab lists: seed state, the live arc,
the one discrepancy event the lab exists for, and stage gotchas. Companion to
the deck ("An Engineer's Guide to the Semantic Layer"); deck cue points refer to
slide numbers as of 2026-07-12 and shift as the deck is renumbered.

**Standing rules (apply to every lab):** phenomenon before name; one
discrepancy event per lab; seeds fire zero visible inference before Lab 5;
schema.org stays "some other system's dialect" until the web-scale reveal;
nothing invites "what if triples disagree" before the named-graphs beat.

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
**Live arc (four states):** raw parse (blank amber nodes, two islands) →
add `@base` + map `id` → `@id` (nodes teal, IRIs appear, still two islands) →
map `author_id` to `{"@type": "@id"}` (THE edge snaps, one graph) → Fetch
`hofstadter-extended.jsonld` into Document B (properties explode, same IRI, no
mapping).
**Discrepancy event:** the edge snap — one line of context connects two systems.
**Gotchas:** the term-mapping pass (deck Lab 1c) maps `title`, `published`,
etc. to `https://example.com/ns#…` — later labs assume those IRIs exist, do
not skip it. Amber → teal is the identity lesson; narrate the color change.

## Lab 2 — Data and Context (deck Lab 2)

**Seed:** Elizabeth biography record, body uses bare `@id`s (slide 130). The
context maps `title` → `ex:title` and demonstrates the nested-context pattern
once (`about.title` → `ex:positionHeld`). `name` and `isbn` are deliberately
unmapped (`implied:` predicates); the author's `title` deliberately inherits
the outer mapping — "Biographer" lands on `ex:title`.
**Live arc:** read the collision (three `title`s), walk the nested-context
resolution for the queen, then let the room fix the author's title and map
`isbn`/`name` themselves.
**Discrepancy event:** same key, different meanings, resolved per-context —
and the leftover collision the room fixes by applying the pattern.
**Tabs:** Local Graph + Vocabulary only.
**Gotchas:** keep everything in `ex:` — no schema.org here; the queen's
DBpedia IRI is a plant for the merging lab, don't dwell on it.

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

## Lab 4 — Defining Terms (deck Lab 4, slide 239)

**Seed (Turtle writer):** full RDFS definition of `ex:title` — `a
rdf:Property; rdfs:label; rdfs:comment; rdfs:range xsd:string` (the slides'
definition in legal Turtle — note the deck's `rdfs:Property` slides are being
corrected to `rdf:Property`).
**Live arc:** open on the Vocabulary tab: every term the morning used sits
there **amber — identity without description**. Parse the seed; `title` turns
teal. The exercise: work down the amber list writing rough RDFS definitions.
Optionally pull back the curtain on `implied:` here (`@vocab` — "the tool has
been catching your unmapped keys all morning").
**Discrepancy event:** the term itself becomes a node with properties —
definitions are data, same graph, same syntax.
**Tabs:** Vocabulary (default) + Local Graph.
**Gotchas:** zero inference fires here by design (range axioms have no data
in this lab's graph). Don't define `subClassOf` yet — that's Lab 5's powder.

## Lab 5 — Classes and Subclasses (deck Labs 5+6, slides 246/250)

**Seed (Turtle writer):** `ex:Book a rdfs:Class` with label/comment (slide
244's definition), plus one claim: GEB `a ex:Book`. Below it, a commented
roster of the classes the day has implied but never declared (`ex:Author`,
`schema:Person`, `ex:Organization`) — unlike properties, undeclared classes
have no amber reference list in any panel, so the seed carries the worklist.
Inference-silent on Parse — no `subClassOf` in the seed.
**Live arc:** declare `ex:Author a rdfs:Class`, then the hierarchy —
`ex:Author rdfs:subClassOf schema:Person` (note: **crossing dialects** — your
class, their class, one hierarchy; quietly the first cross-vocabulary modeling
act of the day). Type the existing cast: Sally, Hofstadter, Michael `a
ex:Author`; the queen `a schema:Person` (she needs the typing to appear in
the entity viewer at all). Watch the Entities tab.
**Discrepancy event:** the first dashed edge of the day — Sally's dot appears
*inside the Person container* though nobody typed her there; the reasoner
derived it from the hierarchy (rdfs9). Then it compounds: every Author is a
Person, free, forever.
**Tabs:** Entities (default) + Vocabulary + Local Graph.
**Gotchas:** the typings and the hierarchy must be asserted in THIS lab
(reasoning is per-lab-graph). Type the queen with no other properties in this
lab — with the entity panel's scope on "Mine" she shows bare; flipping to
"All" pulls her Lab-2 properties in, which is its own small accumulation beat.
The seed's comment block doubles as the cheatsheet: the cast's full IRIs are
right there — nobody should be scrolling back through labs to copy an IRI.
Optional stretch: `rdfs:domain ex:isbn ex:Book`, then assert a brand-new
resource with only an `ex:isbn` — it gets typed `ex:Book` out of thin air.

## Lab 6 — Merging Vocabularies (deck Labs 7+8) — IN DESIGN

Aligning our vocabulary to schema.org's equivalent terms and classes, in
**pure RDFS** — no `owl:` yet. Equivalence is built live out of a part the
room already owns: `rdfs:subPropertyOf`, declared both ways.

**The rhetorical device (use this):** "You know how all beers are beverages,
but not all beverages are beers? That's subclass — one-way. Now suppose I say
it *twice*, in both directions: every `ex:isbn` is a `schema:isbn`, and every
`schema:isbn` is an `ex:isbn`. How would a reasoner evaluate that? The only
world where both rules hold is one where they're *the same property*.
`ex:isbn` ≡ `schema:isbn` — we just built equivalence out of subproperty."
Payoff deferred to the OWL section: OWL's contribution is *naming* this
pattern (`owl:equivalentProperty` — one line instead of two; watch it replace
them, same graph).

**Open items before build:** cumulative-reasoning decision (the bridge
declared here should detonate when the foreign catalog arrives in the merging
lab — cross-lab inference doesn't exist yet); which terms/classes get aligned
in the seed vs. live; surface (Vocabulary tab primary).
