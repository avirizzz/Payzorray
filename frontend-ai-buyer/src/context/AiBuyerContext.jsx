import { createContext, useContext } from 'react';
import { useAiBuyerConversation } from '../hooks/useAiBuyerConversation';

const AiBuyerContext = createContext(null);

export function AiBuyerProvider({ children }) {
  const value = useAiBuyerConversation();
  return <AiBuyerContext.Provider value={value}>{children}</AiBuyerContext.Provider>;
}

export function useAiBuyer() {
  const ctx = useContext(AiBuyerContext);
  if (!ctx) throw new Error('useAiBuyer must be used within an AiBuyerProvider');
  return ctx;
}
