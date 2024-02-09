export class DocsMap {
    private objects: WeakMap<object, React.FC> = new WeakMap()
    private other: Map<any, React.FC> = new Map()

    get(key: any): undefined | React.FC {
        if (typeof key === 'object' || typeof key === 'function') {
            return this.objects.get(key)
        }
        else {
            return this.other.get(key)
        }
    }

    set(key: any, value: React.FC) {
        if (typeof key === 'object' || typeof key === 'function') {
            this.objects.set(key, value)
        }
        else {
            this.other.set(key, value)
        }
    }
}