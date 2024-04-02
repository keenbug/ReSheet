import * as React from 'react'

import { useInView } from 'react-intersection-observer'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import * as solidIcons from '@fortawesome/free-solid-svg-icons'

import * as block from '@resheet/core/block'
import { BlockDispatcher, BlockHandle, Environment } from '@resheet/core/block'
import { useRefMap, renderConditionally, WithSkipRender, useEffectfulDispatch } from '@resheet/util/hooks'

import { ValueInspector } from '@resheet/code/value'
import { Keybindings, useShortcuts } from '@resheet/util/shortcuts'

import { TextInput, focusWithKeyboard } from '@resheet/blocks/utils/ui'
import { SafeBlock } from '@resheet/blocks/component'

import * as Model from '../model'
import { SheetBlockState, SheetBlockLine } from '../versioned'

import { ACTIONS, Actions, SheetLineRef, findFocused } from './actions'
import { useSelection } from './useSelection'


export interface SheetProps<InnerState> {
    state: SheetBlockState<InnerState>
    dispatch: BlockDispatcher<SheetBlockState<InnerState>>
    innerBlock: SafeBlock<InnerState>
    env: Environment
}

export const Sheet = React.forwardRef(
    function Sheet<InnerState>(
        { state, dispatch, innerBlock, env }: SheetProps<InnerState>,
        ref: React.Ref<BlockHandle>
    ) {
        const [setLineRef, refMap] = useRefMap<number, SheetLineRef>()
        const lastFocus = React.useRef<number | null>(null)
        const containerRef = React.useRef<HTMLDivElement>()
        const dispatchFX = useEffectfulDispatch(dispatch)

        React.useImperativeHandle(
            ref,
            () => ({
                focus() {
                    const lastIndex = lastFocus.current ?? 0
                    if (state.lines[lastIndex]) {
                        refMap
                            .get(state.lines[lastIndex].id)
                            ?.focus?.()
                    }
                    else {
                        containerRef.current?.focus?.()
                    }
                }
            }),
            [state],
        )

        const { selectionAnchorIds, setSelectionAnchorIds, selectionEventHandlers } = useSelection(refMap)
        const lineIds = state.lines.map(({ id }) => id)
        const selectionAnchorIndices = selectionAnchorIds && [
            lineIds.indexOf(selectionAnchorIds.start),
            lineIds.indexOf(selectionAnchorIds.end),
        ].sort((a, b) => a - b) as [number, number]
        const selectedIds = selectionAnchorIds && lineIds.slice(selectionAnchorIndices[0], selectionAnchorIndices[1] + 1)

        const actions = React.useMemo(
            () => ACTIONS(dispatchFX, containerRef, refMap, innerBlock, selectedIds, setSelectionAnchorIds),
            [dispatchFX, containerRef, refMap, innerBlock, selectedIds, setSelectionAnchorIds],
        )

        const shortcutProps = useShortcuts([
            {
                description: "sheet",
                bindings: [
                    [["Enter"], "selfFocused", "add line", () => actions.insertEnd(innerBlock)],
                ],
            },
        ])

        function onBlur(ev: React.FocusEvent) {
            const id = Array.from(refMap.entries())
                .find(([_id, lineRef]) =>
                    lineRef.getElement() === ev.target
                )
                ?.[0]
            const index = state.lines.findIndex(line => line.id === id)
            if (index >= 0) {
                lastFocus.current = index
            }
            else {
                lastFocus.current = null
            }

            selectionEventHandlers.onBlur(ev)
            shortcutProps.onBlur(ev)
        }

        function onFocus(ev: React.FocusEvent) {
            selectionEventHandlers.onFocus(ev)
            shortcutProps.onFocus(ev)
        }

        function onPaste(ev: React.ClipboardEvent) {
            if (ev.clipboardData.types.includes('application/x.resheet-block')) {
                const json = JSON.parse(ev.clipboardData.getData('application/x.resheet-block'))
                actions.paste(json, innerBlock)
                ev.stopPropagation()
                ev.preventDefault()
            }
        }

        function onCopy(ev: React.ClipboardEvent) {
            const selection = document.getSelection()
            const isTextSelected = selection.rangeCount > 0 && !selection.getRangeAt(0).collapsed
            if (isTextSelected) { return }

            actions.copy(state, innerBlock, (type, content) => {
                ev.clipboardData.setData(type, content)
                ev.stopPropagation()
                ev.preventDefault()
            })
        }

        function onCut(ev: React.ClipboardEvent) {
            const selection = document.getSelection()
            const isTextSelected = selection.rangeCount > 0 && !selection.getRangeAt(0).collapsed
            if (isTextSelected) { return }

            actions.copy(state, innerBlock, (type, content) => {
                ev.clipboardData.setData(type, content)
                actions.deleteCode(findFocused(refMap)?.[0])
                ev.stopPropagation()
                ev.preventDefault()
            })
        }

        return (
            <div
                ref={containerRef}
                tabIndex={-1}
                className="group/sheet focus:border-b-2 focus:border-blue-300 outline-none"
                {...shortcutProps}
                onBlur={onBlur}
                onFocus={onFocus}
                onMouseDown={selectionEventHandlers.onMouseDown}
                onMouseMove={selectionEventHandlers.onMouseMove}
                onCopy={onCopy}
                onPaste={onPaste}
                onCut={onCut}
            >
                <SheetLinesEnv
                    setLineRef={setLineRef}
                    lines={state.lines}
                    actions={actions}
                    block={innerBlock}
                    env={env}
                    selection={selectionAnchorIndices}
                    />

                {/* Add line button */}
                <div className="relative">
                    <button
                        className={`
                            peer z-10
                            absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2
                            px-1 rounded-full bg-gray-100 border-2 border-gray-100
                            text-gray-400 text-xs
                            ${state.lines.length > 0 && "group-focus-within/sheet:opacity-50 hover:group-focus-within/sheet:opacity-100"}
                            transition-[opacity_color] hover:text-blue-600 hover:bg-blue-50 hover:border-blue-500/50
                        `}
                        onClick={() => actions.insertEnd(innerBlock)}
                    >
                        <FontAwesomeIcon icon={solidIcons.faPlus} />
                    </button>

                    {/* Has to be after the button for `peer-hover:` to work, even though it should be placed below the button */}
                    <div className="absolute top-0 left-0 right-0 border-t-2 border-blue-500 opacity-0 peer-hover:opacity-50 transition-[opacity]" />
                </div>
            </div>
        )
    }
)


export interface SheetLinesProps<InnerState> {
    setLineRef: (id: number) => React.Ref<SheetLineRef>
    lines: SheetBlockLine<InnerState>[]
    actions: Actions<InnerState>
    block: SafeBlock<InnerState>
    env: Environment
    selection: [number, number] | null
}

export const SheetLinesEnv = React.memo(function SheetLinesEnv<InnerState>({ lines, ...props }: SheetLinesProps<InnerState>) {
    if (lines.length === 0) {
        return null
    }
    return <SheetLinesEnvHelper index={0} lines={lines} siblingsEnv={block.emptyEnv} aboveViewport={true} {...props} />
})

interface SheetLineHelperProps<InnerState> extends SheetLinesProps<InnerState> {
    index: number
    siblingsEnv: Environment
    aboveViewport: boolean
}

function SheetLinesEnvHelperComponent<InnerState>({ setLineRef, index, lines, actions, block, siblingsEnv, env, selection, aboveViewport }: SheetLineHelperProps<InnerState>) {
    const isSelected = selection && selection[0] <= index && index <= selection[1]
    const line = lines[index]
    const next = index + 1
    const localSiblingsEnv = React.useMemo(
        () => ({ ...siblingsEnv, ...Model.lineToEnv(line, block) }),
        [siblingsEnv, line, block],
    )
    const localEnv = React.useMemo(
        () => ({ ...env, ...siblingsEnv, $before: siblingsEnv }),
        [siblingsEnv, env],
    )
    const [inViewRef, isInView] = useInView({ initialInView: true, root: document.body, rootMargin: '20px' })
    const isBelowViewport = !aboveViewport && !isInView
    return (
        <>
            <SheetLine
                key={line.id}
                setLineRef={setLineRef}
                inViewRef={inViewRef}
                line={line}
                actions={actions}
                block={block}
                isSelected={isSelected}
                env={localEnv}
                skipRender={!isInView}
                />
            {next < lines.length &&
                <SheetLinesEnvHelper
                    setLineRef={setLineRef}
                    index={next}
                    lines={lines}
                    actions={actions}
                    block={block}
                    siblingsEnv={localSiblingsEnv}
                    env={env}
                    selection={selection}
                    aboveViewport={aboveViewport && !isInView} // once a SheetLine was inView, everything below is not aboveViewport anymore
                    skipRender={isBelowViewport}
                    />
            }
        </>
    )
}

const SheetLinesEnvHelper = renderConditionally(SheetLinesEnvHelperComponent, 'never') as WithSkipRender<typeof SheetLinesEnvHelperComponent>


export interface SheetLineProps<InnerState> {
    line: SheetBlockLine<InnerState>
    actions: Actions<InnerState>
    block: SafeBlock<InnerState>
    env: Environment
    isSelected: boolean
    setLineRef(id: number): React.Ref<SheetLineRef>
    inViewRef: React.Ref<HTMLElement>
}

function SheetLineComponent<Inner>({ block, line, env, actions, isSelected, setLineRef, inViewRef }: SheetLineProps<Inner>) {
    const containerRef = React.useRef<HTMLDivElement>()
    const varInputRef = React.useRef<HTMLElement>()
    const innerContainerRef = React.useRef<HTMLDivElement>()
    const innerBlockRef = React.useRef<BlockHandle>()
    const resultRef = React.useRef<HTMLElement>()
    const lineRef = React.useMemo(() => setLineRef(line.id), [setLineRef, line.id])

    React.useImperativeHandle(inViewRef, () => containerRef.current, [containerRef])

    React.useImperativeHandle(
        lineRef,
        () => ({
            getElement() {
                return containerRef.current
            },
            getInnerContainer() {
                return innerContainerRef.current
            },
            getVarInput() {
                return varInputRef.current
            },
            isFocused() {
                return !!containerRef.current && document.activeElement === containerRef.current
            },
            focus() {
                if (!containerRef.current) { return }
                containerRef.current.scrollIntoView({
                    block: 'nearest',
                    behavior: 'auto',
                })
                focusWithKeyboard(containerRef.current, { preventScroll: true })
            },
            focusVar() {
                varInputRef.current?.focus()
            },
            focusInner() {
                innerBlockRef.current?.focus()
                // Workaround: Focus whole line if inner can't be focused
                // Problem: How to find out if inner didn't accept focus?
                //          Immediately checking misses cases, when inner first
                //          has to update, render and then sets focus. So even
                //          one setTimeout didn't suffice. Effects may not yet
                //          have run after an update and render. Therefore we
                //          queue setTimeout a second time before checking for
                //          focus.
                setTimeout(() => {
                    setTimeout(() => {
                        if (containerRef.current && !containerRef.current.contains(document.activeElement)) {
                            containerRef.current.focus()
                        }
                    })
                })
            }
        }),
    )

    const bindings = React.useMemo(
        () => sheetLineBindings(actions, line, block, containerRef, innerBlockRef, resultRef),
        [actions, line, block, containerRef, innerBlockRef, resultRef, varInputRef],
    )

    const bindingsProps = useShortcuts(bindings)

    const subdispatch = React.useCallback(function subdispatch(action: block.BlockAction<Inner>) {
        actions.dispatchInner(line.id, action, block)
    }, [block])

    const varInputBindings: Keybindings = React.useMemo(
        () => assignmentLineBindings<Inner>(line, innerBlockRef, actions),
        [line, innerBlockRef, actions],
    )

    const shouldNameBeHidden = line.name === '' && line.width !== 'full'

    return (
        <SheetLineLayout
            ref={containerRef}
            tabIndex={-1}
            {...bindingsProps}
            line={line}
            isSelected={isSelected}
            assignmentLine={
                <AssignmentLine
                    key="name"
                    ref={varInputRef}
                    line={line}
                    actions={actions}
                    bindings={varInputBindings}
                    style={{ display: undefined }}
                    className={shouldNameBeHidden ? "hidden group-focus-within/sheet-line:inline-block group-hover/sheet-line:inline-block" : "inline-block"}
                    />
            }
            lineContentRef={innerContainerRef}
            lineContent={
                <>
                    {line.visibility === 'block' &&
                        <block.Component
                            key="block"
                            ref={innerBlockRef}
                            state={line.state}
                            dispatch={subdispatch}
                            env={env}
                            />
                    }
                    {line.visibility === 'result' &&
                        <ValueInspector key="result" ref={resultRef} value={Model.getLineResult(line, block)} expandLevel={0} />
                    }
                </>
            }
            />
    )
}

export const SheetLine = renderConditionally(SheetLineComponent) as WithSkipRender<typeof SheetLineComponent>


interface SheetLineLayoutProps extends React.HTMLAttributes<HTMLDivElement> {
    line: SheetBlockLine<unknown>
    assignmentLine: React.ReactNode
    lineContent: React.ReactNode
    lineContentRef: React.Ref<HTMLDivElement>
    isSelected: boolean
}

const SheetLineLayout = React.forwardRef(function SheetLineLayout(
    { line, assignmentLine, lineContent, lineContentRef, isSelected, ...containerProps }: SheetLineLayoutProps,
    ref: React.Ref<HTMLDivElement>,
) {
    const focusIndicatorColor = {
        block: { hover: 'gray-300', focus: 'blue-500', focusWithin: 'blue-300' },

        // yellow-400 is very similar to its neighbors, but this should happen
        // seldom and there should be another indication (by the result), that
        // focus is within
        result: { hover: 'yellow-300', focus: 'yellow-500', focusWithin: 'yellow-400' },
    }[line.visibility]

    switch (line.width) {
        case "narrow":
            return (
                <div
                    ref={ref}
                    className={`
                        flex flex-row items-baseline space-x-2
                        outline-none
                        ${isSelected && 'bg-blue-100'}
                        group/sheet-line
                    `}
                    {...containerProps}
                >
                    <div className="flex-1 min-w-32 flex flex-row justify-end">
                        {assignmentLine}
                    </div>
                    
                    {/* Focus/Hover Indicator */}
                    <div
                        className={`
                            border border-${focusIndicatorColor.hover} self-stretch opacity-0
                            group-focus/sheet-line:border-${focusIndicatorColor.focus} group-focus-within/sheet-line:border-${focusIndicatorColor.focusWithin}
                            group-focus-within/sheet-line:opacity-100 group-hover/sheet-line:opacity-100
                        `}
                        />

                    <div ref={lineContentRef} className="w-[768px] flex flex-col space-y-1 overflow-x-auto">
                        {lineContent}
                    </div>

                    <div className="flex-1" />
                </div>
            )

        case "wide":
            return (
                <div
                    ref={ref}
                    className={`
                        flex flex-row items-baseline space-x-2
                        outline-none
                        ${isSelected && 'bg-blue-100'}
                        group/sheet-line
                    `}
                    {...containerProps}
                >
                    <div className="flex-1 min-w-32 flex flex-row justify-end">
                        {assignmentLine}
                    </div>
                    
                    {/* Focus/Hover Indicator */}
                    <div
                        className={`
                            border border-${focusIndicatorColor.hover} self-stretch opacity-0
                            group-focus/sheet-line:border-${focusIndicatorColor.focus} group-focus-within/sheet-line:border-${focusIndicatorColor.focusWithin}
                            group-focus-within/sheet-line:opacity-100 group-hover/sheet-line:opacity-100
                        `}
                        />

                    <div ref={lineContentRef} className="w-[1280px] flex flex-col space-y-1 overflow-x-auto">
                        {lineContent}
                    </div>

                    <div className="flex-1" />
                </div>
            )

        case "full":
            return (
                <div
                    ref={ref}
                    className={`
                        flex flex-row space-x-2 pr-2
                        outline-none
                        ${isSelected && 'bg-blue-100'}
                        group/sheet-line
                    `}
                    {...containerProps}
                >
                    {/* Focus/Hover Indicator */}
                    <div
                        className={`
                            border border-${focusIndicatorColor.hover} self-stretch opacity-0
                            group-focus/sheet-line:border-${focusIndicatorColor.focus} group-focus-within/sheet-line:border-${focusIndicatorColor.focusWithin}
                            group-focus-within/sheet-line:opacity-100 group-hover/sheet-line:opacity-100
                        `}
                        />
                    
                    <div className="flex-1 flex flex-col items-start">
                        {assignmentLine}

                        <div ref={lineContentRef} className="self-stretch flex flex-col items-stretch space-y-1 overflow-x-auto">
                            {lineContent}
                        </div>
                    </div>
                </div>
            )
    }
})

function sheetLineBindings<Inner>(
    actions: Actions<Inner>,
    line: SheetBlockLine<Inner>,
    block: block.Block<Inner>,
    containerRef: React.MutableRefObject<HTMLDivElement>,
    innerBlockRef: React.MutableRefObject<block.BlockHandle>,
    resultRef: React.MutableRefObject<HTMLElement>,
): Keybindings {
    function insertBelowByEnter(event?: React.KeyboardEvent) {
        if (event && !event.defaultPrevented) { return }
        actions.insertAfterCode(line.id, block, 'inner')
        event?.preventDefault()
        event?.stopPropagation()
    }

    function deleteByBackspace(event?: React.KeyboardEvent) {
        if (event && !event.defaultPrevented) { return }
        actions.deleteCode(line.id, 'inner')
        event?.stopPropagation()
    }

    function moveUp(event?: React.KeyboardEvent) {
        if (event && event.target !== event.currentTarget && !event.defaultPrevented) { return }
        actions.focusUp()
        event?.stopPropagation()
        event?.preventDefault()
    }

    function moveDown(event?: React.KeyboardEvent) {
        if (event && event.target !== event.currentTarget && !event.defaultPrevented) { return }
        actions.focusDown()
        event?.stopPropagation()
        event?.preventDefault()
    }

    function selectUp(event?: React.KeyboardEvent) {
        if (event && event.target !== event.currentTarget && !event.defaultPrevented) { return }
        actions.selectUp()
        event?.stopPropagation()
        event?.preventDefault()
    }

    function selectDown(event?: React.KeyboardEvent) {
        if (event && event.target !== event.currentTarget && !event.defaultPrevented) { return }
        actions.selectDown()
        event?.stopPropagation()
        event?.preventDefault()
    }

    return [
        {
            description: "change lines",
            bindings: [
                [["C-Enter", "O"],                   "selfFocused",  "insert below",     () => actions.insertAfterCode(line.id, block, 'inner')],
                [["C-Shift-Enter", "Shift-O"],       "selfFocused",  "insert above",     () => actions.insertBeforeCode(line.id, block, 'inner')],
                [["C-Shift-R"],                      "none",         "rename",           () => actions.rename(line.id)],
                [["C-Backspace", "Backspace"],       "selfFocused",  "delete line",      () => actions.deleteCode(line.id)],
                [["C-Backspace", "Backspace"],       "hidden",       "delete line",      deleteByBackspace, { noAutoPrevent: true }],
                [["Enter"],                          "!selfFocused", "insert below",     insertBelowByEnter, { noAutoPrevent: true }],
            ]
        },
        {
            description: "line view",
            bindings: [
                [["Z"],                              "selfFocused",  "scroll into view", () => containerRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })],
                [["C-M"],                            "none",         "cycle visibility", () => actions.switchCollapse(line.id)],
                [["C-="],                            "none",         "cycle width",      () => actions.switchWidth(line.id)],
                [["Escape"],                         "!selfFocused", "focus sheet line", () => containerRef.current && focusWithKeyboard(containerRef.current, { preventScroll: true })],
                [
                    ["Enter"],
                    "selfFocused",
                    "focus inner",
                    () => {
                        if (line.visibility === 'block') {
                            innerBlockRef.current?.focus({ preventScroll: true })
                        } else if (line.visibility === 'result') {
                            resultRef.current?.focus({ preventScroll: true })
                        }
                    },
                ],
            ]
        },
        {
            description: "move between lines",
            bindings: [
                [["ArrowUp", "K"],                   "none",          "move up",         moveUp, { noAutoPrevent: true }],
                [["ArrowDown", "J"],                 "none",          "move down",       moveDown, { noAutoPrevent: true }],
                [["Shift-ArrowUp", "Shift-K"],       "none",          "select up",       selectUp, { noAutoPrevent: true }],
                [["Shift-ArrowDown", "Shift-J"],     "none",          "select down",     selectDown, { noAutoPrevent: true }],
                [["C-Enter"],                        "!selfFocused",  "jump next",       () => actions.focusOrCreateNext(line.id, block)],
                [["C-Shift-Enter"],                  "!selfFocused",  "jump prev",       () => actions.focusOrCreatePrev(line.id, block)],
                [["G"],                              "!inputFocused", "jump top",        () => actions.focusFirst()],
                [["Shift-G"],                        "!inputFocused", "jump bottom",     () => actions.focusLast()],
            ]
        },
        {
            description: "scroll sheet",
            bindings: [
                [["C-Alt-ArrowUp", "C-Alt-K"],               "none",         "scroll UP",        () => actions.scroll(-0.5)],
                [["C-Alt-ArrowDown", "C-Alt-J"],             "none",         "scroll DOWN",      () => actions.scroll(0.5)],
                [["C-Shift-Alt-ArrowUp", "C-Shift-Alt-K"],   "none",         "scroll up",        () => actions.scroll(-0.1)],
                [["C-Shift-Alt-ArrowDown", "C-Shift-Alt-J"], "none",         "scroll down",      () => actions.scroll(0.1)],
            ]
        },
    ]
}

function assignmentLineBindings<Inner>(
    line: SheetBlockLine<Inner>,
    innerBlockRef: React.MutableRefObject<block.BlockHandle>,
    actions: Actions<Inner>,
): Keybindings {
    return [
        {
            description: "line name",
            bindings: [
                [
                    ["ArrowDown", "Enter"],
                    "none",
                    "jump next",
                    () => {
                        if (line.visibility === 'block') {
                            innerBlockRef.current?.focus({ preventScroll: true })
                        }
                        else {
                            actions.focusDown()
                        }
                    },
                ],
            ]
        }
    ]
}


interface AssignmentLineProps<State> extends React.HTMLProps<HTMLElement> {
    line: SheetBlockLine<State>
    actions: Actions<State>
    bindings: Keybindings
}

export const AssignmentLine = React.forwardRef(
    function AssignmentLine<State>(props: AssignmentLineProps<State>, ref: React.Ref<HTMLElement>) {
        const { line, actions, bindings, className, ...inputProps } = props
        const bindingsProps = useShortcuts(bindings)

        function onUpdateName(name: string) {
            actions.setName(line.id, name)
        }

        return (
            <TextInput
                ref={ref}
                className={`
                    text-slate-500 font-light text-xs truncate
                    hover:bg-gray-200 hover:text-slate-700
                    focus-within:bg-gray-200 focus-within:text-slate-700
                    outline-none
                    rounded -ml-0.5
                    ${className}
                `}
                value={line.name}
                onUpdate={onUpdateName}
                placeholder={Model.lineDefaultName(line)}
                {...inputProps}
                {...bindingsProps}
            />
        )
    }
)
