import { useState, useEffect, useCallback } from "react";
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
  origin_cep?: string;
  base_fare?: number;
  included_km?: number;
  extra_km_fee?: number;
  instagram_url: string;
  description: string;
  created_at?: string;
  updated_at?: string;
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
  address: "Rua Alexandra Lunardi Fanani, 57 - Assunção, São Bernardo do Campo - SP, 09810-200",
  origin_cep: "09810-200",
  base_fare: 8.50,
  included_km: 3.0,
  extra_km_fee: 1.40,
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
    console.warn("Erro ao ler localStorage:", e);
  }
  return DEFAULT_CONFIG;
}

function saveLocalFallback(cfg: StoreConfig) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(cfg));
  } catch (e) {
    console.warn("Erro ao salvar localStorage:", e);
  }
}

let cachedConfig: StoreConfig | null = null;
let fetchPromise: Promise<StoreConfig> | null = null;
const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((fn) => fn());
  if (broadcastChannel && cachedConfig) {
    try {
      broadcastChannel.postMessage(cachedConfig);
    } catch {}
  }
}

async function fetchConfig(): Promise<StoreConfig> {
  let mainConfig: StoreConfig | null = null;
  let fallbackConfig: StoreConfig | null = null;

  // 1. Tentar ler da tabela dedicada `store_config` no Supabase (se existir)
  try {
    const { data, error } = await supabase
      .from("store_config")
      .select("*")
      .limit(1);

    if (!error && data && data.length > 0) {
      mainConfig = data[0] as StoreConfig;
    }
  } catch (e) {
    console.warn("Tabela store_config não acessível:", e);
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
    console.warn("Fallback smoking_products não acessível:", e);
  }

  // Combina as fontes
  let local = getLocalFallback();
  let finalConfig: StoreConfig = mainConfig || fallbackConfig || local;

  const bestLogo = mainConfig?.logo_url || fallbackConfig?.logo_url || local.logo_url;
  if (bestLogo) {
    finalConfig.logo_url = bestLogo;
  }

  cachedConfig = finalConfig;
  saveLocalFallback(cachedConfig);
  notifyListeners();
  return cachedConfig;
}

export function useStoreConfig() {
  const [config, setConfig] = useState<StoreConfig>(cachedConfig || getLocalFallback());
  const [loading, setLoading] = useState(!cachedConfig);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle");

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
          saveLocalFallback(cachedConfig);
        }
      };
      broadcastChannel.addEventListener("message", handleBroadcast);
    }

    let channel: any = null;
    try {
      channel = supabase
        .channel(`admin-cfg-${Math.random().toString(36).substring(2, 7)}`)
        .on(
          "postgres_changes" as any,
          { event: "*", schema: "public", table: "store_config" },
          () => { fetchConfig().then(cfg => setConfig(cfg)); }
        )
        .on(
          "postgres_changes" as any,
          { event: "*", schema: "public", table: "smoking_products" },
          () => { fetchConfig().then(cfg => setConfig(cfg)); }
        );

      channel.subscribe();
    } catch (e) {
      console.warn("Realtime error:", e);
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

    return () => {
      listeners.delete(onUpdate);
      if (channel) {
        try { supabase.removeChannel(channel); } catch {}
      }
    };
  }, []);

  const updateConfig = useCallback(
    async (updates: Partial<Omit<StoreConfig, "created_at" | "updated_at">>) => {
      setSaving(true);
      setSaveStatus("idle");

      const newConfig: StoreConfig = {
        ...config,
        ...updates,
        updated_at: new Date().toISOString(),
      };

      // 1. Atualiza cache local e BroadcastChannel
      saveLocalFallback(newConfig);
      cachedConfig = newConfig;
      setConfig(newConfig);
      notifyListeners();

      // 2. Salva na tabela dedicada `store_config` no Supabase
      try {
        const { data: existingRows } = await supabase
          .from("store_config")
          .select("id")
          .limit(1);

        if (existingRows && existingRows.length > 0) {
          await supabase
            .from("store_config")
            .update(updates)
            .eq("id", existingRows[0].id);
        } else {
          await supabase
            .from("store_config")
            .insert([updates]);
        }
      } catch (e) {
        console.info("Tabela store_config não encontrada:", e);
      }

      // 3. Salva na tabela `smoking_products` sob `brand: '__STORE_CONFIG__'` (sem cost_price)
      try {
        const { data: configProducts } = await supabase
          .from("smoking_products")
          .select("id")
          .eq("brand", "__STORE_CONFIG__")
          .limit(1);

        if (configProducts && configProducts.length > 0) {
          await supabase
            .from("smoking_products")
            .update({
              name: newConfig.store_name,
              flavor: JSON.stringify(newConfig),
              image_url: newConfig.logo_url || "",
              is_active: false,
            })
            .eq("id", configProducts[0].id);
        } else {
          await supabase
            .from("smoking_products")
            .insert({
              brand: "__STORE_CONFIG__",
              name: newConfig.store_name,
              flavor: JSON.stringify(newConfig),
              image_url: newConfig.logo_url || "",
              price: 0,
              stock: 0,
              puffs: 0,
              is_active: false,
            });
        }
      } catch (e) {
        console.warn("Erro no fallback smoking_products:", e);
      }

      setSaveStatus("success");
      setSaving(false);
      setTimeout(() => setSaveStatus("idle"), 3000);
      return true;
    },
    [config]
  );

  const uploadLogo = useCallback(
    async (file: File): Promise<string | null> => {
      try {
        const ext = file.name.split(".").pop() || "png";
        const fileName = `logo_${Date.now()}.${ext}`;

        let bucketName = "store-assets";
        let uploadRes = await supabase.storage.from(bucketName).upload(`logo/${fileName}`, file, { upsert: true });

        if (uploadRes.error) {
          bucketName = "product-images";
          uploadRes = await supabase.storage.from(bucketName).upload(`logo/${fileName}`, file, { upsert: true });
        }

        if (!uploadRes.error) {
          const { data } = supabase.storage.from(bucketName).getPublicUrl(`logo/${fileName}`);
          if (data?.publicUrl) return data.publicUrl;
        }
      } catch (e) {
        console.warn("Supabase Storage indisponível, convertendo para Base64 leve:", e);
      }

      return new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement("canvas");
            let width = img.width;
            let height = img.height;
            const max = 250;
            if (width > max || height > max) {
              if (width > height) {
                height = Math.round((height * max) / width);
                width = max;
              } else {
                width = Math.round((width * max) / height);
                height = max;
              }
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d");
            ctx?.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL("image/png", 0.8));
          };
          img.src = reader.result as string;
        };
        reader.readAsDataURL(file);
      });
    },
    []
  );

  const refreshConfig = useCallback(async () => {
    setLoading(true);
    const result = await fetchConfig();
    setConfig(result);
    setLoading(false);
  }, []);

  return {
    config,
    loading,
    saving,
    saveStatus,
    updateConfig,
    uploadLogo,
    refreshConfig,
  };
}
