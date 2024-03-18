import { DocsMap } from "@resheet/docs"
import blocksDocs from "@resheet/blocks/docs"
import { gatherDocs as externalDocs } from "@resheet/docs/external"

export default function gatherDocs(docs: DocsMap) {
    blocksDocs(docs)
    externalDocs(docs)
}