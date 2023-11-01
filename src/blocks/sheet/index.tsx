import * as React from 'react'

import * as block from '../../logic/block'
import { BlockDesc } from '../../logic/block'
import { SheetBlockState, SheetBlockLine } from './model'
import * as Model from './model'
import * as UI from './ui'


export type { SheetBlockState }

export function SheetOf<State extends unknown>(innerBlock: BlockDesc<State>) {
    return block.create<SheetBlockState<State>>({
        init: Model.init(innerBlock.init),
        view({ state, update, env }) {
            return <UI.Sheet lines={state} update={update} innerBlock={innerBlock} env={env} />
        },
        getResult(state, env) {
            return Model.getResult(state)
        },
        fromJSON(json: any[], env) {
            return block.mapWithEnv(
                json,
                (jsonLine, localEnv) => {
                    const { id, name, isCollapsed = false, state } = jsonLine
                    const loadedState = innerBlock.fromJSON(state, localEnv)
                    const result = innerBlock.getResult(loadedState, localEnv)
                    const line: SheetBlockLine<State> = {
                        id,
                        name,
                        isCollapsed,
                        state: loadedState,
                        result
                    }
                    return {
                        out: line,
                        env: Model.lineToEnv(line)
                    }
                },
                env,
            )
        },
        toJSON(lines) {
            return lines.map(
                ({ id, name, isCollapsed, state }) => (
                    {
                        id,
                        name,
                        isCollapsed,
                        state: innerBlock.toJSON(state),
                    }
                )
            )
        },
    })
}