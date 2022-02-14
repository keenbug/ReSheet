import { parse } from '@babel/parser'
import { Statement, ImportSpecifier, ImportDefaultSpecifier, ImportNamespaceSpecifier } from '@babel/types'
import generate from '@babel/generator'


/**************** JS Importer *****************/

export const parseJsCode = (code: string) => {
    const ast = parse(code, { sourceType: 'module', plugins: [ 'jsx' ] })
    return ast.program.body.map(parseJsAstNode)
}

export const parseJsAstNode = (node: Statement) => {
    if (node.type === 'ExportNamedDeclaration') {
        if (
            node.declaration.type === 'VariableDeclaration' &&
            node.declaration.declarations.length === 1 &&
            node.declaration.declarations[0].id.type === 'Identifier'
        ) {
            return {
                name: node.declaration.declarations[0].id.name,
                expr: generate(node.declaration.declarations[0].init).code,
            }
        }
        else {
            return {
                name: '',
                expr: generate(node.declaration),
            }
        }
    }
    else if (node.type === 'VariableDeclaration') {
        if (node.declarations.length === 1 && node.declarations[0].id.type === 'Identifier') {
            return {
                name: node.declarations[0].id.name,
                expr: generate(node.declarations[0].init).code,
            }
        }
        else {
            return {
                name: '',
                expr: generate(node),
            }
        }
    }
    else if (node.type === 'ImportDeclaration') {
        return {
            name: mapImportAssignment(node.specifiers),
            expr: mapImportSource(node.source.value)
        }
    }
    else {
        return {
            name: '',
            expr: generate(node).code,
        }
    }
}

const mapImport = (node: ImportSpecifier) => (
    node.imported.type === 'StringLiteral' ?
        '_' // TODO check what StringLiteral as imported actually means
    : node.local.name === node.imported.name ?
        node.local.name
    : (
        node.imported.name + ': ' + node.local.name
    )
)

const mapImportSpecifier = (node: ImportSpecifier | ImportDefaultSpecifier | ImportNamespaceSpecifier) =>
    node.type === "ImportDefaultSpecifier" ?
        `default: ${node.local.name}`
    : node.type === "ImportSpecifier" ?
        mapImport(node)
    :
        generate(node).code


const mapImportAssignment = (specifiers: Array<ImportSpecifier | ImportDefaultSpecifier | ImportNamespaceSpecifier>) =>
    specifiers[0].type === "ImportNamespaceSpecifier" ?
        specifiers[0].local.name
    : (
        "{ " + specifiers.map(mapImportSpecifier).join(", ") + " }"
    )

export const mapImportSource = (source: string) => (
    `$import(${JSON.stringify(source)})`
)


export const exportJsCode = code =>
    code.toList()
        .map(block =>
            `const ${block.getName()} = ${block.expr}`
        )
        .reverse()
        .join("\n\n")
