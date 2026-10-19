import { createFileRoute } from "@tanstack/react-router";
import { ProductDetailPage } from "@/features/products/components/product-detail-page";

export const Route = createFileRoute("/products_/$productId")({
  head: () => ({ meta: [{ title: "Produto · OpenMonetis" }] }),
  component: ProductDetailRoute,
});

function ProductDetailRoute() {
  const { productId } = Route.useParams();
  return <ProductDetailPage key={productId} productId={productId} />;
}
