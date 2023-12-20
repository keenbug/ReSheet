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


export const transformJSAst = (programAst: babel.types.Program, code: string) =>
    babel.transformFromAstSync(programAst, code, transformReactOpts).code


export function programReturnExprAst(exprAst: babel.types.Expression) {
    return (
        babelAst.program(
            [ babelAst.returnStatement(exprAst) ],
        )
    )
}


export const transformJSExpr = (sourcecode: string) =>
    transformJSAst(
        programReturnExprAst(
            parseJSExpr(sourcecode)
        ),
        sourcecode,
    )


export function cleanupEnv(env: Environment) {
    const cleanEntries = (
        Object.entries(env).filter(([name]) =>
            name.match(/^[a-zA-Z_$][\w\$]*$/)
        )
    )
    function $([name]) { return env[name] }
    return Object.fromEntries([["$", $], ...cleanEntries])
}


export function runExprAst(exprAst: babel.types.Expression, exprSource: string, env: Environment) {
    try {
        const cleanEnv = cleanupEnv(env)
        const programAst = programReturnExprAst(exprAst)
        const isAsync = containsToplevelAsync(babelAst.file(programAst))
        const FuncConstructor = isAsync ? AsyncFunction : Function
        const exprFunc = FuncConstructor(
            ...Object.keys(cleanEnv),
            transformJSAst(programAst, exprSource),
        )
        return exprFunc(...Object.values(cleanEnv))
    }
    catch (e) {
        return e
    }
}



export const computeExpr = (code: string | null, env: Environment) => {
    if (!code?.trim()) { return }
    try {
        const ast = parseJSExpr(code)
        return runExprAst(ast, code, env)
    }
    catch (e) {
        annotateCodeFrame(e, code)
        return e
    }
}



export function transformJSScript(sourcecode) {
    const parserOpts: babelParser.ParserOptions = {
        ...parseReactOpts,
        allowReturnOutsideFunction: true,
        allowAwaitOutsideFunction: true,
    }
    const ast = babelParser.parse(sourcecode, parserOpts)
    const statements = ast.program.body
    const astWithReturn = babelAst.program([
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

    return {
        transformedCode: babel.transformFromAstSync(astWithReturn, sourcecode, transformReactOpts).code,
        isAsync: containsToplevelAsync(ast),
    }
}



export const AsyncFunction = (async function(){}).constructor

export function computeScript(code: string | null, env: Environment) {
    if (!code?.trim()) { return }
    try {
        const cleanEnv = cleanupEnv(env)
        const { transformedCode, isAsync } = transformJSScript(code)
        const funcConstructor = isAsync ? AsyncFunction : Function
        const exprFunc = funcConstructor(
            ...Object.keys(cleanEnv),
            transformedCode,
        )

        if (isAsync) {
            const promise = exprFunc(...Object.values(cleanEnv))
            // so I don't trigger the error overlay in dev mode
            //  theoretically I do catch the error, but too late
            promise.catch(e => e)
            return promise
        }
        return exprFunc(...Object.values(cleanEnv))
    }
    catch (e) {
        annotateCodeFrame(e, code)
        return e
    }
}


export function containsToplevelAsync(ast: babel.types.File) {
    let hasToplevelAwait = false
    babelTraverse(ast, {
        AwaitExpression(path) {
            const isInFunction = path.findParent(path => path.isFunction())
            if (!isInFunction) {
                hasToplevelAwait = true
            }
        },
    })

    return hasToplevelAwait
}

export function annotateCodeFrame(e: Error, source: string) {
    if (e instanceof SyntaxError && (e as any).loc !== undefined) {
        (e as any).frame = codeFrameColumns(source, { start: (e as any).loc }, {})
    }
}

export function isPromise(value: any) {
    return typeof value?.then === 'function'
}