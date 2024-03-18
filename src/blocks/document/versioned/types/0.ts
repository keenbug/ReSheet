import { BlockEntry } from '@resheet/core/multiple'

export type PageId = number

export interface PageState<Inner> extends BlockEntry<Inner> {
    id: PageId
    name: string
    state: Inner

    isCollapsed: boolean
    children: Array<PageState<Inner>>
}

export interface ViewState {
    sidebarOpen: boolean
    openPage: PageId[]
}

export interface Document<Inner> {
    viewState: ViewState
    template: PageState<Inner>
    pages: Array<PageState<Inner>>
}

export function getDefaultName(page: PageState<unknown>) {
    return 'Untitled_' + page.id
}

export function getName(page: PageState<unknown>) {
    if (page.name.length === 0) {
        return getDefaultName(page)
    }
    return page.name
}
