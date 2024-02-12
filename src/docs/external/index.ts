import { DocsMap } from ".."
import gatherMdnDocs from "./mdn"

export function gatherDocs(docs: DocsMap) {
    gatherMdnDocs(docs)
}