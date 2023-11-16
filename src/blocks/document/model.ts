import { Block, BlockDesc, Environment, mapWithEnv } from '../../block'
import { BlockEntry } from '../../block/multiple'
import * as Multiple from '../../block/multiple'
import { arrayEquals, catchAll } from '../../utils'

export interface ViewState {
    mode: ViewMode
    sidebarOpen: boolean
    openPage: PageId[]
}

export type ViewMode =
    | { type: 'current' }
    | { type: 'history', position: number }


export interface DocumentState<State> {
    readonly pages: Array<PageState<State>>
    readonly blockState: State
    readonly history: Array<HistoryEntry<State>>
    readonly viewState: ViewState
    readonly name: string
}

export function init<State>(initBlockState: State): DocumentState<State> {
    return {
        pages: [],
        blockState: initBlockState,
        history: [{ type: 'state', time: new Date(), blockState: initBlockState }],
        viewState: {
            mode: { type: 'current' },
            sidebarOpen: true,
            openPage: [],
        },
        name: '',
    }
}


export function fromJSON<State>(json: any, env: Environment, innerBlock: Block<State>): DocumentState<State> {
    const {
        block,
        history,
        name = '',
        pages = [],
        viewState = {},
    } = json
    const {
        sidebarOpen = false,
        openPage = [],
    } = viewState
    const blockState = catchAll(
        () => innerBlock.fromJSON(block, env),
        (e) => innerBlock.init,
    )
    const savedHistory = catchAll<HistoryEntry<State>[]>(
        () => historyFromJSON(history),
        (e) => [{ type: 'state', time: new Date(), blockState }],
    )
    const loadedPages = pagesFromJSON(pages, env, innerBlock)
    return {
        pages: loadedPages,
        blockState,
        history: savedHistory,
        viewState: {
            mode: { type: 'current' },
            sidebarOpen,
            openPage,
        },
        name,
    }
}

export function toJSON<State>(state: DocumentState<State>, innerBlock: Block<State>) {
    const block = innerBlock.toJSON(state.blockState)
    const history = historyToJSON(state.history, innerBlock)
    const viewState = { sidebarOpen: state.viewState.sidebarOpen }
    const pages = pagesToJSON(state.pages, innerBlock)
    return { pages, block, history, name: state.name, viewState }
}






export function getOpenPage<State>(state: DocumentState<State>): PageState<State> | null {
    return getPageAt(state.viewState.openPage, state.pages)
}

export function getOpenPageEnv<State>(
    state: DocumentState<State>,
    env: Environment,
) {
    const page = getOpenPage(state)
    if (page === null) { return env }
    
    const siblings =
        state.viewState.openPage.length <= 1 ?
            state.pages
        :
            getPageAt(state.viewState.openPage.slice(0, -1), state.pages).children

    return getPageEnv(page, siblings, { ...env, history: state.history })
}


export function deletePageAt<State>(
    path: PageId[],
    state: DocumentState<State>,
    innerBlock: Block<State>,
    env: Environment,
): DocumentState<State> {
    if (path.length === 0) { return state }
    const parentPath = path.slice(0, -1)
    const childIdToRemove = path.slice(-1)[0]
    if (parentPath.length === 0) {
        return {
            ...state,
            pages: updatePages(
                [],
                state.pages.filter(page => page.id !== childIdToRemove),
                (_currentPath, page) => page,
                innerBlock,
                env,
            ),
        }
    }
    return {
        ...state,
        pages: updatePages(
            [],
            state.pages,
            (currentPath, page) => {
                if (!arrayEquals(currentPath, parentPath)) {
                    return page
                }
                return {
                    ...page,
                    children: page.children.filter(child => child.id !== childIdToRemove),
                }
            },
            innerBlock,
            env,
        ),
    }
}


export function addPageAt<State>(
    path: PageId[],
    state: DocumentState<State>,
    innerBlock: Block<State>,
    env: Environment,
): DocumentState<State> {
    function addSibling(siblings: PageState<State>[]): [ PageId, PageState<State>[] ] {
        const newId = Multiple.nextFreeId(siblings)
        const newPage = {
            id: newId,
            name: "Untitled " + newId,
            state: innerBlock.init,
            result: null,

            isCollapsed: true,
            children: [],
        }
        return [
            newId,
            [ ...siblings, newPage ],
        ]
    }

    if (path.length === 0) {
        const [id, pages] = addSibling(state.pages)
        return {
            ...state,
            viewState: {
                ...state.viewState,
                openPage: [id],
            },
            pages,
        }
    }

    let newId = null

    const newPages = updatePages(
        [],
        state.pages,
        (currentPath, page) => {
            if (!arrayEquals(currentPath, path)) {
                return page
            }
            const [id, children] = addSibling(page.children)
            newId = id
            return { ...page, children }
        },
        innerBlock,
        env,
    )

    if (newId === null) { return state }

    return {
        ...state,
        viewState: {
            ...state.viewState,
            openPage: [...path, newId],
        },
        pages: newPages,
    }
}

export function updateOpenPage<State>(
    state: DocumentState<State>,
    action: (state: State) => State,
    innerBlock: Block<State>,
    env: Environment,
): DocumentState<State> {
    if (state.viewState.openPage.length === 0) {
        const blockState = action(state.blockState)
        return {
            ...state,
            blockState,
            history: reduceHistory([
                ...state.history,
                { type: 'state', time: new Date(), blockState },
            ]),
        }
    }

    return {
        ...state,
        pages: updatePages(
            [],
            state.pages,
            (path, page) => {
                console.log(state.viewState.openPage, path)
                if (arrayEquals(path, state.viewState.openPage)) {
                    return {
                        ...page,
                        state: action(page.state),
                    }
                }
                return page
            },
            innerBlock,
            env,
        ),
    }
}






/**************** Pages **************/

export type PageId = number

export interface PageState<State> extends BlockEntry<State> {
    id: PageId
    name: string
    state: State
    result: unknown

    isCollapsed: boolean
    children: Array<PageState<State>>
}

export function getPageAt<State>(path: PageId[], pages: Array<PageState<State>>) {
    if (path.length === 0) { return null }

    const page = pages.find(page => page.id === path[0])
    if (page === undefined) { return null }
    if (path.length === 1) { return page }

    return getPageAt(path.slice(1), page.children)
}

export function getPageEnv<State>(
    page: PageState<State>,
    siblings: PageState<State>[],
    env: Environment,
) {
    const siblingsEnv = Multiple.getEntryEnvBefore(siblings, page.id)
    const childrenEnv = Multiple.getResultEnv(page.children)
    
    return { ...env, ...siblingsEnv, ...childrenEnv }
}


export function updatePages<State>(
    currentPath: PageId[],
    pages: Array<PageState<State>>,
    update: (path: PageId[], page: PageState<State>, localEnv: Environment) => PageState<State>,
    innerBlock: Block<State>,
    env: Environment,
) {
    return mapWithEnv(
        pages,
        (page, localEnv) => {
            const pathHere = [...currentPath, page.id]

            const children = updatePages(pathHere, page.children, update, innerBlock, localEnv)
            const localEnvWithChildren = { ...localEnv, ...Multiple.getResultEnv(children) }

            const newPage = update(pathHere, { ...page, children }, localEnvWithChildren)
            const result = innerBlock.getResult(newPage.state, localEnvWithChildren)
            return {
                out: { ...newPage, result },
                env: { [Multiple.entryName(newPage)]: result },
            }
        },
        env,
    )
}

function pagesToJSON<State>(pages: PageState<State>[], innerBlock: Block<State>) {
    return pages.map(page => ({
        id: page.id,
        name: page.name,
        state: innerBlock.toJSON(page.state),
        result: page.result,
        isCollapsed: page.isCollapsed,
        children: pagesToJSON(page.children, innerBlock),
    }))
}

function pagesFromJSON<State>(json: any[], env: Environment, innerBlock: Block<State>): Array<PageState<State>> {
    return mapWithEnv(
        json,
        (jsonEntry, localEnv) => {
            const { id, name, state, children, isCollapsed = true } = jsonEntry
            const loadedChildren = pagesFromJSON(children, localEnv, innerBlock)
            const pageEnv = { ...localEnv, ...Multiple.getResultEnv(children) }
            const loadedState = innerBlock.fromJSON(state, pageEnv)
            const result = innerBlock.getResult(loadedState, pageEnv)
            const page: PageState<State> = {
                id,
                name,
                state: loadedState,
                result,
                isCollapsed,
                children: loadedChildren,
            }
            return {
                out: page,
                env: Multiple.entryToEnv(page)
            }
        },
        env,
    )
}



/**************** History **************/

export type HistoryEntry<State> =
    | {
        readonly type: 'state'
        readonly time: Date
        readonly blockState: State
    }
    | {
        readonly type: 'json'
        readonly time: Date
        readonly blockJSON: any
    }


export function openHistory<State>(state: DocumentState<State>): DocumentState<State> {
    if (state.history.length > 0) {
        return {
            ...state,
            viewState: {
                ...state.viewState,
                mode: {
                    type: 'history',
                    position: state.history.length - 1,
                },
            },
        }
    }
    return state
}

export function closeHistory<State>(state: DocumentState<State>): DocumentState<State> {
    return {
        ...state,
        viewState: {
            ...state.viewState,
            mode: { type: 'current' },
        },
    }
}

export function goBackInHistory<State>(state: DocumentState<State>): DocumentState<State> {
    if (state.viewState.mode.type === 'history') {
        return {
            ...state,
            viewState: {
                ...state.viewState,
                mode: {
                    ...state.viewState.mode,
                    position: Math.max(0, state.viewState.mode.position - 1),
                }
            }
        }
    }
    return state
}

export function goForwardInHistory<State>(state: DocumentState<State>): DocumentState<State> {
    if (state.viewState.mode.type === 'history') {
        return {
            ...state,
            viewState: {
                ...state.viewState,
                mode: {
                    ...state.viewState.mode,
                    position: Math.min(state.viewState.mode.position + 1, state.history.length - 1),
                }
            }
        }
    }
    return state
}

export function restoreStateFromHistory<State>(
    state: DocumentState<State>,
    innerBlock: BlockDesc<State>,
    env: Environment,
): DocumentState<State> {
    if (state.viewState.mode.type === 'history') {
        const historicState = state.history[state.viewState.mode.position]
        const historicEnv = {
            ...env,
            history: state.history.slice(0, state.viewState.mode.position)
        }
        return {
            ...state,
            history: [ ...state.history, historicState ],
            blockState: getHistoryState(historicState, innerBlock, historicEnv),
            viewState: {
                ...state.viewState,
                mode: { type: 'current' },
            },
        }
    }
    return state
}



export function getHistoryState<State>(entry: HistoryEntry<State>, innerBlock: BlockDesc<State>, env: Environment) {
    switch (entry.type) {
        case 'state':
            return entry.blockState
        case 'json':
            return innerBlock.fromJSON(entry.blockJSON, env)
    }
}

export function historyToJSON<State>(history: Array<HistoryEntry<State>>, innerBlock: BlockDesc<State>) {
    return history.map(entry => {
        switch (entry.type) {
            case 'json':
                return {
                    time: entry.time.getTime(),
                    state: entry.blockJSON,
                }
            case 'state':
                return {
                    time: entry.time.getTime(),
                    state: innerBlock.toJSON(entry.blockState),
                }
        }
    })
}

export function historyFromJSON<State>(
    json: { time: number, state: any }[],
): HistoryEntry<State>[] {
    return json.map(historyEntryJson => (
        {
            type: 'json',
            time: new Date(historyEntryJson.time),
            blockJSON: historyEntryJson.state,
        }
    ))
}

export function reduceHistory<State>(history: Array<HistoryEntry<State>>): Array<HistoryEntry<State>> {
    return history.filter((entry, index) => {
        const nextTime = history[index + 1]?.time?.getTime() ?? Number.POSITIVE_INFINITY
        const differenceMS = nextTime - entry.time.getTime()
        const reverseIndex = history.length - index
        return differenceMS / 100 > reverseIndex ** 2
    })
}
