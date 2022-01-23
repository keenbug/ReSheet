import React from 'react'

import { ValueViewer, initialBlockState } from './value'
import { EditableCode } from './code-editor'
import { classed } from './ui'
import { runUpdate } from './utils'


/**************** Command Actions **************/


export const setCommandExpr = (expr, commandBlock) =>
    commandBlock.updateExpr(expr)

export const updateState = (stateUpdate, commandBlock) =>
    commandBlock
        .invalidate()
        .update({ blockState: runUpdate(stateUpdate, commandBlock.blockState) })

export const resetStateCode = commandBlock =>
    commandBlock
        .invalidate()
        .update({ blockState: initialBlockState })




/**************** UI *****************/


const CommandLineContainer = classed('div')`flex flex-row space-x-2`
const CommandContent = classed('div')`flex flex-col space-y-1 flex-1`


export const CommandBlockUI = ({ code: command, dispatch }) => {
    const onUpdateExpr    = expr        => dispatch(setCommandExpr, expr)
    const onUpdateState   = stateUpdate => dispatch(updateState,    stateUpdate)

    return (
        <CommandLineContainer key={command.id}>
            <CommandContent>
                <EditableCode code={command.expr} onUpdate={onUpdateExpr} onKeyPress={onKeyPress} />
                <ValueViewer value={command.cachedResult} state={command.state} setState={onUpdateState} />
            </CommandContent>
        </CommandLineContainer>
    )
}


