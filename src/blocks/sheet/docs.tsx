import React from 'react'

import { Block, useBlockDispatcher } from '@resheet/core/block'

import { DocMarkdown } from '@resheet/docs/ui'
import { DocsMap } from '@resheet/docs'

import { computeExpr } from '@resheet/code/compute'
import { CodeView } from '@resheet/code/editor'

import { safeBlock } from '../component'

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


const exampleEnv = { BlockSelector, Note, JSExpr }

export function Example({ code }: { code: string }) {
    const block = React.useMemo(() => safeBlock(computeExpr(code, { SheetOf, BlockSelector, Note, JSExpr }) as Block<unknown>), [])
    const [state, setState] = useBlockDispatcher(block.init, [{ env: exampleEnv }])

    return (
        <div className="border rounded border-gray-100 p-1 my-4">
            <CodeView className="block rounded bg-gray-100 px-1" code={code} />
            <div className="border-t-2 border-slate-200 mt-1 pt-1">
                <block.Component state={state} dispatch={setState} env={exampleEnv} />
            </div>
        </div>
    )
}