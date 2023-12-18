import * as React from 'react'
import babelGenerator from '@babel/generator'
import * as babel from '@babel/types'

import { Pending, PromiseResult, PromiseView, ValueInspector } from '../../ui/value'
import { EditableCode } from '../../ui/code-editor'
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
    | { type: 'code', code: string }
    | { type: 'text', tag: string, text: string }

export type Result =
    | { type: 'immediate', value: any }
    | { type: 'promise', cancel(): void } & PromiseResult


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
                {isFocused && 
                    <EditableCode
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
        return { type: 'code', code: input.slice(2) }
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

function transformInput(input: Input): string {
    switch (input.type) {
        case 'code':
            return input.code

        case 'text':
            return [
                `<div className='simplecss inline'><${input.tag}>`,
                (
                    input.text.trim() === '' ?
                        "&#8203;"
                    :
                        input.text
                ),
                `</${input.tag}></div>`,
            ].join('\n')
    }
}

function updateResult(state: NoteModel, update: block.BlockUpdater<NoteModel>, env: block.Environment): NoteModel {
    if (state.result.type === 'promise') {
        state.result.cancel()
    }

    const parsed = parseInput(state.input)
    const script = transformInput(parsed)
    const result = computeScript(script, env)

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





export interface PreviewValueProps {
    state: NoteModel
    env: block.Environment
    isFocused: boolean
}

export function PreviewValue({ state, env, isFocused }: PreviewValueProps) {
    const code = transformInput(parseInput(state.input))
    if (!isFocused) {
        if (state.result.type === 'immediate' && state.result.value === undefined) { return null }
        return <ViewValue result={state.result} />
    }

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