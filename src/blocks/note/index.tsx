import * as React from 'react'
import babelGenerator from '@babel/generator'
import * as babel from '@babel/types'

import Editor from 'react-simple-code-editor'

import { Pending, PromiseResult, PromiseView, ValueInspector } from '../../ui/value'
import { highlightJS, highlightNothing } from '../../ui/code-editor'
import { computeExpr, computeScript, isPromise, parseJSExpr } from '../../logic/compute'
import { BlockRef } from '../../block'
import * as block from '../../block'
import { Inspector } from 'react-inspector'
import { useShortcuts } from '../../ui/shortcuts'
import { useEffectQueue } from '../../ui/hooks'


export interface NoteModel {
    input: string
    result: Result
}

export type Input =
    | { type: 'expr', expr: string }
    | { type: 'text', tag: string, text: string }

export type Result =
    | { type: 'immediate', value: any }
    | { type: 'promise', cancel(): void } & PromiseResult

const JS_LITERALS = [
    "StringLiteral",
    "NumericLiteral",
    "BigIntLiteral",
    "BooleanLiteral",
    "NullLiteral",
    "RegExpLiteral"
]

function isInputLiteral(input: Input) {
    switch (input.type) {
        case 'expr':
            try {
                const type = parseJSExpr(input.expr).type
                return JS_LITERALS.includes(type)
            }
            catch (e) {
                // Catch syntax errors
                return false
            }

        case 'text':
            return true
    }
}


const init: NoteModel = {
    input: '',
    result: { type: 'immediate', value: <div className="simplecss inline"><p>&#8203;</p></div> },
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
        switch (state.result.type) {
            case 'immediate':
                return state.result.value

            case 'promise':
                switch (state.result.state) {
                    case 'pending':
                        return Pending
                    
                    case 'failed':
                        return state.result.error
                    
                    case 'finished':
                        return state.result.value
                }
        }
    },
    fromJSON(json, update, env) {
        if (typeof json === 'string') {
            return updateResult(
                {
                    input: json,
                    result: { type: 'immediate', value: undefined },
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
        return state.input
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
        const queueEffect = useEffectQueue()
        React.useImperativeHandle(
            ref,
            () => ({
                focus() {
                    setFocused(true)
                    queueEffect(() => { editorRef.current?.focus() })
                }
            })
        )
        const [isFocused, setFocused] = React.useState(false)

        const onUpdateCode = (code: string) => update(state => updateResult({ ...state, input: code }, update, env))

        const shortcutProps = useShortcuts([
            {
                description: "jsexpr",
                bindings: [
                    [["Alt-Enter"], 'none', 'rerun computation', () => { update(state => updateResult(state, update, env)) }],
                ]
            }
        ])
        
        const parsed = parseInput(state.input)

        return (
            <div
                className="flex flex-col space-y-1 flex-1"
                tabIndex={-1}
                onClick={() => { setFocused(true) }}
                onFocus={event => {
                    setFocused(true)
                    shortcutProps.onFocus(event)
                }}
                onBlur={event => {
                    if (!event.currentTarget.contains(event.relatedTarget)) {
                        setFocused(false)
                    }
                    shortcutProps.onBlur(event)
                }}
                >
                {(isFocused || parsed.type === 'expr') && 
                    <NoteEditor
                        ref={editorRef}
                        code={state.input}
                        onUpdate={onUpdateCode}
                        {...shortcutProps}
                        />
                }
                <PreviewValue
                    state={state}
                    env={env}
                    isFocused={isFocused}
                    />
            </div>
        )
    }
)

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

function parseInput(input: string): Input {
    if (input.startsWith('= ')) {
        return { type: 'expr', expr: input.slice(2) }
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

    return { type: 'text', tag: 'p', text: input }
}

function execInput(input: Input, env: block.Environment) {
    switch (input.type) {
        case 'expr':
            return computeExpr(input.expr, env)

        case 'text':
            const content = input.text.trim() === '' ? '\u200B' : input.text
            return React.createElement(input.tag, { className: styles[input.tag] }, content)
    }
}

function updateResult(state: NoteModel, update: block.BlockUpdater<NoteModel>, env: block.Environment): NoteModel {
    if (state.result.type === 'promise') {
        state.result.cancel()
    }

    const parsed = parseInput(state.input)
    const result = execInput(parsed, env)

    if (isPromise(result)) {
        const cancel = attachPromiseStateHandlers(result, update)
        return {
            ...state,
            result: { type: 'promise', cancel, state: 'pending' },
        }
    }

    return {
        ...state,
        result: { type: 'immediate', value: result },
    }
}

const styles = {
    h1: "text-5xl mt-12 mb-6",
    h2: "text-4xl mt-12 mb-6",
    h3: "text-3xl mt-12 mb-4",
    h4: "text-2xl mt-8 mb-4",
    h5: "text-xl mt-8 mb-4",
    h6: "text-lg mt-4 mb-2",
}



interface CodeEditorProps {
    code: string
    onUpdate: (code: string) => void
}

const codeStyle = {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
}

function editorStyle(input: Input) {
    switch (input.type) {
        case 'expr':
            return [codeStyle, "", highlightJS]

        case 'text':
            const highlight = isInputLiteral(input) ? highlightNothing : highlightJS
            return [{}, styles[input.tag] ?? "", highlight]
    }
}

export const NoteEditor = React.forwardRef(
    function NoteEditor(
        {
            code, onUpdate,
            ...props
        }: CodeEditorProps,
        ref: React.Ref<HTMLTextAreaElement>
    ) {
        const id = React.useMemo(() => 'editor-' + Math.floor(Math.random() * Number.MAX_SAFE_INTEGER), [])
        React.useImperativeHandle(ref, () => document.getElementById(id) as HTMLTextAreaElement, [id])

        const parsed = parseInput(code)
        const [style, className, highlight] = editorStyle(parsed)

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
}

export function PreviewValue({ state, env, isFocused }: PreviewValueProps) {
    const parsed = parseInput(state.input)

    if (parsed.type === 'expr' && isInputLiteral(parsed)) {
        return null
    }

    if (!isFocused) {
        if (state.result.type === 'immediate' && state.result.value === undefined) { return null }
        return <ViewValue result={state.result} />
    }

    if (parsed.type === 'expr') {
        const code = parsed.expr
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
    }

    return <ViewValue result={state.result} />
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