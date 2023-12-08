import * as React from 'react'
import babelGenerator from '@babel/generator'
import * as babel from '@babel/types'

import { PromiseResult, PromiseView, ValueInspector } from '../ui/value'
import { EditableCode } from '../ui/code-editor'
import { computeExpr, computeScript, isPromise, parseJSExpr } from '../logic/compute'
import { BlockRef } from '../block'
import * as block from '../block'
import { Inspector } from 'react-inspector'
import { useShortcuts } from '../ui/shortcuts'


export interface JSExprModel {
    code: string
    result: Result
}

export type Result =
    | { type: 'immediate', value: any }
    | { type: 'promise', cancel(): void } & PromiseResult


const init: JSExprModel = {
    code: '',
    result: { type: 'immediate', value: undefined },
}


export const JSExpr = block.create<JSExprModel>({
    init,
    view({ env, state, update }, ref) {
        return <JSExprUi ref={ref} state={state} update={update} env={env} />
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
                        return undefined
                    
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
                    code: json,
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
        return state.code
    }
})

interface JSExprUiProps {
    state: JSExprModel
    update: block.BlockUpdater<JSExprModel>
    env: block.Environment
}

export const JSExprUi = React.forwardRef(
    function JSExprUi(
        { state, update, env }: JSExprUiProps,
        ref: React.Ref<BlockRef>
    ) {
        const editorRef = React.useRef<HTMLTextAreaElement>()
        React.useImperativeHandle(
            ref,
            () => ({
                focus() {
                    editorRef.current?.focus()
                }
            })
        )
        const [isFocused, setFocused] = React.useState(false)

        const onUpdateCode = (code: string) => update(state => updateResult({ ...state, code }, update, env))

        const shortcutProps = useShortcuts([
            {
                description: "jsexpr",
                bindings: [
                    [["Alt-Enter"], 'none', 'rerun computation', () => { update(state => updateResult(state, update, env)) }],
                ]
            }
        ])

        return (
            <div className="flex flex-col space-y-1 flex-1">
                <EditableCode
                    ref={editorRef}
                    code={state.code}
                    onUpdate={onUpdateCode}
                    {...shortcutProps}
                    onFocus={event => {
                        setFocused(true)
                        shortcutProps.onFocus(event)
                    }}
                    onBlur={event => {
                        setFocused(false)
                        shortcutProps.onBlur(event)
                    }}
                    />
                <PreviewValue
                    state={state}
                    env={env}
                    isFocused={isFocused}
                    />
            </div>
        )
    }
)

function updateResult(state: JSExprModel, update: block.BlockUpdater<JSExprModel>, env: block.Environment): JSExprModel {
    function attachPromiseStateHandlers(promise: Promise<any>) {
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

    if (state.result.type === 'promise') {
        state.result.cancel()
    }
    const result = computeScript(state.code, env)
    if (isPromise(result)) {
        const cancel = attachPromiseStateHandlers(result)
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
    state: JSExprModel
    env: block.Environment
    isFocused: boolean
}

export function PreviewValue({ state, env, isFocused }: PreviewValueProps) {
    const code = state.code
    if (!isFocused) {
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