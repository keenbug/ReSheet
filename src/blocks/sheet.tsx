import * as React from 'react'
import { Menu, Popover } from '@headlessui/react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import * as solidIcons from '@fortawesome/free-solid-svg-icons'

import { IconToggleButton, TextInput, classed } from '../ui/utils'
import * as block from '../logic/block'
import { Block } from '../logic/block'
import produce, { original } from 'immer'
import { ErrorBoundary } from '../ui/value'

interface SheetBlockLine<InnerBlockState> {
    readonly id: number
    readonly name: string
    readonly state: InnerBlockState
}


const lineDefaultName = (line: SheetBlockLine<unknown>) => '$' + line.id
const lineName = (line: SheetBlockLine<unknown>) => line.name.length > 0 ? line.name : lineDefaultName(line)

const nextFreeId = (lines: SheetBlockLine<unknown>[]) =>
    1 + lines
        .map(line => line.id)
        .reduce((a, b) => Math.max(a, b), -1)

const updateLineWithId = <Inner extends unknown>(
    lines: SheetBlockLine<Inner>[],
    id: number,
    update: (line: SheetBlockLine<Inner>) => SheetBlockLine<Inner>,
) =>
    lines.map(line => line.id === id ? update(line) : line)

const insertLineBefore = <Inner extends unknown>(
    lines: SheetBlockLine<Inner>[],
    id: number,
    newLine: SheetBlockLine<Inner>,
) =>
    lines.flatMap(line =>
        line.id === id ?
            [newLine, line]
        :
            [line]
    )

const insertLineAfter = <Inner extends unknown>(
    lines: SheetBlockLine<Inner>[],
    id: number,
    newLine: SheetBlockLine<Inner>,
) =>
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


export const updateLineBlock = produce<SheetBlockLine<unknown>[], [number, (inner: unknown) => unknown]>(
    (lines, id, action) => {
        const line = lines.find(line => line.id === id)
        line.state = action(original(line).state)
    }
)


export const setName = <Inner extends unknown>(lines: SheetBlockLine<Inner>[], id: number, name: string) =>
    updateLineWithId(lines, id, line => ({ ...line, name }))

export const insertBeforeCode = <Inner extends unknown>(lines: SheetBlockLine<Inner>[], id: number, innerBlock: Block<Inner>) =>
    insertLineBefore(lines, id, { id: nextFreeId(lines), name: '', state: innerBlock.init })

export const insertAfterCode = <Inner extends unknown>(lines: SheetBlockLine<Inner>[], id: number, innerBlock: Block<Inner>) =>
    insertLineAfter(lines, id, { id: nextFreeId(lines), name: '', state: innerBlock.init })

export const deleteCode = <Inner extends unknown>(lines: SheetBlockLine<Inner>[], id: number) =>
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

export const SheetBlock = <State extends unknown>(innerBlock: Block<State>) => block.create<SheetBlockLine<State>[]>({
    init: [{ id: 0, name: '', state: innerBlock.init }],
    view({ state, update, env }) {
        return <Sheet lines={state} update={update} innerBlock={innerBlock} env={env} />
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

export const Sheet = ({ lines, update, innerBlock, env }) => (
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
                        view: <SheetLine key={id} block={innerBlock} line={line} update={update} env={{ ...env, ...localEnv}} />,
                    }
                ]
            },
            [],
        )
            .map(line => line.view)
        }
    </React.Fragment>
)


export const SheetLine = ({ block, line, update, env }) => {
    const subupdate = action => update(state => updateLineBlock(state, line.id, action))
    return (
        <SheetLineContainer key={line.id}>
            <SheetUIToggles line={line} update={update} block={block} />
            <SheetLineContent>
                <AssignmentLine line={line} update={update} />
                <ErrorBoundary title="There was an error in the subblock">
                    {block.view({ state: line.state, update: subupdate, env })}
                </ErrorBoundary>
            </SheetLineContent>
        </SheetLineContainer>
    )
}


export const AssignmentLine = ({ line, update }) => {
    const onUpdateName = name => update(state => setName(state, line.id, name))
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

const MenuItemsStyled = classed<any>(Menu.Items)`
    flex flex-col
    bg-gray-100
    shadow-md
    rounded
    items-stretch
    w-max
    text-sm
    overflow-hidden
    z-10
    outline-none
    absolute top-0 -right-1 translate-x-full
`

const MenuButton = classed<any>('button')`
    text-left
    text-slate-800

    hover:bg-gray-200
    focus:bg-gray-300

    transition-colors

    outline-none
    h-7 px-2 space-x-1
    w-full
`

const SheetUIToggles = ({ line, update, block }) => {
    const onInsertBefore = () => update(state => insertBeforeCode(state, line.id, block))
    const onInsertAfter  = () => update(state => insertAfterCode(state, line.id, block))
    const onDelete       = () => update(state => deleteCode(state, line.id))

    const Button = ({ icon, label, ...props }) => (
        <Menu.Item>
            <MenuButton {...props}>
                <FontAwesomeIcon icon={icon} />
                <span>{label}</span>
            </MenuButton>
        </Menu.Item>
    )

    return (
        <div>
            <Menu as="div" className="relative"> 
                <Menu.Button className="px-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100">
                    <FontAwesomeIcon size="xs" icon={solidIcons.faGripVertical} />
                </Menu.Button>
                <MenuItemsStyled>
                    <Button onClick={onInsertBefore} icon={solidIcons.faChevronUp}   label="Insert before" />
                    <Button onClick={onInsertAfter}  icon={solidIcons.faChevronDown} label="Insert after"  />
                    <Button onClick={onDelete}       icon={solidIcons.faTrash}       label="Delete"        />
                </MenuItemsStyled>
            </Menu>
        </div>
    )
}
