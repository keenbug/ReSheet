import React from 'react'

import { CommandFCO, createBlock, isBlock } from './components'
import { ValueInspector } from './value'
import { EditableCode } from './code-editor'
import { classed } from './ui'
import { runUpdate } from './utils'
import stdLibrary from './std-library'


/**************** Command Actions **************/


export const setCommandExpr = (expr, commandBlock) =>
    commandBlock.updateExpr(expr)

export const updateBlock = (blockUpdate, commandBlock) =>
    commandBlock.update({ innerBlock: runUpdate(blockUpdate, commandBlock.innerBlock) })




/**************** UI *****************/


export const CommandBlock = library => CommandFCO
    .addMethods({
        fromJSON(json) {
            return this.call(CommandFCO.fromJSON, json, library)
        },
        view({ block, setBlock }) {
            const dispatch = (action, ...args) => {
                setBlock(block =>
                    action(...args, block)
                        .startBlock({ ...stdLibrary, ...library.blocks })
                )
            }
            return <CommandBlockUI code={block} dispatch={dispatch} />
        },
    })
    .pipe(createBlock)


const CommandLineContainer = classed('div')`flex flex-row space-x-2`
const CommandContent = classed('div')`flex flex-col space-y-1 flex-1`


export const CommandBlockUI = ({ code: command, dispatch }) => {
    const onUpdateExpr    = expr        => dispatch(setCommandExpr, expr)
    const onUpdateBlock   = blockUpdate => dispatch(updateBlock, blockUpdate)
    const [mode, setMode] = React.useState('choose')

    switch (mode) {
        case 'run':
            return (
                <CommandLineContainer key={command.id}>
                    <CommandContent>
                        <button onClick={() => setMode('choose')}>Change Block</button>
                        {command.innerBlock && command.innerBlock.render(onUpdateBlock) }
                    </CommandContent>
                </CommandLineContainer>
            )

        case 'choose':
        default:
            return (
                <CommandLineContainer key={command.id}>
                    <CommandContent>
                        <EditableCode code={command.expr} onUpdate={onUpdateExpr} />
                        {isBlock(command.cachedResult) ?
                            <React.Fragment>
                                <button onClick={() => setMode('run')}>Choose</button>
                                {command.cachedResult.render(() => {})}
                            </React.Fragment>
                        :
                            <ValueInspector value={command.cachedResult} />
                        }
                    </CommandContent>
                </CommandLineContainer>
            )
    }
}


