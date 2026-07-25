// Phase 10.4D — Creative Memory singleton.
//
// Returns the active MemoryStore for the current process.
// In Phase 10.4D: always returns a module-level InMemoryStore.
// In Phase 10.5B: swap InMemoryStore for PrismaMemoryStore here.
// In Phase 10.5C: wrap PrismaMemoryStore with CachedMemoryStore here.
//
// Consumers import only this function and the MemoryStore type.
// They never import a concrete implementation directly.

import type { MemoryStore } from "./creative-knowledge/creative-memory/store";
import { InMemoryStore }    from "./creative-knowledge/creative-memory/in-memory-store";

const _store: MemoryStore = new InMemoryStore();

export function getMemoryService(): MemoryStore {
  return _store;
}
