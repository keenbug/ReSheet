import * as React from 'react'
import { classed, LoadFileButton } from '../ui/utils'
import * as Block from '../block'
import { SheetOf } from './sheet'
import { BlockSelector } from './block-selector'
import { JSExpr } from './jsexpr'
import { DirectoryOf } from './directory'
import { DocumentOf } from './document'

export { JSExpr, BlockSelector, SheetOf, DirectoryOf, DocumentOf }

export const StateEditor = blocks => SheetOf(BlockSelector('JSExpr', JSExpr, JSExpr, blocks))
export const Selector = blocks => BlockSelector('JSExpr', JSExpr, StateEditor(blocks), blocks)
export const Sheet = blocks => SheetOf(Selector(blocks))
export const Dir = blocks => DirectoryOf(Selector(blocks))

export const Inspect = <State extends any>(block: Block.BlockDesc<State>) => Block.create<State>({
    init: block.init,
    view: block.view,
    fromJSON: block.fromJSON,
    toJSON: block.toJSON,
    getResult(state, env) {
        return {
            block,
            state,
            env,
            result: block.getResult(state, env),
            derivedBlock: { ...block, init: state }
        }
    },
})

export const Input = Block.create<string>({
    init: "",
    view({ state, update }) {
        function onChange(ev) {
            update(() => ev.target.value)
        }
        return <input type="text" value={state} onChange={onChange} />
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
    view({ update }) {
        const setData = data => update(() => data)

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