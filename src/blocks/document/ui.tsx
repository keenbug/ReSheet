import * as React from 'react'

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import * as solidIcons from '@fortawesome/free-solid-svg-icons'
import { Menu } from '@headlessui/react'

import { Block, BlockRef, BlockUpdater, Environment } from '../../block'
import { LoadFileButton, getFullKey, saveFile, selectFile } from '../../ui/utils'
import { $update, arrayEquals } from '../../utils'

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

const ACTIONS = <State extends unknown>(
    update: BlockUpdater<DocumentState<State>>,
    innerBlock: Block<State>,
    env: Environment,
) => ({
    updateInner(action: (state: State) => State) {
        update(state => 
            History.updateHistoryInner(
                state,
                inner => Model.updateOpenPage(inner, action, innerBlock, env),
                env,
                json => Model.innerFromJSON(json, env, innerBlock),
            )
        )
    },

    reset() {
        update(() => Model.init)
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
            const newState = Model.fromJSON(content, env, innerBlock)
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
            const newState = Model.fromJSON(content, env, innerBlock)
            update(() => newState)
        }
        catch (e) {
            window.alert(`Could not load file from URL: ${e}`)
        }
    },

    addPage(path: PageId[]) {
        update(state =>
            History.updateHistoryInner(
                state,
                inner => Model.addPageAt(path, inner, innerBlock, env),
                env,
                json => Model.innerFromJSON(json, env, innerBlock),
            )
        )
    },

    deletePage(path: PageId[]) {
        update(state =>
            History.updateHistoryInner(
                state,
                inner => Model.deletePageAt(path, inner, innerBlock, env),
                env,
                json => Model.innerFromJSON(json, env, innerBlock),
            )
        )
    },

    setPageName(path: PageId[], name: string) {
        update(state => {
            return History.updateHistoryInner(
                state,
                innerState => {
                    return {
                        ...innerState,
                        pages: Pages.updatePages(
                            [],
                            innerState.pages,
                            (currentPath, page) => (
                                arrayEquals(path, currentPath) ?
                                    { ...page, name }
                                :
                                    page
                            ),
                            innerBlock,
                            env,
                        ),
                    }
                },
                env,
                json => Model.innerFromJSON(json, env, innerBlock),
            )
        })
    },

    openPage(path) {
        update(state => 
            History.updateHistoryInner(
                state,
                inner => $update(() => path, inner,'viewState','openPage'),
                env,
                json => Model.innerFromJSON(json, env, innerBlock),
            )
        )
    },

    toggleCollapsed(path) {
        update(state => {
            return History.updateHistoryInner(
                state,
                innerState => {
                    return {
                        ...innerState,
                        pages: Pages.updatePages(
                            [], 
                            innerState.pages,
                            (currentPath, page) => (
                                arrayEquals(path, currentPath) ?
                                    { ...page, isCollapsed: !page.isCollapsed }
                                :
                                    page
                            ),
                            innerBlock,
                            env,
                        ),
                    }
                },
                env,
                json => Model.innerFromJSON(json, env, innerBlock),
            )
        })
    },

    openHistory() {
        update(History.openHistory)
    },
    
    closeHistory() {
        update(History.closeHistory)
    },
    
    goBack() {
        update(History.goBackInHistory)
    },
    
    goForward() {
        update(History.goForwardInHistory)
    },
    
    restoreStateFromHistory() {
        update(state => History.restoreStateFromHistory(state, env, (state, env) => Model.innerFromJSON(state, env, innerBlock)))
    },
    
    toggleSidebar() {
        update(state => 
            History.updateHistoryInner(
                state,
                inner => $update(open => !open, inner,'viewState','sidebarOpen'),
                env,
                json => Model.innerFromJSON(json, env, innerBlock),
            )
        )
    },

})


function DocumentKeyHandler<State>(
    state: DocumentState<State>,
    actions: Actions<State>,
    containerRef: React.MutableRefObject<HTMLDivElement>,
    innerRef: React.MutableRefObject<BlockRef>,
) {
    return function onKeyDown(event: React.KeyboardEvent) {
        switch (getFullKey(event)) {
            // not sure about capturing this...
            case "C-n":
                if (
                    !(document.activeElement instanceof HTMLTextAreaElement)
                    && !(document.activeElement instanceof HTMLInputElement)
                ) {
                    actions.reset()
                    event.stopPropagation()
                    event.preventDefault()
                }
                return

            case "C-o":
                selectFile().then(file => {
                    actions.loadLocalFile(file)
                })
                event.stopPropagation()
                event.preventDefault()
                return

            case "C-s":
                actions.save()
                event.stopPropagation()
                event.preventDefault()
                return

            case "C-b":
                actions.toggleSidebar()
                event.stopPropagation()
                event.preventDefault()
                return

            case "C-z":
                if (state.mode.type === 'history') {
                    actions.goBack()
                }
                else {
                    actions.openHistory()
                }
                event.stopPropagation()
                event.preventDefault()
                return

            case "C-y":
                if (state.mode.type === 'history') {
                    actions.goForward()
                    event.stopPropagation()
                    event.preventDefault()
                }
                return

            case "Escape":
                if (state.mode.type === 'history') {
                    actions.closeHistory()
                    event.stopPropagation()
                    event.preventDefault()
                }
                else if (document.activeElement !== containerRef.current) {
                    containerRef.current?.focus()
                    event.stopPropagation()
                    event.preventDefault()
                }
                return

            case "C-Enter":
                if (state.mode.type === 'history') {
                    actions.restoreStateFromHistory()
                    event.stopPropagation()
                    event.preventDefault()
                }
                return

            case "Enter":
                if (containerRef.current === document.activeElement) {
                    innerRef.current?.focus()
                    event.stopPropagation()
                    event.preventDefault()
                }
                return
        }
    }
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

    const actions = ACTIONS(update, innerBlock, env)
    const onKeyDown = DocumentKeyHandler(state, actions, containerRef, innerRef)

    return (
        <HistoryView state={state} env={env} fromJSON={(json, env) => Model.innerFromJSON(json, env, innerBlock)}>
            {innerState => (
                <div
                    ref={containerRef}
                    tabIndex={-1}
                    onKeyDown={onKeyDown}
                    className="h-full relative flex"
                    >
                    <Sidebar state={innerState} actions={actions} isHistoryOpen={state.mode.type === 'history'} />
                    <SidebarButton state={innerState} actions={actions} />

                    <div className={`h-full overflow-y-scroll flex-1 ${innerState.viewState.sidebarOpen ? 'px-1' : 'px-10'}`}>
                        <HistoryModePanel state={state} actions={actions} />
                        <MainView
                            innerRef={innerRef}
                            state={state}
                            actions={actions}
                            innerState={innerState}
                            innerBlock={innerBlock}
                            env={env}
                            />
                    </div>
                </div>
            )}
        </HistoryView>
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

    const pageEnv = Model.getOpenPageEnv(innerState, env)
    return innerBlock.view({
        ref: innerRef,
        state: openPage.state,
        update: actions.updateInner,
        env: { ...env, ...pageEnv },
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
}

function Sidebar<State>({ state, actions, isHistoryOpen }: SidebarProps<State>) {
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
                <PageEntry key={page.id} page={page} openPage={state.viewState.openPage} actions={actions} />
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

