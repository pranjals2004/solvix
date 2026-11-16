export type CalibrationObservation = { confidence: number; outcome: boolean | 0 | 1 };
export type CalibrationBin = {
  index: number;
  count: number;
  meanConfidence: number;
  accuracy: number;
  gap: number;
};

export type CalibrationResult = {
  ece: number;
  count: number;
  bins: CalibrationBin[];
};

export function expectedCalibrationError(
  observations: CalibrationObservation[],
  binCount = 10,
): CalibrationResult {
  if (!Number.isInteger(binCount) || binCount < 1 || binCount > 100) {
    throw new Error('Bin count must be an integer between 1 and 100.');
  }
  const bins = Array.from({ length: binCount }, (_, index) => ({
    index, count: 0, confidenceTotal: 0, correctTotal: 0,
  }));
  for (const observation of observations) {
    if (!Number.isInteger(observation.confidence) || observation.confidence < 1 || observation.confidence > 5) {
      throw new Error('Confidence must be an integer between 1 and 5.');
    }
    const outcome = typeof observation.outcome === 'boolean' ? Number(observation.outcome) : observation.outcome;
    if (outcome !== 0 && outcome !== 1) throw new Error('Outcome must be boolean or 0/1.');
    const probability = (observation.confidence - 1) / 4;
    const index = Math.min(binCount - 1, Math.floor(probability * binCount));
    const bin = bins[index];
    if (!bin) continue;
    bin.count += 1;
    bin.confidenceTotal += probability;
    bin.correctTotal += outcome;
  }
  const populatedBins = bins.map((bin) => {
    const meanConfidence = bin.count ? bin.confidenceTotal / bin.count : 0;
    const accuracy = bin.count ? bin.correctTotal / bin.count : 0;
    return {
      index: bin.index,
      count: bin.count,
      meanConfidence,
      accuracy,
      gap: Math.abs(meanConfidence - accuracy),
    };
  });
  const ece = observations.length
    ? populatedBins.reduce((total, bin) => total + (bin.count / observations.length) * bin.gap, 0)
    : 0;
  return { ece, count: observations.length, bins: populatedBins };
}
