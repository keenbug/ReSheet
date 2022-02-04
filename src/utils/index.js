export const catchAll = (fn, onError = e => e) => {
    try {
        return fn()
    }
    catch (e) {
        return onError(e)
    }
}

export const nextElem = (elem, allElems) => {
    const elemIdx = allElems.findIndex(e => e === elem)
    const nextElemIdx = (elemIdx + 1) % allElems.length
    return allElems[nextElemIdx]
}

export const interpolate = (strings, interpolations, props) => {
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


export const mapObject = (obj, fn) => (
    Object.fromEntries(
        Object.entries(obj)
            .map(entry => fn(...entry))
    )
)

export const filterEntries = (predicate, obj) => (
    Object.fromEntries(
        Object.entries(obj)
            .filter(([ name, value ]) => predicate(name, value))
    )
)
