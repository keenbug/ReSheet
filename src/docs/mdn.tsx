import mdnContent from "./sources/mdn/js-global-objects"
import { DocsMap } from "./DocsMap"

import Markdown from 'markdown-to-jsx'
import styled from "styled-components"

const StyledMarkdown = styled(Markdown)`
    font-size: 0.875rem;

    & h1 {
        font-size: 1.5rem;
    }

    & h2 {
        font-size: 1.3rem;
        margin-top: 1.5rem;
    }

    & h3 {
        font-size: 1rem;
        margin-top: 1.5rem;
    }

    & h4 {
        font-size: 0.72rem;
    }

    & h5 {
        font-size: 0.55rem;
    }

    & h6 {
        font-size: 0.48rem;
    }

    & p {
        margin: 0.75rem 0;
    }
`

const MATCH_KUMASCRIPT = /{{(\w+)(\((?:\s*(?:"[^"]*"|\d+)\s*,?\s*)*\))?}}/
const MATCH_ARG = /"([^"]*|\d+)"/g
function matchArgs(str: string) {
    const args = []
    let match: RegExpExecArray
    while (match = MATCH_ARG.exec(str)) {
        args.push(match[1])
    }
    return args
}

const MDN_KUMA_FUNCS = {
    jsxref(name: string) {
        return '*' + name.replace(/\//g, '.') + '*'
    },
    domxref(name: string) {
        return '*' + name + '*'
    },

    Glossary(name: string) {
        return name
    },

    Deprecated_Header() {
        return '<div className="font-bold bg-red-50 text-red-800 text-base">Deprecated</div>'
    },

    JSRef() { return '' },
    jsSidebar() { return '' },
    EmbedInteractiveExample() { return '' },
    js_property_attributes() { return '' },
    optional_inline() { return '' },
}

function docsRenderer(docs: string) {
    const rendered = docs
        .replace(/^---$.*^---$/ms, '')
        .replace(new RegExp(MATCH_KUMASCRIPT, 'g'), str => {
            const [, func, argsStr] = str.match(MATCH_KUMASCRIPT)
            if (MDN_KUMA_FUNCS[func]) {
                const args = matchArgs(argsStr)
                return MDN_KUMA_FUNCS[func](...args)
            }
            else {
                return str
            }
        })
        .replace(/(^#+\s+Specifications$.*)|(^#+\s+Browser compatibility$.*)|(^#+\s+See also$.*)/ms, '')

    const sourcePath = docs
        .match(/^---$(.*)^---$/ms)[1]
        ?.match(/^slug:\s+(.+)$/m)?.[1]
    const sourceLink = `https://developer.mozilla.org/en-US/docs/${sourcePath ?? ''}`

    return function MDNDoc() {
        return (
            <div>
                <StyledMarkdown>{rendered}</StyledMarkdown>
                <p className="text-xs my-2"><a className="text-blue-800" href={sourceLink}>Source: MDN</a></p>
            </div>
        )
    }
}

function getSafe(obj: Object, property: string) {
    try { return obj[property] }
    catch (e) { return undefined }
}

export default function gatherMdnDocs(docs: DocsMap) {
    for (const globalName of Object.getOwnPropertyNames(globalThis)) {
        const globalVar = getSafe(globalThis, globalName)
        const globalDocsKey = globalName.toLowerCase()
        if (mdnContent[globalDocsKey]?.[globalDocsKey]?.['index.md']) {
            docs.set(globalVar, docsRenderer(mdnContent[globalDocsKey][globalDocsKey]['index.md']))
        }
        else if (mdnContent[globalDocsKey]?.['index.md']) {
            docs.set(globalVar, docsRenderer(mdnContent[globalDocsKey]['index.md']))
        }
        if (globalVar !== null && typeof globalVar === 'object') {
            for (const objectProperty of Object.getOwnPropertyNames(globalVar)) {
                const propertyDocsKey = objectProperty.toLowerCase()
                if (mdnContent[globalDocsKey]?.[propertyDocsKey]?.['index.md']) {
                    docs.set(getSafe(globalVar, objectProperty), docsRenderer(mdnContent[globalDocsKey][propertyDocsKey]['index.md']))
                }
            }
        }
        if (typeof globalVar === 'function' && globalVar !== Function) {
            // For classes:
            const proto = globalVar.prototype
            if (proto) {
                for (const protoProperty of Object.getOwnPropertyNames(proto)) {
                    const propertyDocsKey = protoProperty.toLowerCase()
                    if (mdnContent[globalDocsKey]?.[propertyDocsKey]?.['index.md']) {
                        docs.set(getSafe(proto, protoProperty), docsRenderer(mdnContent[globalDocsKey][propertyDocsKey]['index.md']))
                    }
                }
            }
        }
    }
}