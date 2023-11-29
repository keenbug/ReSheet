import { Block, BlockUpdater, Environment, mapWithEnv } from '../../block'
import * as Multiple from '../../block/multiple'
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
    readonly template: PageState<State>
    readonly pages: Array<PageState<State>>
}

export function init<State>(initState: State): DocumentState<State> {
    return (
        initHistory({
            viewState: {
                sidebarOpen: true,
                openPage: [],
            },
            template: Pages.init(-1, initState),
            pages: [],
        })
    )
}


export function getResult<State>(state: DocumentState<State>, innerBlock: Block<State>) {
    return Multiple.getResultEnv(state.inner.pages, innerBlock)
}

export function recompute<State>(state: DocumentState<State>, update: BlockUpdater<DocumentState<State>>, env: Environment, innerBlock: Block<State>) {
    function updatePages(action: (state: PageState<State>[]) => PageState<State>[]) {
        update(state => ({
            ...state,
            inner: {
                ...state.inner,
                pages: action(state.inner.pages),
            },
        }))
    }
    return {
        ...state,
        inner: {
            ...state.inner,
            pages: Pages.recomputePagesFrom(
                null,
                state.inner.pages,
                env,
                innerBlock,
                updatePages,
            ),
        },
    }
}


export function innerFromJSON<State>(
    json: any,
    update: BlockUpdater<DocumentInner<State>>,
    env: Environment,
    innerBlock: Block<State>,
): DocumentInner<State> {
    const {
        pages = [],
        template,
        viewState = {},
    } = json
    const {
        sidebarOpen = true,
        openPage = [],
    } = viewState

    function updatePages(action: (state: PageState<State>[]) => PageState<State>[]) {
        update(state => ({
            ...state,
            pages: action(state.pages)
        }))
    }

    const loadedTemplate = (
        template ?
            Pages.pageFromJSON(template, () => {}, env, innerBlock, [])
        :
            Pages.init(-1, innerBlock.init)
    )
    const loadedPages = Pages.fromJSON(pages, updatePages, env, innerBlock, [])
    return {
        pages: loadedPages,
        template: loadedTemplate,
        viewState: {
            sidebarOpen,
            openPage,
        },
    }
}

export function fromJSON<State>(
    json: any,
    update: BlockUpdater<DocumentState<State>>,
    env: Environment,
    innerBlock: Block<State>
): DocumentState<State> {
    function updateInner(action: (state: DocumentInner<State>) => DocumentInner<State>) {
        update(state => ({
            ...state,
            inner: action(state.inner),
        }))
    }

    return historyFromJSON(json, env, (stateJSON, env) => {
        return innerFromJSON(stateJSON, updateInner, env, innerBlock)
    })
}

export function toJSON<State>(state: DocumentState<State>, innerBlock: Block<State>) {
    return historyToJSON(state, innerState => {
        const { viewState } = innerState
        const template = Pages.pageToJSON(innerState.template, innerBlock)
        const pages = Pages.toJSON(innerState.pages, innerBlock)
        return { pages, viewState, template }
    })
}






export function getOpenPage<State>(state: DocumentInner<State>): PageState<State> | null {
    return Pages.getPageAt(state.viewState.openPage, state.pages)
}

export function getOpenPageEnv<State>(
    state: DocumentInner<State>,
    env: Environment,
    innerBlock: Block<State>
) {
    return Pages.getPageEnvAt(state.viewState.openPage, state.pages, env, innerBlock)
}


export function changeOpenPage<State>(
    path: PageId[],
    state: DocumentInner<State>,
    env: Environment,
    innerBlock: Block<State>,
    updateInner: BlockUpdater<DocumentInner<State>>,
): DocumentInner<State> {
    return {
        ...state,
        pages: Pages.recomputePagesFrom(
            state.viewState.openPage,
            state.pages,
            env,
            innerBlock,
            action => updateInner(inner => ({ ...inner, pages: action(inner.pages) })),
        ),
        viewState: {
            ...state.viewState,
            openPage: path,
        }
    }
}


export function deletePageAt<State>(
    path: PageId[],
    state: DocumentInner<State>,
    innerBlock: Block<State>,
    env: Environment,
    updateInner: BlockUpdater<DocumentInner<State>>,
): DocumentInner<State> {
    if (path.length === 0) { return state }
    const parentPath = path.slice(0, -1)
    const childIdToRemove = path.slice(-1)[0]

    const nextDependentPath = Pages.getNextDependentPath(path, state.pages)

    const newPages = Pages.updatePageSiblingsAt(
        parentPath,
        state.pages,
        siblings => siblings.filter(child => child.id !== childIdToRemove),
    )
    return {
        ...state,
        pages: Pages.recomputePagesFrom(
            nextDependentPath,
            newPages,
            env,
            innerBlock,
            action => updateInner(state => ({ ...state, pages: action(state.pages) })),
        ),
        viewState: {
            ...state.viewState,
            openPage: nextDependentPath,
        }
    }
}


export function addPageAt<State>(
    path: PageId[],
    state: DocumentInner<State>,
): DocumentInner<State> {
    function addSibling(siblings: PageState<State>[]): [ PageId, PageState<State>[] ] {
        const newId = Multiple.nextFreeId(siblings)
        const newPage = {
            ...state.template,
            id: newId,
            name: '',
        }
        return [
            newId,
            [ ...siblings, newPage ],
        ]
    }

    let newId = null

    const newPages = (
        Pages.updatePageSiblingsAt(
            path,
            state.pages,
            siblings => {
                const [id, newSiblings] = addSibling(siblings)
                newId = id
                return newSiblings
            },
        )
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
    const openPageEnv = getOpenPageEnv(state, env, innerBlock)
    return {
        ...state,
        pages: (
            Pages.updatePageAt(
                state.viewState.openPage,
                state.pages,
                page => {
                    const state = action(page.state)
                    const result = innerBlock.getResult(state)
                    return {
                        ...page,
                        state,
                        result,
                    }
                },
            )
        ),
    }
}





