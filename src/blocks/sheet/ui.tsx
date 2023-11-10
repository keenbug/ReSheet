
import * as React from 'react'
import { Menu } from '@headlessui/react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import * as solidIcons from '@fortawesome/free-solid-svg-icons'

import { TextInput } from '../../ui/utils'
import * as block from '../../logic/block'
import { Block, BlockUpdater, Environment } from '../../logic/block'
import { ErrorBoundary, ValueInspector } from '../../ui/value'
import { SheetBlockState, SheetBlockLine } from './model'
import * as Model from './model'


/**************** Code Actions **************/

export const setName = <Inner extends unknown>(state: SheetBlockState<Inner>, id: number, name: string) =>
    Model.updateLineWithId(state, id, line => ({ ...line, name }))

export function toggleCollapse<Inner>(state: SheetBlockState<Inner>, id: number) {
    return Model.updateLineWithId(state, id, line => {
        return { ...line, isCollapsed: !line.isCollapsed }
    })
}

export const insertBeforeCode = <Inner extends unknown>(state: SheetBlockState<Inner>, id: number, innerBlock: Block<Inner>) =>
    Model.insertLineBefore(state, id, {
        id: Model.nextFreeId(state),
        name: '',
        isCollapsed: false,
        state: innerBlock.init,
        result: null,
    })

export const insertAfterCode = <Inner extends unknown>(state: SheetBlockState<Inner>, id: number, innerBlock: Block<Inner>) =>
    Model.insertLineAfter(state, id, {
        id: Model.nextFreeId(state),
        name: '',
        isCollapsed: false,
        state: innerBlock.init,
        result: null,
    })

export function deleteCode<Inner extends unknown>(state: SheetBlockState<Inner>, id: number) {
    return {
        ...state,
        lines: state.lines.length > 1 ?
            state.lines.filter(line => line.id !== id)
        :
            state.lines
    }
}




/**************** UI *****************/


export interface SheetProps<InnerState> {
    state: SheetBlockState<InnerState>
    update: BlockUpdater<SheetBlockState<InnerState>>
    innerBlock: Block<InnerState>
    env: Environment
}

export const Sheet = React.forwardRef(
    function Sheet<InnerState>(
        { state, update, innerBlock, env }: SheetProps<InnerState>,
        ref
    ) {
        const [changeFocusableElement, changeFocus, focusableElements] = useFocusList(state.lines)
        React.useImperativeHandle(ref, () => focusableElements.current.get(state.lines[0].id), [state])

        return (
            <div>
                {block.mapWithEnv(
                    state.lines,
                    (line, localEnv) => {
                        return {
                            out: (
                                <SheetLine
                                    ref={changeFocusableElement(line.id)}
                                    key={line.id}
                                    block={innerBlock}
                                    line={line}
                                    update={update}
                                    env={localEnv}
                                    onChangeFocus={changeFocus}
                                    />
                            ),
                            env: Model.lineToEnv(line),
                        }
                    },
                    env
                )}
            </div>
        )
    }
)

export interface SheetLineProps<InnerState> {
    line: SheetBlockLine<InnerState>
    update: BlockUpdater<SheetBlockState<InnerState>>
    block: Block<InnerState>
    env: Environment

    onChangeFocus: ChangeFocusHandlers
}

export const SheetLine = React.forwardRef(
    function SheetLine(
        { block, line, update, env, onChangeFocus }: SheetLineProps<unknown>,
        ref: React.Ref<HTMLDivElement>
    ) {
        const containerRef = React.useRef<HTMLDivElement | null>(null)
        React.useImperativeHandle(ref, () => containerRef.current)
        const varInputRef = React.useRef(null)
        const innerBlockRef = React.useRef(null)

        const subupdate = action => update(state => Model.updateLineBlock(state, line.id, action, block, env))

        function onContainerKeyDown(event: React.KeyboardEvent) {
            switch (event.key) {
                case "ArrowUp":
                case "k":
                    if (event.currentTarget === event.target) {
                        onChangeFocus.UP()
                        event.stopPropagation()
                        event.preventDefault()
                    }
                   return

                case "ArrowDown":
                case "j":
                    if (event.currentTarget === event.target) {
                        onChangeFocus.DOWN()
                        event.stopPropagation()
                        event.preventDefault()
                    }
                    return

                case "Enter":
                    if (event.currentTarget === event.target) {
                        varInputRef.current?.focus()
                        event.stopPropagation()
                        event.preventDefault()
                    }
                    return

                case "Escape":
                    if (event.currentTarget !== event.target) {
                        (event.target as any).blur?.()
                        containerRef.current?.focus()
                        event.stopPropagation()
                        event.preventDefault()
                    }
                    return
            }
        }

        function onInputKeyDown(event: React.KeyboardEvent) {
            switch (event.key) {
                case "ArrowDown":
                case "Enter":
                    if (line.isCollapsed) {
                        update(state => toggleCollapse(state, line.id))
                    }
                    else {
                        innerBlockRef.current?.focus()
                    }
                    event.stopPropagation()
                    event.preventDefault()
                    return
            }
        }

        return (
            <div
                ref={containerRef}
                className={`
                    flex flex-row space-x-2
                    focus:ring-0
                    focus:bg-gray-100
                `}
                tabIndex={-1}
                onKeyDown={onContainerKeyDown}
                >
                <MenuPopover line={line} update={update} block={block} />
                <div className="flex flex-col space-y-1 flex-1">
                    {line.isCollapsed ?
                        <AssignmentLine
                            ref={varInputRef}
                            line={line}
                            update={update}
                            onKeyDown={onInputKeyDown}
                            >
                            <ValueInspector value={line.result} expandLevel={0} />
                        </AssignmentLine>
                    :
                        <>
                            <AssignmentLine
                                ref={varInputRef}
                                line={line}
                                update={update}
                                onKeyDown={onInputKeyDown}
                                />
                            <ErrorBoundary title="There was an error in the subblock">
                                {block.view({ ref: innerBlockRef, state: line.state, update: subupdate, env })}
                            </ErrorBoundary>
                        </>
                    }
                </div>
            </div>
        )
    }
)


interface AssignmentLineProps<State> extends React.HTMLProps<HTMLElement> {
    line: SheetBlockLine<State>
    update: (action: (state: SheetBlockState<State>) => SheetBlockState<State>) => void
    children?: any
}

export const AssignmentLine = React.forwardRef(
    function AssignmentLine<State>(props: AssignmentLineProps<State>, ref: React.Ref<HTMLElement>) {
        const { line, update, children = null, ...inputProps } = props
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
                        ref={ref}
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
                        {...inputProps}
                    />
                    &nbsp;=
                </div>
                {children}
            </div>
        )
    }
)




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




/****************** Focus Utility Hook ******************/

interface ChangeFocusHandlers {
    UP(): void
    DOWN(): void
}

type FocusElementRef<Id> = (id: Id) => (element: HTMLElement) => void

function useFocusList<Id>(lines: { id: Id }[]): [FocusElementRef<Id>, ChangeFocusHandlers, { current: Map<Id, HTMLElement> }] {
    const focusableElements = React.useRef(new Map<Id, HTMLElement>())

    const changeFocusableElement = (id: Id) => (element: HTMLElement) => {
        if (element === null) {
            focusableElements.current.delete(id)
        }
        focusableElements.current.set(id, element)
    }

    function getFocused() {
        if (!document.activeElement) {
            return null
        }
        const focusedLine = lines.find(line =>
            focusableElements.current.get(line.id) === document.activeElement
        )
        return !!focusedLine ? focusedLine.id : null
    }

    const changeFocus: ChangeFocusHandlers = {
        DOWN() {
            if (lines.length === 0) { return }
            const focusedId = getFocused()
            if (focusedId === null) {
                const lastId = lines[lines.length - 1].id
                focusableElements.current.get(lastId)?.focus()
                return
            }

            const focusedIndex = lines.findIndex(line => line.id === focusedId)
            const nextIndex = Math.min(lines.length - 1, focusedIndex + 1)
            const nextId = lines[nextIndex].id
            focusableElements.current.get(nextId)?.focus()
        },

        UP() {
            if (lines.length === 0) { return }
            const focusedId = getFocused()
            if (focusedId === null) {
                const firstId = lines[0].id
                focusableElements.current.get(firstId)?.focus()
                return
            }

            const focusedIndex = lines.findIndex(line => line.id === focusedId)
            const prevIndex = Math.max(0, focusedIndex - 1)
            const prevId = lines[prevIndex].id
            focusableElements.current.get(prevId)?.focus()
        },
    }

    return [changeFocusableElement, changeFocus, focusableElements]
}
