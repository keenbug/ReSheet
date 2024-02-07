import * as React from 'react'

import { BlockRef } from '../block'
import * as block from '../block'
import { computeScript } from '../logic/compute'
import { Pending, Result, resultFrom } from '../logic/result'

import { ViewResult } from '../ui/value'
import { useShortcuts } from '../ui/shortcuts'

import { CodeEditor, CodeEditorHandle } from '../code-editor'
import { useCompletionsOverlay } from '../code-editor/completions'


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
        if (typeof json === 'string') {
            return updateResult(
                {
                    code: json,
                    result: { type: 'immediate', value: undefined },
                },
                update,
                env,
            )
        }
        else {
            return init
        }
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