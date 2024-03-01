import * as React from 'react'

import * as block from '@tables/core'
import { Block, Environment } from '@tables/core'

import { CollectKeymap, GatherShortcuts } from '@tables/util/shortcuts'

import * as Model from './model'
import * as UI from './ui'
import * as History from './history'
import { HistoryWrapper, HistoryView } from './history'
import { Document } from './versioned'
import { KeymapCollector } from './key-collector'
import { safeBlock } from '../component'

export { Model, UI }

export type DocumentState<State> = HistoryWrapper<Document<State>>

export function DocumentOf<State>(innerBlock: Block<State>) {
    const safeInnerBlock = safeBlock(innerBlock)

    return block.create<DocumentState<State>>({
        init: History.initHistory(Model.init(safeInnerBlock.init)),
        view({ state, update, env }, ref) {
            const fromJSON = React.useCallback(
                function fromJSON(json: any, env: Environment) {
                    const updateInner = History.innerUpdater(update, env, fromJSON)
                    return Model.fromJSON(json, updateInner, env, safeInnerBlock)
                },
                [safeInnerBlock],
            )
            return (
                <GatherShortcuts>
                    <CollectKeymap collectorUi={KeymapCollector}>
                        <HistoryView state={state} update={update} env={env} fromJSON={fromJSON}>
                            {({ state, update, updateHistory }) => (
                                <UI.DocumentUi
                                    state={state}
                                    update={update}
                                    updateHistory={updateHistory}
                                    env={env}
                                    innerBlock={safeInnerBlock}
                                    blockRef={ref}
                                    />
                            )}
                        </HistoryView>
                    </CollectKeymap>
                </GatherShortcuts>
            )
        },
        recompute(state, update, env) {
            function fromJSON(json: any, env: Environment) {
                return Model.fromJSON(json, updateInner, env, safeInnerBlock)
            }
            const updateInner = History.innerUpdater(update, env, fromJSON)
            return History.updateHistoryCurrent(
                state,
                inner => Model.recompute(inner, updateInner, env, safeInnerBlock),
                env,
                fromJSON,
            )
        },
        getResult(state) {
            // FIXME: Return the result of the current historic posiition
            // Problem: Needs env and fromJSON (-> update) to load a not yet
            //          deserialized state from the history
            return Model.getResult(state.inner, safeInnerBlock)
        },
        fromJSON(json, update, env) {
            function fromJSON(json: any, env: Environment) {
                return Model.fromJSON(json, updateInner, env, safeInnerBlock)
            }
            const updateInner = History.innerUpdater(update, env, fromJSON)
            return History.historyFromJSON(json, env, (json, env) => Model.fromJSON(json, updateInner, env, safeInnerBlock))
        },
        toJSON(state) {
            return History.historyToJSON(state, inner => Model.toJSON(inner, safeInnerBlock))
        }
    })
}
