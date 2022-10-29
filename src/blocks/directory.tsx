import * as React from 'react'
import * as solidIcons from '@fortawesome/free-solid-svg-icons'
import { original, produce } from 'immer'

import { TextInput, classed, Button, IconForButton } from '../ui/utils'
import * as block from '../logic/block'
import { Block } from '../logic/block'
import { ErrorBoundary } from '../ui/value'

interface DirectoryState<InnerBlockState> {
    readonly openedEntryId: null | number
    readonly entries: DirectoryEntry<InnerBlockState>[]
}

interface DirectoryEntry<InnerBlockState> {
    readonly id: number
    readonly name: string
    readonly state: InnerBlockState
}


const entryDefaultName = (entry: DirectoryEntry<unknown>) => '$' + entry.id
const entryName = (entry: DirectoryEntry<unknown>) => entry.name.length > 0 ? entry.name : entryDefaultName(entry)

const nextFreeId = (entries: DirectoryEntry<unknown>[]) =>
    1 + entries
        .map(entry => entry.id)
        .reduce((a, b) => Math.max(a, b), -1)


function getLookupDirectory<InnerBlockState>(
    state: DirectoryState<InnerBlockState>,
    block: Block<InnerBlockState>,
    env: block.Environment,
) {
    return function lookupDirectory(name: string) {
        if (name === '..') { return env.lookupDirectory }
        return getEntryResult(state, block, name, env)
    }
}

function getEntryResult<InnerBlockState>(
    state: DirectoryState<InnerBlockState>,
    block: Block<InnerBlockState>,
    name: string,
    env: block.Environment,
) {
    const lookupDirectory = getLookupDirectory(state, block, env)
    const entry = state.entries.find(entry => entry.name === name)
    return entry && block.getResult(entry.state, { ...env, lookupDirectory })
}


/**************** Code Actions **************/


export const updateEntryBlock = produce<DirectoryState<unknown>, [number, (inner: unknown) => unknown]>(
    (state, id, action) => {
        const entry = state.entries.find(entry => entry.id === id)
        entry.state = action(original(entry).state)
    }
)


export const setName = produce<DirectoryState<unknown>, [number, string]>(
    (state, id, name) => {
        state.entries.find(entry => entry.id === id).name = name
    }
)

export const addNewEntry = produce<DirectoryState<unknown>, [Block<unknown>]>(
    (state, innerBlock) => {
        const id = nextFreeId(original(state).entries)
        state.openedEntryId = id
        state.entries.push({
            id,
            name: '',
            state: innerBlock.init
        })
    }
)

export const openEntry = produce<DirectoryState<unknown>, [number]>(
    (state, id) => {
        state.openedEntryId = id
    }
)

export const deleteEntry = produce<DirectoryState<unknown>, [number]>(
    (state, id) => {
        state.entries = state.entries.filter(entry => entry.id !== id)
    }
)




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


export const DirectoryBlock = <State extends unknown>(innerBlock: Block<State>) => block.create<DirectoryState<State>>({
    init: {
        openedEntryId: null,
        entries: [],
    },
    view({ state, update, env }) {
        const lookupDirectory = getLookupDirectory(state, innerBlock, env)
        const envWithLookup = { ...env, lookupDirectory }
        return <Directory state={state} update={update} innerBlock={innerBlock} env={envWithLookup} />
    },
    getResult(state, env) {
        return getLookupDirectory(state, innerBlock, env)
    },
    fromJSON(json, env) {
        const openedEntryId = json?.openedEntryId ?? null
        const entries = json?.entries ?? []
        return {
            openedEntryId,
            entries: entries.map(({ id, name, state }) =>
                ({ id, name, state: innerBlock.fromJSON(state, env) })
            ),
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

export const Directory = ({ state, update, innerBlock, env }) => {
    const { openedEntryId, entries } = state as DirectoryState<unknown>
    const openedEntry = openedEntryId === null ? null : entries.find(entry => entry.id === openedEntryId)
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
            <OpenedDirectoryEntry block={innerBlock} entry={openedEntry} update={update} env={env} />
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
    const onDelete = () => update(state => deleteEntry(state, entry.id))

    return (
        <React.Fragment>
            <Button onClick={onDelete}><IconForButton icon={solidIcons.faTrash} /></Button>
        </React.Fragment>
    )
}
