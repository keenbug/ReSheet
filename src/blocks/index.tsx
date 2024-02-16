import * as React from 'react'
import { classed, LoadFileButton } from '../ui/utils'
import * as Block from '../block'
import { SheetOf } from './sheet'
import { BlockSelector } from './block-selector'
import { JSExpr } from './js'
import { DocumentOf } from './document'
import { Note } from './note'
import { any, is, number, string, validatorSwitch } from '../utils/validate'
import { base64ToUint8Array, uint8ArrayToBase64 } from '../utils'

export { JSExpr, BlockSelector, SheetOf, DocumentOf, Note }

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

const loadFileButtonStyle = `
    cursor-pointer
    m-0.5
    px-1
    border
    border-gray-200
    rounded
    font-gray-700
    bg-gray-100
    hover:bg-gray-200
`
export const LoadFileButtonStyled = classed<any>(LoadFileButton)`${loadFileButtonStyle}`

export type LoadFileState =
    | { state: 'init' }
    | { state: 'loaded', file: File, buffer: ArrayBuffer }

export const LoadFile = Block.create<LoadFileState>({
    init: { state: 'init' },
    view({ state, update }) {
        async function loadFile(file: File) {
            const buffer = await file.arrayBuffer()
            update(() => ({ state: 'loaded', file, buffer }))
        }

        function clear() {
            update(() => ({ state: 'init' }))
        }

        switch (state.state) {
            case 'init':
                return (
                    <LoadFileButtonStyled onLoad={loadFile}>
                        Load File
                    </LoadFileButtonStyled>
                )

            case 'loaded':
                return (
                    <div>
                        File <code className="px-1 bg-gray-100 rounded-sm">{state.file.name}</code> loaded {}
                        <span className="text-sm text-gray-700">({state.file.size} bytes)</span> {}
                        <button className={loadFileButtonStyle} onClick={clear}>clear</button>
                    </div>
                )
        }
    },
    recompute(state, update, env) {
        return state
    },
    getResult(state) {
        switch (state.state) {
            case 'init': return null
            case 'loaded': return state.file
        }
    },
    fromJSON(json, env) {
        return validatorSwitch<LoadFileState>(json,
            [is(null), () => ({ state: 'init' })],
            [string, content => {
                const uint8Array = new TextEncoder().encode(content)
                return {
                    state: 'loaded',
                    file: new File([uint8Array], '<unknown>'),
                    buffer: uint8Array.buffer,
                }
            }],
            [{ state: 'init' }, init => init],
            [{ state: 'loaded', content: string, filename: string }, ({ content, filename }) => {
                const uint8Array = new TextEncoder().encode(content)
                return {
                    state: 'loaded',
                    file: new File([uint8Array], filename),
                    buffer: uint8Array.buffer,
                }
            }],
            [{ state: 'loaded', file: { content: string, name: string, options: { type: string, lastModified: number } } }, ({ file: { content, name, options: { type, lastModified } } }) => {
                const uint8Array = base64ToUint8Array(content)
                return {
                    state: 'loaded',
                    file: new File([uint8Array], name, { type, lastModified }),
                    buffer: uint8Array.buffer,
                }
            }],
            [any, () => ({ state: 'init' })],
        )
    },
    toJSON(state) {
        switch (state.state) {
            case 'init': return { state: 'init' }
            case 'loaded':
                return {
                    state: 'loaded',
                    file: {
                        content: uint8ArrayToBase64(new Uint8Array(state.buffer)),
                        name: state.file.name,
                        options: {
                            type: state.file.type,
                            lastModified: state.file.lastModified,
                        }
                    }
                }
        }
    }
})