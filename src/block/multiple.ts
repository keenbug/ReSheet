import { Block, Environment } from "."
import * as block from "."
import { Validator, ValidatorObj, number, string } from "../utils/validate"

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

export function getEntriesUntil<State>(entries: BlockEntry<State>[], id: number) {
    const index = entries.findIndex(entry => entry.id === id)
    return entries.slice(0, index + 1)
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

export function getSiblingEnv<State>(entries: BlockEntry<State>[], innerBlock: Block<State>) {
    return Object.assign(
        {},
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
    ...newEntries: Entry[]
) {
    return entries.flatMap(entry =>
        entry.id === id ?
            [...newEntries, entry]
        :
            [entry]
    )
}

export function insertEntryAfter<Inner, Entry extends BlockEntry<Inner>>(
    entries: Entry[],
    id: number,
    ...newEntries: Entry[]
) {
    return entries.flatMap(entry =>
        entry.id === id ?
            [entry, ...newEntries]
        :
            [entry]
    )
}

export function entryEnv(env: Environment) {
    return (siblingsEnv: Environment) => ({
        ...env,
        ...siblingsEnv,
        $before: siblingsEnv
    })
}

export function updateEntries<State, Entry extends BlockEntry<State>>(
    entries: Entry[],
    updateEntry: (entry: Entry, localEnv: Environment, localUpdate: block.BlockUpdater<State>) => Entry,
    update: block.BlockUpdater<Entry[]>,
    innerBlock: Block<State>,
    getLocalEnv: (siblingsEnv: Environment) => Environment,
): Entry[] {
    return block.mapWithEnv(
        entries,
        (entry, siblingEnv) => {
            const localEnv = getLocalEnv(siblingEnv)
            function localUpdate(localAction: (state: State) => State) {
                update(entries => updateEntryState(entries, entry.id, localAction, localEnv, innerBlock, update))
            }

            const newEntry = updateEntry(entry, localEnv, localUpdate)
            return {
                out: newEntry,
                env: entryToEnv(newEntry, innerBlock),
            }
        }
    )
}

export function recompute<State, Entry extends BlockEntry<State>>(
    entries: Entry[],
    update: block.BlockUpdater<Entry[]>,
    env: Environment,
    innerBlock: Block<State>,
): Entry[] {
    return recomputeFrom(entries, undefined, env, innerBlock, update)
}


export function recomputeFrom<State, Entry extends BlockEntry<State>>(
    entries: Entry[],
    id: number | undefined,
    env: Environment,
    innerBlock: Block<State>,
    update: block.BlockUpdater<Entry[]>,
    offset: number = 0,
): Entry[] {
    const index = id === undefined ? 0 : entries.findIndex(entry => entry.id === id)
    if (index < 0) { return entries }

    const entriesUntilId = entries.slice(0, Math.max(0, index + offset))
    const entriesAfter = entries.slice(Math.max(0, index + offset))

    const siblingsBeforeEnv = getSiblingEnv(entriesUntilId, innerBlock)

    const recomputedEntries = updateEntries(
        entriesAfter,
        (entry, localEnv, localUpdate) => ({
            ...entry,
            state: innerBlock.recompute(entry.state, localUpdate, localEnv),
        }),
        update,
        innerBlock,
        (siblingsEnv: Environment) => ({
            ...env,
            ...siblingsBeforeEnv,
            ...siblingsEnv,
            $before: { ...siblingsBeforeEnv, ...siblingsEnv },
        })
    )
    return [ ...entriesUntilId, ...recomputedEntries ]
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

    const siblingsBeforeEnv = getSiblingEnv(entriesBefore, innerBlock)

    const recomputedEntries = updateEntries(
        entriesFromId,
        (entry, localEnv, localUpdate) => ({
            ...entry,
            state: (
                entry.id === id ?
                    action(entry.state)
                :
                    innerBlock.recompute(entry.state, localUpdate, localEnv)
            ),
        }),
        update,
        innerBlock,
        (siblingsEnv: Environment) => ({
            ...env,
            ...siblingsBeforeEnv,
            ...siblingsEnv,
            $before: { ...siblingsBeforeEnv, ...siblingsEnv },
        })
    )
    return [ ...entriesBefore, ...recomputedEntries ]
}


export function entryJSONV(inner: Validator, rest: ValidatorObj) {
    return {
        id: number,
        name: string,
        state: inner,
        ...rest,
    }
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
        (jsonEntry, siblingEnv) => {
            const localEnv = { ...env, ...siblingEnv, $before: siblingEnv }

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
    )
}