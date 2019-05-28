type transform = <T = any>(xml: string, template: object) => T;
type toJson = <T = any>(xml: string) => T;
declare const camaro: { transform, toJson };
export = camaro;