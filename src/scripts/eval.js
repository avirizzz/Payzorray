function evaluateRecallPrecision(predictedCandidates, groundTruthIds) {
  const predictedIds = predictedCandidates.map(c => c.product_id);
  
  const truePositives = predictedIds.filter(id => groundTruthIds.includes(id)).length;
  const falsePositives = predictedIds.filter(id => !groundTruthIds.includes(id)).length;
  const falseNegatives = groundTruthIds.filter(id => !predictedIds.includes(id)).length;

  const precision = truePositives / (truePositives + falsePositives) || 0;
  const recall = truePositives / (truePositives + falseNegatives) || 0;
  const f1 = 2 * ((precision * recall) / (precision + recall)) || 0;

  return { precision, recall, f1 };
}

const predicted = [{ product_id: '1' }, { product_id: '2' }, { product_id: '4' }];
const groundTruth = ['1', '2', '3'];

const metrics = evaluateRecallPrecision(predicted, groundTruth);
console.log('--- Evaluation Metrics ---');
console.log(`Precision: ${metrics.precision.toFixed(2)}`);
console.log(`Recall: ${metrics.recall.toFixed(2)}`);
console.log(`F1 Score: ${metrics.f1.toFixed(2)}`);

module.exports = { evaluateRecallPrecision };
