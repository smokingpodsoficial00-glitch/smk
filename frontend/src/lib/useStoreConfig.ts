import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { getCatalogCompanyId } from "@/lib/products";

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

const LOCAL_STORAGE_KEY = "store_config_fallback_v4";

let broadcastChannel: BroadcastChannel | null = null;
try {
  if (typeof window !== "undefined" && "BroadcastChannel" in window) {
    broadcastChannel = new BroadcastChannel("store_config_channel_v4");
  }
} catch (e) {
  console.warn("BroadcastChannel não disponível:", e);
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
  let mainConfig: StoreConfig | null = null;
  let fallbackConfig: StoreConfig | null = null;

  // 1. Tentar ler da tabela dedicada `store_config` filtrado pela empresa atual
  try {
    const companyId = getCatalogCompanyId();
    const { data, error } = await supabase
      .from("store_config")
      .select("*")
      .eq("company_id", companyId)
      .maybeSingle();

    if (!error && data) {
      mainConfig = data as StoreConfig;
    }
  } catch (e) {
    console.warn("Tabela store_config não acessível no frontend:", e);
  }

  // 2. Tentar ler da tabela `smoking_products` (__STORE_CONFIG__)
  try {
    const { data, error } = await supabase
      .from("smoking_products")
      .select("*")
      .eq("brand", "__STORE_CONFIG__")
      .limit(1);

    if (!error && data && data.length > 0) {
      const row = data[0];
      if (row.flavor) {
        try {
          fallbackConfig = JSON.parse(row.flavor);
        } catch {}
      }
      if (!fallbackConfig) {
        fallbackConfig = {
          ...DEFAULT_CONFIG,
          store_name: row.name || DEFAULT_CONFIG.store_name,
          logo_url: row.image_url || null,
        };
      } else if (row.image_url && !fallbackConfig.logo_url) {
        fallbackConfig.logo_url = row.image_url;
      }
    }
  } catch (e) {
    console.warn("Fallback smoking_products não acessível no frontend:", e);
  }

  // 3. Tentar ler da tabela `companies`
  try {
    const { data: compData } = await supabase
      .from("companies")
      .select("name, logo_url")
      .limit(1)
      .maybeSingle();

    if (compData && compData.name) {
      if (mainConfig) mainConfig.store_name = compData.name;
      if (fallbackConfig) fallbackConfig.store_name = compData.name;
    }
  } catch (e) {}

  // Combina as fontes
  let local = getLocalFallback();
  let finalConfig: StoreConfig = mainConfig || fallbackConfig || local;

  const bestLogo = mainConfig?.logo_url || fallbackConfig?.logo_url || local.logo_url;
  if (bestLogo) {
    finalConfig.logo_url = bestLogo;
  }

  cachedConfig = finalConfig;
  try { localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(cachedConfig)); } catch {}
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

    let channel: any = null;
    try {
      channel = supabase
        .channel(`front-cfg-${Math.random().toString(36).substring(2, 7)}`)
        .on(
          "postgres_changes" as any,
          { event: "*", schema: "public", table: "store_config" },
          () => { fetchConfig().then(result => setConfig(result)); }
        )
        .on(
          "postgres_changes" as any,
          { event: "*", schema: "public", table: "smoking_products" },
          () => { fetchConfig().then(result => setConfig(result)); }
        );

      channel.subscribe();
    } catch (e) {
      console.warn("Erro ao registrar Supabase Realtime no frontend:", e);
    }

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

    // Polling a cada 2s
    const intervalId = setInterval(() => {
      fetchConfig().then(result => setConfig(result));
    }, 2000);

    return () => {
      listeners.delete(onUpdate);
      clearInterval(intervalId);
      if (channel) {
        try { supabase.removeChannel(channel); } catch {}
      }
    };
  }, []);

  return { config, loading };
}
