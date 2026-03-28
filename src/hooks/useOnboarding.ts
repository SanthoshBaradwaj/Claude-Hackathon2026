import { useReducer } from 'react';

export type StringField =
  | 'ageBand'
  | 'gender'
  | 'pronouns'
  | 'occupation'
  | 'educationLevel'
  | 'location';

export interface OnboardingState {
  step: number;
  direction: 1 | -1;
  ageBand: string;
  gender: string;
  pronouns: string;
  occupation: string;
  educationLevel: string;
  location: string;
  categories: string[];
}

type Action =
  | { type: 'SET_FIELD'; field: StringField; value: string }
  | { type: 'TOGGLE_CATEGORY'; category: string }
  | { type: 'NEXT' }
  | { type: 'BACK' };

const TOTAL_STEPS = 6; // 0–5

function reducer(state: OnboardingState, action: Action): OnboardingState {
  switch (action.type) {
    case 'SET_FIELD':
      return { ...state, [action.field]: action.value };
    case 'TOGGLE_CATEGORY': {
      const cats = state.categories.includes(action.category)
        ? state.categories.filter((c) => c !== action.category)
        : [...state.categories, action.category];
      return { ...state, categories: cats };
    }
    case 'NEXT':
      return state.step < TOTAL_STEPS - 1
        ? { ...state, step: state.step + 1, direction: 1 }
        : state;
    case 'BACK':
      return state.step > 0
        ? { ...state, step: state.step - 1, direction: -1 }
        : state;
  }
}

const initialState: OnboardingState = {
  step: 0,
  direction: 1,
  ageBand: '',
  gender: '',
  pronouns: '',
  occupation: '',
  educationLevel: '',
  location: '',
  categories: [],
};

export function useOnboarding() {
  const [state, dispatch] = useReducer(reducer, initialState);
  return {
    state,
    setField: (field: StringField, value: string) =>
      dispatch({ type: 'SET_FIELD', field, value }),
    toggleCategory: (category: string) =>
      dispatch({ type: 'TOGGLE_CATEGORY', category }),
    next: () => dispatch({ type: 'NEXT' }),
    back: () => dispatch({ type: 'BACK' }),
  };
}
