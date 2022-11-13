import * as babel from '@babel/core'
import babelReact from '@babel/preset-react'
import * as babelParser from '@babel/parser'
import babelTraverse from '@babel/traverse'
import * as babelAst from '@babel/types'
import { codeFrameColumns } from '@babel/code-frame'


export type Environment = { [varName: string]: any }


export const parseReactOpts: babelParser.ParserOptions = { plugins: [ 'jsx' ] }
export const transformReactOpts = { presets: [ babelReact ] }


export const parseJSExpr = (sourcecode: string) =>
    babelParser.parseExpression(sourcecode, parseReactOpts)


export const transformJSAst = (programAst, code) =>
    babel.transformFromAstSync(programAst, code, transformReactOpts).code


export function programReturnExprAst(exprAst) {
    return (
        babelAst.program(
            [ babelAst.returnStatement(exprAst) ],
        )
    )
}


export const transformJSExpr = sourcecode =>
    transformJSAst(
        programReturnExprAst(
            parseJSExpr(sourcecode)
        ),
        sourcecode,
    )


export const computeExpr = (code: string | null, env: Environment) => {
    if (!code) { return }
    try {
        const exprFunc = new Function(
            ...Object.keys(env),
            transformJSExpr(code),
        )
        return exprFunc(...Object.values(env))
    }
    catch (e) {
        if (e instanceof SyntaxError && (e as any).loc !== undefined) {
            (e as any).frame = codeFrameColumns(code, { start: (e as any).loc }, {})
        }
        return e
    }
}



export function transformJSScript(sourcecode) {
    const parserOpts: babelParser.ParserOptions = {
        ...parseReactOpts,
        allowReturnOutsideFunction: true,
        allowAwaitOutsideFunction: true,
    }
    const program = babelParser.parse(sourcecode, parserOpts).program
    const statements = program.body
    const ast = babelAst.program([
        ...statements.slice(0, -1),
        ...statements.slice(-1).map(stmt => {
            if (babelAst.isExpressionStatement(stmt)) {
                return babelAst.returnStatement(stmt.expression)
            }
            if (babelAst.isFunctionDeclaration(stmt)) {
                return babelAst.returnStatement({ ...stmt, type: 'FunctionExpression' })
            }
            return stmt
        }),
    ])
    const isAsync = program.directives.find(directive => (
        babelAst.isDirectiveLiteral(directive.value)
        && directive.value.value === 'async'
    ))

    return {
        transformedCode: babel.transformFromAstSync(ast, sourcecode, transformReactOpts).code,
        isAsync,
    }
}



export const AsyncFunction = (async function(){}).constructor

export function computeScript(code: string | null, env: Environment) {
    if (!code) { return }
    try {
        const { transformedCode, isAsync } = transformJSScript(code)
        const funcConstructor = isAsync ? AsyncFunction : Function
        const exprFunc = funcConstructor(
            ...Object.keys(env),
            transformedCode,
        )
        return exprFunc(...Object.values(env))
    }
    catch (e) {
        if (e instanceof SyntaxError && (e as any).loc !== undefined) {
            (e as any).frame = codeFrameColumns(code, { start: (e as any).loc }, {})
        }
        return e
    }
}