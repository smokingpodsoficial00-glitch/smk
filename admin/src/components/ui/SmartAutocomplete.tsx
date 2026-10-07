import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Plus, Check } from "lucide-react";

export interface SmartOption {
  /** Valor gravado no campo (grafia oficial já cadastrada) */
  value: string;
  /** Texto exibido (opcional, ex.: "15.000" para value "15000") */
  label?: string;
  /** Texto auxiliar exibido à direita (ex.: marca, "neste produto") */
  hint?: string;
  /** Prioridade contextual: maior aparece primeiro */
  priority?: number;
}

/** Normalização para comparação: minúsculas, sem acentos, espaços colapsados. */
export function normalizeForMatch(s: string): string {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

interface SmartAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  options: SmartOption[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  required?: boolean;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  /** Título da seção de resultados (ex.: "Marcas encontradas") */
  sectionTitle?: string;
  /** Texto da ação de criação (ex.: t => `Criar nova marca "${t}"`) */
  createLabel?: (text: string) => string;
  /** Sanitiza o texto digitado (ex.: somente dígitos) */
  sanitize?: (raw: string) => string;
  /** Enter sem sugestão destacada */
  onEnterWithoutSelection?: () => void;
  maxSuggestions?: number;
  ariaLabel?: string;
}

export function SmartAutocomplete({
  value,
  onChange,
  options,
  placeholder,
  className,
  disabled,
  required,
  inputMode,
  sectionTitle = "Sugestões",
  createLabel = (t) => `Criar novo "${t}"`,
  sanitize,
  onEnterWithoutSelection,
  maxSuggestions = 6,
  ariaLabel,
}: SmartAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const [pos, setPos] = useState<{ top?: number; bottom?: number; left: number; width: number; maxH: number } | null>(null);
  const listId = useId();

  // Deduplica por valor normalizado (mantém a de maior prioridade = grafia oficial mais usada)
  const uniqueOptions = useMemo(() => {
    const map = new Map<string, SmartOption>();
    for (const o of options) {
      if (!o.value || !String(o.value).trim()) continue;
      const k = normalizeForMatch(o.value);
      const prev = map.get(k);
      if (!prev || (o.priority || 0) > (prev.priority || 0)) map.set(k, o);
    }
    return Array.from(map.values());
  }, [options]);

  const query = normalizeForMatch(value);

  const suggestions = useMemo(() => {
    const scored = uniqueOptions
      .map((o) => {
        const v = normalizeForMatch(o.value);
        const l = normalizeForMatch(o.label || o.value);
        if (query && !v.includes(query) && !l.includes(query)) return null;
        const starts = query && (v.startsWith(query) || l.startsWith(query)) ? 1 : 0;
        return { o, starts };
      })
      .filter(Boolean) as { o: SmartOption; starts: number }[];
    scored.sort(
      (a, b) =>
        (b.o.priority || 0) - (a.o.priority || 0) ||
        b.starts - a.starts ||
        (a.o.label || a.o.value).localeCompare(b.o.label || b.o.value, "pt-BR", { numeric: true })
    );
    return scored.slice(0, maxSuggestions).map((s) => s.o);
  }, [uniqueOptions, query, maxSuggestions]);

  const exactMatch = useMemo(
    () => (query ? uniqueOptions.find((o) => normalizeForMatch(o.value) === query) : undefined),
    [uniqueOptions, query]
  );
  const showCreate = !!query && !exactMatch;
  const totalItems = suggestions.length + (showCreate ? 1 : 0);
  const visible = open && !disabled && totalItems > 0;

  // Posicionamento inteligente (fixed): acompanha o input, respeita o viewport, não cobre a tela inteira
  const updatePosition = () => {
    const el = inputRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const vv = window.visualViewport;
    const vTop = vv ? vv.offsetTop : 0;
    const vH = vv ? vv.height : window.innerHeight;
    const vW = vv ? vv.width : window.innerWidth;
    
    // Espaço disponível real acima e abaixo considerando visualViewport
    const spaceBelow = vTop + vH - r.bottom - 8;
    const spaceAbove = r.top - vTop - 8;
    
    // Largura estritamente idêntica à do input (nunca menor ou maior na tela)
    const width = Math.min(r.width, vW - 16);
    const left = Math.max(8, Math.min(r.left, vW - width - 8));
    
    // Altura compacta: no desktop/mobile acompanha o conteúdo, com máx 220px-240px (~5 a 6 itens)
    // Se houver poucos itens (ex: 1, 2, 3), o max-height diminui proporcionalmente
    const contentEstimate = Math.max(70, (totalItems * 40) + 32);
    const preferredMaxH = Math.min(240, contentEstimate);
    
    // Prioriza abrir abaixo se tiver pelo menos 140px disponíveis, ou se houver mais espaço abaixo do que acima
    const below = spaceBelow >= 140 || spaceBelow >= spaceAbove;
    const maxH = Math.max(60, Math.min(preferredMaxH, below ? spaceBelow : spaceAbove));
    
    setPos(
      below
        ? { top: r.bottom + 4, left, width, maxH }
        : { bottom: window.innerHeight - r.top + 4, left, width, maxH }
    );
  };

  useLayoutEffect(() => {
    if (visible) updatePosition();
  }, [visible, value, totalItems]);

  useEffect(() => {
    if (!visible) return;
    const handler = () => updatePosition();
    window.addEventListener("resize", handler);
    window.addEventListener("scroll", handler, true);
    window.visualViewport?.addEventListener("resize", handler);
    window.visualViewport?.addEventListener("scroll", handler);
    const outside = (e: PointerEvent) => {
      const t = e.target as Node;
      if (inputRef.current?.contains(t) || listRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", outside, true);
    return () => {
      window.removeEventListener("resize", handler);
      window.removeEventListener("scroll", handler, true);
      window.visualViewport?.removeEventListener("resize", handler);
      window.visualViewport?.removeEventListener("scroll", handler);
      document.removeEventListener("pointerdown", outside, true);
    };
  }, [visible]);

  // Mantém o item destacado visível ao navegar pelo teclado
  useEffect(() => {
    if (highlight < 0 || !listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(`[data-idx="${highlight}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [highlight]);

  const select = (val: string) => {
    onChange(val);
    setOpen(false);
    setHighlight(-1);
  };

  const commitTyped = () => select(value.replace(/\s+/g, " ").trim());

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) setOpen(true);
      if (totalItems > 0) setHighlight((h) => (h + 1) % totalItems);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (totalItems > 0) setHighlight((h) => (h <= 0 ? totalItems - 1 : h - 1));
    } else if (e.key === "Escape") {
      if (visible) {
        e.preventDefault();
        e.stopPropagation();
        setOpen(false);
        setHighlight(-1);
      }
    } else if (e.key === "Enter") {
      if (visible && highlight >= 0) {
        e.preventDefault();
        if (highlight < suggestions.length) select(suggestions[highlight].value);
        else commitTyped();
      } else if (onEnterWithoutSelection) {
        e.preventDefault();
        setOpen(false);
        onEnterWithoutSelection();
      }
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  };

  // Ao sair do campo: se o texto equivale a um valor existente (só difere em maiúsculas/acentos/espaços),
  // usa a grafia oficial para evitar duplicidade. Nunca substitui enquanto o usuário digita.
  const onBlur = () => {
    if (exactMatch && exactMatch.value !== value) onChange(exactMatch.value);
    else if (value && value !== value.replace(/\s+/g, " ").trim()) onChange(value.replace(/\s+/g, " ").trim());
  };

  return (
    <>
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded={visible}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={visible && highlight >= 0 ? `${listId}-${highlight}` : undefined}
        aria-label={ariaLabel}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        inputMode={inputMode}
        value={value}
        required={required}
        disabled={disabled}
        placeholder={placeholder}
        className={className}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onChange={(e) => {
          onChange(sanitize ? sanitize(e.target.value) : e.target.value);
          setOpen(true);
          setHighlight(-1);
        }}
        onKeyDown={onKeyDown}
        onBlur={onBlur}
      />
      {visible && pos &&
        createPortal(
          <div
            ref={listRef}
            id={listId}
            role="listbox"
            style={{
              position: "fixed",
              top: pos.top,
              bottom: pos.bottom,
              left: pos.left,
              width: pos.width,
              maxHeight: pos.maxH,
            }}
            className="z-[9999] overflow-y-auto overscroll-contain rounded-xl border border-white/10 bg-[#141414] shadow-2xl shadow-black/90 py-1 animate-in fade-in duration-100 custom-scrollbar text-xs box-border"
            // Evita perder o foco do input antes do toque ser processado
            onMouseDown={(e) => e.preventDefault()}
          >
            {suggestions.length > 0 && (
              <div className="px-3 py-1 text-[9px] uppercase font-bold tracking-wider text-muted-foreground/60 select-none">
                {sectionTitle}
              </div>
            )}
            
            {suggestions.length === 0 && !showCreate && (
              <div className="px-3 py-2 text-[11px] text-muted-foreground/70 text-center">Nenhum resultado encontrado</div>
            )}

            <div className="divide-y divide-white/5">
              {suggestions.map((o, i) => {
                const isCurrent = normalizeForMatch(o.value) === query;
                return (
                  <button
                    key={o.value}
                    id={`${listId}-${i}`}
                    data-idx={i}
                    type="button"
                    role="option"
                    aria-selected={highlight === i}
                    onClick={() => select(o.value)}
                    onMouseEnter={() => setHighlight(i)}
                    className={`w-full min-h-[38px] flex items-center justify-between gap-2 px-3 py-2 text-left text-xs text-white/90 transition-colors cursor-pointer ${
                      highlight === i ? "bg-emerald-500/20 text-white" : "hover:bg-white/5 active:bg-white/10"
                    }`}
                  >
                    <span className="truncate font-medium">{o.label || o.value}</span>
                    <span className="flex items-center gap-1.5 shrink-0">
                      {o.hint && <span className="text-[10px] text-muted-foreground/60">{o.hint}</span>}
                      {isCurrent && <Check className="size-3.5 text-emerald-400" />}
                    </span>
                  </button>
                );
              })}
            </div>

            {showCreate && (
              <div className="pt-1 mt-0.5 border-t border-white/10">
                <button
                  id={`${listId}-${suggestions.length}`}
                  data-idx={suggestions.length}
                  type="button"
                  role="option"
                  aria-selected={highlight === suggestions.length}
                  onClick={commitTyped}
                  onMouseEnter={() => setHighlight(suggestions.length)}
                  className={`w-full min-h-[38px] flex items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-emerald-400 transition-colors cursor-pointer ${
                    highlight === suggestions.length ? "bg-emerald-500/20" : "hover:bg-emerald-500/10 active:bg-emerald-500/20"
                  }`}
                >
                  <Plus className="size-3.5 shrink-0" />
                  <span className="truncate">{createLabel(value.replace(/\s+/g, " ").trim())}</span>
                </button>
              </div>
            )}
          </div>,
          document.body
        )}
    </>
  );
}
