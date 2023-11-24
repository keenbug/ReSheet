import * as React from 'react'

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import * as solidIcons from '@fortawesome/free-solid-svg-icons'

import * as block from '../../block'
import { Block, BlockRef, Environment } from '../../block'
import { ErrorBoundary, ValueInspector } from '../../ui/value'
import { CodeView, EditableCode } from '../../ui/code-editor'
import { computeExpr } from '../../logic/compute'
import { EffectfulUpdater, useEffectfulUpdate } from '../../ui/hooks'
import { getFullKey } from '../../ui/utils'

import { BlockSelectorState } from './model'
import * as Model from './model'


function ACTIONS(
    update: EffectfulUpdater<BlockSelectorState>,
    inputRef: React.MutableRefObject<HTMLTextAreaElement>,
    innerBlockRef: React.MutableRefObject<BlockRef>,
    blockLibrary: Environment
) {
    return {
        updateExpr(expr: string) {
            update(state => {
                return [{ ...state, expr }]
            })
        },

        setChooseMode() {
            update(state => {
                if (state.mode === 'loading') { return [state] }

                return [
                    {
                        mode: 'choose',
                        expr: state.expr,
                        innerBlock: state.innerBlock,
                        innerBlockState: state.innerBlockState,
                    },
                    () => inputRef.current?.focus()
                ]
            })
        },

        cancelChoose() {
            update(state => {
                if (state.mode === 'loading') {
                    return [state]
                }
                if (!block.isBlock(state.innerBlock)) {
                    return [state]
                }
                return [
                    {
                        mode: 'run',
                        expr: state.expr,
                        innerBlock: state.innerBlock,
                        innerBlockState: state.innerBlockState,
                    },
                    () => innerBlockRef.current?.focus(),
                ]
            })
        },

        cancelLoading() {
            update(state => [
                Model.init(state.expr),
                () => inputRef.current?. focus(),
            ])
        },

        chooseBlock(expr: string, env: Environment) {
            update((state: BlockSelectorState) => {
                return [
                    Model.chooseBlock(expr, state, env, blockLibrary),
                    () => innerBlockRef.current?.focus()
                ]
            })
        },

        subupdate(action: (state: unknown) => unknown) {
            update((state: BlockSelectorState) => {
                return [Model.updateBlock(state, action)]
            })
        },
    }
}

export interface BlockSelectorUIProps {
    state: BlockSelectorState
    update: (action: (state: BlockSelectorState) => BlockSelectorState) => void
    env: Environment
    blockLibrary: Environment
}

export const BlockSelectorUI = React.forwardRef(
    function BlockSelectorUI(
        props: BlockSelectorUIProps,
        ref: React.Ref<BlockRef>
    ) {
        const { state, update, env } = props
        const { blockLibrary } = props

        const updateWithEffect = useEffectfulUpdate(update)
        const inputRef = React.useRef<HTMLTextAreaElement>()
        const innerBlockRef = React.useRef<BlockRef>()

        const [blockExpr, setBlockExpr] = React.useState<string>(state.expr)

        const actions = ACTIONS(updateWithEffect, inputRef, innerBlockRef, blockLibrary)

        React.useImperativeHandle(
            ref,
            () => {
                switch (state.mode) {
                    case 'choose':
                        return {
                            focus() {
                                inputRef.current?.focus()
                            }
                        }
                    case 'run':
                        return {
                            focus() {
                                innerBlockRef.current?.focus()
                            }
                        }
                }
            },
            [state.mode]
        )

        function onKeyDown(event: React.KeyboardEvent) {
            switch (getFullKey(event)) {
                case "C-Enter":
                    if (state.mode === 'choose') {
                        actions.chooseBlock(blockExpr, env)
                        event.stopPropagation()
                        event.preventDefault()
                    }
                    return

                case "Shift-Escape":
                    if (state.mode === 'run') {
                        setBlockExpr(state.expr)
                        actions.setChooseMode()
                        event.stopPropagation()
                        event.preventDefault()
                    }
                    return

                case "Escape":
                    if (state.mode === 'choose') {
                        actions.cancelChoose()
                        event.stopPropagation()
                        event.preventDefault()
                    }
                    return
            }
        }

        function onKeyDownLoading(event: React.KeyboardEvent) {
            switch (getFullKey(event)) {
                case "Escape":
                    actions.cancelLoading()
                    event.stopPropagation()
                    event.preventDefault()
                    return
            }
        }

        switch (state.mode) {
            case 'loading':
                return (
                    <div onKeyDown={onKeyDownLoading}>
                        <FontAwesomeIcon icon={solidIcons.faSpinner} spinPulse />{' '}
                        Waiting for <CodeView className="inline-block bg-gray-100 rounded" container="span" code={state.expr} />{' '}
                        to turn into a Block.{' '}
                        <button className="text-blue-500" onClick={actions.cancelLoading}>Cancel</button>
                    </div>
                )

            case 'run':
                return (
                    <div className="flex flex-col space-y-1 flex-1" onKeyDown={onKeyDown}>
                        <div>
                            <button
                                className={`
                                    text-xs text-gray-400 rounded-full
                                    hover:text-gray-700 hover:bg-gray-200 hover:px-1
                                    transition-all duration-100
                                `}
                                onClick={() => actions.setChooseMode()}
                                >
                                {state.expr}
                            </button>
                        </div>
                        <ErrorBoundary title={"There was an error in: " + state.expr}>
                            {state.innerBlock.view({ ref: innerBlockRef, state: state.innerBlockState, update: actions.subupdate, env }) }
                        </ErrorBoundary>
                    </div>
                )

            case 'choose':
                const blockCmdResult = computeExpr(blockExpr, { ...blockLibrary, ...env })
                return (
                    <div className="flex flex-col space-y-1 flex-1" onKeyDown={onKeyDown}>
                        <EditableCode ref={inputRef} code={blockExpr} onUpdate={setBlockExpr} />
                        {block.isBlock(blockCmdResult) ?
                            <BlockPreview
                                env={env}
                                blockCmdResult={blockCmdResult}
                                onChooseBlock={() => actions.chooseBlock(blockExpr, env)}
                                />
                        :
                            <ValueInspector value={blockCmdResult} />
                        }
                    </div>
                )
        }
    }
)

interface BlockPreviewProps {
    env: Environment
    blockCmdResult: Block<unknown>
    onChooseBlock: () => void
}

function BlockPreview({ env, blockCmdResult, onChooseBlock }: BlockPreviewProps) {
    function BlockCmdResultView() {
        return blockCmdResult.view({
            state: blockCmdResult.init,
            update: () => {},
            env,
        })
    }

    return (
        <div
            className={`
                flex flex-col space-y-2 p-2 rounded shadow
                hover:shadow-lg hover:-translate-y-px transition
            `}
        >
            <h1
                className="font-thin cursor-pointer"
                onClick={onChooseBlock}
            >
                Block
            </h1>
            <ErrorBoundary title="Could not show block">
                <div className="saturate-50 cursor-default bg-gray-100 rounded">
                    <BlockCmdResultView />
                </div>
            </ErrorBoundary>
        </div>
    )
}