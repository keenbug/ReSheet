import * as React from 'react'
import { Tab } from '@headlessui/react'

import * as block from '../logic/block'
import { BlockDesc } from '../logic/block'
import { ErrorBoundary, ValueInspector } from '../ui/value'
import { CodeEditor, EditableCode } from '../ui/code-editor'
import { classed } from '../ui/utils'
import { computeExpr } from '../logic/compute'
import { catchAll } from '../utils'


export interface CommandModel {
    expr: string
    mode: Mode
    innerBlockState: null | unknown
    innerBlock: null | BlockDesc<unknown>
}

export type Mode = 'run' | 'choose'

export function initCommandModel(
    expr: string = '',
    innerBlockInit: BlockDesc<unknown> = null
): CommandModel {
    return {
        expr,
        mode: expr ? 'run' : 'choose',
        innerBlockState: innerBlockInit?.init,
        innerBlock: innerBlockInit,
    }
}


/**************** Command Actions **************/


export function setCommandExpr(state: CommandModel, expr: string): CommandModel {
    return { ...state, expr }
}

export function updateMode(state: CommandModel, mode: Mode): CommandModel {
    return { ...state, mode }
}

export function setInnerBlockState(state: CommandModel, innerBlockState: unknown): CommandModel {
    return { ...state, innerBlockState }
}

export function chooseBlock(
    state: CommandModel,
    env: block.Environment,
    blockLibrary: block.Environment
): CommandModel {
    const blockCmdResult = computeExpr(state.expr, { ...blockLibrary, ...env })
    if (block.isBlock(blockCmdResult)) {
        return {
            ...state,
            mode: 'run',
            innerBlock: blockCmdResult,
            innerBlockState:
                state.innerBlockState === null || state.innerBlockState === undefined ?
                    blockCmdResult.init
                :
                    state.innerBlockState
            ,
        }
    }
    return state
}

export function updateBlock(state: CommandModel, action: (state: unknown) => unknown): CommandModel {
    return {
        ...state,
        innerBlockState: action(state.innerBlockState),
    }
}

const loadBlock = ({ mode, inner, expr }, library, blockLibrary) => {
    const innerBlock = catchAll(
        () => computeExpr(expr, { ...blockLibrary, ...library }),
        () => null,
    )
    const innerBlockState = catchAll(
        () => innerBlock.fromJSON(inner, library),
        () => null,
    )
    return { innerBlock, innerBlockState }
}

export function CommandBlock(
    expr: string = '',
    innerBlockInit: BlockDesc<unknown> = null,
    stateEditorBlock: BlockDesc<unknown>,
    blockLibrary: block.Environment,
) {
    return block.create<CommandModel>({
        init: initCommandModel(expr, innerBlockInit),

        view({ state, update, env }) {
            return (
                <CommandBlockUI
                    state={state}
                    update={update}
                    env={env}
                    stateEditorBlock={stateEditorBlock}
                    blockLibrary={blockLibrary}
                    />
            )
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
                    mode === 'choose' ?
                        catchAll(
                            () => innerBlock.toJSON(innerBlockState),
                            () => null,
                        )
                    : mode === 'run' && innerBlock !== null && innerBlockState !== null ?
                        innerBlock.toJSON(innerBlockState)
                    :
                        null
                ,
            }
        },
    })
}


/**************** UI *****************/



const CommandContent = classed<any>('div')`flex flex-col space-y-1 flex-1`

const CommandPreviewSection = classed<any>('div')`
    flex flex-col space-y-2
    p-2 rounded
    shadow
`

const ChangeBlockButton = classed<any>('button')`
    text-xs text-gray-400 rounded-full
    hover:text-gray-700 hover:bg-gray-200 hover:px-1
    transition-all duration-100
`


export interface CommandBlockUIProps {
    state: CommandModel
    update: (action: (state: CommandModel) => CommandModel) => void
    env: block.Environment
    stateEditorBlock: BlockDesc<unknown>
    blockLibrary: block.Environment
}

export function CommandBlockUI(props: CommandBlockUIProps) {
    const { state, update, env } = props
    const { stateEditorBlock, blockLibrary } = props
    const onUpdateExpr  = expr   => update(state => setCommandExpr(state, expr))
    const onSetMode     = mode   => update(state => updateMode(state, mode))
    const onChooseBlock = env    => update(state => chooseBlock(state, env, blockLibrary))
    const onResetState  = ()     => update(state => setInnerBlockState(state, blockCmdResult.init))
    const subupdate     = action => update(state => updateBlock(state, action))

    const onLoadInnerState = innerStateJSON => update(state => {
        try {
            return setInnerBlockState(state, blockCmdResult.fromJSON(innerStateJSON, env))
        }
        catch (e) {
            return state
        }
    })

    const onCommitInnerState = innerState => update(state => {
        try {
            return setInnerBlockState(state, innerState)
        }
        catch (e) {
            return state
        }
    })


    const onChooseKeyPress = env => event => {
        if (event.key === 'Enter' && event.metaKey) {
            event.preventDefault()
            event.stopPropagation()
            onChooseBlock(env)
        }
    }
    
    const blockCmdResult = computeExpr(state.expr, { ...blockLibrary, ...env })

    function BlockCmdResultView() {
        return blockCmdResult.view({
            state: state.innerBlockState ?? blockCmdResult.init,
            update: () => {},
            env,
        })
    }

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
                            <CommandPreviewSection
                                className="hover:shadow-lg hover:-translate-y-px transition"
                            >
                                <h1
                                    className="font-thin cursor-pointer"
                                    onClick={() => onChooseBlock(env)}
                                >
                                    Block
                                </h1>
                                <ErrorBoundary title="Could not show block">
                                    <BlockCmdResultView />
                                </ErrorBoundary>
                            </CommandPreviewSection>

                            <CommandPreviewSection>
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
                            </CommandPreviewSection>
                        </React.Fragment>
                    :
                        <ValueInspector value={blockCmdResult} />
                    }
                </CommandContent>
            )
    }
}

const StateEditorTab = props => (
    <Tab
        className={({ selected }) => `
            hover:text-blue-700
            ${selected ? 'font-medium' : 'font-thin text-gray-800'}
        `}
        {...props}
        />
)

const JSONEditor = ({ initialValue, onSave }) => {
    const [json, setJson] = React.useState<string>(() => JSON.stringify(initialValue, null, 4))

    return (
        <div>
            <CodeEditor code={json} onUpdate={setJson} />
            <button onClick={() => onSave(JSON.parse(json))}>Load</button>
        </div>
    )
}

interface ExprEditorProps {
    editorBlock: BlockDesc<unknown>
    currentBlock: BlockDesc<unknown>
    oldBlock: BlockDesc<unknown>
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
