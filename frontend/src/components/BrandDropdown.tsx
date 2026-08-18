import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check, Tag } from "lucide-react";

interface BrandDropdownProps {
  brands: string[];
  activeBrand: string | null;
  onSelectBrand: (brand: string) => void;
}

export function BrandDropdown({ brands, activeBrand, onSelectBrand }: BrandDropdownProps) {
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

  const isBrandActive = !!activeBrand;

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setOpen(prev => !prev)}
        className={`inline-flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-4 py-2 rounded-full text-xs sm:text-sm font-medium transition-all duration-200 cursor-pointer select-none border ${
          isBrandActive
            ? "bg-white text-black font-semibold border-white shadow-[0_0_14px_rgba(255,255,255,0.28)]"
            : "glass text-white/90 border-white/10 hover:bg-elevated hover:border-white/20 hover:text-white"
        }`}
        aria-haspopup="true"
        aria-expanded={open}
      >
        <Tag className={`size-3 sm:size-3.5 shrink-0 ${isBrandActive ? "text-black" : "text-muted-foreground"}`} />
        <span className="truncate max-w-[120px] sm:max-w-[160px]">
          {isBrandActive ? activeBrand : "Marcas"}
        </span>
        <ChevronDown className={`size-3 sm:size-3.5 shrink-0 transition-transform duration-200 ${isBrandActive ? "text-black" : "text-muted-foreground"} ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute left-0 mt-2 w-48 sm:w-56 rounded-2xl glass-strong border border-white/10 p-1.5 shadow-2xl z-40 max-h-64 sm:max-h-72 overflow-y-auto custom-scrollbar animate-in fade-in zoom-in-95 duration-150">
          <div className="flex flex-col gap-1">
            {brands.length === 0 ? (
              <div className="px-3 py-2 text-xs text-muted-foreground text-center">
                Nenhuma marca disponível
              </div>
            ) : (
              brands.map(brand => {
                const isSelected = activeBrand?.toLowerCase() === brand.toLowerCase();
                return (
                  <button
                    key={brand}
                    type="button"
                    onClick={() => {
                      onSelectBrand(brand);
                      setOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 text-xs sm:text-sm text-left rounded-xl transition-all cursor-pointer ${
                      isSelected
                        ? "bg-white text-black font-semibold shadow-[0_0_12px_rgba(255,255,255,0.3)]"
                        : "text-foreground hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <span className="truncate">{brand}</span>
                    {isSelected && <Check className="size-3.5 text-black shrink-0 ml-2" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
