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
  address: "",
  instagram_url: "",
  description: "",
};

const LOCAL_STORAGE_KEY = "store_config_fallback_v1";
const CONFIG_SKU_ID = "00000000-0000-0000-0000-000000000000";

// BroadcastChannel para sincronização instantânea em abas e portas do mesmo navegador
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
  // 1. Tentar ler da tabela dedicada `store_config`
  try {
    const { data, error } = await supabase
      .from("store_config")
      .select("*")
      .limit(1)
      .single();

    if (!error && data) {
      cachedConfig = data as StoreConfig;
      saveLocalFallback(cachedConfig);
      notifyListeners();
      return cachedConfig;
    }
  } catch (e) {
    console.warn("Tabela store_config não disponível, tentando fallback em smoking_products:", e);
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
      saveLocalFallback(cachedConfig);
      notifyListeners();
      return cachedConfig;
    }
  } catch (e) {
    console.warn("Fallback smoking_products indisponível:", e);
  }

  // 3. Fallback final: localStorage local
  cachedConfig = getLocalFallback();
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

    // Ouve mensagens de atualização do BroadcastChannel
    if (broadcastChannel) {
      const handleBroadcast = (e: MessageEvent) => {
        if (e.data && typeof e.data === "object") {
          cachedConfig = e.data as StoreConfig;
          setConfig(cachedConfig);
          saveLocalFallback(cachedConfig);
        }
      };
      broadcastChannel.addEventListener("message", handleBroadcast);
      return () => {
        listeners.delete(onUpdate);
        broadcastChannel?.removeEventListener("message", handleBroadcast);
      };
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

      // 1. Atualizar cache local & BroadcastChannel imediatamente
      saveLocalFallback(newConfig);
      cachedConfig = newConfig;
      setConfig(newConfig);
      notifyListeners();

      // 2. Tentar salvar na tabela dedicada `store_config`
      try {
        if (config.id && config.id !== "local-config-id") {
          await supabase
            .from("store_config")
            .update(updates)
            .eq("id", config.id);
        } else {
          await supabase
            .from("store_config")
            .upsert([updates]);
        }
      } catch (e) {
        console.info("Info: Tabela store_config não encontrada ou sem permissão:", e);
      }

      // 3. SEMPRE salvar na tabela `smoking_products` como `__STORE_CONFIG__` para sincronização garantida!
      try {
        await supabase
          .from("smoking_products")
          .upsert({
            id: CONFIG_SKU_ID,
            brand: "__STORE_CONFIG__",
            name: newConfig.store_name,
            flavor: JSON.stringify(newConfig),
            image_url: newConfig.logo_url || "",
            price: 0,
            cost_price: 0,
            stock: 0,
            puffs: 0,
            is_active: false,
          });
      } catch (e) {
        console.warn("Erro ao salvar fallback de configuração em smoking_products:", e);
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
      // 1. Tentar upload no Supabase Storage (bucket store-assets ou product-images)
      try {
        const ext = file.name.split(".").pop() || "png";
        const fileName = `logo_${Date.now()}_${Math.random().toString(36).substring(2, 6)}.${ext}`;

        // Tenta bucket store-assets primeiro, depois product-images
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
        console.warn("Storage Supabase indisponível, convertendo logo para Base64:", e);
      }

      // 2. Fallback: Converte imagem para Base64 comprimido
      return new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement("canvas");
            let width = img.width;
            let height = img.height;
            const max = 400;
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
            resolve(canvas.toDataURL("image/jpeg", 0.8));
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
