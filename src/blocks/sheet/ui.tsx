
import * as React from 'react'
import { Menu } from '@headlessui/react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import * as solidIcons from '@fortawesome/free-solid-svg-icons'

import { TextInput } from '../../ui/utils'
import * as block from '../../logic/block'
import { BlockDesc } from '../../logic/block'
import { ErrorBoundary, ValueInspector } from '../../ui/value'
import { SheetBlockState, SheetBlockLine } from './model'
import * as Model from './model'


/**************** Code Actions **************/


export function updateLineBlock<State>(
    lines: SheetBlockState<State>,
    id: number,
    action: (state: State) => State,
    innerBlock: BlockDesc<State>,
    env: block.Environment,
): SheetBlockState<State> {
    return Model.recomputeSheetResults(
        lines.map(line =>
            line.id === id ?
                { ...line, state: action(line.state) }
            :
                line
        ),
        innerBlock,
        env,
        id,
    )
}


export const setName = <Inner extends unknown>(lines: SheetBlockLine<Inner>[], id: number, name: string) =>
    Model.updateLineWithId(lines, id, line => ({ ...line, name }))

export function toggleCollapse<Inner>(state: SheetBlockState<Inner>, id: number) {
    return Model.updateLineWithId(state, id, line => {
        return { ...line, isCollapsed: !line.isCollapsed }
    })
}

export const insertBeforeCode = <Inner extends unknown>(lines: SheetBlockLine<Inner>[], id: number, innerBlock: BlockDesc<Inner>) =>
    Model.insertLineBefore(lines, id, {
        id: Model.nextFreeId(lines),
        name: '',
        isCollapsed: false,
        state: innerBlock.init,
        result: null,
    })

export const insertAfterCode = <Inner extends unknown>(lines: SheetBlockLine<Inner>[], id: number, innerBlock: BlockDesc<Inner>) =>
    Model.insertLineAfter(lines, id, {
        id: Model.nextFreeId(lines),
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
                        env: Model.lineToEnv(line),
                    }
                },
                env
            )}
        </React.Fragment>
    )
}


export const SheetLine = ({ block, line, update, env }) => {
    const subupdate = action => update(state => updateLineBlock(state, line.id, action, block, env))

    return (
        <div className="flex flex-row space-x-2">
            <MenuPopover line={line} update={update} block={block} />
            <div className="flex flex-col space-y-1 flex-1">
                {line.isCollapsed ?
                    <AssignmentLine line={line} update={update}>
                        <ValueInspector value={line.result} expandLevel={0} />
                    </AssignmentLine>
                :
                    <>
                        <AssignmentLine line={line} update={update} />
                        <ErrorBoundary title="There was an error in the subblock">
                            {block.view({ state: line.state, update: subupdate, env })}
                        </ErrorBoundary>
                    </>
                }
            </div>
        </div>
    )
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
                <TextInput
                    className={`
                        hover:bg-gray-200 hover:text-slate-700
                        focus:bg-gray-200 focus:text-slate-700
                        outline-none
                        p-0.5 -ml-0.5
                        rounded
                    `}
                    value={line.name}
                    onUpdate={onUpdateName}
                    placeholder={Model.lineDefaultName(line)}
                />
                &nbsp;=
            </div>
            {children}
        </div>
    )
}




/****************** Menu Popover ******************/

function MenuPopover({ line, update, block }) {
    const onToggleCollapse = () => update(state => toggleCollapse(state, line.id))
    const onInsertBefore   = () => update(state => insertBeforeCode(state, line.id, block))
    const onInsertAfter    = () => update(state => insertAfterCode(state, line.id, block))
    const onDelete         = () => update(state => deleteCode(state, line.id))

    function Button({ icon, label, ...props }) {
        return (
            <Menu.Item>
                <button
                    className={`
                        text-left text-slate-800
                        hover:bg-gray-200 focus:bg-gray-300
                        transition-colors
                        outline-none
                        h-7 px-1 space-x-1 w-full
                    `}
                    {...props}
                    >
                    <FontAwesomeIcon icon={icon} />
                    <span>{label}</span>
                </button>
            </Menu.Item>
        )
    }

    return (
        <div>
            <Menu as="div" className="relative"> 
                <Menu.Button className="px-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100">
                    <FontAwesomeIcon size="xs" icon={solidIcons.faGripVertical} />
                </Menu.Button>
                <Menu.Items
                    className={`
                        flex flex-col
                        bg-gray-100 shadow-md
                        rounded items-stretch
                        w-max text-sm
                        overflow-hidden outline-none
                        absolute top-0 -right-1 translate-x-full z-10
                    `}
                    >
                    <Button
                        onClick={onToggleCollapse}
                        icon={line.isCollapsed ? solidIcons.faSquarePlus : solidIcons.faSquareMinus}
                        label={line.isCollapsed ? "Expand" : "Collapse"}
                        />
                    <Button onClick={onInsertBefore} icon={solidIcons.faChevronUp}   label="Insert before" />
                    <Button onClick={onInsertAfter}  icon={solidIcons.faChevronDown} label="Insert after"  />
                    <Button onClick={onDelete}       icon={solidIcons.faTrash}       label="Delete"        />
                </Menu.Items>
            </Menu>
        </div>
    )
}
