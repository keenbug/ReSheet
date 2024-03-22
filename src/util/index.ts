export function clampBetween(minimumInclusive: number, maximumInclusive: number, value: number) {
    if (value < minimumInclusive) { return minimumInclusive }
    if (value > maximumInclusive) { return maximumInclusive }
    return value
}

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


export function stringify(value: any) {
    if (typeof value === 'string') {
        return JSON.stringify(value)
    }
    if (Array.isArray(value)) {
        return `[${value.map(stringify).join(', ')}]`
    }
    if (typeof value === 'object' && Object.getPrototypeOf(value) === null) {
        return `{ ${stringifyFields(value)} }`
    }
    if (value?.toString === Object.prototype.toString) {
        return `{ ${stringifyFields(value)} }`
    }
    if (value?.toString) {
        return value.toString()
    }
    return String(value)
}

export function stringifyFields(obj: object) {
    return Object.entries(obj)
        .map(([field, value]) => `${field}: ${stringify(value)}`)
        .join(', ')
}

export function uint8ArrayToBase64(uint8Array: Uint8Array) {
    const chunkSize = 6 * 1024 // must be a multiple of 6, so btoa doesn't add padding to a chunk
    const chunks = []
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
        const chunk = uint8Array.subarray(i, i + chunkSize)
        const binaryString = String.fromCharCode.apply(null, chunk)
        chunks.push(btoa(binaryString))
    }
    return chunks.join('')
}

export function base64ToUint8Array(base64String: string) {
    const binaryString = atob(base64String)
    const uint8Array = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
        uint8Array[i] = binaryString.charCodeAt(i)
    }
    return uint8Array
}

export function isPromise(value: any) {
    return typeof value?.then === 'function'
}