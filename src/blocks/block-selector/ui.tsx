import * as React from 'react'

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import * as solidIcons from '@fortawesome/free-solid-svg-icons'

import * as block from '@tables/core/block'
import { BlockHandle, Environment } from '@tables/core/block'

import { CodeView, CodeEditor, CodeEditorHandle } from '@tables/code/editor'
import { useCompletionsOverlay } from '@tables/code/completions'

import { EffectfulDispatcher, useEffectfulDispatch } from '@tables/util/hooks'
import { computeExpr } from '@tables/code/compute'

import { ErrorBoundary, ValueInspector } from '../../code/value'
import { useShortcuts } from '../../util/shortcuts'

import { SafeBlock, safeBlock } from '../component'

import * as Model from './model'
import { BlockSelectorState } from './versioned'


function ACTIONS(
    dispatch: EffectfulDispatcher<BlockSelectorState>,
    codeEditor: React.RefObject<CodeEditorHandle>,
    innerBlockRef: React.RefObject<BlockHandle>,
    blockLibrary: Environment
) {
    return {
        setExpr(expr: string) {
            dispatch(state => ({
                state: { ...state, expr },
            }))
        },
    
        setChooseMode() {
            dispatch(state => {
                if (state.mode === 'loading') { return { state } }
    
                return {
                    state: {
                        mode: 'choose',
                        expr: state.expr,
                        innerBlock: state.innerBlock,
                        innerBlockState: state.innerBlockState,
                    },
                    effect() { codeEditor.current?.element?.focus() },
                }
            })
        },
    
        cancelChoose() {
            dispatch(state => {
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
            dispatch(state => ({
                state: Model.init(state.expr),
                effect() { codeEditor.current?.element?.focus() },
            }))
        },
    
        chooseBlock(expr: string, blockEnv: Environment) {
            dispatch((state: BlockSelectorState) => ({
                state: Model.chooseBlock(expr, state, blockEnv),
                effect() { innerBlockRef.current?.focus() },
            }))
        },
    
        dispatchBlock: Model.blockDispatcher(dispatch),

    }
}

export interface BlockSelectorUIProps {
    state: BlockSelectorState
    dispatch: block.BlockDispatcher<BlockSelectorState>
    env: Environment
    blockLibrary: Environment
}

export const BlockSelectorUI = React.forwardRef(
    function BlockSelectorUI(
        props: BlockSelectorUIProps,
        ref: React.Ref<BlockHandle>
    ) {
        const { state, dispatch, env } = props
        const { blockLibrary } = props

        const dispatchWithEffect = useEffectfulDispatch(dispatch)
        const codeEditor = React.useRef<CodeEditorHandle>()
        const innerBlockRef = React.useRef<BlockHandle>()

        const [blockExpr, setBlockExpr] = React.useState<string>(state.expr)
        const blockEnv = { ...blockLibrary, ...env }
        const completions = useCompletionsOverlay(codeEditor, blockExpr, blockEnv)

        const actions = React.useMemo(
            () => ACTIONS(dispatchWithEffect, codeEditor, innerBlockRef, blockLibrary),
            [dispatchWithEffect, codeEditor, innerBlockRef, blockLibrary],
        )

        React.useImperativeHandle(
            ref,
            () => {
                switch (state.mode) {
                    case 'choose':
                        return {
                            focus(options) {
                                codeEditor.current?.element?.focus(options)
                            }
                        }
                    case 'run':
                        return {
                            focus(options) {
                                innerBlockRef.current?.focus(options)
                            }
                        }
                }
            },
            [state.mode]
        )

        const chooseBindingProps = useShortcuts(
            [
                ...completions.shortcuts,
                {
                    description: "selector",
                    bindings: [
                        [["C-Enter"], 'none', 'select block', () => { actions.chooseBlock(blockExpr, blockEnv) }],
                        [["Escape"],  'none', 'cancel',       () => { actions.cancelChoose() }],
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
                        <state.innerBlock.Component
                            ref={innerBlockRef}
                            state={state.innerBlockState}
                            dispatch={actions.dispatchBlock}
                            env={env}
                            />
                    </div>
                )

            case 'choose':
                const blockCmdResult = computeExpr(blockExpr, blockEnv)
                function onBlur(event: React.FocusEvent) {
                    completions.onBlur(event)
                    chooseBindingProps.onBlur(event)
                }
                return (
                    <div className="flex flex-col space-y-1 flex-1" {...chooseBindingProps} onBlur={onBlur}>
                        <CodeEditor ref={codeEditor} code={blockExpr} onUpdate={setBlockExpr} />
                        {block.isBlock(blockCmdResult) ?
                            <BlockPreview
                                env={env}
                                block={safeBlock(blockCmdResult)}
                                onChooseBlock={() => actions.chooseBlock(blockExpr, blockEnv)}
                                />
                        :
                            <ValueInspector value={blockCmdResult} />
                        }
                        {completions.ui}
                    </div>
                )
        }
    }
)

export interface BlockPreviewProps {
    env: Environment
    block: SafeBlock<unknown>
    onChooseBlock: () => void
}

export function BlockPreview({ env, block, onChooseBlock }: BlockPreviewProps) {
    function BlockCmdResultView() {
        return (
            <block.Component
                state={block.init}
                dispatch={() => {}}
                env={env}
                />
        )
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