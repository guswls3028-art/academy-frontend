# python tools\export_frontend_ai_dump.py

import os
from pathlib import Path

# ============================
# CONFIG
# ============================

FRONTEND_ROOT = Path(r"C:\academyfront\src")
OUT_DIR = Path("ai_dumps_frontend")

INCLUDE_EXTS = {
    ".ts", ".tsx", ".js", ".jsx",
    ".css", ".scss",
    ".json", ".md", ".html",
}

EXCLUDE_DIRS = {
    "__pycache__", ".git", ".idea", ".vscode",
    "node_modules", "dist", "build",
}

# ============================
# CORE
# ============================

def dump_folder(folder: Path, prefix: str | None = None):
    name = folder.name if not prefix else f"{prefix}__{folder.name}"
    out_file = OUT_DIR / f"{name}.txt"

    lines: list[str] = []
    lines.append("=" * 100)
    lines.append(f"# FRONTEND FOLDER: {name}")
    lines.append(f"# ROOT PATH: {folder}")
    lines.append("=" * 100)
    lines.append("")

    for dirpath, dirnames, filenames in os.walk(folder):
        dirnames[:] = [d for d in dirnames if d not in EXCLUDE_DIRS]

        for fn in sorted(filenames):
            path = Path(dirpath) / fn
            if path.suffix.lower() not in INCLUDE_EXTS:
                continue

            rel = path.relative_to(folder).as_posix()

            lines.append("\n" + "=" * 90)
            lines.append(f"# FILE: {rel}")
            lines.append("=" * 90)

            try:
                lines.append(
                    path.read_text(encoding="utf-8", errors="replace").rstrip()
                )
            except Exception as e:
                lines.append(f"# [ERROR] {e}")

            lines.append("")

    out_file.write_text("\n".join(lines), encoding="utf-8")
    print(f"[OK] dumped {name}")

# ============================
# ENTRY
# ============================

def main():
    if not FRONTEND_ROOT.exists():
        raise RuntimeError(f"FRONTEND_ROOT not found: {FRONTEND_ROOT}")

    OUT_DIR.mkdir(exist_ok=True)

    for item in FRONTEND_ROOT.iterdir():
        if not item.is_dir() or item.name in EXCLUDE_DIRS:
            continue

        # ✅ features 는 내부 폴더 단위로 분해
        if item.name == "features":
            for sub in item.iterdir():
                if sub.is_dir() and sub.name not in EXCLUDE_DIRS:
                    dump_folder(sub, prefix="features")

        # ✅ student 도 내부 폴더 단위로 분해
        elif item.name == "student":
            for sub in item.iterdir():
                if sub.is_dir() and sub.name not in EXCLUDE_DIRS:
                    dump_folder(sub, prefix="student")

        else:
            dump_folder(item)

    print(f"\n[DONE] frontend AI dumps → {OUT_DIR.resolve()}")

if __name__ == "__main__":
    main()
