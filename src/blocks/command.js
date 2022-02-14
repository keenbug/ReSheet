import React from 'react'

import { CommandFCO, createBlock, isBlock } from '../logic/components'
import { ValueInspector } from '../ui/value'
import { EditableCode } from '../ui/code-editor'
import { classed } from '../ui/utils'


/**************** Command Actions **************/


export const setCommandExpr = (expr, commandBlock) =>
    commandBlock.update({ expr })

export const updateMode = (mode, commandBlock) =>
    commandBlock.update({ mode })

export const chooseBlock = (env, commandBlock) =>
    commandBlock.chooseBlock(env)

export const updateBlock = (blockUpdate, commandBlock) =>
    commandBlock.update({
        innerBlock:
            typeof blockUpdate === 'function' ?
                blockUpdate(commandBlock.innerBlock)
            :
                blockUpdate
        ,
    })

export const CommandBlock = blockLibrary => CommandFCO
    .addState({ mode: 'choose' })
    .addMethods({
        fromJSON({ mode, ...json }, library) {
            return this
                .call(CommandFCO.fromJSON, json, library, blockLibrary)
                .pipe(self => self.update({ mode: self.innerBlock ? mode : 'choose' }))
        },
        toJSON() {
            const { mode } = this
            return {
                ...this.call(CommandFCO.toJSON),
                mode,
            }
        },
        view({ block, setBlock, env }) {
            const dispatch = (action, ...args) => {
                setBlock(block => action(...args, block))
            }
            return <CommandBlockUI command={block} dispatch={dispatch} env={env} blockLibrary={blockLibrary} />
        },
        getResult(env) {
            return this.call(CommandFCO.getResult, env, blockLibrary)
        },
        chooseBlock(env) {
            const blockCmdResult = this.getBlock(env, blockLibrary)
            if (isBlock(blockCmdResult)) {
                return this
                    .update({ mode: 'run', innerBlock: blockCmdResult })
            }
            else {
                return this
            }
        },
    })
    .pipe(createBlock)




/**************** UI *****************/



const CommandLineContainer = classed('div')`flex flex-row space-x-2`
const CommandContent = classed('div')`flex flex-col space-y-1 flex-1`

const ChangeBlockButton = classed('button')`
    text-xs text-gray-400 rounded-full
    hover:text-gray-700 hover:bg-gray-200 hover:px-1
    transition-all duration-100
`


export const CommandBlockUI = ({ command, dispatch, env, blockLibrary }) => {
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
    
    const blockCmdResult = command.getBlock(env, blockLibrary)

    switch (command.mode) {
        case 'run':
            return (
                <CommandLineContainer key={command.id}>
                    <CommandContent>
                        <div>
                            <ChangeBlockButton onClick={() => onSetMode('choose')}>
                                {command.expr}
                            </ChangeBlockButton>
                        </div>
                        {command.innerBlock.render(onUpdateBlock, env) }
                    </CommandContent>
                </CommandLineContainer>
            )

        case 'choose':
        default:
            return (
                <CommandLineContainer key={command.id}>
                    <CommandContent>
                        <EditableCode code={command.expr} onUpdate={onUpdateExpr} onKeyPress={onChooseKeyPress(env)} />
                        {isBlock(blockCmdResult) ?
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


