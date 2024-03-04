import * as React from 'react'

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import * as solidIcons from '@fortawesome/free-solid-svg-icons'
import * as regularIcons from '@fortawesome/free-regular-svg-icons'
import Markdown from 'markdown-to-jsx'

import * as block from '@tables/core/block'

import { resultFrom } from '@tables/code/result'
import { computeExpr, parseJSExpr } from '@tables/code/compute'
import { ViewResult } from '@tables/code/value'

import { NoteType } from './versioned'
import { safeBlock } from '../component'


export function getCode(note: NoteType) {
    switch (note.type) {
        case 'expr':
        case 'block':
            return note.code

        default:
            return null
    }
}

export function getPrefix(note: NoteType) {
    switch (note.type) {
        case 'expr': return EXPR_PREFIX
        case 'block': return BLOCK_PREFIX
        default: return ''
    }
}


export const EXPR_PREFIX = '='
export const BLOCK_PREFIX = '/'

export function evaluateNote(input: string, env: block.Environment, dispatchNote: block.BlockDispatcher<NoteType>, lastNote?: NoteType): NoteType {
    const dispatchExprResult = block.dispatchCaseField({ type: 'expr' }, 'result', dispatchNote)
    const dispatchBlockResult = block.dispatchCaseField({ type: 'block', isInstantiated: false}, 'result', dispatchNote)

    if (input.startsWith(EXPR_PREFIX)) {
        const expr = input.slice(EXPR_PREFIX.length)
        const value = computeExpr(expr, env)
        const result = resultFrom(value, block.dispatcherToSetter(dispatchExprResult))
        return { type: 'expr', code: expr, result }
    }

    if (input.startsWith(BLOCK_PREFIX)) {
        const expr = input.slice(BLOCK_PREFIX.length)
        const value = computeExpr(expr, env)
        const result = resultFrom(value, block.dispatcherToSetter(dispatchBlockResult))
        const lastState = (lastNote as any)?.lastState
        return { type: 'block', isInstantiated: false, code: expr, result, lastState }
    }

    const header = input.match(/^(#{1,6})\s*/)
    if (header) {
        const level = header[1].length
        return { type: 'text', tag: `h${level}`, text: input.slice(header[0].length) }
    }

    const list = input.match(/^[-*]\s+/)
    if (list) {
        return { type: 'text', tag: 'li', text: input.slice(list[0].length) }
    }

    const checkbox = input.match(/^\[[ xX]?\]\s+/)
    if (checkbox) {
        return { type: 'checkbox', checked: /^\[[xX]\]/.test(input), text: input.slice(checkbox[0].length) }
    }

    return { type: 'text', tag: 'p', text: input }
}


export function recomputeNote(input: string, note: NoteType, dispatch: block.BlockDispatcher<NoteType>, env: block.Environment): NoteType {
    if (note.type === 'expr' && note.result.type === 'promise') {
        note.result.cancel()
    }
    else if (note.type === 'block' && note.isInstantiated === false && note.result.type === 'promise') {
        note.result.cancel()
    }

    if (note.type === 'block' && note.isInstantiated === true) {
        const dispatchBlockState = block.dispatchCaseField({ type: 'block', isInstantiated: true }, 'state', dispatch)

        const newBlock = computeExpr(note.code, env)
        if (block.isBlock(newBlock) && newBlock !== note.block.$$UNSAFE_BLOCK) {
            try {
                const jsonState = note.block.toJSON(note.state)
                const newSafeBlock = safeBlock(newBlock)
                const newState = newSafeBlock.fromJSON(jsonState, dispatchBlockState, env)
                return {
                    type: 'block',
                    isInstantiated: true,
                    code: note.code,
                    block: newSafeBlock,
                    state: newState,
                }
            }
            catch (e) { /* do nothing */ }
        }

        return {
            ...note,
            state: note.block.recompute(note.state, dispatchBlockState, env),
        }
    }

    return evaluateNote(input, env, dispatch, note)
}




export interface ViewNoteProps {
    note: NoteType
    env: block.Environment
    isFocused: boolean
    actions: {
        toggleCheckbox(): void
        instantiateBlock(): void
    }
}

export function ViewNote({ note, env, isFocused, actions }: ViewNoteProps) {
    switch (note.type) {
        case 'text':
            return <ViewText note={note} />

        case 'checkbox':
            return <ViewCheckbox toggleCheckbox={actions.toggleCheckbox} note={note} />

        case 'expr':
            return <ViewExprResult note={note} env={env} isFocused={isFocused} />

        case 'block':
            return <ViewBlock instantiateBlock={actions.instantiateBlock} note={note} env={env} />
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
                { className: textClasses[note.tag] },
                <Markdown>{content}</Markdown>
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
    p: "whitespace-pre-wrap"
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
                <Markdown
                    options={{ wrapper: 'span' }}
                    className={note.checked ? "text-gray-400 line-through" : ""}
                >
                    {note.text}
                </Markdown>
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
}

const ViewBlock = React.memo(
    function ViewBlock({ note, env, instantiateBlock }: ViewBlockProps) {
        if (note.isInstantiated === true) { return null }

        if (note.result.type !== 'immediate' || !block.isBlock(note.result.value)) {
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

        const innerBlock = safeBlock(note.result.value)
        let state = innerBlock.init
        try {
            if (note.lastState !== undefined) {
                state = innerBlock.fromJSON(note.lastState, () => {}, env)
            }
        }
        catch (e) { /* do nothing */ }

        return (
            <div className="flex flex-col item-stretch rounded py-1 border border-t border-b border-gray-200 bg-gray-100">
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

interface ViewBlockInstantiatedProps {
    note: Extract<NoteType, { type: 'block', isInstantiated: true }>
    dispatch: block.BlockDispatcher<NoteType>
    env: block.Environment
}

export const ViewBlockInstantiated = React.memo(
    React.forwardRef<block.BlockHandle, ViewBlockInstantiatedProps>(
        function ViewBlockInstantiated({ note, dispatch, env }, ref) {
            const dispatchBlock = block.dispatchCaseField({ type: 'block', isInstantiated: true }, 'state', dispatch)

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
                    <div className="bg-white flex flex-col justify-center items-stretch min-h-8 overflow-x-auto">
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
    env: block.Environment
    isFocused: boolean
}

const ViewExprResult = React.memo(
    function ViewExprResult({ note, env, isFocused }: ViewExprResultProps) {
        if (isLiteral(note.code)) { return null }
        if (note.result.type === 'immediate' && note.result.value === undefined) { return null }

        return <ViewResult result={note.result} />
    },
    (before, after) => (
        before.note.code === after.note.code
        && before.env === after.env
        && before.isFocused === after.isFocused
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