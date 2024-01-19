// Original: https://raw.githubusercontent.com/PrismJS/prism/master/themes/prism.css
import type { PrismTheme } from "prism-react-renderer"
const theme: PrismTheme = {
	plain: {
		color: "black",
	},
	styles: [
		{
			types: ["comment", "prolog", "doctype", "cdata"],
			style: {
				color: "slategray",
			}
		},
		{
			types: ["punctuation"],
			style: {
				color: "#999",
			}
		},
		{
			types: ["namespace"],
			style: {
				opacity: .7,
			}
		},
		{
			types: ["property", "tag", "boolean", "number", "constant", "symbol", "deleted"],
			style: {
				color: "#905",
			}
		},
		{
			types: ["selector", "attr-name", "string", "char", "builtin", "inserted"],
			style: {
				color: "#690",
			}
		},
		{
			types: ["operator", "entity", "url"],
			style: {
				color: "#9a6e3a",
			}
		},
		{
			types: ["atrule", "attr-value", "keyword"],
			style: {
				color: "#07a",
			}
		},
		{
			types: ["function", "class-name"],
			style: {
				color: "#DD4A68",
			}
		},
		{
			types: ["regex", "important", "variable"],
			style: {
				color: "#e90",
			}
		},
		{
			types: ["important", "bold"],
			style: {
				fontWeight: "bold",
			}
		},
		{
			types: ["italic"],
			style: {
				fontStyle: "italic",
			}
		},
		{
			types: ["entity"],
			style: {
				cursor: "help",
			}
		},
	]
}
export default theme