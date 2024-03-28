import { Set, set, update } from 'immutable'

import { Validator, ValidatorObj, number, string } from "@resheet/util/validate"

import { Block, Environment } from "./block"
import * as block from "./block"

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

export function entriesToEnv<State>(entries: BlockEntry<State>[], innerBlock: Block<State>) {
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
    updateEntry: (entry: Entry, localEnv: Environment, localDispatch: block.BlockDispatcher<State>) => Entry,
    dispatch: block.BlockDispatcher<Entry[]>,
    innerBlock: Block<State>,
    getLocalEnv: (siblingsEnv: Environment) => Environment,
): Entry[] {
    return block.mapWithEnv(
        entries,
        (entry, siblingEnv) => {
            const localEnv = getLocalEnv(siblingEnv)
            function localDispatch(localAction: block.BlockAction<State>) {
                dispatch((entries, context) => block.extractActionDescription(localAction, pureAction =>
                    updateEntryState(
                        entries,
                        entry.id,
                        pureAction,
                        context.env,
                        innerBlock,
                        dispatch,
                    )
                ))
            }

            const newEntry = updateEntry(entry, localEnv, localDispatch)
            return {
                out: newEntry,
                env: entryToEnv(newEntry, innerBlock),
            }
        }
    )
}

export function recompute<State, Entry extends BlockEntry<State>>(
    entries: Entry[],
    dispatch: block.BlockDispatcher<Entry[]>,
    env: Environment,
    changedVars: Set<string>,
    innerBlock: Block<State>,
): {
    state: Entry[],
    invalidated: boolean,
} {
    return recomputeFrom(entries, undefined, env, changedVars, innerBlock, dispatch)
}


export function recomputeFrom<State, Entry extends BlockEntry<State>>(
    entries: Entry[],
    id: number | undefined,
    env: Environment,
    changedVars: Set<string>,
    innerBlock: Block<State>,
    dispatch: block.BlockDispatcher<Entry[]>,
    offset: number = 0,
): {
    state: Entry[],
    invalidated: boolean,
 } {
    const index = id === undefined ? 0 : entries.findIndex(entry => entry.id === id)
    if (index < 0) {
        return { state: entries, invalidated: false }
    }

    const entriesUntilId = entries.slice(0, Math.max(0, index + offset))
    const entriesAfter = entries.slice(Math.max(0, index + offset))

    const siblingsBeforeEnv = entriesToEnv(entriesUntilId, innerBlock)

    const {
        entries: recomputedEntries,
        anyInvalidated,
    } = entriesAfter.reduce(
        ({ entries, siblingsEnv, changedVars, anyInvalidated }, entry) => {
            const localEnv = { ...env, ...siblingsEnv, $before: siblingsEnv }

            function localDispatch(localAction: block.BlockAction<State>) {
                dispatch((entries, context) => block.extractActionDescription(localAction, pureAction =>
                    updateEntryState(
                        entries,
                        entry.id,
                        pureAction,
                        context.env,
                        innerBlock,
                        dispatch,
                    )
                ))
            }

            const { state, invalidated } = innerBlock.recompute(entry.state, localDispatch, localEnv, changedVars)
            const newEntry = { ...entry, state }
            const name = entryName(entry)
            const newChangedVars = invalidated ? changedVars.add(name) : changedVars.remove(name)

            return {
                entries: [ ...entries, newEntry ],
                siblingsEnv: { ...siblingsEnv, ...entryToEnv(newEntry, innerBlock) },
                changedVars: newChangedVars,
                anyInvalidated: anyInvalidated || invalidated,
            }
        },
        {
            entries: [],
            siblingsEnv: siblingsBeforeEnv,
            changedVars,
            anyInvalidated: false,
        }
    )
    return {
        state: [ ...entriesUntilId, ...recomputedEntries ],
        invalidated: anyInvalidated,
    }
}



export function updateEntryState<State, Entry extends BlockEntry<State>>(
    entries: Entry[],
    id: number,
    action: (state: State, context: block.BlockActionContext) => State,
    env: Environment,
    innerBlock: Block<State>,
    dispatch: block.BlockDispatcher<Entry[]>,
): Entry[] {
    const entryIndex = entries.findIndex(entry => entry.id === id)
    if (entryIndex < 0) { return entries }

    const siblings = entries.slice(0, entryIndex)
    const siblingsEnv = entriesToEnv(siblings, innerBlock)

    const entry = entries[entryIndex]
    const updatedEntries = (
        set(entries, entryIndex, update(entry, 'state', state =>
            action(
                state,
                { env: { ...env, ...siblingsEnv, $before: siblingsEnv } },
            )
        ))
    )
    const changedVars = Set([ entryName(entry) ])
    const { state: recomputedEntries } = recomputeFrom(
        updatedEntries,
        id,
        env,
        changedVars,
        innerBlock,
        dispatch,
        1,
    )

    return recomputedEntries
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
    dispatch: block.BlockDispatcher<Entry[]>,
    env: Environment,
    innerBlock: Block<State>,
    parseEntryRest: (entry: BlockEntry<State>, json: any, localEnv: Environment) => Entry,
) {
    return block.mapWithEnv(
        json,
        (jsonEntry, siblingEnv) => {
            const localEnv = { ...env, ...siblingEnv, $before: siblingEnv }

            function localDispatch(localAction: block.BlockAction<State>) {
                dispatch((entries, context) => block.extractActionDescription(localAction, pureAction =>
                    updateEntryState(
                        entries,
                        entry.id,
                        pureAction,
                        context.env,
                        innerBlock,
                        dispatch,
                    )
                ))
            }

            const { id, name, state, ...jsonRest } = jsonEntry
            const loadedState = innerBlock.fromJSON(state, localDispatch, localEnv)
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