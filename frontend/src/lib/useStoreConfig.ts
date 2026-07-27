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

const DEFAULT_CONFIG: StoreConfig = {
  id: "local-config-id",
  store_name: "Minha Loja",
  store_slug: "minha-loja",
  logo_url: null,
  favicon_url: null,
  primary_color: "#8b5cf6",
  whatsapp_number: "",
  pix_key: "",
  pix_name: "",
  address: "",
  instagram_url: "",
  description: "Pedido finalizado em segundos pelo WhatsApp.",
};

const LOCAL_STORAGE_KEY = "store_config_fallback_v1";

function getLocalFallback(): StoreConfig {
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch (e) {
    console.warn("Erro ao ler localStorage no frontend:", e);
  }
  return DEFAULT_CONFIG;
}

let cachedConfig: StoreConfig | null = null;
let fetchPromise: Promise<StoreConfig> | null = null;
const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((fn) => fn());
}

async function fetchConfig(): Promise<StoreConfig> {
  try {
    const { data, error } = await supabase
      .from("store_config")
      .select("*")
      .limit(1)
      .single();

    if (!error && data) {
      cachedConfig = data as StoreConfig;
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(cachedConfig));
      } catch {}
      notifyListeners();
      return cachedConfig;
    }
  } catch (e) {
    console.warn("Supabase store_config não acessível no frontend, usando local:", e);
  }

  cachedConfig = getLocalFallback();
  notifyListeners();
  return cachedConfig;
}

export function useStoreConfig() {
  const [config, setConfig] = useState<StoreConfig>(cachedConfig || getLocalFallback());
  const [loading, setLoading] = useState(!cachedConfig);

  useEffect(() => {
    const onUpdate = () => {
      if (cachedConfig) setConfig(cachedConfig);
    };
    listeners.add(onUpdate);

    // Ouve alterações no localStorage em outras abas (Admin -> Frontend)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === LOCAL_STORAGE_KEY && e.newValue) {
        try {
          cachedConfig = JSON.parse(e.newValue);
          notifyListeners();
        } catch {}
      }
    };
    window.addEventListener("storage", handleStorageChange);

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
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  return { config, loading };
}
