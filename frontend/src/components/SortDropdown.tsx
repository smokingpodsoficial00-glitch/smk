import { useState, useRef, useEffect } from "react";
import { ArrowUpDown, Check, ChevronDown } from "lucide-react";

export type SortOption = "default" | "price-asc" | "price-desc";

interface SortDropdownProps {
  value: SortOption;
  onChange: (value: SortOption) => void;
}

const OPTIONS: { value: SortOption; label: string }[] = [
  { value: "default", label: "Padrão" },
  { value: "price-asc", label: "Menor preço" },
  { value: "price-desc", label: "Maior preço" },
];

export function SortDropdown({ value, onChange }: SortDropdownProps) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const currentOption = OPTIONS.find(o => o.value === value) || OPTIONS[0];
  const isSorted = value !== "default";

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setOpen(prev => !prev)}
        className={`inline-flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-4 py-2 rounded-full text-xs sm:text-sm font-medium transition-all duration-200 cursor-pointer select-none border ${
          isSorted
            ? "bg-white text-black font-semibold border-white shadow-[0_0_14px_rgba(255,255,255,0.28)]"
            : "glass text-white/90 border-white/10 hover:bg-elevated hover:border-white/20 hover:text-white"
        }`}
        aria-haspopup="true"
        aria-expanded={open}
      >
        <ArrowUpDown className={`size-3 sm:size-3.5 shrink-0 ${isSorted ? "text-black" : "text-muted-foreground"}`} />
        <span>
          <span className={`font-normal ${isSorted ? "text-black/80" : "text-muted-foreground"}`}>Ordenar por: </span>
          <span className={`font-semibold ${isSorted ? "text-black" : "text-white"}`}>{currentOption.label}</span>
        </span>
        <ChevronDown className={`size-3 sm:size-3.5 shrink-0 transition-transform duration-200 ${isSorted ? "text-black" : "text-muted-foreground"} ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-48 sm:w-52 rounded-2xl glass-strong border border-white/10 p-1.5 shadow-2xl z-40 animate-in fade-in zoom-in-95 duration-150">
          <div className="flex flex-col gap-1">
            {OPTIONS.map(option => {
              const isSelected = value === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 text-xs sm:text-sm text-left rounded-xl transition-all cursor-pointer ${
                    isSelected
                      ? "bg-white text-black font-semibold shadow-[0_0_12px_rgba(255,255,255,0.3)]"
                      : "text-foreground hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <span>{option.label}</span>
                  {isSelected && <Check className="size-3.5 text-black shrink-0 ml-2" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
