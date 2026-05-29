import { useState, useEffect, useRef, useCallback } from "react"
import { useKeyboard } from "@opentui/react"
import { SyntaxStyle, getTreeSitterClient } from "@opentui/core"
import type { CodeRenderable, ScrollBoxRenderable } from "@opentui/core"
import { flattenTree } from "../utils/tree"
import type { TreeNode, FlatNode } from "../utils/tree"
import { downloadItem } from "../utils/git"
import { readFileSync, existsSync, statSync } from "fs"
import { extname, basename } from "path"

type Props = {
  root: TreeNode
  repoName: string
  onBack: () => void
}

type Focus = "tree" | "content"

const ss = SyntaxStyle.fromStyles({
  default: { fg: "#c0caf5" },
  keyword: { fg: "#bb9af7", bold: true },
  "keyword.import": { fg: "#bb9af7", bold: true },
  "keyword.operator": { fg: "#bb9af7" },
  "keyword.return": { fg: "#bb9af7", bold: true },
  "keyword.function": { fg: "#bb9af7", bold: true },
  string: { fg: "#9ece6a" },
  "string.special": { fg: "#9ece6a" },
  "string.escape": { fg: "#89ddff" },
  "string.regexp": { fg: "#9ece6a" },
  comment: { fg: "#737aa2", italic: true },
  "comment.documentation": { fg: "#737aa2", italic: true },
  number: { fg: "#ff9e64" },
  boolean: { fg: "#ff9e64" },
  constant: { fg: "#ff9e64" },
  "constant.builtin": { fg: "#ff9e64" },
  function: { fg: "#7aa2f7" },
  "function.call": { fg: "#7aa2f7" },
  "function.method": { fg: "#7aa2f7" },
  "function.method.call": { fg: "#7aa2f7" },
  "function.builtin": { fg: "#7aa2f7" },
  "function.macro": { fg: "#7aa2f7" },
  type: { fg: "#ff9e64" },
  "type.builtin": { fg: "#ff9e64" },
  constructor: { fg: "#ff9e64" },
  variable: { fg: "#c0caf5" },
  "variable.builtin": { fg: "#e0af68" },
  "variable.member": { fg: "#73daca" },
  "variable.parameter": { fg: "#ee99a0" },
  property: { fg: "#73daca" },
  "property.declaration": { fg: "#73daca" },
  operator: { fg: "#89ddff" },
  "operator.assignment": { fg: "#89ddff" },
  punctuation: { fg: "#565f89" },
  "punctuation.bracket": { fg: "#89ddff" },
  "punctuation.delimiter": { fg: "#565f89" },
  "punctuation.special": { fg: "#89ddff" },
  parameter: { fg: "#ee99a0" },
  label: { fg: "#bb9af7" },
  namespace: { fg: "#c0caf5" },
  module: { fg: "#c0caf5" },
  attribute: { fg: "#e0af68" },
  "attribute.builtin": { fg: "#e0af68" },
  tag: { fg: "#f7768e" },
  "tag.delimiter": { fg: "#f7768e" },
  "tag.attribute": { fg: "#e0af68" },
  "markup.heading": { fg: "#7aa2f7", bold: true },
  "markup.heading.1": { fg: "#7aa2f7", bold: true },
  "markup.heading.2": { fg: "#7dcfff", bold: true },
  "markup.bold": { fg: "#c0caf5", bold: true },
  "markup.italic": { fg: "#c0caf5", italic: true },
  "markup.list": { fg: "#ff9e64" },
  "markup.quote": { fg: "#737aa2", italic: true },
  "markup.raw": { fg: "#9ece6a" },
  "markup.raw.block": { fg: "#9ece6a" },
  "markup.link": { fg: "#7aa2f7", underline: true },
  "markup.link.url": { fg: "#7aa2f7", underline: true },
  "markup.link.label": { fg: "#7dcfff" },
  error: { fg: "#f7768e" },
  warning: { fg: "#e0af68" },
  info: { fg: "#7dcfff" },
  hint: { fg: "#73daca" },
})

const ftMap: Record<string, string> = {
  ".ts": "typescript", ".tsx": "tsx",
  ".js": "javascript", ".jsx": "jsx",
  ".rs": "rust", ".py": "python",
  ".go": "go", ".rb": "ruby",
  ".java": "java", ".kt": "kotlin",
  ".swift": "swift", ".c": "c",
  ".cpp": "cpp", ".h": "c", ".hpp": "cpp",
  ".css": "css", ".html": "html",
  ".json": "json", ".yaml": "yaml", ".yml": "yaml",
  ".md": "markdown", ".sql": "sql",
  ".sh": "bash", ".bash": "bash", ".zsh": "bash",
  ".toml": "toml", ".xml": "xml",
  ".vue": "vue", ".svelte": "svelte",
  ".astro": "astro", ".graphql": "graphql",
  ".sass": "sass", ".scss": "scss",
  ".zig": "zig", ".lua": "lua",
  ".ex": "elixir", ".exs": "elixir",
  ".erl": "erlang", ".hs": "haskell",
}

function getFt(p: string): string {
  return ftMap[extname(p).toLowerCase()] ?? ""
}

function countFiles(node: TreeNode): { files: number; folders: number } {
  let files = 0
  let folders = 0
  if (!node.children) return { files: 0, folders: 0 }
  for (const child of node.children) {
    if (child.type === "dir") {
      folders++
      const sub = countFiles(child)
      files += sub.files
      folders += sub.folders
    } else {
      files++
    }
  }
  return { files, folders }
}

function getFlatNodes(root: TreeNode, expanded: Set<string>): FlatNode[] {
  return flattenTree([root], expanded)
}

export function TreeBrowser({ root, repoName, onBack }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set([root.path]))
  const [cursor, setCursor] = useState(0)
  const [status, setStatus] = useState<string | null>(null)
  const statusTimer = useRef<ReturnType<typeof setTimeout>>(null)
  const [fileView, setFileView] = useState<{
    path: string
    content: string
    filetype: string
  } | null>(null)
  const [focus, setFocus] = useState<Focus>("tree")

  const counts = useRef(countFiles(root))
  const treeSitterClient = useRef(getTreeSitterClient())
  const scrollboxRef = useRef<ScrollBoxRenderable>(null)
  const codeRef = useRef<CodeRenderable>(null)

  const visible = getFlatNodes(root, expanded)
  const cursorRef = useRef(cursor)
  const visibleRef = useRef(visible)
  const fileViewRef = useRef(fileView)
  const focusRef = useRef(focus)
  cursorRef.current = cursor
  visibleRef.current = visible
  fileViewRef.current = fileView
  focusRef.current = focus

  useEffect(() => {
    if (visible.length === 0) return
    setCursor((c) => Math.min(c, visible.length - 1))
  }, [visible.length])

  useEffect(() => {
    const sb = scrollboxRef.current
    if (!sb) return
    if (cursor < sb.scrollTop) {
      sb.scrollTop = cursor
      return
    }
    const vh = sb.height
    if (cursor >= sb.scrollTop + vh - 1 && vh > 0) {
      sb.scrollTop = cursor - vh + 2
    }
  }, [cursor])

  const flash = (msg: string) => {
    if (statusTimer.current) clearTimeout(statusTimer.current)
    setStatus(msg)
    statusTimer.current = setTimeout(() => setStatus(null), 2500)
  }

  const openFile = useCallback((path: string) => {
    try {
      if (!existsSync(path)) {
        flash("File no longer exists")
        return
      }
      const info = statSync(path)
      if (!info.isFile()) {
        flash("Not a regular file")
        return
      }
      if (info.size > 1_000_000) {
        flash("File too large to display")
        return
      }
      const content = readFileSync(path, "utf-8")
      setFileView({ path, content, filetype: getFt(path) })
      setFocus("content")
    } catch {
      flash("Failed to read file")
    }
  }, [])

  const scrollCode = useCallback((delta: number) => {
    const c = codeRef.current
    if (!c) return
    const next = c.scrollY + delta
    if (next >= 0 && next <= c.maxScrollY) {
      c.scrollY = next
    }
  }, [])

  useKeyboard((key) => {
    const v = visibleRef.current
    const c = cursorRef.current
    const f = focusRef.current
    const fv = fileViewRef.current
    const isCtrl = key.ctrl
    const name = key.name
    const isShift = key.shift

    if (fv) {
      if (f === "content") {
        if (name === "up" || name === "k") {
          scrollCode(-1)
          return
        }
        if (name === "down" || name === "j") {
          scrollCode(1)
          return
        }
        if (name === "left" || name === "h" || name === "escape") {
          setFocus("tree")
          return
        }
        return
      }

      if (name === "right" || name === "l") {
        if (fv) {
          setFocus("content")
        }
        return
      }
    }

    switch (name) {
      case "up":
      case "k":
        setCursor((prev) => Math.max(0, prev - 1))
        break
      case "down":
      case "j":
        setCursor((prev) => Math.min(v.length - 1, prev + 1))
        break
      case "home":
        setCursor(0)
        break
      case "end":
        setCursor(v.length - 1)
        break
      case "g":
        if (isShift) {
          setCursor(v.length - 1)
        }
        break
      case "enter":
      case "return": {
        const node = v[c]
        if (!node) break
        if (node.type === "dir") {
          setExpanded((prev) => {
            const next = new Set(prev)
            if (next.has(node.path)) next.delete(node.path)
            else next.add(node.path)
            return next
          })
        } else {
          openFile(node.path)
        }
        break
      }
      case "d":
        if (!isCtrl) {
          const node = v[c]
          if (!node) break
          const r = downloadItem(node.path)
          flash(r.message)
        }
        break
      case "escape":
        if (fv) {
          setFileView(null)
          setFocus("tree")
        } else {
          onBack()
        }
        break
    }
  })

  const selectionBg = "#2f3b5c"

  return (
    <box flexDirection="column" flexGrow={1}>
      <box borderBottom borderColor="#24283b" paddingX={2} paddingY={1}>
        <text>
          <span fg="#7dcfff"><strong>{repoName}</strong></span>
          <span fg="#3b4261">
            {"  ·  "}{counts.current.files} files  ·  {counts.current.folders} folders
          </span>
        </text>
      </box>

      <box flexDirection="row" flexGrow={1}>
        <box
          width={36}
          flexDirection="column"
        >
          <scrollbox
            ref={scrollboxRef}
            flexGrow={1}
          >
            {visible.map((node, i) => {
              const selected = i === cursor
              const indent = "  ".repeat(node.depth)
              const icon =
                node.type === "dir" ? (node.expanded ? "▾" : "▸") : " "
              const labelFg = selected
                ? "#c0caf5"
                : node.type === "dir"
                  ? "#7aa2f7"
                  : "#9ece6a"

              return (
                <box
                  key={`${node.path}-${i}`}
                  backgroundColor={selected ? selectionBg : "transparent"}
                  paddingX={1}
                >
                  <text>
                    <span fg="#3b4261">│ </span>
                    <span fg="#3b4261">{indent}</span>
                    <span fg={selected ? "#7dcfff" : "#3b4261"}>{icon}</span>
                    <span fg={labelFg}>{node.name}</span>
                  </text>
                </box>
              )
            })}
          </scrollbox>
        </box>

        <box
          flexDirection="column"
          flexGrow={1}
          borderLeft
          borderColor={fileView && focus === "content" ? "#565f89" : fileView ? "#24283b" : "#1a1b26"}
        >
          {fileView ? (
            <box flexDirection="column" flexGrow={1}>
              <box
                paddingX={2}
                paddingY={1}
                borderBottom
                borderColor="#24283b"
                bg="#1a1b26"
              >
                <text>
                  <span fg="#7dcfff">{basename(fileView.path)}</span>
                  <span fg="#3b4261">  ·  </span>
                  <span fg="#565f89">
                    {fileView.content.split("\n").length} lines
                  </span>
                  {fileView.filetype && (
                    <span fg="#3b4261">  ·  </span>
                  )}
                  {fileView.filetype && (
                    <span fg="#565f89">{fileView.filetype}</span>
                  )}
                </text>
              </box>
              <box flexGrow={1}>
                <code
                  ref={codeRef}
                  content={fileView.content}
                  filetype={fileView.filetype}
                  syntaxStyle={ss}
                  treeSitterClient={treeSitterClient.current}
                  flexGrow={1}
                  fg="#c0caf5"
                />
              </box>
            </box>
          ) : (
            <box
              flexDirection="column"
              alignItems="center"
              justifyContent="center"
              flexGrow={1}
            >
              <text>
                <span fg="#3b4261">Select a file to view</span>
              </text>
            </box>
          )}
        </box>
      </box>

      <box borderTop borderColor="#24283b" paddingX={1} paddingY={0}>
        {status ? (
          <text>
            <span fg="#e0af68">{status}</span>
          </text>
        ) : fileView && focus === "content" ? (
          <text>
            <span fg="#3b4261">j/k scroll · ←/h focus tree · Esc close</span>
          </text>
        ) : fileView ? (
          <text>
            <span fg="#3b4261">→/l focus content · Enter open · d download · Esc close</span>
          </text>
        ) : (
          <text>
            <span fg="#3b4261">↑↓/jk · G bottom · Enter toggle/open · d download · Esc back</span>
          </text>
        )}
      </box>
    </box>
  )
}
