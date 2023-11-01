import * as React from 'react'

import * as block from '../../logic/block'
import { BlockDesc } from '../../logic/block'

import { DirectoryState } from './model'
import * as Model from './model'
import * as UI from './ui'

export type { DirectoryState }

export function DirectoryOf<State>(innerBlock: BlockDesc<State>) {
    return block.create<DirectoryState<State>>({
        init: {
            openedEntryId: null,
            entries: [],
        },
        view({ state, update, env }) {
            return (
                <UI.Directory
                    state={state}
                    update={update}
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
                            env: { [Model.entryName(entry)]: result },
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
}
