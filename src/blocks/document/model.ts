import * as block from '../../block'
import { Block, BlockUpdater, Environment } from '../../block'
import * as Multiple from '../../block/multiple'

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

export function fromJSON<Inner>(json, update: block.BlockUpdater<Document<Inner>>, env: block.Environment, innerBlock: block.Block<Inner>) {
    const updatePages = block.fieldUpdater('pages', update)
    function updatePageStateAt(path: PageId[], action: (state: Inner) => Inner) {
        Pages.updatePageStateAt(path, updatePages, action, env, innerBlock)
    }

    return versioned.fromJSON(json)({ updatePageStateAt, env, innerBlock })
}

export { toJSON } from './versioned'

export function getResult<Inner>(state: Document<Inner>, innerBlock: Block<Inner>) {
    return Multiple.getResultEnv(state.pages, innerBlock)
}

export function recompute<Inner>(state: Document<Inner>, update: BlockUpdater<Document<Inner>>, env: Environment, innerBlock: Block<Inner>) {
    const updatePages = block.fieldUpdater('pages', update)
    return {
        ...state,
        pages: Pages.recomputePagesFrom(
            null,
            state.pages,
            env,
            innerBlock,
            updatePages,
        ),
    }
}







export function getOpenPage<Inner>(state: Document<Inner>): PageState<Inner> | null {
    return Pages.getPageAt(state.viewState.openPage, state.pages)
}

export function getOpenPageEnv<Inner>(
    state: Document<Inner>,
    env: Environment,
    innerBlock: Block<Inner>
) {
    return Pages.getPageEnvAt(state.viewState.openPage, state.pages, env, innerBlock)
}


export function changeOpenPage<Inner>(
    path: PageId[],
    state: Document<Inner>,
    env: Environment,
    innerBlock: Block<Inner>,
    updateInner: BlockUpdater<Document<Inner>>,
): Document<Inner> {
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


export function deletePageAt<Inner>(
    path: PageId[],
    state: Document<Inner>,
    innerBlock: Block<Inner>,
    env: Environment,
    updateInner: BlockUpdater<Document<Inner>>,
): Document<Inner> {
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


export function addPageAt<Inner>(
    path: PageId[],
    state: Document<Inner>,
): Document<Inner> {
    function addSibling(siblings: PageState<Inner>[]): [ PageId, PageState<Inner>[] ] {
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

export function updateOpenPage<Inner>(
    state: Document<Inner>,
    action: (state: Inner) => Inner,
    innerBlock: Block<Inner>,
    env: Environment,
): Document<Inner> {
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





