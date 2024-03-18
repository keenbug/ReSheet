import { DocsMap } from "@resheet/docs"
import gatherMdnDocs from "./mdn"

export function gatherDocs(docs: DocsMap) {
    gatherMdnDocs(docs)
}