// Local state saving (BACKLOG #1). A browser close, reload, crash, or accidental
// navigation must not nuke an attendee's workshop.
//
// What is saved, and why this shape:
//   • COMMITS: every successful Parse, as N-Quads keyed by fragment IRI (+ its lab and
//     prefixes). Parse is the only commit (ADR-019), so replaying the committed
//     fragments through the normal upsertFragment path rebuilds the whole store,
//     including every lab's -inferred graph (reasoning is recomputed, never stored).
//     Replay order is the order of each fragment's LAST commit, which reproduces the
//     forward-only attribution convention of live use.
//   • EDITORS: the text of every editor (body, context, Turtle, SPARQL) that differs
//     from its seed. Uncommitted typing survives too. Text equal to the seed is not
//     stored, so a seed fixed in a later deploy still reaches students who never
//     touched that editor.
//   • LAST LAB: where the attendee was, so the browser lands them back there.
//
// Everything is best-effort: storage can be missing, full, or blocked (private
// window). Every read and write is wrapped, and the notebook works without it.

const VERSION = 1;

export class Persistence {
  constructor(notebookUri) {
    this.key = `semnb:v${VERSION}:${notebookUri}`;
    this.restoring = false;
    this.restoredCount = 0;
    this._timer = null;
    this.data = this._load();
    window.addEventListener('pagehide', () => this._flush());
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this._flush();
    });
  }

  _load() {
    try {
      const raw = localStorage.getItem(this.key);
      if (raw) {
        const d = JSON.parse(raw);
        if (d && d.v === VERSION && d.commits && d.editors) return d;
      }
    } catch (e) { /* unavailable or corrupt: start clean */ }
    return { v: VERSION, seq: 0, commits: {}, editors: {}, lastLab: null };
  }

  _flush() {
    clearTimeout(this._timer);
    this._timer = null;
    try { localStorage.setItem(this.key, JSON.stringify(this.data)); } catch (e) { /* full or blocked */ }
  }

  _schedule() {
    clearTimeout(this._timer);
    this._timer = setTimeout(() => this._flush(), 300);
  }

  getEditor(key) {
    const v = this.data.editors[key];
    return typeof v === 'string' ? v : undefined;
  }

  saveEditor(key, text, seed) {
    if (this.restoring) return;
    if (text === seed) delete this.data.editors[key];
    else this.data.editors[key] = text;
    this._schedule();
  }

  recordCommit(labUri, fragmentUri, quads, prefixes) {
    if (this.restoring) return;
    try {
      const nquads = new N3.Writer({ format: 'N-Quads' }).quadsToString(quads);
      this.data.commits[fragmentUri] = { seq: ++this.data.seq, labUri, nquads, prefixes: prefixes || {} };
      this._flush();
    } catch (e) { console.warn('Could not save commit', e); }
  }

  setLastLab(slug) {
    if (!slug || this.data.lastLab === slug) return;
    this.data.lastLab = slug;
    this._schedule();
  }

  hasState() {
    return Object.keys(this.data.commits).length > 0 || Object.keys(this.data.editors).length > 0;
  }

  // Replay saved commits through the notebook's normal upsert path. Runs in bootstrap
  // before any lab is built, so panels simply render the restored store when they
  // are lazily built.
  async restore(notebook) {
    const entries = Object.entries(this.data.commits).sort((a, b) => a[1].seq - b[1].seq);
    this.restoring = true;
    try {
      for (const [fragmentUri, c] of entries) {
        if (!notebook._labOrder.includes(c.labUri)) continue; // lab no longer exists
        try {
          const quads = new N3.Parser({ format: 'N-Quads' }).parse(c.nquads);
          await notebook.upsertFragment(c.labUri, fragmentUri, quads, c.prefixes || {});
          this.restoredCount++;
        } catch (e) { console.warn('Could not restore', fragmentUri, e); }
      }
    } finally {
      this.restoring = false;
    }
    return this.restoredCount;
  }

  reset() {
    clearTimeout(this._timer);
    try { localStorage.removeItem(this.key); } catch (e) { /* ignore */ }
    this.data = { v: VERSION, seq: 0, commits: {}, editors: {}, lastLab: null };
  }
}

// A quiet note when work is restored, plus a permanent "start over" control in the
// nav drawer. Reset asks first, because it cannot be undone.
export function wirePersistenceUi(persist) {
  const reset = () => {
    if (!window.confirm('Start over? This clears everything you have typed and parsed in this browser.')) return;
    persist.reset();
    location.reload();
  };

  const drawer = document.getElementById('lab-nav-drawer');
  if (drawer && !drawer.querySelector('[data-role="reset-work"]')) {
    const box = document.createElement('div');
    box.className = 'mt-6';
    box.innerHTML = `
      <p class="sem-drawer-eyebrow mb-2">// your work</p>
      <p class="mb-2" style="opacity:.7">Saved in this browser as you go.</p>
      <button type="button" class="sem-btn" data-role="reset-work">Start over</button>`;
    box.querySelector('button').addEventListener('click', reset);
    drawer.appendChild(box);
  }

  if (persist.restoredCount > 0) {
    const note = document.createElement('div');
    note.setAttribute('role', 'status');
    note.style.cssText = 'position:fixed;left:16px;bottom:16px;z-index:60;max-width:360px;padding:10px 14px;' +
      'font:13px/1.4 var(--font-ui, system-ui, sans-serif);background:var(--panel, #11161d);color:var(--ink, #e8e6e1);' +
      'border:1px solid var(--rule, #3a4350);box-shadow:0 4px 18px rgba(0,0,0,.35)';
    note.innerHTML = `Welcome back. Your work from earlier in this browser is restored. <button type="button" style="text-decoration:underline;margin-left:6px">Start over</button>`;
    note.querySelector('button').addEventListener('click', reset);
    document.body.appendChild(note);
    setTimeout(() => note.remove(), 12000);
  }
}
