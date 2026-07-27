export type EvolutionConfig = {
  apiUrl: string;
  apiKey: string;
  instanceName: string;
};

export type InstanceStatusResponse = {
  instance?: {
    instanceName: string;
    state: "open" | "connecting" | "close";
  };
  state?: "open" | "connecting" | "close";
  status?: string;
  qrcode?: {
    base64?: string;
    code?: string;
  };
};

const DEFAULT_CONFIG: EvolutionConfig = {
  apiUrl: "http://localhost:8080",
  apiKey: "",
  instanceName: "smoking-pods",
};

const STORAGE_KEY = "evolution_api_config_v1";

export function getEvolutionConfig(): EvolutionConfig {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch (e) {
    console.warn("Erro ao carregar EvolutionConfig:", e);
  }
  return DEFAULT_CONFIG;
}

export function saveEvolutionConfig(cfg: EvolutionConfig) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  } catch (e) {
    console.warn("Erro ao salvar EvolutionConfig:", e);
  }
}

/**
 * Normaliza a URL base removendo barras finais
 */
function cleanUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

/**
 * Consulta o status da conexão da instância na Evolution API
 */
export async function fetchInstanceStatus(cfg: EvolutionConfig): Promise<{
  connected: boolean;
  state: string;
  phoneNumber?: string;
  raw?: any;
}> {
  const baseUrl = cleanUrl(cfg.apiUrl || DEFAULT_CONFIG.apiUrl);
  const instance = cfg.instanceName.trim() || DEFAULT_CONFIG.instanceName;

  try {
    const res = await fetch(`${baseUrl}/instance/connectionState/${instance}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        apikey: cfg.apiKey.trim(),
      },
    });

    if (!res.ok) {
      return { connected: false, state: "offline" };
    }

    const data = await res.json();
    const state = data?.instance?.state || data?.state || "close";
    const connected = state === "open";

    return {
      connected,
      state,
      phoneNumber: data?.instance?.owner || data?.owner,
      raw: data,
    };
  } catch (e) {
    console.warn("Erro ao conectar à Evolution API:", e);
    return { connected: false, state: "error" };
  }
}

/**
 * Solicita a geração/conexão com o QR Code na Evolution API
 */
export async function connectInstance(cfg: EvolutionConfig): Promise<{
  base64?: string;
  code?: string;
  connected: boolean;
  error?: string;
}> {
  const baseUrl = cleanUrl(cfg.apiUrl || DEFAULT_CONFIG.apiUrl);
  const instance = cfg.instanceName.trim() || DEFAULT_CONFIG.instanceName;

  try {
    const res = await fetch(`${baseUrl}/instance/connect/${instance}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        apikey: cfg.apiKey.trim(),
      },
    });

    if (!res.ok) {
      return { connected: false, error: `Erro ${res.status}: Instância não encontrada ou chave inválida` };
    }

    const data = await res.json();
    const base64 = data?.base64 || data?.qrcode?.base64 || data?.code;
    const code = data?.code || data?.qrcode?.code;
    const state = data?.instance?.state || data?.state;

    return {
      base64,
      code,
      connected: state === "open",
    };
  } catch (e: any) {
    return { connected: false, error: e?.message || "Falha na conexão com a Evolution API" };
  }
}

/**
 * Cria a instância na Evolution API caso não exista
 */
export async function createInstance(cfg: EvolutionConfig): Promise<{ success: boolean; message?: string }> {
  const baseUrl = cleanUrl(cfg.apiUrl || DEFAULT_CONFIG.apiUrl);
  const instance = cfg.instanceName.trim() || DEFAULT_CONFIG.instanceName;

  try {
    const res = await fetch(`${baseUrl}/instance/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: cfg.apiKey.trim(),
      },
      body: JSON.stringify({
        instanceName: instance,
        token: cfg.apiKey.trim(),
        qrcode: true,
      }),
    });

    if (res.ok) {
      return { success: true };
    }
    const errData = await res.json().catch(() => ({}));
    return { success: false, message: errData?.message || `Erro ${res.status}` };
  } catch (e: any) {
    return { success: false, message: e?.message || "Falha de rede ao criar instância" };
  }
}

/**
 * Envia uma mensagem de texto real via Evolution API
 */
export async function sendTextMessage(
  cfg: EvolutionConfig,
  number: string,
  text: string
): Promise<{ success: boolean; message?: string }> {
  const baseUrl = cleanUrl(cfg.apiUrl || DEFAULT_CONFIG.apiUrl);
  const instance = cfg.instanceName.trim() || DEFAULT_CONFIG.instanceName;

  const cleanNumber = number.replace(/\D/g, "");
  if (!cleanNumber) {
    return { success: false, message: "Número do WhatsApp inválido" };
  }

  try {
    const res = await fetch(`${baseUrl}/message/sendText/${instance}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: cfg.apiKey.trim(),
      },
      body: JSON.stringify({
        number: cleanNumber,
        options: {
          delay: 1200,
          presence: "composing",
          linkPreview: true,
        },
        textMessage: {
          text,
        },
      }),
    });

    if (res.ok) {
      return { success: true };
    }

    const data = await res.json().catch(() => ({}));
    return { success: false, message: data?.message || `Erro HTTP ${res.status}` };
  } catch (e: any) {
    return { success: false, message: e?.message || "Falha ao enviar mensagem" };
  }
}

/**
 * Desconecta/Logout da instância na Evolution API
 */
export async function logoutInstance(cfg: EvolutionConfig): Promise<boolean> {
  const baseUrl = cleanUrl(cfg.apiUrl || DEFAULT_CONFIG.apiUrl);
  const instance = cfg.instanceName.trim() || DEFAULT_CONFIG.instanceName;

  try {
    const res = await fetch(`${baseUrl}/instance/logout/${instance}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        apikey: cfg.apiKey.trim(),
      },
    });
    return res.ok;
  } catch {
    return false;
  }
}
