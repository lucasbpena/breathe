import {
  CreateProductAliasInputSchema,
  type ProductOutput,
} from "@openmonetis/validators/products";
import { useForm } from "@tanstack/react-form";
import { Plus, X } from "lucide-react";
import { useId } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAddProductAliasMutation, useRemoveProductAliasMutation } from "../products.mutations";
import { getProductErrorMessage } from "../products.presentation";

export function ProductAliases({ product }: { product: ProductOutput }) {
  const id = useId();
  const addMutation = useAddProductAliasMutation(product.id);
  const removeMutation = useRemoveProductAliasMutation(product.id);
  const form = useForm({
    defaultValues: { name: "" },
    onSubmit: async ({ value, formApi }) => {
      const parsed = CreateProductAliasInputSchema.safeParse(value);
      if (!parsed.success) return;
      try {
        await addMutation.mutateAsync(parsed.data.name);
        formApi.reset();
      } catch (error) {
        toast.error(getProductErrorMessage(error, "Não foi possível adicionar o nome."));
      }
    },
  });

  async function remove(aliasId: string) {
    try {
      await removeMutation.mutateAsync(aliasId);
    } catch (error) {
      toast.error(getProductErrorMessage(error, "Não foi possível remover o nome."));
    }
  }

  return (
    <div className="grid gap-3">
      {product.aliases.length > 0 ? (
        <ul className="flex flex-wrap gap-2" aria-label="Nomes da nota fiscal">
          {product.aliases.map((alias) => (
            <li key={alias.id}>
              <Badge className="h-7 gap-1 pr-1" variant="secondary">
                {alias.name}
                <Button
                  aria-label={`Remover ${alias.name}`}
                  className="size-5"
                  disabled={removeMutation.isPending}
                  onClick={() => void remove(alias.id)}
                  size="icon-sm"
                  type="button"
                  variant="ghost"
                >
                  <X aria-hidden="true" className="size-3" />
                </Button>
              </Badge>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground text-sm">
          Nenhum nome da nota ainda. Eles são aprendidos ao registrar itens com o nome impresso na
          nota.
        </p>
      )}
      <form
        className="flex items-end gap-2"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void form.handleSubmit();
        }}
      >
        <form.Field name="name">
          {(field) => (
            <div className="grid flex-1 gap-1.5">
              <Label className="sr-only" htmlFor={`${id}-alias`}>
                Novo nome da nota
              </Label>
              <Input
                id={`${id}-alias`}
                maxLength={160}
                onChange={(event) => field.handleChange(event.target.value)}
                placeholder="Ex.: MONSTER TRAD 473ML"
                value={field.state.value}
              />
            </div>
          )}
        </form.Field>
        <form.Subscribe
          selector={(state) => [state.isSubmitting, state.values.name.trim()] as const}
        >
          {([submitting, name]) => (
            <Button disabled={submitting || !name} type="submit" variant="outline">
              <Plus aria-hidden="true" className="size-4" /> Adicionar
            </Button>
          )}
        </form.Subscribe>
      </form>
    </div>
  );
}
