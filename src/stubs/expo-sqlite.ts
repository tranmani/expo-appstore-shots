/**
 * expo-sqlite.
 *
 * READ THIS BEFORE BELIEVING AN EMPTY SCREEN.
 *
 * There is no SQLite here. The native module is gone and the web build wants a
 * WASM binary this harness never serves, so every query answers "no rows" — and
 * "no rows" is a perfectly convincing empty list. An offline-first app whose
 * feed, tasks or messages come out of a local database will photograph as a
 * brand new install, with no error, no warning and nothing in the run's output
 * to suggest the frame is wrong. It is the one failure this tool cannot see.
 *
 * The mock backend does not help: it answers `fetch`, and this data never
 * travels over `fetch`. Seeding the database itself would mean shipping a SQL
 * engine to answer the app's own queries, which is a bigger lie than an empty
 * table.
 *
 * Two things that do work, in order of preference:
 *
 *  1. `config.stubs` on the app's *own* data layer — the repository, the store,
 *     the `db.ts` that everything else calls. Replace that with a module that
 *     returns fixtures and the screens fill up with real rows, because they are
 *     reading the app's real code paths from one layer up.
 *
 *  2. `config.setup` to push state straight into the store the screens read, if
 *     the store is what the screens actually subscribe to.
 *
 * Both are in the README under "Seeding what `fetch` cannot reach".
 */

const noRows = {
  getAllAsync: async () => [],
  getAllSync: () => [],
  getFirstAsync: async () => null,
  getFirstSync: () => null,
  getEachAsync: async function* () {},
  getEachSync: function* () {},
  runAsync: async () => ({ lastInsertRowId: 0, changes: 0 }),
  runSync: () => ({ lastInsertRowId: 0, changes: 0 }),
  executeAsync: async () => ({ getAllAsync: async () => [], resetAsync: async () => undefined }),
  executeSync: () => ({ getAllSync: () => [] }),
  finalizeAsync: async () => undefined,
  finalizeSync: () => undefined,
}

const database = {
  ...noRows,
  execAsync: async () => undefined,
  execSync: () => undefined,
  prepareAsync: async () => noRows,
  prepareSync: () => noRows,
  withTransactionAsync: async (fn: () => Promise<unknown>) => void (await fn()),
  withTransactionSync: (fn: () => unknown) => void fn(),
  withExclusiveTransactionAsync: async (fn: (tx: unknown) => Promise<unknown>) => void (await fn(database)),
  closeAsync: async () => undefined,
  closeSync: () => undefined,
  deleteAsync: async () => undefined,
  deleteSync: () => undefined,
  isInTransactionAsync: async () => false,
  isInTransactionSync: () => false,
  serializeAsync: async () => new Uint8Array(),
  syncLibSQL: async () => undefined,
  databasePath: ':memory:',
  // The legacy (SDK <51) callback API.
  transaction: (fn: (tx: unknown) => void) => fn({ executeSql: () => undefined }),
  readTransaction: (fn: (tx: unknown) => void) => fn({ executeSql: () => undefined }),
  exec: () => undefined,
  closeAsync_: () => undefined,
}

export const openDatabaseAsync = async () => database
export const openDatabaseSync = () => database
export const openDatabase = () => database
export const deleteDatabaseAsync = async () => undefined
export const deleteDatabaseSync = () => undefined
export const backupDatabaseAsync = async () => undefined
export const backupDatabaseSync = () => undefined
export const defaultDatabaseDirectory = 'file:///shots/SQLite/'
export const SQLiteDatabase = database
export const SQLiteStatement = noRows

/** The provider + hooks API. The provider must render its children: the screens are under it. */
export const SQLiteProvider = ({ children }: { children?: unknown }) => children as never
export const useSQLiteContext = () => database
export const addDatabaseChangeListener = () => ({ remove: () => undefined })
export const deserializeDatabaseAsync = async () => database
export const useSQLiteDevTools = () => undefined
