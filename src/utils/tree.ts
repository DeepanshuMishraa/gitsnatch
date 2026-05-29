import { readdirSync, statSync } from "fs"
import { join } from "path"

export type TreeNode = {
  name: string
  path: string
  type: "file" | "dir"
  children: TreeNode[]
}

export function buildTree(dirPath: string): TreeNode[] {
  const entries = readdirSync(dirPath)
  const filtered = entries.filter((name) => name !== ".git")

  filtered.sort((a, b) => {
    const aPath = join(dirPath, a)
    const bPath = join(dirPath, b)
    const aIsDir = statSync(aPath).isDirectory()
    const bIsDir = statSync(bPath).isDirectory()
    if (aIsDir && !bIsDir) return -1
    if (!aIsDir && bIsDir) return 1
    return a.localeCompare(b)
  })

  return filtered.map((name) => {
    const path = join(dirPath, name)
    const stats = statSync(path)
    if (stats.isDirectory()) {
      return {
        name,
        path,
        type: "dir" as const,
        children: buildTree(path),
      }
    }
    return {
      name,
      path,
      type: "file" as const,
      children: [],
    }
  })
}

export type FlatNode = {
  name: string
  path: string
  type: "file" | "dir"
  depth: number
  expanded: boolean
  hasChildren: boolean
}

export function flattenTree(
  nodes: TreeNode[],
  expanded: Set<string>,
  depth: number = 0,
): FlatNode[] {
  const result: FlatNode[] = []
  for (const node of nodes) {
    const isExpanded = expanded.has(node.path)
    result.push({
      name: node.name,
      path: node.path,
      type: node.type,
      depth,
      expanded: isExpanded,
      hasChildren: node.children.length > 0,
    })
    if (node.type === "dir" && isExpanded) {
      result.push(...flattenTree(node.children, expanded, depth + 1))
    }
  }
  return result
}

export function getRepoName(url: string): string {
  const name = url.split("/").pop() || "repository"
  return name.replace(/\.git$/, "")
}
