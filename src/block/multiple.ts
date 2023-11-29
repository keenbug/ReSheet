import { Block, Environment } from "."
import * as block from "."

export interface BlockEntry<InnerBlockState> {
    readonly id: number
    readonly name: string
    readonly state: InnerBlockState
}


export function entryDefaultName(entry: BlockEntry<unknown>) {
    return '$' + entry.id
}

export function entryName(entry: BlockEntry<unknown>) {
    if (entry.name.length === 0) {
        return entryDefaultName(entry)
    }

    return entry.name
}

export function getLastResult<State>(entries: BlockEntry<State>[], innerBlock: Block<State>) {
    if (entries.length === 0) { return undefined }

    const lastEntry = entries.slice(-1)[0]
    return innerBlock.getResult(lastEntry.state)
}

export function getResultEnv<State>(entries: BlockEntry<State>[], innerBlock: Block<State>) {
    return Object.fromEntries(
        entries.map(
            entry => {
                const result = innerBlock.getResult(entry.state)
                return [entryName(entry), result]
            }
        )
    )
}

export function entryToEnv<State>(entry: BlockEntry<State>, innerBlock: Block<State>) {
    return {
        [entryName(entry)]: innerBlock.getResult(entry.state)
    }
}

export function getLocalEnv<State>(entries: BlockEntry<State>[], env: Environment, innerBlock: Block<State>) {
    return Object.assign(
        {},
        env,
        ...entries.map(entry => entryToEnv(entry, innerBlock)),
    )
}


export function nextFreeId(blocks: BlockEntry<unknown>[]) {
    const highestId = blocks
        .map(entry => entry.id)
        .reduce((a, b) => Math.max(a, b), -1)

    return 1 + highestId
}

export function updateBlockWithId<Inner, Entry extends BlockEntry<Inner>>(
    entries: Entry[],
    id: number,
    update: (entry: Entry) => Entry,
) {
    return entries.map(
        entry =>
            entry.id === id ?
                update(entry)
            :
                entry
    )
}

export function insertEntryBefore<Inner, Entry extends BlockEntry<Inner>>(
    entries: Entry[],
    id: number,
    newEntry: Entry,
) {
    return entries.flatMap(entry =>
        entry.id === id ?
            [newEntry, entry]
        :
            [entry]
    )
}

export function insertEntryAfter<Inner, Entry extends BlockEntry<Inner>>(
    entries: Entry[],
    id: number,
    newEntry: Entry,
) {
    return entries.flatMap(entry =>
        entry.id === id ?
            [entry, newEntry]
        :
            [entry]
    )
}

export function onEnvironmentChange<State, Entry extends BlockEntry<State>>(
    entries: Entry[],
    update: block.BlockUpdater<Entry[]>,
    env: Environment,
    innerBlock: Block<State>,
): Entry[] {
    return block.mapWithEnv(
        entries,
        (entry, localEnv) => {
            function localUpdate(localAction: (state: State) => State) {
                update(entries => updateEntryState(entries, entry.id, localAction, localEnv, innerBlock, update))
            }

            const state = innerBlock.onEnvironmentChange(entry.state, localUpdate, localEnv)
            const newEntry = { ...entry, state }
            return {
                out: newEntry,
                env: entryToEnv(newEntry, innerBlock),
            }
        },
        env,
    )
}


export function updateEntryState<State, Entry extends BlockEntry<State>>(
    entries: Entry[],
    id: number,
    action: (state: State) => State,
    env: Environment,
    innerBlock: Block<State>,
    update: block.BlockUpdater<Entry[]>,
): Entry[] {
    const index = entries.findIndex(entry => entry.id === id)
    if (index < 0) { return entries }

    const entriesBefore = entries.slice(0, index)
    const entriesFromId = entries.slice(index)

    const envBefore = getLocalEnv(entriesBefore, env, innerBlock)


    const recomputedEntries = block.mapWithEnv(
        entriesFromId,
        (entry, localEnv) => {
            function localUpdate(localAction: (state: State) => State) {
                update(entries => updateEntryState(entries, entry.id, localAction, localEnv, innerBlock, update))
            }

            const state = (
                entry.id === id ?
                    action(entry.state)
                :
                    innerBlock.onEnvironmentChange(entry.state, localUpdate, localEnv)
            )
            const newEntry = { ...entry, state }

            return {
                out: newEntry,
                env: entryToEnv(newEntry, innerBlock),
            }
        },
        envBefore,
    )
    return [ ...entriesBefore, ...recomputedEntries ]
}



export function fromJSON<State, Entry extends BlockEntry<State>>(
    json: any[],
    update: block.BlockUpdater<Entry[]>,
    env: Environment,
    innerBlock: Block<State>,
    parseEntryRest: (entry: BlockEntry<State>, json: any, localEnv: Environment) => Entry,
) {
    return block.mapWithEnv(
        json,
        (jsonEntry, localEnv) => {
            function localUpdate(localAction: (state: State) => State) {
                update(entries => updateEntryState(entries, entry.id, localAction, env, innerBlock, update))
            }

            const { id, name, state, ...jsonRest } = jsonEntry
            const loadedState = innerBlock.fromJSON(state, localUpdate, localEnv)
            const entry: BlockEntry<State> = {
                id,
                name,
                state: loadedState,
            }
            const fullEntry = parseEntryRest(entry, jsonRest, localEnv)
            return {
                out: fullEntry,
                env: entryToEnv(fullEntry, innerBlock),
            }
        },
        env,
    )
}