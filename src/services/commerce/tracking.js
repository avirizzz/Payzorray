const STAGES = ['CONFIRMED', 'PACKED', 'SHIPPED', 'DELIVERED'];
const STAGE_THRESHOLDS_MIN = [0, 2, 8, 20];

function getTrackingStage(createdAt) {
  const minutesElapsed = (Date.now() - new Date(createdAt).getTime()) / 60000;
  let idx = 0;
  for (let i = STAGE_THRESHOLDS_MIN.length - 1; i >= 0; i--) {
    if (minutesElapsed >= STAGE_THRESHOLDS_MIN[i]) {
      idx = i;
      break;
    }
  }
  return STAGES[idx];
}

module.exports = { getTrackingStage, STAGES };
