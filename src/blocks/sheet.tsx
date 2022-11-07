import * as React from 'react'
import { Menu, Popover } from '@headlessui/react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import * as solidIcons from '@fortawesome/free-solid-svg-icons'

import { TextInput, classed } from '../ui/utils'
import * as block from '../logic/block'
import { BlockDesc } from '../logic/block'
import { ErrorBoundary, ValueInspector } from '../ui/value'


type SheetBlockState<InnerBlockState> =
    SheetBlockLine<InnerBlockState>[]

interface SheetBlockLine<InnerBlockState> {
    readonly id: number
    readonly name: string
    readonly isCollapsed: boolean
    readonly state: InnerBlockState
    readonly result: unknown
}


const lineDefaultName = (line: SheetBlockLine<unknown>) => '$' + line.id
const lineName = (line: SheetBlockLine<unknown>) => line.name.length > 0 ? line.name : lineDefaultName(line)

function lineToEnv<State>(
    line: SheetBlockLine<State>,
    innerBlock: BlockDesc<State>,
    env: block.Environment,
) {
    return {
        [lineName(line)]: line.result
    }
}

function nextFreeId(state: SheetBlockState<unknown>) {
    const highestId = state
        .map(line => line.id)
        .reduce((a, b) => Math.max(a, b), -1)

    return 1 + highestId
}

function updateLineWithId<Inner extends unknown>(
    lines: SheetBlockLine<Inner>[],
    id: number,
    update: (line: SheetBlockLine<Inner>) => SheetBlockLine<Inner>,
) {
    return lines.map(
        line =>
            line.id === id ?
                update(line)
            :
                line
    )
}

function insertLineBefore<Inner extends unknown>(
    lines: SheetBlockLine<Inner>[],
    id: number,
    newLine: SheetBlockLine<Inner>,
) {
    return lines.flatMap(line =>
        line.id === id ?
            [newLine, line]
        :
            [line]
    )
}

function insertLineAfter<Inner extends unknown>(
    lines: SheetBlockLine<Inner>[],
    id: number,
    newLine: SheetBlockLine<Inner>,
) {
    return lines.flatMap(line =>
        line.id === id ?
            [line, newLine]
        :
            [line]
    )
}

function recomputeSheetResults<State>(
    lines: SheetBlockState<State>,
    innerBlock: BlockDesc<State>,
    env: block.Environment,
) {
    const recomputedLines = block.mapWithEnv(
        lines,
        (line, localEnv) => {
            const result = innerBlock.getResult(line.state, localEnv)
            return {
                out: { ...line, result },
                env: { [lineName(line)]: result },
            }
        },
        env,
    )
    return recomputedLines
}

function getResult<State>(lines: SheetBlockState<State>) {
    return lines[lines.length - 1].result
}

/**************** Code Actions **************/


export function updateLineBlock<State>(
    lines: SheetBlockState<State>,
    id: number,
    action: (state: State) => State,
): SheetBlockState<State> {
    return lines.map(line =>
        line.id === id ?
            { ...line, state: action(line.state) }
        :
            line
    )
}


export const setName = <Inner extends unknown>(lines: SheetBlockLine<Inner>[], id: number, name: string) =>
    updateLineWithId(lines, id, line => ({ ...line, name }))

export function toggleCollapse<Inner>(state: SheetBlockState<Inner>, id: number) {
    return updateLineWithId(state, id, line => {
        return { ...line, isCollapsed: !line.isCollapsed }
    })
}

export const insertBeforeCode = <Inner extends unknown>(lines: SheetBlockLine<Inner>[], id: number, innerBlock: BlockDesc<Inner>) =>
    insertLineBefore(lines, id, {
        id: nextFreeId(lines),
        name: '',
        isCollapsed: false,
        state: innerBlock.init,
        result: null,
    })

export const insertAfterCode = <Inner extends unknown>(lines: SheetBlockLine<Inner>[], id: number, innerBlock: BlockDesc<Inner>) =>
    insertLineAfter(lines, id, {
        id: nextFreeId(lines),
        name: '',
        isCollapsed: false,
        state: innerBlock.init,
        result: null,
    })

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

export function SheetBlock<State extends unknown>(innerBlock: BlockDesc<State>) {
    return block.create<SheetBlockState<State>>({
        init: [{ id: 0, name: '', isCollapsed: false, state: innerBlock.init, result: null }],
        view({ state, update, env }) {
            function updateAndRecompute(action, env) {
                update(state => recomputeSheetResults(action(state), innerBlock, env))
            }
            return <Sheet lines={state} update={action => updateAndRecompute(action, env)} innerBlock={innerBlock} env={env} />
        },
        getResult(state, env) {
            return getResult(state)
        },
        fromJSON(json: any[], env) {
            return block.mapWithEnv(
                json,
                (jsonLine, localEnv) => {
                    const { id, name, isCollapsed = false, state } = jsonLine
                    const loadedState = innerBlock.fromJSON(state, localEnv)
                    const result = innerBlock.getResult(loadedState, localEnv)
                    const line: SheetBlockLine<State> = { id, name, isCollapsed, state: loadedState, result }
                    return {
                        out: line,
                        env: lineToEnv(line, innerBlock, localEnv)
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


export interface SheetProps<InnerState> {
    lines: SheetBlockLine<InnerState>[]
    update: block.BlockUpdater<SheetBlockState<InnerState>>
    innerBlock: BlockDesc<InnerState>
    env: block.Environment
}

export function Sheet<InnerState>({ lines, update, innerBlock, env }: SheetProps<InnerState>) {
    return (
        <React.Fragment>
            {block.mapWithEnv(
                lines,
                (line, localEnv) => {
                    return {
                        out: <SheetLine key={line.id} block={innerBlock} line={line} update={update} env={localEnv} />,
                        env: lineToEnv(line, innerBlock, localEnv),
                    }
                },
                env
            )}
        </React.Fragment>
    )
}


export const SheetLine = ({ block, line, update, env }) => {
    const subupdate = action => update(state => updateLineBlock(state, line.id, action))
    if (line.isCollapsed) {
        return (
            <SheetLineContainer key={line.id}>
                <SheetUIToggles line={line} update={update} block={block} />
                <SheetLineContent>
                    <AssignmentLine line={line} update={update}>
                        <ValueInspector value={line.result} expandLevel={0} />
                    </AssignmentLine>
                </SheetLineContent>
            </SheetLineContainer>
        )
    }
    else {
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
}



interface AssignmentLineProps<State> {
    line: SheetBlockLine<State>
    update: (action: (state: SheetBlockState<State>) => SheetBlockState<State>) => void
    children?: any
}

export function AssignmentLine<State>(props: AssignmentLineProps<State>) {
    const { line, update, children = null } = props
    const onUpdateName = name => update(state => setName(state, line.id, name))
    return (
        <div
            className={`
                self-stretch
                pr-2 -mb-1 mt-1
                text-slate-500 font-light text-xs
                truncate
                flex flex-row space-x-2 align-baseline
            `}
            >
            <div>
            <VarNameInput
                value={line.name}
                onUpdate={onUpdateName}
                placeholder={lineDefaultName(line)}
            />
            &nbsp;=</div>
            {children}
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
    h-7 px-1 space-x-1
    w-full
`

function SheetUIToggles({ line, update, block }) {
    const onToggleCollapse = () => update(state => toggleCollapse(state, line.id))
    const onInsertBefore   = () => update(state => insertBeforeCode(state, line.id, block))
    const onInsertAfter    = () => update(state => insertAfterCode(state, line.id, block))
    const onDelete         = () => update(state => deleteCode(state, line.id))

    const Button = ({ icon, label, ...props }) => (
        <Menu.Item>
            <MenuButton {...props}>
                <FontAwesomeIcon icon={icon} />
                <span>{label}</span>
            </MenuButton>
        </Menu.Item>
    )

    const collapseButton = (
        <Button
            onClick={onToggleCollapse}
            icon={line.isCollapsed ? solidIcons.faSquarePlus : solidIcons.faSquareMinus}
            label={line.isCollapsed ? "Expand" : "Collapse"}
            />
    )

    return (
        <div>
            <Menu as="div" className="relative"> 
                <Menu.Button className="px-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100">
                    <FontAwesomeIcon size="xs" icon={solidIcons.faGripVertical} />
                </Menu.Button>
                <MenuItemsStyled>
                    {collapseButton}
                    <Button onClick={onInsertBefore} icon={solidIcons.faChevronUp}   label="Insert before" />
                    <Button onClick={onInsertAfter}  icon={solidIcons.faChevronDown} label="Insert after"  />
                    <Button onClick={onDelete}       icon={solidIcons.faTrash}       label="Delete"        />
                </MenuItemsStyled>
            </Menu>
        </div>
    )
}
