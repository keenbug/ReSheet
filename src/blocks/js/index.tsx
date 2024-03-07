import * as React from 'react'

import { BlockHandle } from '@tables/core/block'
import * as block from '@tables/core/block'

import { DocMarkdown } from '@tables/docs/ui'
import { DocsMap } from '@tables/docs'

import { CodeEditor, CodeEditorHandle } from '@tables/code/editor'
import { useCompletionsOverlay } from '@tables/code/completions'
import { safeBlock } from '@tables/blocks/component'

import { computeScript } from '@tables/code/compute'
import { Pending, Result, resultFrom } from '@tables/code/result'
import { ViewResult } from '@tables/code/value'

import { useShortcuts } from '@tables/util/shortcuts'

import { JSExprModel } from './versioned'
import * as versioned from './versioned'
import { fieldDispatcher } from '@tables/util/dispatch'


export const JSExpr = block.create<JSExprModel>({
    init: versioned.init,
    view({ env, state, dispatch }, ref) {
        return <JSExprUi ref={ref} state={state} dispatch={dispatch} env={env} />
    },
    recompute(state, dispatch, env) {
        return updateResult(state, dispatch, env)
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
    fromJSON(json, dispatch, env) {
        return updateResult(versioned.fromJSON(json), dispatch, env)
    },
    toJSON(state) {
        return state.code
    }
})



interface JSExprUiProps {
    state: JSExprModel
    dispatch: block.BlockDispatcher<JSExprModel>
    env: block.Environment
}

export const JSExprUi = React.forwardRef(
    function JSExprUi(
        { state, dispatch, env }: JSExprUiProps,
        ref: React.Ref<BlockHandle>
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
            dispatch(state => ({
                state: updateResult({ ...state, code }, dispatch, env)
            }))
        }

        const shortcutProps = useShortcuts([
            ...completions.shortcuts,
            {
                description: "jsexpr",
                bindings: [
                    [["Alt-Enter"], 'none', 'rerun computation',  () => { dispatch(state => ({ state: updateResult(state, dispatch, env), description: "reran computation" })) }],
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

function updateResult(state: JSExprModel, dispatch: block.BlockDispatcher<JSExprModel>, env: block.Environment): JSExprModel {
    const dispatchResult = fieldDispatcher('result', dispatch)
    function setResult(result: Result) {
        dispatchResult(() => ({ state: result }))
    }

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
        const [state, dispatch] = block.useBlockDispatcher<JSExprModel | null>(null)

        React.useEffect(() => {
            dispatch(() => ({ state: updateResult(initWithCode, dispatch, env) }))
        }, [])

        if (state === null) { return null }

        return (
            <div className="border rounded border-gray-100 my-4">
                <safeJSExpr.Component state={state} dispatch={dispatch} env={env} />
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