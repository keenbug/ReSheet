import * as Block from '@resheet/core/block'

import { fieldDispatcher } from '@resheet/util/dispatch'

export function Inspect<State>(block: Block.BlockDef<State>) {
    return Block.create<State>({
        init: block.init,
        view: block.view,
        fromJSON: block.fromJSON,
        toJSON: block.toJSON,
        recompute: block.recompute,
        getResult(state) {
            return {
                block,
                state,
                result: block.getResult(state),
                derivedBlock: { ...block, init: state }
            }
        },
    })
}


export interface RecordState<Inner> {
    past: Inner[]
    now: Inner
}

export function Record<Inner>(block: Block.Block<Inner>) {
    return Block.create<RecordState<Inner>>({
        init: {
            past: [],
            now: block.init,
        },
        view({ state, dispatch, env }, ref) {
            const dispatchNow = fieldDispatcher('now', dispatch)
            return block.view({ state: state.now, dispatch: dispatchNow, env, ref})
        },
        fromJSON(json, dispatch, env) {
            const dispatchNow = fieldDispatcher('now', dispatch)
            return {
                past: [],
                now: block.fromJSON(json, dispatchNow, env),
            }
        },
        toJSON(state) {
            return block.toJSON(state.now)
        },
        recompute(state, dispatch, env, changed) {
            const dispatchNow = fieldDispatcher('now', dispatch)
            const {
                state: newState,
                invalidated,
            } = block.recompute(state.now, dispatchNow, env, changed)
            return {
                state: {
                    past: [...state.past, state.now],
                    now: newState,
                },
                invalidated,
            }
        },
        getResult(state) {
            return {
                ...state,
                result: block.getResult(state.now),
            }
        }
    })
}
