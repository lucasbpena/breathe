import type { StoreOutput } from "@openmonetis/validators/stores";
import { useQuery } from "@tanstack/react-query";
import { Pencil, Plus, RefreshCw, Store, Trash2 } from "lucide-react";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useDeleteStoreMutation } from "../stores.mutations";
import { formatStoreLocation, formatStoreName, getStoreErrorMessage } from "../stores.presentation";
import { storesQueryOptions } from "../stores.queries";
import { StoreDialog } from "./store-dialog";

export function StoresPage() {
  const storesQuery = useQuery(storesQueryOptions());
  const deleteMutation = useDeleteStoreMutation();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingStore, setEditingStore] = useState<StoreOutput | null>(null);
  const [removingStore, setRemovingStore] = useState<StoreOutput | null>(null);
  const stores = storesQuery.data ?? [];

  function openDialog(store: StoreOutput | null) {
    setEditingStore(store);
    setDialogOpen(true);
  }

  async function remove(store: StoreOutput) {
    try {
      await deleteMutation.mutateAsync(store.id);
      toast.success("Loja excluída");
    } catch (error) {
      toast.error(getStoreErrorMessage(error, "Não foi possível excluir a loja."));
    } finally {
      setRemovingStore(null);
    }
  }

  return (
    <ProtectedRoute>
      <main className="min-h-svh bg-background">
        <Navbar />
        <section className="app-page project-container">
          <PageHeader
            actions={
              <Button onClick={() => openDialog(null)} type="button">
                <Plus aria-hidden="true" className="size-4" /> Nova loja
              </Button>
            }
            breadcrumbs={[
              { label: "Visão geral", href: "/dashboard" },
              { label: "Consumo" },
              { label: "Lojas" },
            ]}
            description="Unidades onde você compra, com bairro e endereço."
            icon={<Store aria-hidden="true" className="size-5" />}
            title="Lojas"
          />

          {storesQuery.isLoading ? (
            <div aria-label="Carregando lojas" className="grid gap-2" role="status">
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
            </div>
          ) : null}
          {storesQuery.isError ? (
            <Card className="grid min-h-52 place-items-center border p-6 text-center">
              <div>
                <p className="font-medium">Não foi possível carregar as lojas</p>
                <Button
                  className="mt-4"
                  onClick={() => void storesQuery.refetch()}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <RefreshCw aria-hidden="true" /> Tentar novamente
                </Button>
              </div>
            </Card>
          ) : null}
          {storesQuery.isSuccess && stores.length === 0 ? (
            <Card className="grid min-h-60 place-items-center border p-6 text-center">
              <div className="max-w-md">
                <span className="mx-auto grid size-11 place-items-center rounded-full bg-muted text-muted-foreground">
                  <Store aria-hidden="true" className="size-5" />
                </span>
                <p className="mt-4 font-medium">Nenhuma loja cadastrada</p>
                <p className="mt-1 text-muted-foreground text-sm">
                  Cadastre aqui ou direto ao detalhar os itens de um lançamento.
                </p>
                <Button className="mt-4" onClick={() => openDialog(null)} size="sm" type="button">
                  <Plus aria-hidden="true" /> Cadastrar loja
                </Button>
              </div>
            </Card>
          ) : null}
          {stores.length > 0 ? (
            <Card className="border p-2 sm:p-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Loja</TableHead>
                    <TableHead className="hidden sm:table-cell">Bairro</TableHead>
                    <TableHead className="hidden md:table-cell">Endereço</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stores.map((store) => (
                    <TableRow key={store.id}>
                      <TableCell>
                        <p className="font-medium">{formatStoreName(store)}</p>
                        <p className="text-muted-foreground text-xs sm:hidden">
                          {formatStoreLocation(store)}
                        </p>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {store.neighborhood ?? "—"}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">{store.address ?? "—"}</TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button
                            aria-label={`Editar ${formatStoreName(store)}`}
                            onClick={() => openDialog(store)}
                            size="icon"
                            variant="ghost"
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            aria-label={`Excluir ${formatStoreName(store)}`}
                            disabled={deleteMutation.isPending}
                            onClick={() => setRemovingStore(store)}
                            size="icon"
                            variant="ghost"
                          >
                            <Trash2 className="size-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          ) : null}
        </section>
        <StoreDialog
          key={`${editingStore?.id ?? "new"}-${dialogOpen ? "open" : "closed"}`}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) setEditingStore(null);
          }}
          open={dialogOpen}
          store={editingStore}
        />
        <AlertDialog
          onOpenChange={(open) => {
            if (!open) setRemovingStore(null);
          }}
          open={removingStore !== null}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir loja?</AlertDialogTitle>
              <AlertDialogDescription>
                {removingStore ? formatStoreName(removingStore) : ""} será excluída. Lojas com
                compras registradas não podem ser excluídas.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => removingStore && void remove(removingStore)}
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
