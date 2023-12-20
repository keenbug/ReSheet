import * as React from 'react'
import babelGenerator from '@babel/generator'
import * as babel from '@babel/types'
import * as solidIcons from '@fortawesome/free-solid-svg-icons'
import * as regularIcons from '@fortawesome/free-regular-svg-icons'
import Markdown from 'markdown-to-jsx'

import Editor from 'react-simple-code-editor'

import { Pending, PromiseResult, PromiseView, ValueInspector } from '../../ui/value'
import { highlightJS, highlightMd } from '../../ui/code-editor'
import { computeExpr, computeScript, isPromise, parseJSExpr } from '../../logic/compute'
import { BlockRef } from '../../block'
import * as block from '../../block'
import { Inspector } from 'react-inspector'
import { Keybindings, useShortcuts } from '../../ui/shortcuts'
import { useEffectfulState } from '../../ui/hooks'
import { getFullKey } from '../../ui/utils'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'


export interface NoteModel {
    level: number
    input: string
    interpreted: Interpreted
}

export type Interpreted =
    | { type: 'expr', code: string, result: Result }
    | { type: 'text', tag: string, text: string }
    | { type: 'checkbox', checked: boolean, text: string }

export type Result =
    | { type: 'immediate', value: any }
    | { type: 'promise', cancel(): void } & PromiseResult

function getResultValue(result: Result) {
    switch (result.type) {
        case 'immediate':
            return result.value

        case 'promise':
            switch (result.state) {
                case 'pending':
                    return Pending
                
                case 'failed':
                    return result.error
                
                case 'finished':
                    return result.value
            }
    }
}


const init: NoteModel = {
    level: 0,
    input: '',
    interpreted: { type: 'text', tag: 'p', text: '' },
}


export const Note = block.create<NoteModel>({
    init,
    view({ env, state, update }, ref) {
        return <NoteUi ref={ref} state={state} update={update} env={env} />
    },
    recompute(state, update, env) {
        return updateResult(state, update, env)
    },
    getResult(state) {
        switch (state.interpreted.type) {
            case 'expr':
                return getResultValue(state.interpreted.result)

            default:
                return undefined
        }
    },
    fromJSON(json, update, env) {
        if (typeof json === 'string') {
            return updateResult(
                {
                    level: 0,
                    input: json,
                    interpreted: interpretInput(json, env, update),
                },
                update,
                env,
            )
        }
        else if (typeof json === 'object' && typeof json.input === 'string' && typeof json.level === 'number') {
            return updateResult(
                {
                    level: json.level,
                    input: json.input,
                    interpreted: interpretInput(json.input, env, update),
                },
                update,
                env,
            )
        }
        else {
            return init
        }
    },
    toJSON(state) {
        return { level: state.level, input: state.input }
    }
})



interface NoteUiProps {
    state: NoteModel
    update: block.BlockUpdater<NoteModel>
    env: block.Environment
}

export const NoteUi = React.forwardRef(
    function NoteUi(
        { state, update, env }: NoteUiProps,
        ref: React.Ref<BlockRef>
    ) {
        const editorRef = React.useRef<HTMLTextAreaElement>()
        const [isFocused, setFocused] = useEffectfulState(false)
        React.useImperativeHandle(
            ref,
            () => ({
                focus() {
                    setFocused(() => ({
                        state: true,
                        effect() { editorRef.current?.focus() }
                    }))
                }
            })
        )

        const actions = ACTIONS(update)
        const shortcutProps = useShortcuts(keybindings(state, actions))

        const onUpdateCode = (code: string) => update(state => updateResult({ ...state, input: code }, update, env))

        function preventEnter(event: React.KeyboardEvent) {
            if (getFullKey(event) === 'Enter') {
                event.preventDefault()
            }
            shortcutProps.onKeyDown(event)
        }
        
        return (
            <div
                className="flex flex-col space-y-1 flex-1"
                style={{ paddingLeft: (1.5 * state.level) + 'rem' }}
                tabIndex={-1}
                onClick={() => {
                    setFocused(() => ({
                        state: true,
                        effect() { editorRef.current?.focus() }
                    }))
                }}
                onFocus={event => {
                    setFocused(() => ({ state: true }))
                    shortcutProps.onFocus(event)
                }}
                onBlur={event => {
                    if (!event.currentTarget.contains(event.relatedTarget)) {
                        setFocused(() => ({ state: false }))
                    }
                    shortcutProps.onBlur(event)
                }}
                >
                {(isFocused || state.interpreted.type === 'expr') && 
                    <NoteEditor
                        ref={editorRef}
                        interpreted={state.interpreted}
                        code={state.input}
                        onUpdate={onUpdateCode}
                        {...shortcutProps}
                        onKeyDown={preventEnter}
                        />
                }
                <PreviewValue
                    state={state}
                    env={env}
                    isFocused={isFocused}
                    toggleCheckbox={actions.toggleCheckbox}
                    />
            </div>
        )
    }
)



function keybindings(state: NoteModel, actions: ReturnType<typeof ACTIONS>): Keybindings {
    return [
        {
            description: "Note",
            bindings: [
                [
                    state.interpreted.type === 'checkbox' ? ["C-Enter"] : [],
                    "none",
                    "toggle checkbox",
                    actions.toggleCheckbox,
                ],
                [
                    ["Tab"],
                    "none",
                    "indent",
                    actions.indent,
                ],
                [
                    ["Shift-Tab"],
                    "none",
                    "outdent",
                    actions.outdent,
                ]
            ]
        }
    ]
}

function ACTIONS(update: block.BlockUpdater<NoteModel>) {
    return {
        toggleCheckbox() {
            update(state => {
                if (state.interpreted.type === 'checkbox') {
                    return {
                        ...state,
                        input: state.input.replace(
                            /^\[[ xX]?\] /,
                            state.interpreted.checked ? "[ ] " : "[x] "
                        ),
                        interpreted: {
                            ...state.interpreted,
                            checked: !state.interpreted.checked,
                        }
                    }
                }
                return state
            })
        },

        indent() {
            update(state => ({
                ...state,
                level: state.level + 1,
            }))
        },

        outdent() {
            update(state => ({
                ...state,
                level: Math.max(0, state.level - 1),
            }))
        },
    }
}



function attachPromiseStateHandlers(promise: Promise<any>, update: block.BlockUpdater<NoteModel>) {
    let cancelled = false

    function cancel() {
        cancelled = true
    }

    promise.then(
        (value: any) => {
            if (cancelled) { return }
            update(state => ({
                ...state,
                result: { type: 'promise', cancel, state: 'finished', value },
            }))
        },
        (error: any) => {
            if (cancelled) { return }
            update(state => ({
                ...state,
                result: { type: 'promise', cancel, state: 'failed', error },
            }))
        }
    )

    return cancel
}

function interpretInput(input: string, env: block.Environment, update: block.BlockUpdater<NoteModel>): Interpreted {
    if (input.startsWith('= ')) {
        const expr = input.slice(2)
        const value = computeExpr(expr, env)
        if (isPromise(value)) {
            const cancel = attachPromiseStateHandlers(value, update)
            return { type: 'expr', code: expr, result: { type: 'promise', cancel, state: 'pending' } }
        }
        return { type: 'expr', code: expr, result: { type: 'immediate', value } }
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

function updateResult(state: NoteModel, update: block.BlockUpdater<NoteModel>, env: block.Environment): NoteModel {
    if (state.interpreted.type === 'expr' && state.interpreted.result.type === 'promise') {
        state.interpreted.result.cancel()
    }

    return {
        ...state,
        interpreted: interpretInput(state.input, env, update),
    }
}





const textStyles = {
    h1: "text-5xl mt-12 mb-6",
    h2: "text-4xl mt-12 mb-6",
    h3: "text-3xl mt-12 mb-4",
    h4: "text-2xl mt-8 mb-4",
    h5: "text-xl mt-8 mb-4",
    h6: "text-lg mt-4 mb-2",
    p: "whitespace-pre-wrap"
}

const codeStyle = {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
}

function editorStyle(interpreted: Interpreted): [React.CSSProperties, string, (code: string) => string] {
    switch (interpreted.type) {
        case 'expr':
            return [codeStyle, "", highlightJS]

        case 'text':
            return [{}, textStyles[interpreted.tag] ?? "", highlightMd]

        case 'checkbox':
            return [{}, "", highlightMd]
    }
}





type EditorProps = React.ComponentProps<typeof Editor>
type EditorDefaultProps = keyof typeof Editor.defaultProps
type CodeEditorControlledProps = 'value' | 'onValueChange' | 'highlight'

type CodeEditorProps = Omit<EditorProps, CodeEditorControlledProps | EditorDefaultProps> & {
    interpreted: Interpreted
    code: string
    onUpdate: (code: string) => void
}

export const NoteEditor = React.forwardRef(
    function NoteEditor(
        {
            interpreted, code, onUpdate,
            ...props
        }: CodeEditorProps,
        ref: React.Ref<HTMLTextAreaElement>
    ) {
        const id = React.useMemo(() => 'editor-' + Math.floor(Math.random() * Number.MAX_SAFE_INTEGER), [])
        React.useImperativeHandle(ref, () => document.getElementById(id) as HTMLTextAreaElement, [id])

        const [style, className, highlight] = editorStyle(interpreted)

        return (
            <Editor
                value={code}
                onValueChange={onUpdate}
                highlight={highlight}
                autoFocus={false}
                className={className}
                textareaId={id}
                textareaClassName="focus-visible:outline-none"
                style={style}
                {...props}
                />
        )
    }
)



export interface PreviewValueProps {
    state: NoteModel
    env: block.Environment
    isFocused: boolean
    toggleCheckbox(): void
}

export function PreviewValue({ state, env, isFocused, toggleCheckbox }: PreviewValueProps) {
    const { interpreted } = state
    switch (interpreted.type) {
        case 'text':
            if (isFocused) { return null }
            const content = interpreted.text.trim() === '' ? '\u200B' : interpreted.text
            return (
                React.createElement(
                    interpreted.tag,
                    { className: textStyles[interpreted.tag] },
                    <Markdown>{content}</Markdown>,
                )
            )

        case 'checkbox':
            if (isFocused) { return null }
            function clickCheckbox(event: React.MouseEvent) {
                event.stopPropagation()
                event.preventDefault()
                toggleCheckbox()
            }
            return (
                <div className="cursor-pointer">
                    <FontAwesomeIcon
                        onPointerDown={clickCheckbox}
                        className={`mr-2 ${interpreted.checked && "text-blue-400"}`}
                        icon={interpreted.checked ? solidIcons.faSquareCheck : regularIcons.faSquare}
                        />
                    <Markdown
                        options={{ wrapper: 'span' }}
                        className={interpreted.checked ? "text-gray-400 line-through" : ""}
                    >
                        {interpreted.text}
                    </Markdown>
                </div>
            )

        case 'expr':
            // fall through to rest of function
    }

    if (isLiteral(interpreted.code)) {
        return null
    }

    if (!isFocused) {
        if (interpreted.result.type === 'immediate' && interpreted.result.value === undefined) { return null }
        return <ViewValue result={interpreted.result} />
    }

    const { code } = interpreted
    try {
        let parsed: babel.Expression

        // looks like an incomplete member access?
        if (code.slice(-1) === '.') {
            parsed = babel.memberExpression(
                parseJSExpr(code.slice(0, -1)),
                babel.identifier(''),
            )
        }
        else if (countParens(code, '(') > countParens(code, ')')) {
            const missingClosingParensCount = countParens(code, '(') - countParens(code, ')')
            const missingClosingParens = ")".repeat(missingClosingParensCount)
            parsed = parseJSExpr(code + missingClosingParens)
        }
        else {
            parsed = parseJSExpr(code)
        }

        if (parsed.type === 'MemberExpression' && parsed.property.type === 'Identifier') {
            const obj = computeExpr(babelGenerator(parsed.object).code, env)
            return (
                <>
                    <ValueInspector value={obj[parsed.property.name]} />
                    <Inspector table={false} data={obj} expandLevel={1} showNonenumerable={true} />
                </>
            )
        }
        // Top-level variable access?
        if (parsed.type === 'Identifier') {
            return (
                <>
                    <ValueInspector value={computeExpr(parsed.name, env)} />
                    <ValueInspector value={env} expandLevel={1} />
                </>
            )
        }
        if (parsed.type === 'CallExpression') {
            const func = computeExpr(babelGenerator(parsed.callee).code, env)
            const args = parsed.arguments
            const missingArgs = func.length - args.length
            return (
                <>
                    {missingArgs > 0 &&
                        <div className="my-1 font-mono text-xs text-gray-700">
                            {missingArgs} arguments missing
                        </div>
                    }
                    <ValueInspector value={computeScript(babelGenerator(parsed).code, env)} />
                    <ValueInspector value={func} />
                </>
            )
        }
    }
    catch (e) { }

    return <ViewValue result={interpreted.result} />
}

function ViewValue({ result }: { result: Result }) {
    switch (result.type) {
        case 'immediate':
            return <ValueInspector value={result.value} expandLevel={0} />

        case 'promise':
            return <PromiseView promiseResult={result} />
    }
}



export function countParens(str: string, paren: string) {
    const findStringRegex = /"(\\.|[^\\"])*"|'(\\.|[^\\'])*'|`(\\.|[^\\`])*`/g
    return str.replace(findStringRegex, '').split('').filter(char => char === paren).length
}

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
