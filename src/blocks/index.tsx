import * as React from 'react'
import { classed, LoadFileButton } from '../ui/utils'
import * as Block from '../block'
import { SheetOf } from './sheet'
import { BlockSelector } from './block-selector'
import { JSExpr } from './jsexpr'
import { DocumentOf } from './document'

export { JSExpr, BlockSelector, SheetOf, DocumentOf }

export const Selector = blocks => BlockSelector('JSExpr', JSExpr, blocks)
export const Sheet = blocks => SheetOf(Selector(blocks))

export const Inspect = <State extends any>(block: Block.BlockDesc<State>) => Block.create<State>({
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

export function Input(parser = str => str) {
    return Block.create<string>({
        init: "",
        view({ state, update }, ref) {
            const inputRef = React.useRef<HTMLInputElement>()
            React.useImperativeHandle(
                ref,
                () => ({
                    focus() { inputRef.current?.focus() }
                }),
                [inputRef],
            )
            function onChange(ev) {
                update(() => ev.target.value)
            }
            return <input ref={inputRef} type="text" value={state} onChange={onChange} />
        },
        getResult(state) {
            return parser(state)
        },
        recompute(state, update, env) {
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
}

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
    recompute(state, update, env) {
        return state
    },
    getResult(state) {
        return state
    },
    fromJSON(json, env) {
        return json
    },
    toJSON(state) {
        return state
    }
})