import * as React from 'react'

import * as Block from '@resheet/core/block'

import { any, is, number, string, validatorSwitch } from '@resheet/util/validate'
import { base64ToUint8Array, uint8ArrayToBase64 } from '@resheet/util'

import { LoadFileButton } from './utils/ui'

import { SheetOf } from './sheet'
import { BlockSelector } from './block-selector'
import { JSExpr } from './js'
import { DocumentOf } from './document'
import { Note } from './note'

export { JSExpr, BlockSelector, SheetOf, DocumentOf, Note }

export const Selector = blocks => BlockSelector('JSExpr', JSExpr, blocks)
export const Sheet = blocks => SheetOf(Selector(blocks))

export const Inspect = <State extends any>(block: Block.BlockDef<State>) => Block.create<State>({
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
        view({ state, dispatch }, ref) {
            const inputRef = React.useRef<HTMLInputElement>()
            React.useImperativeHandle(
                ref,
                () => ({
                    focus() { inputRef.current?.focus() }
                }),
                [inputRef],
            )
            function onChange(ev) {
                dispatch(() => ({ state: ev.target.value }))
            }
            return <input ref={inputRef} type="text" value={state} onChange={onChange} />
        },
        getResult(state) {
            return parser(state)
        },
        recompute(state, dispatch, env) {
            return { state, invalidated: false }
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

export type LoadFileState =
    | { state: 'init' }
    | { state: 'loaded', file: File, content: string }

export const LoadFile = Block.create<LoadFileState>({
    init: { state: 'init' },
    view({ state, dispatch }) {
        const loadFileButtonStyle = `
            m-0.5 px-1
            rounded border border-gray-200
            text-gray-700
            bg-gray-100 hover:bg-gray-200
        `

        async function loadFile(file: File) {
            const buffer = await file.arrayBuffer()
            const content = uint8ArrayToBase64(new Uint8Array(buffer))
            dispatch(() => ({
                state: { state: 'loaded', file, content },
                description: "loaded file into block",
            }))
        }

        function clear() {
            dispatch(() => ({
                state: { state: 'init' },
                description: "cleared file block",
            }))
        }

        switch (state.state) {
            case 'init':
                return (
                    <LoadFileButton
                        className={loadFileButtonStyle}
                        onLoad={loadFile}
                    >
                        Load File
                    </LoadFileButton>
                )

            case 'loaded':
                return (
                    <div>
                        File <code className="px-1 bg-gray-100 rounded-sm">{state.file.name}</code> loaded {}
                        <span className="text-sm text-gray-700">({state.file.size} bytes)</span> {}
                        <LoadFileButton className={loadFileButtonStyle} onLoad={loadFile}>change</LoadFileButton>
                        <button
                            className="m-0.5 px-1 rounded border border-red-100 text-red-700 hover:bg-red-100"
                            onClick={clear}
                        >
                            clear
                        </button>
                    </div>
                )
        }
    },
    recompute(state, dispatch, env) {
        return { state, invalidated: false }
    },
    getResult(state) {
        switch (state.state) {
            case 'init': return null
            case 'loaded': return state.file
        }
    },
    fromJSON(json, dispatch, env) {
        return validatorSwitch<LoadFileState>(json,
            [is(null), () => ({ state: 'init' })],
            [string, textContent => {
                const uint8Array = new TextEncoder().encode(textContent)
                const content = uint8ArrayToBase64(uint8Array)
                return {
                    state: 'loaded',
                    file: new File([uint8Array], '<unknown>'),
                    content
                }
            }],
            [{ state: 'init' }, init => init],
            [{ state: 'loaded', content: string, filename: string }, ({ content, filename }) => {
                const uint8Array = new TextEncoder().encode(content)
                return {
                    state: 'loaded',
                    file: new File([uint8Array], filename),
                    content,
                }
            }],
            [
                {
                    state: 'loaded',
                    file: {
                        content: string,
                        name: string,
                        options: { type: string, lastModified: number },
                    },
                },
                ({
                    file: {
                        content,
                        name,
                        options: { type, lastModified },
                    }
                }) => {
                    const uint8Array = base64ToUint8Array(content)
                    return {
                        state: 'loaded',
                        file: new File([uint8Array], name, { type, lastModified }),
                        content,
                    }
                },
            ],
            [any, () => ({ state: 'init' })],
        )
    },
    toJSON(state) {
        switch (state.state) {
            case 'init':
                return { state: 'init' }

            case 'loaded':
                return {
                    state: 'loaded',
                    file: {
                        content: state.content,
                        name: state.file.name,
                        options: {
                            type: state.file.type,
                            lastModified: state.file.lastModified,
                        },
                    }
                }
        }
    }
})