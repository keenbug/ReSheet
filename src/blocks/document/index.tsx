import * as React from 'react'

import * as block from '../../block'
import { Block, Environment } from '../../block'
import * as Model from './model'
import * as UI from './ui'
import * as History from './history'
import { HistoryWrapper, HistoryView } from './history'
import { CollectKeymap, GatherShortcuts } from '../../ui/shortcuts'
import { Document } from './versioned'

export { Model, UI }

export type DocumentState<State> = HistoryWrapper<Document<State>>

export function DocumentOf<State>(innerBlock: Block<State>) {
    return block.create<DocumentState<State>>({
        init: History.initHistory(Model.init(innerBlock.init)),
        view({ state, update, env }, ref) {
            const fromJSON = React.useCallback(
                function fromJSON(json: any, env: Environment) {
                    const updateInner = History.innerUpdater(update, env, fromJSON)
                    return Model.fromJSON(json, updateInner, env, innerBlock)
                },
                [innerBlock],
            )
            return (
                <GatherShortcuts>
                    <CollectKeymap collectorDialog={UI.KeymapCollectorDialog}>
                        <HistoryView state={state} update={update} env={env} fromJSON={fromJSON}>
                            {({ state, update, updateHistory }) => (
                                <UI.DocumentUi
                                    state={state}
                                    update={update}
                                    updateHistory={updateHistory}
                                    env={env}
                                    innerBlock={innerBlock}
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
                return Model.fromJSON(json, updateInner, env, innerBlock)
            }
            const updateInner = History.innerUpdater(update, env, fromJSON)
            return History.updateHistoryCurrent(
                state,
                inner => Model.recompute(inner, updateInner, env, innerBlock),
                env,
                fromJSON,
            )
        },
        getResult(state) {
            // FIXME: Return the result of the current historic posiition
            // Problem: Needs env and fromJSON (-> update) to load a not yet
            //          deserialized state from the history
            return Model.getResult(state.inner, innerBlock)
        },
        fromJSON(json, update, env) {
            function fromJSON(json: any, env: Environment) {
                return Model.fromJSON(json, updateInner, env, innerBlock)
            }
            const updateInner = History.innerUpdater(update, env, fromJSON)
            return History.historyFromJSON(json, env, (json, env) => Model.fromJSON(json, updateInner, env, innerBlock))
        },
        toJSON(state) {
            return History.historyToJSON(state, inner => Model.toJSON(inner, innerBlock))
        }
    })
}
