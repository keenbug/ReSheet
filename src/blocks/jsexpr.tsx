import * as React from 'react'
import babelGenerator from '@babel/generator'
import * as babel from '@babel/types'

import { ValueInspector } from '../ui/value'
import { EditableCode, highlightJS } from '../ui/code-editor'
import { computeExpr, computeScript, parseJSExpr } from '../logic/compute'
import { BlockRef } from '../block'
import * as block from '../block'
import { Inspector } from 'react-inspector'


export const JSExpr = block.create<string>({
    init: "",
    view({ env, state, update }, ref) {
        return <JSExprUi ref={ref} code={state} update={update} env={env} />
    },
    getResult(state, env) {
        return computeScript(state, env)
    },
    fromJSON(json, env) {
        if (typeof json === 'string') {
            return json
        }
        else {
            return ""
        }
    },
    toJSON(state) {
        return state
    }
})


interface JSExprUiProps {
    code: string
    update: block.BlockUpdater<string>
    env: block.Environment
}

export const JSExprUi = React.forwardRef(
    function JSExprUi(
        { code, update, env }: JSExprUiProps,
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

        const setCode = newCode => update(() => newCode)

        return (
            <div className="flex flex-col space-y-1 flex-1">
                <EditableCode
                    ref={editorRef}
                    code={code}
                    onUpdate={setCode}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
                    />
                <PreviewValue
                    code={code}
                    env={env}
                    isFocused={isFocused}
                    />
            </div>
        )
    }
)


export function PreviewValue({ code, env, isFocused }) {
    const defaultExpandLevel = isFocused ? 1 : 0
    if (code.trim() === '') {
        return <ValueInspector value={env} expandLevel={defaultExpandLevel} />
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
        else {
            parsed = parseJSExpr(code)
        }

        if (parsed.type === 'MemberExpression' && parsed.property.type === 'Identifier') {
            const obj = computeExpr(babelGenerator(parsed.object).code, env)
            return (
                <>
                    <ValueInspector value={obj[parsed.property.name]} />
                    <Inspector table={false} data={obj} expandLevel={defaultExpandLevel} showNonenumerable={true} />
                </>
            )
        }
        // Top-level variable access?
        if (parsed.type === 'Identifier') {
            return (
                <>
                    <ValueInspector value={computeExpr(parsed.name, env)} />
                    <ValueInspector value={env} expandLevel={defaultExpandLevel} />
                </>
            )
        }
    }
    catch (e) { }

    return (
        <ValueInspector value={computeScript(code, env)} />
    )
}

export function JSCode({ code, ...props }) {
    return <code dangerouslySetInnerHTML={{ __html: highlightJS(code)}} {...props} />
}