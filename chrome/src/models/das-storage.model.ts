export interface DasStorageUtilsModel {
    getOption(prop: string, callback:any): any,
    getOptions(callback: any): any,
    setOption(prop: string, value: any, callback?: any): any,
    setOptions(valueByProp: any, callback: any): any,
    syncOptions(options: any): any,
    saveURLToWhitelist(url: string, callback: any): any,
    removeURLFromWhitelist(url: string, callback?: any): any,
    testForMatch(item: string, itemToTest: string): any
}

export interface Options {
    [p: string]: any
}
