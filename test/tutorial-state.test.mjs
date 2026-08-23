import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TUTORIAL_STORAGE_KEY,
  createTutorialState,
  getTutorialProgress,
  markExerciseComplete,
  markStepComplete,
  loadTutorialState,
  saveTutorialState,
  resetTutorialProgress,
} from '../src/features/tutorial/tutorialState.js';

test('creates a stable empty tutorial state', () => {
  assert.deepEqual(createTutorialState(), {
    completedSteps: [],
    completedExercises: [],
    dismissedIntro: false,
  });
});

test('marks steps and exercises idempotently', () => {
  const first = markStepComplete(createTutorialState(), 'quick-start-1');
  const second = markStepComplete(first, 'quick-start-1');
  const third = markExerciseComplete(second, 'exercise-2');

  assert.deepEqual(third.completedSteps, ['quick-start-1']);
  assert.deepEqual(third.completedExercises, ['exercise-2']);
  assert.equal(getTutorialProgress(third, { stepCount: 5, exerciseCount: 7 }), 2 / 12);
});

test('ignores invalid ids and keeps state immutable', () => {
  const state = createTutorialState({ completedSteps: ['quick-start-1'] });
  const next = markStepComplete(state, '');
  assert.deepEqual(next, state);
  assert.notEqual(next, state);
});

test('persists only the tutorial payload and tolerates malformed storage', () => {
  const storage = new Map();
  storage.setItem = (key, value) => storage.set(key, value);
  storage.getItem = (key) => storage.get(key) ?? null;
  storage.removeItem = (key) => storage.delete(key);

  const state = markExerciseComplete(createTutorialState(), 'exercise-1');
  saveTutorialState(state, storage);
  assert.equal(storage.has(TUTORIAL_STORAGE_KEY), true);
  assert.deepEqual(loadTutorialState(storage), state);

  storage.set(TUTORIAL_STORAGE_KEY, '{not-json');
  assert.deepEqual(loadTutorialState(storage), createTutorialState());
});

test('reset clears progress without changing the original state', () => {
  const state = markStepComplete(createTutorialState(), 'quick-start-2');
  const reset = resetTutorialProgress(state);
  assert.deepEqual(reset, createTutorialState());
  assert.deepEqual(state.completedSteps, ['quick-start-2']);
});
