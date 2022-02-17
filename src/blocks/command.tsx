import * as React from 'react'

import * as Block from '../logic/block'
import { ValueInspector } from '../ui/value'
import { EditableCode } from '../ui/code-editor'
import { classed } from '../ui/utils'
import { computeExpr } from '../logic/compute'


/**************** Command Actions **************/


export const setCommandExpr = (expr, state) => (
    { ...state, expr }
)

export const updateMode = (mode, state) => (
    { ...state, mode }
)

export const chooseBlock = (env, state, blockLibrary) =>
    chooseBlock_(state, env, blockLibrary)

export const updateBlock = (blockUpdate, state) => (
    {
        ...state,
        innerBlock: {
            ...state.innerBlock,
            state:
                typeof blockUpdate === 'function' ?
                    blockUpdate(state.innerBlock.state)
                :
                    blockUpdate
            ,
        }
    }
)


const chooseBlock_ = (state, env, blockLibrary) => {
    const blockCmdResult = computeExpr(state.expr, { ...blockLibrary, ...env })
    if (Block.isBlock(blockCmdResult)) {
        return { ...state, mode: 'run', innerBlock: { state: blockCmdResult.init, block: blockCmdResult } }
    }
    else {
        return state
    }
}

const loadBlock = ({ mode, inner, expr }, library, blockLibrary) => {
    if (mode === 'choose') { return null }

    const block = computeExpr(expr, { ...blockLibrary, ...library })
    const state = block.fromJSON(inner, library)
    return { block, state }
}

export const CommandBlock = blockLibrary => Block.create({
    init: { mode: 'choose', innerBlock: null, expr: "" },
    view({ state, setState, env }) {
        const dispatch = (action, ...args) => {
            setState(state => action(...args, state, blockLibrary))
        }
        return <CommandBlockUI state={state} dispatch={dispatch} env={env} blockLibrary={blockLibrary} />
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


export const CommandBlockUI = ({ state, dispatch, env, blockLibrary }) => {
    const onUpdateExpr    = expr        => dispatch(setCommandExpr, expr)
    const onUpdateBlock   = blockUpdate => dispatch(updateBlock, blockUpdate)
    const onSetMode       = mode        => dispatch(updateMode, mode)
    const onChooseBlock   = env         => dispatch(chooseBlock, env)

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
                        {state.innerBlock.block.view({ state: state.innerBlock.state, setState: onUpdateBlock, env }) }
                    </CommandContent>
                </CommandLineContainer>
            )

        case 'choose':
        default:
            return (
                <CommandLineContainer>
                    <CommandContent>
                        <EditableCode code={state.expr} onUpdate={onUpdateExpr} onKeyPress={onChooseKeyPress(env)} />
                        {Block.isBlock(blockCmdResult) ?
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


