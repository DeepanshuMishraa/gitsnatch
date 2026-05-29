import { useState, useCallback } from "react"

type Props = {
  onSubmit: (url: string) => void
}

export function UrlInputScreen({ onSubmit }: Props) {
  const [value, setValue] = useState("")
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = useCallback(
    (url: string) => {
      try {
        new URL(url)
        setError(null)
        onSubmit(url)
      } catch {
        setError("Invalid URL — enter a full URL like https://github.com/user/repo")
      }
    },
    [onSubmit],
  )

  return (
    <box
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      flexGrow={1}
    >
      <box marginBottom={2}>
        <ascii-font text="GitSnatch" font="tiny" color="#7dcfff" />
      </box>

      <box
        flexDirection="column"
        border
        borderStyle="rounded"
        borderColor="#565f89"
        paddingX={2}
        paddingY={1}
        width={64}
      >
        <box marginBottom={1}>
          <input
            value={value}
            onChange={setValue}
            onSubmit={handleSubmit}
            placeholder="https://github.com/user/repo"
            focused
            width={60}
            backgroundColor="#1a1b26"
            textColor="#c0caf5"
            cursorColor="#7dcfff"
            focusedBackgroundColor="#24283b"
            placeholderColor="#565f89"
          />
        </box>

        {error && (
          <text>
            <span fg="#f7768e">{error}</span>
          </text>
        )}

        <box marginTop={error ? 0 : 0}>
          <text>
            <span fg="#565f89">Enter to submit</span>
          </text>
        </box>
      </box>
    </box>
  )
}
