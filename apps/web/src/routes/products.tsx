import { createFileRoute } from "@tanstack/react-router";
import { ProductsPage } from "@/features/products/components/products-page";

export const Route = createFileRoute("/products")({
  head: () => ({ meta: [{ title: "Produtos · OpenMonetis" }] }),
  component: ProductsPage,
});
