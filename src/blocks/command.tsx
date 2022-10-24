import * as React from 'react'
import produce, { original } from 'immer'

import * as block from '../logic/block'
import { Block } from '../logic/block'
import { ErrorBoundary, ValueInspector } from '../ui/value'
import { EditableCode } from '../ui/code-editor'
import { classed } from '../ui/utils'
import { computeExpr } from '../logic/compute'


export interface CommandModel {
    expr: string
    mode: Mode
    innerBlockState: null | unknown
    innerBlock: null | Block<unknown>
}

export type Mode = 'run' | 'choose'


/**************** Command Actions **************/


export const setCommandExpr = produce<CommandModel, [string]>((draft: CommandModel, expr: string) => {
    draft.expr = expr
})

export const updateMode = produce<CommandModel, [Mode]>((draft: CommandModel, mode: Mode) => {
    draft.mode = mode
})

export const setInnerBlockState = produce<CommandModel, [unknown]>((draft, innerBlockState) => {
    draft.innerBlockState = innerBlockState
})

export const chooseBlock = produce<CommandModel, [block.Environment, block.Environment]>((draft: CommandModel, env: block.Environment, blockLibrary: block.Environment) => {
    const blockCmdResult = computeExpr(draft.expr, { ...blockLibrary, ...env })
    if (block.isBlock(blockCmdResult)) {
        draft.mode = 'run'
        draft.innerBlock = blockCmdResult
        if (draft.innerBlockState === null || draft.innerBlockState === undefined) {
            draft.innerBlockState = blockCmdResult.init
        }
    }
})

export const updateBlock = produce<CommandModel, [(state: unknown) => unknown]>((draft: CommandModel, action) => {
    draft.innerBlockState = action(original(draft).innerBlockState)
})

const loadBlock = ({ mode, inner, expr }, library, blockLibrary) => {
    if (mode === 'choose') { return null }

    const innerBlock = computeExpr(expr, { ...blockLibrary, ...library })
    const innerBlockState = innerBlock.fromJSON(inner, library)
    return { innerBlock, innerBlockState }
}

export const CommandBlock = blockLibrary => block.create<CommandModel>({
    init: { mode: 'choose', innerBlockState: null, innerBlock: null, expr: "" },
    view({ state, update, env }) {
        return <CommandBlockUI state={state} update={update} env={env} blockLibrary={blockLibrary} />
    },
    getResult(state, env) {
        if (state.mode === 'choose') { return null }
    
        return state.innerBlock.getResult(state.innerBlockState, env)
    },
    fromJSON(json: any, library) {
        const { mode = 'choose', inner = null, expr = "" } = json
        return {
            mode,
            expr,
            ...loadBlock(json, library, blockLibrary),
        }
    },
    toJSON({ mode, expr, innerBlock, innerBlockState }) {
        return {
            mode,
            expr,
            inner:
                mode === 'run' && innerBlock !== null && innerBlockState !== null ?
                    innerBlock.toJSON(innerBlockState)
                :
                    null
            ,
        }
    },
})


/**************** UI *****************/



const CommandContent = classed<any>('div')`flex flex-col space-y-1 flex-1`

const CommandPreviewSection = classed<any>('div')`
    flex flex-col space-y-2
    m-1 p-2 rounded
    shadow
`

const ChangeBlockButton = classed<any>('button')`
    text-xs text-gray-400 rounded-full
    hover:text-gray-700 hover:bg-gray-200 hover:px-1
    transition-all duration-100
`


export const CommandBlockUI = ({ state, update, env, blockLibrary }) => {
    const onUpdateExpr  = expr   => update(state => setCommandExpr(state, expr))
    const onSetMode     = mode   => update(state => updateMode(state, mode))
    const onChooseBlock = env    => update(state => chooseBlock(state, env, blockLibrary))
    const onResetState  = ()     => update(state => setInnerBlockState(state, blockCmdResult.init))
    const subupdate     = action => update(state => updateBlock(state, action))

    const onChooseKeyPress = env => event => {
        if (event.key === 'Enter' && event.metaKey) {
            event.preventDefault()
            event.stopPropagation()
            onChooseBlock(env)
        }
    }
    
    const blockCmdResult = computeExpr(state.expr, { ...blockLibrary, ...env })

    switch (state.mode) {
        case 'run':
            return (
                <CommandContent>
                    <div>
                        <ChangeBlockButton onClick={() => onSetMode('choose')}>
                            {state.expr}
                        </ChangeBlockButton>
                    </div>
                    <ErrorBoundary title={"There was an error in: " + state.expr}>
                        {state.innerBlock.view({ state: state.innerBlockState, update: subupdate, env }) }
                    </ErrorBoundary>
                </CommandContent>
            )

        case 'choose':
        default:
            return (
                <CommandContent>
                    <EditableCode code={state.expr} onUpdate={onUpdateExpr} onKeyPress={onChooseKeyPress(env)} />
                    {block.isBlock(blockCmdResult) ?
                        <React.Fragment>
                            <button onClick={() => onChooseBlock(env)}>Choose</button>

                            <CommandPreviewSection>
                                <h1>Preview</h1>
                                <ErrorBoundary title="Could not show block">
                                    {blockCmdResult.view({
                                        state: state.innerBlockState ?? blockCmdResult.init,
                                        update: () => {},
                                        env,
                                    })}
                                </ErrorBoundary>
                            </CommandPreviewSection>

                            <CommandPreviewSection>
                                <h1>State</h1>
                                <ValueInspector value={state.innerBlockState ?? blockCmdResult.init} />
                                <button onClick={onResetState}>Reset</button>
                            </CommandPreviewSection>
                        </React.Fragment>
                    :
                        <ValueInspector value={blockCmdResult} />
                    }
                </CommandContent>
            )
    }
}


