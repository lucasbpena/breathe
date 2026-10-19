import { queryOptions } from "@tanstack/react-query";
import { getBodyMeasurementDrafts, getBodyMeasurements } from "./body-measurements.api";

export function bodyMeasurementsQueryOptions() {
  return queryOptions({ queryKey: ["body-measurements"], queryFn: getBodyMeasurements });
}

/** Measurements read from WhatsApp; the shared prefix refreshes them with every change. */
export function bodyMeasurementDraftsQueryOptions() {
  return queryOptions({
    queryKey: ["body-measurements", "drafts"],
    queryFn: getBodyMeasurementDrafts,
  });
}
