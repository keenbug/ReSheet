import * as React from 'react'
import { classed, LoadFileButton } from '../ui/utils'
import * as Block from '../logic/block'
import { SheetBlock } from './sheet'
import { CommandBlock } from './command'
import { JSExprBlock } from './jsexpr'
import { DirectoryBlock } from './directory'

export const Sheet = SheetBlock
export const Command = CommandBlock
export const JSExpr = JSExprBlock
export const Directory = DirectoryBlock

export const Inspect = <State extends any>(block: Block.Block<State>) => Block.create<State>({
    init: block.init,
    view: block.view,
    fromJSON: block.fromJSON,
    toJSON: block.toJSON,
    getResult(state, env) {
        return {
            block,
            state,
            env,
            result: block.getResult(state, env)
        }
    },
})

export const Input = Block.create<string>({
    init: "",
    view({ state, setState }) {
        return <input type="text" value={state} onChange={ev => setState(() => ev.target.value)} />
    },
    getResult(state) {
        return state
    },
    fromJSON(json) {
        if (typeof json === 'string') {
            return json
        }
        else {
            return ""
        }
    },
    toJSON(state) {
        return state
    }
})

export const LoadFileButtonStyled = classed<any>(LoadFileButton)`
    cursor-pointer
    p-1
    rounded
    font-gray-700
    bg-gray-100
    hover:bg-gray-200
`

export const LoadFile = Block.create<any>({
    init: null,
    view({ setState }) {
        const setData = data => setState(state => data)

        return (
            <LoadFileButtonStyled
                onLoad={file => file.text().then(setData)}
            >
                Load File
            </LoadFileButtonStyled>
        )
    },
    getResult(state, env) {
        return state
    },
    fromJSON(json, env) {
        return json
    },
    toJSON(state) {
        return state
    }
})