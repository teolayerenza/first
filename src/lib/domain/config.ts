// Umbrales y pesos. En producción viven en la tabla `config` y se pueden ajustar sin redeploy;
// estos son los valores por defecto (los mismos que inserta la migración).

export const DEFAULT_CONFIG = {
  /** Ventana de vigencia de calificaciones y repavimentaciones. */
  conditionWindowDays: 365,
  /** Peso mínimo de la moda para que una cuadra deje de estar "sin relevar". Con 1 alcanza una calificación;
   *  las siguientes se suman y gana la opción con más peso. */
  minRatingWeight: 1,
  /** Peso de una calificación hecha en el lugar (GPS a < 50 m de la cuadra). */
  onSiteWeight: 2,
  /** Confirmaciones distintas necesarias para dar por buena una repavimentación. */
  repavedConfirmations: 1,
  /** Dispositivos distintos que tienen que marcar "es empedrado" para que la cuadra pase a empedrado. */
  cobbledConfirmations: 1,
  /** Votos "arreglado" distintos para resolver un problema. */
  resolveVotes: 2,
  /** Votos "falso" distintos para ocultar un problema. */
  hideVotes: 3,
  /** Radio de deduplicación de problemas (m). */
  dedupeRadiusM: 8,
  /** Distancia máxima para asignar un punto a una cuadra (m). */
  snapMaxDistanceM: 25,
  /** Distancia para considerar un aporte "en el lugar" (m). */
  onSiteRadiusM: 50,
  /** % mínimo de km relevados para que una zona entre al ranking. */
  rankingMinSurveyedPct: 20,
  /** Ventana para el tiempo promedio de arreglo y la calidad del arreglo. */
  repairWindowDays: 90,
  /** Peso de la gravedad en la densidad ponderada. */
  severityWeights: { 1: 1, 2: 2, 3: 4 } as Record<1 | 2 | 3, number>,
  rateLimits: {
    issuesPerDay: 10,
    ratingsPerDay: 30,
    photosPerDay: 5,
    issuesPerSegmentPerHour: 5,
  },
} as const;

export type Config = typeof DEFAULT_CONFIG;
