import * as React from 'react'

import { BlockRef } from '@tables/core'
import * as block from '@tables/core'

import { DocMarkdown } from '@tables/docs/ui'
import { DocsMap } from '@tables/docs'

import { CodeEditor, CodeEditorHandle } from '@tables/code/editor'
import { useCompletionsOverlay } from '@tables/code/completions'
import { safeBlock } from '@tables/blocks/component'

import { computeScript } from '@tables/code/compute'
import { Pending, resultFrom } from '@tables/code/result'
import { ViewResult } from '@tables/code/value'

import { useShortcuts } from '@tables/util/shortcuts'

import { JSExprModel } from './versioned'
import * as versioned from './versioned'


export const JSExpr = block.create<JSExprModel>({
    init: versioned.init,
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
        return updateResult(versioned.fromJSON(json), update, env)
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
                className="flex flex-col space-y-1 flex-1"
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
    const initWithCode = { ...versioned.init, code }

    return function Example() {
        const safeJSExpr = React.useMemo(() => safeBlock(JSExpr), [])
        const [state, setState] = React.useState(null)

        React.useEffect(() => {
            setState(updateResult(initWithCode, setState, env))
        }, [])

        if (state === null) { return null }

        return (
            <div className="border rounded border-gray-100 my-4">
                <safeJSExpr.Component state={state} update={setState} env={env} />
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