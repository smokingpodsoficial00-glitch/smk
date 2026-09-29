import re

filepath = 'admin/src/components/KanbanBoard.tsx'

with open(filepath, 'r', encoding='utf-8') as f:
    text = f.read()

# Remove font-mono
text = re.sub(r'\bfont-mono\b', '', text)

# Remove font-sans
text = re.sub(r'\bfont-sans\b', '', text)

# Convert font-extrabold to font-bold for better consistency
text = re.sub(r'\bfont-extrabold\b', 'font-bold', text)

# Clean up multiple spaces that might have been created
text = re.sub(r' +', ' ', text)
# Clean up spaces before closing quotes
text = re.sub(r' "', '"', text)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(text)

print("Font standardization applied.")
