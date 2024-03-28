import * as React from 'react'

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import * as solidIcons from '@fortawesome/free-solid-svg-icons'
import * as brandIcons from '@fortawesome/free-brands-svg-icons'
import { Menu, Transition } from '@headlessui/react'

import { setIn, updateIn } from 'immutable'

import { Block, BlockHandle, BlockAction, BlockDispatcher, Environment, extractActionDescription } from '@resheet/core/block'
import { arrayEquals, arrayStartsWith, clampTo, intersperse, isEqualDepth, nextElem } from '@resheet/util'
import { KeySymbol, KeyComposition, Keybinding, Keybindings, ShortcutSuggestions, useShortcuts, useBindingNotifications } from '@resheet/util/shortcuts'
import { fieldDispatcher } from '@resheet/util/dispatch'
import { useStable } from '@resheet/util/hooks'

import { LoadFileButton, saveFile, selectFile } from '../utils/ui'

import { SafeBlock } from '../component'

import * as Model from './model'
import * as Pages from './pages'
import { CommandSearch } from './commands'
import { HistoryWrapper } from './history'
import * as History from './history'
import { Document, PageId, PageState } from './versioned'
import * as versioned from './versioned'

const logoSmallSvg = new URL("../../../assets/images/logo-small.svg", import.meta.url)


type Actions<State> = ReturnType<typeof ACTIONS<State>>

interface ActionProps<State> {
    state: Document<State>
    actions: Actions<State>
}

function ACTIONS<State extends unknown>(
    dispatch: BlockDispatcher<Document<State>>,
    dispatchHistory: BlockDispatcher<HistoryWrapper<Document<State>>>,
    innerBlock: Block<State>,
    env: Environment,
) {
    const dispatchPages = fieldDispatcher('pages', dispatch)

    return {
        dispatchPage(path: PageId[], action: BlockAction<State>) {
            dispatch(doc => extractActionDescription(action, pureAction =>
                Model.updatePageAt(
                    path,
                    doc,
                    pureAction,
                    env,
                    innerBlock,
                    dispatch,
                )
            ))
        },


        reset() {
            dispatch(() => ({ state: Model.init(innerBlock.init), description: "cleared file" }))
        },

        save() {
            dispatchHistory(state => {
                const content = JSON.stringify(History.historyToJSON(state, doc => Model.toJSON(doc, innerBlock)))
                saveFile(
                    'ReSheet.json',
                    'application/json',
                    content,
                )
                return { state, description: "saved file" }
            })
        },

        async loadLocalFile(file: File) {
            const content = JSON.parse(await file.text())
            try {
                const newState = History.historyFromJSON(content, env, (json, env) => Model.fromJSON(json, dispatch, env, innerBlock))
                dispatchHistory(() => ({ state: newState, description: `loaded document from local file "${file.name}"` }))
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
                const newState = History.historyFromJSON(content, env, (json, env) => Model.fromJSON(json, dispatch, env, innerBlock))
                dispatchHistory(() => ({ state: newState, description: `loaded document from url "${url}"` }))
            }
            catch (e) {
                window.alert(`Could not load file from URL: ${e}`)
            }
        },

        useAsTempate(path: PageId[]) {
            dispatch(doc => ({
                state: {
                    ...doc,
                    template: Pages.getPageAt(path, doc.pages) ?? doc.template,
                },
                description: "saved current page as template",
            }))
        },

        addPage(path: PageId[]) {
            dispatch(doc => ({
                state: Model.addPageAt(path, doc),
                description: "added new page",
            }))
        },

        deletePage(path: PageId[]) {
            dispatch(doc => ({
                state: Model.deletePageAt(path, doc, innerBlock, env, dispatch),
                description: "deleted page",
            }))
        },

        setPageName(path: PageId[], name: string) {
            dispatch(doc => {
                return {
                    state: {
                        ...doc,
                        pages: Pages.updatePageAt(
                            path,
                            doc.pages,
                            page => ({ ...page, name }),
                            env,
                            innerBlock,
                            dispatchPages,
                        ),
                    }
                }
            })
        },

        nestPage(path: PageId[]) {
            dispatch(doc => {
                const [newPath, pages] = Pages.nestPage(path, doc.pages, env, innerBlock, dispatchPages)
                return {
                    state: {
                        ...doc,
                        pages,
                        viewState: {
                            ...doc.viewState,
                            openPage: newPath,
                        }
                    }
                }
            })
        },

        unnestPage(path: PageId[]) {
            dispatch(doc => {
                const [newPath, pages] = Pages.unnestPage(path, doc.pages, env, innerBlock, dispatchPages)
                return {
                    state: {
                        ...doc,
                        pages,
                        viewState: {
                            ...doc.viewState,
                            openPage: newPath,
                        }
                    }
                }
            })
        },

        movePage(delta: number, path: PageId[]) {
            dispatch(doc => {
                return {
                    state: {
                        ...doc,
                        pages: Pages.movePage(delta, path, doc.pages, innerBlock, env, dispatchPages),
                    },
                }
            })
        },

        openPage(path: PageId[]) {
            dispatch(doc => ({
                state: Model.changeOpenPage(path, doc)
            }))
        },

        openFirstChild(currentPath: PageId[]) {
            dispatch(doc => {
                const parent = Pages.getPageAt(currentPath, doc.pages)
                if (parent === null || parent.children.length === 0) { return { state: doc } }

                const path = [...currentPath, parent.children[0].id]
                return { state: Model.changeOpenPage(path, doc) }
            })
        },

        openParent(currentPath: PageId[]) {
            if (currentPath.length > 1) {
                dispatch(inner => ({
                    state: Model.changeOpenPage(currentPath.slice(0, -1), inner)
                }))
            }
        },

        openNextPage(currentPath: PageId[]) {
            dispatch(state => {
                const allPaths = Pages.getExpandedPaths(state.pages, currentPath)
                const openPageIndex = allPaths.findIndex(somePath => arrayEquals(somePath, currentPath))
                const nextPageIndex = clampTo(0, allPaths.length, openPageIndex + 1)

                const newPath = allPaths[nextPageIndex]
                if (!newPath) { return { state } }
                return { state: Model.changeOpenPage(newPath, state) }
            })
        },

        openPrevPage(currentPath: PageId[]) {
            dispatch(state => {
                const allPaths = Pages.getExpandedPaths(state.pages, currentPath)
                const openPageIndex = allPaths.findIndex(somePath => arrayEquals(somePath, currentPath))
                const prevPageIndex = clampTo(0, allPaths.length, openPageIndex - 1)

                const newPath = allPaths[prevPageIndex]
                if (!newPath) { return { state } }
                return { state: Model.changeOpenPage(newPath, state) }
            })
        },

        toggleCollapsed(path: PageId[]) {
            dispatch(state => {
                return {
                    state: {
                        ...state,
                        pages: Pages.updatePageAt(
                            path,
                            state.pages,
                            page => ({ ...page, isCollapsed: !page.isCollapsed }),
                            env,
                            innerBlock,
                            dispatchPages,
                        ),
                    }
                }
            })
        },

        toggleSidebar() {
            dispatch(state => ({
                state: updateIn(state, ['viewState', 'sidebarOpen'], open => !open)
            }))
        },

        setSidebarOpen(open: boolean) {
            dispatch(state => ({
                state: setIn(state, ['viewState', 'sidebarOpen'], open)
            }))
        }

    }
}


interface LocalActions {
    setIsNameEditing(editing: boolean): void
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
    state: Document<State>,
    actions: Actions<State>,
    containerRef: React.MutableRefObject<HTMLDivElement>,
    innerRef: React.MutableRefObject<BlockHandle>,
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
                        actions.addPage(state.viewState.openPage.slice(0, -1))
                        localActions.setIsNameEditing(true)
                    },
                ],
                [
                    ["C-Shift-N"],
                    "none",
                    "new child page",
                    () => {
                        actions.addPage(state.viewState.openPage)
                        localActions.setIsNameEditing(true)
                    },
                ],
                [
                    ["C-Backspace"],
                    "selfFocused",
                    "delete page",
                    () => { actions.deletePage(state.viewState.openPage) },
                ],
            ]
        },
        {
            description: "move pages",
            bindings: [
                [
                    ["C-Shift-K", "C-Shift-ArrowUp"],
                    "selfFocused",
                    "move page up",
                    () => { actions.movePage(-1, state.viewState.openPage) },
                ],
                [
                    ["C-Shift-J", "C-Shift-ArrowDown"],
                    "selfFocused",
                    "move page down",
                    () => { actions.movePage(1, state.viewState.openPage) },
                ],
                [
                    ["C-Shift-H", "C-Shift-ArrowLeft"],
                    "selfFocused",
                    "move page one level up",
                    () => { actions.unnestPage(state.viewState.openPage) },
                ],
                [
                    ["C-Shift-L", "C-Shift-ArrowRight"],
                    "selfFocused",
                    "move page one level down",
                    () => { actions.nestPage(state.viewState.openPage) },
                ],
            ]
        },
        {
            description: "move between pages",
            bindings: [
                [
                    ["K", "ArrowUp"],
                    "selfFocused",
                    "open prev page",
                    () => { actions.openPrevPage(state.viewState.openPage) },
                ],
                [
                    ["J", "ArrowDown"],
                    "selfFocused",
                    "open next page",
                    () => { actions.openNextPage(state.viewState.openPage) },
                ],
                [
                    ["L", "ArrowRight"],
                    "selfFocused",
                    "open first child page",
                    () => { actions.openFirstChild(state.viewState.openPage) },
                ],
                [
                    ["H", "ArrowLeft"],
                    "selfFocused",
                    "open parent page",
                    () => { actions.openParent(state.viewState.openPage) },
                ],
            ]
        },
        {
            description: "change page",
            bindings: [
                [
                    ["C-Shift-R"],
                    "selfFocused",
                    "edit page name",
                    () => { localActions.setIsNameEditing(true) },
                ],
                [
                    ["Space"],
                    "selfFocused",
                    "toggle page collapsed",
                    () => { actions.toggleCollapsed(state.viewState.openPage) },
                ],
                [
                    ["C-Shift-D"],
                    "none",
                    "safe as default template",
                    () => { actions.useAsTempate(state.viewState.openPage) },
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
                    "focus sidebar",
                    () => { actions.setSidebarOpen(true); containerRef.current?.focus() },
                ],
                [
                    ["Enter"],
                    "selfFocused",
                    "focus page content",
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
    state: Document<State>
    dispatch: BlockDispatcher<Document<State>>
    dispatchHistory: BlockDispatcher<HistoryWrapper<Document<State>>>
    env: Environment
    innerBlock: SafeBlock<State>
    blockRef?: React.Ref<BlockHandle> // not using ref because the <State> generic breaks with React.forwardRef
}

type ShortcutsViewMode = 'hidden' | 'flat' | 'full'
const SHORTCUTS_VIEW_MODES: ShortcutsViewMode[] = ['full', 'flat', 'hidden']

export function DocumentUi<State>({ state, dispatch, env, dispatchHistory, innerBlock, blockRef }: DocumentUiProps<State>) {
    const containerRef = React.useRef<HTMLDivElement>()
    const mainScrollRef = React.useRef<HTMLDivElement>()
    const innerRef = React.useRef<BlockHandle>()
    React.useImperativeHandle(
        blockRef,
        () => ({
            focus() {
                containerRef.current?.focus()
            }
        })
    )
    const [isNameEditing, setIsNameEditing] = React.useState(false)
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

    const actions = React.useMemo(
        () => ACTIONS(dispatch, dispatchHistory, innerBlock, env),
        [dispatch, dispatchHistory, innerBlock, env],
    )
    const bindings = DocumentKeyBindings(state, actions, containerRef, innerRef, localActions)
    const bindingProps = useShortcuts(bindings)

    React.useEffect(() => {
        mainScrollRef.current && mainScrollRef.current.scroll({ top: 0, behavior: 'instant' })
    }, [state.viewState.openPage])


    const sidebarVisible = state.viewState.sidebarOpen || isNameEditing

    return (
        <div
            ref={containerRef}
            tabIndex={-1}
            {...bindingProps}
            className="group/document-ui relative h-full w-full overflow-hidden outline-none"
            >
            <Sidebar
                state={state}
                actions={actions}
                isVisible={sidebarVisible}
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
                <div ref={mainScrollRef} className="flex-1 overflow-y-auto transition-all">
                    <MainView
                        key={state.viewState.openPage.join('.')}
                        innerRef={innerRef}
                        state={state}
                        actions={actions}
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
}

interface MainViewProps<State> {
    innerRef: React.Ref<BlockHandle>
    actions: Actions<State>
    state: Document<State>
    innerBlock: SafeBlock<State>
    env: Environment
    sidebarVisible: boolean
}

function MainView<State>({
    innerRef,
    actions,
    state,
    innerBlock,
    env,
    sidebarVisible,
}: MainViewProps<State>) {
    const openPage = Model.getOpenPage(state)
    const pageDeps = useStable(Model.getOpenPageDeps(state), (l, r) => isEqualDepth(l, r, 1))
    const pageEnv = React.useMemo(
        () => Model.pageDepsToEnv(pageDeps, env, innerBlock),
        [pageDeps, env, innerBlock],
    )
    const dispatchOpenPage = React.useCallback(
        (action: BlockAction<State>) => actions.dispatchPage(state.viewState.openPage, action),
        [state.viewState.openPage],
    )

    if (!openPage) {
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
                    {state.viewState.sidebarOpen ?
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
            <Breadcrumbs openPage={state.viewState.openPage} pages={state.pages} onOpenPage={actions.openPage} />
            <innerBlock.Component
                ref={innerRef}
                state={openPage.state}
                dispatch={dispatchOpenPage}
                env={pageEnv}
                />
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
    isNameEditing: boolean
    setIsNameEditing: (editing: boolean) => void
    commandBinding: Keybinding
}

function Sidebar<State>({ state, actions, isVisible, isNameEditing, setIsNameEditing, commandBinding }: SidebarProps<State>) {
    function CommandSearchButton() {
        return (
            <button
                className={`
                    rounded-full mx-2 px-3 py-0.5
                    flex flex-row items-baseline space-x-2
                    bg-gray-200 text-gray-400 border border-gray-300 
                    text-sm cursor-pointer
                    hover:bg-gray-100 hover:text-gray-900 hover:border-gray-400
                    transition
                    group
                `}
                onPointerDown={ev => { ev.preventDefault(); commandBinding[3]() }} // Not onClick so it fires before the focus changes
            >
                <FontAwesomeIcon className="text-gray-600 self-center" size="sm" icon={solidIcons.faMagnifyingGlass} />
                <span>Commands</span>
                <div className="flex-1 text-right">
                    {intersperse<React.ReactNode>(
                        "/",
                        commandBinding[0].map(k => <KeyComposition key={k} shortcut={k} Key={KeySymbol} />)
                    )}
                </div>
            </button>
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
                    absolute top-0 right-0
                    px-2 py-0.5 text-gray-400
                    hover:text-gray-800 hover:bg-gray-200
                `}
                onClick={actions.toggleSidebar}
            >
                <FontAwesomeIcon icon={solidIcons.faAnglesLeft} />
            </button>

            <div className="group/sidebar-header pl-2 flex items-baseline">
                <img src={logoSmallSvg.toString()} alt="ReSheet Logo" className="inline h-4 mr-1.5 saturate-0 group-hover/sidebar-header:saturate-100 transition-all"/>
                <span className="text-xl font-bold text-gray-500">
                    ReSheet <span className="text-xs font-normal">alpha</span>
                </span>
                <a
                    className="ml-2 text-gray-400 hover:text-blue-600"
                    href="https://github.com/keenbug/ReSheet"
                    target="_blank"
                >
                    <FontAwesomeIcon icon={brandIcons.faGithub} size="sm" title="ReSheet on GitHub"/>
                </a>
                <a
                    className="ml-1.5 text-gray-400 hover:text-blue-600"
                    href="https://discord.gg/TQePmKJNQP"
                    target="_blank"
                >
                    <FontAwesomeIcon icon={brandIcons.faDiscord} size="sm" title="ReSheet on Discord"/>
                </a>
            </div>

            <div className="h-2" />

            <CommandSearchButton />

            <div className="h-3" />

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
                <span className="inline-block px-0.5 w-6">
                    <FontAwesomeIcon icon={solidIcons.faPlus} />{' '}
                </span>
                Add Page
            </button>

            <div className="flex-1" />

            <div className="flex flex-col items-center py-1">
                {process.env.GITHUB_SHA &&
                    <a
                        className="font-mono text-xs text-gray-400 hover:text-blue-600"
                        href={
                            process.env.GITHUB_RUN_ID ? `https://github.com/keenbug/ReSheet/actions/runs/${process.env.GITHUB_RUN_ID}`
                            : `https://github.com/keenbug/ReSheet/commit/${process.env.GITHUB_SHA}`
                        }
                        target="_blank"
                    >
                        build {process.env.GITHUB_SHA.slice(0, 6)}
                    </a>
                }
                {process.env.LEGAL_NOTICE &&
                    <a
                        className="font-mono text-xs text-gray-400 hover:text-blue-600"
                        href={process.env.LEGAL_NOTICE}
                        target="_blank"
                    >
                        LEGAL NOTICE
                    </a>
                }
            </div>
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
