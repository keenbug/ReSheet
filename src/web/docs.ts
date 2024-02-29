import { DocsMap } from "@tables/docs"
import blocksDocs from "@tables/blocks/docs"
import { gatherDocs as externalDocs } from "@tables/docs/external"

export default function gatherDocs(docs: DocsMap) {
    blocksDocs(docs)
    externalDocs(docs)
}