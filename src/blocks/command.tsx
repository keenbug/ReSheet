import * as React from 'react'
import produce, { original } from 'immer'
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

export const initCommandModel: CommandModel = {
    expr: "",
    mode: 'choose',
    innerBlockState: null,
    innerBlock: null,
}


/**************** Command Actions **************/


export const setCommandExpr = produce<CommandModel, [string]>((draft: CommandModel, expr: string) => {
    draft.expr = expr
})

export const updateMode = produce<CommandModel, [Mode]>((draft: CommandModel, mode: Mode) => {
    draft.mode = mode
})

export const setInnerBlockState = produce<CommandModel, [unknown]>((draft, innerBlockState) => {
    draft.innerBlockState = innerBlockState
})

export const chooseBlock = produce<CommandModel, [block.Environment, block.Environment]>((draft: CommandModel, env: block.Environment, blockLibrary: block.Environment) => {
    const blockCmdResult = computeExpr(draft.expr, { ...blockLibrary, ...env })
    if (block.isBlock(blockCmdResult)) {
        draft.mode = 'run'
        draft.innerBlock = blockCmdResult
        if (draft.innerBlockState === null || draft.innerBlockState === undefined) {
            draft.innerBlockState = blockCmdResult.init
        }
    }
})

export const updateBlock = produce<CommandModel, [(state: unknown) => unknown]>((draft: CommandModel, action) => {
    draft.innerBlockState = action(original(draft).innerBlockState)
})

const loadBlock = ({ mode, inner, expr }, library, blockLibrary) => {
    if (mode === 'choose') { return null }

    const innerBlock = computeExpr(expr, { ...blockLibrary, ...library })
    const innerBlockState = innerBlock.fromJSON(inner, library)
    return { innerBlock, innerBlockState }
}

export const CommandBlock = blockLibrary => block.create<CommandModel>({
    init: initCommandModel,

    view({ state, update, env }) {
        return <CommandBlockUI state={state} update={update} env={env} blockLibrary={blockLibrary} />
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


/**************** UI *****************/



const CommandContent = classed<any>('div')`flex flex-col space-y-1 flex-1`

const CommandPreviewSection = classed<any>('div')`
    flex flex-col space-y-2
    m-1 p-2 rounded
    shadow
`

const ChangeBlockButton = classed<any>('button')`
    text-xs text-gray-400 rounded-full
    hover:text-gray-700 hover:bg-gray-200 hover:px-1
    transition-all duration-100
`


export const CommandBlockUI = ({ state, update, env, blockLibrary }) => {
    const onUpdateExpr  = expr   => update(state => setCommandExpr(state, expr))
    const onSetMode     = mode   => update(state => updateMode(state, mode))
    const onChooseBlock = env    => update(state => chooseBlock(state, env, blockLibrary))
    const onResetState  = ()     => update(state => setInnerBlockState(state, blockCmdResult.init))
    const subupdate     = action => update(state => updateBlock(state, action))

    const onSetInnerState = innerState => update(state => setInnerBlockState(state, innerState))

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
                                                onSave={onSetInnerState}
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
            <button onClick={() => onSave(JSON.parse(json))}>Save</button>
        </div>
    )
}

