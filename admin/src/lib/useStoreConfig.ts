import { useState, useEffect, useCallback } from "react";
import { validateAndNormalizeBrazilianPhone } from "@/lib/phoneUtils";
import { useAuth } from "@/contexts/AuthContext";

export const OFFICIAL_SMOKING_PODS_COMPANY_ID = "d7e1c479-32b4-40b8-b2d7-42fe4db1f8b5";

// Supabase é carregado sob demanda para habilitar code-splitting
let _sb: any = null;
async function getSupabase() {
  if (!_sb) {
    const { supabase } = await import("@/lib/supabase");
    _sb = supabase;
  }
  return _sb;
}

export interface StoreConfig {
  id: string;
  company_id?: string;
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

const DEFAULT_SMOKING_PODS_CONFIG: StoreConfig = {
  id: "local-config-smoking-pods",
  company_id: OFFICIAL_SMOKING_PODS_COMPANY_ID,
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

function getDefaultConfigForCompany(companyId: string, companyName?: string): StoreConfig {
  if (companyId === OFFICIAL_SMOKING_PODS_COMPANY_ID) {
    return { ...DEFAULT_SMOKING_PODS_CONFIG };
  }
  const name = companyName || "Minha Loja";
  return {
    ...DEFAULT_SMOKING_PODS_CONFIG,
    id: `local-config-${companyId}`,
    company_id: companyId,
    store_name: name,
    store_slug: name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "") || "minha-loja",
    address: "",
  };
}

const getStorageKey = (companyId: string) => `store_config_v5_${companyId}`;

// Limpeza de chave legada não escopada que causava contaminação cruzada
if (typeof window !== "undefined") {
  try {
    localStorage.removeItem("store_config_fallback_v4");
  } catch {}
}

// Cache em memória multi-tenant isolado por ID da empresa
const cachedConfigs = new Map<string, StoreConfig>();
const listeners = new Set<(companyId?: string) => void>();

export function resetStoreConfigCache() {
  cachedConfigs.clear();
  if (typeof window !== "undefined") {
    try {
      localStorage.removeItem("store_config_fallback_v4");
    } catch {}
  }
}

function notifyListeners(companyId?: string) {
  listeners.forEach((fn) => fn(companyId));
}

function getLocalFallback(companyId: string, companyName?: string): StoreConfig {
  try {
    const saved = localStorage.getItem(getStorageKey(companyId));
    if (saved) {
      const parsed = JSON.parse(saved);
      // Blindagem absoluta da loja principal Smoking Pods
      if (companyId === OFFICIAL_SMOKING_PODS_COMPANY_ID) {
        parsed.store_name = "Smoking Pods";
        parsed.store_slug = "smoking-pods";
      } else if (companyName) {
        parsed.store_name = companyName;
      }
      return parsed;
    }
  } catch (e) {
    console.warn("Erro ao ler localStorage:", e);
  }
  return getDefaultConfigForCompany(companyId, companyName);
}

function saveLocalFallback(companyId: string, cfg: StoreConfig) {
  try {
    localStorage.setItem(getStorageKey(companyId), JSON.stringify(cfg));
  } catch (e) {
    console.warn("Erro ao salvar localStorage:", e);
  }
}

export async function fetchStoreConfig(targetCompanyId?: string, targetCompanyName?: string): Promise<StoreConfig> {
  const supabase = await getSupabase();
  const companyId = targetCompanyId || (typeof window !== 'undefined' ? localStorage.getItem('smk_auth_company_id') : null) || OFFICIAL_SMOKING_PODS_COMPANY_ID;
  
  let mainConfig: StoreConfig | null = null;

  // 1. Tentar ler da tabela dedicada `store_config` no Supabase filtrado estritamente por company_id
  try {
    const { data, error } = await supabase
      .from("store_config")
      .select("*")
      .eq("company_id", companyId)
      .maybeSingle();

    if (!error && data) {
      mainConfig = data as StoreConfig;
    }
  } catch (e) {
    console.warn("Tabela store_config não acessível:", e);
  }

  // 2. Tentar ler da tabela `companies` para garantir nome canônico no banco
  let companyCanonicalName = targetCompanyName;
  try {
    const { data: compData } = await supabase
      .from("companies")
      .select("name, logo_url, phone")
      .eq("id", companyId)
      .maybeSingle();

    if (compData && compData.name) {
      companyCanonicalName = compData.name;
    }
  } catch (e) {}

  // 3. Fallback seguro isolado por empresa
  const local = getLocalFallback(companyId, companyCanonicalName);
  let finalConfig: StoreConfig = mainConfig || local;

  // 🛡️ Blindagem estrita de identidade:
  if (companyId === OFFICIAL_SMOKING_PODS_COMPANY_ID) {
    finalConfig.store_name = "Smoking Pods";
    finalConfig.store_slug = "smoking-pods";
  } else if (companyCanonicalName) {
    finalConfig.store_name = companyCanonicalName;
  }

  finalConfig.company_id = companyId;

  // Atualiza cache específico desta empresa
  cachedConfigs.set(companyId, finalConfig);
  saveLocalFallback(companyId, finalConfig);
  notifyListeners(companyId);
  return finalConfig;
}

export function useStoreConfig(companyIdOverride?: string) {
  let authCompanyId: string | undefined;
  let authCompanyName: string | undefined;
  try {
    const auth = useAuth();
    authCompanyId = auth?.company?.id;
    authCompanyName = auth?.company?.name;
  } catch {}

  const activeCompanyId = companyIdOverride || authCompanyId || (typeof window !== "undefined" ? localStorage.getItem("smk_auth_company_id") : null) || OFFICIAL_SMOKING_PODS_COMPANY_ID;

  const [config, setConfig] = useState<StoreConfig>(() => {
    return cachedConfigs.get(activeCompanyId) || getLocalFallback(activeCompanyId, authCompanyName);
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle");

  useEffect(() => {
    let isMounted = true;

    // Resgata o cache da empresa ativa imediatamente
    const current = cachedConfigs.get(activeCompanyId) || getLocalFallback(activeCompanyId, authCompanyName);
    setConfig(current);

    // Carrega dados frescos do Supabase para esta empresa ativa
    setLoading(true);
    fetchStoreConfig(activeCompanyId, authCompanyName).then((result) => {
      if (isMounted) {
        setConfig(result);
        setLoading(false);
      }
    }).catch(() => {
      if (isMounted) setLoading(false);
    });

    // Listener isolado por companyId
    const onUpdate = (updatedCompanyId?: string) => {
      if (!updatedCompanyId || updatedCompanyId === activeCompanyId) {
        const fresh = cachedConfigs.get(activeCompanyId);
        if (fresh && isMounted) {
          setConfig(fresh);
        }
      }
    };
    listeners.add(onUpdate);

    return () => {
      isMounted = false;
      listeners.delete(onUpdate);
    };
  }, [activeCompanyId, authCompanyName]);

  const updateConfig = useCallback(
    async (updates: Partial<Omit<StoreConfig, "created_at" | "updated_at">>) => {
      setSaving(true);
      setSaveStatus("idle");

      const newConfig: StoreConfig = {
        ...config,
        ...updates,
        company_id: activeCompanyId,
        updated_at: new Date().toISOString(),
      };

      // 1. Atualiza cache local da empresa específica
      saveLocalFallback(activeCompanyId, newConfig);
      cachedConfigs.set(activeCompanyId, newConfig);
      setConfig(newConfig);
      notifyListeners(activeCompanyId);

      // 2. Salva na tabela dedicada `store_config` e na tabela `companies` no Supabase
      try {
        const supabase = await getSupabase();
        const { id: _ignoreId, ...configWithoutId } = newConfig;

        await supabase
          .from("store_config")
          .upsert({
            ...configWithoutId,
            company_id: activeCompanyId,
            updated_at: new Date().toISOString()
          }, { onConflict: 'company_id' });

        const companyUpdates: any = {};
        if (updates.store_name) companyUpdates.name = updates.store_name;
        if (updates.logo_url !== undefined) companyUpdates.logo_url = updates.logo_url;
        if (Object.keys(companyUpdates).length > 0) {
          await supabase.from("companies").update(companyUpdates).eq("id", activeCompanyId);
        }
      } catch (e) {
        console.info("Erro ao salvar store_config no Supabase:", e);
      }

      setSaveStatus("success");
      setSaving(false);
      setTimeout(() => setSaveStatus("idle"), 3000);
      return true;
    },
    [config, activeCompanyId]
  );

  const updateStoreWhatsApp = useCallback(
    async (phone: string, targetCompanyId?: string): Promise<{ success: boolean; error?: string; normalized?: string }> => {
      const val = validateAndNormalizeBrazilianPhone(phone);
      if (!val.valid) {
        return { success: false, error: val.error || "Número de WhatsApp inválido" };
      }

      setSaving(true);
      const effectiveCompanyId = targetCompanyId || activeCompanyId;

      try {
        const supabase = await getSupabase();

        const { error: updateError } = await supabase
          .from("store_config")
          .update({
            whatsapp_number: val.normalized,
            updated_at: new Date().toISOString()
          })
          .eq("company_id", effectiveCompanyId);

        if (updateError) {
          console.error("Erro ao atualizar whatsapp_number em store_config:", updateError);
          setSaving(false);
          return { success: false, error: updateError.message };
        }

        await supabase
          .from("companies")
          .update({ phone: val.normalized })
          .eq("id", effectiveCompanyId);

        const updatedConfig = {
          ...config,
          whatsapp_number: val.normalized,
          updated_at: new Date().toISOString()
        };
        cachedConfigs.set(effectiveCompanyId, updatedConfig);
        saveLocalFallback(effectiveCompanyId, updatedConfig);
        setConfig(updatedConfig);
        notifyListeners(effectiveCompanyId);

        setSaving(false);
        return { success: true, normalized: val.normalized };
      } catch (err: any) {
        console.error("Exceção ao atualizar whatsapp_number:", err);
        setSaving(false);
        return { success: false, error: err.message || "Erro ao conectar ao banco" };
      }
    },
    [config, activeCompanyId]
  );

  const uploadLogo = useCallback(
    async (file: File): Promise<string | null> => {
      try {
        const supabase = await getSupabase();
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
    const result = await fetchStoreConfig(activeCompanyId, authCompanyName);
    setConfig(result);
    setLoading(false);
  }, [activeCompanyId, authCompanyName]);

  return {
    config,
    loading,
    saving,
    saveStatus,
    updateConfig,
    updateStoreWhatsApp,
    uploadLogo,
    refreshConfig,
  };
}
