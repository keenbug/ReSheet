import * as React from 'react'

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import * as solidIcons from '@fortawesome/free-solid-svg-icons'
import * as regularIcons from '@fortawesome/free-regular-svg-icons'
import { Menu, Transition } from '@headlessui/react'

import { Set } from 'immutable'

import { Block, BlockRef, BlockUpdater, Environment } from '../../block'
import { LoadFileButton, saveFile, selectFile } from '../../ui/utils'
import { $update, arrayEquals, arrayStartsWith, clampTo, intersperse, nextElem } from '../../utils'
import { CollectorDialogProps, KeySymbol, KeyComposition, Keybinding, Keybindings, ShortcutSuggestions, useShortcuts, KeyButton, useBindingNotifications, KeyMap } from '../../ui/shortcuts'

import { DocumentState } from './model'
import * as Model from './model'
import * as Pages from './pages'
import { HistoryView } from './history'
import * as History from './history'
import { HistoryModePanel } from './history'
import { CommandSearch } from './commands'
import { Document, PageId, PageState } from './versioned'
import * as versioned from './versioned'

type Actions<State> = ReturnType<typeof ACTIONS<State>>

interface ActionProps<State> {
    state: Document<State>
    actions: Actions<State>
}

function ACTIONS<State extends unknown>(
    update: BlockUpdater<DocumentState<State>>,
    innerBlock: Block<State>,
    env: Environment,
) {
    function updateInner(action: (state: Document<State>) => Document<State>) {
        update(state =>
            History.updateHistoryCurrent(
                state,
                action,
            )
        )
    }

    function updatePages(action: (pages: PageState<State>[]) => PageState<State>[]) {
        update(state => ({
            ...state,
            inner: {
                ...state.inner,
                pages: action(state.inner.pages),
            },
        }))
    }

    return {
        updateInner,

        updateOpenPageInner(action: (state: State) => State) {
            updateInner(inner =>
                Model.updateOpenPage(inner, action, innerBlock, env)
            )
        },


        reset() {
            update(() => Model.init(innerBlock.init))
        },

        save() {
            update(state => {
                const content = JSON.stringify(Model.toJSON(state, innerBlock))
                saveFile(
                    'tables.json',
                    'application/json',
                    content,
                )
                return state
            })
        },

        async loadLocalFile(file: File) {
            const content = JSON.parse(await file.text())
            try {
                const newState = Model.fromJSON(content, update, env, innerBlock)
                update(() => newState)
            }
            catch (e) {
                window.alert(`Could not load file: ${e}`)
            }
        },

        async loadRemoteFile() {
            const url = window.prompt('Which URL should be loaded?')
            if (url === null) { return }

            try {
                const response = await fetch(url)
                const content = await response.json()
                const newState = Model.fromJSON(content, update, env, innerBlock)
                update(() => newState)
            }
            catch (e) {
                window.alert(`Could not load file from URL: ${e}`)
            }
        },

        useAsTempate(path: PageId[]) {
            updateInner(inner => ({
                ...inner,
                template: Pages.getPageAt(path, inner.pages) ?? inner.template,
            }))
        },

        addPage(path: PageId[]) {
            updateInner(inner =>
                Model.addPageAt(path, inner)
            )
        },

        deletePage(path: PageId[]) {
            updateInner(inner =>
                Model.deletePageAt(path, inner, innerBlock, env, updateInner)
            )
        },

        setPageName(path: PageId[], name: string) {
            updateInner(innerState => {
                return {
                    ...innerState,
                    pages: Pages.updatePageAt(
                        path,
                        innerState.pages,
                        page => ({ ...page, name }),
                    ),
                }
            })
        },

        nestPage(path: PageId[]) {
            updateInner(innerState => {
                const [newPath, pages] = Pages.nestPage(path, innerState.pages, env, innerBlock, updatePages)
                return {
                    ...innerState,
                    pages,
                    viewState: {
                        ...innerState.viewState,
                        openPage: newPath,
                    }
                }
            })
        },

        unnestPage(path: PageId[]) {
            updateInner(innerState => {
                const [newPath, pages] = Pages.unnestPage(path, innerState.pages, env, innerBlock, updatePages)
                return {
                    ...innerState,
                    pages,
                    viewState: {
                        ...innerState.viewState,
                        openPage: newPath,
                    }
                }
            })
        },

        movePage(delta: number, path: PageId[]) {
            updateInner(innerState => {
                return {
                    ...innerState,
                    pages: Pages.movePage(delta, path, innerState.pages, innerBlock, env, updatePages),
                }
            })
        },

        openPage(path: PageId[]) {
            updateInner(inner =>
                Model.changeOpenPage(path, inner, env, innerBlock, updateInner)
            )
        },

        openFirstChild(currentPath: PageId[]) {
            updateInner(inner => {
                const parent = Pages.getPageAt(currentPath, inner.pages)
                if (parent === null || parent.children.length === 0) { return inner }

                const path = [...currentPath, parent.children[0].id]
                return Model.changeOpenPage(path, inner, env, innerBlock, updateInner)
            })
        },

        openParent(currentPath: PageId[]) {
            updateInner(inner =>
                Model.changeOpenPage(currentPath.slice(0, -1), inner, env, innerBlock, updateInner)
            )
        },

        openNextPage(currentPath: PageId[]) {
            updateInner(inner => {
                const allPaths = Pages.getExpandedPaths(inner.pages, currentPath)
                const openPageIndex = allPaths.findIndex(somePath => arrayEquals(somePath, currentPath))
                const nextPageIndex = clampTo(0, allPaths.length, openPageIndex + 1)

                const newPath = allPaths[nextPageIndex]
                return Model.changeOpenPage(newPath, inner, env, innerBlock, updateInner)
            })
        },

        openPrevPage(currentPath: PageId[]) {
            updateInner(inner => {
                const allPaths = Pages.getExpandedPaths(inner.pages, currentPath)
                const openPageIndex = allPaths.findIndex(somePath => arrayEquals(somePath, currentPath))
                const prevPageIndex = clampTo(0, allPaths.length, openPageIndex - 1)

                const newPath = allPaths[prevPageIndex]
                return Model.changeOpenPage(newPath, inner, env, innerBlock, updateInner)
            })
        },

        toggleCollapsed(path: PageId[]) {
            updateInner(innerState => {
                return {
                    ...innerState,
                    pages: Pages.updatePageAt(
                        path,
                        innerState.pages,
                        page => ({ ...page, isCollapsed: !page.isCollapsed }),
                    ),
                }
            })
        },

        openHistory() {
            update(History.openHistory)
        },

        closeHistory() {
            update(History.closeHistory)
        },

        goBack() {
            update(state => History.moveInHistory(-1, state))
        },

        goForward() {
            update(state => History.moveInHistory(1, state))
        },
        
        restoreStateFromHistory() {
            update(state => History.restoreStateFromHistory(state, env, (state, env) => Model.innerFromJSON(state, updateInner, env, innerBlock)))
        },
        
        toggleSidebar() {
            updateInner(inner =>
                $update(open => !open, inner,'viewState','sidebarOpen')
            )
        },

    }
}


interface LocalActions {
    setIsNameEditing(editin: boolean): void
    toggleShortcutsVisible(): void
    toggleSearch(): void
}

const commandSearchBinding = (localActions: LocalActions): Keybinding => [
    ["C-K", "C-Shift-P"],
    "none",
    "search commands",
    () => { localActions.toggleSearch() },
]

function DocumentKeyBindings<State>(
    state: DocumentState<State>,
    actions: Actions<State>,
    containerRef: React.MutableRefObject<HTMLDivElement>,
    innerRef: React.MutableRefObject<BlockRef>,
    localActions: LocalActions,
): Keybindings {
    return [
        {
            description: "create / delete pages",
            bindings: [
                [
                    // not sure about capturing this...
                    ["C-N"],
                    "!inputFocused",
                    "new page",
                    () => {
                        actions.addPage(state.inner.viewState.openPage.slice(0, -1))
                        localActions.setIsNameEditing(true)
                    },
                ],
                [
                    ["C-Shift-N"],
                    "none",
                    "new child page",
                    () => {
                        actions.addPage(state.inner.viewState.openPage)
                        localActions.setIsNameEditing(true)
                    },
                ],
                [
                    ["C-Backspace"],
                    "!inputFocused",
                    "delete page",
                    () => { actions.deletePage(state.inner.viewState.openPage) },
                ],
            ]
        },
        {
            description: "move pages",
            bindings: [
                [
                    ["C-Shift-K", "C-Shift-ArrowUp"],
                    "none",
                    "move page up",
                    () => { actions.movePage(-1, state.inner.viewState.openPage) },
                ],
                [
                    ["C-Shift-J", "C-Shift-ArrowDown"],
                    "none",
                    "move page down",
                    () => { actions.movePage(1, state.inner.viewState.openPage) },
                ],
                [
                    ["C-Shift-H", "C-Shift-ArrowLeft"],
                    "none",
                    "move page one level up",
                    () => { actions.unnestPage(state.inner.viewState.openPage) },
                ],
                [
                    ["C-Shift-L", "C-Shift-ArrowRight"],
                    "none",
                    "move page one level down",
                    () => { actions.nestPage(state.inner.viewState.openPage) },
                ],
            ]
        },
        {
            description: "move between pages",
            bindings: [
                [
                    ["K", "ArrowUp"],
                    "!inputFocused",
                    "open prev page",
                    () => { actions.openPrevPage(state.inner.viewState.openPage) },
                ],
                [
                    ["J", "ArrowDown"],
                    "!inputFocused",
                    "open next page",
                    () => { actions.openNextPage(state.inner.viewState.openPage) },
                ],
                [
                    ["L", "ArrowRight"],
                    "!inputFocused",
                    "open first child page",
                    () => { actions.openFirstChild(state.inner.viewState.openPage) },
                ],
                [
                    ["H", "ArrowLeft"],
                    "!inputFocused",
                    "open parent page",
                    () => { actions.openParent(state.inner.viewState.openPage) },
                ],
            ]
        },
        {
            description: "change page",
            bindings: [
                [
                    ["C-Shift-R"],
                    "none",
                    "edit page name",
                    () => { localActions.setIsNameEditing(true) },
                ],
                [
                    [" "],
                    "!inputFocused",
                    "toggle page collapsed",
                    () => { actions.toggleCollapsed(state.inner.viewState.openPage) },
                ],
                [
                    ["C-Shift-D"],
                    "none",
                    "safe as default template",
                    () => { actions.useAsTempate(state.inner.viewState.openPage) },
                ],
            ]
        },
        {
            description: "files",
            bindings: [
                [
                    ["C-O"],
                    "none",
                    "open local file",
                    async () => { actions.loadLocalFile(await selectFile()) },
                ],
                [
                    ["C-S"],
                    "none",
                    "save file",
                    () => { actions.save() },
                ],
            ]
        },
        {
            description: "view",
            bindings: [
                commandSearchBinding(localActions),
                [
                    ["C-B"],
                    "none",
                    "toggle sidebar",
                    () => { actions.toggleSidebar() },
                ],
                [
                    ["Escape"],
                    "!selfFocused",
                    "focus out",
                    () => { containerRef.current?.focus() },
                ],
                [
                    ["Enter"],
                    "selfFocused",
                    "focus block",
                    () => { innerRef.current?.focus() },
                ],
            ]
        },
        {
            description: "help",
            bindings: [
                [
                    ["C-?"],
                    "none",
                    "toggle shortcut suggestions",
                    () => { localActions.toggleShortcutsVisible() },
                ]
            ]
        }
    ]
}


export interface DocumentUiProps<State> {
    state: DocumentState<State>
    update: (action: (state: DocumentState<State>) => DocumentState<State>) => void
    env: Environment
    innerBlock: Block<State>
    blockRef?: React.Ref<BlockRef> // not using ref because the <State> generic breaks with React.forwardRef
}

type ShortcutsViewMode = 'hidden' | 'flat' | 'full'
const SHORTCUTS_VIEW_MODES: ShortcutsViewMode[] = ['full', 'flat', 'hidden']

export function DocumentUi<State>({ state, update, env, innerBlock, blockRef }: DocumentUiProps<State>) {
    const containerRef = React.useRef<HTMLDivElement>()
    const innerRef = React.useRef<BlockRef>()
    React.useImperativeHandle(
        blockRef,
        () => ({
            focus() {
                containerRef.current?.focus()
            }
        })
    )
    const [isNameEditing, setIsNameEditing] = React.useState(false)
    const [isSelfFocused, setIsSelfFocused] = React.useState(false)
    const [shortcutsViewMode, setShortcutsViewMode] = React.useState<ShortcutsViewMode>('hidden')
    const [search, setSearch] = React.useState<Keybindings>()

    const { getBindings } = useBindingNotifications()

    const localActions: LocalActions = React.useMemo(() => ({
        setIsNameEditing,

        toggleShortcutsVisible() {
            setShortcutsViewMode(mode => nextElem(mode, SHORTCUTS_VIEW_MODES))
        },

        toggleSearch() {
            setSearch(bindings => (
                bindings === undefined ?
                    getBindings()
                :
                    undefined
            ))
        },
    }), [])

    const actions = React.useMemo(() => ACTIONS(update, innerBlock, env), [update, innerBlock, env])
    const bindings = DocumentKeyBindings(state, actions, containerRef, innerRef, localActions)
    const bindingProps = useShortcuts(bindings)

    const fromJSON = React.useCallback(
        (json: any, env: Environment) => Model.innerFromJSON(json, actions.updateInner, env, innerBlock),
        [actions, innerBlock],
    )

    const onFocus = React.useCallback((ev: React.FocusEvent) => {
        if (ev.target === ev.currentTarget) {
            setIsSelfFocused(true)
        }
        bindingProps.onFocus(ev)
    }, [bindingProps.onFocus])

    const onBlur = React.useCallback((ev: React.FocusEvent) => {
        if (ev.target === ev.currentTarget) {
            setIsSelfFocused(false)
        }
        bindingProps.onBlur(ev)
    }, [bindingProps.onBlur])

    return (
        <>
            <HistoryModePanel state={state} actions={actions} />
            <HistoryView state={state} update={update} env={env} fromJSON={fromJSON}>
                {innerState => {
                    const sidebarVisible = isSelfFocused || innerState.viewState.sidebarOpen || isNameEditing

                    return (
                        <div
                            ref={containerRef}
                            tabIndex={-1}
                            {...bindingProps}
                            onFocus={onFocus}
                            onBlur={onBlur}
                            className="group/document-ui relative h-full w-full overflow-hidden outline-none"
                            >
                            <Sidebar
                                state={innerState}
                                actions={actions}
                                isVisible={sidebarVisible}
                                isHistoryOpen={state.mode.type === 'history'}
                                isNameEditing={isNameEditing}
                                setIsNameEditing={setIsNameEditing}
                                commandBinding={commandSearchBinding(localActions)}
                                />
                            <SidebarButton sidebarVisible={sidebarVisible} toggleSidebar={actions.toggleSidebar} />

                            <div
                                className={`
                                    h-full
                                    transition-all ${sidebarVisible ? "ml-56" : ""}
                                    flex flex-col items-stretch overflow-hidden
                                    bg-gray-50
                                `}
                            >
                                <div className="flex-1 overflow-y-auto transition-all">
                                    <MainView
                                        key={innerState.viewState.openPage.join('.')}
                                        innerRef={innerRef}
                                        state={state}
                                        actions={actions}
                                        innerState={innerState}
                                        innerBlock={innerBlock}
                                        env={env}
                                        sidebarVisible={sidebarVisible}
                                        />
                                </div>
                                {shortcutsViewMode !== 'hidden' &&
                                    <div className="flex flex-row w-full overflow-hidden items-end space-x-1 border-t-2 border-gray-100">
                                        <div
                                            className={`
                                                flex-1 flex flex-row justify-between
                                                ${shortcutsViewMode === 'flat' ? "space-x-8" : "space-x-20"}
                                                px-10 py-1 overflow-x-auto
                                            `}
                                        >
                                            <ShortcutSuggestions flat={shortcutsViewMode === 'flat'} />
                                        </div>
                                        <button
                                            className={`
                                                ${shortcutsViewMode !== 'flat' && 'absolute bottom-0 right-0'}
                                                px-1 bg-gray-100 opacity-50 hover:opacity-100 transition rounded
                                            `}
                                            onClick={localActions.toggleShortcutsVisible}
                                        >
                                            <FontAwesomeIcon icon={solidIcons.faCaretDown} />
                                        </button>
                                    </div>
                                }
                                {shortcutsViewMode === 'hidden' &&
                                    <button
                                        className={`
                                            absolute bottom-3 right-3 w-8 h-8
                                            rounded-full border border-gray-100 shadow
                                            bg-transparent opacity-50 hover:opacity-100 hover:bg-white transition
                                            flex justify-center items-center
                                            text-sm
                                        `}
                                        onClick={localActions.toggleShortcutsVisible}
                                    >
                                        ⌘
                                    </button>
                                }
                                {search !== undefined && <CommandSearch bindings={search} close={() => setSearch(undefined) } />}
                            </div>
                        </div>
                    )
                }}
            </HistoryView>
        </>
    )
}

interface MainViewProps<State> {
    innerRef: React.Ref<BlockRef>
    state: DocumentState<State>
    actions: Actions<State>
    innerState: Document<State>
    innerBlock: Block<State>
    env: Environment
    sidebarVisible: boolean
}

function MainView<State>({
    innerRef,
    state,
    actions,
    innerState,
    innerBlock,
    env,
    sidebarVisible,
}: MainViewProps<State>) {
    const openPage = Model.getOpenPage(innerState)
    const noOpenPage = openPage === null
    // don't include `innerState` as dependency, because:
    //   - `Model.getOpenPageEnv` only needs `innerState` for Pages before the current `openPage`
    //   - only the current `openPage` can change (and following pages as they depend on it, but they are irrelevant for this case)
    //   - so the real dependency, the Pages before `openPage`, can only change if one of them becomes the `openPage`
    //   - so `innerState.viewState.openPage` suffices as dependency
    //   - otherwise `pageEnv` would change every time something in `openPage` changes
    //      => which leads to everything in `openPage` being reevaluated, even though just some subset could suffice
    // This could be better solved, if I could break innerState up into the pages before and only feed them as argument and dependency.
    // But currently it looks like this would harm seperation of concerns, as it seems that the inner workings of `Model.getOpenPageEnv`
    // would have to spill into here.
    const pageEnv = React.useMemo(
        () => noOpenPage ? null : Model.getOpenPageEnv(innerState, env, innerBlock),
        [innerState.viewState.openPage, noOpenPage, env, innerBlock],
    )

    if (!pageEnv) {
        function Link({ onClick, children }) {
            return <a className="font-medium cursor-pointer text-blue-800 hover:text-blue-600" onClick={onClick}>{children}</a>
        }
        return (
            <div className="h-full w-full flex justify-center items-center">
                <div className="text-center text-lg text-gray-900">
                    <Link onClick={() => actions.addPage([])}>
                        Add new Page
                    </Link><br />
                    or select one from the{' '}
                    {state.inner.viewState.sidebarOpen ?
                        "Sidebar"
                    :
                        <Link onClick={actions.toggleSidebar}>
                            Sidebar
                        </Link>
                    }
                </div>
            </div>
        )
    }

    return (
        <div className={`mb-[80cqh] bg-white relative ${sidebarVisible ? "px-1" : "px-10"}`}>
            <Breadcrumbs openPage={innerState.viewState.openPage} pages={innerState.pages} onOpenPage={actions.openPage} />
            {innerBlock.view({
                ref: innerRef,
                state: openPage.state,
                update: actions.updateOpenPageInner,
                env: pageEnv,
            })}
        </div>
    )
}

interface BreadcrumbsProps {
    openPage: PageId[]
    pages: PageState<unknown>[]
    onOpenPage(path: PageId[]): void
}

function Breadcrumbs({ openPage, pages, onOpenPage }: BreadcrumbsProps) {
    function pathToPages(path: PageId[], pages: PageState<unknown>[], currentPath: PageId[] = []) {
        if (path.length === 0) { return [] }

        const page = pages.find(p => p.id === path[0])
        if (!page) { return pathToPages(path.slice(1), pages) }

        return [
            [ currentPath, page, pages ],
            ...pathToPages(path.slice(1), page.children, [ ...currentPath, page.id ])
        ]
    }

    const pathPages = pathToPages(openPage, pages)

    return (
        <div className="flex flex-row py-2 -ml-1 text-gray-800 text-sm">
            {pathPages.map(([path, page, siblings]) => (
                <React.Fragment key={path.join('.')}>
                    <Menu as="div" className="relative">
                        <Menu.Button className="rounded px-1.5 -mx-0.5 text-gray-400 hover:text-gray-600 hover:bg-gray-200">
                            <FontAwesomeIcon size="xs" icon={solidIcons.faAngleRight} />
                        </Menu.Button>
                        {siblingsMenuItems(siblings, path)}
                    </Menu>
                    <button
                        className="rounded px-1.5 -mx-0.5 hover:bg-gray-200"
                        onClick={() => { onOpenPage([ ...path, page.id ]) }}
                    >
                        {versioned.getName(page)}
                    </button>
                </React.Fragment>
            ))}
        </div>
    )

    function siblingsMenuItems(siblings: PageState<unknown>[], path: PageId[]) {
        return (
            <Menu.Items
                className={`
                    absolute -top-1 -right-1 translate-x-full z-10
                    flex flex-col items-stretch whitespace-nowrap
                    rounded bg-white shadow
                    focus:outline-none overflow-hidden
                `}
            >
                {siblings.map(page => (
                    <Menu.Item key={page.id}>
                        {({ active }) => {
                            const pathHere = [...path, page.id]
                            const isOpen = arrayStartsWith(pathHere, openPage)
                            return (
                                <button
                                    className={`
                                        px-2 py-1 hover:bg-gray-200
                                        ${isOpen && "bg-gray-100"} ${active && "bg-gray-200"}
                                        text-left
                                    `}
                                    onClick={() => { onOpenPage(pathHere) } }
                                >
                                    {versioned.getName(page)}
                                </button>
                            )
                        }}
                    </Menu.Item>
                ))}
            </Menu.Items>
        )
    }
}


function SidebarButton<State>({ sidebarVisible, toggleSidebar }: { sidebarVisible: boolean, toggleSidebar(): void }) {
    if (sidebarVisible) {
        return null
    }

    return (
        <div className="absolute top-1 left-2 z-10">
            <button className="text-gray-300 hover:text-gray-500 transition" onClick={toggleSidebar}>
                <FontAwesomeIcon icon={solidIcons.faBars} />
            </button>
        </div>
    )
}



interface SidebarProps<State> extends ActionProps<State> {
    isVisible: boolean
    isHistoryOpen: boolean
    isNameEditing: boolean
    setIsNameEditing: (editing: boolean) => void
    commandBinding: Keybinding
}

function Sidebar<State>({ state, actions, isVisible, isHistoryOpen, isNameEditing, setIsNameEditing, commandBinding }: SidebarProps<State>) {
    function HistoryButton() {
        return (
            <button
                className={`
                    px-2 py-0.5 w-full text-left
                    ${isHistoryOpen ?
                        "text-blue-50 bg-blue-700 hover:bg-blue-500"
                    :
                        "hover:text-blue-900 hover:bg-blue-200"
                    }
                `}
                onClick={isHistoryOpen ? actions.closeHistory : actions.openHistory}
                >
                History
            </button>
        )
    }

    function CommandSearchButton() {
        return (
            <div
                className={`
                    rounded-full mx-2 px-3 py-0.5
                    flex flex-row items-baseline space-x-2
                    bg-gray-200 text-gray-400 border border-gray-300 
                    text-sm cursor-pointer
                    hover:bg-gray-100 hover:text-gray-900 hover:border-gray-400
                    transition
                    group
                `}
                onClick={() => commandBinding[3]()}
            >
                <FontAwesomeIcon className="text-gray-600 self-center" size="sm" icon={solidIcons.faMagnifyingGlass} />
                <span>Commands</span>
                <div className="flex-1 text-right">
                    {intersperse<React.ReactNode>(
                        "/",
                        commandBinding[0].map(k => <KeyComposition key={k} shortcut={k} Key={KeySymbol} />)
                    )}
                </div>
            </div>
        )
    }

    return (
        <Transition
            show={isVisible}
            className="absolute inset-y-0 h-full left-0 flex flex-col space-y-1 whitespace-nowrap overflow-auto bg-gray-100 w-56"
            enter="transition-transform"
            enterFrom="-translate-x-full"
            enterTo="translate-x-0"
            leave="transition-transform"
            leaveFrom="translate-x-0"
            leaveTo="-translate-x-full"
        >
            <button
                className={`
                    px-2 py-0.5 self-end text-gray-400
                    hover:text-gray-800 hover:bg-gray-200
                `}
                onClick={actions.toggleSidebar}
                >
                <FontAwesomeIcon icon={solidIcons.faAnglesLeft} />
            </button>

            <CommandSearchButton />

            <div className="h-3" />

            <HistoryButton />

            <SidebarMenu state={state} actions={actions} />

            <hr />

            {state.pages.map(page => (
                <Pages.PageEntry
                    key={page.id}
                    page={page}
                    openPage={state.viewState.openPage}
                    actions={actions}
                    isNameEditing={isNameEditing}
                    setIsNameEditing={setIsNameEditing}
                    />
            ))}
            <button
                className="px-2 py-0.5 w-full text-left text-xs text-gray-400 hover:text-blue-700"
                onClick={() => actions.addPage([])}
                >
                <FontAwesomeIcon icon={solidIcons.faPlus} />{' '}
                Add Page
            </button>
        </Transition>
    )
}




function SidebarMenu<State>({ actions }: ActionProps<State>) {
    type MenuItemProps<Elem extends React.ElementType> =
        React.ComponentPropsWithoutRef<Elem>
        & { as?: Elem }

    function MenuItem<Elem extends React.ElementType = 'button'>(
        props: MenuItemProps<Elem>
    ) {
        const { as: Element = 'button', children = null, ...restProps } = props
        return (
            <Menu.Item>
                {({ active }) => (
                    <Element className={`px-2 py-1 text-left ${active && "bg-blue-200"}`} {...restProps}>
                        {children}
                    </Element>
                )}
            </Menu.Item>
        )
    }

    return (
        <Menu as="div">
            <Menu.Button as={React.Fragment}>
                {({ open }) => (
                    <button
                        className={`
                            px-2 py-0.5 w-full text-left
                            ring-0 ring-blue-500 focus:ring-1
                            ${open ?
                                "text-blue-50 bg-blue-500 hover:bg-blue-500"
                            :
                                "hover:text-blue-950 hover:bg-blue-200"}
                        `}
                    >
                        File
                    </button>
                )}
            </Menu.Button>

            <Menu.Items className="w-full flex flex-col bg-gray-200 text-sm">
                <MenuItem onClick={actions.reset}>
                    New File
                </MenuItem>
                <MenuItem onClick={actions.save}>
                    Save File
                </MenuItem>
                <MenuItem as={LoadFileButton} onLoad={actions.loadLocalFile}>
                    Load local File ...
                </MenuItem>
                <MenuItem onClick={actions.loadRemoteFile}>
                    Load File from URL ...
                </MenuItem>
            </Menu.Items>
        </Menu>
    )
}


export function KeymapCollectorDialog({ keyMap, onCollectKey, onDone, onSkip }: CollectorDialogProps) {
    const ref = React.useRef<HTMLInputElement>()

    React.useEffect(() => {
        ref.current?.focus()
    })

    const noshiftCount = keyMap.valueSeq().map(({ noshift }) => noshift).filter(noshift => noshift).count()
    const shiftCount = keyMap.valueSeq().map(({ shift }) => shift).filter(shift => shift).count()

    const keyMapNotOnKeyboardVisualization = keyMap.filter((_value, key) => !KEYBOARD_CODES.includes(key))

    const noshiftMissing = keyMapNotOnKeyboardVisualization
        .valueSeq()
        .filter(({ noshift }) => !noshift)
        .map(({ shift }) => shift)
        .sort()
        .toArray()
    const shiftMissing = keyMapNotOnKeyboardVisualization
        .valueSeq()
        .filter(({ shift }) => !shift)
        .map(({ noshift }) => noshift)
        .sort()
        .toArray()

    const matches = keyMap.count() >= 40 && keyMap.every(({ shift, noshift }) => !!shift && !!noshift)

    return (
        <div className="w-full h-full flex justify-center items-center bg-gray-50">
            <div
                className="max-w-screen-sm w-full h-full flex justify-center items-center"
                style={{ containerType: 'size' }}
            >
            <div
                className="rounded-xl border border-gray-200 px-10 py-8 w-full flex flex-col space-y-5 text-center bg-white"
            >
                <p>
                    For shortcuts to work properly, we need to collect your{' '}
                    keyboard layout's mapping from physical keys to their{' '}
                    corresponding character once.
                </p>
                <p>
                    Please press all your keyboard keys one after another.
                </p>
                <p>
                    Once without any modifier keys (Ctrl, Alt/Option, Meta/Cmd, Shift).
                </p>
                <p>
                    Another time with only the Shift modifier pressed.
                </p>
                <KeyCollectorVisualization ref={ref} keyMap={keyMap} onCollectKey={onCollectKey} />
                <p>
                    Collected: {noshiftCount} without shift / {shiftCount} with shift
                </p>
                {shiftMissing.length > 0 &&
                    <p>
                        <FontAwesomeIcon className="text-red-500" icon={regularIcons.faCircleXmark} />{' '}
                        These keys need to be pressed with shift: {shiftMissing.map(key => <KeyButton keyName={key} />)}
                    </p>
                }
                {noshiftMissing.length > 0 &&
                    <p>
                        <FontAwesomeIcon className="text-red-500" icon={regularIcons.faCircleXmark} />{' '}
                        These keys need to be pressed without shift: {noshiftMissing.map(key => <KeyButton keyName={key} />)}
                    </p>
                }
                {matches &&
                    <p>
                        Looks good <FontAwesomeIcon className="text-green-500" icon={solidIcons.faCircleCheck} />
                    </p>
                }
                <div className="flex flex-col space-y-2 items-stretch">
                    <button
                        className={`rounded px-2 py-1 ${matches ? "border border-green-500 text-green-700" : "bg-gray-100 text-gray-500"}`}
                        disabled={!matches}
                        onClick={onDone}
                    >
                        I have pressed all keys
                    </button>
                    {!matches &&
                        <button
                            className="text-xs text-gray-500 hover:text-blue-500"
                            onClick={onSkip}
                        >
                            I won't use shortcuts - skip setup
                        </button>
                    }
                </div>
            </div>
            </div>
        </div>
    )
}

const KEYBOARD: [code: string, width?: number, ignore?: boolean][][] = [
    [["IntlBackslash"],["Digit1"],["Digit2"],["Digit3"],["Digit4"],["Digit5"],["Digit6"],["Digit7"],["Digit8"],["Digit9"],["Digit0"],["Minus"],["Equal"],["Backspace", 1.5, true]],
    [["Tab", 1.5, true],["KeyQ"],["KeyW"],["KeyE"],["KeyR"],["KeyT"],["KeyY"],["KeyU"],["KeyI"],["KeyO"],["KeyP"],["BracketLeft"],["BracketRight"],["Backslash"]],
    [["CapsLock", 1.8, true],["KeyA"],["KeyS"],["KeyD"],["KeyF"],["KeyG"],["KeyH"],["KeyJ"],["KeyK"],["KeyL"],["Semicolon"],["Quote"],["Enter", 1.8, true]],
    [["ShiftLeft", 1.2, true],["Backquote"],["KeyZ"],["KeyX"],["KeyC"],["KeyV"],["KeyB"],["KeyN"],["KeyM"],["Comma"],["Period"],["Slash"],["ShiftRight", 2.4, true]],
    [["fn", 1, true], ["ControlLeft", 1, true],["AltLeft", 1, true],["MetaLeft", 1.2, true],["Space", 5.3, true],["MetaRight", 1.2, true],["AltRight", 1, true],["ArrowLeft", 1.05, true],["ArrowUp", 1, true],["ArrowRight", 1.05, true]],
]

const KEYBOARD_CODES = Set(KEYBOARD.flatMap(row => row.map(([code]) => code)))


interface KeyCollectorVisualizationProps {
    keyMap: KeyMap
    onCollectKey(event: React.KeyboardEvent): void
}

const KeyCollectorVisualization = React.forwardRef<HTMLDivElement, KeyCollectorVisualizationProps>(function KeyCollectorVisualization(
    { keyMap, onCollectKey },
    ref,
) {
    const [keysDown, setKeysDown] = React.useState(Set())
    const isShift = keysDown.includes('ShiftLeft') || keysDown.includes('ShiftRight')

    function collectKey(event: React.KeyboardEvent) {
        setKeysDown(set => set.add(event.code))
        onCollectKey(event)
        event.stopPropagation()
        event.preventDefault()
    }

    function Key({ code, width = 1, ignore = false }: { code: string, width?: number, ignore?: boolean }) {
        const base = 6
        const { noshift, shift } = keyMap.get(code, { noshift: undefined, shift: undefined })
        const countKnown = (noshift ? 1 : 0) + (shift ? 1 : 0)
        const [primary, secondary] = isShift ? [shift, noshift] : [noshift, shift]
        const color = ['red-200', 'yellow-200', 'green-200'][countKnown]
        return (
            <div
                style={{ height: base + 'cqw', width: base * width + 'cqw' }}
                className={`
                    text-center rounded border
                    flex justify-center items-center relative
                    ${!ignore && `border-${color} shadow-${color}`}
                    ${!ignore && keysDown.includes(code) ? `translate-y-0.5` : 'shadow'}
                    ${ignore && (keysDown.includes(code) ? 'bg-gray-200' : 'bg-gray-100')}
                `}
            >
                {!ignore && <>
                    <span>{primary ?? ""}</span>
                    <div className="hidden sm:block absolute right-0.5 top-0.5 text-gray-300 text-xs">{secondary ?? ""}</div>
                </>}
            </div>
        )
    }

    return (
        <div
            ref={ref}
            tabIndex={-1}
            onKeyDown={collectKey}
            onKeyUp={event => { setKeysDown(set => set.remove(event.code)) }}
            className="w-full flex flex-col space-y-1 cursor-pointer opacity-50 focus:opacity-100 focus:outline-none"
        >
            {KEYBOARD.map(row =>
                <div className="flex flex-row space-x-1">
                    {row.map(([code, width=1, ignore=false]) => (
                        <Key code={code} width={width} ignore={ignore}/>
                    ))}
                </div>
            )}
        </div>
    )
})