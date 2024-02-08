import { DocsMap } from "./DocsMap"
import gatherMdnDocs from "./mdn"

export function gatherDocs(docs: DocsMap) {
    gatherMdnDocs(docs)
    return docs
}

export const DOCS = gatherDocs(new DocsMap())