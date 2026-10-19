import type { ProductOutput } from "@openmonetis/validators/products";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  ChevronRight,
  Combine,
  Ellipsis,
  Package,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { Navbar } from "@/components/navigation/navbar";
import { PageHeader } from "@/components/page-header";
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
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useDeleteProductMutation } from "../products.mutations";
import {
  formatPackageContent,
  getProductErrorMessage,
  matchesProductSearch,
} from "../products.presentation";
import { productsQueryOptions } from "../products.queries";
import { NormalizedPrice } from "./normalized-price";
import { ProductDialog } from "./product-dialog";
import { ProductMergeDialog } from "./product-merge-dialog";

type ProductAction = { kind: "edit" | "merge" | "remove"; product: ProductOutput } | null;

export function ProductsPage() {
  const productsQuery = useQuery(productsQueryOptions());
  const deleteMutation = useDeleteProductMutation();
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [action, setAction] = useState<ProductAction>(null);
  const products = productsQuery.data ?? [];
  const visible = products.filter((product) => matchesProductSearch(product, search));

  async function remove(product: ProductOutput) {
    try {
      await deleteMutation.mutateAsync(product.id);
      toast.success("Produto excluído");
    } catch (error) {
      toast.error(getProductErrorMessage(error, "Não foi possível excluir o produto."));
    } finally {
      setAction(null);
    }
  }

  const closeAction = (open: boolean) => {
    if (!open) setAction(null);
  };

  return (
    <ProtectedRoute>
      <main className="min-h-svh bg-background">
        <Navbar />
        <section className="app-page project-container">
          <PageHeader
            actions={
              <Button onClick={() => setCreating(true)} type="button">
                <Plus aria-hidden="true" className="size-4" /> Novo produto
              </Button>
            }
            breadcrumbs={[
              { label: "Visão geral", href: "/dashboard" },
              { label: "Consumo" },
              { label: "Produtos" },
            ]}
            description="Sua base de produtos consumidos, com o histórico de preços de cada um."
            icon={<Package aria-hidden="true" className="size-5" />}
            title="Produtos"
          />

          {productsQuery.isLoading ? (
            <div aria-label="Carregando produtos" className="grid gap-2" role="status">
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
            </div>
          ) : null}
          {productsQuery.isError ? (
            <Card className="grid min-h-52 place-items-center border p-6 text-center">
              <div>
                <p className="font-medium">Não foi possível carregar os produtos</p>
                <Button
                  className="mt-4"
                  onClick={() => void productsQuery.refetch()}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <RefreshCw aria-hidden="true" /> Tentar novamente
                </Button>
              </div>
            </Card>
          ) : null}
          {productsQuery.isSuccess && products.length === 0 ? (
            <Card className="grid min-h-60 place-items-center border p-6 text-center">
              <div className="max-w-md">
                <span className="mx-auto grid size-11 place-items-center rounded-full bg-muted text-muted-foreground">
                  <Package aria-hidden="true" className="size-5" />
                </span>
                <p className="mt-4 font-medium">Nenhum produto cadastrado</p>
                <p className="mt-1 text-muted-foreground text-sm">
                  Cadastre aqui ou direto ao detalhar os itens de uma despesa.
                </p>
                <Button className="mt-4" onClick={() => setCreating(true)} size="sm" type="button">
                  <Plus aria-hidden="true" /> Cadastrar produto
                </Button>
              </div>
            </Card>
          ) : null}
          {products.length > 0 ? (
            <Card className="gap-4 border p-3 sm:p-4">
              <div className="relative max-w-sm">
                <Search
                  aria-hidden="true"
                  className="absolute top-2.5 left-3 size-4 text-muted-foreground"
                />
                <Input
                  aria-label="Buscar produto"
                  className="pl-9"
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar por nome, nome da nota ou categoria"
                  value={search}
                />
              </div>
              {visible.length === 0 ? (
                <p className="py-6 text-center text-muted-foreground text-sm">
                  Nenhum produto encontrado.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produto</TableHead>
                      <TableHead className="hidden md:table-cell">Categoria</TableHead>
                      <TableHead className="hidden lg:table-cell">Unidade</TableHead>
                      <TableHead className="text-right">Último</TableHead>
                      <TableHead className="hidden text-right sm:table-cell">Médio</TableHead>
                      <TableHead className="hidden text-right xl:table-cell">Mín – Máx</TableHead>
                      <TableHead className="hidden text-right sm:table-cell">Compras</TableHead>
                      <TableHead className="w-12">
                        <span className="sr-only">Ações</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visible.map((product) => (
                      <TableRow key={product.id}>
                        <TableCell className="max-w-56">
                          <Link
                            className="inline-flex max-w-full items-center gap-1 font-medium hover:text-brand-strong"
                            params={{ productId: product.id }}
                            to="/products/$productId"
                          >
                            <span className="truncate">{product.name}</span>
                            <ChevronRight className="size-3 shrink-0 text-muted-foreground" />
                          </Link>
                          {product.aliases.length > 0 ? (
                            <p className="truncate text-muted-foreground text-xs">
                              {product.aliases.length === 1
                                ? "1 nome da nota"
                                : `${product.aliases.length} nomes da nota`}
                            </p>
                          ) : null}
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          {product.categoryName ?? "—"}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          {formatPackageContent(product)}
                        </TableCell>
                        <TableCell className="text-right">
                          <NormalizedPrice
                            amount={product.priceSummary.lastPrice}
                            contentUnit={product.contentUnit}
                          />
                        </TableCell>
                        <TableCell className="hidden text-right sm:table-cell">
                          <NormalizedPrice
                            amount={product.priceSummary.averagePrice}
                            contentUnit={product.contentUnit}
                          />
                        </TableCell>
                        <TableCell className="hidden text-right xl:table-cell">
                          {product.priceSummary.purchaseCount > 0 ? (
                            <span className="inline-flex items-baseline gap-1">
                              <NormalizedPrice
                                amount={product.priceSummary.minPrice}
                                contentUnit={product.contentUnit}
                              />
                              –
                              <NormalizedPrice
                                amount={product.priceSummary.maxPrice}
                                contentUnit={product.contentUnit}
                              />
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="hidden text-right tabular-nums sm:table-cell">
                          {product.priceSummary.purchaseCount}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              aria-label={`Ações de ${product.name}`}
                              render={<Button size="icon-sm" type="button" variant="ghost" />}
                            >
                              <Ellipsis aria-hidden="true" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => setAction({ kind: "edit", product })}
                              >
                                <Pencil aria-hidden="true" /> Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => setAction({ kind: "merge", product })}
                              >
                                <Combine aria-hidden="true" /> Mesclar duplicado
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => setAction({ kind: "remove", product })}
                                variant="destructive"
                              >
                                <Trash2 aria-hidden="true" /> Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Card>
          ) : null}
        </section>
        <ProductDialog
          key={creating ? "new-open" : "new-closed"}
          onOpenChange={setCreating}
          open={creating}
          product={null}
        />
        {action?.kind === "edit" ? (
          <ProductDialog
            key={action.product.id}
            onOpenChange={closeAction}
            open
            product={action.product}
          />
        ) : null}
        {action?.kind === "merge" ? (
          <ProductMergeDialog
            key={action.product.id}
            onOpenChange={closeAction}
            open
            products={products}
            target={action.product}
          />
        ) : null}
        <AlertDialog onOpenChange={closeAction} open={action?.kind === "remove"}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir produto?</AlertDialogTitle>
              <AlertDialogDescription>
                {action?.product.name} e seus nomes da nota serão excluídos. Produtos com compras
                registradas não podem ser excluídos; mescle-os em outro produto.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                disabled={deleteMutation.isPending}
                onClick={() => action && void remove(action.product)}
                variant="destructive"
              >
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    </ProtectedRoute>
  );
}
