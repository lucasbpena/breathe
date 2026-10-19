import type { BodyMeasurementKind } from "@openmonetis/domain/body-measurements";
import type { KeyboardEvent } from "react";
import { cn } from "@/lib/utils";
import { bodyMeasurementLabels } from "../body-measurements.presentation";

export type BodyView = "front" | "back";

/** A part on the midline, such as the neck. */
type CentralRegion = { id: string; muscle: string; d: string; kind: BodyMeasurementKind };

/**
 * A part on both sides. The path is drawn on the viewer's left and mirrored to the right. Seen
 * from the front, the viewer's left is the person's right; seen from the back, it is the left.
 */
type PairedRegion = {
  id: string;
  muscle: string;
  d: string;
  left: BodyMeasurementKind;
  right: BodyMeasurementKind;
};

type BodyRegion = CentralRegion | PairedRegion;

const mirror = "matrix(-1 0 0 1 200 0)";

const neck = "M90 46 Q100 52 110 46 L112 64 Q100 70 88 64 Z";
const deltoid = "M86 66 Q70 63 61 74 Q54 86 56 101 Q63 95 70 93 Q75 82 85 77 Z";
const upperArm = "M57 105 Q64 99 71 97 Q75 122 71 146 Q62 151 53 147 Q51 124 57 105 Z";
const forearm = "M53 151 Q62 155 71 150 Q69 179 59 208 Q52 211 45 207 Q44 178 53 151 Z";
const calf = "M78 291 Q87 287 95 291 Q98 323 92 358 Q86 362 81 358 Q73 323 78 291 Z";

const regions: Record<BodyView, BodyRegion[]> = {
  front: [
    { id: "neck", muscle: "Pescoço", d: neck, kind: "neck" },
    { id: "deltoid", muscle: "Deltoide", d: deltoid, left: "shoulders", right: "shoulders" },
    {
      id: "chest",
      muscle: "Peitoral",
      d: "M89 72 Q100 77 111 72 Q121 76 124 90 Q124 106 113 110 Q104 112 100 106 Q96 112 87 110 Q76 106 76 90 Q79 76 89 72 Z",
      kind: "chest",
    },
    {
      id: "oblique",
      muscle: "Oblíquo",
      d: "M77 109 Q82 112 85 115 L85 162 Q80 166 75 164 Q71 150 72 134 Q73 119 77 109 Z",
      left: "waist",
      right: "waist",
    },
    {
      id: "abdomen",
      muscle: "Reto abdominal",
      d: "M89 115 Q100 111 111 115 L112 160 Q108 172 100 174 Q92 172 88 160 Z",
      kind: "abdomen",
    },
    {
      id: "hips",
      muscle: "Quadril",
      d: "M74 169 Q80 171 86 167 Q92 177 100 179 Q108 177 114 167 Q120 171 126 169 Q131 183 130 198 Q116 197 100 206 Q84 197 70 198 Q69 183 74 169 Z",
      kind: "hips",
    },
    { id: "biceps", muscle: "Bíceps", d: upperArm, left: "leftArm", right: "rightArm" },
    { id: "forearm", muscle: "Antebraço", d: forearm, left: "leftForearm", right: "rightForearm" },
    {
      id: "quadriceps",
      muscle: "Quadríceps",
      d: "M71 203 Q85 201 98 211 Q99 244 94 272 Q86 277 78 272 Q69 240 71 203 Z",
      left: "leftThigh",
      right: "rightThigh",
    },
    { id: "calf", muscle: "Panturrilha", d: calf, left: "leftCalf", right: "rightCalf" },
  ],
  back: [
    { id: "neck", muscle: "Nuca", d: neck, kind: "neck" },
    {
      id: "trapezius",
      muscle: "Trapézio",
      d: "M89 66 Q100 71 111 66 Q118 70 124 74 Q113 80 106 96 Q100 104 94 96 Q87 80 76 74 Q82 70 89 66 Z",
      kind: "shoulders",
    },
    { id: "deltoid", muscle: "Deltoide", d: deltoid, left: "shoulders", right: "shoulders" },
    {
      id: "lats",
      muscle: "Dorsal",
      d: "M76 80 Q86 84 92 101 Q97 112 98 126 Q90 136 80 144 Q74 130 73 112 Q73 94 76 80 Z",
      left: "chest",
      right: "chest",
    },
    {
      id: "lower-back",
      muscle: "Lombar",
      d: "M84 140 Q92 134 100 134 Q108 134 116 140 L117 164 Q100 172 83 164 Z",
      kind: "waist",
    },
    {
      id: "glutes",
      muscle: "Glúteo",
      d: "M73 170 Q86 166 99 173 L99 204 Q86 210 72 203 Q68 186 73 170 Z",
      left: "hips",
      right: "hips",
    },
    { id: "triceps", muscle: "Tríceps", d: upperArm, left: "leftArm", right: "rightArm" },
    { id: "forearm", muscle: "Antebraço", d: forearm, left: "leftForearm", right: "rightForearm" },
    {
      id: "hamstrings",
      muscle: "Posterior de coxa",
      d: "M72 209 Q85 209 98 213 Q99 244 94 272 Q86 277 78 272 Q69 240 72 209 Z",
      left: "leftThigh",
      right: "rightThigh",
    },
    { id: "calf", muscle: "Panturrilha", d: calf, left: "leftCalf", right: "rightCalf" },
  ],
};

/** Head, hands, knees and feet complete the silhouette but have no measurement. */
function Silhouette() {
  return (
    <g className="fill-foreground/5">
      <ellipse cx="100" cy="27" rx="16" ry="20" />
      {["", mirror].map((transform) => (
        <g key={transform || "left"} transform={transform || undefined}>
          <ellipse cx="50" cy="221" rx="7" ry="12" />
          <ellipse cx="86" cy="281" rx="9" ry="6" />
          <path d="M80 363 H92 Q96 376 92 388 H76 Q74 376 80 363 Z" />
        </g>
      ))}
    </g>
  );
}

export function BodyMap({
  view,
  selectedKind,
  measuredKinds,
  onSelect,
}: {
  view: BodyView;
  selectedKind: BodyMeasurementKind;
  measuredKinds: ReadonlySet<BodyMeasurementKind>;
  onSelect: (kind: BodyMeasurementKind) => void;
}) {
  const viewerLeftSide = view === "front" ? "right" : "left";
  const viewerRightSide = view === "front" ? "left" : "right";

  function renderPart(
    id: string,
    muscle: string,
    d: string,
    kind: BodyMeasurementKind,
    transform?: string,
  ) {
    const label = `${muscle} · ${bodyMeasurementLabels[kind]}`;
    return (
      // biome-ignore lint/a11y/useSemanticElements: SVG has no <button>; the path is the hit area.
      <path
        aria-label={label}
        aria-pressed={selectedKind === kind}
        className={cn(
          "cursor-pointer stroke-2 stroke-card outline-none transition-colors focus-visible:stroke-ring motion-reduce:transition-none",
          selectedKind === kind
            ? "fill-brand"
            : measuredKinds.has(kind)
              ? "fill-brand/35 hover:fill-brand/60"
              : "fill-foreground/10 hover:fill-brand/30",
        )}
        d={d}
        key={`${id}-${transform ? "mirrored" : "drawn"}`}
        onClick={() => onSelect(kind)}
        onKeyDown={(event: KeyboardEvent<SVGPathElement>) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          onSelect(kind);
        }}
        role="button"
        tabIndex={0}
        transform={transform}
      >
        <title>{label}</title>
      </path>
    );
  }

  return (
    <fieldset className="min-w-0">
      <legend className="sr-only">
        {view === "front" ? "Corpo visto de frente" : "Corpo visto de costas"}
      </legend>
      <svg className="mx-auto h-auto w-full max-w-64" viewBox="0 0 200 400">
        <title>Mapa do corpo</title>
        <Silhouette />
        {regions[view].flatMap((region) =>
          "kind" in region
            ? [renderPart(region.id, region.muscle, region.d, region.kind)]
            : [
                renderPart(region.id, region.muscle, region.d, region[viewerLeftSide]),
                renderPart(region.id, region.muscle, region.d, region[viewerRightSide], mirror),
              ],
        )}
      </svg>
    </fieldset>
  );
}
