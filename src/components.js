import { computeExpr } from './compute'
import { initialBlockState } from './value'


export const readonlyProps = values => (
    Object.fromEntries(
        Object.entries(values)
            .map(
                ([ name, value ]) => [
                    name,
                    { value, enumerable: true }
                ]
            )
    )
)

export const createEntity = (...components) => {
    const { props, ...methods } = components.reduce(CombinedComponent)
    const properties = readonlyProps(props)
    return Object.create(methods, properties)
}

export const combineComponents = (
    { props: firstProps, ...firstMethods},
    { props: secondProps, ...secondMethods }
) => ({
        props: { ...firstProps, ...secondProps },
        ...firstMethods,
        ...secondMethods,
    })

export const extendComponent = (component, extender) => {
    const { props: componentProps, ...componentMethods } = component
    const { props: extenderProps, ...extenderMethods } = extender(component)

    return {
        props: { ...componentProps, ...extenderProps },
        ...componentMethods,
        ...extenderMethods,
    }
}

export const ExtendedComponent = (component, ...extenders) =>
    extenders.reduce(extendComponent, component)


export const CombinedComponent = (...components) =>
    components.reduce(combineComponents)


export const StateComponent = props => ({
    props
})


export const UpdateComponent = {
    update(newValues) {
        return Object.create(
            Object.getPrototypeOf(this),
            readonlyProps({ ...this, ...newValues }),
        )
    },
}


export const filterEntries = (predicate, obj) => (
    Object.fromEntries(
        Object.entries(obj)
            .filter(([ name, value ]) => predicate(name, value))
    )
)


export const UtilsComponent = {
    applyWhen(cond, fn) {
        if (cond) {
            return fn(this)
        }
        else {
            return this
        }
    },
    call(method, ...args) {
        return method.apply(this, args)
    },
    safeUpdate(newValues) {
        const safeValues = filterEntries(
            name => this.hasOwnProperty(name),
            newValues
        )
        return this.update(safeValues)
    },
    mapFields(mappers) {
        const newValues =
            Object.fromEntries(
                Object.entries(mappers)
                    .map(
                        ([ name, fn ]) => [
                            name,
                            fn(this[name])
                        ]
                    )
            )
        return this.update(newValues)
    }
}


export const SaveLoadNothingComponent = {
    save() {
        return {}
    },

    load(obj) {
        if (Object.keys(obj).length > 0) {
            console.warn('stray content after load:', obj)
        }
        return this
    }
}

export const SaveLoadSimpleExtension = (...propNameList) => ante => ({
    save() {
        const saved = this.call(ante.save)
        const ownSave = filterEntries(name => propNameList.includes(name), this)
        return { ...saved, ...ownSave }
    },

    load(input) {
        const ownInput = filterEntries(name => propNameList.includes(name), input)
        const anteInput = filterEntries(name => !propNameList.includes(name), input)
        const loaded = this.call(ante.load, anteInput)
        return loaded.update(ownInput)
    },
})


export const SaveLoadJSExprExtension = SaveLoadSimpleExtension('expr')


export const JSExprComponent = {
    props: {
        expr: "",
    },

    exec(env) {
        return computeExpr(this.expr, env)
    },
}



export const CachedComputationComponent = {
    props: {
        cachedResult: null,
        invalidated: true,
        autorun: true,
    },

    updateExpr(expr) {
        return this
            .update({ expr })
            .invalidate()
    },
    precompute(env) {
        if (!this.invalidated) { return this }
        return this.update({
            cachedResult: this.exec(env)
        })
    },
    invalidate() {
        if (!this.autorun) { return this }
        return this.update({
            invalidated: true
        })
    },
    forcecompute(env) {
        return this.update({
            cachedResult: this.exec(env)
        })
    },
}



export const SaveLoadEnvironmentExtension = ante => ({
    load({ id, name, prev, ...input }) {
        const loaded = this.call(ante.load, input)
        const prevLoaded = prev && this.load(prev)
        return loaded.update({ id, name, prev: prevLoaded })
    },

    save() {
        const saved = this.call(ante.save)
        const prev = this.prev?.save() || null
        const { id, name } = this
        return { ...saved, id, name, prev }
    },
})

export const EnvironmentComponent = {
    props: {
        id: 0,
        name: "",
        prev: null,
    },

    getDefaultName() {
        return '$' + this.id
    },
    getName() {
        return this.name.length > 0 ? this.name : this.getDefaultName()
    },
    getNextFreeId(candidate = 0) {
        const freeCandidate = candidate <= this.id ? this.id + 1 : candidate
        return this.prev ? this.prev.getNextFreeId(freeCandidate) : freeCandidate
    },

    reindex(codeNotToClashWith) {
        const prev = this.prev?.reindex(codeNotToClashWith)
        const id = codeNotToClashWith.getNextFreeId(prev ? prev.id + 1 : 0)
        return this.update({ id, prev })
    },
    append(prev) {
        if (this.prev) {
            return this.update({ prev: this.prev.append(prev) })
        }
        else {
            return this.update({ prev })
        }
    },

    getWithId(id) {
        if (this.id === id) {
            return this
        }
        else {
            return this.prev?.getWithId(id)
        }
    },
    mapWithId(id, fn) {
        if (this.id === id) {
            return fn(this)
        }
        else {
            return this.update({
                prev: this.prev?.mapWithId(id, fn)
            })
        }
    },
    toList() {
        if (!this.prev) { return [this] }
        return [ this, ...this.prev.toList() ]
    },
    fromList(list) {
        return list.reduceRight(
            (prev, code) => code.update({ prev }),
            null,
        )
    },
}



export const CachedEnvironmentComponent = {
    precomputeAll(globalEnv) {
        const prev = this.prev?.precomputeAll(globalEnv)
        const env = prev ? prev.toEnv() : {}
        return this
            .precompute({ ...globalEnv, ...env })
            .update({ prev })
    },
    forcecomputeAll(globalEnv) {
        const prev = this.prev?.forcecomputeAll(globalEnv)
        const env = prev ? prev.toEnv() : {}
        return this
            .forcecompute({ ...globalEnv, ...env })
            .update({ prev })
    },

    updateExprWithId(id, expr) {
        return this
            .mapWithId(id, code => code.update({ expr }))
            .invalidateWithId(id)
    },
    invalidateWithId(id) {
        if (this.id === id) {
            return this.invalidate()
        }
        else {
            return this
                .update({
                    prev: this.prev.invalidateWithId(id)
                })
                .invalidate()
        }
    },

    toEnv() {
        return Object.fromEntries(
            this.toList()
                .map(code => [ code.getName(), code.cachedResult ])
        )
    },

    loadFrom(data) {
        return this.safeUpdate({
            ...data,
            prev: data.prev && this.loadFrom(data.prev),
        })
    },

}



export const USAGE_MODES = [ 'use-result', 'use-data' ]

export const SaveLoadBlockExtension = SaveLoadSimpleExtension('state')

export const BlockComponent = {
    props: {
        state: initialBlockState,
        usageMode: USAGE_MODES[0],
    }
}



export const defaultCodeUI = {
    isNameVisible: true,
    isCodeVisible: true,
    isResultVisible: true,
    isStateVisible: false,
}

export const CodeUIOptionsComponent = {
    props: {
        ui: defaultCodeUI,
    }
}


export const CodeBlock = createEntity(
    UpdateComponent,
    UtilsComponent,
    JSExprComponent,
    CachedComputationComponent,
    EnvironmentComponent,
    ExtendedComponent(
        SaveLoadNothingComponent,
        SaveLoadJSExprExtension,
        SaveLoadEnvironmentExtension,
        SaveLoadBlockExtension,
    ),
    CachedEnvironmentComponent,
    BlockComponent,
    CodeUIOptionsComponent,
)


export const CommandBlock = createEntity(
    UpdateComponent,
    UtilsComponent,
    JSExprComponent,
    CachedComputationComponent,
    StateComponent({ blockState: initialBlockState }),
    ExtendedComponent(
        SaveLoadNothingComponent,
        SaveLoadJSExprExtension,
        SaveLoadSimpleExtension('blockState'),
    )
)
