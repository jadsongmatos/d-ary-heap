declare module "@hpcc-js/wasm" {
  export class Graphviz {
    static load(): Promise<Graphviz>
    layout(dotSource: string, outputFormat: string, layoutEngine: string): Promise<string>
  }
}
