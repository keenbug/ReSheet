import * as block from '@tables/core/block'
import { Block, Environment } from '@tables/core/block'

import { addRevision, addValidator } from '@tables/util/serialize'
import { boolean, array, number, any, string, lazy } from '@tables/util/validate'

import { typed } from '.'
import { PageId, PageState, Document, getName } from '../types/0'


const pageSchema = {
    id: number,
    name: string,
    state: any,
    children: array(lazy(() => pageSchema)),
    isCollapsed: boolean,
}

const documentSchema = {
    pages: array(pageSchema),
    template: any,
    viewState: {
        sidebarOpen: boolean,
        openPage: array(number),
    },
}


// Parsing previous to typing and versioning

type VPreParse = <Inner>(args: {
    updatePageStateAt(path: PageId[], action: (state: Inner) => Inner): void
    env: Environment
    innerBlock: Block<Inner>
}) => Document<Inner>

const vPre = addValidator<VPreParse>(
    documentSchema,
    json => ({ updatePageStateAt, env, innerBlock }) => {
        return parse(json, updatePageStateAt, env, innerBlock)
    }
)



// First parser with typing and versioning

function parse<Inner>(
    json: any,
    updatePageStateAt: (path: PageId[], action: (state: Inner) => Inner) => void,
    env: Environment,
    innerBlock: Block<Inner>,
): Document<Inner> {
    const {
        pages,
        template,
        viewState,
    } = json

    const loadedTemplate = parsePage(template, () => {}, env, innerBlock, [])
    const loadedPages = parseSiblingPages(pages, updatePageStateAt, env, innerBlock, [])
    return {
        pages: loadedPages,
        template: loadedTemplate,
        viewState,
    }
}


function parsePage<Inner>(
    json: any,
    updatePageStateAt: (path: PageId[], action: (state: Inner) => Inner) => void,
    env: Environment,
    innerBlock: Block<Inner>,
    path: PageId[]
): PageState<Inner> {
    const { id, name, state, children, isCollapsed } = json

    const pathHere = [...path, id]
    function localDispatch(action: block.BlockAction<Inner>) {
        updatePageStateAt(pathHere, page => action(page).state)
    }

    const loadedChildren = parseSiblingPages(children, updatePageStateAt, env, innerBlock, pathHere)
    const pageEnv = getSiblingsEnv(children, env)
    const loadedState = innerBlock.fromJSON(state, localDispatch, pageEnv)
    const page: PageState<Inner> = {
        id,
        name,
        state: loadedState,
        isCollapsed,
        children: loadedChildren,
    }
    return page

    function getSiblingsEnv(siblings: PageState<Inner>[], env: Environment) {
        return Object.assign(
            {},
            env,
            ...siblings.map(sibling => ({
                [getName(sibling)]: innerBlock.getResult(sibling.state)
            }))
        )
    }
}


function parseSiblingPages<Inner>(
    json: any[],
    updatePageStateAt: (path: PageId[], action: (state: Inner) => Inner) => void,
    env: Environment,
    innerBlock: Block<Inner>,
    path: PageId[]
): PageState<Inner>[] {
    return block.mapWithEnv(
        json,
        (jsonEntry, localEnv) => {
            const page = parsePage(jsonEntry, updatePageStateAt, localEnv, innerBlock, path)
            return {
                out: page,
                env: { [getName(page)]: innerBlock.getResult(page.state) },
            }
        },
        env,
    )
}


export type Parse = VPreParse

export const fromJSON = addRevision<Parse, VPreParse>(vPre, {
    schema: typed(0, documentSchema),
    parse: json => ({ updatePageStateAt, env, innerBlock }) => {
        return parse(json, updatePageStateAt, env, innerBlock)
    },
    upgrade: before => before,
})

export function toJSON<Inner>(state: Document<Inner>, innerBlock: Block<Inner>) {
    const { viewState } = state
    const template = pageToJSON(state.template, innerBlock)
    const pages = pagesToJSON(state.pages, innerBlock)
    return { pages, viewState, template }
}

function pagesToJSON<Inner>(pages: PageState<Inner>[], innerBlock: Block<Inner>) {
    return pages.map(page => pageToJSON(page, innerBlock))
}

function pageToJSON<Inner>(page: PageState<Inner>, innerBlock: Block<Inner>) {
    return {
        id: page.id,
        name: page.name,
        state: innerBlock.toJSON(page.state),
        isCollapsed: page.isCollapsed,
        children: pagesToJSON(page.children, innerBlock),
    }
}
