import { convertToNumber } from './utils'
import { parse, differenceInCalendarDays, differenceInMinutes } from 'date-fns'

// We just get the HTML straight from rivm.nl
const resource = 'https://www.rivm.nl/nieuws/actuele-informatie-over-coronavirus'
// But we need to use a CORS proxy for that.
const proxy = 'https://cors-anywhere.herokuapp.com'
const rivm = `${proxy}/${resource}`

let nice = `${proxy}/https://www.stichting-nice.nl`
const activeICUAdmissions = `${nice}/covid-19/public/intake-count/`
const icAdmissions = `${nice}/covid-19/public/intake-cumulative/`
const totalFatalICUAdmissions = `${nice}/covid-19/public/died-cumulative/`

const initialData = [
  {
    date: new Date('2020-02-21'),
    newDeaths: 0,
    totalDeaths: 0,
    newICUAdmissions: 1,
    activeICUAdmissions: 1,
    totalICUAdmissions: 1,
    totalFatalICUAdmissions: 1,
    presumablyRecoveredFromICU: 0,
    confirmedNewCases: 1,
    confirmedTotalCases: 1,
  },
  {
    date: new Date('2020-02-22'),
    newDeaths: 0,
    totalDeaths: 0,
    newICUAdmissions: 0,
    activeICUAdmissions: 1,
    totalICUAdmissions: 1,
    confirmedNewCases: 0,
    confirmedTotalCases: 1,
  },
  {
    date: new Date('2020-02-23'),
    newDeaths: 0,
    totalDeaths: 0,
    newICUAdmissions: 0,
    activeICUAdmissions: 1,
    totalICUAdmissions: 1,
    confirmedNewCases: 0,
    confirmedTotalCases: 1,
  },
  {
    date: new Date('2020-02-24'),
    newDeaths: 0,
    totalDeaths: 0,
    newICUAdmissions: 0,
    activeICUAdmissions: 1,
    totalICUAdmissions: 1,
    confirmedNewCases: 0,
    confirmedTotalCases: 1,
  },
  {
    date: new Date('2020-02-25'),
    newDeaths: 0,
    totalDeaths: 0,
    newICUAdmissions: 0,
    activeICUAdmissions: 1,
    totalICUAdmissions: 1,
    confirmedNewCases: 0,
    confirmedTotalCases: 1,
  },
  {
    date: new Date('2020-02-26'),
    newDeaths: 0,
    totalDeaths: 0,
    newICUAdmissions: 1,
    activeICUAdmissions: 2,
    totalICUAdmissions: 2,
    confirmedNewCases: 1,
    confirmedTotalCases: 2,
  },
  {
    date: new Date('2020-02-27'),
    newDeaths: 0,
    totalDeaths: 0,
    newICUAdmissions: 0,
    activeICUAdmissions: 2,
    totalICUAdmissions: 2,
    confirmedNewCases: 1,
    confirmedTotalCases: 3,
  },
  {
    date: new Date('2020-02-28'),
    newDeaths: 0,
    totalDeaths: 0,
    newICUAdmissions: 0,
    activeICUAdmissions: 2,
    totalICUAdmissions: 2,
    confirmedNewCases: 1,
    confirmedTotalCases: 4,
  },
  {
    date: new Date('2020-02-29'),
    newDeaths: 0,
    totalDeaths: 0,
    newICUAdmissions: 1,
    totalICUAdmissions: 3,
    activeICUAdmissions: 3,
    confirmedNewCases: 4,
    confirmedTotalCases: 9,
  },
]

let lastChecked = new Date(localStorage.getItem('lastChecked') || '1970-01-01')
let cachedData = JSON.parse(localStorage.getItem('data') || '[]')
  .map(d => ({...d, date: new Date(d.date)}))

// Basically, if today's date is already in the dataset,
// or otherwise if we checked for new data less than 15 minutes ago,
// then we should use the cached data.
const shouldUseCachedData = now => cachedData.length > 0 && cachedData[0].length == null && (
  differenceInCalendarDays(now, new Date(cachedData.slice(-1)[0].date)) < 1
  || differenceInMinutes(now, lastChecked) < 60
)

const addTotalDeaths = ({data}) =>
  data.forEachWithPrev((cur, prev) =>
    cur.totalDeaths = prev.totalDeaths + cur.newDeaths)

const addICUAdmissions = ({data, icAdmissionsData}) =>
  data.forEachWithPrev((cur, prev) => {
    let el = icAdmissionsData.find(
      d => cur.date.getTime() === (new Date(d.date)).getTime()
    )

    if (el) {
      cur.newICUAdmissions = el.newIntake
      cur.totalICUAdmissions = el.intakeCumulative
    } else {
      cur.newICUAdmissions = cur.newICUAdmissions || 0
      cur.totalICUAdmissions = prev.totalICUAdmissions + cur.newICUAdmissions
    }
  })

const addActiveICUAdmissions = ({data, activeICUAdmissionsData}) =>
  data.forEachWithPrev((cur, prev) => {
    let el = activeICUAdmissionsData.find(
      d => cur.date.getTime() === (new Date(d.date)).getTime()
    )

    if (el) {
      cur.activeICUAdmissions = el.intakeCount
    } else {
      cur.activeICUAdmissions = prev.activeICUAdmissions
    }
  })

const addTotalFatalICUAdmissions = ({data, totalFatalICUAdmissionsData}) =>
  data.forEachWithPrev((cur, prev) => {
    let el = totalFatalICUAdmissionsData.find(
      d => cur.date.getTime() === (new Date(d.date)).getTime()
    )

    if (el) {
      cur.totalFatalICUAdmissions = el.diedCumulative
    } else {
      cur.totalFatalICUAdmissions = prev.totalFatalICUAdmissions || 0
    }
  })

const addPresumablyRecoveredFromICU = ({data}) =>
  data.forEach(cur =>
    cur.presumablyRecoveredFromICU =
      Math.max(0, cur.totalICUAdmissions
        - cur.activeICUAdmissions
        - cur.totalFatalICUAdmissions))

const addEstimatedNewCases =
  ({data, mortalityRate, daysToDeath, daysToDouble}) => {
    const growthFactor = Math.pow(2, 1 / daysToDouble)

    data.forEach((d, i) => {
      let estimate, days = Math.ceil(daysToDeath)
      let diff = days - daysToDeath

      if (data[i+days] && data[i+days].newDeaths) {
        estimate = data[i+days].newDeaths / mortalityRate / Math.pow(2, diff / daysToDouble)
      }
      else if (data[i+days-1] && data[i+days-1].newDeaths) {
        estimate = data[i+days-1].newDeaths / mortalityRate * Math.pow(2, diff / daysToDouble)
      }
      else if (d.newDeaths) {
        estimate = d.newDeaths / mortalityRate * Math.pow(2, daysToDeath / daysToDouble)
      }
      else if (data[i-1]) {
        estimate = data[i-1].estimatedNewCases * growthFactor
      }
      else {
        estimate = d.confirmedNewCases * Math.pow(2, daysToDeath / daysToDouble)
      }

      d.estimatedNewCases = Math.round(estimate)
    })
  }

const addEstimatedTotalCases = ({data}) =>
  data.forEach((d, i) =>
    d.estimatedTotalCases = i === 0 ? d.estimatedNewCases
      : data[i-1].estimatedTotalCases + d.estimatedNewCases)

const addDaysToDouble = ({data}) => data
  .map((d, i) => data[i] = {
    ...d,
    confirmedDaysToDouble: i > 0 ? (1 / Math.log2(d.confirmedTotalCases / data[i-1].confirmedTotalCases)).toFixed(2) : 0,
    estimatedDaysToDouble: i > 0 ? (1 / Math.log2(d.estimatedTotalCases / data[i-1].estimatedTotalCases)).toFixed(2) : 0,
  })
  .map((d, i) => data[i] = {
    ...d,
    confirmedDaysToDouble: d.confirmedDaysToDouble === "Infinity" ? 0 : d.confirmedDaysToDouble,
    estimatedDaysToDouble: d.estimatedDaysToDouble === "Infinity" ? 0 : d.estimatedDaysToDouble,
  })

const getRIVMData = async (assumptions) => {
  let now = new Date()

  if (shouldUseCachedData(now))
    return cachedData

  let resp, html,
    icAdmissionsData,
    activeICUAdmissionsData,
    totalFatalICUAdmissionsData

  try {
    resp = await fetch(icAdmissions)
    icAdmissionsData = await resp.json()

    resp = await fetch(activeICUAdmissions)
    activeICUAdmissionsData = await resp.json()

    resp = await fetch(totalFatalICUAdmissions)
    totalFatalICUAdmissionsData = await resp.json()

    resp = await fetch(rivm)
    html = await resp.text()
  } catch (e) {
    return cachedData
  }

  let m = [], prev = {}, data = []
  // This monstrous regex should match all the news items in the HTML from RIVM.
  let regex = /(\d\d)-(\d\d)-(\d\d\d\d)[\s\S]{0,150}?<h2>.*?(?:(\d+|\w+)\s+?pati.nt(?:en)?\s+?overleden,\s+?)?(\d+|\w+)\s+?nieuwe\s+?pati.nten(?:,\s+?in\s+?totaal\s+?(\d+)\s+?positie)?.*?<\/h2>/g

  while (m = regex.exec(html)) {
    let date = new Date(`${m[3]}-${m[2]}-${m[1]}`)
    let newDeaths = convertToNumber(m[4])
    let confirmedNewCases = convertToNumber(m[5])
    let confirmedTotalCases = convertToNumber(m[6])
      // Sometimes ^that number is not in the dataset
        // but then we can just simply calculated it ourselves:
        || prev.confirmedTotalCases - prev.confirmedNewCases

    data.push(prev = {date, newDeaths, confirmedNewCases, confirmedTotalCases})
  }

  data = data.concat([ ...initialData ].reverse())
  data.reverse() // RIVM shows the messages from newest -> oldest,
  // but we want the reverse.
  let props = {
    ...assumptions, data, icAdmissionsData,
    activeICUAdmissionsData, totalFatalICUAdmissionsData
  }

  addTotalDeaths(props)
  addICUAdmissions(props)
  addActiveICUAdmissions(props)
  addTotalFatalICUAdmissions(props)

  // Let's cache this data with a timestamp
  localStorage.setItem('lastChecked', lastChecked = now)
  localStorage.setItem('data', JSON.stringify(cachedData = data))

  return data
}

const computeData = async (assumptions) => {
  let data = await getRIVMData(assumptions)
  let props = { ...assumptions, data }

  addEstimatedNewCases(props)
  addEstimatedTotalCases(props)
  addDaysToDouble(props)
  addPresumablyRecoveredFromICU(props)

  return data
}

const addDay = ({data, mortalityRate, daysToDeath, daysToDouble}) => {

}

export default computeData