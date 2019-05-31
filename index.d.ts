type transform = <T = any>(xml: string, template: object) => T;
type toJson = <T = any>(xml: string) => T;
type prettyPrint = <T = any>(xml: string) => T;
declare const camaro: { transform, toJson, prettyPrint };
export = camaro;