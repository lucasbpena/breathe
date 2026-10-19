import { type ProductContentUnit, productContentUnits } from "@openmonetis/domain/products";
import {
  CreateProductInputSchema,
  type ProductOutput,
  UpdateProductInputSchema,
} from "@openmonetis/validators/products";
import { useForm } from "@tanstack/react-form";
import { useQuery } from "@tanstack/react-query";
import { useId, useState } from "react";
import { toast } from "sonner";
import { MobileFormContent as DialogContent } from "@/components/forms/mobile-form-content";
import { MobileFormDialog as Dialog } from "@/components/forms/mobile-form-dialog";
import { MobileFormState } from "@/components/forms/mobile-form-state";
import { MobileSelect as Select } from "@/components/forms/mobile-select";
import { MobileSelectContent as SelectContent } from "@/components/forms/mobile-select-content";
import { Button } from "@/components/ui/button";
import { DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { categoriesQueryOptions } from "@/features/categories/categories.queries";
import { showInvalidFormToast } from "@/lib/form-feedback";
import { useCreateProductMutation, useUpdateProductMutation } from "../products.mutations";
import {
  contentUnitLabels,
  contentUnitSymbols,
  formatDecimalInput,
  getProductErrorMessage,
  nutritionBasisLabels,
  nutritionFields,
  parseDecimalInput,
} from "../products.presentation";

type ProductDialogProps = {
  product: ProductOutput | null;
  initialName?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: (product: ProductOutput) => void;
};

const noCategory = "none";

export function ProductDialog({
  product,
  initialName,
  open,
  onOpenChange,
  onSaved,
}: ProductDialogProps) {
  const id = useId();
  const categoriesQuery = useQuery(categoriesQueryOptions());
  const createMutation = useCreateProductMutation();
  const updateMutation = useUpdateProductMutation();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const categories = (categoriesQuery.data ?? []).filter(
    (category) => category.type === "expense" && !category.isSystem,
  );
  const unitLocked = Boolean(product && product.priceSummary.purchaseCount > 0);
  const form = useForm({
    defaultValues: {
      name: product?.name ?? initialName ?? "",
      categoryId: product?.categoryId ?? noCategory,
      contentUnit: product?.contentUnit ?? ("package" as ProductContentUnit),
      packageContent: formatDecimalInput(product?.packageContent),
      energyKcal: formatDecimalInput(product?.energyKcal),
      proteinGrams: formatDecimalInput(product?.proteinGrams),
      carbohydrateGrams: formatDecimalInput(product?.carbohydrateGrams),
      addedSugarGrams: formatDecimalInput(product?.addedSugarGrams),
      fatGrams: formatDecimalInput(product?.fatGrams),
    },
    onSubmitInvalid: showInvalidFormToast,
    onSubmit: async ({ value }) => {
      setSubmitError(null);
      const input = {
        name: value.name,
        categoryId: value.categoryId === noCategory ? null : value.categoryId,
        contentUnit: value.contentUnit,
        packageContent:
          value.contentUnit === "package" ? null : parseDecimalInput(value.packageContent),
        energyKcal: parseDecimalInput(value.energyKcal),
        proteinGrams: parseDecimalInput(value.proteinGrams),
        carbohydrateGrams: parseDecimalInput(value.carbohydrateGrams),
        addedSugarGrams: parseDecimalInput(value.addedSugarGrams),
        fatGrams: parseDecimalInput(value.fatGrams),
      };
      let saved: ProductOutput;
      try {
        if (product) {
          const parsed = UpdateProductInputSchema.safeParse(input);
          if (!parsed.success) return showInvalidFormToast();
          saved = await updateMutation.mutateAsync({ id: product.id, input: parsed.data });
        } else {
          const parsed = CreateProductInputSchema.safeParse(input);
          if (!parsed.success) return showInvalidFormToast();
          saved = await createMutation.mutateAsync(parsed.data);
        }
      } catch (error) {
        setSubmitError(getProductErrorMessage(error, "Não foi possível salvar o produto."));
        return;
      }
      toast.success(product ? "Produto atualizado" : "Produto criado");
      onSaved?.(saved);
      onOpenChange(false);
    },
  });

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent guarded>
        <DialogHeader>
          <DialogTitle>{product ? "Editar produto" : "Novo produto"}</DialogTitle>
          <DialogDescription>
            O nome padrão unifica as diferentes formas como as notas fiscais escrevem o produto.
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
                CreateProductInputSchema.shape.name.safeParse(value).success
                  ? undefined
                  : "Informe o nome padrão do produto.",
            }}
          >
            {(field) => (
              <div className="grid gap-1.5">
                <Label htmlFor={`${id}-name`}>Nome padrão</Label>
                <Input
                  id={`${id}-name`}
                  maxLength={120}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  placeholder="Ex.: Energético Monster"
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
          <form.Field name="categoryId">
            {(field) => (
              <div className="grid gap-1.5">
                <Label htmlFor={`${id}-category`}>
                  Categoria <span className="font-normal text-muted-foreground">(opcional)</span>
                </Label>
                <Select
                  disabled={categoriesQuery.isLoading}
                  onValueChange={(next) => next && field.handleChange(next)}
                  value={field.state.value}
                >
                  <SelectTrigger className="h-11 w-full" id={`${id}-category`}>
                    <SelectValue>
                      {(selected: string) =>
                        categories.find((category) => category.id === selected)?.name ??
                        "Sem categoria"
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={noCategory}>Sem categoria</SelectItem>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </form.Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <form.Field name="contentUnit">
              {(field) => (
                <div className="grid gap-1.5">
                  <Label htmlFor={`${id}-unit`}>Metragem</Label>
                  <Select
                    disabled={unitLocked}
                    onValueChange={(next) => next && field.handleChange(next)}
                    value={field.state.value}
                  >
                    <SelectTrigger className="h-11 w-full" id={`${id}-unit`}>
                      <SelectValue>
                        {(selected: ProductContentUnit) => contentUnitLabels[selected]}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {productContentUnits.map((unit) => (
                        <SelectItem key={unit} value={unit}>
                          {contentUnitLabels[unit]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {unitLocked ? (
                    <p className="text-muted-foreground text-xs">
                      Fixa porque o produto já tem compras.
                    </p>
                  ) : field.state.value === "package" ? (
                    <p className="text-muted-foreground text-xs">
                      Para itens contados só por unidade, como um pacote de pão.
                    </p>
                  ) : null}
                </div>
              )}
            </form.Field>
            <form.Subscribe selector={(state) => state.values.contentUnit}>
              {(contentUnit) =>
                contentUnitSymbols[contentUnit] ? (
                  <form.Field name="packageContent">
                    {(field) => (
                      <div className="grid gap-1.5">
                        <Label htmlFor={`${id}-package`}>
                          Metragem por unidade ({contentUnitSymbols[contentUnit]}){" "}
                          <span className="font-normal text-muted-foreground">(opcional)</span>
                        </Label>
                        <Input
                          id={`${id}-package`}
                          inputMode="decimal"
                          onBlur={field.handleBlur}
                          onChange={(event) => field.handleChange(event.target.value)}
                          placeholder={contentUnit === "gram" ? "Ex.: 450" : "Ex.: 473"}
                          value={field.state.value}
                        />
                        <p className="text-muted-foreground text-xs">
                          Deixe vazia para itens a granel.
                        </p>
                      </div>
                    )}
                  </form.Field>
                ) : null
              }
            </form.Subscribe>
          </div>
          <fieldset className="grid gap-3 rounded-lg border p-3">
            <form.Subscribe selector={(state) => state.values.contentUnit}>
              {(contentUnit) => (
                <legend className="px-1 font-medium text-sm">
                  Informação nutricional{" "}
                  <span className="font-normal text-muted-foreground">
                    ({nutritionBasisLabels[contentUnit]}, opcional)
                  </span>
                </legend>
              )}
            </form.Subscribe>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {nutritionFields.map((nutrient) => (
                <form.Field key={nutrient.name} name={nutrient.name}>
                  {(field) => (
                    <div className="grid gap-1.5">
                      <Label className="text-xs" htmlFor={`${id}-${nutrient.name}`}>
                        {nutrient.label} ({nutrient.unit})
                      </Label>
                      <Input
                        id={`${id}-${nutrient.name}`}
                        inputMode="decimal"
                        onBlur={field.handleBlur}
                        onChange={(event) => field.handleChange(event.target.value)}
                        value={field.state.value}
                      />
                    </div>
                  )}
                </form.Field>
              ))}
            </div>
          </fieldset>
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
                  {submitting ? "Salvando..." : product ? "Salvar alterações" : "Criar produto"}
                </Button>
              </div>
            )}
          </form.Subscribe>
        </form>
      </DialogContent>
    </Dialog>
  );
}
