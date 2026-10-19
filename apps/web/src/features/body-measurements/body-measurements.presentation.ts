import type {
  BodyMeasurementKind,
  BodyMeasurementUnit,
} from "@openmonetis/domain/body-measurements";
import { dateOnlyToSafeInstant, formatDateInBrazil } from "@openmonetis/shared/date-time";
import { getErrorCodeMessage } from "../stores/stores.presentation";

export const bodyMeasurementLabels: Record<BodyMeasurementKind, string> = {
  weight: "Peso",
  neck: "Pescoço",
  shoulders: "Ombros",
  chest: "Peitoral",
  waist: "Cintura",
  abdomen: "Abdômen",
  hips: "Quadril",
  leftArm: "Braço esquerdo",
  rightArm: "Braço direito",
  leftForearm: "Antebraço esquerdo",
  rightForearm: "Antebraço direito",
  leftThigh: "Coxa esquerda",
  rightThigh: "Coxa direita",
  leftCalf: "Panturrilha esquerda",
  rightCalf: "Panturrilha direita",
};

/** Muscles the tape goes around, so each part on the body map names what it tracks. */
export const bodyMeasurementMuscles: Record<BodyMeasurementKind, string> = {
  weight: "Corpo inteiro",
  neck: "Pescoço e trapézio superior",
  shoulders: "Deltoides e trapézio",
  chest: "Peitoral e dorsais",
  waist: "Oblíquos e lombar",
  abdomen: "Reto abdominal",
  hips: "Glúteos",
  leftArm: "Bíceps e tríceps",
  rightArm: "Bíceps e tríceps",
  leftForearm: "Flexores e extensores do punho",
  rightForearm: "Flexores e extensores do punho",
  leftThigh: "Quadríceps e posteriores de coxa",
  rightThigh: "Quadríceps e posteriores de coxa",
  leftCalf: "Gastrocnêmio e sóleo",
  rightCalf: "Gastrocnêmio e sóleo",
};

/** Where the tape goes; measuring the same spot every time keeps the history comparable. */
export const bodyMeasurementGuides: Record<BodyMeasurementKind, string> = {
  weight: "Pela manhã, em jejum e depois de ir ao banheiro.",
  neck: "Logo abaixo do pomo de adão, com a fita reta.",
  shoulders: "Volta completa na parte mais larga, passando pelos deltoides.",
  chest: "Na linha dos mamilos, depois de soltar o ar.",
  waist: "No ponto mais estreito do tronco, acima do umbigo.",
  abdomen: "Na altura do umbigo, com o abdômen relaxado.",
  hips: "Na parte mais saliente dos glúteos, com os pés juntos.",
  leftArm: "No meio do braço, entre ombro e cotovelo, relaxado.",
  rightArm: "No meio do braço, entre ombro e cotovelo, relaxado.",
  leftForearm: "Na parte mais larga, logo abaixo do cotovelo.",
  rightForearm: "Na parte mais larga, logo abaixo do cotovelo.",
  leftThigh: "No meio da coxa, entre virilha e joelho.",
  rightThigh: "No meio da coxa, entre virilha e joelho.",
  leftCalf: "Na parte mais larga da panturrilha, em pé.",
  rightCalf: "Na parte mais larga da panturrilha, em pé.",
};

export const bodyMeasurementGroups: { label: string; kinds: BodyMeasurementKind[] }[] = [
  { label: "Peso", kinds: ["weight"] },
  { label: "Tronco", kinds: ["neck", "shoulders", "chest", "waist", "abdomen", "hips"] },
  { label: "Braços", kinds: ["rightArm", "leftArm", "rightForearm", "leftForearm"] },
  { label: "Pernas", kinds: ["rightThigh", "leftThigh", "rightCalf", "leftCalf"] },
];

export const bodyMeasurementUnitSymbols: Record<BodyMeasurementUnit, string> = {
  kilogram: "kg",
  centimeter: "cm",
};

const measurementErrorMessages: Record<string, string> = {
  body_measurement_not_found: "Medida não encontrada.",
  body_measurement_draft_not_found: "Essas medidas já foram confirmadas ou descartadas.",
};

const valueFormatter = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });
const changeFormatter = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 2,
  signDisplay: "exceptZero",
});

export function getBodyMeasurementErrorMessage(error: unknown, fallback: string) {
  return getErrorCodeMessage(error, measurementErrorMessages) ?? fallback;
}

export function formatMeasurement(value: number, unit: BodyMeasurementUnit) {
  return `${valueFormatter.format(value)} ${bodyMeasurementUnitSymbols[unit]}`;
}

export function formatMeasurementChange(change: number, unit: BodyMeasurementUnit) {
  if (change === 0) return "sem variação";
  return `${changeFormatter.format(change)} ${bodyMeasurementUnitSymbols[unit]}`;
}

export function formatMeasuredOn(value: string) {
  return formatDateInBrazil(dateOnlyToSafeInstant(value), {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/**
 * Five whole-number ticks with an even step, padded by one unit and centered on the values, so
 * small changes such as 0,5 cm stay visible without fractional axis labels.
 */
export function buildMeasurementTicks(values: readonly number[], intervals = 4) {
  const lower = Math.floor(Math.min(...values)) - 1;
  const upper = Math.ceil(Math.max(...values)) + 1;
  const step = Math.ceil((upper - lower) / intervals);
  const start = lower - Math.floor((step * intervals - (upper - lower)) / 2);
  return Array.from({ length: intervals + 1 }, (_, index) => start + index * step);
}

export function formatMeasurementChartDate(value: string) {
  return formatDateInBrazil(dateOnlyToSafeInstant(value), { day: "2-digit", month: "2-digit" });
}
