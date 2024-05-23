import * as React from 'react'

import * as Block from '@resheet/core/block'

import { any, is, number, string, validatorSwitch } from '@resheet/util/validate'
import { base64ToUint8Array, uint8ArrayToBase64 } from '@resheet/util'

import { LoadFileButton, saveFile } from './utils/ui'


export type LoadFileState =
    | { state: 'init' }
    | { state: 'loaded', file: File, content: string }

export const LoadFile = Block.create<LoadFileState>({
    init: { state: 'init' },
    view({ state, dispatch }, ref) {
        const loadRef = React.useRef<HTMLButtonElement>()

        React.useImperativeHandle(ref, () => ({
            focus(options) {
                loadRef.current?.focus(options)
            }
        }), [loadRef])

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

        function downloadFile(file: File) {
            saveFile(file.name, file)
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
                        ref={loadRef}
                        className={loadFileButtonStyle}
                        onLoad={loadFile}
                    >
                        Load File
                    </LoadFileButton>
                )

            case 'loaded':
                return (
                    <div>
                        File {}
                        <button
                            className="px-1 bg-gray-100 rounded-sm"
                            onClick={() => downloadFile(state.file)}
                        >
                            {state.file.name}
                        </button> {}
                        loaded {}
                        <span className="text-sm text-gray-700">({state.file.size} bytes)</span> {}
                        <LoadFileButton ref={loadRef} className={loadFileButtonStyle} onLoad={loadFile}>change</LoadFileButton>
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