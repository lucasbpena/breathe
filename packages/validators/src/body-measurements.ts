import { z } from "@hono/zod-openapi";
import { bodyMeasurementKinds, bodyMeasurementUnits } from "@openmonetis/domain/body-measurements";

export const bodyMeasurementValueSchema = z
  .number()
  .finite()
  .positive()
  .multipleOf(0.01)
  .max(9999.99);

export const RecordBodyMeasurementsInputSchema = z
  .object({
    measuredOn: z.iso.date(),
    entries: z
      .array(
        z.object({
          kind: z.enum(bodyMeasurementKinds),
          value: bodyMeasurementValueSchema,
        }),
      )
      .min(1)
      .max(bodyMeasurementKinds.length)
      .refine(
        (entries) => new Set(entries.map((entry) => entry.kind)).size === entries.length,
        "Each kind can be recorded once per date",
      ),
  })
  .openapi("RecordBodyMeasurementsInput");

export const BodyMeasurementParamsSchema = z
  .object({ id: z.uuid().openapi({ param: { name: "id", in: "path" } }) })
  .openapi("BodyMeasurementParams");

const BodyMeasurementPointSchema = z.object({
  id: z.uuid(),
  value: z.number().positive(),
  measuredOn: z.iso.date(),
});

export const BodyMeasurementOutputSchema = BodyMeasurementPointSchema.extend({
  kind: z.enum(bodyMeasurementKinds),
  unit: z.enum(bodyMeasurementUnits),
}).openapi("BodyMeasurement");

export const BodyMeasurementsOverviewOutputSchema = z
  .object({
    lastMeasuredOn: z.iso.date().nullable(),
    trends: z.array(
      z.object({
        kind: z.enum(bodyMeasurementKinds),
        unit: z.enum(bodyMeasurementUnits),
        latest: BodyMeasurementPointSchema.nullable(),
        change: z.number().nullable(),
        totalChange: z.number().nullable(),
        history: z.array(BodyMeasurementPointSchema),
      }),
    ),
  })
  .openapi("BodyMeasurementsOverview");

/** Measurements read from a WhatsApp message, waiting for the user to confirm them. */
export const BodyMeasurementDraftOutputSchema = z
  .object({
    id: z.uuid(),
    measuredOn: z.iso.date(),
    createdAt: z.iso.datetime(),
    warnings: z.array(z.string()),
    entries: z.array(
      z.object({
        kind: z.enum(bodyMeasurementKinds),
        unit: z.enum(bodyMeasurementUnits),
        value: z.number().positive(),
        /** The value already saved for this kind on the same date, which confirming replaces. */
        currentValue: z.number().positive().nullable(),
      }),
    ),
  })
  .openapi("BodyMeasurementDraft");

export type BodyMeasurementDraftOutput = z.infer<typeof BodyMeasurementDraftOutputSchema>;
export type RecordBodyMeasurementsInput = z.infer<typeof RecordBodyMeasurementsInputSchema>;
export type BodyMeasurementOutput = z.infer<typeof BodyMeasurementOutputSchema>;
export type BodyMeasurementsOverviewOutput = z.infer<typeof BodyMeasurementsOverviewOutputSchema>;
export type BodyMeasurementTrendOutput = BodyMeasurementsOverviewOutput["trends"][number];
