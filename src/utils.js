Array.prototype.forEachWithPrev = function(cb) {
  for (let i = 1; i < this.length; i++) {
    cb(this[i], this[i-1])
  }
}

// Sometimes numbers are spelled out,
// in that case we need to convert them to digits.
export const convertToNumber = number => ({
  een: 1, twee: 2, drie: 3, vier: 4,
  vijf: 5, zes: 6, zeven: 7, acht: 8,
  negen: 9, tien: 10, elf: 11, twaalf: 12,
  dertien: 13, veertien: 14, vijftien: 15, zestien: 16,
  zeventien: 17, achttien: 18, negentien: 19, twintig: 20
}[(number || '').toLowerCase()] || +number || 0)