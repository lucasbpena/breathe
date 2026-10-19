import type { ProductPurchaseOutput } from "@openmonetis/validators/product-purchases";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Ellipsis, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { MoneyValue } from "@/components/money-value";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { NormalizedPrice } from "@/features/products/components/normalized-price";
import { formatStoreName } from "@/features/stores/stores.presentation";
import {
  useCreateProductPurchaseMutation,
  useDeleteProductPurchaseMutation,
  useReplaceProductPurchaseMutation,
} from "../product-purchases.mutations";
import {
  describeReceiptBalance,
  formatPurchaseQuantity,
  getDefaultStoreId,
  getPurchaseErrorMessage,
  toPurchaseLine,
} from "../product-purchases.presentation";
import { transactionProductPurchasesQueryOptions } from "../product-purchases.queries";
import { ProductPurchaseDialog } from "./product-purchase-dialog";

type DialogState = { purchase: ProductPurchaseOutput | null } | null;

export function TransactionProductPurchases({ transactionId }: { transactionId: string }) {
  const query = useQuery(transactionProductPurchasesQueryOptions(transactionId));
  const createMutation = useCreateProductPurchaseMutation();
  const replaceMutation = useReplaceProductPurchaseMutation();
  const deleteMutation = useDeleteProductPurchaseMutation();
  const [dialog, setDialog] = useState<DialogState>(null);
  const [removing, setRemoving] = useState<ProductPurchaseOutput | null>(null);

  async function remove(purchase: ProductPurchaseOutput) {
    try {
      await deleteMutation.mutateAsync(purchase.id);
      toast.success("Item removido");
    } catch (error) {
      toast.error(getPurchaseErrorMessage(error, "Não foi possível remover o item."));
    } finally {
      setRemoving(null);
    }
  }

  if (query.isPending) return <Skeleton className="h-24 w-full rounded-xl" />;
  if (query.isError)
    return (
      <div className="flex items-center justify-between gap-3 rounded-xl border p-3 text-sm">
        <span className="text-muted-foreground">Não foi possível carregar os itens.</span>
        <Button onClick={() => void query.refetch()} size="sm" type="button" variant="outline">
          <RefreshCw aria-hidden="true" /> Tentar novamente
        </Button>
      </div>
    );

  const { items, summary } = query.data;
  const balance = describeReceiptBalance(summary);

  return (
    <div className="grid gap-2">
      {items.length > 0 ? (
        <ul className="grid gap-1 rounded-xl border p-2">
          {items.map((purchase) => (
            <li
              className="flex items-center justify-between gap-3 rounded-lg px-2 py-2"
              key={purchase.id}
            >
              <div className="min-w-0">
                <Link
                  className="block truncate font-medium text-sm hover:text-brand-strong"
                  params={{ productId: purchase.productId }}
                  to="/products/$productId"
                >
                  {purchase.productName}
                </Link>
                <p className="truncate text-muted-foreground text-xs">
                  {formatPurchaseQuantity(purchase)} ·{" "}
                  {formatStoreName({ name: purchase.storeName, branch: purchase.storeBranch })}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <div className="grid justify-items-end text-sm">
                  <MoneyValue amount={purchase.paidAmount} className="font-medium" />
                  <NormalizedPrice
                    amount={purchase.normalizedPrice}
                    className="text-xs"
                    contentUnit={purchase.contentUnit}
                  />
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    aria-label={`Ações de ${purchase.productName}`}
                    render={<Button size="icon-sm" type="button" variant="ghost" />}
                  >
                    <Ellipsis aria-hidden="true" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setDialog({ purchase })}>
                      <Pencil aria-hidden="true" /> Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setRemoving(purchase)} variant="destructive">
                      <Trash2 aria-hidden="true" /> Remover
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border p-3 text-muted-foreground text-sm">
          Detalhe os produtos desta nota para acompanhar preços por loja e ao longo do tempo.
        </p>
      )}
      {items.length > 0 ? (
        <p className="px-1 text-muted-foreground text-xs">
          Itens somam <MoneyValue amount={summary.itemsAmount} /> de{" "}
          <MoneyValue amount={summary.transactionAmount} />
          {balance === "missing" ? (
            <>
              {" "}
              · faltam <MoneyValue amount={summary.remainingAmount} />
            </>
          ) : null}
          {balance === "exceeding" ? (
            <span className="text-warning">
              {" "}
              · excedem <MoneyValue amount={-summary.remainingAmount} />
            </span>
          ) : null}
          {balance === "complete" ? " · nota completa" : null}
        </p>
      ) : null}
      <Button
        className="justify-self-start"
        onClick={() => setDialog({ purchase: null })}
        size="sm"
        type="button"
        variant="outline"
      >
        <Plus aria-hidden="true" /> Adicionar item
      </Button>
      {dialog ? (
        <ProductPurchaseDialog
          defaultStoreId={getDefaultStoreId(items)}
          initial={dialog.purchase ? toPurchaseLine(dialog.purchase) : null}
          onOpenChange={(open) => {
            if (!open) setDialog(null);
          }}
          onSave={async (line) => {
            if (dialog.purchase) {
              await replaceMutation.mutateAsync({ id: dialog.purchase.id, input: line });
              toast.success("Item atualizado");
            } else {
              await createMutation.mutateAsync({ ...line, transactionId });
              toast.success("Item adicionado");
            }
          }}
          open
        />
      ) : null}
      <AlertDialog
        onOpenChange={(open) => {
          if (!open) setRemoving(null);
        }}
        open={removing !== null}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover item?</AlertDialogTitle>
            <AlertDialogDescription>
              {removing?.productName} sai desta compra e do histórico de preços do produto. O
              lançamento não muda.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteMutation.isPending}
              onClick={() => removing && void remove(removing)}
              variant="destructive"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
