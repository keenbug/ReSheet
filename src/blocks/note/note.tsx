import * as React from 'react'
import * as solidIcons from '@fortawesome/free-solid-svg-icons'
import * as regularIcons from '@fortawesome/free-regular-svg-icons'
import Markdown from 'markdown-to-jsx'

import { ViewResult } from '../../ui/value'
import { computeExpr, parseJSExpr } from '../../logic/compute'
import * as block from '../../block'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { BlockPreview } from '../block-selector/ui'
import { any, assertValid, boolean, loosely, strict, string } from '../../utils/validate'
import { Result, resultFrom } from '../../logic/result'
import { ViewCompletions } from '../../ui/completions'

export type Note =
    | { type: 'expr', code: string, result: Result }
    | { type: 'block', isInstantiated: false, code: string, result: Result }
    | { type: 'block', isInstantiated: true, code: string, block: block.Block<unknown>, state: unknown }
    | { type: 'text', tag: string, text: string }
    | { type: 'checkbox', checked: boolean, text: string }

export function evaluateNote(input: string, env: block.Environment, updateNote: block.BlockUpdater<Note>): Note {
    const setResult = block.subUpdater(setNoteResult, updateNote)

    if (input.startsWith('= ')) {
        const expr = input.slice(2)
        const result = computeExprResult(expr, env, setResult)
        return { type: 'expr', code: expr, result }
    }

    if (input.startsWith('/block ')) {
        const expr = input.slice('/block '.length)
        const result = computeExprResult(expr, env, setResult)
        return { type: 'block', isInstantiated: false, code: expr, result }
    }

    const header = input.match(/^#{1,6} /)
    if (header) {
        const level = header[0].length - 1
        return { type: 'text', tag: `h${level}`, text: input.slice(header[0].length) }
    }

    const list = input.match(/^[-*] /)
    if (list) {
        return { type: 'text', tag: 'li', text: input.slice(list[0].length) }
    }

    const checkbox = input.match(/^\[[ xX]?\] /)
    if (checkbox) {
        return { type: 'checkbox', checked: /^\[[xX]\] /.test(input), text: input.slice(checkbox[0].length) }
    }

    return { type: 'text', tag: 'p', text: input }
}


export function setNoteResult(note: Note, newResult: Result) {
    switch (note.type) {
        case 'block':
            if (note.isInstantiated === true) { return note }
            // fall through
        case 'expr':
            return {
                ...note,
                result: newResult,
            }

        default:
            return note
    }
}

export function noteBlockStateUpdater(updateNote: block.BlockUpdater<Note>) {
    return function updateNoteBlockState(action: (blockState: unknown) => unknown) {
        updateNote(note => {
            if (note.type === 'block' && note.isInstantiated === true) {
                return { ...note, state: action(note.state) }
            }
            return note
        })
    }
}


export function noteFromJSON(json: any, updateNote: block.BlockUpdater<Note>, env: block.Environment): Note {
    switch (json.type) {
        case 'expr':
            assertValid({ type: 'expr', code: string }, json)
            const result = computeExprResult(json.code, env, block.subUpdater(setNoteResult, updateNote))
            return { type: 'expr', code: json.code, result }

        case 'block':
            assertValid(loosely({ type: 'block', isInstantiated: boolean }), json)
            if (json.isInstantiated) {
                assertValid({ type: 'block', isInstantiated: true, code: string, state: any }, json)

                function setBlockFromResult(result: Result) {
                    updateNote(() => {
                        if (result.type === 'immediate' && block.isBlock(result.value)) {
                            const state = result.value.fromJSON(json.state, noteBlockStateUpdater(updateNote), env)
                            return { type: 'block', isInstantiated: true, code: json.code, block: result.value, state }
                        }

                        if (result.type === 'promise' && result.state === 'finished' && block.isBlock(result.value)) {
                            const state = result.value.fromJSON(json.state, noteBlockStateUpdater(updateNote), env)
                            return { type: 'block', isInstantiated: true, code: json.code, block: result.value, state }
                        }

                        return { type: 'block', isInstantiated: false, code: json.code, result }
                    })
                }

                const result = computeExprResult(json.code, env, setBlockFromResult)
                if (result.type === 'immediate' && block.isBlock(result.value)) {
                    const state = result.value.fromJSON(json.state, noteBlockStateUpdater(updateNote), env)
                    return { type: 'block', isInstantiated: true, code: json.code, block: result.value, state }
                }
                else {
                    return { type: 'block', isInstantiated: false, code: json.code, result }
                }
            }
            else {
                assertValid({ type: 'block', isInstantiated: false, code: string }, json)
                const result = computeExprResult(json.code, env, block.subUpdater(setNoteResult, updateNote))
                return { type: 'block', isInstantiated: false, code: json.code, result }
            }

        case 'text':
            assertValid(strict({ type: 'text', tag: string, text: string }), json)
            return json

        case 'checkbox':
            assertValid(strict({ type: 'checkbox', checked: boolean, text: string }), json)
            return json
    }
}

export function noteToJSON(note: Note) {
    switch (note.type) {
        case 'expr':
            return { type: 'expr', code: note.code }

        case 'block':
            if (note.isInstantiated === true) {
                return { type: 'block', isInstatiated: true, state: note.block.toJSON(note.state) }
            }
            else {
                return { type: 'block', isInstantiated: false, code: note.code }
            }

        case 'text':
        case 'checkbox':
            return note
    }
}




export function computeExprResult(expr: string, env: block.Environment, setResult: (result: Result) => void): Result {
    return resultFrom(computeExpr(expr, env), setResult)
}




export interface ViewNoteProps {
    note: Note
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
    note: Extract<Note, { type: 'text' }>
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
    h1: "text-5xl mt-12 mb-6",
    h2: "text-4xl mt-12 mb-6",
    h3: "text-3xl mt-12 mb-4",
    h4: "text-2xl mt-8 mb-4",
    h5: "text-xl mt-8 mb-4",
    h6: "text-lg mt-4 mb-2",
    p: "whitespace-pre-wrap"
}



// Checkbox

interface ViewCheckboxProps {
    note: Extract<Note, { type: 'checkbox' }>
    toggleCheckbox(): void
}

const ViewCheckbox = React.memo(
    function ViewCheckbox({ note, toggleCheckbox }: ViewCheckboxProps) {
        const clickCheckbox = React.useCallback(function clickCheckbox(event: React.MouseEvent) {
            event.stopPropagation()
            event.preventDefault()
            toggleCheckbox()
        }, [toggleCheckbox])

        return (
            <div>
                <FontAwesomeIcon
                    onClick={clickCheckbox}
                    className={`mr-2 cursor-pointer ${note.checked && "text-blue-400"}`}
                    icon={note.checked ? solidIcons.faSquareCheck : regularIcons.faSquare} />
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
    note: Extract<Note, { type: 'block' }>
    env: block.Environment
    instantiateBlock(): void
}

const ViewBlock = React.memo(
    function ViewBlock({ note, env, instantiateBlock }: ViewBlockProps) {
        if (note.isInstantiated === true) { return null }

        if (note.result.type !== 'immediate' || !block.isBlock(note.result.value)) {
            return <ViewCompletions code={note.code} env={env} default={<ViewResult result={note.result} />} />
        }

        const innerBlock = note.result.value
        return (
            <>
                <ViewCompletions code={note.code} env={env} default={<ViewResult result={note.result} />} />
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
    note: Extract<Note, { type: 'expr' }>
    env: block.Environment
    isFocused: boolean
}

const ViewExprResult = React.memo(
    function ViewExprResult({ note, env, isFocused }: ViewExprResultProps) {
        if (isLiteral(note.code)) {
            return null
        }

        if (!isFocused) {
            if (note.result.type === 'immediate' && note.result.value === undefined) { return null }
            return <ViewResult result={note.result} />
        }

        const { code } = note
        return <ViewCompletions code={note.code} env={env} default={<ViewResult result={note.result} />} />
    },
    (before, after) => (
        before.note.code === after.note.code
        && before.env === after.env
        && before.isFocused === after.isFocused
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