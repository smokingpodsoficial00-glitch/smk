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
  description: "Painel ERP & Catálogo Digital",
};

const LOCAL_STORAGE_KEY = "store_config_fallback_v1";

// Tenta carregar do localStorage no startup
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

// Cache global em memória
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
      saveLocalFallback(cachedConfig);
      notifyListeners();
      return cachedConfig;
    }
  } catch (e) {
    console.warn("Supabase store_config não acessível, usando fallback local:", e);
  }

  // Fallback se o Supabase falhar/tabela não existir
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

      // 1. Atualizar localStorage & estado local imediatamente
      saveLocalFallback(newConfig);
      cachedConfig = newConfig;
      setConfig(newConfig);
      notifyListeners();

      // 2. Tentar sincronizar com Supabase se a tabela existir
      try {
        let resData = null;
        if (config.id && config.id !== "local-config-id") {
          const { data, error } = await supabase
            .from("store_config")
            .update(updates)
            .eq("id", config.id)
            .select()
            .single();

          if (!error && data) resData = data;
        } else {
          // Tenta upsert se for local
          const { data, error } = await supabase
            .from("store_config")
            .upsert([updates])
            .select()
            .single();

          if (!error && data) resData = data;
        }

        if (resData) {
          cachedConfig = resData as StoreConfig;
          saveLocalFallback(cachedConfig);
          setConfig(cachedConfig);
          notifyListeners();
        }
      } catch (e) {
        console.info("Salvo apenas localmente (Supabase indisponível):", e);
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
      // 1. Tentar upload no Supabase Storage
      try {
        const ext = file.name.split(".").pop() || "png";
        const filePath = `logo/logo_${Date.now()}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from("store-assets")
          .upload(filePath, file, { upsert: true });

        if (!uploadError) {
          const { data } = supabase.storage.from("store-assets").getPublicUrl(filePath);
          if (data?.publicUrl) return data.publicUrl;
        }
      } catch (e) {
        console.warn("Upload Supabase indisponível, convertendo para Base64 local:", e);
      }

      // 2. Fallback: Converte imagem para Base64 se o bucket do Supabase ainda não existir
      return new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          resolve(reader.result as string);
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
