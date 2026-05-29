import { useState, useCallback, useRef } from "react"
import { useKeyboard, useRenderer } from "@opentui/react"
import { Toaster, toast } from "@opentui-ui/toast/react"
import { UrlInputScreen } from "./components/UrlInputScreen"
import { LoadingView } from "./components/LoadingView"
import { TreeBrowser } from "./components/TreeBrowser"
import { cloneRepo, getTempDir, findCachedRepo } from "./utils/git"
import { buildTree, getRepoName } from "./utils/tree"
import type { TreeNode } from "./utils/tree"

type Phase =
  | { type: "input" }
  | { type: "cloning" }
  | { type: "browsing"; tree: TreeNode; repoPath: string; repoName: string }
  | { type: "error"; message: string }

export function App() {
  const [phase, setPhase] = useState<Phase>({ type: "input" })
  const renderer = useRenderer()
  const ctrlCTimer = useRef<ReturnType<typeof setTimeout>>(null)

  const handleSubmitUrl = useCallback(async (url: string) => {
    const cached = findCachedRepo(url)
    if (cached) {
      const repoName = getRepoName(url)
      const children = buildTree(cached)
      setPhase({
        type: "browsing",
        tree: { name: repoName, path: cached, type: "dir", children },
        repoPath: cached,
        repoName,
      })
      return
    }
    setPhase({ type: "cloning" })
    try {
      const repoPath = getTempDir()
      await cloneRepo(url, repoPath)
      const repoName = getRepoName(url)
      const children = buildTree(repoPath)
      setPhase({
        type: "browsing",
        tree: { name: repoName, path: repoPath, type: "dir", children },
        repoPath,
        repoName,
      })
    } catch (e) {
      const message = e instanceof Error ? e.message : "Clone failed"
      setPhase({ type: "error", message })
    }
  }, [])

  const goBack = useCallback(() => {
    setPhase({ type: "input" })
  }, [])

  const exitApp = useCallback(() => {
    renderer.destroy()
  }, [renderer])

  useKeyboard((key) => {
    if (key.ctrl && key.name === "c") {
      if (ctrlCTimer.current) {
        clearTimeout(ctrlCTimer.current)
        ctrlCTimer.current = null
        exitApp()
      } else {
        toast.warning("Press Ctrl+C again to exit")
        ctrlCTimer.current = setTimeout(() => {
          ctrlCTimer.current = null
        }, 3000)
      }
      return
    }
    if (phase.type === "error") {
      if (key.name === "enter" || key.name === "return") {
        setPhase({ type: "input" })
      }
      if (key.name === "escape") {
        setPhase({ type: "input" })
      }
    }
  })

  const renderContent = () => {
    switch (phase.type) {
      case "input":
        return <UrlInputScreen onSubmit={handleSubmitUrl} />
      case "cloning":
        return (
          <box
            flexDirection="column"
            alignItems="center"
            justifyContent="center"
            flexGrow={1}
          >
            <LoadingView message="Cloning repository..." />
          </box>
        )
      case "error":
        return (
          <box
            flexDirection="column"
            alignItems="center"
            justifyContent="center"
            flexGrow={1}
          >
            <box
              border
              borderColor="#f7768e"
              paddingX={2}
              paddingY={1}
              width={64}
            >
              <text>
                <span fg="#f7768e"><strong>Error</strong></span>
                <span fg="#565f89">  {phase.message}</span>
              </text>
            </box>
            <box marginTop={1}>
              <text>
                <span fg="#565f89">Enter or Esc to go back</span>
              </text>
            </box>
          </box>
        )
      case "browsing":
        return (
          <TreeBrowser
            root={phase.tree}
            repoName={phase.repoName}
            onBack={goBack}
          />
        )
    }
  }

  return (
    <box width="100%" height="100%">
      {renderContent()}
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            backgroundColor: "#1e1e2e",
            foregroundColor: "#cdd6f4",
            borderColor: "#45475a",
            borderStyle: "rounded",
            paddingX: 2,
            paddingY: 1,
          },
          warning: {
            style: { borderColor: "#f9e2af" },
          },
        }}
      />
    </box>
  )
}
