export function catchAll<Result>(fn: () => Result, onError: ((error: any) => Result) = e => e) {
    try {
        return fn()
    }
    catch (e) {
        return onError(e)
    }
}

export function nextElem(elem: string, allElems: Array<string>) {
    const elemIdx = allElems.findIndex(e => e === elem)
    const nextElemIdx = (elemIdx + 1) % allElems.length
    return allElems[nextElemIdx]
}

export function interpolate(strings: TemplateStringsArray, interpolations: Array<any>, props) {
    const computedInterpolations = interpolations.map(interpolation => {
        if (typeof interpolation === 'function') {
            return String(interpolation(props))
        }
        else {
            return String(interpolation)
        }
    })

    return strings.reduce(
        (prev, string, idx) =>
            prev.concat(string, computedInterpolations[idx] ?? ""),
        "",
    )
}


export function mapObject<V, V1>(
    obj: { [s: string]: V },
    fn: (key: string, value: V) => [string, V1]
) {
    return (
        Object.fromEntries(
            Object.entries(obj)
                .map(entry => fn(...entry))
        )
    )
}

export function filterEntries<V>(
    predicate: (key: string, value: V) => boolean,
    obj: { [s: string]: V }
) {
    return (
        Object.fromEntries(
            Object.entries(obj)
                .filter(entry => predicate(...entry))
        )
    )
}