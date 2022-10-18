import * as React from 'react'
import produce from 'immer'

import * as block from '../logic/block'
import { Block } from '../logic/block'
import { ErrorBoundary, ValueInspector } from '../ui/value'
import { EditableCode } from '../ui/code-editor'
import { classed } from '../ui/utils'
import { computeExpr } from '../logic/compute'


export interface CommandModel<InnerState> {
    expr: string
    mode: Mode
    innerBlock: null | {
        state: InnerState
        block: Block<InnerState>
    }
}

export type Mode = 'run' | 'choose'


/**************** Command Actions **************/


export const setCommandExpr = produce((draft: CommandModel<unknown>, expr: string) => {
    draft.expr = expr
})

export const updateMode = produce((draft: CommandModel<unknown>, mode: Mode) => {
    draft.mode = mode
})

export const chooseBlock = produce((draft: CommandModel<unknown>, env: block.Environment, blockLibrary: block.Environment) => {
    const blockCmdResult = computeExpr(draft.expr, { ...blockLibrary, ...env })
    if (block.isBlock(blockCmdResult)) {
        draft.mode = 'run'
        draft.innerBlock = {
            state: blockCmdResult.init,
            block: blockCmdResult,
        }
    }
})

export const updateBlock = <State extends any>(state: CommandModel<State>, action: (state: State) => State) =>
    produce(state, (draft: CommandModel<State>) => {
        draft.innerBlock.state = action(state.innerBlock.state)
    })

const loadBlock = ({ mode, inner, expr }, library, blockLibrary) => {
    if (mode === 'choose') { return null }

    const block = computeExpr(expr, { ...blockLibrary, ...library })
    const state = block.fromJSON(inner, library)
    return { block, state, error: null }
}

export const CommandBlock = blockLibrary => block.create<CommandModel<any>>({
    init: { mode: 'choose', innerBlock: null, expr: "" },
    view({ state, update, env }) {
        return <CommandBlockUI state={state} update={update} env={env} blockLibrary={blockLibrary} />
    },
    getResult(state, env) {
        if (state.mode === 'choose') { return null }
    
        return state.innerBlock.block.getResult(state.innerBlock.state, env)
    },
    fromJSON(json: any, library) {
        const { mode = 'choose', inner = null, expr = "" } = json
        return {
            mode,
            expr,
            innerBlock: loadBlock(json, library, blockLibrary),
        }
    },
    toJSON({ mode, expr, innerBlock }) {
        return {
            mode,
            expr,
            inner: innerBlock ? innerBlock.block.toJSON(innerBlock.state) : null,
        }
    },
})


/**************** UI *****************/



const CommandLineContainer = classed<any>('div')`flex flex-row space-x-2`
const CommandContent = classed<any>('div')`flex flex-col space-y-1 flex-1`

const ChangeBlockButton = classed<any>('button')`
    text-xs text-gray-400 rounded-full
    hover:text-gray-700 hover:bg-gray-200 hover:px-1
    transition-all duration-100
`


export const CommandBlockUI = ({ state, update, env, blockLibrary }) => {
    const onUpdateExpr  = expr   => update(state => setCommandExpr(state, expr))
    const onSetMode     = mode   => update(state => updateMode(state, mode))
    const onChooseBlock = env    => update(state => chooseBlock(state, env, blockLibrary))
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
                <CommandLineContainer>
                    <CommandContent>
                        <div>
                            <ChangeBlockButton onClick={() => onSetMode('choose')}>
                                {state.expr}
                            </ChangeBlockButton>
                        </div>
                        <ErrorBoundary title={"There was an error in: " + state.expr}>
                            {state.innerBlock.block.view({ state: state.innerBlock.state, update: subupdate, env }) }
                        </ErrorBoundary>
                    </CommandContent>
                </CommandLineContainer>
            )

        case 'choose':
        default:
            return (
                <CommandLineContainer>
                    <CommandContent>
                        <EditableCode code={state.expr} onUpdate={onUpdateExpr} onKeyPress={onChooseKeyPress(env)} />
                        {block.isBlock(blockCmdResult) ?
                            <React.Fragment>
                                <button onClick={() => onChooseBlock(env)}>Choose</button>
                                <ValueInspector value={blockCmdResult} />
                            </React.Fragment>
                        :
                            <ValueInspector value={blockCmdResult} />
                        }
                    </CommandContent>
                </CommandLineContainer>
            )
    }
}


