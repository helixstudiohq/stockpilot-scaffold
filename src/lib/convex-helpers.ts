import type { DocumentByInfo } from "convex/server";
import type { GenericDataModel } from "convex/server";

/**
 * In-process hash join between two Convex query result sets.
 * Convex has no server-side joins, so related tables are stitched on the
 * function side. Keys should be document ids (string) or any primitive.
 */
export function innerJoin<L, R, K extends string | number>(
  left: ReadonlyArray<L>,
  right: ReadonlyArray<R>,
  leftKey: (row: L) => K,
  rightKey: (row: R) => K,
): Array<{ left: L; right: R }> {
  const index = new Map<K, R>();
  for (const row of right) {
    index.set(rightKey(row), row);
  }
  const out: Array<{ left: L; right: R }> = [];
  for (const row of left) {
    const match = index.get(leftKey(row));
    if (match !== undefined) {
      out.push({ left: row, right: match });
    }
  }
  return out;
}

/** Ids are unique strings, so a lookup map keyed by id is safe. */
export function keyById<T extends DocumentByInfo<any>>(
  docs: ReadonlyArray<T>,
): Map<string, T> {
  return new Map(docs.map((doc) => [doc._id as string, doc]));
}

/** True when the database already has data for every domain table. */
export async function isSeeded(
  db: {
    query: (name: string) => {
      first: () => Promise<unknown>;
    };
  },
  tableNames: readonly string[],
): Promise<boolean> {
  for (const name of tableNames) {
    if ((await db.query(name).first()) === null) {
      return false;
    }
  }
  return true;
}
