function updateConversationState(currentState, extractedFields, confidences) {
  const newState = { ...currentState };
  
  if (!newState.missing_information) newState.missing_information = [];
  if (!newState.preferences) newState.preferences = {};
  if (!newState.intent) newState.intent = {};
  if (!newState.intent.hard_constraints) newState.intent.hard_constraints = {};

  for (const [key, value] of Object.entries(extractedFields)) {
    const confidence = confidences[key] || 0;
    
    if (confidence >= 0.80) {
      if (['max_price', 'quantity', 'delivery_before'].includes(key)) {
        newState.intent.hard_constraints[key] = value;
      } else if (['category', 'brand', 'model', 'variant'].includes(key)) {
        newState.intent[key] = value;
      } else {
        newState.preferences[key] = value;
      }
      
      newState.missing_information = newState.missing_information.filter(info => info !== key);
    } else if (confidence >= 0.55 && confidence < 0.80) {
      if (['max_price', 'quantity', 'authorization', 'delivery_address'].includes(key)) {
        if (!newState.missing_information.includes(key)) {
          newState.missing_information.push(key);
        }
      }
    }
  }
  
  return newState;
}

function evaluateWhatIfScenario(currentState, whatIfConstraints, rerankFn, candidates) {
  const simulatedIntent = {
    ...currentState.intent,
    hard_constraints: {
      ...currentState.intent?.hard_constraints,
      ...whatIfConstraints
    }
  };
  
  return rerankFn(candidates, simulatedIntent, currentState.preferences);
}

module.exports = { updateConversationState, evaluateWhatIfScenario };
