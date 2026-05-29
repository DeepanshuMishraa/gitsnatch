import { copyFileSync, cpSync, existsSync, rmSync, statSync, mkdtempSync, readdirSync, readFileSync } from "fs"
import { join, basename } from "path"
import { tmpdir } from "os"

const tempDirs: string[] = []

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url)
    u.pathname = u.pathname.replace(/\/+$/, "")
    return u.toString()
  } catch {
    return url.replace(/\/+$/, "")
  }
}

export function getTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "gitsnatch-"))
  tempDirs.push(dir)
  return dir
}

export async function cloneRepo(url: string, dest: string): Promise<void> {
  const proc = Bun.spawn(["git", "clone", "--depth", "1", url, dest], {
    stdio: ["ignore", "pipe", "pipe"],
  })
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    proc.kill()
  }, 120_000)
  try {
    const exitCode = await proc.exited
    if (exitCode !== 0 && exitCode !== null) {
      const stderr = await new Response(proc.stderr).text()
      throw new Error(stderr || "Failed to clone repository")
    }
    if (timedOut) {
      throw new Error("Clone timed out after 120 seconds")
    }
  } catch (e) {
    if (timedOut) {
      throw new Error("Clone timed out after 120 seconds")
    }
    throw e
  } finally {
    clearTimeout(timer)
  }
}

const repoUrlCache = new Map<string, string | null>()

export function findCachedRepo(url: string): string | null {
  const key = normalizeUrl(url)
  const cached = repoUrlCache.get(key)
  if (cached !== undefined) {
    if (cached === null) return null
    if (existsSync(cached)) return cached
    repoUrlCache.delete(key)
  }
  const tmp = tmpdir()
  let entries: string[]
  try {
    entries = readdirSync(tmp).filter((e) => e.startsWith("gitsnatch-"))
  } catch {
    return null
  }
  for (const entry of entries) {
    const dir = join(tmp, entry)
    const gitConfig = join(dir, ".git", "config")
    if (!existsSync(gitConfig)) continue
    try {
      const config = readFileSync(gitConfig, "utf-8")
      for (const line of config.split("\n")) {
        const trimmed = line.trim()
        if (trimmed.startsWith("url = ")) {
          const configUrl = trimmed.slice(6)
          if (normalizeUrl(configUrl) === key) {
            if (!tempDirs.includes(dir)) tempDirs.push(dir)
            repoUrlCache.set(key, dir)
            return dir
          }
        }
      }
    } catch {}
  }
  repoUrlCache.set(key, null)
  return null
}

export function cleanupAllTempDirs(): void {
  for (const dir of [...new Set(tempDirs)]) {
    try {
      rmSync(dir, { recursive: true, force: true })
    } catch {}
  }
  tempDirs.length = 0
  repoUrlCache.clear()
}

export function downloadItem(sourcePath: string): { success: boolean; message: string } {
  if (!existsSync(sourcePath)) {
    return { success: false, message: `File not found: ${sourcePath}` }
  }

  const cwd = process.cwd()

  const name = basename(sourcePath)
  const dest = join(cwd, name)

  try {
    const info = statSync(sourcePath)
    if (info.isDirectory()) {
      if (existsSync(dest)) rmSync(dest, { recursive: true, force: true })
      cpSync(sourcePath, dest, { recursive: true })
    } else {
      copyFileSync(sourcePath, dest)
    }
    if (!existsSync(dest)) {
      return { success: false, message: "Download failed: destination not created" }
    }
    return { success: true, message: `Saved: ${dest}` }
  } catch (e) {
    return {
      success: false,
      message: e instanceof Error ? e.message : "Download failed",
    }
  }
}
