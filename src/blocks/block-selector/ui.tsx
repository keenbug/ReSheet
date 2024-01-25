import * as React from 'react'

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import * as solidIcons from '@fortawesome/free-solid-svg-icons'

import * as block from '../../block'
import { Block, BlockRef, Environment } from '../../block'
import { ErrorBoundary, ValueInspector } from '../../ui/value'
import { CodeView, EditableCode } from '../../code-editor'
import { computeExpr } from '../../logic/compute'
import { EffectfulUpdater, useEffectfulUpdate } from '../../ui/hooks'

import { BlockSelectorState } from './model'
import * as Model from './model'
import { useShortcuts } from '../../ui/shortcuts'


function ACTIONS(
    update: EffectfulUpdater<BlockSelectorState>,
    inputRef: React.MutableRefObject<HTMLElement>,
    innerBlockRef: React.MutableRefObject<BlockRef>,
    blockLibrary: Environment
) {
    return {
        updateExpr(expr: string) {
            update(state => ({
                state: { ...state, expr },
            }))
        },
    
        setChooseMode() {
            update(state => {
                if (state.mode === 'loading') { return {} }
    
                return {
                    state: {
                        mode: 'choose',
                        expr: state.expr,
                        innerBlock: state.innerBlock,
                        innerBlockState: state.innerBlockState,
                    },
                    effect() { inputRef.current?.focus() },
                }
            })
        },
    
        cancelChoose() {
            update(state => {
                if (state.mode === 'loading' || !block.isBlock(state.innerBlock)) {
                    return { state }
                }
    
                return {
                    state: {
                        mode: 'run',
                        expr: state.expr,
                        innerBlock: state.innerBlock,
                        innerBlockState: state.innerBlockState,
                    },
                    effect() { innerBlockRef.current?.focus() },
                }
            })
        },
    
        cancelLoading() {
            update(state => ({
                state: Model.init(state.expr),
                effect() { inputRef.current?.focus() },
            }))
        },
    
        chooseBlock(expr: string, env: Environment) {
            update((state: BlockSelectorState) => ({
                state: Model.chooseBlock(expr, state, env, blockLibrary),
                effect() { innerBlockRef.current?.focus() },
            }))
        },
    
        subupdate(action: (state: unknown) => unknown) {
            update((state: BlockSelectorState) => ({
                state: Model.updateBlock(state, action),
            }))
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
        const inputRef = React.useRef<HTMLElement>()
        const innerBlockRef = React.useRef<BlockRef>()

        const [blockExpr, setBlockExpr] = React.useState<string>(state.expr)

        const actions = React.useMemo(
            () => ACTIONS(updateWithEffect, inputRef, innerBlockRef, blockLibrary),
            [updateWithEffect, inputRef, innerBlockRef, blockLibrary],
        )

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

        const chooseBindingProps = useShortcuts(
            [
                {
                    description: "selector",
                    bindings: [
                        [["C-Enter"], 'none', 'select block', () => { actions.chooseBlock(blockExpr, env) }],
                        [["Escape"], 'none', 'cancel', () => { actions.cancelChoose() }],
                    ]
                }
            ],
            state.mode === 'choose',
        )
        const runBindingProps = useShortcuts(
            [
                {
                    description: "selector",
                    bindings: [
                        [["C-/"], 'none', 'switch block', () => { setBlockExpr(state.expr); actions.setChooseMode() }],
                    ]
                }
            ],
            state.mode === 'run',
        )
        const loadingBindingProps = useShortcuts(
            [
                {
                    description: "selector",
                    bindings: [
                        [["Escape"], 'none', 'cancel loading', () => { actions.cancelLoading() }],
                    ]
                }
            ],
            state.mode === 'loading',
        )

        switch (state.mode) {
            case 'loading':
                return (
                    <div {...loadingBindingProps}>
                        <FontAwesomeIcon icon={solidIcons.faSpinner} spinPulse />{' '}
                        Waiting for <CodeView className="inline-block bg-gray-100 rounded" container="span" code={state.expr} />{' '}
                        to turn into a Block.{' '}
                        <button className="text-blue-500" onClick={actions.cancelLoading}>Cancel</button>
                    </div>
                )

            case 'run':
                return (
                    <div className="flex flex-col space-y-1 flex-1" {...runBindingProps}>
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
                    <div className="flex flex-col space-y-1 flex-1" {...chooseBindingProps}>
                        <EditableCode ref={inputRef} code={blockExpr} onUpdate={setBlockExpr} />
                        {block.isBlock(blockCmdResult) ?
                            <BlockPreview
                                env={env}
                                block={blockCmdResult}
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

export interface BlockPreviewProps {
    env: Environment
    block: Block<unknown>
    onChooseBlock: () => void
}

export function BlockPreview({ env, block, onChooseBlock }: BlockPreviewProps) {
    function BlockCmdResultView() {
        return block.view({
            state: block.init,
            update() {},
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
                Preview
            </h1>
            <ErrorBoundary title="Could not show block">
                <div
                    className="cursor-default shadow-sky-100 p-1 rounded"
                    style={{ boxShadow: 'inset 0 0 4px 2px var(--tw-shadow-color)' }}
                >
                    <BlockCmdResultView />
                </div>
            </ErrorBoundary>
        </div>
    )
}