import * as React from 'react'
import { Popover } from '@headlessui/react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import * as solidIcons from '@fortawesome/free-solid-svg-icons'

import { IconToggleButton, TextInput, classed } from '../ui/utils'
import * as block from '../logic/block'


const lineDefaultName = line => '$' + line.id
const lineName = line => line.name.length > 0 ? line.name : lineDefaultName(line)

const nextFreeId = lines =>
    1 + lines
        .map(line => line.id)
        .reduce((a, b) => Math.max(a, b), -1)

const updateLineWithId = (lines, id, update) =>
    lines.map(line => line.id === id ? update(line) : line)

const insertLineBefore = (lines, id, newLine) =>
    lines.flatMap(line =>
        line.id === id ?
            [newLine, line]
        :
            [line]
    )

const insertLineAfter = (lines, id, newLine) =>
    lines.flatMap(line =>
        line.id === id ?
            [line, newLine]
        :
            [line]
    )

const resultLinesToEnv = resultLines =>
    Object.fromEntries(
        resultLines.map(line => [lineName(line), line.result])
    )


/**************** Code Actions **************/


export const updateLineBlock = (lines, id, update) =>
    updateLineWithId(lines, id, line => ({ ...line, state: update(line.state) }))

export const setName = (lines, id, name) =>
    updateLineWithId(lines, id, line => ({ ...line, name }))

export const insertBeforeCode = (lines, id, innerBlock) =>
    insertLineBefore(lines, id, { id: nextFreeId(lines), name: '', state: innerBlock.init })

export const insertAfterCode = (lines, id, innerBlock) =>
    insertLineAfter(lines, id, { id: nextFreeId(lines), name: '', state: innerBlock.init })

export const deleteCode = (lines, id) =>
    lines.length > 1 ?
        lines.filter(line => line.id !== id)
    :
        lines




/**************** UI *****************/


const SheetLineContainer = classed<any>('div')`flex flex-row space-x-2`
const SheetLineContent = classed<any>('div')`flex flex-col space-y-1 flex-1`

const VarNameInput = classed<any>(TextInput)`
    hover:bg-gray-200 hover:text-slate-700
    focus:bg-gray-200 focus:text-slate-700
    outline-none
    p-0.5 -ml-0.5
    rounded
`

interface SheetBlockLine<InnerBlockState> {
    id: number
    name: string
    state: InnerBlockState
}

const getResultLines = (lines, innerBlock, env) =>
    lines.reduce(
        (previousResultLines, { id, name, state }) =>
            [
                ...previousResultLines,
                {
                    id, name,
                    result: innerBlock.getResult(state, {
                        ...env,
                        ...resultLinesToEnv(previousResultLines),
                    })
                },
            ]
        ,
        []
    )

type SheetBlockState = Array<SheetBlockLine<unknown>>

export const SheetBlock = innerBlock => block.create<SheetBlockState>({
    init: [{ id: 0, name: '', state: innerBlock.init }],
    view({ state, setState, env }) {
        const dispatch = (action, ...args) => {
            setState(lines => action(lines, ...args))
        }
        return <Sheet lines={state} dispatch={dispatch} innerBlock={innerBlock} env={env} />
    },
    getResult(state, env) {
        const resultLines = getResultLines(state, innerBlock, env)
        return resultLines[resultLines.length - 1].result
    },
    fromJSON(json, env) {
        if (Array.isArray(json)) {
            return json
                    .reduce(
                        (prevLines, { id, name, state}) => {
                            const localEnv = { ...env, ...resultLinesToEnv(prevLines) }
                            const loadedState = innerBlock.fromJSON(state, localEnv)
                            const result = innerBlock.getResult(loadedState, localEnv)
                            return [
                                ...prevLines,
                                { id, name, state: loadedState, result }
                            ]
                        },
                        []
                    )
                    .map(({ id, name, state }) => ({ id, name, state }))
        }
        else {
            return [{ id: 0, name: '', state: innerBlock.init }]
        }
    },
    toJSON(lines) {
        return lines.map(({ id, name, state }) => ({ id, name, state: innerBlock.toJSON(state) }))
    },
})

export const Sheet = ({ lines, dispatch, innerBlock, env }) => (
    <React.Fragment>
        {lines.reduce(
            (previousLines, line) => {
                const { id, name, state } = line
                const localEnv = resultLinesToEnv(previousLines)
                return [
                    ...previousLines,
                    {
                        id, name,
                        result: innerBlock.getResult(state, { ...env, ...localEnv }),
                        view: <SheetLine key={id} block={innerBlock} line={line} dispatch={dispatch} env={{ ...env, ...localEnv}} />,
                    }
                ]
            },
            [],
        )
            .map(line => line.view)
        }
    </React.Fragment>
)


export const SheetLine = ({ block, line, dispatch, env }) => {
    const onUpdateBlock = update => dispatch(updateLineBlock, line.id, update)
    return (
        <SheetLineContainer key={line.id}>
            <SheetUIToggles line={line} dispatch={dispatch} block={block} />
            <SheetLineContent>
                <AssignmentLine line={line} dispatch={dispatch} />
                {block.view({ state: line.state, setState: onUpdateBlock, env })}
            </SheetLineContent>
        </SheetLineContainer>
    )
}


export const AssignmentLine = ({ line, dispatch }) => {
    const onUpdateName = name => dispatch(setName, line.id, name)
    return (
        <div className="self-stretch pr-2 -mb-1 text-slate-500 font-light text-xs">
            <VarNameInput
                value={line.name}
                onUpdate={onUpdateName}
                placeholder={lineDefaultName(line)}
            />
            &nbsp;=
        </div>
    )
}




/****************** REPL Popover ******************/

const PopoverPanelStyled = classed<any>(Popover.Panel)`
    flex flex-col
    bg-gray-100
    shadow
    rounded
    items-stretch
    w-max
    text-sm
    overflow-hidden
    z-10
    outline-none
`

const SheetUIToggles = ({ line, dispatch, block }) => {
    const onInsertBefore = () => dispatch(insertBeforeCode, line.id, block)
    const onInsertAfter  = () => dispatch(insertAfterCode,  line.id, block)
    const onDelete       = () => dispatch(deleteCode,       line.id)

    const Button = props => (
        <IconToggleButton className="w-full" isActive={true} {...props} />
    )

    const Menu = () => (
        <PopoverPanelStyled className="absolute -right-1 translate-x-full">
            <Button onUpdate={onInsertBefore} icon={solidIcons.faChevronUp}   label="Insert before" />
            <Button onUpdate={onInsertAfter}  icon={solidIcons.faChevronDown} label="Insert after"  />
            <Button onUpdate={onDelete}       icon={solidIcons.faTrash}       label="Delete"        />
        </PopoverPanelStyled>
    )

    return (
        <div>
            <Popover className="relative">
                <Menu />
                <Popover.Button className="px-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100">
                    <FontAwesomeIcon size="xs" icon={solidIcons.faGripVertical} />
                </Popover.Button>
            </Popover>
        </div>
    )
}
