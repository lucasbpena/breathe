import { createFileRoute } from "@tanstack/react-router";
import { StoresPage } from "@/features/stores/components/stores-page";

export const Route = createFileRoute("/stores")({
  head: () => ({ meta: [{ title: "Lojas · OpenMonetis" }] }),
  component: StoresPage,
});
