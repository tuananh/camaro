type transform = <T = any>(xml: string, transform: object) => T;
declare const camaro: transform;
export = camaro;