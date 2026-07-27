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
  store_name: "Smoking Pods",
  store_slug: "smoking-pods",
  logo_url: null,
  favicon_url: null,
  primary_color: "#10b981",
  whatsapp_number: "",
  pix_key: "",
  pix_name: "",
  address: "",
  instagram_url: "",
  description: "",
};

const LOCAL_STORAGE_KEY = "store_config_fallback_v1";

// BroadcastChannel para sincronização instantânea com Admin
let broadcastChannel: BroadcastChannel | null = null;
try {
  if (typeof window !== "undefined" && "BroadcastChannel" in window) {
    broadcastChannel = new BroadcastChannel("store_config_channel");
  }
} catch (e) {
  console.warn("BroadcastChannel não suportado:", e);
}

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
  // 1. Tentar ler da tabela dedicada `store_config`
  try {
    const { data, error } = await supabase
      .from("store_config")
      .select("*")
      .limit(1);

    if (!error && data && data.length > 0) {
      cachedConfig = data[0] as StoreConfig;
      try { localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(cachedConfig)); } catch {}
      notifyListeners();
      return cachedConfig;
    }
  } catch (e) {
    console.warn("Tabela store_config não acessível no frontend:", e);
  }

  // 2. Fallback: Ler do registro especial `__STORE_CONFIG__` na tabela `smoking_products`
  try {
    const { data, error } = await supabase
      .from("smoking_products")
      .select("*")
      .eq("brand", "__STORE_CONFIG__")
      .limit(1);

    if (!error && data && data.length > 0) {
      const row = data[0];
      let parsedConfig: StoreConfig = { ...DEFAULT_CONFIG };
      if (row.flavor) {
        try {
          parsedConfig = { ...DEFAULT_CONFIG, ...JSON.parse(row.flavor) };
        } catch {
          parsedConfig.store_name = row.name || DEFAULT_CONFIG.store_name;
          parsedConfig.logo_url = row.image_url || null;
        }
      }
      cachedConfig = parsedConfig;
      try { localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(cachedConfig)); } catch {}
      notifyListeners();
      return cachedConfig;
    }
  } catch (e) {
    console.warn("Fallback smoking_products indisponível no frontend:", e);
  }

  // 3. Fallback final: localStorage local
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

    // Ouve atualizações via BroadcastChannel (Admin -> Frontend)
    if (broadcastChannel) {
      const handleBroadcast = (e: MessageEvent) => {
        if (e.data && typeof e.data === "object") {
          cachedConfig = e.data as StoreConfig;
          setConfig(cachedConfig);
          try { localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(cachedConfig)); } catch {}
        }
      };
      broadcastChannel.addEventListener("message", handleBroadcast);
    }

    // Supabase Realtime postgres_changes subscription!
    const channel = supabase
      .channel("frontend-store-config-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "store_config" },
        () => { fetchConfig().then(result => setConfig(result)); }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "smoking_products" },
        () => { fetchConfig().then(result => setConfig(result)); }
      )
      .subscribe();

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

    // Polling de 2s para garantia absoluta
    const intervalId = setInterval(() => {
      fetchConfig().then(result => setConfig(result));
    }, 2000);

    return () => {
      listeners.delete(onUpdate);
      clearInterval(intervalId);
      supabase.removeChannel(channel);
    };
  }, []);

  return { config, loading };
}
