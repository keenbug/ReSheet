export function clampTo(minimumInclusive: number, maximumExclusive: number, value: number) {
    if (value < minimumInclusive) { return minimumInclusive }
    if (value >= maximumExclusive) { return maximumExclusive - 1 }
    return value
}

export function nextElem<E = string>(elem: E, allElems: Array<E>, eq?: (left: E, right: E) => boolean, delta: number = 1) {
    const elemIdx = eq ? allElems.findIndex(e => eq(e, elem)) : allElems.findIndex(e => e === elem)
    const nextElemIdx = (elemIdx + delta + allElems.length) % allElems.length
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

export function intersperse<E>(elem: E, array: E[]): E[] {
    return array.flatMap(item => [elem, item]).slice(1)
}

export function arrayEquals<E>(
    arr1: E[],
    arr2: E[],
    eq?: (left: E, right: E) => boolean,
): boolean {
    if (arr1.length !== arr2.length) {
        return false
    }

    if (!eq) {
        for (let i = 0; i < arr1.length; i++) {
            if (arr1[i] !== arr2[i]) {
                return false
            }
        }
    }
    else {
        for (let i = 0; i < arr1.length; i++) {
            if (!eq(arr1[i], arr2[i])) {
                return false
            }
        }
    }

    return true
}

export function arrayStartsWith<E>(
    prefix: E[],
    array: E[],
    eq?: (left: E, right: E) => boolean,
): boolean {
    return arrayEquals(
        prefix,
        array.slice(0, prefix.length),
        eq,
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


// Unfortunately not type-safe. Let's see how this experiment develops.
export function $update(
    update: (value: any) => any,
    obj: any,
    ...path: Array<string | number>
) {
    if (path.length === 0) {
        return update(obj)
    }

    const key = path[0]
    return {
        ...obj,
        [key]: $update(update, obj[key], ...path.slice(1)),
    }
}