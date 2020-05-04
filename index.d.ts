declare const camaro: {
    ready(): Promise<void>;
    prettyPrint(xml: string, opts?: { indentSize: number }): Promise<string>;
    toJson(xml: string): Promise<any>;
    transform(xml: string, template: object): Promise<any>;
};

export = camaro;
