import React from 'react'

import { DocsMap } from '../../docs'
import { DocMarkdown } from '../../docs/ui'

import { Block as BlockComponent } from '../../block/component'
import { computeExpr } from '../../logic/compute'
import { CodeView } from '../../code-editor'

import { JSExpr } from '../js'

import { BlockSelector } from '.'

export function BlockSelectorDoc() {
    return (
        <DocMarkdown options={{ overrides: { Example } }}>
            {`
Choose any Block with JavaScript available either in the environment or the \`blockLibrary\` parameter.

## Parameters

- \`expr: string\`
    - the initial js expression to choose a block
- \`innerBlockInit?: Block<unknown>\`
    - the initial chosen inner block
- \`blockLibrary: Environment\`
    - a builtin library of blocks that should always be available

## Examples

<Example code="BlockSelector('', undefined, { JSExpr })" />

<Example code="BlockSelector('JSExpr', undefined, { JSExpr })" />

<Example code="BlockSelector('JSExpr', JSExpr, { JSExpr })" />

<Example code="BlockSelector(
    'JSExpr',
    {
        ...JSExpr,
        init: { ...JSExpr.init, code: '// write some code' }
    },
    { JSExpr },
)" />
            `.trim()}
        </DocMarkdown>
    )
}
export default function gatherDocs(docs: DocsMap) {
    docs.set(BlockSelector, BlockSelectorDoc)
}


export function Example({ code }: { code: string }) {
    const block = React.useMemo(() => computeExpr(code, { BlockSelector, JSExpr }), [])
    const [state, setState] = React.useState(block.init)

    return (
        <div className="border rounded border-gray-100 p-1 my-4">
            <CodeView className="block rounded bg-gray-100 px-1" code={code} />
            <div className="border-t-2 border-slate-200 mt-1 pt-1">
                <BlockComponent block={block} state={state} update={setState} env={{ BlockSelector, JSExpr }} />
            </div>
        </div>
    )
}