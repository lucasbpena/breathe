import {
  type ReplaceProductPurchaseInput,
  ReplaceProductPurchaseInputSchema,
} from "@openmonetis/validators/product-purchases";
import { useForm } from "@tanstack/react-form";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useId, useState } from "react";
import { MobileFormContent as DialogContent } from "@/components/forms/mobile-form-content";
import { MobileFormDialog as Dialog } from "@/components/forms/mobile-form-dialog";
import { MobileFormState } from "@/components/forms/mobile-form-state";
import { MobileRecordSelect } from "@/components/forms/mobile-record-select";
import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/ui/currency-input";
import { DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ProductDialog } from "@/features/products/components/product-dialog";
import {
  contentUnitSymbols,
  describeProductMetragem,
  formatDecimalInput,
  formatPackageContent,
  parseDecimalInput,
} from "@/features/products/products.presentation";
import {
  productResolutionQueryOptions,
  productsQueryOptions,
} from "@/features/products/products.queries";
import { StoreDialog } from "@/features/stores/components/store-dialog";
import { formatStoreName } from "@/features/stores/stores.presentation";
import { storesQueryOptions } from "@/features/stores/stores.queries";
import { showInvalidFormToast } from "@/lib/form-feedback";
import { getPurchaseErrorMessage } from "../product-purchases.presentation";

type ProductPurchaseDialogProps = {
  /** The line being edited, or null for a new one. */
  initial: ReplaceProductPurchaseInput | null;
  defaultStoreId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Persists the line (or keeps it as a draft); a rejection keeps the dialog open. */
  onSave: (line: ReplaceProductPurchaseInput) => Promise<void>;
};

const createValue = "__create__";

export function ProductPurchaseDialog({
  initial,
  defaultStoreId,
  open,
  onOpenChange,
  onSave,
}: ProductPurchaseDialogProps) {
  const id = useId();
  const queryClient = useQueryClient();
  const productsQuery = useQuery(productsQueryOptions());
  const storesQuery = useQuery(storesQueryOptions());
  const [newProductName, setNewProductName] = useState<string | null>(null);
  const [creatingStore, setCreatingStore] = useState(false);
  const [recognized, setRecognized] = useState(false);
  const [quantityMissing, setQuantityMissing] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const products = productsQuery.data ?? [];
  const stores = storesQuery.data ?? [];

  const form = useForm({
    defaultValues: {
      extractedName: initial?.extractedName ?? "",
      productId: initial?.productId ?? "",
      storeId: initial?.storeId || defaultStoreId,
      packageCount: initial ? formatDecimalInput(initial.packageCount) : "1",
      totalContent: formatDecimalInput(initial?.totalContent),
      paidAmount: initial ? String(initial.paidAmount) : "",
      discountAmount: initial?.discountAmount ? String(initial.discountAmount) : "",
    },
    onSubmitInvalid: showInvalidFormToast,
    onSubmit: async ({ value }) => {
      setSubmitError(null);
      const product = products.find((item) => item.id === value.productId);
      const line = {
        productId: value.productId,
        storeId: value.storeId,
        extractedName: value.extractedName.trim() || null,
        packageCount: parseDecimalInput(value.packageCount),
        totalContent:
          product?.contentUnit === "package" ? null : parseDecimalInput(value.totalContent),
        paidAmount: Number(value.paidAmount),
        discountAmount: value.discountAmount ? Number(value.discountAmount) : 0,
      };
      const parsed = ReplaceProductPurchaseInputSchema.safeParse(line);
      setQuantityMissing(
        !parsed.success && parsed.error.issues.some((issue) => issue.path[0] === "packageCount"),
      );
      if (!parsed.success) {
        showInvalidFormToast();
        return;
      }
      try {
        await onSave(parsed.data);
        onOpenChange(false);
      } catch (error) {
        setSubmitError(getPurchaseErrorMessage(error, "Não foi possível salvar o item."));
      }
    },
  });

  async function recognizeProduct(extractedName: string) {
    const name = extractedName.trim();
    if (!name || form.getFieldValue("productId")) return;
    try {
      const resolution = await queryClient.fetchQuery(productResolutionQueryOptions(name));
      if (resolution.productId && !form.getFieldValue("productId")) {
        form.setFieldValue("productId", resolution.productId);
        setRecognized(true);
      }
    } catch {
      // Recognition is a convenience; the product can still be chosen by hand.
    }
  }

  return (
    <>
      <Dialog onOpenChange={onOpenChange} open={open}>
        <DialogContent guarded>
          <DialogHeader>
            <DialogTitle>{initial ? "Editar item" : "Novo item da compra"}</DialogTitle>
            <DialogDescription>
              Registre um produto desta nota fiscal com a loja, a quantidade e o valor pago.
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
            <form.Field name="extractedName">
              {(field) => (
                <div className="grid gap-1.5">
                  <Label htmlFor={`${id}-extracted`}>
                    Nome na nota{" "}
                    <span className="font-normal text-muted-foreground">(opcional)</span>
                  </Label>
                  <Input
                    id={`${id}-extracted`}
                    maxLength={160}
                    onBlur={() => {
                      field.handleBlur();
                      void recognizeProduct(field.state.value);
                    }}
                    onChange={(event) => field.handleChange(event.target.value)}
                    placeholder="Ex.: MONSTER TRAD 473ML"
                    value={field.state.value}
                  />
                  <p className="text-muted-foreground text-xs">
                    Como está impresso na nota. Fica salvo para reconhecer o produto nas próximas.
                  </p>
                </div>
              )}
            </form.Field>
            <form.Field
              name="productId"
              validators={{ onSubmit: ({ value }) => (value ? undefined : "Escolha o produto.") }}
            >
              {(field) => {
                const selected = products.find((product) => product.id === field.state.value);
                return (
                  <div className="grid gap-1.5">
                    <Label htmlFor={`${id}-product`}>Produto</Label>
                    <MobileRecordSelect
                      createOption={{ value: createValue, label: "Criar produto…" }}
                      disabled={productsQuery.isLoading}
                      invalid={field.state.meta.errors.length > 0}
                      onValueChange={(next) => {
                        setRecognized(false);
                        if (next === createValue) {
                          setNewProductName(form.getFieldValue("extractedName").trim());
                          return;
                        }
                        field.handleChange(next ?? "");
                      }}
                      options={products.map((product) => ({
                        value: product.id,
                        label: product.name,
                      }))}
                      title="Produto"
                      value={field.state.value}
                    >
                      <SelectTrigger
                        aria-invalid={field.state.meta.errors.length > 0}
                        className="h-11 w-full"
                        id={`${id}-product`}
                      >
                        <SelectValue placeholder="Selecione">
                          {() => selected?.name ?? "Selecione"}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {products.map((product) => (
                          <SelectItem key={product.id} value={product.id}>
                            {product.name}
                          </SelectItem>
                        ))}
                        {products.length > 0 ? <SelectSeparator /> : null}
                        <SelectItem value={createValue}>
                          <Plus aria-hidden="true" className="size-4" /> Criar produto…
                        </SelectItem>
                      </SelectContent>
                    </MobileRecordSelect>
                    {selected ? (
                      <p className="text-muted-foreground text-xs">
                        {recognized ? "Reconhecido pelo nome da nota · " : ""}
                        {describeProductMetragem(selected)}
                      </p>
                    ) : null}
                    {field.state.meta.errors[0] ? (
                      <p className="text-destructive text-xs" role="alert">
                        {field.state.meta.errors[0]}
                      </p>
                    ) : null}
                  </div>
                );
              }}
            </form.Field>
            <form.Field
              name="storeId"
              validators={{ onSubmit: ({ value }) => (value ? undefined : "Escolha a loja.") }}
            >
              {(field) => {
                const selected = stores.find((store) => store.id === field.state.value);
                return (
                  <div className="grid gap-1.5">
                    <Label htmlFor={`${id}-store`}>Loja</Label>
                    <MobileRecordSelect
                      createOption={{ value: createValue, label: "Criar loja…" }}
                      disabled={storesQuery.isLoading}
                      invalid={field.state.meta.errors.length > 0}
                      onValueChange={(next) => {
                        if (next === createValue) {
                          setCreatingStore(true);
                          return;
                        }
                        field.handleChange(next ?? "");
                      }}
                      options={stores.map((store) => ({
                        value: store.id,
                        label: formatStoreName(store),
                      }))}
                      title="Loja"
                      value={field.state.value}
                    >
                      <SelectTrigger
                        aria-invalid={field.state.meta.errors.length > 0}
                        className="h-11 w-full"
                        id={`${id}-store`}
                      >
                        <SelectValue placeholder="Selecione">
                          {() => (selected ? formatStoreName(selected) : "Selecione")}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {stores.map((store) => (
                          <SelectItem key={store.id} value={store.id}>
                            {formatStoreName(store)}
                          </SelectItem>
                        ))}
                        {stores.length > 0 ? <SelectSeparator /> : null}
                        <SelectItem value={createValue}>
                          <Plus aria-hidden="true" className="size-4" /> Criar loja…
                        </SelectItem>
                      </SelectContent>
                    </MobileRecordSelect>
                    {field.state.meta.errors[0] ? (
                      <p className="text-destructive text-xs" role="alert">
                        {field.state.meta.errors[0]}
                      </p>
                    ) : null}
                  </div>
                );
              }}
            </form.Field>
            <form.Subscribe selector={(state) => state.values.productId}>
              {(productId) => {
                const product = products.find((item) => item.id === productId);
                const symbol = product ? contentUnitSymbols[product.contentUnit] : null;
                const metragemRequired = product?.packageContent === null;
                return (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <form.Field name="packageCount">
                      {(field) => (
                        <div className="grid gap-1.5">
                          <Label htmlFor={`${id}-packages`}>Unidades</Label>
                          <Input
                            aria-invalid={quantityMissing}
                            id={`${id}-packages`}
                            inputMode="decimal"
                            onChange={(event) => field.handleChange(event.target.value)}
                            placeholder="Ex.: 4"
                            value={field.state.value}
                          />
                        </div>
                      )}
                    </form.Field>
                    {product && symbol ? (
                      <form.Field name="totalContent">
                        {(field) => (
                          <div className="grid gap-1.5">
                            <Label htmlFor={`${id}-total`}>
                              Metragem total ({symbol}){" "}
                              {metragemRequired ? null : (
                                <span className="font-normal text-muted-foreground">
                                  (opcional)
                                </span>
                              )}
                            </Label>
                            <Input
                              aria-invalid={quantityMissing}
                              id={`${id}-total`}
                              inputMode="decimal"
                              onChange={(event) => field.handleChange(event.target.value)}
                              placeholder={symbol === "g" ? "Ex.: 1430" : "Ex.: 2000"}
                              value={field.state.value}
                            />
                            <p className="text-muted-foreground text-xs">
                              {metragemRequired
                                ? "Obrigatória para itens a granel."
                                : `Vazia: unidades × ${formatPackageContent(product)}.`}
                            </p>
                          </div>
                        )}
                      </form.Field>
                    ) : null}
                    {quantityMissing ? (
                      <p className="text-destructive text-xs sm:col-span-2" role="alert">
                        {symbol
                          ? "Informe as unidades ou a metragem total."
                          : "Informe as unidades."}
                      </p>
                    ) : null}
                  </div>
                );
              }}
            </form.Subscribe>
            <div className="grid gap-4 sm:grid-cols-2">
              <form.Field
                name="paidAmount"
                validators={{
                  onSubmit: ({ value }) =>
                    Number(value) > 0 ? undefined : "Informe o valor pago.",
                }}
              >
                {(field) => (
                  <div className="grid gap-1.5">
                    <Label htmlFor={`${id}-paid`}>Valor pago</Label>
                    <CurrencyInput
                      aria-invalid={field.state.meta.errors.length > 0}
                      id={`${id}-paid`}
                      onBlur={field.handleBlur}
                      onValueChange={field.handleChange}
                      placeholder="R$ 0,00"
                      value={field.state.value}
                    />
                    {field.state.meta.errors[0] ? (
                      <p className="text-destructive text-xs" role="alert">
                        {field.state.meta.errors[0]}
                      </p>
                    ) : (
                      <p className="text-muted-foreground text-xs">
                        Total da linha, já com desconto.
                      </p>
                    )}
                  </div>
                )}
              </form.Field>
              <form.Field name="discountAmount">
                {(field) => (
                  <div className="grid gap-1.5">
                    <Label htmlFor={`${id}-discount`}>
                      Desconto <span className="font-normal text-muted-foreground">(opcional)</span>
                    </Label>
                    <CurrencyInput
                      id={`${id}-discount`}
                      onBlur={field.handleBlur}
                      onValueChange={field.handleChange}
                      placeholder="R$ 0,00"
                      value={field.state.value}
                    />
                  </div>
                )}
              </form.Field>
            </div>
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
                    {submitting ? "Salvando..." : initial ? "Salvar alterações" : "Adicionar item"}
                  </Button>
                </div>
              )}
            </form.Subscribe>
          </form>
        </DialogContent>
      </Dialog>
      {newProductName !== null ? (
        <ProductDialog
          initialName={newProductName}
          onOpenChange={(next) => {
            if (!next) setNewProductName(null);
          }}
          onSaved={(product) => form.setFieldValue("productId", product.id)}
          open
          product={null}
        />
      ) : null}
      {creatingStore ? (
        <StoreDialog
          onOpenChange={setCreatingStore}
          onSaved={(store) => form.setFieldValue("storeId", store.id)}
          open
          store={null}
        />
      ) : null}
    </>
  );
}
