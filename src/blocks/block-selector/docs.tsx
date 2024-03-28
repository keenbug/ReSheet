import React from 'react'

import { Block, useBlockDispatcher } from '@resheet/core/block'
import { CodeView } from '@resheet/code/editor'
import { computeExpr } from '@resheet/code/compute'

import { DocsMap } from '@resheet/docs'
import { DocMarkdown } from '@resheet/docs/ui'

import { safeBlock } from '../component'

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


const exampleEnv = { BlockSelector, JSExpr }

export function Example({ code }: { code: string }) {
    const block = React.useMemo(() => safeBlock(computeExpr(code, { BlockSelector, JSExpr }) as Block<unknown>), [])
    const [state, dispatch] = useBlockDispatcher(block.init, { env: exampleEnv})

    return (
        <div className="border rounded border-gray-100 p-1 my-4">
            <CodeView className="block rounded bg-gray-100 px-1" code={code} />
            <div className="border-t-2 border-slate-200 mt-1 pt-1">
                <block.Component state={state} dispatch={dispatch} env={exampleEnv} />
            </div>
        </div>
    )
}