import {
  type BodyMeasurementKind,
  bodyMeasurementKinds,
  getBodyMeasurementUnit,
} from "@openmonetis/domain/body-measurements";
import { getCurrentDateInBrazil } from "@openmonetis/shared/date-time";
import {
  bodyMeasurementValueSchema,
  type RecordBodyMeasurementsInput,
  RecordBodyMeasurementsInputSchema,
} from "@openmonetis/validators/body-measurements";
import { useForm } from "@tanstack/react-form";
import { useId, useRef, useState } from "react";
import { toast } from "sonner";
import { MobileFormContent as DialogContent } from "@/components/forms/mobile-form-content";
import { MobileFormDialog as Dialog } from "@/components/forms/mobile-form-dialog";
import { MobileFormState } from "@/components/forms/mobile-form-state";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDecimalInput, parseDecimalInput } from "@/features/products/products.presentation";
import { showInvalidFormToast } from "@/lib/form-feedback";
import { useRecordBodyMeasurementsMutation } from "../body-measurements.mutations";
import {
  bodyMeasurementGroups,
  bodyMeasurementLabels,
  bodyMeasurementUnitSymbols,
  getBodyMeasurementErrorMessage,
} from "../body-measurements.presentation";

type BodyMeasurementsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The input focused when the dialog opens, usually the part selected on the body map. */
  focusKind: BodyMeasurementKind;
  latestValues: Partial<Record<BodyMeasurementKind, number>>;
  /** Values read from WhatsApp to review; saving confirms them through `onSave`. */
  draft?: RecordBodyMeasurementsInput;
  onSave?: (input: RecordBodyMeasurementsInput) => Promise<void>;
};

const emptyValues = Object.fromEntries(bodyMeasurementKinds.map((kind) => [kind, ""])) as Record<
  BodyMeasurementKind,
  string
>;

function validateValue(value: string) {
  const parsed = parseDecimalInput(value);
  if (parsed === null) return undefined;
  return bodyMeasurementValueSchema.safeParse(parsed).success ? undefined : "Valor inválido.";
}

export function BodyMeasurementsDialog({
  open,
  onOpenChange,
  focusKind,
  latestValues,
  draft,
  onSave,
}: BodyMeasurementsDialogProps) {
  const id = useId();
  const focusRef = useRef<HTMLInputElement>(null);
  const recordMutation = useRecordBodyMeasurementsMutation();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const form = useForm({
    defaultValues: {
      measuredOn: draft?.measuredOn ?? getCurrentDateInBrazil(),
      values: draft
        ? {
            ...emptyValues,
            ...Object.fromEntries(
              draft.entries.map((entry) => [entry.kind, formatDecimalInput(entry.value)]),
            ),
          }
        : emptyValues,
    },
    onSubmitInvalid: showInvalidFormToast,
    onSubmit: async ({ value }) => {
      setSubmitError(null);
      const entries = bodyMeasurementKinds.flatMap((kind) => {
        const parsed = parseDecimalInput(value.values[kind]);
        return parsed === null ? [] : [{ kind, value: parsed }];
      });
      if (entries.length === 0) {
        setSubmitError("Preencha ao menos uma medida.");
        return;
      }
      const parsed = RecordBodyMeasurementsInputSchema.safeParse({
        measuredOn: value.measuredOn,
        entries,
      });
      if (!parsed.success) return showInvalidFormToast();
      try {
        if (onSave) await onSave(parsed.data);
        else await recordMutation.mutateAsync(parsed.data);
      } catch (error) {
        setSubmitError(
          getBodyMeasurementErrorMessage(error, "Não foi possível salvar as medidas."),
        );
        return;
      }
      toast.success(entries.length === 1 ? "Medida registrada" : "Medidas registradas");
      onOpenChange(false);
    },
  });

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent guarded initialFocus={focusRef}>
        <DialogHeader>
          <DialogTitle>{draft ? "Revisar medidas" : "Registrar medidas"}</DialogTitle>
          <DialogDescription>
            {draft
              ? "Valores lidos da mensagem do WhatsApp. Corrija o que for preciso antes de salvar; uma medida que já existe na mesma data é substituída."
              : "Preencha só o que mediu. Uma medida que já existe na mesma data é substituída."}
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
            name="measuredOn"
            validators={{
              onChange: ({ value }) => (value ? undefined : "Informe a data."),
            }}
          >
            {(field) => (
              <div className="grid gap-1.5">
                <Label htmlFor={`${id}-date`}>Data</Label>
                <DatePicker
                  aria-invalid={field.state.meta.errors.length > 0}
                  id={`${id}-date`}
                  max={getCurrentDateInBrazil()}
                  onChange={field.handleChange}
                  value={field.state.value}
                />
              </div>
            )}
          </form.Field>
          {bodyMeasurementGroups.map((group) => (
            <fieldset className="grid gap-3 rounded-lg border p-3" key={group.label}>
              <legend className="px-1 font-medium text-sm">{group.label}</legend>
              <div className="grid grid-cols-2 gap-3">
                {group.kinds.map((kind) => {
                  const symbol = bodyMeasurementUnitSymbols[getBodyMeasurementUnit(kind)];
                  const latest = latestValues[kind];
                  return (
                    <form.Field
                      key={kind}
                      name={`values.${kind}`}
                      validators={{ onBlur: ({ value }) => validateValue(value) }}
                    >
                      {(field) => (
                        <div className="grid gap-1.5">
                          <Label className="text-xs" htmlFor={`${id}-${kind}`}>
                            {bodyMeasurementLabels[kind]} ({symbol})
                          </Label>
                          <Input
                            aria-invalid={field.state.meta.errors.length > 0}
                            id={`${id}-${kind}`}
                            inputMode="decimal"
                            onBlur={field.handleBlur}
                            onChange={(event) => field.handleChange(event.target.value)}
                            placeholder={
                              latest === undefined
                                ? undefined
                                : `Último: ${formatDecimalInput(latest)}`
                            }
                            ref={kind === focusKind ? focusRef : undefined}
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
                  );
                })}
              </div>
            </fieldset>
          ))}
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
                  {submitting ? "Salvando..." : "Salvar medidas"}
                </Button>
              </div>
            )}
          </form.Subscribe>
        </form>
      </DialogContent>
    </Dialog>
  );
}
