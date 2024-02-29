import { DocsMap } from "@tables/docs"
import gatherMdnDocs from "./mdn"

export function gatherDocs(docs: DocsMap) {
    gatherMdnDocs(docs)
}