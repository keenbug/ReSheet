import * as React from 'react'
import * as solidIcons from '@fortawesome/free-solid-svg-icons'

import { TextInput, Button, IconForButton } from '../../ui/utils'
import * as block from '../../logic/block'
import { Block, BlockUpdater } from '../../logic/block'
import { ErrorBoundary } from '../../ui/value'

import { DirectoryState } from './model'
import * as Model from './model'


export interface DirectoryProps<State> {
    state: DirectoryState<State>
    update: BlockUpdater<DirectoryState<State>>
    innerBlock: Block<State>
    env: block.Environment
}

export function Directory<State>({ state, update, innerBlock, env }: DirectoryProps<State>) {
    const { openedEntryId, entries } = state as DirectoryState<unknown>
    const annotatedEntries = Model.annotateDirectoryMap(entries, env)
    const openedEntry = openedEntryId === null ? null : annotatedEntries.find(entry => entry.id === openedEntryId)
    if (openedEntry === null) {
        const onAddNew = () => update(state => Model.addNewEntry(state, innerBlock))
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


export function DirectoryEntry({ entry, update }) {
    const onOpenEntry = () => update(state => Model.openEntry(state, entry.id))
    return (
        <div key={entry.id} className="flex flex-row space-x-2">
            <div className="flex flex-col space-y-1 flex-1">
                <Button onClick={onOpenEntry}>
                    {Model.entryName(entry)}
                </Button>
            </div>
            <EntryActions entry={entry} update={update} />
        </div>
    )
}

export function OpenedDirectoryEntry({ block, entry, update, env }) {
    const onUpdateName = name   => update(state => Model.setName(state, entry.id, name))
    const onCloseEntry = ()     => update(state => Model.recomputeEntryResults(Model.openEntry(state, null), block, env))
    const subupdate    = action => update(state => Model.updateEntryBlock(state, entry.id, action))

    return (
        <div key={entry.id} className="flex flex-col space-y-2 mx-2">
            <div className="flex flex-row space-x-1 flex-1">
                <Button onClick={onCloseEntry}>
                    <IconForButton icon={solidIcons.faAngleLeft} />
                </Button>
                <TextInput
                    className={`
                        hover:bg-gray-200 focus:bg-gray-200
                        rounded outline-none
                        p-0.5 mx-1
                    `}
                    value={entry.name}
                    onUpdate={onUpdateName}
                    placeholder={Model.entryDefaultName(entry)}
                />
            </div>
            <ErrorBoundary title={"There was an error in " + entry.name}>
                {block.view({ state: entry.state, update: subupdate, env })}
            </ErrorBoundary>
        </div>
    )
}


function EntryActions({ entry, update }) {
    const onDuplicate = () => update(state => Model.duplicateEntry(state, entry.id))
    const onDelete = () => update(state => Model.deleteEntry(state, entry.id))

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