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
  created_at: string;
  updated_at: string;
}

const DEFAULT_CONFIG: Omit<StoreConfig, "id" | "created_at" | "updated_at"> = {
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
  description: "",
};

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
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle");

  useEffect(() => {
    // Registrar listener para atualizações do cache global
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

  const updateConfig = useCallback(
    async (updates: Partial<Omit<StoreConfig, "id" | "created_at" | "updated_at">>) => {
      if (!config) return;
      setSaving(true);
      setSaveStatus("idle");

      const { data, error } = await supabase
        .from("store_config")
        .update(updates)
        .eq("id", config.id)
        .select()
        .single();

      if (error) {
        console.error("Erro ao salvar configurações:", error.message);
        setSaveStatus("error");
        setSaving(false);
        return false;
      }

      cachedConfig = data as StoreConfig;
      setConfig(cachedConfig);
      notifyListeners();
      setSaveStatus("success");
      setSaving(false);

      // Reset status após 3 segundos
      setTimeout(() => setSaveStatus("idle"), 3000);
      return true;
    },
    [config]
  );

  const uploadLogo = useCallback(
    async (file: File): Promise<string | null> => {
      const ext = file.name.split(".").pop() || "png";
      const filePath = `logo/logo_${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("store-assets")
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        console.error("Erro no upload do logo:", uploadError.message);
        return null;
      }

      const { data } = supabase.storage.from("store-assets").getPublicUrl(filePath);
      return data.publicUrl;
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
    config: config || (DEFAULT_CONFIG as unknown as StoreConfig),
    loading,
    saving,
    saveStatus,
    updateConfig,
    uploadLogo,
    refreshConfig,
  };
}
