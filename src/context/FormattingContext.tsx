import React, { createContext, useContext, useReducer, ReactNode } from 'react';

export const DEFAULT_STYLE = {
  fontFamily: '"Calibri", "Open Sans", "Helvetica", "Roboto", "Arial", sans-serif',
  fontSize: 11,
  lineHeight: 1.4,
  letterSpacing: 0,
  padding: 8,
  margin: 10,
  color: '#000000',
};

interface FormattingState {
  activeSection: string | null;
  styles: Record<string, any>;
}

type FormattingAction =
  | { type: 'SET_ACTIVE_SECTION'; sectionId: string | null }
  | { type: 'UPDATE_STYLE'; sectionId: string; style: any }
  | { type: 'SET_ALL_STYLES'; styles: Record<string, any> }
  | { type: 'RESET_STYLE'; sectionId: string | null };

const initialState: FormattingState = {
  activeSection: null,
  styles: {},
};

function formattingReducer(state: FormattingState, action: FormattingAction): FormattingState {
  switch (action.type) {
    case 'SET_ACTIVE_SECTION':
      return { ...state, activeSection: action.sectionId };
    case 'UPDATE_STYLE':
      return {
        ...state,
        styles: {
          ...state.styles,
          [action.sectionId]: { ...state.styles[action.sectionId], ...action.style },
        },
      };
    case 'SET_ALL_STYLES':
      return {
        ...state,
        styles: action.styles,
      };
    case 'RESET_STYLE':
      if (action.sectionId) {
        return {
          ...state,
          styles: {
            ...state.styles,
            [action.sectionId]: { ...DEFAULT_STYLE },
          },
        };
      } else {
        return {
          ...state,
          styles: {},
        };
      }
    default:
      return state;
  }
}

const FormattingContext = createContext<{
  state: FormattingState;
  dispatch: React.Dispatch<FormattingAction>;
} | undefined>(undefined);

export function FormattingProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(formattingReducer, initialState);

  return (
    <FormattingContext.Provider value={{ state, dispatch }}>
      {children}
    </FormattingContext.Provider>
  );
}

export function useFormatting() {
  const context = useContext(FormattingContext);
  if (context === undefined) {
    throw new Error('useFormatting must be used within a FormattingProvider');
  }
  return context;
}
