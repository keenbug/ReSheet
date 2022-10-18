import * as React from 'react'
import { Popover } from '@headlessui/react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import * as solidIcons from '@fortawesome/free-solid-svg-icons'

import { TextInput, classed, Button, IconForButton } from '../ui/utils'
import * as block from '../logic/block'
import { Block } from '../logic/block'

interface DirectoryState<InnerBlockState> {
    openedEntryId: null | number
    entries: DirectoryEntry<InnerBlockState>[]
}

interface DirectoryEntry<InnerBlockState> {
    id: number
    name: string
    state: InnerBlockState
}


const entryDefaultName = (entry: DirectoryEntry<unknown>) => '$' + entry.id
const entryName = (entry: DirectoryEntry<unknown>) => entry.name.length > 0 ? entry.name : entryDefaultName(entry)

const nextFreeId = (entries: DirectoryEntry<unknown>[]) =>
    1 + entries
        .map(entry => entry.id)
        .reduce((a, b) => Math.max(a, b), -1)

const updateEntryWithId = <Inner extends unknown>(
    state: DirectoryState<Inner>,
    id: number,
    update: (entry: DirectoryEntry<Inner>) => DirectoryEntry<Inner>,
): DirectoryState<Inner> =>
    ({
        ...state,
        entries: state.entries.map(entry => entry.id === id ? update(entry) : entry)
    })

const resultEntriesToEnv = resultEntries =>
    Object.fromEntries(
        resultEntries.map(entry => [entryName(entry), entry.result])
    )


/**************** Code Actions **************/


export const updateEntryBlock = <Inner extends unknown>(
    state: DirectoryState<Inner>,
    id: number,
    update: (inner: Inner) => Inner
): DirectoryState<Inner> =>
    updateEntryWithId(state, id, entry => ({ ...entry, state: update(entry.state) }))


export const setName = <Inner extends unknown>(state: DirectoryState<Inner>, id: number, name: string): DirectoryState<Inner> =>
    updateEntryWithId(state, id, entry => ({ ...entry, name }))

export const addNewEntry = <Inner extends unknown>(state: DirectoryState<Inner>, innerBlock: Block<Inner>): DirectoryState<Inner> =>
    ({
        ...state,
        entries: [
            ...state.entries,
            {
                id: nextFreeId(state.entries),
                name: '',
                state: innerBlock.init
            },
        ]
    })

export const openEntry = <Inner extends unknown>(state: DirectoryState<Inner>, id: number): DirectoryState<Inner> =>
    ({
        ...state,
        openedEntryId: id,
    })

export const deleteEntry = <Inner extends unknown>(state: DirectoryState<Inner>, id: number): DirectoryState<Inner> =>
    ({
        ...state,
        entries: state.entries.filter(entry => entry.id !== id)
    })




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
    view({ state, setState, env }) {
        const dispatch = (action, ...args) => {
            setState(state => action(state, ...args))
        }
        return <Directory state={state} dispatch={dispatch} innerBlock={innerBlock} env={env} />
    },
    getResult(state, env) {
        const obj = Object.create(null)
        state.entries.forEach(entry => {
            obj[entryName(entry)] = innerBlock.getResult(entry.state, env)
        })
        return  obj
    },
    fromJSON(json, env) {
        if (Array.isArray(json)) {
            const entries =
                json
                    .reduce(
                        (prevEntries, { id, name, state}) => {
                            const localEnv = { ...env, ...resultEntriesToEnv(prevEntries) }
                            const loadedState = innerBlock.fromJSON(state, localEnv)
                            const result = innerBlock.getResult(loadedState, localEnv)
                            return [
                                ...prevEntries,
                                { id, name, state: loadedState, result }
                            ]
                        },
                        []
                    )
                    .map(({ id, name, state }) => ({ id, name, state }))
            return { openedEntryId: null, entries }
        }
        else {
            return { openedEntryId: null, entries: [] }
        }
    },
    toJSON(state) {
        return state.entries.map(({ id, name, state }) => ({ id, name, state: innerBlock.toJSON(state) }))
    },
})

export const Directory = ({ state, dispatch, innerBlock, env }) => {
    const { openedEntryId, entries } = state as DirectoryState<unknown>
    const openedEntry = openedEntryId === null ? null : entries.find(entry => entry.id === openedEntryId)
    if (openedEntry === null) {
        const onAddNew = () => dispatch(addNewEntry, innerBlock)
        return (
            <React.Fragment>
                {entries.map(entry => (
                    <DirectoryEntry key={entry.id} entry={entry} dispatch={dispatch} />
                ))}
                <Button onClick={onAddNew}><IconForButton icon={solidIcons.faPlus} /></Button>
            </React.Fragment>
        )
    }
    else {
        return (
            <OpenedDirectoryEntry block={innerBlock} entry={openedEntry} dispatch={dispatch} env={env} />
        )
    }
}


export const DirectoryEntry = ({ entry, dispatch }) => {
    const onOpenEntry = () => dispatch(openEntry, entry.id)
    return (
        <DirectoryEntryContainer key={entry.id}>
            <DirectoryEntryContent>
                <Button onClick={onOpenEntry}>
                    {entryName(entry)}
                </Button>
            </DirectoryEntryContent>
            <EntryActions entry={entry} dispatch={dispatch} />
        </DirectoryEntryContainer>
    )
}

export const OpenedDirectoryEntry = ({ block, entry, dispatch, env }) => {
    const onUpdateName  = name   => dispatch(setName,          entry.id, name)
    const onUpdateBlock = update => dispatch(updateEntryBlock, entry.id, update)
    const onCloseEntry  = ()     => dispatch(openEntry,        null)
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
            {block.view({ state: entry.state, setState: onUpdateBlock, env })}
        </OpenedDirectoryEntryContainer>
    )
}


const EntryActions = ({ entry, dispatch }) => {
    const onDelete = () => dispatch(deleteEntry, entry.id)

    return (
        <React.Fragment>
            <Button onClick={onDelete}><IconForButton icon={solidIcons.faTrash} /></Button>
        </React.Fragment>
    )
}
