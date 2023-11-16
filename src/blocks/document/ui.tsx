import * as React from 'react'

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import * as solidIcons from '@fortawesome/free-solid-svg-icons'
import * as regularIcons from '@fortawesome/free-regular-svg-icons'
import { Menu } from '@headlessui/react'
import { Block, BlockRef, BlockUpdater, Environment } from '../../block'
import { LoadFileButton, getFullKey, saveFile, selectFile } from '../../ui/utils'
import { useAutoretrigger } from '../../ui/hooks'
import { DocumentState, PageId, PageState } from './model'
import * as Model from './model'
import * as Multiple from '../../block/multiple'
import { $update, arrayEquals, arrayStartsWith } from '../../utils'

type Actions<State> = ReturnType<typeof ACTIONS<State>>

interface ActionProps<State> {
    state: DocumentState<State>
    actions: Actions<State>
}

const ACTIONS = <State extends unknown>(
    update: BlockUpdater<DocumentState<State>>,
    innerBlock: Block<State>,
    env: Environment,
) => ({
    updateInner(action: (state: State) => State) {
        update(state => 
            Model.updateOpenPage(state, action, innerBlock, env)
        )
    },

    reset() {
        update(() => Model.init(innerBlock.init))
    },

    save() {
        update(state => {
            const content = JSON.stringify(Model.toJSON(state, innerBlock))
            saveFile(
                state.name + '.json',
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
        update(state => Model.addPageAt(path, state, innerBlock, env))
    },

    deletePage(path: PageId[]) {
        update(state => Model.deletePageAt(path, state, innerBlock, env))
    },

    setPageName(path: PageId[], name: string) {
        update(state => {
            return {
                ...state,
                pages: Model.updatePages(
                    [],
                    state.pages,
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
        })
    },

    openPage(path) {
        update(state => 
            $update(() => path, state,'viewState','openPage')
        )
    },

    toggleCollapsed(path) {
        update(state => ({
            ...state,
            pages: Model.updatePages(
                [], 
                state.pages,
                (currentPath, page) => (
                    arrayEquals(path, currentPath) ?
                        { ...page, isCollapsed: !page.isCollapsed }
                    :
                        page
                ),
                innerBlock,
                env,
            ),
        }))
    },

    openHistory() {
        update(Model.openHistory)
    },
    
    closeHistory() {
        update(Model.closeHistory)
    },
    
    goBack() {
        update(Model.goBackInHistory)
    },
    
    goForward() {
        update(Model.goForwardInHistory)
    },
    
    restoreStateFromHistory() {
        update(state => Model.restoreStateFromHistory(state, innerBlock, env))
    },
    
    changeName(name: string) {
        update(state => ({ ...state, name }))
    },

    toggleSidebar() {
        update(state => 
            $update(open => !open, state,'viewState','sidebarOpen')
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
                if (state.viewState.mode.type === 'history') {
                    actions.goBack()
                }
                else {
                    actions.openHistory()
                }
                event.stopPropagation()
                event.preventDefault()
                return

            case "C-y":
                if (state.viewState.mode.type === 'history') {
                    actions.goForward()
                    event.stopPropagation()
                    event.preventDefault()
                }
                return

            case "Escape":
                if (state.viewState.mode.type === 'history') {
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
                if (state.viewState.mode.type === 'history') {
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

    function viewPage() {
        const openPage = Model.getOpenPage(state)
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
                            <Link onClick={() => !state.viewState.sidebarOpen && actions.toggleSidebar()}>
                                Sidebar
                            </Link>
                        }
                    </div>
                </div>
            )
        }

        const pageEnv = Model.getOpenPageEnv(state, env)
        return innerBlock.view({
            ref: innerRef,
            state: openPage.state,
            update: actions.updateInner,
            env: { history: state.history, ...env, ...pageEnv },
        })
    }

    function viewMode() {
        switch (state.viewState.mode.type) {
            case 'current':
                return viewPage()
            
            case 'history':
                const entryInHistory = state.history[state.viewState.mode.position]
                if (entryInHistory === undefined) { return null }

                const stateInHistory = Model.getHistoryState(entryInHistory, innerBlock, env)
                return innerBlock.view({
                    state: stateInHistory,
                    update: () => {},
                    env: {
                        ...env,
                        history: state.history.slice(0, state.viewState.mode.position)
                    },
                })
        }
    }

    return (
        <div
            ref={containerRef}
            tabIndex={-1}
            onKeyDown={onKeyDown}
            className="h-full relative flex"
            >
            <Sidebar state={state} actions={actions} />
            <SidebarButton state={state} actions={actions} />

            <div className={`h-full overflow-y-scroll flex-1 transition-all ${state.viewState.sidebarOpen ? 'px-1' : 'px-10'}`}>
                <HistoryModePanel state={state} actions={actions} />
                {viewMode()}
            </div>
        </div>
    )
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



function Sidebar<State>({ state, actions }: ActionProps<State>) {
    function HistoryButton() {
        switch (state.viewState.mode.type) {
            case 'current':
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

            case 'history':
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
                <PageEntry key={page.id} page={page} state={state} actions={actions} />
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


interface PageEntryProps<State> extends ActionProps<State> {
    page: PageState<State>
    path?: PageId[]
}

// TODO: break up
function PageEntry<State>({ page, path = [], state, actions }: PageEntryProps<State>) {
    const [editing, setIsEditing] = React.useState(false)

    const depth = path.length
    const indentDepth = 0.5
    const indentClass = (depth: number) => `pl-[${0.5 + depth * indentDepth}rem] pr-2`

    const pathHere = [ ...path, page.id ]
    const keyHere = pathHere.join('.')

    const pageInOpenPath = arrayStartsWith(pathHere, state.viewState.openPage.slice(0, -1))
    const pageCollapsed = page.isCollapsed && !pageInOpenPath
    const pageChildren = (
        pageCollapsed ?
            null
        : page.children.length === 0 ? (
            <button
                className={`${indentClass(depth + 1)} py-0.5 w-full text-left text-xs text-gray-400 hover:text-blue-700`}
                onClick={() => actions.addPage(pathHere)}
                >
                <FontAwesomeIcon icon={solidIcons.faPlus} />{' '}
                Add Page
            </button>
        ) : (
            page.children.map(child => (
                <PageEntry
                    key={keyHere + '.' + child.id}
                    page={child}
                    path={pathHere}
                    state={state}
                    actions={actions}
                    />
            ))
        )
    )
    const collapseIcon = (
        <button onClick={() => actions.toggleCollapsed(pathHere)}>
            <FontAwesomeIcon
                className="text-gray-500"
                icon={pageCollapsed ? solidIcons.faAngleRight : solidIcons.faAngleDown}
                />
        </button>
    )

    if (editing) {
        function onChange(event: React.ChangeEvent<HTMLInputElement>) {
            actions.setPageName(pathHere, event.target.value)
        }
        function onKeyDown(event: React.KeyboardEvent) {
            if (getFullKey(event) === 'Enter') {
                onCommitName()
                event.stopPropagation()
                event.preventDefault()
            }
        }
        function onCommitName() {
            if (page.name.trim() === '') {
                actions.setPageName(pathHere, 'Untitled ' + page.id)
            }
            else if (page.name !== page.name.trim()) {
                actions.setPageName(pathHere, page.name.trim())
            }
            setIsEditing(false)
        }
        return (
            <>
                <div
                    key={keyHere}
                    className={`
                        ${indentClass(depth)} py-1 text-left
                        ${String(pathHere) === String(state.viewState.openPage) && "bg-gray-300"}
                    `}
                    >
                    {collapseIcon}
                    <input type="text" autoFocus value={page.name} onChange={onChange} onBlur={onCommitName} onKeyDown={onKeyDown} />
                </div>
                {pageChildren}
            </>
        )
    }

    function onAddChild(event: React.MouseEvent) {
        actions.addPage(pathHere)
        event.stopPropagation()
    }
    function onDeleteChild(event: React.MouseEvent) {
        actions.deletePage(pathHere)
        event.stopPropagation()
    }

    return (
        <>
            <div
                key={keyHere}
                className={`
                    ${indentClass(depth)} py-1 text-left group cursor-pointer flex space-x-2
                    ${String(pathHere) === String(state.viewState.openPage) && "bg-gray-300"}
                `}
                onClick={() => actions.openPage(pathHere)}
                onDoubleClick={() => setIsEditing(true)}
                >
                {collapseIcon}
                <span className="flex-1">{page.name}</span>
                <button
                    className="hidden group-hover:inline-block text-gray-500 hover:text-blue-500"
                    onClick={onDeleteChild}
                    >
                    <FontAwesomeIcon icon={regularIcons.faTrashCan} />
                </button>
                <button
                    className="hidden group-hover:inline-block text-gray-500 hover:text-blue-500"
                    onClick={onAddChild}
                    >
                    <FontAwesomeIcon icon={solidIcons.faPlus} />
                </button>
            </div>
            {pageChildren}
        </>
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




function HistoryModePanel<State>({ state, actions }: ActionProps<State>) {
    const [startGoBack, stopGoBack] = useAutoretrigger(actions.goBack)
    const [startGoForward, stopGoForward] = useAutoretrigger(actions.goForward)

    if (state.viewState.mode.type !== 'history') {
        return null
    }

    return (
        <div
            className={`
                sticky top-0 left-0 right-0 z-10
                bg-blue-100 text-blue-950 backdrop-opacity-90 backdrop-blur
                shadow mb-2 flex space-x-2 items-baseline
            `}
            >
            <button className="px-2 rounded hover:bg-blue-500 hover:text-blue-50" onClick={actions.restoreStateFromHistory}>
                Restore
            </button>

            <div className="flex-1 flex space-x-1 px-2">
                <button className="px-2 hover:text-blue-500" onMouseDown={startGoBack} onMouseUp={stopGoBack} onMouseLeave={stopGoBack}>
                    <FontAwesomeIcon icon={solidIcons.faAngleLeft} />
                </button>
                <button className="px-2 hover:text-blue-500" onMouseDown={startGoForward} onMouseUp={stopGoForward} onMouseLeave={stopGoBack}>
                    <FontAwesomeIcon icon={solidIcons.faAngleRight} />
                </button>
                <div className="self-center px-1">
                    {formatTime(state.history[state.viewState.mode.position].time)}
                </div>
            </div>
        </div>
    )
}


const secondInMs = 1000
const minuteInMs = 60 * secondInMs
const hourInMs = 60 * minuteInMs
const dayInMs = 24 * hourInMs

const formatTime = (date: Date) => {
    const diffInMs = Date.now() - date.getTime()
    if (diffInMs < dayInMs) {
        return Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(date)
    }
    else {
        const formatOptions: Intl.DateTimeFormatOptions = {
            year: '2-digit',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        }
        return Intl.DateTimeFormat(undefined, formatOptions).format(date)
    }
}