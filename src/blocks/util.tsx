import * as Block from '@resheet/core/block'

export function WithEnv<Inner>(changeEnv: (env: Block.Environment) => Block.Environment, block: Block.Block<Inner>) {
    function changeDispatchEnv(dispatch: Block.BlockDispatcher<Inner>) {
        return function dispatchChangedEnv(action: Block.BlockAction<Inner>) {
            dispatch((state, { env }) =>
                action(state, { env: changeEnv(env) })
            )
        }
    }
    return Block.create<Inner>({
        init: block.init,
        view({ state, dispatch, env }, ref) {
            return block.view({
                state, ref,
                dispatch: changeDispatchEnv(dispatch),
                env: changeEnv(env),
            })
        },
        fromJSON(json, dispatch, env) {
            return block.fromJSON(json, changeDispatchEnv(dispatch), changeEnv(env))
        },
        toJSON: block.toJSON,
        getResult: block.getResult,
        recompute(state, dispatch, env, changed) {
            return block.recompute(state, changeDispatchEnv(dispatch), changeEnv(env), changed)
        },
    })
}