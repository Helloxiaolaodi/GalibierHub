import os

def fix_mojibake(filepath):
    try:
        with open(filepath, "r", encoding="utf-8", errors="replace") as f:
            content = f.read()
        
        original = content
        
        # Fix common mojibake patterns
        replacements = {
            "\u00c3\u201a\u00c2\u00b7": "\u00b7",  # middle dot
            "\u00c2\u00b7": "\u00b7",               # middle dot variant
            "\u00c3\u0192\u00e2\u201a\u00ac\u00a2": "\u2022",  # bullet
            "\u00c3\u0192\u00e2\u201a\u00ac\u0153": "\u201c",  # left double quote
            "\u00c3\u0192\u00e2\u201a\u00ac\u009d": "\u201d",  # right double quote
            "\u00c3\u0192\u00e2\u201a\u00ac\u2122": "\u2019",  # right single quote
            "\u00c3\u2014": "\u00d7",               # multiplication sign
        }
        
        for moji, fix in replacements.items():
            content = content.replace(moji, fix)
        
        if content != original:
            with open(filepath, "w", encoding="utf-8", newline="") as f:
                f.write(content)
            return True
    except Exception as e:
        print(f"  Error: {e}")
    return False

src_dir = "D:/YL2026/html-deploy/SeqEdge/src"
count = 0
for root, dirs, files in os.walk(src_dir):
    if "node_modules" in root or ".next" in root:
        continue
    for fn in files:
        if fn.endswith((".tsx", ".ts", ".js", ".jsx", ".css", ".html")):
            fp = os.path.join(root, fn)
            if fix_mojibake(fp):
                print(f"Fixed: {fp}")
                count += 1

print(f"\nTotal files fixed: {count}")
