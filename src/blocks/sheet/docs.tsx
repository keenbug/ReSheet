import React from 'react'

import { DocMarkdown } from '../../docs/ui'
import { DocsMap } from '../../docs'

import { Block } from '../../block/component'
import { computeExpr } from '../../logic/compute'
import { CodeView } from '../../code-editor'

import { Note } from '../note'
import { JSExpr } from '../js'

import { SheetOf } from '.'
import { BlockSelector } from '../block-selector'


export function SheetOfDoc() {
    return (
        <DocMarkdown options={{ overrides: { Example } }}>
            {`
A sheet of lines containing \`innerBlock\`. Lines can refer to prior lines
with their names.

## Parameters

- \`innerBlock: Block\`
    - the inner Block to use in lines

## Examples

<Example code="SheetOf(JSExpr)" />

<Example code="SheetOf(Note)" />

<Example code="SheetOf(BlockSelector('', undefined, { JSExpr, Note }))" />
            `.trim()}
        </DocMarkdown>
    )
}
export default function gatherDocs(docs: DocsMap) {
    docs.set(SheetOf, SheetOfDoc)
}


export function Example({ code }: { code: string }) {
    const block = React.useMemo(() => computeExpr(code, { SheetOf, BlockSelector, Note, JSExpr }), [])
    const [state, setState] = React.useState(block.init)

    return (
        <div className="border rounded border-gray-100 p-1 my-4">
            <CodeView className="block rounded bg-gray-100 px-1" code={code} />
            <div className="border-t-2 border-slate-200 mt-1 pt-1">
                <Block block={block} state={state} update={setState} env={{ BlockSelector, Note, JSExpr }} />
            </div>
        </div>
    )
}