import type {
  BodyMeasurementDraftOutput,
  BodyMeasurementOutput,
  BodyMeasurementsOverviewOutput,
  RecordBodyMeasurementsInput,
} from "@openmonetis/validators/body-measurements";
import { requestApi as request } from "@/lib/api-client";

export function getBodyMeasurements() {
  return request<BodyMeasurementsOverviewOutput>("/body-measurements");
}

export function recordBodyMeasurements(input: RecordBodyMeasurementsInput) {
  return request<BodyMeasurementOutput[]>("/body-measurements", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function getBodyMeasurementDrafts() {
  return request<BodyMeasurementDraftOutput[]>("/body-measurements/drafts");
}

export function confirmBodyMeasurementDraft(id: string, input: RecordBodyMeasurementsInput) {
  return request<BodyMeasurementOutput[]>(`/body-measurements/drafts/${id}/confirm`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function discardBodyMeasurementDraft(id: string) {
  return request<{ id: string }>(`/body-measurements/drafts/${id}`, { method: "DELETE" });
}

export function deleteBodyMeasurement(id: string) {
  return request<{ id: string }>(`/body-measurements/${id}`, { method: "DELETE" });
}
