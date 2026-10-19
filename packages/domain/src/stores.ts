import { createEstablishmentNameKey } from "./establishments";

/** Each store is one physical unit, so the branch is part of its identity. */
export function createStoreNameKey(name: string, branch: string | null) {
  return createEstablishmentNameKey(branch ? `${name} ${branch}` : name);
}
