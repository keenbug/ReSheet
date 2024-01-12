import * as React from 'react'
import babelGenerator from '@babel/generator'
import * as babel from '@babel/types'

import { ValueInspector } from '../ui/value'
import { computeExpr, computeScript, parseJSExpr } from '../logic/compute'
import * as block from '../block'
import { Inspector } from 'react-inspector'

export interface ViewCompletionsProps {
    code: string
    env: block.Environment
    default: React.ReactNode
}

export function ViewCompletions({ code, env, default: defaultView }: ViewCompletionsProps) {
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

    return defaultView
}

function countParens(str: string, paren: string) {
    const findStringRegex = /"(\\.|[^\\"])*"|'(\\.|[^\\'])*'|`(\\.|[^\\`])*`/g
    return str.replace(findStringRegex, '').split('').filter(char => char === paren).length
}
