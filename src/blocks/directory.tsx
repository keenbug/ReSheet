import * as React from 'react'
import * as solidIcons from '@fortawesome/free-solid-svg-icons'

import { TextInput, classed, Button, IconForButton } from '../ui/utils'
import * as block from '../logic/block'
import { BlockDesc } from '../logic/block'
import { ErrorBoundary } from '../ui/value'

interface DirectoryState<InnerBlockState> {
    readonly openedEntryId: null | number
    readonly entries: DirectoryEntry<InnerBlockState>[]
}

interface DirectoryEntry<InnerBlockState> {
    readonly id: number
    readonly name: string
    readonly state: InnerBlockState
    result: unknown
}


const entryDefaultName = (entry: DirectoryEntry<unknown>) => '$' + entry.id
const entryName = (entry: DirectoryEntry<unknown>) => entry.name.length > 0 ? entry.name : entryDefaultName(entry)

const nextFreeId = (entries: DirectoryEntry<unknown>[]) =>
    1 + entries
        .map(entry => entry.id)
        .reduce((a, b) => Math.max(a, b), -1)


function annotateDirectoryMap<InnerState>(
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


function recomputeEntryResults<InnerState>(
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




/**************** UI *****************/

const DirectoryEntryContainer = classed<any>('div')`flex flex-row space-x-2`
const DirectoryEntryContent = classed<any>('div')`flex flex-col space-y-1 flex-1`

const OpenedDirectoryEntryContainer = classed<any>('div')`flex flex-col space-y-2 mx-2`
const OpenedDirectoryEntryHeader = classed<any>('div')`flex flex-row space-x-1 flex-1`

const NameInput = classed<any>(TextInput)`
    hover:bg-gray-200
    focus:bg-gray-200
    outline-none
    p-0.5 mx-1
    rounded
`


export const DirectoryBlock = <State extends unknown>(innerBlock: BlockDesc<State>) => block.create<DirectoryState<State>>({
    init: {
        openedEntryId: null,
        entries: [],
    },
    view({ state, update, env }) {
        function updateAndRecompute(action, env) {
            update(state => recomputeEntryResults(action(state), innerBlock, env))
        }
        return (
            <Directory
                state={state}
                update={action => updateAndRecompute(action, env)}
                innerBlock={innerBlock}
                env={env}
                />
        )
    },
    getResult(state, env) {
        return state.entries[state.entries.length - 1]?.result
    },
    fromJSON(json, env) {
        const openedEntryId = json?.openedEntryId ?? null
        const entries = json?.entries ?? []
        const loadedEntries = block.mapWithEnv(
            entries,
            (innerJson: any, dir) => {
                try {
                    const { id, name, state } = innerJson
                    const localEnv = { ...env, dir }
                    const loadedState = innerBlock.fromJSON(state, localEnv)
                    const result = innerBlock.getResult(loadedState, localEnv)
                    const entry = { id, name, state: loadedState, result }
                    return {
                        out: [entry],
                        env: { [entryName(entry)]: result },
                    }
                }
                catch (e) {
                    console.warn("Could not load entry", e)
                    return {
                        out: [],
                        env: {},
                    }
                }
            }
        ).flat()
        return {
            openedEntryId,
            entries: loadedEntries,
        }
    },
    toJSON({ openedEntryId, entries }) {
        return {
            openedEntryId,
            entries: 
                entries.map(
                    ({ id, name, state }) =>
                        ({
                            id,
                            name,
                            state: innerBlock.toJSON(state)
                        })
                ),
        }
    },
})

export interface DirectoryProps<State> {
    state: DirectoryState<State>
    update: block.BlockUpdater<DirectoryState<State>>
    innerBlock: BlockDesc<State>
    env: block.Environment
}

export function Directory<State>({ state, update, innerBlock, env }: DirectoryProps<State>) {
    const { openedEntryId, entries } = state as DirectoryState<unknown>
    const annotatedEntries = annotateDirectoryMap(entries, env)
    const openedEntry = openedEntryId === null ? null : annotatedEntries.find(entry => entry.id === openedEntryId)
    if (openedEntry === null) {
        const onAddNew = () => update(state => addNewEntry(state, innerBlock))
        return (
            <React.Fragment>
                {entries.map(entry => (
                    <DirectoryEntry key={entry.id} entry={entry} update={update} />
                ))}
                <Button onClick={onAddNew}><IconForButton icon={solidIcons.faPlus} /></Button>
            </React.Fragment>
        )
    }
    else {
        return (
            <OpenedDirectoryEntry
                block={innerBlock}
                entry={openedEntry}
                update={update}
                env={{ ...env, dir: openedEntry.dir }}
                />
        )
    }
}


export const DirectoryEntry = ({ entry, update }) => {
    const onOpenEntry = () => update(state => openEntry(state, entry.id))
    return (
        <DirectoryEntryContainer key={entry.id}>
            <DirectoryEntryContent>
                <Button onClick={onOpenEntry}>
                    {entryName(entry)}
                </Button>
            </DirectoryEntryContent>
            <EntryActions entry={entry} update={update} />
        </DirectoryEntryContainer>
    )
}

export const OpenedDirectoryEntry = ({ block, entry, update, env }) => {
    const onUpdateName = name   => update(state => setName(state, entry.id, name))
    const onCloseEntry = ()     => update(state => openEntry(state, null))
    const subupdate    = action => update(state => updateEntryBlock(state, entry.id, action))

    return (
        <OpenedDirectoryEntryContainer key={entry.id}>
            <OpenedDirectoryEntryHeader>
                <Button onClick={onCloseEntry}>
                    <IconForButton icon={solidIcons.faAngleLeft} />
                </Button>
                <NameInput
                    value={entry.name}
                    onUpdate={onUpdateName}
                    placeholder={entryDefaultName(entry)}
                />
            </OpenedDirectoryEntryHeader>
            <ErrorBoundary title={"There was an error in " + entry.name}>
                {block.view({ state: entry.state, update: subupdate, env })}
            </ErrorBoundary>
        </OpenedDirectoryEntryContainer>
    )
}


const EntryActions = ({ entry, update }) => {
    const onDuplicate = () => update(state => duplicateEntry(state, entry.id))
    const onDelete = () => update(state => deleteEntry(state, entry.id))

    function IconButton({ onClick, icon }) {
        return (
            <button
                className={`
                    text-left
                    text-gray-400 hover:text-gray-600
                
                    hover:bg-gray-200
                    focus:bg-gray-300
                
                    transition-colors
                
                    outline-none
                    h-7 px-1 space-x-1
                `}
                onClick={onClick}
                >
                <IconForButton icon={icon} />
            </button>
        )
    }

    return (
        <React.Fragment>
            <IconButton onClick={onDuplicate} icon={solidIcons.faClone} />
            <IconButton onClick={onDelete} icon={solidIcons.faTrash} />
        </React.Fragment>
    )
}
