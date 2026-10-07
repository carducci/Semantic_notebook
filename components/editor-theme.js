// The one CodeMirror look every editor panel shares (JSON-LD, Turtle, SPARQL), plus
// linked-data coloring where color carries meaning, not just syntax — the same rule
// lectern's tools/build.py applies to slides, so a snippet reads identically on a
// slide and in the notebook:
//   String light (gold)  structure: @prefix/@base/PREFIX, JSON-LD @-keys, `a`,
//                        language tags, datatypes, SPARQL keywords
//   Parasol teal         predicates — the relationships; meaning lives here
//   Fog italic           comments
//   Lace                 everything else: subjects, objects, IRIs, literals
// Predicates are found by POSITION in the triple (lectern's rule), not token type.
// Colors are var() references into styles/tokens.css, so a day/night switch
// restyles open editors without rebuilding them.
import { EditorView, ViewPlugin, Decoration } from '@codemirror/view';
import { HighlightStyle, StreamLanguage, syntaxHighlighting, syntaxTree } from '@codemirror/language';
import { Tag, tags } from '@lezer/highlight';

const rdfKw = Tag.define();
const rdfPred = Tag.define();

const loungeHighlight = HighlightStyle.define([
  { tag: rdfKw, color: 'var(--string)' },
  { tag: rdfPred, color: 'var(--teal)' },
  { tag: tags.comment, color: 'var(--fog)', fontStyle: 'italic' }
]);

export function editorTheme({ readOnly = false } = {}) {
  // Editable editors sit on the street; the read-only viewer sits a half-step up.
  // The subtle editable/read-only difference is a deliberate affordance (ADR-029).
  const surface = readOnly
    ? 'color-mix(in srgb, var(--balcony) 60%, var(--street))'
    : 'var(--street)';
  return [
    EditorView.theme({
      '&': {
        height: '100%',
        fontSize: '13px',
        fontFamily: 'var(--font-mono)',
        color: 'var(--code-fg)',
        backgroundColor: surface
      },
      '.cm-scroller': { overflow: 'auto', lineHeight: '1.6', fontFamily: 'var(--font-mono)' },
      '.cm-content': {
        padding: '8px 0',
        caretColor: readOnly ? 'transparent' : 'var(--string)'
      },
      '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--string)', borderLeftWidth: '2px' },
      '.cm-gutters': {
        backgroundColor: surface,
        borderRight: '1px solid var(--rule)',
        color: 'color-mix(in srgb, var(--fog) 70%, transparent)',
        fontSize: '11px'
      },
      '.cm-activeLineGutter': {
        backgroundColor: 'color-mix(in srgb, var(--lace) 6%, transparent)',
        color: 'var(--lace)'
      },
      // Per CodeMirror's own guidance (opaque line-decoration backgrounds
      // "never worked" — https://discuss.codemirror.net/t/various-themes-activeline-selections-not-visible/7473):
      // decoration backgrounds must be translucent, or they paint over and
      // hide layers rendered underneath them, like the selection layer.
      '.cm-activeLine': { backgroundColor: 'color-mix(in srgb, var(--lace) 4%, transparent)' },
      // drawSelection's generated rule has matching specificity and can load after
      // this theme, hence !important. String light: where the eye should land.
      '.cm-selectionBackground': {
        backgroundColor: 'color-mix(in srgb, var(--string) 22%, transparent) !important'
      },
      '&.cm-focused .cm-selectionBackground': {
        backgroundColor: 'color-mix(in srgb, var(--string) 32%, transparent) !important'
      },
      '.cm-content ::selection': {
        backgroundColor: 'color-mix(in srgb, var(--string) 32%, transparent) !important'
      },
      '.cm-selectionMatch': { backgroundColor: 'color-mix(in srgb, var(--lace) 9%, transparent)' },
      '&.cm-focused .cm-matchingBracket': {
        backgroundColor: 'transparent', outline: '1px solid var(--string)', color: 'var(--lace)'
      },
      '&.cm-focused .cm-nonmatchingBracket': {
        backgroundColor: 'transparent', outline: '1px dashed var(--fog)'
      },
      '.cm-foldPlaceholder': {
        backgroundColor: 'var(--balcony)', border: '1px solid var(--rule)', color: 'var(--fog)'
      },
      '.cm-searchMatch': { backgroundColor: 'color-mix(in srgb, var(--string) 18%, transparent)' },
      '.cm-searchMatch.cm-searchMatch-selected': { backgroundColor: 'color-mix(in srgb, var(--string) 36%, transparent)' },
      '.cm-panels': { backgroundColor: 'var(--balcony)', color: 'var(--lace)' },
      '.cm-panels.cm-panels-top': { borderBottom: '1px solid var(--rule)' },
      '.cm-panels.cm-panels-bottom': { borderTop: '1px solid var(--rule)' },
      '.cm-textfield': {
        backgroundColor: 'var(--street)', color: 'var(--lace)', border: '1px solid var(--rule)'
      },
      '.cm-button': {
        backgroundImage: 'none', backgroundColor: 'transparent', color: 'var(--fog)', border: '1px solid var(--rule)'
      },
      '.cm-tooltip': {
        backgroundColor: 'var(--balcony)', color: 'var(--lace)', border: '1px solid var(--rule)'
      },
      '.cm-tooltip-autocomplete ul li[aria-selected]': {
        backgroundColor: 'color-mix(in srgb, var(--string) 20%, transparent)', color: 'var(--lace)'
      },
      '.cm-rdf-kw': { color: 'var(--string)' },
      '.cm-rdf-pred': { color: 'var(--teal)' }
    }),
    syntaxHighlighting(loungeHighlight)
  ];
}

// ── JSON-LD ────────────────────────────────────────────────────────────────
// Keys are the predicates (teal); @-keys are structure (gold). Values stay Lace.
// Same rule as lectern's color_jsonld; the quotes themselves stay uncolored.
function jsonldDecorations(view) {
  const marks = [];
  for (const { from, to } of view.visibleRanges) {
    syntaxTree(view.state).iterate({
      from, to,
      enter: (node) => {
        if (node.name !== 'PropertyName' || node.to - node.from < 3) return;
        const inner = view.state.doc.sliceString(node.from + 1, node.from + 2);
        const cls = inner === '@' ? 'cm-rdf-kw' : 'cm-rdf-pred';
        marks.push(Decoration.mark({ class: cls }).range(node.from + 1, node.to - 1));
      }
    });
  }
  return Decoration.set(marks, true);
}

export const jsonldColoring = ViewPlugin.fromClass(class {
  constructor(view) { this.decorations = jsonldDecorations(view); }
  update(u) {
    if (u.docChanged || u.viewportChanged || syntaxTree(u.startState) !== syntaxTree(u.state)) {
      this.decorations = jsonldDecorations(u.view);
    }
  }
}, { decorations: v => v.decorations });

// ── Turtle and SPARQL ──────────────────────────────────────────────────────
// A port of lectern's color_turtle to a CodeMirror stream tokenizer: track whether
// the next term is a subject, predicate, or object; `;` → predicate, `,` → object,
// `.` → subject, `[` → predicate, `]` → object. Two additions: the term after `^^`
// (the datatype) is structure, and SPARQL keywords are structure, with triple
// positions tracked only inside the { } of a graph pattern.
const SPARQL_KEYWORDS = new Set(`
  SELECT CONSTRUCT ASK DESCRIBE WHERE FROM NAMED GRAPH OPTIONAL UNION MINUS FILTER BIND AS
  VALUES SERVICE SILENT ORDER BY ASC DESC LIMIT OFFSET DISTINCT REDUCED GROUP HAVING
  INSERT DELETE DATA WITH USING CLEAR DROP LOAD CREATE ADD MOVE COPY TO INTO DEFAULT ALL
  NOT IN EXISTS UNDEF COUNT SUM MIN MAX AVG SAMPLE GROUP_CONCAT SEPARATOR
  STR LANG LANGMATCHES DATATYPE BOUND IRI URI BNODE RAND ABS CEIL FLOOR ROUND CONCAT
  STRLEN UCASE LCASE ENCODE_FOR_URI CONTAINS STRSTARTS STRENDS STRBEFORE STRAFTER
  YEAR MONTH DAY HOURS MINUTES SECONDS TIMEZONE TZ NOW UUID STRUUID MD5 SHA1 SHA256
  COALESCE IF STRLANG STRDT SAMETERM ISIRI ISURI ISBLANK ISLITERAL ISNUMERIC REGEX
  SUBSTR REPLACE
`.trim().split(/\s+/));

function rdfStreamParser({ sparql }) {
  return {
    name: sparql ? 'sparql' : 'turtle',
    startState: () => ({
      expect: 'subject', inDir: false, longQuote: null, afterDtype: false,
      depth: 0, parens: 0, skipTerm: false, valuesPending: false, valuesDepth: -1
    }),
    token(stream, s) {
      if (s.longQuote) {
        const end = stream.string.indexOf(s.longQuote, stream.pos);
        if (end === -1) stream.skipToEnd();
        else { stream.pos = end + 3; s.longQuote = null; }
        return 'string';
      }
      if (stream.eatSpace()) return null;

      if (stream.match('#')) { stream.skipToEnd(); return 'comment'; }

      // A term has been read: style it by position, then advance the expectation.
      const term = (style = null) => {
        if (s.inDir) return style;
        if (s.afterDtype) { s.afterDtype = false; return 'rdfKw'; }
        if (s.skipTerm) { s.skipTerm = false; return style; }
        if (s.parens > 0) return style;
        if (sparql && (s.depth === 0 || s.valuesDepth !== -1)) return style;
        if (s.expect === 'subject') { s.expect = 'predicate'; return style; }
        if (s.expect === 'predicate') { s.expect = 'object'; return 'rdfPred'; }
        s.expect = 'object_done';
        return style;
      };

      const long = stream.match(/^("""|''')/);
      if (long) {
        const q = long[1];
        const end = stream.string.indexOf(q, stream.pos);
        if (end === -1) { stream.skipToEnd(); s.longQuote = q; }
        else stream.pos = end + 3;
        return term('string');
      }
      if (stream.match(/^"(?:\\.|[^"\\])*"/) || stream.match(/^'(?:\\.|[^'\\])*'/)) return term('string');

      if (stream.match(/^@(prefix|base)\b/) || stream.match(/^(PREFIX|BASE)\b/i)) {
        s.inDir = true;
        return 'rdfKw';
      }
      if (stream.match(/^<[^>\s]*>/)) {
        // The IRI closes a directive (both `@prefix p: <…> .` and `PREFIX p: <…>`).
        if (s.inDir) { s.inDir = false; s.expect = 'subject'; return null; }
        return term();
      }
      if (stream.match(/^@[A-Za-z][A-Za-z0-9-]*/)) return 'rdfKw';      // language tag
      if (stream.match('^^')) { s.afterDtype = true; return null; }

      if (stream.match(/^a(?![\w:])/)) {
        if (!s.inDir && s.expect === 'predicate' && s.parens === 0) { s.expect = 'object'; return 'rdfKw'; }
        return term();
      }
      if (sparql && stream.match(/^[?$][A-Za-z_0-9]+/)) return term();
      if (stream.match(/^(?:true|false)(?![\w:])/)) return term();
      if (stream.match(/^[+-]?\d[\d.]*(?:[eE][+-]?\d+)?/)) {
        if (stream.current().endsWith('.')) stream.backUp(1);
        return term();
      }
      if (stream.match(/^(?:[A-Za-z_][\w.-]*)?:[\w.%-]*/)) {
        if (stream.current().endsWith('.')) stream.backUp(1);  // `ex:bob.` — the dot ends the triple
        return term();
      }
      if (sparql) {
        const word = stream.match(/^[A-Za-z_][A-Za-z_0-9]*/);
        if (word) {
          const w = word[0].toUpperCase();
          if (!SPARQL_KEYWORDS.has(w)) return null;
          if (w === 'GRAPH' || w === 'SERVICE') s.skipTerm = true;
          if (w === 'VALUES') s.valuesPending = true;
          return 'rdfKw';
        }
      }

      const ch = stream.next();
      if (s.inDir) {
        if (ch === '.') { s.inDir = false; s.expect = 'subject'; }
        return null;
      }
      switch (ch) {
        case ';': s.expect = 'predicate'; break;
        case ',': s.expect = 'object'; break;
        case '.': if (s.parens === 0) s.expect = 'subject'; break;
        case '[': s.expect = 'predicate'; break;
        case ']': s.expect = 'object'; break;
        case '(': s.parens++; break;
        case ')':
          s.parens = Math.max(0, s.parens - 1);
          // A closed Turtle collection is one term in its own right.
          if (!sparql && s.parens === 0) term();
          break;
        case '{':
          if (sparql) {
            s.depth++;
            if (s.valuesPending) { s.valuesDepth = s.depth; s.valuesPending = false; }
            s.expect = 'subject';
          }
          break;
        case '}':
          if (sparql) {
            if (s.depth === s.valuesDepth) s.valuesDepth = -1;
            s.depth = Math.max(0, s.depth - 1);
            s.expect = 'subject';
          }
          break;
      }
      return null;
    },
    languageData: { commentTokens: { line: '#' } },
    tokenTable: { rdfKw, rdfPred }
  };
}

export const turtleLanguage = StreamLanguage.define(rdfStreamParser({ sparql: false }));
export const sparqlLanguage = StreamLanguage.define(rdfStreamParser({ sparql: true }));
