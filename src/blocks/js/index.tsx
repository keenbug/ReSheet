import * as React from 'react'

import { BlockHandle } from '@resheet/core/block'
import * as block from '@resheet/core/block'

import { DocMarkdown } from '@resheet/docs/ui'
import { DocsMap } from '@resheet/docs'

import { CodeEditor, CodeEditorHandle } from '@resheet/code/editor'
import { useCompletionsOverlay } from '@resheet/code/completions'
import { safeBlock } from '@resheet/blocks/component'

import { compileScriptSafe } from '@resheet/code/compute'
import { Result, getResultValue, resultFrom } from '@resheet/code/result'
import { ViewResult } from '@resheet/code/value'

import { clampBetween } from '@resheet/util'
import { useShortcuts } from '@resheet/util/shortcuts'
import { fieldDispatcher } from '@resheet/util/dispatch'
import { useStable } from '@resheet/util/hooks'

import { JSExprModel } from './versioned'
import * as versioned from './versioned'


export const JSExpr = block.create<JSExprModel>({
    init: versioned.init,
    view({ env, state, dispatch }, ref) {
        return <JSExprUi ref={ref} state={state} dispatch={dispatch} env={env} />
    },
    recompute(state, dispatch, env, changedVars) {
        if (changedVars && changedVars.intersect(state.compiled.deps).isEmpty()) {
            return { state, invalidated: false }
        }

        return {
            state: updateResult(state, dispatch, env),
            invalidated: true,
        }
    },
    getResult(state) {
        return getResultValue(state.result)
    },
    fromJSON(json, dispatch, env) {
        return updateResult(versioned.fromJSON(json)(env), dispatch, env)
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

        const onUpdateCode = React.useCallback(function onUpdateCode(code: string) {
            dispatch((state, { env }) => ({
                state: updateResult(
                    { ...state, code, compiled: compileScriptSafe(code, Object.keys(env)) },
                    dispatch,
                    env,
                ),
            }))
        }, [dispatch])

        const shortcutProps = useShortcuts([
            ...completions.shortcuts,
            {
                description: "jsexpr",
                bindings: [
                    [["Alt-Enter"], 'none', 'rerun computation',  () => {
                        dispatch((state, { env }) => ({
                            state: updateResult(state, dispatch, env),
                            description: "reran computation",
                        }))
                    }],
                ]
            },
        ])

        const codeLines = state.code.split('\n').length
        const backgroundOpacity = clampBetween(0, 1, (codeLines - 3) / 5)
        const [indicatorWidth, indicatorColor] = (
            codeLines > 3 ?
                [
                    clampBetween(0, .25, codeLines / 40) + 'rem',
                    `rgba(125, 211, 252, ${clampBetween(0, 1, (codeLines - 3) / 20 + .4)})`, // = sky-300/[${...}]
                ]
            :
                ['0', 'transparent']
        )
        const style = useStable({
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
            boxShadow: `inset -${indicatorWidth} 0 0 0 ${indicatorColor}`,
            '--tw-gradient-to': `rgb(240, 249, 255, ${backgroundOpacity}) var(--tw-gradient-to-position)`, // = to-sky-50/[${backgroundOpacity}]
        })


        return (
            <div
                className="flex flex-col space-y-1"
                onBlur={completions.onBlur}
            >
                <CodeEditor
                    ref={codeEditor}
                    code={state.code}
                    onUpdate={onUpdateCode}
                    style={style}
                    className={`
                        whitespace-pre outline-none
                        border-b border-gray-100
                        focus-within/code-editor:bg-gradient-to-r
                        from-transparent from-10%
                        overflow-x-auto
                    `}
                    {...shortcutProps}
                    />
                <ViewResult result={state.result} />
                {completions.ui}
            </div>
        )
    }
)

function updateResult(
    state: JSExprModel,
    dispatch: block.BlockDispatcher<JSExprModel>,
    env: block.Environment,
): JSExprModel {
    const dispatchResult = fieldDispatcher('result', dispatch)
    function setResult(result: Result) {
        dispatchResult(() => ({ state: result }))
    }

    if (state.result.type === 'promise') {
        state.result.cancel()
    }
    const value = state.compiled.run(env)
    const result = resultFrom(value, setResult)

    return {
        ...state,
        result,
    }
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
        const [state, dispatch] = block.useBlockDispatcher<JSExprModel | null>(null, [{ env }])

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