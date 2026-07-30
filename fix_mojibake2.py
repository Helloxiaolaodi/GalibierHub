import os

def fix_file(filepath):
    with open(filepath, "rb") as f:
        raw = f.read()
    
    original = raw
    # Replace A with circumflex + middle dot (C2 B7) with just middle dot (C2 B7 is correct, but if it's double-encoded...)
    # Actually try to fix double-encoded UTF-8: C3 82 C2 B7 -> C2 B7
    raw = raw.replace(b"\xc3\x82\xc2\xb7", b"\xc2\xb7")
    # Another common variant: C3 82 C2 B7 -> proper middle dot is C2 B7
    raw = raw.replace(b"\xc3\x83\xc2\x82\xc2\xb7", b"\xc2\xb7")
    
    if raw != original:
        with open(filepath, "wb") as f:
            f.write(raw)
        return True
    return False

src_dir = "D:/YL2026/html-deploy/SeqEdge/src"
count = 0
for root, dirs, files in os.walk(src_dir):
    dirs[:] = [d for d in dirs if d not in ("node_modules", ".next")]
    for fn in files:
        if fn.endswith((".tsx", ".ts", ".js", ".jsx", ".css", ".html")):
            fp = os.path.join(root, fn)
            if fix_file(fp):
                print(f"Fixed: {fp}")
                count += 1

print(f"\nTotal fixed: {count}")
