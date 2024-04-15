import * as babel from '@babel/core'
import babelReact from '@babel/preset-react'
import * as babelParser from '@babel/parser'
import babelTraverse from '@babel/traverse'
import * as babelAst from '@babel/types'
import { codeFrameColumns } from '@babel/code-frame'

import _ from "lodash"

import { Pending } from './result'


export type Environment = { [varName: string]: any }


export const parseReactOpts: babelParser.ParserOptions = { plugins: [ 'jsx' ] }
export const transformReactOpts = { presets: [ babelReact ] }


export const parseJSExpr = (sourcecode: string) =>
    babelParser.parseExpression(sourcecode, { ...parseReactOpts, allowAwaitOutsideFunction: true })


export const transformJSAst = (programAst: babel.types.Program, code: string) =>
    babel.transformFromAstSync(programAst, code, transformReactOpts).code


export function programReturnExprAst(exprAst: babel.types.Expression) {
    return (
        babelAst.program(
            [ babelAst.returnStatement(exprAst) ],
        )
    )
}

export function fileExprAst(exprAst: babel.types.Expression) {
    // I don't know how else to create a traversable file/program:
    const file = babelParser.parse('')
    file.program.body.push(babelAst.expressionStatement(exprAst))
    return file
}


export const transformJSExpr = (sourcecode: string) =>
    transformJSAst(
        programReturnExprAst(
            parseJSExpr(sourcecode)
        ),
        sourcecode,
    )


export const RESERVED_JS_KEYWORDS = new Set([
    "abstract",
    "arguments",
    "await",
    "boolean",
    "break",
    "byte",
    "case",
    "catch",
    "char",
    "class",
    "const",
    "continue",
    "debugger",
    "default",
    "delete",
    "do",
    "double",
    "else",
    "enum",
    "eval",
    "export",
    "extends",
    "false",
    "final",
    "finally",
    "float",
    "for",
    "function",
    "goto",
    "if",
    "implements",
    "import",
    "in",
    "instanceof",
    "int",
    "interface",
    "let",
    "long",
    "native",
    "new",
    "null",
    "package",
    "private",
    "protected",
    "public",
    "return",
    "short",
    "static",
    "super",
    "switch",
    "synchronized",
    "this",
    "throw",
    "throws",
    "transient",
    "true",
    "try",
    "typeof",
    "var",
    "void",
    "volatile",
    "while",
    "with",
    "yield",
])

export function isValidJSVarName(name: string) {
    return name.match(/^[a-zA-Z_$][\w\$]*$/) && !RESERVED_JS_KEYWORDS.has(name)
}

export type Compiled = {
    run(env: Environment): any
    runUNSAFE(env: Environment): any
    deps: Set<string>
}

export const emptyCompiled: Compiled = {
    run() {},
    runUNSAFE() {},
    deps: new Set<string>(),
}

export function compileExprAst(exprAst: babel.types.Expression, exprSource: string, envVars: string[]): Compiled {
    const deps = freeVars(fileExprAst(exprAst))

    const programAst = programReturnExprAst(exprAst)
    const isAsync = containsToplevelAsync(babelAst.file(programAst))
    const FuncConstructor = isAsync ? AsyncFunction : Function

    const usedEnvVars = envVars.filter(varName => deps.has(varName))

    const exprFunc = FuncConstructor(
        '$',
        '{' + usedEnvVars.filter(isValidJSVarName).join(', ') + '}',
        transformJSAst(programAst, exprSource),
    )

    function runUNSAFE(env: Environment) {
        if (usedEnvVars.some(dependency => env[dependency] === Pending)) {
            return Pending
        }

        function $([name]) { return env[name] }
        return exprFunc($, env)
    }

    function run(env: Environment) {
        try {
            return runUNSAFE(env)
        }
        catch (e) {
            return e
        }
    }

    return {
        run,
        runUNSAFE,
        deps,
    }
}

export function compileJSExpr(code: string, envVars: string[]): Compiled {
    if (code.trim() === '') { return emptyCompiled }

    const ast = parseJSExpr(code)
    return compileExprAst(ast, code, envVars)
}

export function compileJSExprSafe(code: string, envVars: string[]): Compiled {
    try {
        return compileJSExpr(code, envVars)
    }
    catch (e) {
        annotateCodeFrame(e, code)
        return {
            run() { return e },
            runUNSAFE() { throw e },
            deps: new Set(),
        }
    }
}




export const computeExpr = (code: string, env: Environment): unknown => {
    return compileJSExprSafe(code, Object.keys(env)).run(env)
}

export const computeExprUNSAFE = (code: string, env: Environment): unknown => {
    return compileJSExpr(code, Object.keys(env)).runUNSAFE(env)
}

export function freeVarsExpr(code: string) {
    if (!code?.trim()) { return new Set<string>() }
    try {
        return freeVars(fileExprAst(parseJSExpr(code)))
    }
    catch (e) {
        if (e instanceof SyntaxError) {
            return new Set<string>()
        }
        else {
            throw e
        }
    }
}



export function parseJSScript(sourcecode: string) {
    const parserOpts: babelParser.ParserOptions = {
        ...parseReactOpts,
        allowReturnOutsideFunction: true,
        allowAwaitOutsideFunction: true,
    }
    return babelParser.parse(sourcecode, parserOpts)
}

export function transformJSScript(sourcecode: string) {
    const ast = parseJSScript(sourcecode)
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
        ast,
    }
}



export function compileScript(code: string, envVars: string[]): Compiled {
    if (code.trim() === '') { return emptyCompiled }

    const { transformedCode, isAsync, ast } = transformJSScript(code)
    const deps = freeVars(ast)

    const FuncConstructor = isAsync ? AsyncFunction : Function

    const usedEnvVars = envVars.filter(varName => deps.has(varName))

    const exprFunc = FuncConstructor(
        '$',
        '{' + usedEnvVars.filter(isValidJSVarName).join(', ') + '}',
        transformedCode,
    )

    function runUNSAFE(env: Environment) {
        if (usedEnvVars.some(dependency => env[dependency] === Pending)) {
            return Pending
        }

        function $([name]) { return env[name] }
        return exprFunc($, env)
    }

    function run(env: Environment) {
        try {
            return runUNSAFE(env)
        }
        catch (e) {
            return e
        }
    }

    return {
        run,
        runUNSAFE,
        deps,
    }
}

export function compileScriptSafe(code: string, envVars: string[]): Compiled {
    try {
        return compileScript(code, envVars)
    }
    catch (e) {
        annotateCodeFrame(e, code)
        return {
            run() { return e },
            runUNSAFE() { throw e },
            deps: new Set(),
        }
    }
}

export function computeScript(code: string, env: Environment) {
    return compileScriptSafe(code, Object.keys(env)).run(env)
}

export function freeVarsScript(code: string) {
    if (!code?.trim()) { return new Set<string>() }
    try {
        return freeVars(parseJSScript(code))
    }
    catch (e) {
        if (e instanceof SyntaxError) {
            return new Set<string>()
        }
        else {
            throw e
        }
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

export function freeVars(ast: babel.types.Node) {
    const freeVars = new Set<string>(['React'])
    babelTraverse(ast, {
        ReferencedIdentifier(path) {
            // Collect references like $`name with spaces`
            const parent = path.getAncestry()[1]
            if (
                path.node.name === '$'
                && parent
                && parent.isTaggedTemplateExpression()
                && parent.node.quasi.quasis.length === 1
            ) {
                freeVars.add(parent.node.quasi.quasis[0].value.raw)
            }

            const identifier = path.node.name
            if (!path.scope || !path.scope.hasBinding(identifier, true)) {
                freeVars.add(identifier)
            }
        }
    })
    return freeVars
}

export function annotateCodeFrame(e: Error, source: string) {
    if (e instanceof SyntaxError && (e as any).loc !== undefined) {
        (e as any).frame = codeFrameColumns(source, { start: (e as any).loc }, {})
    }
}

export const AsyncFunction = (async function(){}).constructor