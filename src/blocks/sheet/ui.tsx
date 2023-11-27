
import * as React from 'react'
import { Menu } from '@headlessui/react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import * as solidIcons from '@fortawesome/free-solid-svg-icons'

import { TextInput, findScrollableAncestor, getFullKey } from '../../ui/utils'
import * as block from '../../block'
import { Block, BlockUpdater, BlockRef, Environment } from '../../block'
import { ErrorBoundary, ValueInspector } from '../../ui/value'
import { SheetBlockState, SheetBlockLine } from './model'
import * as Model from './model'
import { EffectfulUpdater, useRefMap, useEffectfulUpdate } from '../../ui/hooks'
import { clampTo } from '../../utils'


/**************** Code Actions **************/


function findFocused(refMap: Map<number, SheetLineRef>) {
    if (!document.activeElement) {
        return undefined
    }
    return [...refMap.entries()].find(([id, ref]) => ref.isFocused())
}

function findRelativeTo<Id, Line extends { id: Id }>(lines: Line[], id: Id, relativeIndex: number): Line | null {
    if (lines.length === 0) { return null }
    const index = lines.findIndex(line => line.id === id)
    if (index < 0) { return null }
    const newIndex = clampTo(0, lines.length, index + relativeIndex)
    return lines[newIndex]
}


type FocusTarget = 'line' | 'var' | 'inner'

function focusLineRef(ref: SheetLineRef, target: FocusTarget) {
    switch (target) {
        case 'line':
            ref.focus()
            return

        case 'var':
            ref.focusVar()
            return

        case 'inner':
            ref.focusInner()
            return
    }
}

type Actions<Inner> = ReturnType<typeof ACTIONS<Inner>>

function ACTIONS<Inner extends unknown>(
    update: EffectfulUpdater<SheetBlockState<Inner>>,
    container: React.MutableRefObject<HTMLElement>,
    refMap: Map<number, SheetLineRef>,
    innerBlock: Block<Inner>,
) {
    function effectlessUpdate(action: (state: SheetBlockState<Inner>) => SheetBlockState<Inner>) {
        update(state => ({ state: action(state) }))
    }

    return {
        scrollUp(fraction: number) {
            update(() => ({
                effects: [
                    () => {
                        const scrollableContainer = findScrollableAncestor(container.current)
                        if (scrollableContainer) {
                            scrollableContainer.scrollBy({
                                top: -fraction * scrollableContainer.clientHeight,
                                behavior: 'smooth',
                            });
                        }
                    },
                ],
            }));
        },
    
        scrollDown(fraction: number) {
            update(() => ({
                effects: [
                    () => {
                        const scrollableContainer = findScrollableAncestor(container.current)
                        if (scrollableContainer) {
                            scrollableContainer.scrollBy({
                                top: fraction * scrollableContainer.clientHeight,
                                behavior: 'smooth',
                            });
                        }
                    },
                ],
            }));
        },
    
        focusUp() {
            update(state => ({
                effects: [
                    () => {
                        const focused = findFocused(refMap);
                        if (focused === undefined) {
                            refMap.get(state.lines[0].id)?.focus()
                        }
                        else {
                            const prevId = findRelativeTo(state.lines, focused[0], -1)?.id
                            refMap.get(prevId)?.focus()
                        }
                    },
                ],
            }));
        },
    
        focusDown() {
            update(state => ({
                effects: [
                    () => {
                        const focused = findFocused(refMap)
                        if (focused === undefined) {
                            refMap.get(state.lines[state.lines.length - 1].id)?.focus()
                        }
                        else {
                            const nextId = findRelativeTo(state.lines, focused[0], 1)?.id
                            refMap.get(nextId)?.focus()
                        }
                    },
                ],
            }))
        },
    
        setName(id: number, name: string) {
            update(state => ({
                state: Model.updateLineWithId(state, id, line => ({ ...line, name })),
            }));
        },
    
        switchCollapse(id: number) {
            update(state => ({
                state: Model.updateLineWithId(state, id, line => ({
                    ...line,
                    visibility: Model.nextLineVisibility(line.visibility),
                })),
                effects: [
                    () => {
                        const line = refMap.get(id)
                        if (line && !line.containsFocus()) {
                            line.focus();
                        }
                    },
                ],
            }))
        },
    
        updateInner(
            id: number,
            action: (state: Inner) => Inner,
            innerBlock: Block<Inner>,
            env: Environment
        ) {
            effectlessUpdate(state =>
                Model.updateLineBlock(state, id, action, innerBlock, env, effectlessUpdate)
            )
        },
    
        insertBeforeCode(id: number, innerBlock: Block<Inner>, focusTarget: FocusTarget = 'line') {
            update(state => {
                const newId = Model.nextFreeId(state);
                return {
                    state: Model.insertLineBefore(state, id, {
                        id: newId,
                        name: '',
                        visibility: Model.VISIBILITY_STATES[0],
                        state: innerBlock.init,
                        result: null,
                    }),
                    effects: [() => focusLineRef(refMap.get(newId), focusTarget)],
                }
            })
        },
    
        insertAfterCode(id: number, innerBlock: Block<Inner>, focusTarget: FocusTarget = 'line') {
            update(state => {
                const newId = Model.nextFreeId(state)
                return {
                    state: Model.insertLineAfter(state, id, {
                        id: newId,
                        name: '',
                        visibility: Model.VISIBILITY_STATES[0],
                        state: innerBlock.init,
                        result: null,
                    }),
                    effects: [() => focusLineRef(refMap.get(newId), focusTarget)],
                }
            })
        },
    
        deleteCode(id: number) {
            update(state => {
                if (state.lines.length <= 1) {
                    return {
                        state: Model.init(innerBlock.init),
                    }
                }
    
                const idIndex = state.lines.findIndex(line => line.id === id);
                const linesWithoutId = state.lines.filter(line => line.id !== id);
                const nextFocusIndex = Math.max(0, Math.min(linesWithoutId.length - 1, idIndex - 1));
                const nextFocusId = linesWithoutId[nextFocusIndex].id;
    
                return {
                    state: { ...state, lines: linesWithoutId },
                    effects: [() => refMap.get(nextFocusId)?.focus()],
                }
            })
        },
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
        ref: React.Ref<BlockRef>
    ) {
        const [setLineRef, refMap] = useRefMap<number, SheetLineRef>()
        const containerRef = React.useRef<HTMLDivElement>()
        const updateWithEffect = useEffectfulUpdate(update)
        React.useImperativeHandle(
            ref,
            () => ({
                focus() {
                    refMap
                        .get(state.lines[0].id)
                        .focus()
                }
            }),
            [state]
        )

        const actions = ACTIONS(updateWithEffect, containerRef, refMap, innerBlock)

        return (
            <div ref={containerRef} className="pb-[80vh]">
                {block.mapWithEnv(
                    state.lines,
                    (line, localEnv) => {
                        return {
                            out: (
                                <SheetLine
                                    ref={setLineRef(line.id)}
                                    key={line.id}
                                    line={line}
                                    actions={actions}
                                    block={innerBlock}
                                    env={localEnv}
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
    actions: Actions<InnerState>
    block: Block<InnerState>
    env: Environment
}

export interface SheetLineRef {
    isFocused(): boolean
    containsFocus(): boolean
    focus(): void
    focusVar(): void
    focusInner(): void
}

export const SheetLine = React.forwardRef(
    function SheetLine(
        { block, line, env, actions }: SheetLineProps<unknown>,
        ref: React.Ref<SheetLineRef>
    ) {
        const containerRef = React.useRef<HTMLDivElement>()
        const varInputRef = React.useRef<HTMLElement>()
        const innerBlockRef = React.useRef<BlockRef>()
        const resultRef = React.useRef<HTMLElement>()

        React.useImperativeHandle(
            ref,
            () => ({
                isFocused() {
                    return !!containerRef.current && document.activeElement === containerRef.current
                },
                containsFocus() {
                    return !!containerRef.current && containerRef.current.contains(document.activeElement)
                },
                focus() {
                    containerRef.current?.scrollIntoView({
                        block: 'nearest',
                        behavior: 'smooth',
                    })
                    containerRef.current?.focus({
                        preventScroll: true
                    })
                },
                focusVar() {
                    varInputRef.current?.focus()
                },
                focusInner() {
                    innerBlockRef.current?.focus()
                }
            })
        )

        const subupdate = action => actions.updateInner(line.id, action, block, env)

        function onContainerKeyDown(event: React.KeyboardEvent) {
            switch (getFullKey(event)) {
                case "C-ArrowUp":
                case "C-K":
                    if (event.currentTarget === event.target) {
                        actions.scrollUp(0.25)
                        event.stopPropagation()
                        event.preventDefault()
                    }
                   return

                case "C-ArrowDown":
                case "C-J":
                    if (event.currentTarget === event.target) {
                        actions.scrollDown(0.25)
                        event.stopPropagation()
                        event.preventDefault()
                    }
                    return

                case "C-Shift-ArrowUp":
                case "C-Shift-K":
                    if (event.currentTarget === event.target) {
                        actions.scrollUp(0.1)
                        event.stopPropagation()
                        event.preventDefault()
                    }
                   return

                case "C-Shift-ArrowDown":
                case "C-Shift-J":
                    if (event.currentTarget === event.target) {
                        actions.scrollDown(0.1)
                        event.stopPropagation()
                        event.preventDefault()
                    }
                    return

                case "ArrowUp":
                case "K":
                    if (event.currentTarget === event.target) {
                        actions.focusUp()
                        event.stopPropagation()
                        event.preventDefault()
                    }
                   return

                case "ArrowDown":
                case "J":
                    if (event.currentTarget === event.target) {
                        actions.focusDown()
                        event.stopPropagation()
                        event.preventDefault()
                    }
                    return

                case "Enter":
                    if (event.currentTarget === event.target) {
                        if (line.visibility.name) {
                            varInputRef.current?.focus()
                        }
                        else if (line.visibility.block) {
                            innerBlockRef.current?.focus()
                        }
                        else if (line.visibility.result) {
                            resultRef.current?.focus()
                        }
                        event.stopPropagation()
                        event.preventDefault()
                    }
                    return

                case "Escape":
                    if (event.currentTarget !== event.target && document.activeElement !== containerRef.current) {
                        if (event.target instanceof HTMLElement) { event.target.blur() }
                        containerRef.current?.focus()
                        event.stopPropagation()
                        event.preventDefault()
                    }
                    return

                case "C-Enter":
                    if (event.currentTarget !== event.target) {
                        actions.insertAfterCode(line.id, block, 'inner')
                        event.stopPropagation()
                        event.preventDefault()
                        return
                    }
                    // fall-through
                case "O":
                    if (event.currentTarget === event.target) {
                        actions.insertAfterCode(line.id, block)
                        event.stopPropagation()
                        event.preventDefault()
                    }
                    return

                case "C-Shift-Enter":
                    if (event.currentTarget !== event.target) {
                        if (event.target === varInputRef.current) {
                            actions.insertBeforeCode(line.id, block)
                        }
                        else {
                            // The focus has to be in `innerBlock`
                            varInputRef.current?.focus()
                        }
                        event.stopPropagation()
                        event.preventDefault()
                        return
                    }
                    // fall-through
                case "Shift-O":
                    if (event.currentTarget === event.target) {
                        actions.insertBeforeCode(line.id, block)
                        event.stopPropagation()
                        event.preventDefault()
                    }
                    return

                case "C-Backspace":
                case "Backspace":
                    if (event.currentTarget === event.target) {
                        actions.deleteCode(line.id)
                        event.stopPropagation()
                        event.preventDefault()
                    }
                    return

                case "C-M":
                    actions.switchCollapse(line.id)
                    event.stopPropagation()
                    event.preventDefault()
                    return
            }
        }

        function onInputKeyDown(event: React.KeyboardEvent) {
            switch (getFullKey(event)) {
                case "ArrowDown":
                case "Enter":
                    if (line.visibility.block) {
                        innerBlockRef.current?.focus()
                    } else if (line.visibility.name) {
                        varInputRef.current?.focus()
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
                    group
                `}
                tabIndex={-1}
                onKeyDown={onContainerKeyDown}
                >
                <MenuPopover line={line} actions={actions} block={block} />
                <div className="flex flex-col space-y-1 flex-1">
                    {line.visibility.name &&
                        <AssignmentLine
                            ref={varInputRef}
                            line={line}
                            actions={actions}
                            onKeyDown={onInputKeyDown}
                            />
                    }
                    {line.visibility.block &&
                        <ErrorBoundary title="There was an error in the subblock">
                            {block.view({ ref: innerBlockRef, state: line.state, update: subupdate, env })}
                        </ErrorBoundary>
                    }
                    {line.visibility.result &&
                        <ValueInspector ref={resultRef} value={line.result} expandLevel={0} />
                    }
                </div>
            </div>
        )
    }
)


interface AssignmentLineProps<State> extends React.HTMLProps<HTMLElement> {
    line: SheetBlockLine<State>
    children?: any
    actions: Actions<State>
}

export const AssignmentLine = React.forwardRef(
    function AssignmentLine<State>(props: AssignmentLineProps<State>, ref: React.Ref<HTMLElement>) {
        const { line, children = null, actions, ...inputProps } = props
        const onUpdateName = name => actions.setName(line.id, name)
        return (
            <div
                className={`
                    self-stretch
                    pr-2 -mb-1 mt-1
                    text-slate-500 font-light text-xs
                    truncate
                `}
                >
                <TextInput
                    ref={ref}
                    className={`
                        hover:bg-gray-200 hover:text-slate-700
                        focus-within:bg-gray-200 focus-within:text-slate-700
                        outline-none
                        p-0.5 -ml-0.5
                        rounded
                    `}
                    value={line.name}
                    onUpdate={onUpdateName}
                    placeholder={Model.lineDefaultName(line)}
                    {...inputProps}
                />
                {children}
            </div>
        )
    }
)




/****************** Menu Popover ******************/

function MenuPopover({ line, actions, block }) {
    const onSwitchCollapse = () => actions.switchCollapse(line.id)
    const onInsertBefore   = () => actions.insertBeforeCode(line.id, block)
    const onInsertAfter    = () => actions.insertAfterCode(line.id, block)
    const onDelete         = () => actions.deleteCode(line.id)

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
                    <Button onClick={onSwitchCollapse} icon={solidIcons.faEye}         label="Change visibility" />
                    <Button onClick={onInsertBefore}   icon={solidIcons.faChevronUp}   label="Insert before" />
                    <Button onClick={onInsertAfter}    icon={solidIcons.faChevronDown} label="Insert after"  />
                    <Button onClick={onDelete}         icon={solidIcons.faTrash}       label="Delete"        />
                </Menu.Items>
            </Menu>
        </div>
    )
}
