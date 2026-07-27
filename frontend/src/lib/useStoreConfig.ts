import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export interface StoreConfig {
  id: string;
  store_name: string;
  store_slug: string;
  logo_url: string | null;
  favicon_url: string | null;
  primary_color: string;
  whatsapp_number: string;
  pix_key: string;
  pix_name: string;
  address: string;
  instagram_url: string;
  description: string;
}

// Cache global para evitar múltiplas requisições
let cachedConfig: StoreConfig | null = null;
let fetchPromise: Promise<StoreConfig | null> | null = null;
const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((fn) => fn());
}

async function fetchConfig(): Promise<StoreConfig | null> {
  const { data, error } = await supabase
    .from("store_config")
    .select("*")
    .limit(1)
    .single();

  if (error) {
    console.warn("Erro ao buscar store_config:", error.message);
    return null;
  }
  cachedConfig = data as StoreConfig;
  notifyListeners();
  return cachedConfig;
}

export function useStoreConfig() {
  const [config, setConfig] = useState<StoreConfig | null>(cachedConfig);
  const [loading, setLoading] = useState(!cachedConfig);

  useEffect(() => {
    const onUpdate = () => setConfig(cachedConfig);
    listeners.add(onUpdate);

    if (cachedConfig) {
      setConfig(cachedConfig);
      setLoading(false);
    } else {
      if (!fetchPromise) {
        fetchPromise = fetchConfig().finally(() => {
          fetchPromise = null;
        });
      }
      fetchPromise.then((result) => {
        setConfig(result);
        setLoading(false);
      });
    }

    return () => {
      listeners.delete(onUpdate);
    };
  }, []);

  return { config, loading };
}
