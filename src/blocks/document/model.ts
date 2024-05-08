import { Set } from 'immutable'

import { Block, BlockAction, BlockActionContext, BlockDispatcher, Environment } from '@resheet/core/block'
import * as Multiple from '@resheet/core/multiple'

import { fieldDispatcher } from '@resheet/util/dispatch'

import * as Pages from './pages'
import { Document, PageId, PageState } from './versioned'
import * as versioned from './versioned'


export function init<Inner>(initInner: Inner): Document<Inner> {
    return {
        viewState: {
            sidebarOpen: true,
            openPage: [],
        },
        template: Pages.init(-1, initInner),
        pages: [],
    }
}

export function fromJSON<Inner>(json: any, dispatch: BlockDispatcher<Document<Inner>>, env: Environment, innerBlock: Block<Inner>) {
    const dispatchPages = fieldDispatcher('pages', dispatch)
    function updatePageStateAt(path: PageId[], action: BlockAction<Inner>) {
        Pages.updatePageStateAt(path, dispatchPages, action, innerBlock)
    }

    return versioned.fromJSON(json)({ updatePageStateAt, env, innerBlock })
}

export { toJSON } from './versioned'

export function getResult<Inner>(state: Document<Inner>, innerBlock: Block<Inner>) {
    return Multiple.getResultEnv(state.pages, innerBlock)
}

export function recompute<Inner>(
    state: Document<Inner>,
    dispatch: BlockDispatcher<Document<Inner>>,
    env: Environment,
    changedVars: Set<string> | null,
    innerBlock: Block<Inner>,
) {
    const dispatchPages = fieldDispatcher('pages', dispatch)
    const { state: pages, changedPages } = (
        Pages.recomputePagesFrom(
            null,
            state.pages,
            env,
            changedVars,
            innerBlock,
            dispatchPages,
        )
    )
    return {
        state: { ...state, pages },
        invalidated: !changedPages.isEmpty(),
    }
}







export function getOpenPage<Inner>(state: Document<Inner>): PageState<Inner> | null {
    return Pages.getPageAt(state.viewState.openPage, state.pages)
}

export function getOpenPageDeps<Inner>(
    state: Document<Inner>,
) {
    return Pages.getPageDepsAt(state.viewState.openPage, state.pages)
}

export function pageDepsToEnv<Inner>(
    pageDeps: PageState<Inner>[],
    env: Environment,
    innerBlock: Block<Inner>,
) {
    return Object.assign(
        {},
        env,
        ...pageDeps.map(page =>
            Pages.toEnv(page, innerBlock)
        ),
    )
}


export function changeOpenPage<Inner>(
    path: PageId[],
    state: Document<Inner>,
): Document<Inner> {
    return {
        ...state,
        viewState: {
            ...state.viewState,
            openPage: path,
        }
    }
}


export function deletePageAt<Inner>(
    path: PageId[],
    state: Document<Inner>,
    innerBlock: Block<Inner>,
    env: Environment,
    dispatchInner: BlockDispatcher<Document<Inner>>,
): Document<Inner> {
    if (path.length === 0) { return state }

    const dispatchPages = fieldDispatcher('pages', dispatchInner)

    const parentPath = path.slice(0, -1)
    const childIdToRemove = path.slice(-1)[0]

    const nextPath = Pages.getNextOrPrevPath(path, state.pages)

    const pageToRemove = Pages.getPageAt(path, state.pages)

    const newPages = Pages.updatePageSiblingsAt(
        parentPath,
        state.pages,
        siblings => siblings.filter(child => child.id !== childIdToRemove),
    )
    return {
        ...state,
        pages: Pages.recomputePagesFrom(
            nextPath,
            newPages,
            env,
            Set([ versioned.getName(pageToRemove) ]),
            innerBlock,
            dispatchPages,
        )
            .state,
        viewState: {
            ...state.viewState,
            openPage: nextPath,
        }
    }
}


export function addPageAt<Inner>(
    path: PageId[],
    state: Document<Inner>,
    newPage?: PageState<Inner>,
): Document<Inner> {
    function addSibling(siblings: PageState<Inner>[]): [ PageId, PageState<Inner>[] ] {
        const page = newPage ?? {
            ...state.template,
            id: Multiple.nextFreeId(siblings),
            name: '',
        }
        return [
            page.id,
            [ ...siblings, page ],
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

export function updatePageAt_NO_RECOMPUTE<Inner>(
    path: PageId[],
    state: Document<Inner>,
    action: (state: Inner, context: BlockActionContext) => Inner,
    env: Environment,
    innerBlock: Block<Inner>,
): Document<Inner> {
    return {
        ...state,
        pages: (
            Pages.updatePageAt_NO_RECOMPUTE(
                path,
                state.pages,
                (page, context) => {
                    const state = action(page.state, context)
                    const result = innerBlock.getResult(state)
                    return {
                        ...page,
                        state,
                        result,
                    }
                },
                env,
                innerBlock,
            )
        ),
    }
}

export function recomputeFrom<Inner>(
    path: PageId[],
    state: Document<Inner>,
    env: Environment,
    innerBlock: Block<Inner>,
    dispatch: BlockDispatcher<Document<Inner>>,
): Document<Inner> {
    const dispatchPages = fieldDispatcher('pages', dispatch)
    return {
        ...state,
        pages: (
            Pages.recomputePagesFrom(
                path,
                state.pages,
                env,
                Set(),
                innerBlock,
                dispatchPages,
            )
                .state
        )
    }
}



