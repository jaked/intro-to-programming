import * as monaco from "monaco-editor/esm/vs/editor/editor.main.js";

self.MonacoEnvironment = {
  getWorkerUrl: function (moduleId, label) {
    switch (label) {
      case "json":
        return "./js/vs/language/json/json.worker.js";

      case "css":
      case "scss":
      case "less":
        return "./js/vs/language/css/css.worker.js";

      case "html":
      case "handlebars":
      case "razor":
        return "./js/vs/language/html/html.worker.js";

      case "typescript":
      case "javascript":
        return "./js/vs/language/typescript/ts.worker.js";

      default:
        return "./js/vs/editor/editor.worker.js";
    }
  },
};

const input = document.getElementById("input");
const repl = document.getElementById("repl");
const cursor = document.getElementById("cursor");
const prompt = document.getElementById("prompt");
const minibuffer = document.getElementById("minibuffer");

const stringify = (args) => args.map(String).join(" ");

const replConsole = {
  log: (...text) => log(stringify(text)),
  info: (...text) => log(`INFO: ${stringify(text)}`),
  warn: (...text) => log(`WARN: ${stringify(text)}`),
  error: (...text) => log(`ERROR: ${stringify(text)}`),
  debug: (...text) => log(`DEBUG: ${stringify(text)}`),
};

/*
 * Put the prompt and the cursor at the end of the repl, ready for more input.
 * (They are removed from their parent in replEnter.)
 */
const newPrompt = () => {
  const div = document.createElement("div");
  div.append(prompt);
  div.append(cursor);
  repl.append(div);
  cursor.focus();
};

/*
 * Output a log line in the repl div.
 */
const log = (text) => {
  const div = document.createElement("div");
  div.classList.add("log");
  div.innerText = text;
  repl.append(div);
  newPrompt();
};

/*
 * Output a value in the repl div.
 */
const print = (text) => {
  const div = document.createElement("div");
  div.classList.add("value");
  div.innerText = "⇒ " + JSON.stringify(text);
  repl.append(div);
  newPrompt();
};

const message = (text, fade) => {
  minibuffer.innerText = text;
  if (fade) {
    setTimeout(() => (minibuffer.innerText = ""), fade);
  }
};

const replError = (text) => {
  const div = document.createElement("div");
  div.classList.add("error");
  div.innerText = text;
  repl.append(div);
  newPrompt();
};

/*
 * Show errors from evaluating code.
 */
const showError = (msg, source, line, column, error) => {
  // This seems to be a Chrome bug. Doesn't always happen but probably safe to
  // filter this message.
  // https://bugs.chromium.org/p/chromium/issues/detail?id=1328008
  // https://stackoverflow.com/questions/72396527/evalerror-possible-side-effect-in-debug-evaluate-in-google-chrome
  if (error === "EvalError: Possible side-effect in debug-evaluate") {
    return;
  }

  const errormsg = source === "repl" ? error : `${error} (line ${line - 2}, column ${column})`;
  if (iframe.contentWindow.repl.loading) {
    message(errormsg, 0);
  } else {
    replError(errormsg);
  }
  return true;
};

/*
 * Create a new iframe to use for evaluating code.
 */
const newIframe = () => {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("src", "about:blank");
  document.querySelector("body").append(iframe);
  iframe.contentWindow.repl = { print, message };
  iframe.contentWindow.onerror = showError;
  iframe.contentWindow.console = replConsole;
  return iframe;
};

/*
 * Send code to the current iframe to be added as a script tag and thus
 * evaluated. The code can use the function in the iframe's repl object (see
 * newIframe) to communicate back.
 */
const evaluate = (code, source) => {
  const d = iframe.contentDocument;
  const w = iframe.contentWindow;
  const s = d.createElement("script");
  s.append(d.createTextNode(`"use strict";\n${code}\n//# sourceURL=${source}`));
  w.repl.loading = source !== "repl";
  d.documentElement.append(s);
};

/*
 * Load the code from input into the iframe, creating a new iframe if needed.
 */
const loadCode = () => {
  const code = editor.getValue();
  if (iframe !== null) {
    iframe.parentNode.removeChild(iframe);
  }
  iframe = newIframe();
  evaluate(`\n${code}\nrepl.message('Loaded.', 1000);`, "editor");
};

const keyBindings = {
  e: {
    guard: (e) => e.metaKey,
    preventDefault: true,
    fn: loadCode,
  },
};

const checkKeyBindings = (e) => {
  const binding = keyBindings[e.key];
  if (binding && binding.guard(e)) {
    if (binding.preventDefault) e.preventDefault();
    binding.fn();
  }
};

const replEnter = (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    const text = cursor.innerText;
    const parent = cursor.parentNode;
    const p = prompt.cloneNode(true);
    p.removeAttribute("id");
    parent.replaceChild(p, prompt);
    parent.insertBefore(document.createTextNode(text), cursor);
    cursor.replaceChildren();
    parent.removeChild(cursor);
    evaluate(`repl.print(\n${text}\n)`, "repl");
  }
};

const editor = monaco.editor.create(document.getElementById("input"), {
  value: ["let x = 10;", "", "const fib = (n) => n < 2 ? n : fib(n - 2) + fib(n - 1);"].join("\n"),
  language: "javascript",
  automaticLayout: true,

  // Code to disable intellisense from https://github.com/microsoft/monaco-editor/issues/1681
  quickSuggestions: {
    other: false,
    comments: false,
    strings: false,
  },
  parameterHints: {
    enabled: false,
  },
  ordBasedSuggestions: false,
  suggestOnTriggerCharacters: false,
  acceptSuggestionOnEnter: "off",
  tabCompletion: "off",
  wordBasedSuggestions: false,
  // End code to disable intellisense.
});

let iframe = newIframe();
window.onkeydown = checkKeyBindings;
window.onresize = (e) => editor.layout({ width: 0, height: 0 });
submit.onclick = loadCode;
repl.onfocus = (e) => cursor.focus();
cursor.onkeydown = replEnter;
cursor.focus();
loadCode();
