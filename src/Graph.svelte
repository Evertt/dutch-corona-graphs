<script>
  export let mortalityRate = 0.1
  export let daysToDeath = 20
  export let daysToDouble = 3

  import * as d3 from 'd3'
  import setup from './data'
  import { onMount } from 'svelte'
  import { addDays } from 'date-fns'

  const formatNumber = (new Intl.NumberFormat()).format
  const margin = {top: 30, right: 20, bottom: 30, left: 50}
  const width = 1000 - margin.left - margin.right
  const height = 500 - margin.top - margin.bottom

  let y

  const x = d3.scaleTime().range([0, width])

  const normalize = str => str.replace(/(?<=[a-z])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])/g, " ")
  let el, svg, xAxis, yAxis, valueline, graphLines, getData, data = []
  $: getData = () => setup({mortalityRate, daysToDeath, daysToDouble})
  $: getData().then(result => console.log(data = result))

  const possibleLines = {
    confirmedDaysToDouble: '#F6E05E',
    estimatedDaysToDouble: '#975A16',

    newICUAdmissions: '#48BB78',
    totalICUAdmissions: '#2F855A',
    activeICUAdmissions: '#9F7AEA',
    totalFatalICUAdmissions: '#B83280',
    presumablyRecoveredFromICU: '#4299E1',

    newDeaths: '#A0AEC0',
    totalDeaths: '#1A202C',

    confirmedNewCases: '#F6AD55',
    confirmedTotalCases: '#9C4221',

    estimatedNewCases: '#FC8181',
    estimatedTotalCases: '#C53030',
  }

  const defaultSettings = {
    selectedLines: [
      'confirmedNewCases',
      'confirmedTotalCases',
      'estimatedNewCases',
      'estimatedTotalCases',
    ],
    curveGraph: true,
    shouldUseLogScale: true
  }
  const savedSettings = JSON.parse(localStorage.getItem('graphSettings') || '{}')
  let settings = { ...defaultSettings, ...savedSettings }
  $: localStorage.setItem('graphSettings', JSON.stringify(settings))

  $: if (settings.shouldUseLogScale) {
    y = d3.scaleSymlog().range([height, 0])
  } else {
    y = d3.scaleLinear().range([height, 0])
  }

  let sLines
  $: sLines = Object.entries(possibleLines).map(e => ({
    line: e[0], color: e[1], active: settings.selectedLines.includes(e[0])
  }))
  $: if (svg != null) svg.selectAll('.mouse-per-line').data(sLines)

  onMount(async () => {
    let data = await getData()

    // Define the axes
    xAxis = d3.axisBottom().scale(x)
      .tickFormat(d3.timeFormat('%d-%m'))
      .tickValues(data.map(d => d.date))

    yAxis = d3.axisLeft().scale(y).ticks(5)

    // Adds the svg canvas
    svg = d3.select(el).append('svg')
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g').attr('transform', `translate(${margin.left},${margin.top})`)

    // Scale the range of the data
    x.domain([
      data[0].date,
      addDays(data.slice(-1)[0].date, 1)
    ])
    y.domain([0, d3.max(data, d => d3.max(settings.selectedLines, p => d[p] * 1.1))])

    graphLines = Object.keys(possibleLines).map(p => ({
      id: p,
      fn: d3.line()
        .x(d => x(d.date))
        .y(d => y(d[p]))
        .curve(settings.curveGraph ? d3.curveBasis : d3.curveLinear)
    }))

    graphLines
      .forEach(
        l => svg.append('path')
          .attr('id', l.id)
          .attr('class', 'line ' + (settings.selectedLines.includes(l.id) ? 'show' : 'hide'))
          .attr('style', `color: ${possibleLines[l.id]}`)
          .attr('d', l.fn(data))
      )

    // Add the X Axis
    svg.append('g').attr('class', 'x axis')
      .attr('transform', `translate(0, ${height})`).call(xAxis)

    // Add the Y Axis
    svg.append('g').attr('class', 'y axis').call(yAxis)

    const mouseG = svg.append('g').attr('class', 'mouse-over-effects')
    
    mouseG.append('path') // this is the black vertical line to follow mouse
      .attr('class', 'mouse-line')
      .style('stroke', 'black')
      .style('stroke-width', '1px')
      .style('opacity', '0')

    var lines = document.getElementsByClassName('line');

    var mousePerLine = mouseG.selectAll('.mouse-per-line')
      .data(sLines).enter()
      .append('g')
      .attr('class', 'mouse-per-line')
      .style('opacity', '0')

    mousePerLine.append('circle')
      .attr('r', 7)
      .style('stroke', d => d.color)
      .style('fill', 'none')
      .style('stroke-width', '1px')

    mousePerLine.append('text')
      .style('stroke', d => d.color)
      .attr('transform', 'translate(-10,-10)')
      .attr('text-anchor', 'end')

    mouseG.append('svg:rect') // append a rect to catch mouse movements on canvas
      .attr('width', width * data.length / (data.length + 1)) // can't catch mouse events on a g element
      .attr('height', height)
      .attr('fill', 'none')
      .attr('pointer-events', 'all')
      .on('mouseout', () => { // on mouse out hide line, circles and text
        d3.select('.mouse-line')
          .style('opacity', '0')
        d3.selectAll('.mouse-per-line')
          .style('opacity', '0')
      })
      .on('mouseover', () => { // on mouse in show line, circles and text
        d3.select('.mouse-line')
          .style('opacity', '0.5')
        d3.selectAll('.mouse-per-line')
          .style('opacity', d => d.active ? '1' : '0')
      })
      .on('mousemove', function() { // mouse moving over canvas
        var mouse = d3.mouse(this)
        var xDate = x.invert(mouse[0] - width/data.length/2),
          bisect = d3.bisector(d => d.date).right;
        let idx = width * bisect(data.map(dd => ({
          date: dd.date
        })), xDate) / data.length
        if (settings.curveGraph) idx = mouse[0]

        d3.select('.mouse-line')
          .attr('d', () => `M${idx},${height} ${idx},0`)

        d3.selectAll('.mouse-per-line')
          .attr('transform', function (d, i) {
            let pos = {}, beginning = 0,
              end = lines[i].getTotalLength(),
              target = null

            while (true) {
              target = Math.floor((beginning + end) / 2)
              pos = lines[i].getPointAtLength(target)
              if (
                (target === end || target === beginning)
                && pos.x !== idx
              ) break
              if (pos.x > idx) end = target
              else if (pos.x < idx) beginning = target
              else break //position found
            }

            let normalizedText = normalize(d.line).toLowerCase()
            let value = y.invert(pos.y)
            value = normalizedText.includes('double') || normalizedText.includes('rate')
              ? value.toFixed(1) : value.toFixed(0)
            d3.select(this).select('text').text(
              formatNumber(value) + ' ' + normalizedText
            )
              .attr('transform', idx < width / 5 ? 'translate(10,10)' : 'translate(-10,-10)')
              .attr('text-anchor', idx < width / 5 ? 'start' : 'end')

            return 'translate(' + idx + ',' + pos.y + ')';
          });
      });
  })

  async function updateData(getData, {selectedLines, curveGraph}) {
    if (svg == null) return

    const data = await getData()

    y.domain([0, d3.max(data, d => d3.max(selectedLines, p => d[p] * 1.1)) || 100000])

    const graphCurve = curveGraph ? d3.curveBasis : d3.curveLinear

    graphLines.forEach(
      l => l.fn.curve() === graphCurve
        ? svg.select(`#${l.id}`)
          .attr('class', 'line ' + (selectedLines.includes(l.id) ? 'show' : 'hide'))
          .transition().duration(750)
          .attr('d', l.fn(data))
        : svg.select(`#${l.id}`)
          .attr('d', (l.fn = l.fn.curve(graphCurve))(data))
    )

    yAxis.scale(y)
    svg.select('.y.axis')
      .transition().duration(750)
      .call(yAxis)
  }

  $: updateData(getData, settings)
</script>

{#each Object.keys(possibleLines) as possibleLine}
  <label style="color: {possibleLines[possibleLine]}">
    <input type="checkbox" value={possibleLine} bind:group={settings.selectedLines} />
    <span>{normalize(possibleLine)}</span>
  </label>
{/each}
<br>
<label>
  <input type="checkbox" bind:checked={settings.shouldUseLogScale}>
  Toggle between linear scale and log scale
</label>
<label>
  <input type="checkbox" bind:checked={settings.curveGraph}>
  curve the graph nicely?
</label>

<div bind:this={el}></div>

<style global>
  label span {
    text-transform: lowercase;
    display: inline-block;
  }

  label span:first-letter {
    text-transform: uppercase;
  }

  path.line {
    fill: none;
    stroke: currentColor;
    stroke-width: 3;
  }

  path.line.show {
    animation-name: draw;
    animation-duration: 7s;
    animation-iteration-count: 1;
    animation-fill-mode: forwards;
    animation-timing-function: linear;
    transition: opacity 1s;
    opacity: 1;
  }

  path.line.hide {
    transition: opacity .5s;
    opacity: 0;
  }

  @keyframes draw {
    0% {
      stroke-dasharray: 4813.713;
      stroke-dashoffset: 4813.713;
    }
    100% {
      stroke-dasharray: 4813.713;
      stroke-dashoffset: 0;
    }
  }
</style>