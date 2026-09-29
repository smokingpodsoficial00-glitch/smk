import re

filepath = 'admin/src/components/KanbanBoard.tsx'

with open(filepath, 'r', encoding='utf-8') as f:
    text = f.read()

# Pattern for mobile button
pattern_mobile = r'<button\s*onClick=\{\(\) => setIsPushModalOpen\(true\)\}\s*title="Ativar App e Notificações de Venda no Celular"\s*className="px-2\.5 py-1\.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 text-\[11px\] font-extrabold flex items-center gap-1 transition-all active:scale-95 cursor-pointer"\s*>\s*<Bell className="size-3\.5" />\s*<span>Alertas</span>\s*</button>'

# Pattern for desktop button
pattern_desktop = r'<button\s*onClick=\{\(\) => setIsPushModalOpen\(true\)\}\s*title="Ativar App e Notificações de Venda no Celular"\s*className="hidden sm:flex px-3 py-1\.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 text-xs font-extrabold items-center gap-1\.5 transition-all active:scale-95 cursor-pointer"\s*>\s*<Bell className="size-3\.5" />\s*<span>Notificações no Celular</span>\s*</button>'

# Print before count
print("Before mobile count:", len(re.findall(pattern_mobile, text)))
print("Before desktop count:", len(re.findall(pattern_desktop, text)))

# Try to remove
text = re.sub(pattern_mobile, '', text)
text = re.sub(pattern_desktop, '', text)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(text)

print("Replacement complete.")
