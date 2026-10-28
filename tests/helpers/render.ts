import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import type { ElementType } from "react";
import ts from "typescript";

// Loads a .tsx file the way a bundler would, so a render test can call React's
// server renderer on the real component without a browser. tsx's own require
// compiles TSX with the classic runtime and fails with "React is not defined",
// so the source is transpiled here with the automatic JSX runtime instead.
//
// Paths are relative to the tests/ directory ("../src/components/Foo.tsx") or
// start with "@/" for src/. Inside a loaded file:
//   - an alias for the exact import id wins over everything below;
//   - "@/..." and relative ids that name a .tsx file are loaded recursively;
//   - other "@/..." and relative ids go to the normal require;
//   - ".css" is an empty module and any other id (react, radix, ...) is a
//     package resolved from tests/, so React is the instance the test file uses.
// Every call has its own module cache, shared by the files it loads, so a
// component and its parent see one copy of a child. Pass the modules a test has
// already imported as aliases when it needs the same copy (a React context, or
// a module with state): require() would load a second one.

const testsDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = resolve(testsDir, "../src");
const packageRequire = createRequire(resolve(testsDir, "render.js"));

type Exports = Record<string, unknown>;
type Aliases = Record<string, unknown>;

const compiled = new Map<string, string>();
function compile(file: string) {
  let code = compiled.get(file);
  if (code === undefined) {
    code = ts.transpileModule(readFileSync(file, "utf8"), {
      fileName: file,
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText;
    compiled.set(file, code);
  }
  return code;
}

/** The absolute path an import id names, or undefined for a package. */
function localPath(id: string, from: string) {
  if (id.startsWith("@/")) return resolve(srcDir, id.slice(2));
  if (id.startsWith(".")) return resolve(dirname(from), id);
  return undefined;
}

function tsxFile(path: string) {
  return [path, `${path}.tsx`, resolve(path, "index.tsx")].find(
    (candidate) => candidate.endsWith(".tsx") && existsSync(candidate),
  );
}

function instantiate(
  file: string,
  aliases: Aliases,
  cache: Map<string, { exports: Exports }>,
): Exports {
  const known = cache.get(file);
  if (known) return known.exports;
  const module = { exports: {} as Exports };
  // Registered before it runs, so an import cycle sees the partial exports.
  cache.set(file, module);
  const load = (id: string): unknown => {
    if (Object.hasOwn(aliases, id)) return aliases[id];
    if (id.endsWith(".css")) return {};
    const path = localPath(id, file);
    if (path === undefined) return packageRequire(id);
    const source = tsxFile(path);
    return source ? instantiate(source, aliases, cache) : packageRequire(path);
  };
  runInNewContext(compile(file), {
    module,
    exports: module.exports,
    require: load,
    console,
  });
  return module.exports;
}

/** Every export of a .tsx (or .ts) file, for named exports and helpers. */
export async function loadModule<T = Exports>(
  path: string,
  aliases: Aliases = {},
): Promise<T> {
  const file = path.startsWith("@/")
    ? resolve(srcDir, path.slice(2))
    : resolve(testsDir, path);
  if (!existsSync(file)) throw new Error(`loadModule: no file at ${file}`);
  return instantiate(file, aliases, new Map()) as T;
}

/** The default export of a .tsx file, ready for createElement. */
export async function loadComponent(
  path: string,
  aliases: Aliases = {},
): Promise<ElementType> {
  const exported = await loadModule(path, aliases);
  if (exported.default == null)
    throw new Error(`loadComponent: ${path} has no default export`);
  return exported.default as ElementType;
}
