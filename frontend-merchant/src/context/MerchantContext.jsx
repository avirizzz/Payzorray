import { createContext, useContext, useState } from 'react';

const STORAGE_KEY = 'shopitforme_merchant_id';

const MerchantContext = createContext(null);

// No real auth exists; this is a deliberate scope decision.
export function MerchantProvider({ children }) {
  const [merchantId, setMerchantIdState] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) || null;
    } catch {
      return null;
    }
  });

  function setMerchantId(id) {
    setMerchantIdState(id);
    try {
      if (id) localStorage.setItem(STORAGE_KEY, id);
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore: still works via React state
    }
  }

  return <MerchantContext.Provider value={{ merchantId, setMerchantId }}>{children}</MerchantContext.Provider>;
}

export function useMerchant() {
  const ctx = useContext(MerchantContext);
  if (!ctx) throw new Error('useMerchant must be used within a MerchantProvider');
  return ctx;
}
