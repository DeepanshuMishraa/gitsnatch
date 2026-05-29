import "opentui-spinner/react"

type Props = {
  message: string
}

export function LoadingView({ message }: Props) {
  return (
    <box
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      flexGrow={1}
    >
      <box alignItems="center" flexDirection="row">
        <spinner name="dots" color="#7dcfff" />
        <text marginLeft={1}>
          <span fg="#565f89">{message}</span>
        </text>
      </box>
    </box>
  )
}
