import type {
  CategoryOutput,
  CreateCategoryInput,
  ReplaceCategoryInput,
} from "@openmonetis/validators/categories";
import {
  CreateCategoryInputSchema,
  ReplaceCategoryInputSchema,
} from "@openmonetis/validators/categories";
import { useForm } from "@tanstack/react-form";
import { useQuery } from "@tanstack/react-query";
import { useId, useState } from "react";
import { toast } from "sonner";
import { MobileFormState } from "@/components/forms/mobile-form-state";
import { MobileSelect as Select } from "@/components/forms/mobile-select";
import { MobileSelectContent as SelectContent } from "@/components/forms/mobile-select-content";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ApiClientError } from "@/lib/api-client";
import { showInvalidFormToast } from "@/lib/form-feedback";
import { categoryTypeLabels, getCategoryErrorMessage } from "../categories.presentation";
import { categoriesQueryOptions } from "../categories.queries";
import { CategoryIcon } from "../category-icons";
import { CategoryIconPicker } from "./category-icon-picker";

const noParentValue = "none";

export function CategoryForm({
  category,
  defaultParentId,
  defaultType = "expense",
  onCancel,
  onSubmit,
}: {
  category?: CategoryOutput | null;
  defaultParentId?: string | null;
  defaultType?: CreateCategoryInput["type"];
  onCancel: () => void;
  onSubmit: (input: CreateCategoryInput | ReplaceCategoryInput) => Promise<void>;
}) {
  const id = useId();
  const [error, setError] = useState<string | null>(null);
  const categories = useQuery(categoriesQueryOptions()).data ?? [];
  const editing = Boolean(category);
  const hasSubcategories = categories.some((item) => item.parentId === category?.id);
  const defaultParent = categories.find((item) => item.id === defaultParentId);
  const form = useForm({
    defaultValues: {
      name: category?.name ?? "",
      type: category?.type ?? defaultType,
      icon: category?.icon ?? "tag",
      parentId: category?.parentId ?? defaultParentId ?? "",
      tracksNutrition: category?.tracksNutrition ?? defaultParent?.tracksNutrition ?? false,
    },
    onSubmitInvalid: showInvalidFormToast,
    onSubmit: async ({ value }) => {
      setError(null);
      const result = (editing ? ReplaceCategoryInputSchema : CreateCategoryInputSchema).safeParse({
        ...value,
        parentId: value.parentId || null,
      });
      if (!result.success) {
        showInvalidFormToast();
        return;
      }
      try {
        await onSubmit(result.data);
        toast.success(
          editing
            ? "Categoria atualizada"
            : result.data.parentId
              ? "Subcategoria criada"
              : "Categoria criada",
        );
      } catch (submitError) {
        const message = getCategoryErrorMessage(
          submitError instanceof ApiClientError ? submitError.code : undefined,
          "Não foi possível salvar.",
        );
        setError(message);
        toast.error(message);
      }
    },
  });
  return (
    <form
      data-mobile-page-form
      className="grid gap-4"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <form.Subscribe
        selector={(state) => ({ isDirty: !state.isDefaultValue, isSubmitting: state.isSubmitting })}
      >
        {(state) => <MobileFormState {...state} />}
      </form.Subscribe>
      <form.Field
        name="name"
        validators={{
          onBlur: ({ value }) =>
            CreateCategoryInputSchema.shape.name.safeParse(value).success
              ? undefined
              : "Informe o nome.",
        }}
      >
        {(field) => (
          <div className="grid gap-1.5">
            <Label htmlFor={`${id}-name`}>Nome</Label>
            <Input
              aria-invalid={field.state.meta.errors.length > 0}
              id={`${id}-name`}
              onBlur={field.handleBlur}
              onChange={(event) => field.handleChange(event.target.value)}
              placeholder={
                (category?.parentId ?? defaultParentId) ? "Ex.: Hortifruti" : "Ex.: Alimentação"
              }
              value={field.state.value}
            />
            {field.state.meta.errors[0] ? (
              <p className="text-destructive text-xs" role="alert">
                {field.state.meta.errors[0]}
              </p>
            ) : null}
          </div>
        )}
      </form.Field>
      <form.Field name="type">
        {(field) => (
          <div className="grid gap-1.5">
            <Label htmlFor={`${id}-type`}>Tipo da categoria</Label>
            <Select
              onValueChange={(value) => {
                if (!value || value === field.state.value) return;
                field.handleChange(value);
                form.setFieldValue("parentId", "");
              }}
              value={field.state.value}
            >
              <SelectTrigger className="w-full" id={`${id}-type`}>
                <SelectValue>
                  <TypeOption type={field.state.value} />
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="income">
                  <TypeOption type="income" />
                </SelectItem>
                <SelectItem value="expense">
                  <TypeOption type="expense" />
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </form.Field>
      <form.Subscribe selector={(state) => state.values.type}>
        {(type) => {
          const parents = categories.filter(
            (item) =>
              item.parentId === null &&
              !item.isSystem &&
              item.type === type &&
              item.id !== category?.id,
          );
          return (
            <form.Field name="parentId">
              {(field) => (
                <div className="grid gap-1.5">
                  <Label htmlFor={`${id}-parent`}>Categoria pai</Label>
                  <Select
                    disabled={hasSubcategories}
                    onValueChange={(value) => {
                      if (!value) return;
                      const parent = parents.find((item) => item.id === value);
                      field.handleChange(parent ? parent.id : "");
                      // A new subcategory starts with its parent's nutrition choice.
                      if (!editing && parent) {
                        form.setFieldValue("tracksNutrition", parent.tracksNutrition);
                      }
                    }}
                    value={field.state.value || noParentValue}
                  >
                    <SelectTrigger className="w-full" id={`${id}-parent`}>
                      <SelectValue>
                        <ParentOption
                          category={parents.find((item) => item.id === field.state.value)}
                        />
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={noParentValue}>
                        <ParentOption />
                      </SelectItem>
                      {parents.map((parent) => (
                        <SelectItem key={parent.id} value={parent.id}>
                          <ParentOption category={parent} />
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {hasSubcategories ? (
                    <p className="text-muted-foreground text-xs">
                      Categorias com subcategorias não podem virar subcategoria.
                    </p>
                  ) : null}
                </div>
              )}
            </form.Field>
          );
        }}
      </form.Subscribe>
      <form.Subscribe selector={(state) => state.values.type}>
        {(type) =>
          type === "expense" ? (
            <form.Field name="tracksNutrition">
              {(field) => (
                <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
                  <div>
                    <Label htmlFor={`${id}-nutrition`}>Tem informação nutricional</Label>
                    <p className="mt-1 text-muted-foreground text-xs">
                      Produtos desta categoria mostram calorias e macros e entram em Físico →
                      Nutrição.
                    </p>
                  </div>
                  <Switch
                    checked={field.state.value}
                    id={`${id}-nutrition`}
                    onCheckedChange={field.handleChange}
                  />
                </div>
              )}
            </form.Field>
          ) : null
        }
      </form.Subscribe>
      <form.Field name="icon">
        {(field) => (
          <div className="grid gap-1.5">
            <Label htmlFor={`${id}-icon`}>Ícone</Label>
            <CategoryIconPicker
              id={`${id}-icon`}
              onChange={field.handleChange}
              value={field.state.value}
            />
          </div>
        )}
      </form.Field>
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(submitting) => (
          <div data-mobile-form-actions className="grid w-full grid-cols-2 gap-2 [&>*]:w-full">
            <Button
              data-mobile-cancel
              disabled={submitting}
              onClick={onCancel}
              type="button"
              variant="outline"
            >
              Cancelar
            </Button>
            <Button disabled={submitting} type="submit">
              {submitting ? "Salvando..." : editing ? "Atualizar" : "Salvar"}
            </Button>
          </div>
        )}
      </form.Subscribe>
    </form>
  );
}
function TypeOption({ type }: { type: CategoryOutput["type"] }) {
  return (
    <span className="flex items-center gap-2">
      <span
        className={`size-2 rounded-full ${type === "income" ? "bg-emerald-500" : "bg-destructive"}`}
      />
      <span>{categoryTypeLabels[type]}</span>
    </span>
  );
}
function ParentOption({ category }: { category?: CategoryOutput }) {
  if (!category) return <span>Nenhuma (categoria principal)</span>;
  return (
    <span className="flex items-center gap-2">
      <CategoryIcon className="size-4" name={category.icon} />
      <span>{category.name}</span>
    </span>
  );
}
