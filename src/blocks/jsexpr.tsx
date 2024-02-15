import * as React from 'react'

import { BlockRef } from '../block'
import * as block from '../block'
import { computeScript } from '../logic/compute'
import { Pending, Result, resultFrom } from '../logic/result'

import { ViewResult } from '../ui/value'
import { useShortcuts } from '../ui/shortcuts'

import { CodeEditor, CodeEditorHandle } from '../code-editor'
import { useCompletionsOverlay } from '../code-editor/completions'
import { DocMarkdown } from '../docs/ui'
import { Block } from '../block/component'
import { DocsMap } from '../docs'
import { assertValid, string } from '../utils/validate'


export interface JSExprModel {
    code: string
    result: Result
}

const init: JSExprModel = {
    code: '',
    result: { type: 'immediate', value: undefined },
}


export const JSExpr = block.create<JSExprModel>({
    init,
    view({ env, state, update }, ref) {
        return <JSExprUi ref={ref} state={state} update={update} env={env} />
    },
    recompute(state, update, env) {
        return updateResult(state, update, env)
    },
    getResult(state) {
        switch (state.result.type) {
            case 'immediate':
                return state.result.value

            case 'promise':
                switch (state.result.state) {
                    case 'pending':
                        return Pending
                    
                    case 'failed':
                        return state.result.error
                    
                    case 'finished':
                        return state.result.value
                }
        }
    },
    fromJSON(json, update, env) {
        assertValid(string, json)
        return updateResult(
            {
                code: json,
                result: { type: 'immediate', value: undefined },
            },
            update,
            env,
        )
    },
    toJSON(state) {
        return state.code
    }
})



interface JSExprUiProps {
    state: JSExprModel
    update: block.BlockUpdater<JSExprModel>
    env: block.Environment
}

export const JSExprUi = React.forwardRef(
    function JSExprUi(
        { state, update, env }: JSExprUiProps,
        ref: React.Ref<BlockRef>
    ) {
        const codeEditor = React.useRef<CodeEditorHandle>()
        const completions = useCompletionsOverlay(codeEditor, state.code, env)
        React.useImperativeHandle(
            ref,
            () => ({
                focus() {
                    codeEditor.current?.element?.focus()
                }
            })
        )

        function onUpdateCode(code: string) {
            update(state =>
                updateResult({ ...state, code }, update, env)
            )
        }

        const shortcutProps = useShortcuts([
            ...completions.shortcuts,
            {
                description: "jsexpr",
                bindings: [
                    [["Alt-Enter"], 'none', 'rerun computation',  () => { update(state => updateResult(state, update, env)) }],
                ]
            },
        ])

        return (
            <div
                className="flex flex-col space-y-1 flex-1 my-2"
                onBlur={completions.onBlur}
            >
                <CodeEditor
                    ref={codeEditor}
                    className="border-b border-gray-100"
                    code={state.code}
                    onUpdate={onUpdateCode}
                    {...shortcutProps}
                    />
                <PreviewValue state={state} />
                {completions.ui}
            </div>
        )
    }
)

function updateResult(state: JSExprModel, update: block.BlockUpdater<JSExprModel>, env: block.Environment): JSExprModel {
    const setResult = block.updaterToSetter(block.fieldUpdater('result', update))

    if (state.result.type === 'promise') {
        state.result.cancel()
    }
    const value = computeScript(state.code, env)
    const result = resultFrom(value, setResult)

    return {
        ...state,
        result,
    }
}





export interface PreviewValueProps {
    state: JSExprModel
}

export function PreviewValue({ state }: PreviewValueProps) {
    if (state.result.type === 'immediate' && state.result.value === undefined) { return null }
    return <ViewResult result={state.result} />
}



// Docs

export function JSExprDoc() {
    return (
        <DocMarkdown options={{ overrides: allOverrides }}>
            {`
A multiline JavaScript Block. Supports JSX and toplevel await. The Block's value is the value
of the last expression.

## Examples

<Example1 />

<Example2 />

<Example3 />

<Example4 />
            `.trim()}
        </DocMarkdown>
    )
}
export function gatherDocs(docs: DocsMap) {
    docs.set(JSExpr, JSExprDoc)
}


export function Example(code: string, env: block.Environment) {
    const initWithCode = { ...init, code }

    return function Example() {
        const [state, setState] = React.useState(null)

        React.useEffect(() => {
            setState(updateResult(initWithCode, setState, env))
        }, [])

        if (state === null) { return null }

        return (
            <div className="border rounded border-gray-100 my-4">
                <Block block={JSExpr} state={state} update={setState} env={env} />
            </div>
        )
    }
}

export const Example1 = Example(`
const x = 1;
const y = 2;
Math.min(x, y);
    `.trim(),
    { React },
)

export const Example2 = Example(`
<span className="text-xl font-bold text-red-900">
  Alert
</span>
    `.trim(),
    { React },
)

export const Example3 = Example(`
function Test() {
  const [input, setInput] = React.useState("Hey there")

  function onChange(ev) {
    setInput(ev.target.value)
  }

  return (
    <div>
      <div>
        <input
          className="rounded outline outline-1 outline-sky-200 focus:outline-sky-500"
          type="text"
          value={input}
          onChange={onChange}
          />
      </div>
      <div>{input.toUpperCase()}</div>
    </div>
  )
}

<Test />
    `.trim(),
    { React },
)

export const Example4 = Example(`
function wait(ms) {
  return new Promise(resolve => {
    setTimeout(resolve, ms)
  })
}

await wait(5000);
<span className="text-xl">Done</span>
    `.trim(),
    { React },
)

export const allOverrides = { Example1, Example2, Example3, Example4 }