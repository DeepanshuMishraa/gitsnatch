# gitsnatch

Browse and download files from any git repo without cloning the whole thing. Built with OpenTUI.

## Install

```bash
bun install -g gitsnatch
```

Or clone and run:

```bash
bun install
bun run src/index.tsx
```

## Usage

1. Enter a repo URL (https://github.com/user/repo)
2. It clones with `--depth 1` into `/tmp`, then shows the tree
3. Navigate files with arrow keys / j/k/G, open with Enter
4. `d` downloads the selected file to your current directory
5. `l`/`h` or `→`/`←` switches focus between sidebar and code view
6. Submitting the same URL reuses the cached clone in /tmp
7. Ctrl+C twice to exit

## Build

```bash
bun run build
```

Output is written to `dist/`. The `bin/gitsnatch.js` entry tries source first, then falls back to `dist/`.
