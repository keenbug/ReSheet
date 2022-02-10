import { parse } from '@babel/parser'
import generate from '@babel/generator'


/**************** JS Importer *****************/

export const parseJsCode = code => {
    const ast = parse(code, { sourceType: 'module', plugins: [ 'jsx' ] })
    return ast.program.body.map(parseJsAstNode)
}

export const parseJsAstNode = node => {
    if (node.type === 'ExportNamedDeclaration') {
        return {
            name: node.declaration.declarations[0].id.name,
            expr: generate(node.declaration.declarations[0].init).code,
        }
    }
    else if (node.type === 'VariableDeclaration') {
        return {
            name: node.declarations[0].id.name,
            expr: generate(node.declarations[0].init).code,
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

const mapImport = node => (
  node.local.name === node.imported.name ?
    node.local.name
  : (
    node.imported.name + ': ' + node.local.name
  )
)

const mapImportSpecifier = node =>
  node.type === "ImportDefaultSpecifier" ?
    `default: ${node.local.name}`
  : node.type === "ImportSpecifier" ?
    mapImport(node)
  :
    generator(node).code


const mapImportAssignment = specifiers =>
  specifiers[0].type === "ImportNamespaceSpecifier" ?
    specifiers[0].local.name
  : (
    "{ " + specifiers.map(mapImportSpecifier).join(", ") + " }"
  )

export const mapImportSource = source => (
    `$import(${JSON.stringify(source)})`
)


export const exportJsCode = code =>
    code.toList()
        .map(block =>
            `const ${block.getName()} = ${block.expr}`
        )
        .reverse()
        .join("\n\n")
