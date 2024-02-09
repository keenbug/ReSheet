import * as React from 'react'
import { Tab } from '@headlessui/react'
import { VList, VListHandle } from 'virtua'

import babelGenerator from '@babel/generator'
import * as babel from '@babel/types'

import * as block from '../block'
import { computeExprUNSAFE, parseJSExpr } from '../logic/compute'
import { DOCS } from '../docs'

import { Keybinding, Keybindings } from '../ui/shortcuts'
import { ValueInspector } from '../ui/value'
import { SearchResult, matchSearch, renderMatch, useSearchResults } from '../ui/search'
import { useSelectionRect } from '../ui/hooks'

import { CodeEditorHandle } from '.'
import { SplitText, splitByPosition } from './useEditable'


export type CompletionTab = 'value' | 'docs'

// The resulting ui should lie anywhere near codeEditor, where both have the same relative parent
export function useCompletionsOverlay(codeEditor: React.RefObject<CodeEditorHandle>, code: string, env: block.Environment, codeOffset: number = 0) {
    const [completionVisibilty, setCompletionVisibility] = React.useState<CompletionTab | null>(null)
    const completionsRef = React.useRef<CompletionsHandle>(null)

    function findDocsFor(value: any) {
        return DOCS.get(value)
    }

    const shortcuts: Keybindings = [
        {
            description: "completions",
            bindings: [
                [["C-Space"],   'none', 'toggle', () => { setCompletionVisibility(visibility => visibility !== 'value' ? 'value' : null) }],
                [["C-D"],       'none', 'docs',   () => { setCompletionVisibility(visibility => visibility !== 'docs' ? 'docs' : null) }],
                ...(completionVisibilty ? [
                    [["ArrowUp", "C-P"],   'none', 'previous', () => { completionsRef.current?.moveSelection(-1) }],
                    [["ArrowDown", "C-N"], 'none', 'next',     () => { completionsRef.current?.moveSelection(1) }],
                    [["Tab"],              'none', 'complete', () => { completionsRef.current && onComplete(completionsRef.current.selected, completionsRef.current.offset) }],
                    [["Escape"],           'none', 'close',    () => { setCompletionVisibility(null) }],
                ] : []) as Keybinding[]
            ]
        }
    ]

    const selectionRect = useSelectionRect(codeEditor.current?.element)
    const relativeRect = codeEditor.current?.element?.offsetParent?.getBoundingClientRect()
    const caretRect = selectionRect && relativeRect && (
        new DOMRect(
            selectionRect.x - relativeRect.x,
            selectionRect.y - relativeRect.y,
            selectionRect.width,
            selectionRect.height,
        )
    )
    const position = codeEditor.current?.editable?.getState?.()?.position ?? { start: 0, end: 0 }
    const correctedPosition = { start: position.start - codeOffset, end: position.end - codeOffset }
    const splitCode = splitByPosition(code, correctedPosition)

    function onComplete(searchResult: SearchResult<Completion>, offset: number) {
        if (!codeEditor.current) { return }
        // Important! The .edit() has to occur before any React state updates
        // (eg setCompletionVisible) is called, otherwise the DOM state and
        // React's Virtual DOM diverge. Somehow the React update interferes with
        // the MutationObserver inside the editable, which then doesn't register
        // the changes by .edit() and so can't do its magic.
        codeEditor.current.editable.edit(searchResult.candidate.name, -matchSearch(searchResult.match).length, -offset)
    }


    function onBlur(event: React.FocusEvent) {
        if (!event.currentTarget.contains(event.relatedTarget)) {
            setCompletionVisibility(null)
        }
    }

    const ui = completionVisibilty && caretRect && (
        <div
            className="border border-gray-300 bg-gray-50 shadow shadow-gray-200"
            style={{
                position: 'absolute',
                left: caretRect.left + 'px',
                top: caretRect.bottom + 'px',
            }}
        >
            <Completions
                ref={completionsRef}
                splitCode={splitCode}
                env={env}
                onSelectSearchResult={onComplete}
                tab={completionVisibilty}
                onChangeTab={setCompletionVisibility}
                docs={findDocsFor}
                />
        </div>
    )

    return {
        onBlur,
        shortcuts,
        ui,
    }
}


export interface Completion extends PropertyDescriptor {
    name: string
    object: Object
}

export const EXCLUDED_PROTOTYPE_COMPLETIONS = new Set([
    Object.prototype,
])

export function propertyCompletions(object: Object) {
    if (object === null) { return [] }
    const proto = Object.getPrototypeOf(object)
    return (
        Object.entries({
            ...(
                EXCLUDED_PROTOTYPE_COMPLETIONS.has(proto) ? {}
                : Object.getOwnPropertyDescriptors(proto)
            ),
            ...Object.getOwnPropertyDescriptors(object),
        })
            .map(([name, desc]) =>
                ({ ...desc, name, object })
            )
    )
}

export function getCompletionValue(completion: Completion) {
    try {
        if (Object.getOwnPropertyDescriptor(completion, 'value') !== undefined) {
            return completion.value
        }
        if (Object.getOwnPropertyDescriptor(completion, 'get') !== undefined) {
            return completion.get.apply(completion.object)
        }
        return undefined
    }
    catch (e) { return e }
}



type CompletionOptions = { search: string, options: Completion[], end: number }
const noCompletionOptions: CompletionOptions = { search: '', options: [], end: 0 }

function findCompletions(expr: babel.Expression, env: block.Environment): CompletionOptions {
    try {
        if (expr.type === 'MemberExpression' && expr.property.type === 'Identifier') {
            const obj = computeExprUNSAFE(babelGenerator(expr.object).code, env)
            return { search: expr.property.name, options: propertyCompletions(obj), end: expr.end }
        }
        // Top-level variable access?
        if (expr.type === 'Identifier') {
            return { search: expr.name, options: [ ...propertyCompletions(env), ...propertyCompletions(globalThis) ], end: expr.end }
        }
        if (expr.type === 'CallExpression' && expr.callee.type !== 'V8IntrinsicIdentifier') {
            return findCompletions(expr.callee, env)
        }
        if (expr.type === 'NewExpression' && expr.callee.type !== 'V8IntrinsicIdentifier') {
            return findCompletions(expr.callee, env)
        }
    }
    catch (e) {}

    return noCompletionOptions
}



export interface CompletionsProps {
    splitCode: SplitText
    env: block.Environment
    onSelectSearchResult(searchResult: SearchResult<Completion>, offset: number): void
    tab: CompletionTab
    onChangeTab(tab: CompletionTab): void
    docs?: DocsProvider
}

export const Completions = React.forwardRef(function Completions(
    { splitCode, env, onSelectSearchResult, tab, onChangeTab, docs }: CompletionsProps,
    ref: React.Ref<CompletionsHandle>,
) {
    const allBefore = [
        ...splitCode.linesBefore,
        splitCode.lineBefore
    ].join('\n')
    const parsed = looseParseCode(allBefore)
    const search = (parsed && findCompletions(parsed, env)) ?? noCompletionOptions
    return (
        <RenderCompletions
            ref={ref}
            completionOptions={search}
            offset={allBefore.length - search.end}
            onSelectSearchResult={onSelectSearchResult}
            tab={tab}
            onChangeTab={onChangeTab}
            docs={docs}
            />
    )
})

function looseParseCode(code: string) {
    const missingDoubleQuote = countNotInString(code, '"') ? '"' : ''
    const missingQuote = countNotInString(code, `'`) ? `'` : ''
    const missingStringEnd = missingDoubleQuote + missingQuote

    const leftParens = countNotInString(code, '(')
    const rightParens = countNotInString(code, ')')
    const missingParens = ')'.repeat(Math.max(0, leftParens - rightParens))
    const parseWholeFunction = missingParens.length > 0 && /[\(,]\s*$/.test(code)

    for (let suffix = code; suffix.length > 0; suffix = suffix.slice(1)) {
        if (parseWholeFunction) {
            try { return parseCurrentExpression(suffix + missingStringEnd + missingParens) }
            catch (e) {}
        }
        try { return parseCurrentExpression(suffix + missingStringEnd) }
        catch (e) {}
    }
}

function parseCurrentExpression(code: string) {
    if (code.trim() === '') {
        return babel.identifier('')
    }
    // looks like an incomplete member access?
    else if (code.slice(-1) === '.') {
        return babel.memberExpression(
            parseJSExpr(code.slice(0, -1)),
            babel.identifier('')
        )
    }
    else {
        return parseJSExpr(code)
    }
}



export interface CompletionsHandle {
    select(index: number): void
    moveSelection(delta: number): void
    selected: SearchResult<Completion>
    offset: number
}

export interface RenderCompletionsProps {
    completionOptions: CompletionOptions
    offset: number
    onSelectSearchResult(searchResult: SearchResult<Completion>, offset: number): void
    tab: CompletionTab
    onChangeTab(tab: CompletionTab): void
    docs?: DocsProvider
}

export type DocsProvider = (value: any) => undefined | React.FC

export const RenderCompletions = React.forwardRef(function RenderCompletions(
    { completionOptions: completionSearch, offset, onSelectSearchResult, tab, onChangeTab, docs = () => undefined }: RenderCompletionsProps,
    ref: React.Ref<CompletionsHandle>,
) {
    const vlistRef = React.useRef<VListHandle>(null)

    const scrollTo = React.useCallback(function scrollTo(index: number) {
        vlistRef.current?.scrollToIndex?.(index, { align: 'nearest' })
    }, [vlistRef])

    const { setRef, results, selected, moveSelection, select } = (
        useSearchResults(completionSearch.search, completionSearch.options, completionName, scrollTo)
    )

    React.useImperativeHandle(ref,
        () => ({
            select,
            moveSelection,
            selected: results[selected],
            offset,
        }),
        [moveSelection, select, results, selected, offset],
    )

    const selectedDocs = results.length > selected && docs(getCompletionValue(results[selected].candidate))
    const selectedValue = results.length > selected ? getCompletionValue(results[selected].candidate) : undefined
    const TABS = {
        value: {
            panel: (
                <Tab.Panel key="value">
                    <ValueInspector value={selectedValue} expandLevel={1} />
                </Tab.Panel>
            ),
            button: (
                <Tab
                    key="value"
                    className={({ selected }) => `
                        flex-1 rounded-lg text-center m-1
                        ${selected ? 'bg-white shadow font-medium' : 'text-gray-600'}
                    `}
                >
                    value
                </Tab>
            ),
        },
        docs: {
            panel: (
                <Tab.Panel key="docs">
                    {selectedDocs ?
                        React.createElement(selectedDocs)
                    :
                        <div className="italic text-center text-sm text-gray-700">No documentation found</div>
                    }
                </Tab.Panel>
            ),
            button: (
                <Tab
                    key="docs"
                    className={({ selected }) => `
                        flex-1 rounded-lg text-center m-1
                        ${
                            selected ? 'bg-white shadow font-medium'
                            : 'text-gray-600'
                        }
                    `}
                >
                    docs
                </Tab>
            ),
        },
    }
    const tabIndex = Object.keys(TABS).indexOf(tab)
    function onChangeTabIndex(index: number) {
        onChangeTab((Object.keys(TABS) as CompletionTab[])[index])
    }

    return (
        <div className="flex flex-row items-stretch" onPointerDown={event => event.preventDefault()}>
            <VList ref={vlistRef} style={{ height: "12rem", width: "12rem" }} className="flex flex-col items-stretch overflow-auto">
                {results.length === 0 &&
                    <div className="italic text-gray-700 text-xs text-center">No completions</div>
                }
                {results.map((result, index) => (
                    <div
                        ref={setRef(result.id)}
                        key={result.id}
                        className={`cursor-pointer px-1 ${index === selected && 'bg-gray-200'}`}
                        onPointerDown={() => {
                            if (selected === index) { onSelectSearchResult(results[index], offset) }
                            else { select(index, false) }
                        }}
                    >
                        <code className="text-xs">
                            {renderMatch(result.match)}
                        </code>
                    </div>
                ))}
            </VList>
            {results.length > selected &&
                <div className="w-96 flex flex-col max-h-[12rem] border-l border-gray-100">
                    <Tab.Group selectedIndex={tabIndex} onChange={onChangeTabIndex}>
                        <Tab.Panels className="flex-1 p-1 overflow-auto bg-white">
                            {Object.values(TABS).map(tab => tab.panel)}
                        </Tab.Panels>
                        <Tab.List className="flex flex-row items-stretch text-xs bg-gray-50">
                            {Object.values(TABS).map(tab => tab.button)}
                        </Tab.List>
                    </Tab.Group>
                </div>
            }
        </div>
    )
})

function completionName(completion: Completion) {
    return completion.name
}

function countNotInString(str: string, char: string) {
    const findStringRegex = /"(\\.|[^\\"])*"|'(\\.|[^\\'])*'|`(\\.|[^\\`])*`/g
    return str.replace(findStringRegex, '').split('').filter(c => c === char).length
}
