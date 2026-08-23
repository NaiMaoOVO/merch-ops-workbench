export const TUTORIAL_STORAGE_KEY = 'merch-studio:tutorial-progress:v1';

const uniqueIds = (value) => (
  Array.isArray(value)
    ? [...new Set(value.filter((item) => typeof item === 'string' && item.trim()))]
    : []
);

export function createTutorialState(input = {}) {
  return {
    completedSteps: uniqueIds(input.completedSteps),
    completedExercises: uniqueIds(input.completedExercises),
    dismissedIntro: input.dismissedIntro === true,
  };
}

export function markStepComplete(state, stepId) {
  const next = createTutorialState(state);
  if (typeof stepId !== 'string' || !stepId.trim()) return next;
  next.completedSteps = uniqueIds([...next.completedSteps, stepId]);
  return next;
}

export function markExerciseComplete(state, exerciseId) {
  const next = createTutorialState(state);
  if (typeof exerciseId !== 'string' || !exerciseId.trim()) return next;
  next.completedExercises = uniqueIds([...next.completedExercises, exerciseId]);
  return next;
}

export function dismissIntro(state) {
  return { ...createTutorialState(state), dismissedIntro: true };
}

export function resetTutorialProgress() {
  return createTutorialState();
}

export function getTutorialProgress(state, { stepCount = 0, exerciseCount = 0 } = {}) {
  const total = Math.max(0, stepCount) + Math.max(0, exerciseCount);
  if (!total) return 0;
  const completed = Math.min(stepCount, state.completedSteps.length)
    + Math.min(exerciseCount, state.completedExercises.length);
  return completed / total;
}

export function loadTutorialState(storage = globalThis.localStorage) {
  try {
    if (!storage?.getItem) return createTutorialState();
    return createTutorialState(JSON.parse(storage.getItem(TUTORIAL_STORAGE_KEY) || '{}'));
  } catch {
    return createTutorialState();
  }
}

export function saveTutorialState(state, storage = globalThis.localStorage) {
  try {
    storage?.setItem?.(TUTORIAL_STORAGE_KEY, JSON.stringify(createTutorialState(state)));
  } catch {
    // Storage can be unavailable in private browsing or embedded previews.
  }
}
