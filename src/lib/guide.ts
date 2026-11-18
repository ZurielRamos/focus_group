import type { QuestionType } from "./quest";

export type Draft = {
  text: string;
  type: QuestionType;
  options: string[];
  images: string[];
  rows: string[];
  compareTo: number | null;
};

const draft = (d: Partial<Draft> & Pick<Draft, "text" | "type">): Draft => {
  const options = d.options ?? [];
  return { images: options.map(() => ""), rows: [], compareTo: null, ...d, options };
};

const SELLOS = ["Juego de líneas", "Huella", "Ave"];

const ASPECTOS = [
  "Me transmite más naturaleza",
  "Me transmite más el concepto de “Sostenibilidad”",
  "Me genera más gusto y agrado",
  "Me parece que es más fácil de recordar",
  "Me transmite más confianza y respaldo",
  "Se comprende de inmediato lo que quiere transmitir",
  "Me transmite un producto de mayor valor",
];

// Preguntas que se responden en el celular durante el focus group del Sello de Sostenibilidad de ALIÓN.
export const GUIDE_TITLE = "Sello de Sostenibilidad ALIÓN";

export const GUIDE_QUESTIONS: Draft[] = [
  draft({
    text: "Cuando una empresa busca mejorar sus indicadores de sostenibilidad, el costo final del producto puede variar. ¿Estarías dispuesto a pagar un poco más por un portafolio diferenciado con más atributos sostenibles, como una menor huella de carbono?",
    type: "single",
    options: ["Sí", "No"],
  }),
  draft({ text: "¿Por qué?", type: "text" }),
  draft({
    text: "Ahora que conoces a fondo lo que implica un Sello de Sostenibilidad, ¿qué tanto cambia tu percepción el hecho de que un material (cemento/concreto) lo tenga? 1 es poco cambio y 7 es mucho cambio.",
    type: "rating",
    options: ["1", "2", "3", "4", "5", "6", "7"],
  }),
  draft({
    text: "Después de observar las tres propuestas, ¿cuál te gusta más visualmente y sería la que elegirías?",
    type: "single",
    options: [...SELLOS, "Ninguna de las anteriores"],
  }),
  draft({ text: "¿Por qué te gustó más? ¿Qué elemento de esa propuesta fue el que más te impactó?", type: "text" }),
  draft({
    text: "¿Cuál de las tres propuestas asocias más con cada uno de los siguientes aspectos?",
    type: "matrix",
    options: SELLOS,
    rows: ASPECTOS,
  }),
  draft({
    text: "Ya conoces la explicación de cada propuesta. Responde de nuevo: ¿cuál de las tres asocias más con cada aspecto?",
    type: "matrix",
    options: SELLOS,
    rows: ASPECTOS,
    compareTo: 5,
  }),
  ...SELLOS.map((s) =>
    draft({
      text: `Pensando en el diseño «${s}», ¿hay algo que le mejorarías? Si no le mejorarías nada, escribe “No le mejoraría nada”.`,
      type: "text",
    }),
  ),
  draft({
    text: "En una sola palabra o comentario, ¿qué representa para ti que ALIÓN incorpore este Sello de Sostenibilidad en sus sacos, vehículos y comunicación?",
    type: "text",
  }),
];
