import { useStoreConfig } from "@/lib/useStoreConfig";

export function BlackFridayBanner() {
  const { config } = useStoreConfig();

  const vipGroupUrl = (config as any)?.vip_group_url || "https://chat.whatsapp.com/Bk2rFAAgHlvKgc8pQANqYg";
  const rawPhone = config?.whatsapp_number?.replace(/\D/g, "") || "";
  const whatsappNumber = rawPhone.length >= 10 ? (rawPhone.startsWith("55") ? rawPhone : `55${rawPhone}`) : null;

  // Mensagem curta solicitada: "Quero 5 reais off, tô indicando 5 amigos"
  const indicateMessage = encodeURIComponent("Quero 5 reais off, tô indicando 5 amigos");
  const indicateUrl = whatsappNumber
    ? `https://wa.me/${whatsappNumber}?text=${indicateMessage}`
    : "#";

  return (
    <div className="mt-6 sm:mt-8 max-w-4xl mx-auto w-full px-2">
      <div className="relative rounded-2xl sm:rounded-3xl overflow-hidden border border-white/15 shadow-[0_12px_48px_rgba(0,0,0,0.85)] bg-black/60 group">
        
        {/* Imagem Oficial Criada no Canva */}
        <img
          src="/black-friday-banner.jpg"
          alt="Black Friday Smoking Pods"
          className="w-full h-auto block select-none pointer-events-none"
        />

        {/* Hotspot Botão 1: ENTRE NO GRUPO AQUI */}
        <a
          href={vipGroupUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute left-[45.5%] top-[43.5%] w-[22.5%] h-[12.5%] rounded-full cursor-pointer transition-all duration-200 hover:ring-2 hover:ring-emerald-400/80 hover:bg-emerald-500/10 active:scale-95 z-20"
          title="Entrar no Grupo VIP do WhatsApp"
          aria-label="Entrar no Grupo VIP"
        />

        {/* Hotspot Botão 2: AQUI PARA INDICAR */}
        <a
          href={indicateUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute left-[45.5%] top-[56.5%] w-[22.5%] h-[12.5%] rounded-full cursor-pointer transition-all duration-200 hover:ring-2 hover:ring-emerald-400/80 hover:bg-emerald-500/10 active:scale-95 z-20"
          title="Indicar amigos e garantir R$ 5 OFF"
          aria-label="Aqui para Indicar"
        />
      </div>
    </div>
  );
}
