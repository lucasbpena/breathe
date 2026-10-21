export function CategoryPathLabel({
  category,
}: {
  category: { name: string; parentName?: string | null };
}) {
  return (
    <>
      {category.parentName ? (
        <span className="text-muted-foreground">{category.parentName} › </span>
      ) : null}
      {category.name}
    </>
  );
}
