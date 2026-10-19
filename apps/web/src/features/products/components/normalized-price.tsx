import type { ProductContentUnit } from "@openmonetis/domain/products";
import { MoneyValue } from "@/components/money-value";
import { cn } from "@/lib/utils";
import { normalizedPriceSuffixes } from "../products.presentation";

export function NormalizedPrice({
  amount,
  contentUnit,
  className,
}: {
  amount: number | null;
  contentUnit: ProductContentUnit;
  className?: string;
}) {
  if (amount === null) return <span className="text-muted-foreground">—</span>;
  return (
    <span className={cn("inline-flex items-baseline whitespace-nowrap", className)}>
      <MoneyValue amount={amount} />
      <span className="text-muted-foreground text-xs">{normalizedPriceSuffixes[contentUnit]}</span>
    </span>
  );
}
