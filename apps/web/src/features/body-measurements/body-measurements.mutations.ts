import type { RecordBodyMeasurementsInput } from "@openmonetis/validators/body-measurements";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  confirmBodyMeasurementDraft,
  deleteBodyMeasurement,
  discardBodyMeasurementDraft,
  recordBodyMeasurements,
} from "./body-measurements.api";

export function useRecordBodyMeasurementsMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: recordBodyMeasurements,
    onSuccess: () => client.invalidateQueries({ queryKey: ["body-measurements"] }),
  });
}

export function useDeleteBodyMeasurementMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: deleteBodyMeasurement,
    onSuccess: () => client.invalidateQueries({ queryKey: ["body-measurements"] }),
  });
}

export function useConfirmBodyMeasurementDraftMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: RecordBodyMeasurementsInput }) =>
      confirmBodyMeasurementDraft(id, input),
    onSuccess: () => client.invalidateQueries({ queryKey: ["body-measurements"] }),
  });
}

export function useDiscardBodyMeasurementDraftMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: discardBodyMeasurementDraft,
    onSuccess: () => client.invalidateQueries({ queryKey: ["body-measurements"] }),
  });
}
