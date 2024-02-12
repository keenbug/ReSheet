import { DocsMap } from "."
import blocksDocs from "../blocks/docs"
import { gatherDocs as externalDocs } from "./external"

export default function gatherDocs(docs: DocsMap) {
    blocksDocs(docs)
    externalDocs(docs)
}