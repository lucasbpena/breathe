import type { NutritionIntakeOutput } from "@openmonetis/validators/nutrition-intake";
import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatContent } from "@/features/products/products.presentation";
import { formatGrams, formatKcal } from "../nutrition-intake.presentation";

/** A product without nutrition shows a dash instead of a misleading zero. */
function formatNutrient(hasCalories: boolean, grams: number) {
  return hasCalories || grams > 0 ? formatGrams(grams) : "—";
}

export function NutritionIntakeProducts({ intake }: { intake: NutritionIntakeOutput }) {
  return (
    <Card className="border">
      <CardHeader>
        <CardTitle>Produtos do período</CardTitle>
        <CardDescription>
          Do que mais trouxe calorias ao que menos. Produtos sem calorias cadastradas ficam de fora
          da estimativa; abra o produto para preencher a informação nutricional.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-2 sm:px-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Produto</TableHead>
              <TableHead className="hidden text-right sm:table-cell">Quantidade</TableHead>
              <TableHead className="text-right">Calorias</TableHead>
              <TableHead className="hidden text-right md:table-cell">Proteínas</TableHead>
              <TableHead className="hidden text-right md:table-cell">Carboidratos</TableHead>
              <TableHead className="hidden text-right md:table-cell">Gorduras</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {intake.products.map((product) => (
              <TableRow key={product.productId}>
                <TableCell className="max-w-56">
                  <Link
                    className="inline-flex max-w-full items-center gap-1 font-medium hover:text-brand-strong"
                    params={{ productId: product.productId }}
                    to="/products/$productId"
                  >
                    <span className="truncate">{product.productName}</span>
                    <ChevronRight className="size-3 shrink-0 text-muted-foreground" />
                  </Link>
                  <p className="text-muted-foreground text-xs sm:hidden">
                    {formatContent(product.totalContent, product.contentUnit)}
                  </p>
                </TableCell>
                <TableCell className="hidden text-right tabular-nums sm:table-cell">
                  {formatContent(product.totalContent, product.contentUnit)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {product.hasCalories ? (
                    formatKcal(product.nutrients.energyKcal)
                  ) : (
                    <Badge variant="outline">Sem calorias</Badge>
                  )}
                </TableCell>
                <TableCell className="hidden text-right tabular-nums md:table-cell">
                  {formatNutrient(product.hasCalories, product.nutrients.proteinGrams)}
                </TableCell>
                <TableCell className="hidden text-right tabular-nums md:table-cell">
                  {formatNutrient(product.hasCalories, product.nutrients.carbohydrateGrams)}
                </TableCell>
                <TableCell className="hidden text-right tabular-nums md:table-cell">
                  {formatNutrient(product.hasCalories, product.nutrients.fatGrams)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
