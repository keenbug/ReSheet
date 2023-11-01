import { BlockDesc, Environment } from '../../logic/block'
import { catchAll } from '../../utils'

export type ViewState =
    | { mode: 'current' }
    | { mode: 'history', position: number }


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
        viewState: { mode: 'current' },
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
                mode: 'history',
                position: state.history.length - 1,
            },
        }
    }
    return state
}

export function closeHistory<State>(state: DocumentState<State>): DocumentState<State> {
    return {
        ...state,
        viewState: { mode: 'current' },
    }
}

export function goBackInHistory<State>(state: DocumentState<State>): DocumentState<State> {
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

export function goForwardInHistory<State>(state: DocumentState<State>): DocumentState<State> {
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

export function viewStateFromHistory<State>(
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

export function toJSON<State>(state: DocumentState<State>, innerBlock: BlockDesc<State>) {
    const block = innerBlock.toJSON(state.blockState)
    const history = historyToJSON(state.history, innerBlock)
    return { block, history, name: state.name }
}