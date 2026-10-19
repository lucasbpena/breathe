import type { StoreOutput } from "@openmonetis/validators/stores";

type StoreLabelSource = Pick<StoreOutput, "name" | "branch">;

const storeErrorMessages: Record<string, string> = {
  store_already_exists: "Já existe uma loja com esse nome e filial.",
  store_in_use: "Esta loja tem compras registradas e não pode ser excluída.",
  store_not_found: "Loja não encontrada.",
};

export function formatStoreName(store: StoreLabelSource) {
  return store.branch ? `${store.name} · ${store.branch}` : store.name;
}

export function formatStoreLocation(store: Pick<StoreOutput, "neighborhood" | "address">) {
  return [store.neighborhood, store.address].filter(Boolean).join(" · ");
}

export function getStoreErrorMessage(error: unknown, fallback: string) {
  return getErrorCodeMessage(error, storeErrorMessages) ?? fallback;
}

/** Maps API error codes to PT-BR copy; English messages from the API never reach the UI. */
export function getErrorCodeMessage(error: unknown, messages: Record<string, string>) {
  const code =
    error && typeof error === "object" && "code" in error && typeof error.code === "string"
      ? error.code
      : null;
  return code ? (messages[code] ?? null) : null;
}
