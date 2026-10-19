/**
 * Body weight plus the circumferences taken with a measuring tape. Limbs are measured on each
 * side, so left and right are separate kinds.
 */
export const bodyMeasurementKinds = [
  "weight",
  "neck",
  "shoulders",
  "chest",
  "waist",
  "abdomen",
  "hips",
  "leftArm",
  "rightArm",
  "leftForearm",
  "rightForearm",
  "leftThigh",
  "rightThigh",
  "leftCalf",
  "rightCalf",
] as const;
export type BodyMeasurementKind = (typeof bodyMeasurementKinds)[number];

export const bodyMeasurementUnits = ["kilogram", "centimeter"] as const;
export type BodyMeasurementUnit = (typeof bodyMeasurementUnits)[number];

export type BodyMeasurementEntry = {
  id: string;
  kind: BodyMeasurementKind;
  value: number | string;
  measuredOn: string;
};

export type BodyMeasurementPoint = {
  id: string;
  value: number;
  measuredOn: string;
};

export type BodyMeasurementTrend = {
  kind: BodyMeasurementKind;
  unit: BodyMeasurementUnit;
  latest: BodyMeasurementPoint | null;
  /** Latest minus the measurement before it. */
  change: number | null;
  /** Latest minus the first measurement. */
  totalChange: number | null;
  history: BodyMeasurementPoint[];
};

export function getBodyMeasurementUnit(kind: BodyMeasurementKind): BodyMeasurementUnit {
  return kind === "weight" ? "kilogram" : "centimeter";
}

/** One trend per kind, in the canonical order, including kinds never measured. */
export function summarizeBodyMeasurements(
  entries: readonly BodyMeasurementEntry[],
): BodyMeasurementTrend[] {
  return bodyMeasurementKinds.map((kind) => {
    const history = entries
      .filter((entry) => entry.kind === kind)
      .map((entry) => ({ id: entry.id, value: Number(entry.value), measuredOn: entry.measuredOn }))
      .sort(
        (left, right) =>
          left.measuredOn.localeCompare(right.measuredOn) || left.id.localeCompare(right.id),
      );
    const first = history[0];
    const previous = history.at(-2);
    const latest = history.at(-1) ?? null;

    return {
      kind,
      unit: getBodyMeasurementUnit(kind),
      latest,
      change: latest && previous ? difference(latest.value, previous.value) : null,
      totalChange:
        latest && first && history.length > 1 ? difference(latest.value, first.value) : null,
      history,
    };
  });
}

/** The most recent date with any measurement, or null when nothing was measured. */
export function findLastMeasuredOn(entries: readonly Pick<BodyMeasurementEntry, "measuredOn">[]) {
  return entries.reduce<string | null>(
    (last, entry) => (last === null || entry.measuredOn > last ? entry.measuredOn : last),
    null,
  );
}

/** Values have two decimals, so the difference is taken in hundredths to avoid float noise. */
function difference(current: number, reference: number) {
  return (Math.round(current * 100) - Math.round(reference * 100)) / 100;
}

/** Values outside these ranges are almost always a typo, such as 824 for 82,4 kg. */
export const bodyMeasurementPlausibleRanges: Record<
  BodyMeasurementUnit,
  { min: number; max: number }
> = {
  kilogram: { min: 20, max: 350 },
  centimeter: { min: 10, max: 250 },
};

export type CapturedBodyMeasurements = {
  measuredOn: string | null;
  entries: { kind: BodyMeasurementKind; value: number }[];
};

/**
 * Cleans measurements read from a message before they become a draft: one value per kind (the
 * last one wins), two decimals, plausible values only, and a date that is valid and not after the
 * day the message arrived.
 */
export function reconcileCapturedMeasurements(
  captured: CapturedBodyMeasurements,
  receivedOn: string,
) {
  const byKind = new Map<BodyMeasurementKind, number>();
  for (const entry of captured.entries) byKind.set(entry.kind, Math.round(entry.value * 100) / 100);

  const entries: { kind: BodyMeasurementKind; value: number }[] = [];
  const implausible: { kind: BodyMeasurementKind; value: number }[] = [];
  for (const kind of bodyMeasurementKinds) {
    const value = byKind.get(kind);
    if (value === undefined) continue;
    const range = bodyMeasurementPlausibleRanges[getBodyMeasurementUnit(kind)];
    (value >= range.min && value <= range.max ? entries : implausible).push({ kind, value });
  }

  const dateIsValid =
    captured.measuredOn !== null &&
    /^\d{4}-\d{2}-\d{2}$/.test(captured.measuredOn) &&
    !Number.isNaN(Date.parse(`${captured.measuredOn}T12:00:00Z`)) &&
    captured.measuredOn <= receivedOn;

  return {
    measuredOn: dateIsValid ? (captured.measuredOn as string) : receivedOn,
    entries,
    implausible,
  };
}
