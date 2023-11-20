import { Block, Environment, mapWithEnv } from '../../block'
import * as Multiple from '../../block/multiple'
import { arrayEquals, catchAll } from '../../utils'
import { HistoryWrapper, initHistory, historyFromJSON, historyToJSON } from './history'
import { PageId, PageState } from './pages'
import * as Pages from './pages'

export interface ViewState {
    sidebarOpen: boolean
    openPage: PageId[]
}

export type ViewStateJSON = ViewState


export type DocumentState<State> = HistoryWrapper<DocumentInner<State>>

export interface DocumentInner<State> {
    readonly viewState: ViewState
    readonly pages: Array<PageState<State>>
}

export const init: DocumentState<any> = (
    initHistory({
        viewState: {
            sidebarOpen: true,
            openPage: [],
        },
        pages: [],
    })
)


export function getResult<State>(state: DocumentState<State>, env: Environment) {
    return Multiple.getResultEnv(state.inner.pages)
}


export function innerFromJSON<State>(json: any, env: Environment, innerBlock: Block<State>) {
    const {
        pages = [],
        viewState = {},
    } = json
    const {
        sidebarOpen = false,
        openPage = [],
    } = viewState

    const loadedPages = Pages.fromJSON(pages, env, innerBlock)
    return {
        pages: loadedPages,
        viewState: {
            sidebarOpen,
            openPage,
        },
    }
}

export function fromJSON<State>(json: any, env: Environment, innerBlock: Block<State>): DocumentState<State> {
    try {
        return historyFromJSON(json, env, (stateJSON, env) => {
            return innerFromJSON(stateJSON, env, innerBlock)
        })
    }
    catch (e) {
        return legacyFromJSON(json, env, innerBlock)
    }
}

function legacyFromJSON<State>(json: any, env: Environment, innerBlock: Block<State>): DocumentState<State> {
    const {
        block,
        pages = [],
        viewState = {},
    } = json
    const {
        sidebarOpen = false,
    } = viewState
    let {
        openPage = [],
    } = viewState
    const legacyBlockPage: PageState<State>[] = []
    if (block !== undefined) {
        const blockState = catchAll(
            () => innerBlock.fromJSON(block, env),
            (e) => innerBlock.init,
        )
        legacyBlockPage.push({
            id: -1, // hacky
            name: "Home",
            state: blockState,
            result: innerBlock.getResult(blockState, env),

            isCollapsed: true,
            children: [],
        })
        if (openPage.length === 0) {
            openPage = [-1]
        }
    }
    const loadedPages = Pages.fromJSON(pages, env, innerBlock)
    return {
        mode: { type: 'current' },
        history: [],
        inner: {
            pages: [ ...legacyBlockPage, ...loadedPages],
            viewState: {
                sidebarOpen,
                openPage,
            },
        }
    }

}

export function toJSON<State>(state: DocumentState<State>, innerBlock: Block<State>) {
    return historyToJSON(state, innerState => {
        const { viewState } = innerState
        const pages = Pages.toJSON(innerState.pages, innerBlock)
        return { pages, viewState }
    })
}






export function getOpenPage<State>(state: DocumentInner<State>): PageState<State> | null {
    return Pages.getPageAt(state.viewState.openPage, state.pages)
}

export function getOpenPageEnv<State>(
    state: DocumentInner<State>,
    env: Environment,
) {
    const page = getOpenPage(state)
    if (page === null) { return env }
    
    const siblings =
        state.viewState.openPage.length <= 1 ?
            state.pages
        :
            Pages.getPageAt(state.viewState.openPage.slice(0, -1), state.pages).children

    return Pages.getPageEnv(page, siblings, env)
}


export function deletePageAt<State>(
    path: PageId[],
    state: DocumentInner<State>,
    innerBlock: Block<State>,
    env: Environment,
): DocumentInner<State> {
    if (path.length === 0) { return state }
    const parentPath = path.slice(0, -1)
    const childIdToRemove = path.slice(-1)[0]

    if (parentPath.length === 0) {
        return {
            ...state,
            pages: Pages.updatePages(
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
        pages: Pages.updatePages(
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
    state: DocumentInner<State>,
    innerBlock: Block<State>,
    env: Environment,
): DocumentInner<State> {
    function addSibling(siblings: PageState<State>[]): [ PageId, PageState<State>[] ] {
        const newId = Multiple.nextFreeId(siblings)
        const newPage = {
            id: newId,
            name: "Untitled_" + newId,
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

    const newPages = Pages.updatePages(
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
    state: DocumentInner<State>,
    action: (state: State) => State,
    innerBlock: Block<State>,
    env: Environment,
): DocumentInner<State> {
    if (state.viewState.openPage.length === 0) {
        return state
    }

    return {
        ...state,
        pages: Pages.updatePages(
            [],
            state.pages,
            (path, page) => {
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





