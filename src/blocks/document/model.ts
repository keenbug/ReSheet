import { BlockDesc, Environment } from '../../block'
import { catchAll } from '../../utils'

export interface ViewState {
    mode: ViewMode
    sidebarOpen: boolean
}

export type ViewMode =
    | { type: 'current' }
    | { type: 'history', position: number }


export interface DocumentState<State> {
    readonly blockState: State
    readonly history: Array<HistoryEntry<State>>
    readonly viewState: ViewState
    readonly name: string
}

export function init<State>(initBlockState: State): DocumentState<State> {
    return {
        blockState: initBlockState,
        history: [{ type: 'state', time: new Date(), blockState: initBlockState }],
        viewState: {
            mode: { type: 'current' },
            sidebarOpen: true,
        },
        name: '',
    }
}



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


export function openHistory<State>(state: DocumentState<State>): DocumentState<State> {
    if (state.history.length > 0) {
        return {
            ...state,
            viewState: {
                ...state.viewState,
                mode: {
                    type: 'history',
                    position: state.history.length - 1,
                },
            },
        }
    }
    return state
}

export function closeHistory<State>(state: DocumentState<State>): DocumentState<State> {
    return {
        ...state,
        viewState: {
            ...state.viewState,
            mode: { type: 'current' },
        },
    }
}

export function goBackInHistory<State>(state: DocumentState<State>): DocumentState<State> {
    if (state.viewState.mode.type === 'history') {
        return {
            ...state,
            viewState: {
                ...state.viewState,
                mode: {
                    ...state.viewState.mode,
                    position: Math.max(0, state.viewState.mode.position - 1),
                }
            }
        }
    }
    return state
}

export function goForwardInHistory<State>(state: DocumentState<State>): DocumentState<State> {
    if (state.viewState.mode.type === 'history') {
        return {
            ...state,
            viewState: {
                ...state.viewState,
                mode: {
                    ...state.viewState.mode,
                    position: Math.min(state.viewState.mode.position + 1, state.history.length - 1),
                }
            }
        }
    }
    return state
}

export function viewStateFromHistory<State>(
    state: DocumentState<State>,
    innerBlock: BlockDesc<State>,
    env: Environment,
): DocumentState<State> {
    if (state.viewState.mode.type === 'history') {
        const historicState = state.history[state.viewState.mode.position]
        const historicEnv = {
            ...env,
            history: state.history.slice(0, state.viewState.mode.position)
        }
        return {
            ...state,
            history: [ ...state.history, historicState ],
            blockState: getHistoryState(historicState, innerBlock, historicEnv),
            viewState: {
                ...state.viewState,
                mode: { type: 'current' },
            },
        }
    }
    return state
}



export function getHistoryState<State>(entry: HistoryEntry<State>, innerBlock: BlockDesc<State>, env: Environment) {
    switch (entry.type) {
        case 'state':
            return entry.blockState
        case 'json':
            return innerBlock.fromJSON(entry.blockJSON, env)
    }
}

export function historyToJSON<State>(history: Array<HistoryEntry<State>>, innerBlock: BlockDesc<State>) {
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

export function historyFromJSON<State>(
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

export function reduceHistory<State>(history: Array<HistoryEntry<State>>): Array<HistoryEntry<State>> {
    return history.filter((entry, index) => {
        const nextTime = history[index + 1]?.time?.getTime() ?? Number.POSITIVE_INFINITY
        const differenceMS = nextTime - entry.time.getTime()
        const reverseIndex = history.length - index
        return differenceMS / 100 > reverseIndex ** 2
    })
}


export function fromJSON<State>(json: any, env: Environment, innerBlock: BlockDesc<State>): DocumentState<State> {
    const {
        block,
        history,
        name = '',
        viewState = { sidebarOpen: true }
    } = json
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
        viewState: {
            ...viewState,
            mode: { type: 'current' },
        },
        name,
    }
}

export function toJSON<State>(state: DocumentState<State>, innerBlock: BlockDesc<State>) {
    const block = innerBlock.toJSON(state.blockState)
    const history = historyToJSON(state.history, innerBlock)
    return { block, history, name: state.name }
}