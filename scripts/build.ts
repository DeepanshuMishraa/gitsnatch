const result = await Bun.build({
	entrypoints: ["src/index.tsx"],
	external: [
		"@opentui/core",
		"@opentui/react",
		"@opentui/react/jsx-dev-runtime",
		"@opentui/react/jsx-runtime",
		"@opentui-ui/dialog",
		"@opentui-ui/dialog/react",
		"opentui-spinner",
		"opentui-spinner/react",
		"react",
	],
	format: "esm",
	outdir: "dist",
	target: "bun",
})

if (!result.success) {
	for (const log of result.logs) console.error(log)
	process.exit(1)
}
