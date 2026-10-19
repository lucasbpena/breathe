import { z } from "@hono/zod-openapi";

export const CreateStoreInputSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    branch: z.string().trim().min(1).max(80).nullable().optional(),
    neighborhood: z.string().trim().min(1).max(120).nullable().optional(),
    address: z.string().trim().min(1).max(255).nullable().optional(),
  })
  .openapi("CreateStoreInput");

export const UpdateStoreInputSchema = CreateStoreInputSchema.partial()
  .refine((input) => Object.keys(input).length > 0, "Provide at least one field to update")
  .openapi("UpdateStoreInput");

export const StoreParamsSchema = z
  .object({ id: z.uuid().openapi({ param: { name: "id", in: "path" } }) })
  .openapi("StoreParams");

export const StoreOutputSchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    branch: z.string().nullable(),
    neighborhood: z.string().nullable(),
    address: z.string().nullable(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .openapi("Store");

export type CreateStoreInput = z.infer<typeof CreateStoreInputSchema>;
export type UpdateStoreInput = z.infer<typeof UpdateStoreInputSchema>;
export type StoreOutput = z.infer<typeof StoreOutputSchema>;
