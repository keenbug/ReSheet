import React from 'react'
import { ValueInspector } from './value'
import { EditableCode, highlightNothing } from './code-editor'
import { classed, LoadFileButton } from './ui'
import stdLibrary from './std-library'
import { computeExpr } from './compute'
import { createBlock, SimpleJSON } from './components'
import { FCO } from './fc-object'

export const InputBlock = FCO
    .addState({ text: "" })
    .addMethods({
        view({ block, setBlock }) {
            const onChange = event => {
                setBlock(block => block.update({ text: event.target.value }))
            }
            return <input type="text" value={block.text} onChange={onChange} />
        },
    })
    .combine(SimpleJSON('text'))
    .pipe(createBlock)

export const LoadFileButtonStyled = classed(LoadFileButton)`
    cursor-pointer
    p-1
    rounded
    font-gray-700
    bg-gray-100
    hover:bg-gray-200
`

export const LoadFileBlock = FCO
    .addState({ loaded: null })
    .addMethods({
        view({ setBlock }) {
            const setData = data =>
                setBlock(block => block.update({ loaded: data }))

            return (
                <LoadFileButtonStyled
                    onLoad={file => file.text().then(setData)}
                >
                    Load File
                </LoadFileButtonStyled>
            )
        }
    })
    .combine(SimpleJSON('loaded'))
    .pipe(createBlock)

export const TextBlock = (container = 'div') => FCO
    .addState({ code: '', result: null })
    .addMethods({
        view({ block, setBlock }) {
            const runText = code =>
                computeExpr(
                    `<$TextBlockContainer>${code}</$TextBlockContainer>`,
                    { ...stdLibrary, $TextBlockContainer: container },
                )
            const setCode = code => {
                setBlock(block => block.update({ code, result: runText(code) }))
            }
            return (
                <React.Fragment>
                <EditableCode
                    code={block.code}
                    onUpdate={setCode}
                    highlight={highlightNothing}
                />
                <ValueInspector value={block.result} />
                </React.Fragment>
            )
        }
    })
    .combine(SimpleJSON('code'))
    .pipe(createBlock)