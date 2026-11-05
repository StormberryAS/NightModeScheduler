// Runs the page's own script, the compiled app.js, in a fresh node:vm context with a stub of the
// few page parts it touches, a clock fixed at a given instant, a fixed locale and time zone, a
// Map for localStorage and a small IndexedDB in memory. The Web Crypto is Node's own, the same
// API the browser has. No browser and no DOM library: app.js is a classic script that looks up
// its elements when it loads, so it cannot be imported; this runs it as the page does.
// gate.js, the first-run notice, is not run: it shares nothing with app.js.

import { readFileSync } from 'node:fs';
import { setImmediate as nextTurn } from 'node:timers/promises';
import { createContext, runInContext } from 'node:vm';

type Listener = (ev: { target: unknown }) => unknown;

/** A page element with only what app.js uses. */
class StubElement {
  readonly tag: string;
  readonly id: string;
  textContent: string | null = '';
  className = '';
  href = '';
  download = '';
  value = '';
  files: { name: string; text: string }[] | null = null;
  readonly children: StubElement[] = [];
  readonly listeners = new Map<string, Listener>();
  readonly style = { background: '', props: new Map<string, string>(), setProperty(name: string, value: unknown): void { this.props.set(name, String(value)); } };
  #html = '';
  readonly page: { clicks: string[] };
  constructor(page: { clicks: string[] }, tag: string, id = '') { this.page = page; this.tag = tag; this.id = id; }
  get innerHTML(): string { return this.#html; }
  set innerHTML(html: string) { this.#html = html; this.children.length = 0; }
  addEventListener(type: string, fn: Listener): void { this.listeners.set(type, fn); }
  appendChild(child: StubElement): StubElement { this.children.push(child); return child; }
  removeChild(child: StubElement): StubElement { this.children.splice(this.children.indexOf(child), 1); return child; }
  click(): void { this.page.clicks.push(this.tag === 'a' ? `download ${this.download}` : `click #${this.id}`); }
}
class StubInput extends StubElement {}

/** What a test can see and do on the page after app.js has loaded. */
export interface Page {
  /** Evaluates an expression in the page's global scope (the top-level names of app.js are there). */
  run(expression: string): unknown;
  /** Fires DOMContentLoaded and waits for its handler (it reads the stored logs). */
  ready(): Promise<void>;
  text(id: string): string;
  /** The log list as shown: each entry as "date | value", or the "No logs yet." text. */
  list(): string[];
  /** The custom properties set on the root element. */
  rootStyle(): Record<string, string>;
  button(id: string): { text: string; background: string };
  /** Moves the slider as a person would: a new value, then the input event. */
  slide(value: string): void;
  /** Presses a button; returns what its handler returned (a promise for the async ones). */
  press(id: string): unknown;
  /** Hands a file to the hidden file input and fires its change event. */
  chooseFile(name: string, text: string): void;
  /** Runs the timers app.js set (the "Logged" label reset) and returns their delays. */
  runTimers(): number[];
  storage: Map<string, string>;
  idb: Map<string, unknown>;
  /** The answers prompt() gives, in order; null is Cancel. */
  answers: (string | null)[];
  prompts: string[];
  alerts: string[];
  clicks: string[];
  /** The text of each Blob handed to URL.createObjectURL, in order. */
  downloads: string[];
  /** Waits until a condition holds, letting the page's promises and the crypto run. */
  until(cond: () => boolean, what: string): Promise<void>;
}

export interface PageOptions {
  /** The script to run, app.js by default (a test may name the old one). */
  script?: URL;
  now: number;
  locale: string;
  timeZone: string;
  /** localStorage before the page loads. */
  storage?: Record<string, string>;
}

/** Loads app.js (a file URL) into a fresh context and returns the page. */
export function loadPage(opts: PageOptions): Page {
  const clicks: string[] = [];
  const shared = { clicks };
  const ids = ['exposure-val', 'save-log-btn', 'export-btn', 'import-btn', 'bedtime-val', 'bedtime-desc', 'evening-start', 'log-list'];
  const els = new Map<string, StubElement>(ids.map((id) => [id, new StubElement(shared, id === 'log-list' ? 'ul' : 'span', id)]));
  for (const id of ['exposure-slider', 'import-file']) els.set(id, new StubInput(shared, 'input', id));
  const el = (id: string): StubElement => {
    const e = els.get(id);
    if (!e) throw new Error(`no element ${id}`);
    return e;
  };
  el('exposure-slider').value = '2';
  el('save-log-btn').textContent = "Log today's screen time";
  const docRoot = new StubElement(shared, 'html');
  const docListeners = new Map<string, Listener>();
  const storage = new Map<string, string>(Object.entries(opts.storage ?? {}));
  const idb = new Map<string, unknown>();
  const answers: (string | null)[] = [];
  const prompts: string[] = [];
  const alerts: string[] = [];
  const downloads: string[] = [];
  const timers: { fn: () => void; ms: number }[] = [];
  const { now, locale, timeZone } = opts;

  // The clock: new Date() gives the fixed instant; every other use is the real Date. Dates are
  // shown in the given locale and time zone.
  class FixedDate extends Date {
    constructor(...args: [] | [number | string | Date]) {
      if (args.length === 0) super(now); else super(args[0]);
    }
    static override now(): number { return now; }
    override toLocaleDateString(loc?: string, o?: Intl.DateTimeFormatOptions): string {
      return super.toLocaleDateString(loc ?? locale, { ...o, timeZone });
    }
  }
  // Intl with the page's locale as the default (app.js asks for undefined, the visitor's own).
  class DateTimeFormat extends Intl.DateTimeFormat {
    constructor(loc?: string, o?: Intl.DateTimeFormatOptions) { super(loc ?? locale, o); }
  }
  class NumberFormat extends Intl.NumberFormat {
    constructor(loc?: string, o?: Intl.NumberFormatOptions) { super(loc ?? locale, o); }
  }

  // IndexedDB in memory: one database, one store, the request callbacks on a later turn.
  interface Req { result: unknown; error: unknown; onsuccess: (() => void) | null; onerror: (() => void) | null; onupgradeneeded?: (() => void) | null }
  let upgraded = false;
  const later = (req: Req, result: () => unknown): Req => {
    void nextTurn().then(() => { req.result = result(); req.onsuccess?.(); });
    return req;
  };
  const newReq = (): Req => ({ result: undefined, error: null, onsuccess: null, onerror: null });
  const store = {
    get: (k: string): Req => later(newReq(), () => idb.get(k)),
    put: (v: unknown, k: string): Req => later(newReq(), () => { idb.set(k, v); return k; }),
  };
  const db = {
    createObjectStore: (name: string): typeof store => { if (name !== 'keys') throw new Error(`store ${name}`); return store; },
    transaction: (name: string): { objectStore: (n: string) => typeof store } => {
      if (name !== 'keys') throw new Error(`store ${name}`);
      return { objectStore: () => store };
    },
  };
  const indexedDB = {
    open: (name: string, version: number): Req => {
      if (name !== 'nightmode-secure' || version !== 1) throw new Error(`database ${name} ${version}`);
      const req: Req = { ...newReq(), onupgradeneeded: null };
      void nextTurn().then(() => {
        req.result = db;
        if (!upgraded) { upgraded = true; req.onupgradeneeded?.(); }
        req.onsuccess?.();
      });
      return req;
    },
  };

  class FileReader {
    result: unknown = null;
    onload: Listener | null = null;
    readAsText(file: { text: string }): void {
      void nextTurn().then(() => { this.result = file.text; this.onload?.({ target: this }); });
    }
  }
  class Blob {
    readonly text: string;
    constructor(parts: string[]) { this.text = parts.join(''); }
  }

  const sandbox = {
    Date: FixedDate,
    Intl: { ...Object.fromEntries(Object.getOwnPropertyNames(Intl).map((k) => [k, Reflect.get(Intl, k)])), DateTimeFormat, NumberFormat },
    HTMLInputElement: StubInput,
    document: {
      documentElement: docRoot,
      body: docRoot,
      getElementById: (id: string): StubElement | null => els.get(id) ?? null,
      addEventListener: (type: string, fn: Listener): void => { docListeners.set(type, fn); },
      createElement: (tag: string): StubElement => new StubElement(shared, tag),
    },
    localStorage: {
      getItem: (k: string): string | null => storage.get(k) ?? null,
      setItem: (k: string, v: string): void => { storage.set(k, String(v)); },
      removeItem: (k: string): void => { storage.delete(k); },
    },
    indexedDB,
    crypto: globalThis.crypto,
    TextEncoder,
    TextDecoder,
    btoa,
    atob,
    FileReader,
    Blob,
    URL: {
      createObjectURL: (b: Blob): string => { downloads.push(b.text); return `blob:stub-${downloads.length}`; },
      revokeObjectURL: (): void => {},
    },
    prompt: (message: string): string | null => {
      prompts.push(message);
      if (answers.length === 0) throw new Error(`unexpected prompt: ${message}`);
      return answers.shift() ?? null;
    },
    alert: (message: string): void => { alerts.push(String(message)); },
    setTimeout: (fn: () => void, ms: number): number => { timers.push({ fn, ms }); return timers.length; },
  };
  const context = createContext(sandbox);
  const file = opts.script ?? new URL('../app.js', import.meta.url);
  runInContext(readFileSync(file, 'utf8'), context, { filename: 'app.js' });

  const run = (expression: string): unknown => runInContext(expression, context);
  return {
    run,
    async ready(): Promise<void> {
      const fn = docListeners.get('DOMContentLoaded');
      if (!fn) throw new Error('app.js did not wait for DOMContentLoaded');
      await fn({ target: sandbox.document });
    },
    text: (id) => el(id).textContent ?? '',
    list: () => {
      const ul = el('log-list');
      if (ul.children.length === 0) return [ul.innerHTML];
      return ul.children.map((li) => `${li.className}: ${li.children.map((s) => `${s.className} ${s.textContent ?? ''}`).join(' | ')}`);
    },
    rootStyle: () => Object.fromEntries(docRoot.style.props),
    button: (id) => ({ text: el(id).textContent ?? '', background: el(id).style.background }),
    slide(value) {
      const s = el('exposure-slider');
      s.value = value;
      s.listeners.get('input')?.({ target: s });
    },
    press(id) {
      const b = el(id);
      const fn = b.listeners.get('click');
      if (!fn) throw new Error(`#${id} has no click handler`);
      return fn({ target: b });
    },
    chooseFile(name, text) {
      const input = el('import-file');
      input.files = [{ name, text }];
      input.value = `C:\\fakepath\\${name}`;
      input.listeners.get('change')?.({ target: input });
    },
    runTimers() {
      const due = timers.splice(0);
      for (const t of due) t.fn();
      return due.map((t) => t.ms);
    },
    storage,
    idb,
    answers,
    prompts,
    alerts,
    clicks,
    downloads,
    async until(cond, what) {
      const end = Date.now() + 10000;
      while (!cond()) {
        if (Date.now() > end) throw new Error(`timed out waiting for ${what}`);
        await nextTurn();
      }
    },
  };
}

/** The value of the file input, which the import resets. */
export function fileInputValue(page: Page): unknown {
  return page.run("document.getElementById('import-file').value");
}
