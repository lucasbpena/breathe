import type { BodyMeasurementKind } from "@openmonetis/domain/body-measurements";
import type {
  BodyMeasurementDraftOutput,
  RecordBodyMeasurementsInput,
} from "@openmonetis/validators/body-measurements";
import { Check, Pencil, Trash2, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  useConfirmBodyMeasurementDraftMutation,
  useDiscardBodyMeasurementDraftMutation,
} from "../body-measurements.mutations";
import {
  bodyMeasurementLabels,
  formatMeasuredOn,
  formatMeasurement,
  getBodyMeasurementErrorMessage,
} from "../body-measurements.presentation";
import { BodyMeasurementsDialog } from "./body-measurements-dialog";

function toInput(draft: BodyMeasurementDraftOutput): RecordBodyMeasurementsInput {
  return {
    measuredOn: draft.measuredOn,
    entries: draft.entries.map((entry) => ({ kind: entry.kind, value: entry.value })),
  };
}

/** Measurements sent on WhatsApp, which only count once the user confirms them. */
export function BodyMeasurementDrafts({
  drafts,
  latestValues,
}: {
  drafts: BodyMeasurementDraftOutput[];
  latestValues: Partial<Record<BodyMeasurementKind, number>>;
}) {
  const confirmMutation = useConfirmBodyMeasurementDraftMutation();
  const discardMutation = useDiscardBodyMeasurementDraftMutation();
  const [editing, setEditing] = useState<BodyMeasurementDraftOutput | null>(null);
  const busy = confirmMutation.isPending || discardMutation.isPending;

  async function confirm(draft: BodyMeasurementDraftOutput) {
    try {
      await confirmMutation.mutateAsync({ id: draft.id, input: toInput(draft) });
      toast.success(draft.entries.length === 1 ? "Medida registrada" : "Medidas registradas");
    } catch (error) {
      toast.error(getBodyMeasurementErrorMessage(error, "Não foi possível salvar as medidas."));
    }
  }

  async function discard(draft: BodyMeasurementDraftOutput) {
    try {
      await discardMutation.mutateAsync(draft.id);
      toast.success("Medidas descartadas");
    } catch (error) {
      toast.error(getBodyMeasurementErrorMessage(error, "Não foi possível descartar as medidas."));
    }
  }

  return (
    <Card className="min-w-0 border">
      <CardHeader>
        <CardTitle>Recebidas pelo WhatsApp</CardTitle>
        <CardDescription>
          Confira os valores lidos antes de salvar. Confirmar substitui uma medida que já existe na
          mesma data.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-3">
        {drafts.map((draft) => (
          <section
            aria-label={`Medidas de ${formatMeasuredOn(draft.measuredOn)}`}
            className="grid min-w-0 gap-3 rounded-lg border p-3"
            key={draft.id}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium text-sm">{formatMeasuredOn(draft.measuredOn)}</p>
              <div className="flex flex-wrap gap-2">
                <Button disabled={busy} onClick={() => void confirm(draft)} size="sm" type="button">
                  <Check aria-hidden="true" /> Confirmar
                </Button>
                <Button
                  disabled={busy}
                  onClick={() => setEditing(draft)}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <Pencil aria-hidden="true" /> Editar
                </Button>
                <Button
                  aria-label={`Descartar medidas de ${formatMeasuredOn(draft.measuredOn)}`}
                  disabled={busy}
                  onClick={() => void discard(draft)}
                  size="icon-sm"
                  type="button"
                  variant="ghost"
                >
                  <Trash2 aria-hidden="true" className="text-destructive" />
                </Button>
              </div>
            </div>
            <ul className="flex flex-wrap gap-x-6 gap-y-1">
              {draft.entries.map((entry) => (
                <li className="text-sm" key={entry.kind}>
                  <span className="text-muted-foreground">{bodyMeasurementLabels[entry.kind]}</span>{" "}
                  <span className="font-medium tabular-nums">
                    {formatMeasurement(entry.value, entry.unit)}
                  </span>
                  {entry.currentValue !== null ? (
                    <span className="text-muted-foreground text-xs tabular-nums">
                      {" "}
                      (substitui {formatMeasurement(entry.currentValue, entry.unit)})
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
            {draft.warnings.length ? (
              <ul className="grid gap-1">
                {draft.warnings.map((warning) => (
                  <li className="flex gap-2 text-muted-foreground text-xs" key={warning}>
                    <TriangleAlert aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
                    {warning}
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        ))}
      </CardContent>
      {editing ? (
        <BodyMeasurementsDialog
          draft={toInput(editing)}
          focusKind={editing.entries[0]?.kind ?? "weight"}
          latestValues={latestValues}
          onOpenChange={(open) => {
            if (!open) setEditing(null);
          }}
          onSave={async (input) => {
            // The dialog reports success and errors itself.
            await confirmMutation.mutateAsync({ id: editing.id, input });
          }}
          open
        />
      ) : null}
    </Card>
  );
}
