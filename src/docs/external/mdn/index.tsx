import mdnContent from "./js-global-objects"
import { DocsMap } from "../.."

import { MarkdownToJSX, RuleType } from 'markdown-to-jsx'
import { DocMarkdown } from "../../ui"
import { CodeView } from "../../../code-editor"

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
        return '`' + name.replace(/\//g, '.') + '`'
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

function renderMarkdown(next: () => React.ReactChild, node: MarkdownToJSX.ParserResult, renderChildren: MarkdownToJSX.RuleOutput, state: MarkdownToJSX.State) {
    // FIXME: I'd like to use RuleType.link, but the combination of RuleType
    // being a const enum and tsc isolatedModules does not allow it. I hope this
    // gets fixed in a future version of markdown-to-jsx
    switch (node.type) {
        case '3': { // [RuleType.codeBlock]
            const lang = { 'js-nolint': 'js' }[node.lang] ?? node.lang
            return (
                <pre className="my-1 p-1 bg-gray-50 border border-gray-100 rounded">
                    <CodeView language={lang} code={node.text} />
                </pre>
            )
        }

        case '5': // [RuleType.codeInline]
            return (
                <code className="bg-gray-50 shadow-gray-200 shadow-[0_0_2px_1px_var(--tw-shadow-color)] rounded px-0.5">{node.text}</code>
            )
        
        case '15': { // [RuleType.link]
            const target = node.target.startsWith('/') ? 'https://developer.mozilla.org' + node.target : node.target
            return (
                <a title={node.title} target="_blank" href={target}>
                    {renderChildren(node.children, state)}
                </a>
            )
        }
    }
    return next()
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
        .replace(/^#+\s+Specifications$\n(^$\n|^[^#\n].*$\n)*/m, '')
        .replace(/^#+\s+Browser compatibility$\n(^$\n|^[^#\n].*$\n)*/m, '')

    const sourcePath = docs
        .match(/^---$(.*)^---$/ms)[1]
        ?.match(/^slug:\s+(.+)$/m)?.[1]
    const sourceLink = `https://developer.mozilla.org/en-US/docs/${sourcePath ?? ''}`

    return function MDNDoc() {
        return (
            <div>
                <DocMarkdown options={{ renderRule: renderMarkdown }}>{rendered}</DocMarkdown>
                <div className="text-xs mt-4">
                    <a className="text-blue-800" target="_blank" href={sourceLink}>Source: MDN</a>
                </div>
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
        if (globalVar !== null && typeof globalVar === 'object' || typeof globalVar === 'function') {
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
                if (mdnContent[globalDocsKey]?.['index.md']) {
                    docs.set(proto, docsRenderer(mdnContent[globalDocsKey]['index.md']))
                }
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