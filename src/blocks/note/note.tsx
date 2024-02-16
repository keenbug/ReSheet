import * as React from 'react'

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import * as solidIcons from '@fortawesome/free-solid-svg-icons'
import * as regularIcons from '@fortawesome/free-regular-svg-icons'
import Markdown from 'markdown-to-jsx'

import * as block from '../../block'
import { resultFrom } from '../../logic/result'
import { computeExpr, parseJSExpr } from '../../logic/compute'

import { ViewResult } from '../../ui/value'
import { BlockPreview } from '../block-selector/ui'

import { NoteType } from './versioned'


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

export function evaluateNote(input: string, env: block.Environment, updateNote: block.BlockUpdater<NoteType>): NoteType {
    const updateExprResult = block.updateCaseField({ type: 'expr' }, 'result', updateNote)
    const updateBlockResult = block.updateCaseField({ type: 'block', isInstantiated: false}, 'result', updateNote)

    if (input.startsWith(EXPR_PREFIX)) {
        const expr = input.slice(EXPR_PREFIX.length)
        const value = computeExpr(expr, env)
        const result = resultFrom(value, block.updaterToSetter(updateExprResult))
        return { type: 'expr', code: expr, result }
    }

    if (input.startsWith(BLOCK_PREFIX)) {
        const expr = input.slice(BLOCK_PREFIX.length)
        const value = computeExpr(expr, env)
        const result = resultFrom(value, block.updaterToSetter(updateBlockResult))
        return { type: 'block', isInstantiated: false, code: expr, result }
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


export function recomputeNote(input: string, note: NoteType, update: block.BlockUpdater<NoteType>, env: block.Environment): NoteType {
    if (note.type === 'expr' && note.result.type === 'promise') {
        note.result.cancel()
    }
    else if (note.type === 'block' && note.isInstantiated === false && note.result.type === 'promise') {
        note.result.cancel()
    }

    if (note.type === 'block' && note.isInstantiated === true) {
        const updateBlockState = block.updateCaseField({ type: 'block', isInstantiated: true }, 'state', update)

        return {
            ...note,
            state: note.block.recompute(note.state, updateBlockState, env),
        }
    }

    return evaluateNote(input, env, update)
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
            return <ViewResult result={note.result} />
        }

        const innerBlock = note.result.value
        return (
            <>
                <ViewResult result={note.result} />
                <BlockPreview block={innerBlock} env={env} onChooseBlock={instantiateBlock} />
            </>
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