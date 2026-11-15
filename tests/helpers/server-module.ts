import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, extname, resolve } from "node:path";
import ts from "typescript";

// Exercise server modules without Next's server-only marker or live credentials.
export function serverModule<T>(entry: string, mocks: Record<string, unknown>) {
  const require = createRequire(import.meta.url);
  const cache = new Map<string, { exports: unknown }>();
  function load(name: string, parent = resolve("src")): unknown {
    if (name === "server-only") return {};
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (
      !name.startsWith(".") &&
      !name.startsWith("/") &&
      !name.startsWith("@/")
    )
      return require(name);
    let file = name.startsWith("@/")
      ? resolve("src", name.slice(2))
      : resolve(parent, name);
    if (!extname(file)) file += ".ts";
    if (Object.hasOwn(mocks, file)) return mocks[file];
    if (file.endsWith(".json")) return JSON.parse(readFileSync(file, "utf8"));
    if (cache.has(file)) return cache.get(file)!.exports;
    const loaded = { exports: {} };
    cache.set(file, loaded);
    const code = ts.transpileModule(readFileSync(file, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
    }).outputText;
    new Function("require", "module", "exports", code)(
      (dependency: string) => load(dependency, dirname(file)),
      loaded,
      loaded.exports,
    );
    return loaded.exports;
  }
  return load(resolve(entry)) as T;
}
