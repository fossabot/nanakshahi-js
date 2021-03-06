const julian = require( 'julian' )
const suncalc = require( 'suncalc' )
const englishMonths = require( 'months' )
const Calendar = require( 'kollavarsham/dist/calendar.js' )
const Celestial = require( 'kollavarsham/dist/celestial/index.js' )
const fromJulianToGregorian = require( './utils/fromJulianToGregorian' )
const toUnicodeNum = require( './utils/toUnicodeNum' )
const months = require( './json/months' )
const weekdays = require( './json/weekdays' )
const pakshNames = require( './json/paksh' )
const nakshatras = require( './json/nakshatras' )

// NOTICE: Suraj Sidhant is not used by current Punjab Jantris, Drik system is used
// Suraj Sidhant is needed for Historical Date calculations
const celestial = new Celestial( 'SuryaSiddhanta' )
const calendar = new Calendar( celestial )

const ujjain = {
  latitude: 23.2,
  longitude: 75.8,
}

const amritsar = {
  latitude: 31.6,
  longitude: 74.9,
}

/**
 * Returns given date to the corresponding date in the Panchang
 * @param {Object} date JavaScript Date() Object
 * @param {boolean} [isJulian=false] Set to true if entered date is in Julian Calendar
 * @return {Object} Panchang (Includes Lunar and Solar Date)
 * @example getPanchang( new Date() )
 */
function getPanchang( date, isJulian = false ) {
  let year
  let month
  let day
  let julianDay
  if ( isJulian === true ) {
    julianDay = fromJulianToGregorian( date )
    year = julian.toDate( julianDay ).getUTCFullYear()
    month = julian.toDate( julianDay ).getUTCMonth()
    day = julian.toDate( julianDay ).getUTCDate()
  } else {
    year = date.getFullYear()
    month = date.getMonth()
    day = date.getDate()
    // Julian Day at 12AM UTC
    julianDay = julian( new Date( Date.UTC( year, month, day ) ) )
  }
  const realDate = new Date( year, month, day )
  const weekday = realDate.getDay()

  // Calculate Amount of Lunar Days since the start of Kali Yuga
  let ahargana = Calendar.julianDayToAhargana( julianDay )

  // Calculate the Tithi at 6 AM (Bikrami New Day)
  const dayFraction = 0.25 // Sunrise
  ahargana += dayFraction

  // Desantara (Longitudinal correction)
  const desantara = ( amritsar.longitude - ujjain.longitude ) / 360
  ahargana -= desantara

  // Time of sunrise at local latitude
  // TODO: Replace this with suncalc
  const timeEquation = celestial.getDaylightEquation( year, amritsar.latitude, ahargana )
  ahargana -= timeEquation
  // Real Sunrise Time
  const sunriseDate = suncalc.getTimes( realDate, amritsar.latitude, amritsar.longitude ).sunrise
  let sunrise = sunriseDate.toLocaleString( 'en-US', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' } )
  sunrise += ' IST'

  // Calculate location via Planets
  const { trueSolarLongitude, trueLunarLongitude } = celestial.setPlanetaryPositions( ahargana )

  // Find tithi and longitude of conjunction
  const tithi = Celestial.getTithi( trueSolarLongitude, trueLunarLongitude )

  // Last conjunction and next conjunction
  const lastConjunctionLongitude = celestial.getLastConjunctionLongitude( ahargana, tithi )
  const nextConjunctionLongitude = celestial.getNextConjunctionLongitude( ahargana, tithi )

  // Find Mal Maas ("Dirty Month")
  const adhimasa = Calendar.getAdhimasa( lastConjunctionLongitude, nextConjunctionLongitude )
  let malMaas
  if ( adhimasa === 'Adhika-' ) {
    malMaas = true
  } else {
    malMaas = false
  }

  // Get Month
  let monthNum = Calendar.getMasaNum( trueSolarLongitude, lastConjunctionLongitude )

  // Solar Month and Day
  const { sauraMasa, sauraDivasa } = calendar.getSauraMasaAndSauraDivasa( ahargana, desantara )

  // Bikrami Solar Year starts with Vaisakh
  let solarMonthName = sauraMasa + 1
  if ( solarMonthName >= 12 ) {
    solarMonthName -= 12
  }

  // Find Kaliyuga Lunar Year
  let kaliYear = calendar.aharganaToKali( ahargana + ( 4 - monthNum ) * 30 )

  // Find Paksh and switch to Purnimanta system
  let tithiDay = Math.trunc( tithi ) + 1
  let paksh
  if ( tithiDay > 15 ) {
    paksh = pakshNames.vadi
    tithiDay -= 15
    if ( malMaas !== true ) {
      monthNum += 1 // Use Purnimanta system (Month ends with Pooranmashi)
    }
  } else {
    paksh = pakshNames.sudi
  }
  if ( monthNum >= 12 ) {
    monthNum -= 12
    if ( monthNum === 0 ) {
      kaliYear += 1 // Add Year for Chet Vadi (Phagan Vadi in Amanta System)
    }
  }

  // Get Bikrami and Saka Year from adjusted Kaliyuga Lunar Year
  const sakaYear = Calendar.kaliToSaka( kaliYear )
  const bikramiYear = sakaYear + 135

  // Pooranmashi
  let pooranmashi
  if ( paksh.en === 'Sudi' && tithiDay === 15 ) {
    pooranmashi = true
  } else {
    pooranmashi = false
  }

  // Get Bikrami Solar Year
  let solarYear = bikramiYear
  if ( sauraMasa === 0 && monthNum === 11 ) {
    solarYear += 1
  } else if ( ( sauraMasa === 10 || sauraMasa === 11 ) && ( monthNum === 0 || monthNum === 1 ) ) {
    solarYear -= 1
  }

  // Get nakshatra
  const nakshatra = Math.trunc( trueLunarLongitude * 27 / 360 )

  // Lunar Date Obj
  const lunarDate = {
    ahargana: Math.trunc( ahargana ),
    malMaas,
    pooranmashi,
    englishDate: {
      month: monthNum + 1,
      monthName: months[ monthNum ].en,
      paksh: paksh.en,
      tithi: tithiDay,
      year: bikramiYear,
    },
    punjabiDate: {
      month: toUnicodeNum( monthNum + 1 ),
      monthName: months[ monthNum ].pa,
      paksh: paksh.pa,
      tithi: toUnicodeNum( tithiDay ),
      year: toUnicodeNum( bikramiYear ),
    },
    nakshatra: nakshatras[ nakshatra ],
    tithiFraction: tithi % 1,
  }

  // Solar Date Obj
  const solarDate = {
    englishDate: {
      month: sauraMasa + 1,
      monthName: months[ solarMonthName ].en,
      date: sauraDivasa,
      year: solarYear,
      day: weekdays[ weekday ].en,
    },
    punjabiDate: {
      month: toUnicodeNum( sauraMasa + 1 ),
      monthName: months[ solarMonthName ].pa,
      date: toUnicodeNum( sauraDivasa ),
      year: toUnicodeNum( solarYear ),
      day: weekdays[ weekday ].pa,
    },
  }

  // Return Bikrami Obj
  let panchang = { // eslint-disable-line prefer-const
    gregorianDate: realDate,
    julianDay,
    lunarDate,
    solarDate,
    sunrise,
    kaliYear,
    sakaYear,
  }

  if ( julianDay < 2361221 || isJulian === true ) {
    // Get Julian date using Julian Day at noon (12PM)
    const julianDate = Calendar.julianDayToJulianDate( Math.trunc( julianDay ) + 1 )
    panchang.julianDate = {
      year: julianDate.year,
      month: julianDate.month,
      monthName: englishMonths[ julianDate.month - 1 ],
      date: julianDate.date,
    }
  }

  return panchang
}

module.exports = getPanchang
