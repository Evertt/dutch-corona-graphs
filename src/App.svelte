<script>
	import Graph from './Graph.svelte'

	const defaultSettings = {
		mortalityRate: 0.01,
		daysToDeath: 17.5,
		daysToDouble: 3.5,
	}

	const savedSettings = JSON.parse(localStorage.getItem('appSettings') || '{}')
	let settings = { ...defaultSettings, ...savedSettings }
	$: localStorage.setItem('appSettings', JSON.stringify(settings))

	let mortalityPercentage, growthFactor
	$: growthFactor = Math.pow(2, 1 / settings.daysToDouble).toFixed(2)
	$: mortalityPercentage = Math.round(settings.mortalityRate * 200) / 2
</script>

<label>
	Mortality rate: {mortalityPercentage}%<br>
	<input type="range" bind:value={settings.mortalityRate} min="0.005" step="0.005" max="1" />
</label>

<label>
	Days from start to death: {settings.daysToDeath}<br>
	<input type="range" bind:value={settings.daysToDeath} min="0.5" step="0.5" max="40" />
</label>

<label>
	Infections double every {settings.daysToDouble} days.<br>
	Or in other words, they multiply by {growthFactor} per day.<br>
	<input type="range" bind:value={settings.daysToDouble} min="0.5" step="0.5" max="10" />
</label>

<Graph {...settings} />