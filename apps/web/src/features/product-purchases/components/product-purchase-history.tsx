import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ReceiptText, RefreshCw } from "lucide-react";
import { MoneyValue } from "@/components/money-value";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { NormalizedPrice } from "@/features/products/components/normalized-price";
import { formatPurchaseDate } from "@/features/products/products.presentation";
import { formatStoreName } from "@/features/stores/stores.presentation";
import { formatPurchaseQuantity } from "../product-purchases.presentation";
import { productPurchasesQueryOptions } from "../product-purchases.queries";

export function ProductPurchaseHistory({ productId }: { productId: string }) {
  const query = useQuery(productPurchasesQueryOptions(productId));

  if (query.isPending) return <Skeleton className="h-32 w-full" />;
  if (query.isError)
    return (
      <div className="grid place-items-center gap-3 py-6 text-center">
        <p className="text-muted-foreground text-sm">Não foi possível carregar as compras.</p>
        <Button onClick={() => void query.refetch()} size="sm" type="button" variant="outline">
          <RefreshCw aria-hidden="true" /> Tentar novamente
        </Button>
      </div>
    );
  if (query.data.length === 0)
    return (
      <p className="py-6 text-center text-muted-foreground text-sm">
        Nenhuma compra registrada. Detalhe os itens na ficha de uma despesa.
      </p>
    );

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Data</TableHead>
          <TableHead>Loja</TableHead>
          <TableHead className="hidden lg:table-cell">Nome na nota</TableHead>
          <TableHead className="hidden md:table-cell">Quantidade</TableHead>
          <TableHead className="text-right">Pago</TableHead>
          <TableHead className="hidden text-right sm:table-cell">Preço</TableHead>
          <TableHead className="w-12">
            <span className="sr-only">Lançamento</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {query.data.map((purchase) => (
          <TableRow key={purchase.id}>
            <TableCell className="whitespace-nowrap">
              {formatPurchaseDate(purchase.purchaseDate)}
            </TableCell>
            <TableCell>
              <p>{formatStoreName({ name: purchase.storeName, branch: purchase.storeBranch })}</p>
              {purchase.storeNeighborhood ? (
                <p className="text-muted-foreground text-xs">{purchase.storeNeighborhood}</p>
              ) : null}
            </TableCell>
            <TableCell className="hidden text-muted-foreground lg:table-cell">
              {purchase.extractedName ?? "—"}
            </TableCell>
            <TableCell className="hidden md:table-cell">
              {formatPurchaseQuantity(purchase)}
            </TableCell>
            <TableCell className="text-right">
              <MoneyValue amount={purchase.paidAmount} />
              {purchase.discountAmount > 0 ? (
                <p className="text-muted-foreground text-xs">
                  desconto <MoneyValue amount={purchase.discountAmount} />
                </p>
              ) : null}
            </TableCell>
            <TableCell className="hidden text-right sm:table-cell">
              <NormalizedPrice
                amount={purchase.normalizedPrice}
                contentUnit={purchase.contentUnit}
              />
            </TableCell>
            <TableCell>
              <Button asChild size="icon-sm" variant="ghost">
                <Link
                  aria-label={`Buscar ${purchase.transactionName} nos lançamentos`}
                  search={{ period: purchase.transactionPeriod, q: purchase.transactionName }}
                  to="/transactions"
                >
                  <ReceiptText aria-hidden="true" />
                </Link>
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
