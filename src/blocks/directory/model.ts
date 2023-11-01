import * as block from '../../logic/block'
import { BlockDesc } from '../../logic/block'

export interface DirectoryState<InnerBlockState> {
    readonly openedEntryId: null | number
    readonly entries: DirectoryEntry<InnerBlockState>[]
}

export interface DirectoryEntry<InnerBlockState> {
    readonly id: number
    readonly name: string
    readonly state: InnerBlockState
    readonly result: unknown
}


export const entryDefaultName = (entry: DirectoryEntry<unknown>) => '$' + entry.id
export const entryName = (entry: DirectoryEntry<unknown>) => entry.name.length > 0 ? entry.name : entryDefaultName(entry)

export const nextFreeId = (entries: DirectoryEntry<unknown>[]) =>
    1 + entries
        .map(entry => entry.id)
        .reduce((a, b) => Math.max(a, b), -1)


export function annotateDirectoryMap<InnerState>(
    entries: DirectoryEntry<InnerState>[],
    env: block.Environment,
) {
    return block.mapWithEnv(
        entries,
        (entry, dir) => {
            return {
                out: { ...entry, dir },
                env: { [entryName(entry)]: entry.result },
            }
        },
        { '..': env.dir },
    )
}


export function recomputeEntryResults<InnerState>(
    state: DirectoryState<InnerState>,
    innerBlock: BlockDesc<InnerState>,
    env: block.Environment,
) {
    const recomputedEntries = block.mapWithEnv(
        state.entries,
        (entry, dir) => {
            const localEnv = { ...env, dir }
            const result = innerBlock.getResult(entry.state, localEnv)
            return {
                out: { ...entry, result },
                env: { [entryName(entry)]: result },
            }
        },
        { '..': env.dir },
    )
    return { ...state, entries: recomputedEntries }
}




/**************** Code Actions **************/


export function updateEntryBlock<State>(
    state: DirectoryState<State>,
    id: number,
    action: (state: State) => State,
): DirectoryState<State> {
    return {
        ...state,
        entries: state.entries.map(entry =>
            entry.id === id ?
                { ...entry, state: action(entry.state) }
            :
                entry
        ),
    }
}


export function setName<State>(
    state: DirectoryState<State>,
    id: number,
    name: string,
): DirectoryState<State> {
    return {
        ...state,
        entries: state.entries.map(entry =>
            entry.id === id ?
                { ...entry, name }
            :
                entry
        ),
    }
}

export function addNewEntry<State>(
    state: DirectoryState<State>,
    innerBlock: BlockDesc<State>,
): DirectoryState<State> {
    const id = nextFreeId(state.entries)
    return {
        ...state,
        openedEntryId: id,
        entries: [
            ...state.entries,
            {
                id,
                name: '',
                state: innerBlock.init,
                result: null,
            },
        ]
    }
}

export function openEntry<State>(
    state: DirectoryState<State>,
    id: number,
): DirectoryState<State> {
    return { ...state, openedEntryId: id }
}

export function duplicateEntry<State>(
    state: DirectoryState<State>,
    id: number,
): DirectoryState<State> {
    const newId = nextFreeId(state.entries)
    return {
        ...state,
        entries: state.entries.flatMap(entry =>
            entry.id === id ?
                [entry, { ...entry, id: newId }]
            :
                [entry]
        ),
    }
}

export function deleteEntry<State>(
    state: DirectoryState<State>,
    id: number,
): DirectoryState<State> {
    return {
        ...state,
        entries: state.entries.filter(entry => entry.id !== id),
    }
}
