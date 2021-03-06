const numbers = require( '../json/numbers' )

/**
 * Convert Number into Gurmukhi Number
 * @param {!number} number Number to Convert
 * @return {string} Number in Gurmukhi
 * @example toUnicodeNum( 1 )
 * @private
 */
function toUnicodeNum( number ) {
  let regex
  let string = number.toString()
  numbers.forEach( ( val, key ) => {
    regex = new RegExp( key, 'ug' )
    string = string.replace( regex, val )
  } )
  return string
}

module.exports = toUnicodeNum
