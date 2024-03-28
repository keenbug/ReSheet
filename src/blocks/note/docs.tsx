import React from 'react'

import { useBlockDispatcher } from '@resheet/core/block'

import { DocMarkdown } from '@resheet/docs/ui'
import { DocsMap } from '@resheet/docs'

import { safeBlock } from '@resheet/blocks/component'

import { JSExpr } from '../js'
import { Note } from '.'


export function NoteDoc() {
    return (
        <DocMarkdown options={{ overrides: { Example } }}>
            {`
A single note line. Can be text formatted with Markdown, a computation
with JavaScript or any other Block.

## Syntax

- \`= <JavaScript Expression>\`
- \`/ <Block (JS Expression)>\`
- \`<Markdown>\`, eg
    - \`# Heading Level 1\`
    - \`## Heading Level 2\`
    - \`### Heading Level 3\`
    - \`*italic*\`, \`**bold**\`
    - \`[link text](link url)\`

## Examples

<Example input="# Heading Level 1" />

<Example input="= 12 * 12" />

<Example input="/JSExpr" />
            `.trim()}
        </DocMarkdown>
    )
}
export default function gatherDocs(docs: DocsMap) {
    docs.set(Note, NoteDoc)
}

export const exampleEnv = { JSExpr }

export function Example({ input }: { input: string }) {
    const initWithInput = { ...Note.init, input }
    const safeNote = safeBlock(Note)
    const [state, dispatch] = useBlockDispatcher(null)

    React.useEffect(() => {
        dispatch(() => ({ state: safeNote.recompute(initWithInput, dispatch, exampleEnv, null) }))
    }, [])

    if (state === null) { return null }

    return (
        <div className="border rounded border-gray-100 my-4">
            <safeNote.Component state={state} dispatch={dispatch} env={exampleEnv} />
        </div>
    )
}
