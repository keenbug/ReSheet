import * as React from 'react'

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import * as solidIcons from '@fortawesome/free-solid-svg-icons'
import * as block from '../logic/block'
import { BlockDesc, Environment } from '../logic/block'
import { catchAll } from '../utils'
import { LoadFileButton, saveFile } from '../ui/utils'
import { useAutoretrigger } from '../ui/hooks'


export type ViewState =
    | { mode: 'current' }
    | { mode: 'history', position: number }


export type HistoryEntry<State> =
    | {
        readonly type: 'state'
        readonly time: Date
        readonly blockState: State
    }
    | {
        readonly type: 'json'
        readonly time: Date
        readonly blockJSON: any
    }

export interface DocumentState<State> {
    readonly blockState: State
    readonly history: Array<HistoryEntry<State>>
    readonly viewState: ViewState
    readonly name: string
}

function openHistory<State>(state: DocumentState<State>): DocumentState<State> {
    if (state.history.length > 0) {
        return {
            ...state,
            viewState: {
                mode: 'history',
                position: state.history.length - 1,
            },
        }
    }
    return state
}

function closeHistory<State>(state: DocumentState<State>): DocumentState<State> {
    return {
        ...state,
        viewState: { mode: 'current' },
    }
}

function goBackInHistory<State>(state: DocumentState<State>): DocumentState<State> {
    if (state.viewState.mode === 'history') {
        return {
            ...state,
            viewState: {
                ...state.viewState,
                position: Math.max(0, state.viewState.position - 1),
            }
        }
    }
    return state
}

function goForwardInHistory<State>(state: DocumentState<State>): DocumentState<State> {
    if (state.viewState.mode === 'history') {
        return {
            ...state,
            viewState: {
                ...state.viewState,
                position: Math.min(state.viewState.position + 1, state.history.length - 1),
            }
        }
    }
    return state
}

function viewStateFromHistory<State>(
    state: DocumentState<State>,
    innerBlock: BlockDesc<State>,
    env: Environment,
): DocumentState<State> {
    if (state.viewState.mode === 'history') {
        const historicState = state.history[state.viewState.position]
        return {
            ...state,
            history: [ ...state.history, historicState ],
            blockState: getHistoryState(historicState, innerBlock, env),
            viewState: { mode: 'current' },
        }
    }
    return state
}


function initDocumentState<State>(initBlockState: State): DocumentState<State> {
    return {
        blockState: initBlockState,
        history: [{ type: 'state', time: new Date(), blockState: initBlockState }],
        viewState: { mode: 'current' },
        name: '',
    }
}


function getHistoryState<State>(entry: HistoryEntry<State>, innerBlock: BlockDesc<State>, env: Environment) {
    switch (entry.type) {
        case 'state':
            return entry.blockState
        case 'json':
            return innerBlock.fromJSON(entry.blockJSON, env)
    }
}

function historyToJSON<State>(history: Array<HistoryEntry<State>>, innerBlock: BlockDesc<State>) {
    return history.map(entry => {
        switch (entry.type) {
            case 'json':
                return {
                    time: entry.time.getTime(),
                    state: entry.blockJSON,
                }
            case 'state':
                return {
                    time: entry.time.getTime(),
                    state: innerBlock.toJSON(entry.blockState),
                }
        }
    })
}

function historyFromJSON<State>(
    json: { time: number, state: any }[],
): HistoryEntry<State>[] {
    return json.map(historyEntryJson => (
        {
            type: 'json',
            time: new Date(historyEntryJson.time),
            blockJSON: historyEntryJson.state,
        }
    ))
}

function reduceHistory<State>(history: Array<HistoryEntry<State>>): Array<HistoryEntry<State>> {
    return history.filter((entry, index) => {
        const nextTime = history[index + 1]?.time?.getTime() ?? Number.POSITIVE_INFINITY
        const differenceMS = nextTime - entry.time.getTime()
        const reverseIndex = history.length - index
        return differenceMS / 100 > reverseIndex ** 2
    })
}


/****************** Block ******************/

export function DocumentBlock<State>(innerBlock: BlockDesc<State>) {
    return block.create({
        init: initDocumentState(innerBlock.init),
        view({ state, update, env }: block.BlockViewerProps<DocumentState<State>>) {
            return <HistoryView state={state} update={update} env={env} innerBlock={innerBlock} />
        },
        getResult(state: DocumentState<State>, env: Environment) {
            return innerBlock.getResult(state.blockState, env)
        },
        fromJSON(json: any, env: Environment): DocumentState<State> {
            return fromJSON(json, env, innerBlock)
        },
        toJSON(state: DocumentState<State>): {} {
            return toJSON(state, innerBlock)
        }
    })
}

function fromJSON<State>(json: any, env: Environment, innerBlock: BlockDesc<State>): DocumentState<State> {
    const { block, history, name = '' } = json
    const blockState = catchAll(
        () => innerBlock.fromJSON(block, env),
        (e) => innerBlock.init,
    )
    const savedHistory = catchAll<HistoryEntry<State>[]>(
        () => historyFromJSON(history),
        (e) => [{ type: 'state', time: new Date(), blockState }],
    )
    return {
        blockState,
        history: savedHistory,
        viewState: { mode: 'current' },
        name,
    }
}

function toJSON<State>(state: DocumentState<State>, innerBlock: BlockDesc<State>) {
    const block = innerBlock.toJSON(state.blockState)
    const history = historyToJSON(state.history, innerBlock)
    return { block, history, name: state.name }
}

interface HistoryViewProps<State> {
    state: DocumentState<State>
    update: (action: (state: DocumentState<State>) => DocumentState<State>) => void
    env: Environment
    innerBlock: BlockDesc<State>
}

function HistoryView<State>({ state, update, env, innerBlock }: HistoryViewProps<State>) {
    function updateInner(action: (state: State) => State) {
        update((state: DocumentState<State>): DocumentState<State> => {
            const blockState = action(state.blockState)
            return {
                ...state,
                blockState,
                history: reduceHistory([
                    ...state.history,
                    { type: 'state', time: new Date(), blockState },
                ]),
            }
        })
    }

    function onSave() {
        const content = JSON.stringify(toJSON(state, innerBlock))
        saveFile(
            state.name + '.json',
            'application/json',
            content,
        )
    }

    async function onLoadFile(file: File) {
        const content = JSON.parse(await file.text())
        try {
            const newState = fromJSON(content, env, innerBlock)
            update(() => newState)
        }
        catch (e) {
            window.alert(`Could not load file: ${e}`)
        }
    }

    const localEnv = { ...env, history: state.history }

    function viewToplevelBlock() {
        switch (state.viewState.mode) {
            case 'current':
                return innerBlock.view({
                    state: state.blockState,
                    update: updateInner,
                    env: localEnv,
                })
            
            case 'history':
                const entryInHistory = state.history[state.viewState.position]
                if (entryInHistory === undefined) { return null }

                const stateInHistory = getHistoryState(entryInHistory, innerBlock, localEnv)
                return innerBlock.view({
                    state: stateInHistory,
                    update: () => {},
                    env: localEnv,
                })
        }
    }

    const onOpenHistory  = () => update(openHistory)
    const onCloseHistory = () => update(closeHistory)
    const onGoBack       = () => update(goBackInHistory)
    const onGoForward    = () => update(goForwardInHistory)
    const onUseState     = () => update(state => viewStateFromHistory(state, innerBlock, localEnv))
    const onChangeName   = name => update(state => ({ ...state, name }))

    return (
        <React.Fragment>
            <MenuBar
                state={state}
                onOpenHistory={onOpenHistory}
                onCloseHistory={onCloseHistory}
                onGoBack={onGoBack}
                onGoForward={onGoForward}
                onUseState={onUseState}
                onChangeName={onChangeName}
                onSave={onSave}
                onLoadFile={onLoadFile}
                />
            {viewToplevelBlock()}
        </React.Fragment>
    )
}



function MenuBar({ state, onOpenHistory, onCloseHistory, onGoBack, onGoForward, onUseState, onChangeName, onSave, onLoadFile }) {
    const [startGoBack, stopGoBack] = useAutoretrigger(onGoBack)
    const [startGoForward, stopGoForward] = useAutoretrigger(onGoForward)

    switch (state.viewState.mode) {
        case 'current':
            return (
                <div
                    className={`
                        sticky top-0 left-0 z-10
                        bg-white backdrop-opacity-90 backdrop-blur
                        shadow p-1 mb-2 flex space-x-2 items-baseline
                    `}
                    >
                    <button
                        className={`
                            px-2 py-0.5 rounded
                            hover:text-blue-900 hover:bg-blue-200
                        `}
                        onClick={onOpenHistory}
                        >
                        <FontAwesomeIcon className="mr-1" size="xs" icon={solidIcons.faClockRotateLeft} />
                        History
                    </button>
                    <div className="flex flex-1 space-x-2 justify-center items-baseline">
                        <input
                            className="w-14"
                            type="text"
                            value={state.name}
                            onChange={e => { onChangeName(e.target.value) }}
                            />
                        <button className="text-sm" onClick={onSave}>
                            save
                        </button>
                        <LoadFileButton className="text-sm" onLoad={onLoadFile}>
                            load
                        </LoadFileButton>
                    </div>
                </div>
            )
        case 'history':
        default:
            return (
                <div
                    className={`
                        sticky top-0 left-0 z-10
                        bg-white backdrop-opacity-90 backdrop-blur
                        shadow p-1 mb-2 flex space-x-2 items-baseline
                    `}
                    >
                    <button
                        className={`
                            px-2 py-0.5 rounded
                            text-blue-50 bg-blue-700 hover:bg-blue-500
                        `}
                        onClick={onOpenHistory}
                        >
                        <FontAwesomeIcon className="mr-1" size="xs" icon={solidIcons.faClockRotateLeft} />
                        History
                    </button>
                    <div className="self-center flex space-x-1 px-2">
                        <button onMouseDown={startGoBack} onMouseUp={stopGoBack} onMouseLeave={stopGoBack}>
                            <FontAwesomeIcon icon={solidIcons.faAngleLeft} />
                        </button>
                        <button onMouseDown={startGoForward} onMouseUp={stopGoForward} onMouseLeave={stopGoBack}>
                            <FontAwesomeIcon icon={solidIcons.faAngleRight} />
                        </button>
                        <div className="self-center px-1">
                            {formatTime(state.history[state.viewState.position].time)}
                        </div>
                    </div>
                    <button style={{ marginLeft: 'auto' }} onClick={onUseState}>
                        Use this state
                    </button>
                </div>
            )
    }
}


const secondInMs = 1000
const minuteInMs = 60 * secondInMs
const hourInMs = 60 * minuteInMs
const dayInMs = 24 * hourInMs

const formatTime = (date: Date) => {
    const diffInMs = Date.now() - date.getTime()
    if (diffInMs < dayInMs) {
        return Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(date)
    }
    else {
        const formatOptions: Intl.DateTimeFormatOptions = {
            year: '2-digit',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        }
        return Intl.DateTimeFormat(undefined, formatOptions).format(date)
    }
}
