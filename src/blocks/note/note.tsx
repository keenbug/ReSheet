import * as React from 'react'

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import * as solidIcons from '@fortawesome/free-solid-svg-icons'
import * as regularIcons from '@fortawesome/free-regular-svg-icons'

import { Set as ISet } from 'immutable'

import * as block from '@resheet/core/block'

import { getResultValue, resultFrom } from '@resheet/code/result'
import { Compiled, compileJSExprSafe, parseJSExpr } from '@resheet/code/compute'
import { ViewResult } from '@resheet/code/value'

import { safeBlock } from '../component'

import { NoteType } from './versioned'

import { EditableMarkdown, compileMarkdown } from './markdown'


export function getCode(note: NoteType) {
    switch (note.type) {
        case 'expr':
        case 'block':
            return note.code

        default:
            return null
    }
}

export function getPrefix(type: NoteType['type'], input: string) {
    switch (type) {
        case 'expr': return input.match(EXPR_REGEX)[0]
        case 'block': return input.match(BLOCK_REGEX)[0]
        default: return ''
    }
}


export const EXPR_REGEX = /^\s*=/
export const BLOCK_REGEX = /^\s*\//

export function evaluateNote(
    input: string,
    env: block.Environment,
    dispatchNote: block.BlockDispatcher<NoteType>,
    lastNote?: NoteType,
): NoteType {
    const dispatchExprResult = block.dispatchCaseField({ type: 'expr' }, 'result', dispatchNote)
    const dispatchBlockResult = block.dispatchCaseField({ type: 'block', isInstantiated: false}, 'result', dispatchNote)

    const parsed = parseNote(input)
    switch (parsed.type) {
        case 'expr': {
            const value = parsed.compiled.run(env)
            const result = resultFrom(value, block.dispatcherToSetter(dispatchExprResult))
            return { type: 'expr', code: parsed.code, compiled: parsed.compiled, result }
        }

        case 'block': {
            const value = parsed.compiled.run(env)
            const result = resultFrom(value, block.dispatcherToSetter(dispatchBlockResult))
            const lastState = (lastNote as any)?.lastState
            return { type: 'block', isInstantiated: false, code: parsed.code, compiled: parsed.compiled, result, lastState }
        }

        case 'checkbox':
        case 'text':
            return parsed
    }
}


type ParsedNote =
    | { type: 'expr', code: string, compiled: Compiled }
    | { type: 'block', code: string, compiled: Compiled }
    | { type: 'checkbox', checked: boolean, text: string }
    | { type: 'text', tag: string, text: string }

export function parseNote(input: string): ParsedNote {
    const exprMatch = input.match(EXPR_REGEX)
    if (exprMatch) {
        const expr = input.slice(exprMatch[0].length)
        const compiled = compileJSExprSafe(expr)
        return { type: 'expr', code: expr, compiled }
    }

    const blockMatch = input.match(BLOCK_REGEX)
    if (blockMatch) {
        const expr = input.slice(blockMatch[0].length)
        const compiled = compileJSExprSafe(expr)
        return { type: 'block', code: expr, compiled }
    }

    const headerMatch = input.match(/^(#{1,6})\s*/)
    if (headerMatch) {
        const level = headerMatch[1].length
        return { type: 'text', tag: `h${level}`, text: input.slice(headerMatch[0].length) }
    }

    const listMatch = input.match(/^[-*]\s+/)
    if (listMatch) {
        return { type: 'text', tag: 'li', text: input.slice(listMatch[0].length) }
    }

    const checkboxMatch = input.match(/^\[[ xX]?\]\s+/)
    if (checkboxMatch) {
        return { type: 'checkbox', checked: /^\[[xX]\]/.test(input), text: input.slice(checkboxMatch[0].length) }
    }

    return { type: 'text', tag: 'p', text: input }
}


export function recomputeNote(
    note: NoteType,
    dispatch: block.BlockDispatcher<NoteType>,
    env: block.Environment,
    changedVars: ISet<string> | null,
): {
    state: NoteType,
    invalidated: boolean,
} {
    switch (note.type) {
        case 'block':
            if (note.isInstantiated === true) {
                const dispatchBlockState = block.dispatchCaseField({ type: 'block', isInstantiated: true }, 'state', dispatch)

                const changedDeps = changedVars?.intersect(note.compiled.deps)
                if (!changedDeps || !changedDeps.isEmpty()) {
                    const newBlock = note.compiled.run(env)
                    if (block.isBlock(newBlock) && newBlock !== note.block.$$UNSAFE_BLOCK) {
                        try {
                            const jsonState = note.block.toJSON(note.state)
                            const newSafeBlock = safeBlock(newBlock)
                            const newState = newSafeBlock.fromJSON(jsonState, dispatchBlockState, env)
                            return {
                                state: {
                                    type: 'block',
                                    isInstantiated: true,
                                    code: note.code,
                                    compiled: note.compiled,
                                    block: newSafeBlock,
                                    state: newState,
                                },
                                invalidated: true,
                            }
                        }
                        catch (e) { /* do nothing */ }
                    }
                }

                const { state, invalidated } = note.block.recompute(note.state, dispatchBlockState, env, changedVars)

                return {
                    state: { ...note, state },
                    invalidated,
                }
            }
            else {
                if (changedVars && changedVars.intersect(note.compiled.deps).isEmpty()) {
                    return { state: note, invalidated: false }
                }

                if (note.result.type === 'promise') { note.result.cancel() }

                const dispatchBlockResult = block.dispatchCaseField({ type: 'block', isInstantiated: false}, 'result', dispatch)
                const value = note.compiled.run(env)
                const result = resultFrom(value, block.dispatcherToSetter(dispatchBlockResult))
                
                if ('loading' in note && block.isBlock(value)) {
                    const dispatchBlockState = block.dispatchCaseField({ type: 'block', isInstantiated: true }, 'state', dispatch)

                    const loadedBlock = safeBlock(value)
                    const state = loadedBlock.fromJSON(note.loading, dispatchBlockState, env)
                    return {
                        state: {
                            type: 'block',
                            isInstantiated: true,
                            code: note.code,
                            compiled: note.compiled,
                            block: loadedBlock,
                            state
                        },
                        invalidated: true,
                    }
                }

                return {
                    state: { ...note, result },
                    invalidated: true,
                }
            }

        case 'expr':
            if (changedVars && changedVars.intersect(note.compiled.deps).isEmpty()) {
                return { state: note, invalidated: false }
            }

            if (note.result.type === 'promise') { note.result.cancel() }

            const dispatchExprResult = block.dispatchCaseField({ type: 'expr' }, 'result', dispatch)
            const value = note.compiled.run(env)
            const result = resultFrom(value, block.dispatcherToSetter(dispatchExprResult))

            return {
                state: { ...note, result },
                invalidated: true,
            }

        case 'text':
        case 'checkbox':
            return { state: note, invalidated: false }
    }
}




export interface ViewNoteProps {
    note: NoteType
    env: block.Environment
    actions: {
        toggleCheckbox(): void
        instantiateBlock(): void
        resetBlock(): void
    }
}

export function ViewNote({ note, env, actions }: ViewNoteProps) {
    switch (note.type) {
        case 'text':
            return <ViewText note={note} />

        case 'checkbox':
            return <ViewCheckbox toggleCheckbox={actions.toggleCheckbox} note={note} />

        case 'expr':
            return <ViewExprResult note={note} />

        case 'block':
            return (
                <ViewBlock
                    instantiateBlock={actions.instantiateBlock}
                    resetBlock={actions.resetBlock}
                    note={note}
                    env={env}
                    />
            )
    }
}



// Text

interface ViewTextProps {
    note: Extract<NoteType, { type: 'text' }>
}

const ViewText = React.memo(
    function ViewText({ note }: ViewTextProps) {
        const content = note.text.trim() === '' ? '\u200B' : note.text
        return (
            React.createElement(
                note.tag,
                { className: `cursor-text whitespace-pre-wrap ${textClasses[note.tag]}` },
                compileMarkdown(content),
            )
        )
    },
    (before, after) => (
        before.note.tag === after.note.tag
        && before.note.text === after.note.text
    ),
)

export const textClasses = {
    h1: "text-5xl mt-6 my-3",
    h2: "text-4xl mt-6 my-3",
    h3: "text-3xl mt-6 my-2",
    h4: "text-2xl mt-4 my-2",
    h5: "text-xl mt-4 my-2",
    h6: "text-lg mt-2 my-1",
    p: "",
}



// Checkbox

interface ViewCheckboxProps {
    note: Extract<NoteType, { type: 'checkbox' }>
    toggleCheckbox(): void
}

const ViewCheckbox = React.memo(
    function ViewCheckbox({ note, toggleCheckbox }: ViewCheckboxProps) {
        const preventFocus = React.useCallback(function preventFocus(event: React.UIEvent) {
            event.stopPropagation()
            event.preventDefault()
        }, [])
        const clickCheckbox = React.useCallback(function clickCheckbox(event: React.UIEvent) {
            event.stopPropagation()
            event.preventDefault()
            toggleCheckbox()
        }, [toggleCheckbox])

        return (
            <div>
                <FontAwesomeIcon
                    onPointerDown={preventFocus}
                    onClick={clickCheckbox}
                    className={`mr-2 cursor-pointer ${note.checked && "text-blue-400"}`}
                    icon={note.checked ? solidIcons.faSquareCheck : regularIcons.faSquare}
                    />
                <EditableMarkdown
                    options={{ wrapper: 'span' }}
                    className={`cursor-text ${note.checked ? "text-gray-400 line-through" : ""}`}
                >
                    {note.text}
                </EditableMarkdown>
            </div>
        )
    },
    (before, after) => (
        before.note.checked === after.note.checked
        && before.note.text === after.note.text
        && before.toggleCheckbox === after.toggleCheckbox
    )
)



// Block

interface ViewBlockProps {
    note: Extract<NoteType, { type: 'block' }>
    env: block.Environment
    instantiateBlock(): void
    resetBlock(): void
}

const ViewBlock = React.memo(
    function ViewBlock({ note, env, instantiateBlock, resetBlock }: ViewBlockProps) {
        if (note.isInstantiated === true) { return null }

        const value = getResultValue(note.result)
        if (!block.isBlock(value)) {
            return (
                <div>
                    <div className="bg-blue-100 px-1">
                        <FontAwesomeIcon className="text-blue-400" icon={solidIcons.faCircleInfo} /> {}
                        Not a Block:
                    </div>
                    <ViewResult result={note.result} />
                </div>
            )
        }

        const innerBlock = safeBlock(value)
        let state = innerBlock.init
        try {
            if (note.lastState !== undefined) {
                // don't use innerBlock (a safeBlock), because we want to
                // handle errors ourselves here
                state = value.fromJSON(note.lastState, () => {}, env)
            }
        }
        catch (e) { /* do nothing */ }

        return (
            <div className="flex flex-col items-stretch rounded py-1 border border-t border-b border-gray-200 bg-gray-100">
                <div className="bg-white flex flex-col justify-center items-stretch min-h-14 overflow-x-auto relative">
                    <innerBlock.Component
                        state={state}
                        dispatch={() => {}}
                        env={env}
                        />
                    <button
                        className={`
                            absolute inset-0 w-full z-10
                            flex flex-col justify-center items-center
                            bg-gray-100/60 text-gray-400/60
                            hover:text-sky-400 hover:backdrop-blur-sm
                            transition-[backdrop-filter,color] duration-75
                        `}
                        onClick={instantiateBlock}
                    >
                        <div className="text-3xl font-bold tracking-[.3em]">PREVIEW</div>
                        <div className="text-xs">Click to instantiate</div>
                    </button>
                    {note.lastState &&
                        <button
                            className="absolute z-10 top-2 right-2 rounded px-1 bg-gray-100 hover:bg-gray-200 hover:text-blue-700"
                            onClick={resetBlock}
                        >
                            Reset
                        </button>
                    }
                </div>
            </div>
        )
    },
    (before, after) => {
        if (
            before.env !== after.env
            || before.instantiateBlock !== after.instantiateBlock
        ) {
            return false
        }

        if (after.note.isInstantiated === true) {
            return (
                before.note.isInstantiated
                && before.note.code === after.note.code
                && before.note.block === after.note.block
                && before.note.state === after.note.state
            )
        }
        else {
            return (
                before.note.isInstantiated === false
                && before.note.code === after.note.code
                && before.note.lastState === after.note.lastState
            )
        }
    },
)

interface ViewBlockInstantiatedProps {
    note: Extract<NoteType, { type: 'block', isInstantiated: true }>
    dispatch: block.BlockDispatcher<NoteType>
    env: block.Environment
}

export const ViewBlockInstantiated = React.memo(
    React.forwardRef<block.BlockHandle, ViewBlockInstantiatedProps>(
        function ViewBlockInstantiated({ note, dispatch, env }, ref) {
            const dispatchBlock = React.useMemo(
                () => block.dispatchCaseField({ type: 'block', isInstantiated: true }, 'state', dispatch),
                [dispatch],
            )

            function onChangeBlockType() {
                dispatch(state => {
                    if (state.type !== 'block' || !state.isInstantiated) {
                        return { state }
                    }
                    return {
                        state: {
                            type: 'block',
                            isInstantiated: false,
                            code: state.code,
                            compiled: state.compiled,
                            result: { type: 'immediate', value: state.block },
                            lastState: state.block.toJSON(state.state),
                        }
                    }
                })
            }

            return (
                <div className="flex flex-col item-stretch rounded pb-1 border border-t border-b border-gray-200 bg-gray-100">
                    <div className="flex flex-row justify-end">
                        <button
                            className="group/note-block-header px-2 py-1 text-xs text-gray-400 hover:text-gray-600"
                            onClick={onChangeBlockType}
                        >
                            {note.code} {}
                            <FontAwesomeIcon className="text-gray-300 group-hover/note-block-header:text-gray-500" icon={solidIcons.faCog} />
                        </button>
                    </div>
                    <div className="bg-white flex flex-col justify-center items-stretch min-h-8 overflow-x-auto overflow-y-hidden">
                        <note.block.Component
                            ref={ref}
                            state={note.state}
                            dispatch={dispatchBlock}
                            env={env}
                            />
                    </div>
                </div>
            )
        }
    ),
    (before, after) => {
        if (before.env !== after.env || before.dispatch !== after.dispatch) {
            return false
        }

        if (after.note.isInstantiated) {
            return (
                before.note.isInstantiated
                && before.note.code === after.note.code
                && before.note.block === after.note.block
                && before.note.state === after.note.state
            )
        }
        else {
            return (
                !before.note.isInstantiated
                && before.note.code === after.note.code
            )
        }
    },
)


// Expression

interface ViewExprResultProps {
    note: Extract<NoteType, { type: 'expr' }>
}

const ViewExprResult = React.memo(
    function ViewExprResult({ note }: ViewExprResultProps) {
        if (note.code.trim() === '') { return null }
        if (isLiteral(note.code)) { return null }

        return <ViewResult result={note.result} />
    },
    (before, after) => (
        before.note.code === after.note.code
        && before.note.result === after.note.result
    ),
)


const JS_LITERALS = [
    "StringLiteral",
    "NumericLiteral",
    "BigIntLiteral",
    "BooleanLiteral",
    "NullLiteral",
    "RegExpLiteral"
]

function isLiteral(expr: string) {
    try {
        const type = parseJSExpr(expr).type
        return JS_LITERALS.includes(type)
    }
    catch (e) {
        // Catch syntax errors
        return false
    }
}