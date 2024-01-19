import * as React from 'react'

import { ViewResult } from '../ui/value'
import { EditableCode } from '../code-editor'
import { computeScript } from '../logic/compute'
import { BlockRef } from '../block'
import * as block from '../block'
import { useShortcuts } from '../ui/shortcuts'
import { Pending, Result, resultFrom } from '../logic/result'
import { ViewCompletions } from '../ui/completions'


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
        const editorRef = React.useRef<HTMLElement>()
        React.useImperativeHandle(
            ref,
            () => ({
                focus() {
                    editorRef.current?.focus()
                }
            })
        )
        const [isFocused, setFocused] = React.useState(false)

        const onUpdateCode = (code: string) => update(state => updateResult({ ...state, code }, update, env))

        const shortcutProps = useShortcuts([
            {
                description: "jsexpr",
                bindings: [
                    [["Alt-Enter"], 'none', 'rerun computation', () => { update(state => updateResult(state, update, env)) }],
                ]
            }
        ])

        return (
            <div className="flex flex-col space-y-1 flex-1 my-2">
                <EditableCode
                    ref={editorRef}
                    code={state.code}
                    onUpdate={onUpdateCode}
                    {...shortcutProps}
                    onFocus={event => {
                        setFocused(true)
                        shortcutProps.onFocus(event)
                    }}
                    onBlur={event => {
                        setFocused(false)
                        shortcutProps.onBlur(event)
                    }}
                    />
                <PreviewValue
                    state={state}
                    env={env}
                    isFocused={isFocused}
                    />
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
    env: block.Environment
    isFocused: boolean
}

export function PreviewValue({ state, env, isFocused }: PreviewValueProps) {
    const code = state.code
    if (!isFocused) {
        if (state.result.type === 'immediate' && state.result.value === undefined) { return null }
        return <ViewResult result={state.result} />
    }

    return <ViewCompletions code={code} env={env} default={<ViewResult result={state.result} />} />
}