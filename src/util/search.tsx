import * as React from 'react'

import { useRefMap, useSyncRef } from '@tables/util/hooks'


export type Match = { prefix: string, match: string }[]

export function matchSearch(match: Match) {
    return match.map(({ match }) => match).join('')
}

export function fuzzyMatch(search: string, text: string): null | Match {
    if (search.length === 0) {
        return [{ prefix: text, match: '' }]
    }

    const matchStart = text.indexOf(search[0])
    if (matchStart < 0) {
        return null
    }

    const prefix = text.slice(0, matchStart)
    const textFromMatch = text.slice(matchStart)
    const maxMatchLength = Math.min(search.length, textFromMatch.length)
    let matchLength = 1
    while (matchLength < maxMatchLength && search[matchLength] === textFromMatch[matchLength]) {
        matchLength++
    }
    const fullMatch = textFromMatch.slice(0, matchLength)
    const restText = textFromMatch.slice(matchLength)
    const restSearch = search.slice(matchLength)

    const restMatch = fuzzyMatch(restSearch, restText)
    if (restMatch === null) {
        return null
    }

    return [
        { prefix, match: fullMatch },
        ...restMatch,
    ]
}

export function renderMatch(match: Match) {
    return match.map(({ prefix, match }, index) => (
        <React.Fragment key={index}>{prefix}<b>{match}</b></React.Fragment>
    ))
}

export function rankMatch(match: Match): number {
    const joinedMatch = match.map(({ match }) => match).join('')
    const joinedFull = match.flat().join('')
    const matchRatio = joinedMatch.length / joinedFull.length
    
    const wordFit = match
        .map(
            ({ prefix, match }) => (
                prefix.length === 0 || prefix.endsWith(" ") ? 0.8
                : match.includes(" ") ? 0.9
                : 1
            )
        )
        .reduce((a, b) => a + b, 0)

    return wordFit * (2 - matchRatio)
}

export interface SearchResult<Candidate> {
    id: number
    candidate: Candidate
    match: Match
    rank: number
}

export function filterSortFuzzyMatch<Candidate>(
    search: string,
    candidates: Candidate[],
    getText: (candidate: Candidate) => string,
): SearchResult<Candidate>[] {
    return candidates
        .flatMap((candidate, index) => {
            const match = fuzzyMatch(search, getText(candidate))
            if (match === null) { return [] }
            return [
                { id: index, candidate, match, rank: rankMatch(match) }
            ]
        })
        .sort((a, b) => a.rank - b.rank)
}

export interface SearchResultsProps<T> {
    search: string
    candidates: T[]
    getText(candidate: T): string
    children(props: SearchResultsContainerProps<T>): React.ReactNode
}

export interface SearchResultsContainerProps<T> {
    moveActiveBinding(delta: number): void
    ResultList(props: SearchResultsListProps<T>): React.ReactNode
}

export interface SearchResultsListProps<T> {
    children(props: SearchResultsEntryProps<T>): React.ReactNode
}

export interface SearchResultsEntryProps<T> {
    ref: React.Ref<HTMLElement>
    key: number
    active: boolean
    match: Match
    entry: T
}

export function useSearchResults<T>(search: string, candidates: T[], getText: (candidate: T) => string, scrollTo?: (index: number) => void) {
    const [selected, setSelected] = React.useState(0)
    const [setScrollRef, refMap] = useRefMap<number, { scrollIntoView(): void }>()
    const setRef = React.useCallback((id: number) => (element: HTMLElement) => {
        setScrollRef(id)({
            scrollIntoView() {
                element.scrollIntoView({ block: 'nearest' })
            }
        })
    }, [setScrollRef])

    const results = React.useMemo(() => filterSortFuzzyMatch(search, candidates, getText), [search, candidates, getText])
    const resultsRef = useSyncRef(results)

    const scrollToFocus = React.useCallback(function scrollToFocus(filteredIndex: number) {
        refMap.get(resultsRef.current[filteredIndex]?.id)?.scrollIntoView()
    }, [refMap, resultsRef])

    scrollTo = scrollTo ?? scrollToFocus

    const moveSelection = React.useCallback(function moveSelection(delta: number) {
        setSelected(selected => {
            const newSelected = (
                (selected + delta + /* so we don't get negative values: */ resultsRef.current.length)
                % resultsRef.current.length
            )
            scrollTo(newSelected)
            return newSelected
        })
    }, [scrollTo, resultsRef])

    const select = React.useCallback(function select(index: number, scroll: boolean = true) {
        scroll && scrollTo(index)
        setSelected(index)
    }, [scrollTo])

    React.useEffect(() => { select(0) }, [search])

    return {
        results,
        selected,
        moveSelection,
        select,
        setRef,
    }
}
