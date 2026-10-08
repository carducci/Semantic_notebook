# Workshop Notes: Architecting the Semantic Layer

Your companion for the hands-on labs at
**<https://notebook.semantic.consulting/notebook1/>**. Everything runs in your
browser; there is nothing to install. Each lab is one full screen; scroll (or use the
menu) to move between them. **Parse** is your commit button: edit, parse,
watch the graph.

Reading the graph: **solid rings** are things with identity (an IRI). **Dashed
rings** are anonymous: the graph knows something is there, but not *what*.
**Filled boxes** are plain values. **Dotted gold** edges and *italic* rows are facts
the graph worked out on its own. You'll see your first one in Lab 7.

---

## Lab 1: Identity and Connection

Two JSON documents from two different systems describe connected things: a
book and its author. Nothing connects them, because nothing in them has
identity. You can see the meaning; the machine sees nothing.

**Goal:** feel the moment data becomes *linked* data.

Identifiers in this workshop follow one scheme:
`{scheme}://{authority}/{collection}/{keyspace}/{key}`, for example
`https://example.com/Book/Id/441`.

### Lab 1a: Two islands

Parse both documents as they are.

You should see two islands of dashed rings. Dashed means the graph knows
something is there, but not what.

*Pause here. We talk about identity before 1b.*

### Lab 1b: Fully qualified identifiers

Replace the identifier values with IRIs in our scheme: the book becomes
`https://example.com/Book/Id/441`, the author `https://example.com/Author/Id/872`,
the organization `https://example.com/Org/Id/34`. Change every place those
values appear, including the references. Parse.

Nothing changes. `id` is a magic string; the machine has no idea it means
"identity."

*Pause here. We talk about data versus information (context) before 1c.*

### Lab 1c: Context

Add a `@context` that maps `id` to `@id`. The dashed rings turn solid.

Then map `author_id` so its value is a reference, not a string:
`"author_id": { "@type": "@id" }`. The islands become one graph.

You're done when you have one connected graph, no dashed rings, and you can
say why the edge appeared.

*Pause here. The keys have the same problem the documents just had.*

### Lab 1d: Mint terms

`title` and `published` are magic strings too. Give each term an identifier of
its own (`https://example.com/ns#title`, `https://example.com/ns#published`,
`https://example.com/ns#author`, and so on) and map them in the `@context`.
Later labs assume these IRIs exist.

## Lab 2: Data and Context

One JSON document where the same key (`title`) means three different things:
a book's title, a royal position, or a job. Humans read past this; machines can't.

**Goal:** meaning is contextual, and context can be written down.

Nothing in the `@context` defines `title`, `isbn`, or `name` yet; the graph
calls them `implied:`. Define them. Map each key to a term of your own, such
as `https://example.com/ns#title`, and parse.

Now look at the other `title`s in the document. Where did they land? Is that
what the queen's `title` means? The author's? What tells two meanings apart?
The `@context` inside `about` and `author` lets one key resolve differently in
different places; see what you can do with it.

You're done when: three different `title` meanings resolve to three different
properties, and nothing in the graph says `implied:` anymore.

## Lab 3: Two Syntaxes, One Graph

A record from a completely different system (a publisher's catalog, using a
vocabulary we've never seen) and a second pane you haven't met.

**Goal:** JSON-LD documents are one *costume* for something deeper: sentences.

Parse, then read the right-hand pane out loud. Subject, verb, object, period.
That's Turtle: the same graph, written as statements. Notice the `@context`
prefixes became `@prefix` lines. Change something on the left; parse; find it
on the right.

You're done when: you can point at any line of Turtle and say which part of
the JSON it came from.

## Lab 4: Defining Terms

Open the Vocabulary tab: every term you've used today is listed, and almost
all of them are dashed. They have identity, but no meaning anyone wrote down.

**Goal:** definitions are data. A term is a resource you can describe like any
other.

You have designed a schema before. Here is ours, the way you would write it in
GraphQL:

```graphql
type Author {
  id: Int!
  name: String
  affiliation_id: Org
}

type Book {
  id: Int!
  title: String
  author_id: Author
  published: Int
}
```

Now say the same things as statements. The editor holds a complete definition
of `title`: what kind of thing it is (`rdf:Property`) and what values it takes
(`rdfs:range`). Parse it and watch `title` turn solid in the vocabulary. Then
work down the list and describe your own terms the same way.

Some of the terms (`isbn`, `about`, `positionHeld`, `jobTitle`) came from Lab 2
and aren't in the schema above; decide what their values look like.
`author`, `affiliation`, and `about` point at other things rather than plain
values. Give them a type and leave the range for now.

**Primitives, for reference.** `schema:` is `http://schema.org/`, a well-known
vocabulary that defines these concepts. `xsd:` is XML Schema's datatypes.

| Your schema says | `schema:` | `xsd:` |
|---|---|---|
| `String` | `schema:Text` | `xsd:string` |
| `Int` | `schema:Integer` | `xsd:integer` |
| `Float` | `schema:Float` | `xsd:double` |
| `Boolean` | `schema:Boolean` | `xsd:boolean` |
| `Date` | `schema:Date` | `xsd:date` |
| a timestamp | `schema:DateTime` | `xsd:dateTime` |

You're done when every term you created is described, and you can explain what
`rdfs:range` told the graph.

## Lab 5: Labels and Comments

Your terms have a type and, for some, a range. Now give them names a person can
read.

**Goal:** descriptions are data too. A label is what we call a thing; a comment
says what it means.

The editor holds a placeholder for every term in your vocabulary: one term and
an empty label. Fill in the label, then add a comment of your own; a semicolon
keeps the same term going. The `@en-US` after each string says which language
it's written in. Parse, then select a term in the Vocabulary tab and see what
the graph now knows about it.

You're done when every term has a label and a comment you'd show a colleague.

## Lab 6: Classes and Subclasses

So far the graph knows *things* and *properties*. Now it learns *kinds of
things*, and how kinds relate.

**Goal:** define the kinds of things we've seen, and how they nest.

The seed declares one class (`ex:Book`). The comments list the other kinds of
things the day has met. Declare them (`a rdfs:Class`), then relate them: an
Author is a kind of Person (`ex:Author rdfs:subClassOf schema:Person`), and a
Book is a kind of creative work (`ex:Book rdfs:subClassOf schema:CreativeWork`).
Open the Classes list in the Vocabulary tab as you parse.

You're done when you can read the nesting in the Vocabulary tab and say what
`rdfs:subClassOf` claims.

## Lab 7: Domain and Range

A property can say something about the things on either side of it.

**Goal:** watch the graph know more than you told it.

What kind of thing has an ISBN? Say so (`rdfs:domain`). Open the Entities tab
(it opens on **All**, everything asserted so far; *Mine* shows this lab
only). Something appeared that you did not type. Dotted gold means
the graph derived it; find it, and find the statement that justifies it.

Then say what kind of thing is the value of `ex:author`, and of
`ex:affiliation` (`rdfs:range`). Look again.

You're done when you can point at a fact nobody typed and name the statements
that justify it.

## Lab 8: Merging Vocabularies

Two vocabularies have been living in your graph all day: yours, and the one
the publisher's system spoke in Lab 3. Mostly different words for the same
ideas. Time to teach the graph what you've noticed.

**Goal:** alignment is knowledge, and a mapping is just
another fact.

The seed states one relationship, in one direction: every `ex:title` is a
`schema:name` (not every name is a title; direction matters). Parse it and
watch the Full Graph: records from hours ago restate themselves in a
vocabulary you never used. Then work the commented list; when you reach
`isbn`, ask yourself the seed's question: one-way, or both? Say what's true.
If it's true both ways, say it twice, and think about what a reasoner must
conclude.

You're done when: data you asserted this morning carries dotted triples in
the other vocabulary, and you can explain why `title` got one direction but
`isbn` got two.

## Lab 9: Integration for Free

A record about Elizabeth II, from DBpedia, a system nobody in this room has
ever integrated with. The vocabulary is one you've never seen (`dbo:` everything).

**Goal:** feel integration happen with zero mapping work.

Fetch the record (the URL is given in the room) and *read it before you
parse*. Notice two things: the queen's IRI is one your graph already knows;
and near the bottom, DBpedia's vocabulary ships its own alignments to
schema.org, as plain data. Now Parse, and watch the Full Graph: the foreign
record attaches to *your* queen, and dotted facts climb through DBpedia's
alignments into the same shared vocabulary your Lab 8 work aligned to. Two
parties, no coordination, one graph.

You're done when: you can trace one dotted fact end-to-end: which foreign
triple, through which alignment, landed where; and say who wrote each link
in that chain (hint: not you).

## Lab 10: The Nature of Relationships

Two editors now: **Data** on the left, **Semantics** on the right. The data
is one fact about Michael and Kate. One.

**Goal:** describe how a relationship *works*, and watch facts nobody typed
become computable.

Parse the data: two nodes, one edge. Now answer the Semantics panel's
questions, one line at a time, parsing as you go: a husband is a kind of
spouse (`rdfs:subPropertyOf`); marriage points both ways
(`owl:SymmetricProperty`); *wife-of* is *husband-of* read backwards
(`owl:inverseOf`). Watch the graph after each parse.

You're done when: one asserted fact has become four known facts, and you can
say which dotted edge came from which line of semantics. None of them is a
guess; none can be hallucinated.

## Lab 11: Transitivity

A real scene: this conference, this hotel, this city, and you, somewhere
inside all of it.

**Goal:** one line of semantics closes an entire chain.

Parse the data and look at the graph: a chain of `locatedIn` links, each
one step long. The graph does not know where Michael is beyond the hotel.
Teach it what "located in" *means* (that it carries through) and parse.

You're done when: you can explain why five new edges appeared from one
declaration, and why the ads saying the conference is in "Denver" aren't
lying, even though Denver proper is nowhere in this graph.

## Lab 12: Semantic Alignment

One last stranger: a library catalog's record of a book you've known since
this morning. Different system, different vocabulary, different identifier,
and *no* shared key.

**Goal:** identity doesn't have to be declared. It can be inferred.

Fetch and read the record. Notice there is nothing connecting it to your
book except a thirteen-digit string you've seen before. Now think about
what an ISBN *is*: one book per ISBN, one ISBN per book. Say that precisely
(`owl:InverseFunctionalProperty`), parse, and open the Entities tab.

You're done when: two books have become one, its properties have doubled,
and you can name every fact in the chain that made it happen, including
who asserted each one, and when.

## Lab 13: Querying the Graph

Everything the room built today is one graph. SPARQL is how you talk to it.

**Goal:** ask the day's graph real questions, in any vocabulary you like.

Work the numbered sample queries in order. Watch for three things: the
library's record answering in *your* vocabulary (nobody mapped it); one
`DESCRIBE` returning a person in four dialects at once; and query 5's
last column, where every fact knows *who said it*, including the inferred ones.
Then run query 6 and notice what "excluding a source" doesn't do: nothing
was deleted. Trust became part of the question.

You're done when: you've run query 7, read what came back, and realized
where you've been all day.

## Lab 14: Contexts on the Fly

**Goal:** contexts aren't fixed; you can mint one whenever a question
deserves it.

`CONSTRUCT` returns a *graph*, not rows. The first sample invents a
brand-new vocabulary and populates it from three systems' data in one
query. The second defines a class nobody ever declared, and enumerates
its members. No migration, no schema change, no meeting.

You're done when: you can explain the difference between a class someone
asserted, a class the reasoner derived, and a class you just made up, and
why the graph is comfortable with all three.

## Lab 15: Who Said That?

One final source: a celebrity gossip site with a page about the queen.
Fetch it, read it; it looks fine. Parse it.

**Goal:** a knowledge graph can hold a contradiction without believing it,
because every fact keeps its receipt.

Run the queries in order. The graph now has two birth dates for one woman,
and it isn't broken. Ask who said what. Then ask again, trusting only the
sources you choose, and notice that nothing was deleted, and that
excluding the tabloid also cost you a fact that happened to be true.

You're done when: you can explain why "store it" and "believe it" are
different operations, and why that difference is what your AI has been
missing.

---

## References

- JSON-LD: <https://www.w3.org/TR/json-ld11/> · playground: <https://json-ld.org/playground/>
- RDF primer: <https://www.w3.org/TR/rdf11-primer/>
- Turtle: <https://www.w3.org/TR/turtle/>
- RDFS: <https://www.w3.org/TR/rdf-schema/>
- schema.org: <https://schema.org/> (you met it before you knew its name)
- Michael: <https://w3id.org/people/michael> · <michael@semantic.consulting>
