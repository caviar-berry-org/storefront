import assert from "node:assert/strict";
export function memoryFirestore() {
  const rows = new Map<string, Record<string, unknown>>();
  let fail = false;
  let queue = Promise.resolve();
  const value = (
    data: Record<string, unknown> | undefined,
    key: string,
  ): unknown =>
    key
      .split(".")
      .reduce<unknown>(
        (current, part) =>
          current && typeof current === "object"
            ? (current as Record<string, unknown>)[part]
            : undefined,
        data,
      );
  const snapshot = (path: string) => ({
    id: path.split("/").at(-1)!,
    ref: ref(path),
    exists: rows.has(path),
    data: () => structuredClone(rows.get(path)),
    get: (key: string) => value(rows.get(path), key),
  });
  const ref = (path: string) => ({
    path,
    id: path.split("/").at(-1)!,
    collection: (name: string) => collection(`${path}/${name}`),
    get: async () => snapshot(path),
    update: async (data: Record<string, unknown>) => patch(path, data),
    set: async (data: Record<string, unknown>) =>
      rows.set(path, structuredClone(data)),
  });
  type Filter = { field: string; op: string; expected: unknown };
  const matches = (data: Record<string, unknown>, filter: Filter) => {
    const actual = value(data, filter.field);
    if (filter.op === "array-contains")
      return (actual as unknown[] | undefined)?.includes(filter.expected);
    // Range filters: the digest counts records newer than a cut-off.
    if ([">=", ">", "<=", "<"].includes(filter.op)) {
      const left = Number(actual);
      const right = Number(filter.expected);
      if (!Number.isFinite(left) || !Number.isFinite(right)) return false;
      return filter.op === ">="
        ? left >= right
        : filter.op === ">"
          ? left > right
          : filter.op === "<="
            ? left <= right
            : left < right;
    }
    return actual === filter.expected;
  };
  const runQuery = (path: string, filters: Filter[], take?: number) =>
    [...rows]
      .filter(
        ([key, data]) =>
          key.startsWith(`${path}/`) &&
          key.split("/").length === path.split("/").length + 1 &&
          filters.every((filter) => matches(data, filter)),
      )
      .slice(0, take)
      .map(([key]) => snapshot(key));
  // Chainable like the Admin SDK; `select` is a no-op because the caller reads
  // fields with `get`. The first filter stays on top for older call sites.
  const query = (path: string, filters: Filter[], take?: number) => ({
    path,
    filters,
    take,
    query: true,
    ...filters[0],
    where: (field: string, op: string, expected: unknown) =>
      query(path, [...filters, { field, op, expected }], take),
    select: () => query(path, filters, take),
    limit: (count: number) => query(path, filters, count),
    get: async () => ({ docs: runQuery(path, filters, take) }),
  });
  const collection = (path: string) => ({
    path,
    doc: (id = String(Math.random())) => ref(`${path}/${id}`),
    where: (field: string, op: string, expected: unknown) =>
      query(path, [{ field, op, expected }]),
    orderBy: (field: string, direction: "asc" | "desc" = "asc") => ({
      path,
      orderField: field,
      direction,
      limit: (take: number) => ({
        path,
        orderField: field,
        direction,
        take,
        query: true,
      }),
    }),
  });
  function patch(path: string, data: Record<string, unknown>) {
    const next = structuredClone(rows.get(path) ?? {});
    for (const [key, val] of Object.entries(data)) {
      const parts = key.split(".");
      let target = next;
      for (const part of parts.slice(0, -1)) {
        if (!target[part] || typeof target[part] !== "object")
          target[part] = {};
        target = target[part] as Record<string, unknown>;
      }
      if (val && typeof val === "object" && "__delete" in val)
        delete target[parts.at(-1)!];
      else target[parts.at(-1)!] = structuredClone(val);
    }
    rows.set(path, next);
  }
  type Ref = ReturnType<typeof ref>;
  const db = {
    collection,
    doc: ref,
    runTransaction: <T>(run: (tx: unknown) => Promise<T>): Promise<T> => {
      const result = queue.then(async () => {
        const writes: (() => void)[] = [];
        const tx = {
          get: async (
            doc: Ref & {
              query?: boolean;
              filters?: Filter[];
              orderField?: string;
              direction?: "asc" | "desc";
              take?: number;
            },
          ) => {
            assert.equal(
              writes.length,
              0,
              "all transaction reads precede writes",
            );
            if (doc.query) {
              const inCollection = [...rows].filter(
                ([key]) =>
                  key.startsWith(`${doc.path}/`) &&
                  key.split("/").length === doc.path.split("/").length + 1,
              );
              if (doc.orderField) {
                const ordered = inCollection.sort(([, a], [, b]) => {
                  const left = Number(value(a, doc.orderField!) ?? 0);
                  const right = Number(value(b, doc.orderField!) ?? 0);
                  return doc.direction === "desc" ? right - left : left - right;
                });
                return {
                  docs: ordered
                    .slice(0, doc.take ?? ordered.length)
                    .map(([key]) => snapshot(key)),
                };
              }
              return { docs: runQuery(doc.path, doc.filters ?? [], doc.take) };
            }
            return snapshot(doc.path);
          },
          getAll: async (...refs: Ref[]) => {
            assert.equal(writes.length, 0);
            return refs.map((doc) => snapshot(doc.path));
          },
          create: (doc: Ref, data: Record<string, unknown>) =>
            writes.push(() => {
              assert.ok(!rows.has(doc.path));
              rows.set(doc.path, structuredClone(data));
            }),
          set: (
            doc: Ref,
            data: Record<string, unknown>,
            options?: { merge: boolean },
          ) =>
            writes.push(() =>
              options?.merge
                ? patch(doc.path, data)
                : rows.set(doc.path, structuredClone(data)),
            ),
          update: (doc: Ref, data: Record<string, unknown>) =>
            writes.push(() => patch(doc.path, data)),
          delete: (doc: Ref) => writes.push(() => rows.delete(doc.path)),
        };
        const result = await run(tx);
        if (fail) throw new Error("Storage unavailable.");
        writes.forEach((write) => write());
        return result;
      });
      queue = result.then(
        () => {},
        () => {},
      );
      return result;
    },
  };
  return {
    db,
    rows,
    unavailable: () => {
      fail = true;
    },
  };
}
