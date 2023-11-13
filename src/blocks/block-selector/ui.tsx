import * as React from 'react'
import { Tab } from '@headlessui/react'

import * as block from '../../block'
import { Block, BlockRef, Environment } from '../../block'
import { ErrorBoundary, ValueInspector } from '../../ui/value'
import { CodeEditor, EditableCode } from '../../ui/code-editor'
import { computeExpr } from '../../logic/compute'
import { EffectfulUpdater, useEffectQueue, useEffectfulUpdate } from '../../ui/hooks'
import { getFullKey } from '../../ui/utils'
import { catchAll } from '../../utils'

import { BlockSelectorState } from './model'
import * as Model from './model'


function ACTIONS(
    update: EffectfulUpdater<BlockSelectorState>,
    inputRef: React.MutableRefObject<HTMLTextAreaElement>,
    innerBlockRef: React.MutableRefObject<BlockRef>,
    blockCmdResult: any,
    blockLibrary: Environment
) {
    return {
        updateExpr(expr: string) {
            update(state => {
                return [Model.setExpr(state, expr)]
            })
        },

        setChooseMode() {
            update(state => {
                return [
                    Model.updateMode(state, 'choose'),
                    () => inputRef.current?.focus()
                ]
            })
        },

        chooseBlock(env: Environment) {
            update((state: BlockSelectorState) => {
                return [
                    Model.chooseBlock(state, env, blockLibrary),
                    () => innerBlockRef.current?.focus()
                ]
            })
        },

        resetState() {
            update((state: BlockSelectorState) => {
                return [Model.setInnerBlockState(state, blockCmdResult.init)]
            })
        },

        subupdate(action: (state: unknown) => unknown) {
            update((state: BlockSelectorState) => {
                return [Model.updateBlock(state, action)]
            })
        },

        loadInnerState(innerStateJSON: any, env: Environment) {
            update(state => {
                try {
                    return [Model.setInnerBlockState(state, blockCmdResult.fromJSON(innerStateJSON, env))]
                }
                catch (e) {
                    return [state]
                }
            })
        },

        commitInnerState(innerState: unknown, env: Environment) {
            update(state => {
                try {
                    return [Model.setInnerBlockState(state, innerState)]
                }
                catch (e) {
                    return [state]
                }
            })
        },


    }
}

export interface BlockSelectorUIProps {
    state: BlockSelectorState
    update: (action: (state: BlockSelectorState) => BlockSelectorState) => void
    env: Environment
    stateEditorBlock: Block<unknown>
    blockLibrary: Environment
}

export const BlockSelectorUI = React.forwardRef(
    function BlockSelectorUI(
        props: BlockSelectorUIProps,
        ref: React.Ref<BlockRef>
    ) {
        const { state, update, env } = props
        const { stateEditorBlock, blockLibrary } = props

        const updateWithEffect = useEffectfulUpdate(update)
        const inputRef = React.useRef<HTMLTextAreaElement>()
        const innerBlockRef = React.useRef<BlockRef>()

        const blockCmdResult = computeExpr(state.expr, { ...blockLibrary, ...env })
        const actions = ACTIONS(updateWithEffect, inputRef, innerBlockRef, blockCmdResult, blockLibrary)

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
                        actions.chooseBlock(env)
                        event.stopPropagation()
                        event.preventDefault()
                    }
                    return

                case "Shift-Escape":
                    if (state.mode === 'run') {
                        actions.setChooseMode()
                        event.stopPropagation()
                        event.preventDefault()
                    }
                    return

                case "C-r":
                    actions.resetState()
                    event.stopPropagation()
                    event.preventDefault()
                    return
            }
        }     

        switch (state.mode) {
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
            default:
                return (
                    <div className="flex flex-col space-y-1 flex-1" onKeyDown={onKeyDown}>
                        <EditableCode ref={inputRef} code={state.expr} onUpdate={actions.updateExpr} />
                        {block.isBlock(blockCmdResult) ?
                            <BlockPreview
                                env={env}
                                state={state}
                                blockCmdResult={blockCmdResult}
                                stateEditorBlock={stateEditorBlock}
                                onLoadInnerState={innerState => actions.loadInnerState(innerState, env)}
                                onChooseBlock={actions.chooseBlock}
                                onCommitInnerState={innerState => actions.commitInnerState(innerState, env)}
                                onResetState={actions.resetState}
                                />
                        :
                            <ValueInspector value={blockCmdResult} />
                        }
                    </div>
                )
        }
    }
)

function JSONEditor({ initialValue, onSave }) {
    const [json, setJson] = React.useState<string>(() => JSON.stringify(initialValue, null, 4))

    return (
        <div>
            <CodeEditor code={json} onUpdate={setJson} />
            <button onClick={() => onSave(JSON.parse(json))}>Load</button>
        </div>
    )
}

interface BlockPreviewProps {
    env: Environment
    state: BlockSelectorState
    blockCmdResult: Block<unknown>
    stateEditorBlock: Block<unknown>
    onChooseBlock: (env: Environment) => void
    onLoadInnerState: (innerStateJSON: any) => void
    onCommitInnerState: (innerState: any) => void
    onResetState: () => void
}

function BlockPreview({ env, state, blockCmdResult, stateEditorBlock, onChooseBlock, onLoadInnerState, onCommitInnerState, onResetState }: BlockPreviewProps) {
    function BlockCmdResultView() {
        return blockCmdResult.view({
            state: state.innerBlockState ?? blockCmdResult.init,
            update: () => {},
            env,
        })
    }

    function StateEditorTab(props) {
        return (
            <Tab
                className={({ selected }) => `
                    hover:text-blue-700
                    ${selected ? 'font-medium' : 'font-thin text-gray-800'}
                `}
                {...props}
                />
        )
    } 

    return (
        <React.Fragment>
            <div
                className={`
                    flex flex-col space-y-2 p-2 rounded shadow
                    hover:shadow-lg hover:-translate-y-px transition
                `}
            >
                <h1
                    className="font-thin cursor-pointer"
                    onClick={() => onChooseBlock(env)}
                >
                    Block
                </h1>
                <ErrorBoundary title="Could not show block">
                    <div className="saturate-50 cursor-default bg-gray-100 rounded">
                        <BlockCmdResultView />
                    </div>
                </ErrorBoundary>
            </div>

            <div className="flex flex-col space-y-2 p-2 rounded shadow">
                <h1 className="font-thin">State</h1>
                <Tab.Group>
                    <Tab.List className="flex space-x-2">
                        <StateEditorTab>Inspector</StateEditorTab>
                        <span className="font-thin">|</span>
                        <StateEditorTab>JSON Editor</StateEditorTab>
                        <span className="font-thin">|</span>
                        <StateEditorTab>Expr Editor</StateEditorTab>
                    </Tab.List>
                    <Tab.Panels>
                        <Tab.Panel>
                            <ValueInspector value={state.innerBlockState ?? blockCmdResult.init} />
                        </Tab.Panel>
                        <Tab.Panel>
                            <JSONEditor
                                initialValue={catchAll(
                                    () => blockCmdResult.toJSON(state.innerBlockState),
                                    () => catchAll(
                                        () => blockCmdResult.toJSON(blockCmdResult.init),
                                        () => null,
                                    ),
                                )}
                                onSave={onLoadInnerState}
                                />
                        </Tab.Panel>
                        <Tab.Panel>
                            <ExprEditor
                                editorBlock={stateEditorBlock}
                                env={env}
                                currentBlock={blockCmdResult}
                                oldBlock={state.innerBlock}
                                state={state.innerBlockState}
                                onCommit={onCommitInnerState}
                                />
                        </Tab.Panel>
                    </Tab.Panels>
                </Tab.Group>
                <button onClick={onResetState}>Reset</button>
            </div>
        </React.Fragment>
    )
}

interface ExprEditorProps {
    editorBlock: Block<unknown>
    currentBlock: Block<unknown>
    oldBlock: Block<unknown>
    state: unknown
    env: block.Environment
    onCommit: (newState: any) => void
}

function ExprEditor({ editorBlock, currentBlock, oldBlock, state, env, onCommit }: ExprEditorProps) {
    const [editorBlockState, setEditorBlockState] = React.useState(editorBlock.init)

    const extendedEnv = { ...env, currentBlock, oldBlock, state }

    return (
        <div>
            {editorBlock.view({
                state: editorBlockState,
                update: setEditorBlockState,
                env: extendedEnv,
            })}
            <button onClick={() => onCommit(editorBlock.getResult(editorBlockState, extendedEnv))}>
                Commit
            </button>
        </div>
    )
}
