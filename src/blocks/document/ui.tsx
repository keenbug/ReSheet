import * as React from 'react'

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import * as solidIcons from '@fortawesome/free-solid-svg-icons'
import { Menu } from '@headlessui/react'

import { Block, BlockRef, BlockUpdater, Environment } from '../../block'
import { LoadFileButton, saveFile, selectFile } from '../../ui/utils'
import { $update, arrayEquals, clampTo } from '../../utils'
import { Keybindings, ShortcutSuggestions, useShortcuts } from '../../ui/shortcuts'

import { DocumentState, DocumentInner } from './model'
import * as Model from './model'
import { PageEntry, PageId } from './pages'
import * as Pages from './pages'
import { HistoryView } from './history'
import * as History from './history'
import { HistoryModePanel } from './history'

type Actions<State> = ReturnType<typeof ACTIONS<State>>

interface ActionProps<State> {
    state: DocumentInner<State>
    actions: Actions<State>
}

function ACTIONS<State extends unknown>(
    update: BlockUpdater<DocumentState<State>>,
    innerBlock: Block<State>,
    env: Environment,
) {
    function updateInner(action: (state: DocumentInner<State>) => DocumentInner<State>) {
        update(state =>
            History.updateHistoryCurrent(
                state,
                action,
            )
        )
    }

    function updatePages(action: (pages: Pages.PageState<State>[]) => Pages.PageState<State>[]) {
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


function DocumentKeyBindings<State>(
    state: DocumentState<State>,
    actions: Actions<State>,
    containerRef: React.MutableRefObject<HTMLDivElement>,
    innerRef: React.MutableRefObject<BlockRef>,
    setIsNameEditing: (editing: boolean) => void,
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
                        setIsNameEditing(true)
                    },
                ],
                [
                    ["C-Shift-N"],
                    "none",
                    "new child page",
                    () => {
                        actions.addPage(state.inner.viewState.openPage)
                        setIsNameEditing(true)
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
        [
            ["C-Shift-D"],
            "none",
            "safe as default template",
            () => { actions.useAsTempate(state.inner.viewState.openPage) },
        ],
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
                    [" "],
                    "!inputFocused",
                    "toggle page collapsed",
                    () => { actions.toggleCollapsed(state.inner.viewState.openPage) },
                ],
                [
                    ["C-Enter"],
                    "none",
                    "edit page name",
                    () => { setIsNameEditing(true) },
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

    function setIsNameEditingInVisibleSidebar(editing: boolean) {
        if (editing && !state.inner.viewState.sidebarOpen) {
            actions.toggleSidebar()
        }
        setIsNameEditing(editing)
    }

    const actions = ACTIONS(update, innerBlock, env)
    const bindings = DocumentKeyBindings(state, actions, containerRef, innerRef, setIsNameEditingInVisibleSidebar)
    const bindingProps = useShortcuts(bindings)

    return (
        <>
            <HistoryModePanel state={state} actions={actions} />
            <HistoryView state={state} update={update} env={env} fromJSON={(json, env) => Model.innerFromJSON(json, actions.updateInner, env, innerBlock)}>
                {innerState => (
                    <div
                        ref={containerRef}
                        tabIndex={-1}
                        {...bindingProps}
                        className="h-full relative flex"
                        >
                        <Sidebar
                            state={innerState}
                            actions={actions}
                            isHistoryOpen={state.mode.type === 'history'}
                            isNameEditing={isNameEditing}
                            setIsNameEditing={setIsNameEditingInVisibleSidebar}
                            />
                        <SidebarButton state={innerState} actions={actions} />

                        <div className={`h-full overflow-y-scroll relative flex-1 ${innerState.viewState.sidebarOpen ? 'px-1' : 'px-10'}`}>
                            <MainView
                                key={innerState.viewState.openPage.join('.')}
                                innerRef={innerRef}
                                state={state}
                                actions={actions}
                                innerState={innerState}
                                innerBlock={innerBlock}
                                env={env}
                                />
                            <ShortcutSuggestions flat={false} className="absolute bottom-0 inset-x-0 p-1 bg-white overflow-x-scroll" />
                        </div>
                    </div>
                )}
            </HistoryView>
        </>
    )
}

interface MainViewProps<State> {
    innerRef: React.Ref<BlockRef>
    state: DocumentState<State>
    actions: Actions<State>
    innerState: DocumentInner<State>
    innerBlock: Block<State>
    env: Environment
}

function MainView<State>({
    innerRef,
    state,
    actions,
    innerState,
    innerBlock,
    env,
}: MainViewProps<State>) {
    const openPage = Model.getOpenPage(innerState)

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

    const pageEnv = Model.getOpenPageEnv(innerState, env, innerBlock)
    return innerBlock.view({
        ref: innerRef,
        state: openPage.state,
        update: actions.updateOpenPageInner,
        env: pageEnv,
    })
}


function SidebarButton<State>({ state, actions }: ActionProps<State>) {
    if (state.viewState.sidebarOpen) {
        return null
    }

    return (
        <div className="absolute top-1 left-2">
            <button className="text-gray-300 hover:text-gray-500 transition" onClick={actions.toggleSidebar}>
                <FontAwesomeIcon icon={solidIcons.faBars} />
            </button>
        </div>
    )
}



interface SidebarProps<State> extends ActionProps<State> {
    isHistoryOpen: boolean
    isNameEditing: boolean
    setIsNameEditing: (editing: boolean) => void
}

function Sidebar<State>({ state, actions, isHistoryOpen, isNameEditing, setIsNameEditing }: SidebarProps<State>) {
    function HistoryButton() {
        if (isHistoryOpen) {
            return (
                <button
                    className={`
                        px-2 py-0.5 w-full text-left
                        text-blue-50 bg-blue-700 hover:bg-blue-500
                    `}
                    onClick={actions.closeHistory}
                    >
                    <FontAwesomeIcon className="mr-1" size="xs" icon={solidIcons.faClockRotateLeft} />
                    History
                </button>
            )
        }

        return (
            <button
                className={`
                    px-2 py-0.5 w-full text-left
                    hover:text-blue-900 hover:bg-blue-200
                `}
                onClick={actions.openHistory}
                >
                <FontAwesomeIcon className="mr-1" size="xs" icon={solidIcons.faClockRotateLeft} />
                History
            </button>
        )
    }

    return (
        <div
            className={`
                flex flex-col space-y-1 whitespace-nowrap overflow-scroll bg-gray-100 transition-all
                sticky h-screen top-0
                ${state.viewState.sidebarOpen ? 'min-w-min w-56' : 'w-0'}
            `}
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

            <HistoryButton />

            <SidebarMenu state={state} actions={actions} />

            <hr />

            {state.pages.map(page => (
                <PageEntry
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
        </div>
    )
}




function SidebarMenu<State>({ state, actions }: ActionProps<State>) {
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
                                `}>
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

