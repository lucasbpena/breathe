import type {
  CategoryOutput,
  CreateCategoryInput,
  ReplaceCategoryInput,
} from "@openmonetis/validators/categories";
import { MobileFormContent as DialogContent } from "@/components/forms/mobile-form-content";
import { MobileFormDialog as Dialog } from "@/components/forms/mobile-form-dialog";
import { DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CategoryForm } from "./category-form";
export function CategoryDialog({
  category,
  defaultParent,
  defaultType,
  onOpenChange,
  onSubmit,
  open,
}: {
  category: CategoryOutput | null;
  defaultParent?: CategoryOutput | null;
  defaultType?: CreateCategoryInput["type"];
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: CreateCategoryInput | ReplaceCategoryInput) => Promise<void>;
  open: boolean;
}) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent guarded>
        <DialogHeader>
          <DialogTitle>
            {category
              ? "Atualizar categoria"
              : defaultParent
                ? "Nova subcategoria"
                : "Nova categoria"}
          </DialogTitle>
          <DialogDescription>
            {category
              ? "Atualize os detalhes da categoria."
              : defaultParent
                ? `Detalhe os lançamentos de ${defaultParent.name} em mais um nível.`
                : "Crie uma categoria para organizar seus lançamentos."}
          </DialogDescription>
        </DialogHeader>
        <CategoryForm
          key={category?.id ?? defaultParent?.id ?? "new-category"}
          category={category}
          defaultParentId={defaultParent?.id}
          defaultType={defaultParent?.type ?? defaultType}
          onCancel={() => onOpenChange(false)}
          onSubmit={onSubmit}
        />
      </DialogContent>
    </Dialog>
  );
}
