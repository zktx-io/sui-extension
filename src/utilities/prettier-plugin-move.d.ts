declare module '@mysten/prettier-plugin-move/out/tree.js' {
  export class Tree {
    constructor(node: any, parent?: Tree | null);
    children: Tree[];
    type: string;
    text: string;
    isNamed: boolean;
    leadingComment: any[];
    trailingComment: any | null;
    getParent(): Tree | null;
    assignTrailingComments(): this;
    assignLeadingComments(): this;
    toJSON(): Record<string, any>;
  }
}

declare module '@mysten/prettier-plugin-move/out/printer.js' {
  export function print(path: any, options: any, print: any): string | string[];
}
