import * as React from 'react'

import * as block from '@tables/core/block'
import { Block, Environment } from '@tables/core/block'

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
        view({ state, dispatch, env }, ref) {
            const fromJSON = React.useCallback(
                function fromJSON(json: any, env: Environment) {
                    const dispatchInner = History.innerDispatcher(dispatch, env, fromJSON)
                    return Model.fromJSON(json, dispatchInner, env, safeInnerBlock)
                },
                [safeInnerBlock],
            )
            return (
                <GatherShortcuts>
                    <CollectKeymap collectorUi={KeymapCollector}>
                        <HistoryView state={state} dispatch={dispatch} env={env} fromJSON={fromJSON}>
                            {({ state, dispatch, dispatchHistory }) => (
                                <UI.DocumentUi
                                    state={state}
                                    dispatch={dispatch}
                                    dispatchHistory={dispatchHistory}
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
        recompute(state, dispatch, env) {
            function fromJSON(json: any, env: Environment) {
                return Model.fromJSON(json, dispatchInner, env, safeInnerBlock)
            }
            const dispatchInner = History.innerDispatcher(dispatch, env, fromJSON)
            return History.updateHistoryCurrent<Document<State>>(
                state,
                doc => Model.recompute(doc, dispatchInner, env, safeInnerBlock),
                env,
                fromJSON,
            )
        },
        getResult(state) {
            // FIXME: Return the result of the current historic position
            // Problem: Needs env and fromJSON (-> dispatch) to load a not yet
            //          deserialized state from the history
            return Model.getResult(state.inner, safeInnerBlock)
        },
        fromJSON(json, dispatch, env) {
            function fromJSON(json: any, env: Environment) {
                return Model.fromJSON(json, dispatchInner, env, safeInnerBlock)
            }
            const dispatchInner = History.innerDispatcher(dispatch, env, fromJSON)
            return History.historyFromJSON(json, env, (json, env) => Model.fromJSON(json, dispatchInner, env, safeInnerBlock))
        },
        toJSON(state) {
            return History.historyToJSON(state, inner => Model.toJSON(inner, safeInnerBlock))
        }
    })
}
