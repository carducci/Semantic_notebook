// Day/night theme + the brand's diagram grammar, resolved for Cytoscape.
//
// CSS owns the palette (styles/tokens.css, lectern's token names and values). The
// CodeMirror themes use var() directly, so they follow a theme switch for free;
// Cytoscape paints to a canvas and can't read var(), so graph panels build their
// stylesheets from tokens() here and re-apply them on 'theme:changed'.
//
// Theme state is page chrome, like nav active-state — it deliberately stays off
// NotebookContext's lab-scoped event bus (C9) and rides a plain document event.

const STORAGE_KEY = 'sem-theme';

export function currentTheme() {
  return document.documentElement.dataset.theme === 'day' ? 'day' : 'night';
}

export function setTheme(theme) {
  if (theme === 'day') document.documentElement.dataset.theme = 'day';
  else delete document.documentElement.dataset.theme;
  // Storage can be unavailable (private windows, blocked site data); the theme
  // still switches for this page view either way.
  try { localStorage.setItem(STORAGE_KEY, theme); } catch { /* per-viewer nicety only */ }
  document.dispatchEvent(new CustomEvent('theme:changed', { detail: { theme } }));
}

export function wireThemeToggle(button) {
  if (!button || button.dataset.wired) return;
  button.dataset.wired = 'true';
  const render = () => {
    const theme = currentTheme();
    button.innerHTML = theme === 'day' ? 'night · <b>day</b>' : '<b>night</b> · day';
    button.setAttribute('aria-label', `Switch to ${theme === 'day' ? 'night' : 'day'} mode`);
  };
  button.addEventListener('click', () => setTheme(currentTheme() === 'day' ? 'night' : 'day'));
  document.addEventListener('theme:changed', render);
  render();
}

export function onThemeChange(fn) {
  document.addEventListener('theme:changed', fn);
  return () => document.removeEventListener('theme:changed', fn);
}

// Canvas text doesn't trigger a webfont load the way DOM text does, so graph
// panels await this before their first paint; otherwise labels render in the
// fallback face and never re-measure.
export function fontsReady() {
  if (!document.fonts?.load) return Promise.resolve();
  return Promise.all([
    document.fonts.load('11px "DM Mono"'),
    document.fonts.load('italic 11px "DM Mono"'),
    document.fonts.load('600 12px "Instrument Sans"')
  ]).catch(() => {});
}

export function tokens() {
  const cs = getComputedStyle(document.documentElement);
  const get = (name) => cs.getPropertyValue(name).trim();
  return {
    street: get('--street'), balcony: get('--balcony'), raised: get('--raised'),
    lace: get('--lace'), fog: get('--fog'), string: get('--string'),
    teal: get('--teal'), red: get('--red'), rule: get('--rule')
  };
}

// a mixed into b at pct% of a — color-mix(in srgb, a pct%, b), which canvas can't parse.
export function mix(a, b, pct) {
  const rgb = (hex) => {
    const h = hex.replace('#', '');
    const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
    return [0, 2, 4].map(i => parseInt(full.slice(i, i + 2), 16));
  };
  const [ca, cb] = [rgb(a), rgb(b)];
  const out = ca.map((v, i) => Math.round(v * pct / 100 + cb[i] * (1 - pct / 100)));
  return '#' + out.map(v => v.toString(16).padStart(2, '0')).join('');
}

export const MONO = '"DM Mono", "SF Mono", Menlo, Consolas, monospace';
export const SANS = '"Instrument Sans", system-ui, sans-serif';

// The diagram grammar (brand guide fig. D1, kept in sync with lectern's .node/.edge):
// line style tells you how we know a thing.
//   asserted ............ solid Lace
//   inferred ............ dotted String light
//   fetched (elsewhere) . dashed teal          (reserved — not yet produced)
//   the fact nobody typed dotted red, once     (reserved — not yet produced)
// Nodes are hollow: a Lace ring on the street. Teal and red never mark an ordinary
// node — in a diagram they are data colors, so a teal node would claim "fetched".
export function graphGrammar(t = tokens()) {
  const dots = { 'line-style': 'dashed', 'line-dash-pattern': [0.1, 5], 'line-cap': 'round' };
  const edgeBase = {
    'width': 1.5,
    'curve-style': 'bezier',
    'target-arrow-shape': 'triangle',
    'arrow-scale': 0.9,
    'label': 'data(label)',
    'font-family': MONO,
    'font-size': '9px',
    'text-rotation': 'autorotate',
    'text-background-color': t.street,
    'text-background-opacity': 0.85,
    'text-background-padding': '2px'
  };
  const asserted = mix(t.lace, t.street, 55);
  return {
    node: {
      'background-color': t.street,
      'border-width': 2,
      'border-style': 'solid',
      'border-color': t.lace,
      'color': t.lace,
      'font-family': MONO,
      'font-size': '11px'
    },
    // No identity yet: a dashed fog ring.
    blank: {
      'background-color': t.street,
      'border-width': 2,
      'border-style': 'dashed',
      'border-color': t.fog,
      'color': t.fog,
      'font-family': MONO,
      'font-size': '11px'
    },
    // Values, not things: a raised Balcony chip.
    literal: {
      'background-color': t.balcony,
      'border-width': 1,
      'border-color': mix(t.fog, t.balcony, 50),
      'color': t.lace,
      'font-family': MONO,
      'font-size': '10px'
    },
    // Membership the reasoner derived: a dotted string-light ring, italic label (M-08).
    inferredNode: { 'border-style': 'dotted', 'border-color': t.string, 'border-width': 2, 'font-style': 'italic' },
    selected: { 'border-color': t.string, 'border-width': 3 },
    edgeAsserted: { ...edgeBase, 'line-color': asserted, 'target-arrow-color': asserted, 'color': t.fog },
    edgeInferred: {
      ...edgeBase, ...dots, 'width': 2.2,
      'line-color': t.string, 'target-arrow-color': t.string, 'color': t.string, 'font-style': 'italic'
    },
    edgeFetched: {
      ...edgeBase, 'line-style': 'dashed', 'line-dash-pattern': [8, 6],
      'line-color': t.teal, 'target-arrow-color': t.teal, 'color': t.teal
    },
    edgeReveal: {
      ...edgeBase, ...dots, 'width': 2.4,
      'line-color': t.red, 'target-arrow-color': t.red, 'color': t.red
    },
    tokens: t
  };
}
