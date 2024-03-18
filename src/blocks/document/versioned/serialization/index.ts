export function typed<Obj extends object>(version: number, obj: Obj): Obj {
    return {
        t: 'resheet.document',
        v: version,
        ...obj,
    }
}

export function typedTables<Obj extends object>(version: number, obj: Obj): Obj {
    return {
        t: 'tables.document',
        v: version,
        ...obj,
    }
}
