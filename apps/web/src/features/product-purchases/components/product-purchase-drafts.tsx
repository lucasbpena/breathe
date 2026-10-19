import type { ReplaceProductPurchaseInput } from "@openmonetis/validators/product-purchases";
import { useQuery } from "@tanstack/react-query";
import { Link2, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { MoneyValue } from "@/components/money-value";
import { Button } from "@/components/ui/button";
import { productsQueryOptions } from "@/features/products/products.queries";
import { formatStoreName } from "@/features/stores/stores.presentation";
import { storesQueryOptions } from "@/features/stores/stores.queries";
import { formatDraftQuantity, isUnresolvedPurchase } from "../product-purchases.presentation";
import { ProductPurchaseDialog } from "./product-purchase-dialog";

type ProductPurchaseDraftsProps = {
  lines: ReplaceProductPurchaseInput[];
  onChange: (lines: ReplaceProductPurchaseInput[]) => void;
  disabled?: boolean;
};

/**
 * Receipt lines typed before the expense exists; they are saved right after it. Lines read from a
 * WhatsApp capture may still lack a product or store and must be linked before saving.
 */
export function ProductPurchaseDrafts({ lines, onChange, disabled }: ProductPurchaseDraftsProps) {
  const productsQuery = useQuery(productsQueryOptions());
  const storesQuery = useQuery(storesQueryOptions());
  const [editing, setEditing] = useState<{ index: number | null } | null>(null);
  const products = productsQuery.data ?? [];
  const stores = storesQuery.data ?? [];

  return (
    <div className="grid grid-cols-1 gap-2">
      {lines.length > 0 ? (
        <ul className="grid grid-cols-1 gap-1 rounded-lg border p-1.5" aria-label="Itens da compra">
          {lines.map((line, index) => {
            const product = products.find((item) => item.id === line.productId);
            const store = stores.find((item) => item.id === line.storeId);
            const unresolved = isUnresolvedPurchase(line);
            const title = product?.name ?? line.extractedName ?? "Produto";
            const missing = [!product ? "produto" : null, !store ? "loja" : null].filter(Boolean);
            return (
              <li
                className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5"
                // Drafts have no id yet; their position is their identity until saved.
                // biome-ignore lint/suspicious/noArrayIndexKey: see above
                key={index}
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-sm">{title}</p>
                  <p className="truncate text-muted-foreground text-xs">
                    {unresolved
                      ? `Falta escolher ${missing.join(" e ")}`
                      : [
                          product ? formatDraftQuantity(line, product.contentUnit) : "",
                          store ? formatStoreName(store) : "",
                          line.extractedName && line.extractedName !== product?.name
                            ? `Na nota: ${line.extractedName}`
                            : "",
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <MoneyValue amount={line.paidAmount} className="text-sm" />
                  {unresolved ? (
                    <Button
                      aria-label={`Associar ${title}`}
                      disabled={disabled}
                      onClick={() => setEditing({ index })}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      <Link2 aria-hidden="true" />
                      <span className="hidden sm:inline">Associar</span>
                    </Button>
                  ) : (
                    <Button
                      aria-label={`Editar ${title}`}
                      disabled={disabled}
                      onClick={() => setEditing({ index })}
                      size="icon-sm"
                      type="button"
                      variant="ghost"
                    >
                      <Pencil aria-hidden="true" />
                    </Button>
                  )}
                  <Button
                    aria-label={`Remover ${title}`}
                    disabled={disabled}
                    onClick={() => onChange(lines.filter((_, position) => position !== index))}
                    size="icon-sm"
                    type="button"
                    variant="ghost"
                  >
                    <Trash2 aria-hidden="true" className="text-destructive" />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
      <Button
        className="justify-self-start"
        disabled={disabled}
        onClick={() => setEditing({ index: null })}
        size="sm"
        type="button"
        variant="outline"
      >
        <Plus aria-hidden="true" /> Adicionar item
      </Button>
      {editing ? (
        <ProductPurchaseDialog
          defaultStoreId={[...lines].reverse().find((line) => line.storeId)?.storeId ?? ""}
          initial={editing.index === null ? null : (lines[editing.index] ?? null)}
          onOpenChange={(open) => {
            if (!open) setEditing(null);
          }}
          onSave={async (line) => {
            onChange(
              editing.index === null
                ? [...lines, line]
                : lines.map((current, position) => (position === editing.index ? line : current)),
            );
          }}
          open
        />
      ) : null}
    </div>
  );
}
