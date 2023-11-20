import { Block, Environment } from "."
import * as block from "."

export interface BlockEntry<InnerBlockState> {
    readonly id: number
    readonly name: string
    readonly state: InnerBlockState
    readonly result: unknown
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

export function getLastResult<State>(entries: BlockEntry<State>[]) {
    return entries[entries.length - 1]?.result
}

export function getResultEnv<State>(entries: BlockEntry<State>[]) {
    return Object.fromEntries(
        entries.map(entry => [entry.name, entry.result])
    )
}


export function entryToEnv<State>(line: BlockEntry<State>) {
    return {
        [entryName(line)]: line.result
    }
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

export function getEntryEnvBefore<State>(
    entries: BlockEntry<State>[],
    beforeId: number
) {
    const entryIndex = entries.findIndex(entry => entry.id === beforeId) ?? 0
    const entriesBefore = entries.slice(0, entryIndex)
    return Object.assign({}, ...entriesBefore.map(entryToEnv))
}

export function recomputeResults<State, Entry extends BlockEntry<State>>(
    entries: Entry[],
    innerBlock: Block<State>,
    env: Environment,
    startFromId?: number,
) {
    const startIndex = entries.findIndex(entry => entry.id === startFromId) ?? 0
    const entriesBefore = entries.slice(0, startIndex)
    const entriesAfter = entries.slice(startIndex)

    const envBefore = Object.assign({}, env, ...entriesBefore.map(entryToEnv))

    const recomputedEntries = block.mapWithEnv(
        entriesAfter,
        (entry, localEnv) => {
            const result = innerBlock.getResult(entry.state, localEnv)
            return {
                out: { ...entry, result },
                env: { [entryName(entry)]: result },
            }
        },
        envBefore,
    )
    return [ ...entriesBefore, ...recomputedEntries ]
}


export function updateBlockEntry<State, Entry extends BlockEntry<State>>(
    entries: Entry[],
    id: number,
    action: (state: Entry, localEnv: Environment) => Entry,
    getResult: (state: Entry, localEnv: Environment) => unknown,
    env: Environment,
): Entry[] {
    const index = entries.findIndex(entry => entry.id === id)
    if (index < 0) { return entries }

    const entriesBefore = entries.slice(0, index)
    const entriesAfter = entries.slice(index)

    const envBefore = Object.assign({}, env, ...entriesBefore.map(entryToEnv))

    const recomputedEntries = block.mapWithEnv(
        entriesAfter,
        (entry, localEnv) => {
            const newEntry = entry.id === id ? action(entry, localEnv) : entry
            const result = getResult(newEntry, localEnv)
            return {
                out: { ...newEntry, result },
                env: { [entryName(entry)]: result },
            }
        },
        envBefore,
    )
    return [ ...entriesBefore, ...recomputedEntries ]
}


export function updateEntryState<State, Entry extends BlockEntry<State>>(
    entries: Entry[],
    id: number,
    action: (state: State) => State,
    innerBlock: Block<State>,
    env: Environment,
): Entry[] {
    return recomputeResults(
        entries.map(entry =>
            entry.id === id ?
                { ...entry, state: action(entry.state) }
            :
                entry
        ),
        innerBlock,
        env,
        id,
    )
}


export function fromJSON<State, Entry extends BlockEntry<State>>(
    json: any[],
    innerBlock: Block<State>,
    env: Environment,
    parseEntryRest: (entry: BlockEntry<State>, json: any, localEnv: Environment) => Entry,
) {
    return block.mapWithEnv(
        json,
        (jsonEntry, localEnv) => {
            const { id, name, state, ...jsonRest } = jsonEntry
            const loadedState = innerBlock.fromJSON(state, localEnv)
            const result = innerBlock.getResult(loadedState, localEnv)
            const entry: BlockEntry<State> = {
                id,
                name,
                state: loadedState,
                result
            }
            const fullEntry = parseEntryRest(entry, jsonRest, localEnv)
            return {
                out: fullEntry,
                env: entryToEnv(fullEntry)
            }
        },
        env,
    )
}