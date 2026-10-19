import { createFileRoute } from "@tanstack/react-router";
import { BodyMeasurementsPage } from "@/features/body-measurements/components/body-measurements-page";

export const Route = createFileRoute("/body-measurements")({
  head: () => ({ meta: [{ title: "Corpo · OpenMonetis" }] }),
  component: BodyMeasurementsPage,
});
