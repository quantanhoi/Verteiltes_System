'use strict';
export class Wertpapier {
    constructor(kurzel, preis) {
        this.kurzel = kurzel;
        this.preis = preis
    }
}
export const MSFT = new Wertpapier('MSFT', 300);
export const LSFT = new Wertpapier('LSFT', 280);