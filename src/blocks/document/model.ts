import { Block, Environment, mapWithEnv } from '../../block'
import { BlockEntry } from '../../block/multiple'
import * as Multiple from '../../block/multiple'
import { arrayEquals, catchAll } from '../../utils'
import { HistoryWrapper, initHistory, historyFromJSON, historyToJSON } from './history'

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

    const loadedPages = pagesFromJSON(pages, env, innerBlock)
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
    const loadedPages = pagesFromJSON(pages, env, innerBlock)
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
        const pages = pagesToJSON(innerState.pages, innerBlock)
        return { pages, viewState }
    })
}






export function getOpenPage<State>(state: DocumentInner<State>): PageState<State> | null {
    return getPageAt(state.viewState.openPage, state.pages)
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
            getPageAt(state.viewState.openPage.slice(0, -1), state.pages).children

    return getPageEnv(page, siblings, env)
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
    state: DocumentInner<State>,
    innerBlock: Block<State>,
    env: Environment,
): DocumentInner<State> {
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
        pages: updatePages(
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

