import React from 'react'

import { DocMarkdown } from '@tables/docs/ui'
import { DocsMap } from '@tables/docs'

import { safeBlock } from '@tables/blocks/component'

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
    const [state, setState] = React.useState(null)

    React.useEffect(() => {
        setState(safeNote.recompute(initWithInput, setState, exampleEnv))
    }, [])

    if (state === null) { return null }

    return (
        <div className="border rounded border-gray-100 my-4">
            <safeNote.Component state={state} update={setState} env={exampleEnv} />
        </div>
    )
}
