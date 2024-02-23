import * as React from 'react'

import { useInView } from 'react-intersection-observer'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import * as solidIcons from '@fortawesome/free-solid-svg-icons'

import * as block from '../../block'
import { Block, BlockUpdater, BlockRef, Environment } from '../../block'
import * as Multiple from '../../block/multiple'

import { clampTo } from '../../utils'

import { ErrorBoundary, ValueInspector } from '../../ui/value'
import { useRefMap, renderConditionally, WithSkipRender, EUpdater, useEUpdate } from '../../ui/hooks'
import { Keybindings, useShortcuts } from '../../ui/shortcuts'
import { TextInput, findScrollableAncestor } from '../../ui/utils'

import * as Model from './model'
import { SheetBlockState, SheetBlockLine } from './versioned'
import * as versioned from './versioned'


/**************** Code Actions **************/


function findFocused(refMap: Map<number, SheetLineRef>) {
    if (!document.activeElement) {
        return undefined
    }
    return [...refMap.entries()].find(([id, ref]) => ref.containsFocus())
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

/** Focus `ref` and keep the same FocusTarget as before or fall back to `fallbackTarget` */
function focusLineRefSameOr(refMap: Map<number, SheetLineRef>, ref: SheetLineRef, fallbackTarget: FocusTarget) {
    const focus = findFocused(refMap)
    if (focus) {
        const [id, currentRef] = focus
        const currentTarget = currentRef.isFocused() ? 'line' : 'inner'
        focusLineRef(ref, currentTarget)
    }
    else {
        focusLineRef(ref, fallbackTarget)
    }
}

type Actions<Inner> = ReturnType<typeof ACTIONS<Inner>>

function ACTIONS<Inner extends unknown>(
    eupdate: EUpdater<SheetBlockState<Inner>>,
    container: React.MutableRefObject<HTMLElement>,
    refMap: Map<number, SheetLineRef>,
    innerBlock: Block<Inner>,
) {
    function update(action: (state: SheetBlockState<Inner>) => SheetBlockState<Inner>) {
        eupdate(state => ({ state: action(state) }))
    }

    function insertBeforeCode(state: SheetBlockState<Inner>, id: number, env: Environment, innerBlock: Block<Inner>, focusTarget: FocusTarget = 'line') {
        const newId = Model.nextFreeId(state);
        return {
            state: Model.insertLineBefore(
                state,
                id,
                {
                    id: newId,
                    name: '',
                    visibility: versioned.VISIBILITY_STATES[0],
                    state: innerBlock.init,
                },
                update,
                env,
                innerBlock,
            ),
            effect() { focusLineRef(refMap.get(newId), focusTarget) },
        }
    }

    function insertAfterCode(state: SheetBlockState<Inner>, id: number, env: Environment, innerBlock: Block<Inner>, focusTarget: FocusTarget = 'line') {
        const newId = Model.nextFreeId(state)
        return {
            state: Model.insertLineAfter(
                state,
                id,
                {
                    id: newId,
                    name: '',
                    visibility: versioned.VISIBILITY_STATES[0],
                    state: innerBlock.init,
                },
                update,
                env,
                innerBlock,
            ),
            effect() { focusLineRef(refMap.get(newId), focusTarget) },
        }
    }

    function insertEnd(state: SheetBlockState<Inner>, env: Environment, innerBlock: Block<Inner>, focusTarget: FocusTarget = 'line') {
        const newId = Model.nextFreeId(state)
        return {
            state: Model.insertLineEnd(
                state,
                {
                    id: newId,
                    name: '',
                    visibility: versioned.VISIBILITY_STATES[0],
                    state: innerBlock.init,
                },
                update,
                env,
                innerBlock,
            ),
            effect() { focusLineRef(refMap.get(newId), focusTarget) },
        }
    }

    function scroll(amount: number) {
        return {
            effect() {
                const scrollableContainer = findScrollableAncestor(container.current)
                if (scrollableContainer) {
                    scrollableContainer.scrollBy({
                        top: amount * scrollableContainer.clientHeight,
                        behavior: 'smooth',
                    })
                }
            },
        }
    }

    function focusUp(state: SheetBlockState<Inner>) {
        return {
            effect() {
                const focused = findFocused(refMap)
                if (focused === undefined) {
                    refMap.get(state.lines[0].id)?.focus()
                }
                else {
                    const [id, lineRef] = focused
                    const focusTarget: FocusTarget = lineRef.isFocused() ? "line" : "inner"
                    const prevId = findRelativeTo(state.lines, id, -1)?.id
                    const prevLine = refMap.get(prevId)
                    prevLine && focusLineRef(prevLine, focusTarget)
                }
            },
        }
    }

    function focusDown(state: SheetBlockState<Inner>) {
        return {
            effect() {
                const focused = findFocused(refMap)
                if (focused === undefined) {
                    refMap.get(state.lines[state.lines.length - 1].id)?.focus()
                }
                else {
                    const [id, lineRef] = focused
                    const focusTarget: FocusTarget = lineRef.isFocused() ? "line" : "inner"
                    const nextId = findRelativeTo(state.lines, id, 1)?.id
                    const nextLine = refMap.get(nextId)
                    nextLine && focusLineRef(nextLine, focusTarget)
                }
            },
        }
    }


    return {
        scroll(amount: number) { eupdate(() => scroll(amount)) },

        focusUp() { eupdate(focusUp) },

        focusDown() { eupdate(focusDown) },

        focusFirst() {
            eupdate(state => ({
                effect() {
                    const firstId = state.lines[0].id
                    refMap.get(firstId)?.focus()
                }
            }))
        },

        focusLast() {
            eupdate(state => ({
                effect() {
                    const lastId = state.lines.slice(-1)[0].id
                    refMap.get(lastId)?.focus()
                }
            }))
        },

        rename(id: number) {
            eupdate(() => ({
                effect() {
                    refMap.get(id)?.focusVar()
                },
            }))
        },

        setName(id: number, name: string) {
            eupdate((state, env) => ({
                state: Model.updateLineWithId(state, id, line => ({ ...line, name }), update, env, innerBlock),
            }));
        },

        switchCollapse(id: number) {
            eupdate(state => ({
                state: Model.updateLineUiWithId(state, id, line => ({
                    ...line,
                    visibility: Model.nextLineVisibility(line.visibility),
                })),
                effect() {
                    const line = refMap.get(id)
                    if (line && !line.containsFocus()) {
                        line.focus();
                    }
                },
            }))
        },

        updateInner(
            id: number,
            action: (state: Inner) => Inner,
            innerBlock: Block<Inner>,
            env: Environment
        ) {
            update(state =>
                Model.updateLineBlock(state, id, action, innerBlock, env, update)
            )
        },

        pasteAfter(id: number, json: any, innerBlock: Block<Inner>) {
            const updateLines = block.fieldUpdater('lines', update)
            eupdate((state, env) => {
                try {
                    const siblingsUntilId = Multiple.getResultEnv(Multiple.getEntriesUntil(state.lines, id), innerBlock)
                    const envForPasted = { ...env, ...siblingsUntilId }
                    const { lines } = versioned.fromJSON(json)(() => {}, envForPasted, innerBlock)
                    const nextId = Model.nextFreeId(state)
                    const remappedLines = lines.map((line, index) => ({
                        ...line,
                        id: nextId + index,
                    }))
                    const newState = {
                        ...state,
                        lines: (
                            Multiple.recomputeFrom(
                                Multiple.insertEntryAfter(state.lines, id, ...remappedLines),
                                id,
                                env,
                                innerBlock,
                                updateLines,
                                1,
                            )
                        )
                    }
                    return {
                        state: newState,
                        effect() {
                            const lastPastedRef = refMap.get(remappedLines.slice(-1)[0]?.id)
                            lastPastedRef && focusLineRefSameOr(refMap, lastPastedRef, 'line')
                        },
                    }
                }
                catch (e) {
                    return {}
                }
            })
        },

        insertBeforeCode(id: number, innerBlock: Block<Inner>, focusTarget: FocusTarget = 'line') {
            eupdate((state, env) => insertBeforeCode(state, id, env, innerBlock, focusTarget))
        },

        insertAfterCode(id: number, innerBlock: Block<Inner>, focusTarget: FocusTarget = 'line') {
            eupdate((state, env) => insertAfterCode(state, id, env, innerBlock, focusTarget))
        },

        insertEnd(innerBlock: Block<Inner>, focusTarget: FocusTarget = 'inner') {
            eupdate((state, env) => insertEnd(state, env, innerBlock, focusTarget))
        },

        focusOrCreatePrev(id: number, innerBlock: Block<Inner>) {
            eupdate((state, env) => {
                const currentIndex = state.lines.findIndex(line => line.id === id)
                if (currentIndex < 0) { return {} }
                if (currentIndex === 0) {
                    return insertBeforeCode(state, id, env, innerBlock, 'inner')
                }

                const prevLine = state.lines[currentIndex - 1]
                return {
                    effect() {
                        refMap.get(prevLine.id)?.focusInner()
                    }
                }
            })
        },

        focusOrCreateNext(id: number, innerBlock: Block<Inner>) {
            eupdate((state, env) => {
                const currentIndex = state.lines.findIndex(line => line.id === id)
                if (currentIndex < 0) { return {} }
                if (currentIndex === state.lines.length - 1) {
                    return insertAfterCode(state, id, env, innerBlock, 'inner')
                }

                const nextLine = state.lines[currentIndex + 1]
                return {
                    effect() {
                        refMap.get(nextLine.id)?.focusInner()
                    }
                }
            })
        },

        deleteCode(id: number, focusAfter: FocusTarget = 'line') {
            eupdate((state, env) => {
                const [prevId, newState] = Model.deleteLine(state, id, update, env, innerBlock)
                return {
                    state: newState,
                    effect() {
                        if (refMap.has(prevId)) {
                            focusLineRef(refMap.get(prevId), focusAfter)
                        }
                        else {
                            container.current.focus()
                        }
                    },
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
        const lastFocus = React.useRef<number | null>(null)
        const containerRef = React.useRef<HTMLDivElement>()
        const eupdate = useEUpdate(update, env)
        React.useImperativeHandle(
            ref,
            () => ({
                focus() {
                    const lastIndex = lastFocus.current ?? 0
                    if (state.lines[lastIndex]) {
                        refMap
                            .get(state.lines[lastIndex].id)
                            ?.focus?.()
                        return
                    }
                    else {
                        containerRef.current?.focus?.()
                    }
                }
            }),
            [state]
        )

        const actions = React.useMemo(
            () => ACTIONS(eupdate, containerRef, refMap, innerBlock),
            [eupdate, containerRef, refMap, innerBlock],
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

            shortcutProps.onBlur(ev)
        }

        return (
            <div
                ref={containerRef}
                tabIndex={-1}
                className="group/sheet focus:border-b-2 focus:border-blue-300 outline-none"
                {...shortcutProps}
                onBlur={onBlur}
            >
                <SheetLinesEnv
                    setLineRef={setLineRef}
                    lines={state.lines}
                    actions={actions}
                    block={innerBlock}
                    env={env}
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
    block: Block<InnerState>
    env: Environment
}

export function SheetLinesEnv<InnerState>({ lines, ...props }: SheetLinesProps<InnerState>) {
    if (lines.length === 0) {
        return null
    }
    return <SheetLinesEnvHelper index={0} lines={lines} siblingsEnv={block.emptyEnv} aboveViewport={true} {...props} />
}

interface SheetLineHelperProps<InnerState> extends SheetLinesProps<InnerState> {
    index: number
    siblingsEnv: Environment
    aboveViewport: boolean
}

function SheetLinesEnvHelperComponent<InnerState>({ setLineRef, index, lines, actions, block, siblingsEnv, env, aboveViewport }: SheetLineHelperProps<InnerState>) {
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
    block: Block<InnerState>
    env: Environment
    setLineRef(id: number): React.Ref<SheetLineRef>
    inViewRef: React.Ref<HTMLElement>
}

export interface SheetLineRef {
    getElement(): HTMLElement
    isFocused(): boolean
    containsFocus(): boolean
    focus(): void
    focusVar(): void
    focusInner(): void
}

function SheetLineComponent<Inner>({ block, line, env, actions, setLineRef, inViewRef }: SheetLineProps<Inner>) {
    const containerRef = React.useRef<HTMLDivElement>()
    const varInputRef = React.useRef<HTMLElement>()
    const innerBlockRef = React.useRef<BlockRef>()
    const resultRef = React.useRef<HTMLElement>()
    const lineRef = React.useMemo(() => setLineRef(line.id), [setLineRef, line.id])

    React.useImperativeHandle(inViewRef, () => containerRef.current, [containerRef])

    React.useImperativeHandle(
        lineRef,
        () => ({
            getElement() {
                return containerRef.current
            },
            isFocused() {
                return !!containerRef.current && document.activeElement === containerRef.current
            },
            containsFocus() {
                return !!containerRef.current && containerRef.current.contains(document.activeElement)
            },
            focus() {
                containerRef.current?.scrollIntoView({
                    block: 'nearest',
                    behavior: 'auto',
                })
                containerRef.current?.focus({ preventScroll: true })
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

    const subupdate = React.useCallback(function subupdate(action: (inner: Inner) => Inner) {
        actions.updateInner(line.id, action, block, env)
    }, [block, env])

    const varInputBindings: Keybindings = React.useMemo(
        () => assignmentLineBindings<Inner>(line, innerBlockRef, actions),
        [line, innerBlockRef, actions],
    )

    function onPaste(ev: React.ClipboardEvent) {
        if (ev.currentTarget !== document.activeElement) { return }
        if (ev.clipboardData.types.includes('application/tables-block')) {
            const json = JSON.parse(ev.clipboardData.getData('application/tables-block'))
            actions.pasteAfter(line.id, json, block)
            ev.stopPropagation()
            ev.preventDefault()
        }
    }

    function onCopy(ev: React.ClipboardEvent) {
        if (ev.currentTarget !== document.activeElement) { return }
        ev.clipboardData.setData('application/tables-block', JSON.stringify(versioned.toJSON({ lines: [line] }, block)))
        ev.stopPropagation()
        ev.preventDefault()
    }

    const shouldNameBeHidden = line.name === ''
    const focusIndicatorColor = {
        block: { hover: 'gray-300', focus: 'blue-500', focusWithin: 'blue-300' },

        // yellow-400 is very similar to its neighbors, but this should happen
        // seldom and there should be another indication (by the result), that
        // focus is within
        result: { hover: 'yellow-300', focus: 'yellow-500', focusWithin: 'yellow-400' },
    }[line.visibility]

    return (
        <div
            ref={containerRef}
            className={`
                flex flex-row items-baseline space-x-2
                outline-none
                group/sheet-line
            `}
            tabIndex={-1}
            {...bindingsProps}
            onCopy={onCopy}
            onPaste={onPaste}
        >
            <div className="flex-1 min-w-32 flex flex-row justify-end">
                <AssignmentLine
                    key="name"
                    ref={varInputRef}
                    line={line}
                    actions={actions}
                    bindings={varInputBindings}
                    style={{ display: undefined }}
                    className={shouldNameBeHidden ? "hidden group-focus-within/sheet-line:inline-block group-hover/sheet-line:inline-block" : "inline-block"}
                    />
            </div>
            
            {/* Focus/Hover Indicator */}
            <div
                className={`
                    border border-${focusIndicatorColor.hover} self-stretch opacity-0
                    group-focus/sheet-line:border-${focusIndicatorColor.focus} group-focus-within/sheet-line:border-${focusIndicatorColor.focusWithin}
                    group-focus-within/sheet-line:opacity-100 group-hover/sheet-line:opacity-100
                `}
                />

            <div className="w-[768px] flex flex-col space-y-1 overflow-x-auto">
                {line.visibility === 'block' &&
                    <ErrorBoundary key="block" title="There was an error in the subblock">
                        {block.view({ ref: innerBlockRef, state: line.state, update: subupdate, env })}
                    </ErrorBoundary>
                }
                {line.visibility === 'result' &&
                    <ValueInspector key="result" ref={resultRef} value={Model.getLineResult(line, block)} expandLevel={0} />
                }
            </div>

            <div className="flex-1" />
        </div>
    )
}

export const SheetLine = renderConditionally(SheetLineComponent) as WithSkipRender<typeof SheetLineComponent>

function sheetLineBindings<Inner>(
    actions: Actions<Inner>,
    line: SheetBlockLine<Inner>,
    block: block.Block<Inner>,
    containerRef: React.MutableRefObject<HTMLDivElement>,
    innerBlockRef: React.MutableRefObject<block.BlockRef>,
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
                [["Escape"],                         "!selfFocused", "focus sheet line", () => containerRef.current?.focus({ preventScroll: true })],
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
    innerBlockRef: React.MutableRefObject<block.BlockRef>,
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
                    rounded
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
