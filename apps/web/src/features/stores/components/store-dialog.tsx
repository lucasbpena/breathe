import {
  CreateStoreInputSchema,
  type StoreOutput,
  UpdateStoreInputSchema,
} from "@openmonetis/validators/stores";
import { useForm } from "@tanstack/react-form";
import { useId, useState } from "react";
import { toast } from "sonner";
import { MobileFormContent as DialogContent } from "@/components/forms/mobile-form-content";
import { MobileFormDialog as Dialog } from "@/components/forms/mobile-form-dialog";
import { MobileFormState } from "@/components/forms/mobile-form-state";
import { Button } from "@/components/ui/button";
import { DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { showInvalidFormToast } from "@/lib/form-feedback";
import { useCreateStoreMutation, useUpdateStoreMutation } from "../stores.mutations";
import { getStoreErrorMessage } from "../stores.presentation";

type StoreDialogProps = {
  store: StoreOutput | null;
  initialName?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: (store: StoreOutput) => void;
};

const optionalFields = [
  { name: "branch", label: "Filial", placeholder: "Ex.: Loja 003", maxLength: 80 },
  { name: "neighborhood", label: "Bairro", placeholder: "Ex.: Sagrada Família", maxLength: 120 },
  {
    name: "address",
    label: "Endereço",
    placeholder: "Ex.: R. Conselheiro Lafaiete, 735",
    maxLength: 255,
  },
] as const;

export function StoreDialog({ store, initialName, open, onOpenChange, onSaved }: StoreDialogProps) {
  const id = useId();
  const createMutation = useCreateStoreMutation();
  const updateMutation = useUpdateStoreMutation();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const form = useForm({
    defaultValues: {
      name: store?.name ?? initialName ?? "",
      branch: store?.branch ?? "",
      neighborhood: store?.neighborhood ?? "",
      address: store?.address ?? "",
    },
    onSubmitInvalid: showInvalidFormToast,
    onSubmit: async ({ value }) => {
      setSubmitError(null);
      const input = {
        name: value.name,
        branch: value.branch.trim() || null,
        neighborhood: value.neighborhood.trim() || null,
        address: value.address.trim() || null,
      };
      let saved: StoreOutput;
      try {
        if (store) {
          const parsed = UpdateStoreInputSchema.safeParse(input);
          if (!parsed.success) return showInvalidFormToast();
          saved = await updateMutation.mutateAsync({ id: store.id, input: parsed.data });
        } else {
          const parsed = CreateStoreInputSchema.safeParse(input);
          if (!parsed.success) return showInvalidFormToast();
          saved = await createMutation.mutateAsync(parsed.data);
        }
      } catch (error) {
        setSubmitError(getStoreErrorMessage(error, "Não foi possível salvar a loja."));
        return;
      }
      toast.success(store ? "Loja atualizada" : "Loja criada");
      onSaved?.(saved);
      onOpenChange(false);
    },
  });

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent guarded>
        <DialogHeader>
          <DialogTitle>{store ? "Editar loja" : "Nova loja"}</DialogTitle>
          <DialogDescription>
            Cada loja é uma unidade física. Filiais da mesma rede são cadastradas separadamente.
          </DialogDescription>
        </DialogHeader>
        <form
          data-mobile-page-form
          className="grid gap-4"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            void form.handleSubmit();
          }}
        >
          <form.Subscribe
            selector={(state) => ({
              isDirty: !state.isDefaultValue,
              isSubmitting: state.isSubmitting,
            })}
          >
            {(state) => <MobileFormState {...state} />}
          </form.Subscribe>
          <form.Field
            name="name"
            validators={{
              onBlur: ({ value }) =>
                CreateStoreInputSchema.shape.name.safeParse(value).success
                  ? undefined
                  : "Informe o nome da loja.",
            }}
          >
            {(field) => (
              <div className="grid gap-1.5">
                <Label htmlFor={`${id}-name`}>Nome</Label>
                <Input
                  id={`${id}-name`}
                  maxLength={120}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  placeholder="Ex.: DMA Distribuidora"
                  value={field.state.value}
                  aria-invalid={field.state.meta.errors.length > 0}
                />
                {field.state.meta.errors[0] ? (
                  <p className="text-destructive text-xs" role="alert">
                    {field.state.meta.errors[0]}
                  </p>
                ) : null}
              </div>
            )}
          </form.Field>
          {optionalFields.map((item) => (
            <form.Field key={item.name} name={item.name}>
              {(field) => (
                <div className="grid gap-1.5">
                  <Label htmlFor={`${id}-${item.name}`}>
                    {item.label}{" "}
                    <span className="font-normal text-muted-foreground">(opcional)</span>
                  </Label>
                  <Input
                    id={`${id}-${item.name}`}
                    maxLength={item.maxLength}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    placeholder={item.placeholder}
                    value={field.state.value}
                  />
                </div>
              )}
            </form.Field>
          ))}
          {submitError ? (
            <p className="text-destructive text-sm" role="alert">
              {submitError}
            </p>
          ) : null}
          <form.Subscribe selector={(state) => state.isSubmitting}>
            {(submitting) => (
              <div data-mobile-form-actions className="grid grid-cols-2 gap-2">
                <Button
                  data-mobile-cancel
                  disabled={submitting}
                  onClick={() => onOpenChange(false)}
                  type="button"
                  variant="outline"
                >
                  Cancelar
                </Button>
                <Button disabled={submitting} type="submit">
                  {submitting ? "Salvando..." : store ? "Salvar alterações" : "Criar loja"}
                </Button>
              </div>
            )}
          </form.Subscribe>
        </form>
      </DialogContent>
    </Dialog>
  );
}
