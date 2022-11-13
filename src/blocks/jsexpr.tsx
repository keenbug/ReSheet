import * as React from 'react'
import babelGenerator from '@babel/generator'
import * as babel from '@babel/types'
import { codeFrameColumns } from '@babel/code-frame'

import { ErrorInspector, ValueInspector } from '../ui/value'
import { CodeView, EditableCode, highlightJS } from '../ui/code-editor'
import { classed, ErrorView } from '../ui/utils'
import { computeExpr, computeScript, parseJSExpr } from '../logic/compute'
import * as block from '../logic/block'
import { Inspector } from 'react-inspector'


export const JSExprBlock = block.create<string>({
    init: "",
    view({ env, state, update }) {
        return <JSExpr code={state} update={update} env={env} />
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


const JSExprContainer = classed<any>('div')`flex flex-col space-y-1 flex-1`

export const JSExpr = ({ code, update, env }) => {
    const setCode = newCode => update(() => newCode)
    return (
        <JSExprContainer>
            <EditableCode code={code} onUpdate={setCode} />
            <PreviewValue code={code} env={env} />
        </JSExprContainer>
    )
}


export function PreviewValue({ code, env }) {
    if (code.trim() === '') {
        return <ValueInspector value={env} expandLevel={1} />
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
    }
    catch (e) { }

    return (
        <ValueInspector value={computeScript(code, env)} />
    )
}

export function JSCode({ code, ...props }) {
    return <code dangerouslySetInnerHTML={{ __html: highlightJS(code)}} {...props} />
}