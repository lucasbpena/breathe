import type { ProductOutput } from "@openmonetis/validators/products";
import { useId, useState } from "react";
import { toast } from "sonner";
import { MobileFormContent as DialogContent } from "@/components/forms/mobile-form-content";
import { MobileFormDialog as Dialog } from "@/components/forms/mobile-form-dialog";
import { MobileRecordSelect } from "@/components/forms/mobile-record-select";
import { Button } from "@/components/ui/button";
import { DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMergeProductsMutation } from "../products.mutations";
import { getProductErrorMessage } from "../products.presentation";

type ProductMergeDialogProps = {
  target: ProductOutput;
  products: ProductOutput[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ProductMergeDialog({
  target,
  products,
  open,
  onOpenChange,
}: ProductMergeDialogProps) {
  const id = useId();
  const mutation = useMergeProductsMutation();
  const [sourceId, setSourceId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const candidates = products.filter(
    (product) => product.id !== target.id && product.contentUnit === target.contentUnit,
  );
  const source = candidates.find((product) => product.id === sourceId);

  async function merge() {
    if (!source) return;
    setError(null);
    try {
      await mutation.mutateAsync({ targetId: target.id, sourceProductId: source.id });
      toast.success(`${source.name} foi mesclado em ${target.name}`);
      onOpenChange(false);
    } catch (mergeError) {
      setError(getProductErrorMessage(mergeError, "Não foi possível mesclar os produtos."));
    }
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mesclar em {target.name}</DialogTitle>
          <DialogDescription>
            As compras e os nomes da nota do produto escolhido passam para {target.name}. O nome
            dele vira um nome da nota e o produto duplicado é excluído.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-source`}>Produto duplicado</Label>
          <MobileRecordSelect
            disabled={candidates.length === 0 || mutation.isPending}
            onValueChange={(value) => setSourceId(value ?? "")}
            options={candidates.map((product) => ({ value: product.id, label: product.name }))}
            title="Produto duplicado"
            value={sourceId}
          >
            <SelectTrigger className="h-11 w-full" id={`${id}-source`}>
              <SelectValue placeholder="Selecione">{() => source?.name ?? "Selecione"}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {candidates.map((product) => (
                <SelectItem key={product.id} value={product.id}>
                  {product.name}
                </SelectItem>
              ))}
            </SelectContent>
          </MobileRecordSelect>
          {candidates.length === 0 ? (
            <p className="text-muted-foreground text-xs">
              Nenhum outro produto medido na mesma unidade.
            </p>
          ) : null}
        </div>
        {error ? (
          <p className="text-destructive text-sm" role="alert">
            {error}
          </p>
        ) : null}
        <div data-mobile-form-actions className="grid grid-cols-2 gap-2">
          <Button
            data-mobile-cancel
            disabled={mutation.isPending}
            onClick={() => onOpenChange(false)}
            type="button"
            variant="outline"
          >
            Cancelar
          </Button>
          <Button
            disabled={!source || mutation.isPending}
            onClick={() => void merge()}
            type="button"
          >
            {mutation.isPending ? "Mesclando..." : "Mesclar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
