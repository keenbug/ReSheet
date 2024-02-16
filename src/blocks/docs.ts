import { DocsMap } from "../docs"

import { gatherDocs as jsexprDocs } from "./js"
import selectorDocs from "./block-selector/docs"
import sheetDocs from "./sheet/docs"
import noteDocs from './note/docs'

export default function gatherDocs(docs: DocsMap) {
    jsexprDocs(docs)
    selectorDocs(docs)
    sheetDocs(docs)
    noteDocs(docs)
}